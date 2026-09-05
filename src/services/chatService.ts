import { getSupabaseClient } from '../lib/supabase';
import { ChatMessage } from '../types/ride';
import { playMessageReceivedChime } from '../utils/audioAlert';

const STORAGE_PREFIX = 'motoride_chat_';
const UNREAD_PREFIX = 'motoride_chat_unread_';
const BROADCAST_BUS_NAME = 'motoride_chat_bus';

/**
 * Get stored messages from localStorage for a specific ride
 */
export const getStoredChatMessages = (rideId: string): ChatMessage[] => {
  if (!rideId) return [];
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + rideId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/**
 * Persist messages locally for a ride
 */
export const saveChatMessagesToStorage = (rideId: string, messages: ChatMessage[]): void => {
  if (!rideId) return;
  try {
    localStorage.setItem(STORAGE_PREFIX + rideId, JSON.stringify(messages));
  } catch (e) {
    console.warn('[ChatService] Error saving to localStorage:', e);
  }
};

/**
 * Get unread message count for a role ('passenger' or 'captain') on a ride
 */
export const getUnreadCount = (rideId: string, role: 'passenger' | 'captain'): number => {
  if (!rideId) return 0;
  try {
    const raw = localStorage.getItem(`${UNREAD_PREFIX}${rideId}_${role}`);
    return raw ? Math.max(0, parseInt(raw, 10) || 0) : 0;
  } catch {
    return 0;
  }
};

/**
 * Set unread message count for a role on a ride
 */
export const setUnreadCount = (rideId: string, role: 'passenger' | 'captain', count: number): void => {
  if (!rideId) return;
  try {
    localStorage.setItem(`${UNREAD_PREFIX}${rideId}_${role}`, String(Math.max(0, count)));
    // Notify same window
    window.dispatchEvent(
      new CustomEvent('motoride:chat_unread_change', {
        detail: { rideId, role, count: Math.max(0, count) },
      })
    );
  } catch {}
};

/**
 * Mark messages as read for a given role (e.g. when passenger or captain opens the chat)
 */
export const markMessagesAsRead = (rideId: string, role: 'passenger' | 'captain'): void => {
  setUnreadCount(rideId, role, 0);
};

/**
 * Fetch messages from Supabase database if available and merge with local cache
 */
export const syncChatMessagesFromDatabase = async (rideId: string): Promise<ChatMessage[]> => {
  if (!rideId) return [];
  const localMsgs = getStoredChatMessages(rideId);
  const supabase = getSupabaseClient();
  if (!supabase) return localMsgs;

  try {
    const { data, error } = await supabase
      .from('rides')
      .select('chat_messages')
      .eq('id', rideId)
      .single();

    if (!error && data?.chat_messages && Array.isArray(data.chat_messages)) {
      const dbMsgs: ChatMessage[] = data.chat_messages;
      // Merge unique by message id
      const existingIds = new Set(localMsgs.map((m) => m.id));
      const combined = [...localMsgs];

      for (const msg of dbMsgs) {
        if (!existingIds.has(msg.id)) {
          combined.push(msg);
          existingIds.add(msg.id);
        }
      }

      // Sort by creation or timestamp
      saveChatMessagesToStorage(rideId, combined);
      return combined;
    }
  } catch (err) {
    // Column might not exist yet, fallback gracefully to local storage
  }

  return localMsgs;
};

/**
 * Send a new chat message with multi-channel synchronization:
 * 1. LocalStorage & in-memory cache
 * 2. Supabase Realtime WebSocket broadcast (cross-device: phone <-> laptop)
 * 3. Browser BroadcastChannel (cross-tab in same browser)
 * 4. Window CustomEvent (dual-view simulator in same window)
 * 5. Supabase Postgres rides table chat_messages column (persistence on reload)
 */
export const sendChatMessage = async (
  rideId: string,
  sender: 'passenger' | 'captain',
  senderName: string,
  text: string
): Promise<ChatMessage> => {
  const cleanText = text.trim();
  if (!cleanText) {
    throw new Error('Message text cannot be empty');
  }

  const now = new Date();
  const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const uniqueId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const newMsg: ChatMessage = {
    id: uniqueId,
    rideId,
    sender,
    senderName: senderName || (sender === 'captain' ? 'Captain' : 'Passenger'),
    text: cleanText,
    timestamp: timeFormatted,
  };

  // 1. Save to local storage
  const currentMessages = getStoredChatMessages(rideId);
  const updatedMessages = [...currentMessages, newMsg];
  saveChatMessagesToStorage(rideId, updatedMessages);

  // 2. Increment unread count for the other party
  const targetRole: 'passenger' | 'captain' = sender === 'passenger' ? 'captain' : 'passenger';
  const currentUnread = getUnreadCount(rideId, targetRole);
  setUnreadCount(rideId, targetRole, currentUnread + 1);

  // 3. Dispatch In-Window CustomEvent (DualViewSimulator / Same Page)
  try {
    window.dispatchEvent(
      new CustomEvent('motoride:chat_message', {
        detail: { rideId, message: newMsg },
      })
    );
  } catch {}

  // 4. Send via Browser BroadcastChannel (Across separate tabs on same machine)
  try {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const bc = new BroadcastChannel(BROADCAST_BUS_NAME);
      bc.postMessage({
        type: 'CHAT_MESSAGE',
        rideId,
        message: newMsg,
        timestamp: Date.now(),
      });
      setTimeout(() => {
        try {
          bc.close();
        } catch {}
      }, 1000);
    }
  } catch {}

  // 5. Trigger storage event ping
  try {
    localStorage.setItem(
      'motoride_last_chat_ping',
      JSON.stringify({ rideId, id: newMsg.id, timestamp: Date.now() })
    );
  } catch {}

  // 6. Supabase Realtime WebSocket broadcast (Across different phones/devices)
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const channel = supabase.channel(`ride_chat_${rideId}`);
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'new_chat_message',
            payload: { rideId, message: newMsg },
          }).catch(() => {});
        }
      });

      // Also send immediately if channel already subscribed
      channel.send({
        type: 'broadcast',
        event: 'new_chat_message',
        payload: { rideId, message: newMsg },
      }).catch(() => {});

      // 7. Persist to Supabase Database (if column exists)
      Promise.resolve(
        supabase
          .from('rides')
          .update({ chat_messages: updatedMessages })
          .eq('id', rideId)
      ).catch(() => {});
    } catch (e) {
      console.warn('[ChatService] Supabase Realtime broadcast note:', e);
    }
  }

  return newMsg;
};

/**
 * Subscribe to real-time chat messages for a ride across all channels:
 * - Supabase Realtime Broadcast (devices)
 * - BroadcastChannel (tabs)
 * - CustomEvent (same page / dual view)
 * - StorageEvent (storage fallback)
 */
export const subscribeToRideChat = (
  rideId: string,
  onNewMessage: (message: ChatMessage) => void
): (() => void) => {
  if (!rideId || typeof window === 'undefined') return () => {};

  const seenMsgIds = new Set<string>();
  // Preload existing IDs so we don't duplicate
  getStoredChatMessages(rideId).forEach((m) => seenMsgIds.add(m.id));

  const handleIncomingMessage = (msg: ChatMessage) => {
    if (!msg || !msg.id || msg.rideId !== rideId) return;
    if (seenMsgIds.has(msg.id)) return;

    seenMsgIds.add(msg.id);

    // Ensure it's in localStorage
    const current = getStoredChatMessages(rideId);
    if (!current.some((m) => m.id === msg.id)) {
      saveChatMessagesToStorage(rideId, [...current, msg]);
    }

    onNewMessage(msg);
  };

  // 1. Same Window CustomEvent
  const handleCustomEvent = (e: any) => {
    if (e.detail?.rideId === rideId && e.detail?.message) {
      handleIncomingMessage(e.detail.message);
    }
  };
  window.addEventListener('motoride:chat_message', handleCustomEvent);

  // 2. Cross-tab BroadcastChannel
  let bc: BroadcastChannel | null = null;
  if ('BroadcastChannel' in window) {
    try {
      bc = new BroadcastChannel(BROADCAST_BUS_NAME);
      bc.onmessage = (e) => {
        if (e.data?.type === 'CHAT_MESSAGE' && e.data?.rideId === rideId && e.data?.message) {
          handleIncomingMessage(e.data.message);
        }
      };
    } catch {}
  }

  // 3. Storage Event (different tabs)
  const handleStorageEvent = (e: StorageEvent) => {
    if (e.key === STORAGE_PREFIX + rideId && e.newValue) {
      try {
        const msgs: ChatMessage[] = JSON.parse(e.newValue);
        if (Array.isArray(msgs)) {
          msgs.forEach((m) => handleIncomingMessage(m));
        }
      } catch {}
    } else if (e.key === 'motoride_last_chat_ping' && e.newValue) {
      try {
        const ping = JSON.parse(e.newValue);
        if (ping?.rideId === rideId) {
          const fresh = getStoredChatMessages(rideId);
          fresh.forEach((m) => handleIncomingMessage(m));
        }
      } catch {}
    }
  };
  window.addEventListener('storage', handleStorageEvent);

  // 4. Supabase Realtime WebSocket broadcast (multi-device)
  const supabase = getSupabaseClient();
  let supabaseChannel: any = null;
  if (supabase) {
    try {
      supabaseChannel = supabase
        .channel(`ride_chat_${rideId}`)
        .on('broadcast', { event: 'new_chat_message' }, ({ payload }) => {
          if (payload?.rideId === rideId && payload?.message) {
            handleIncomingMessage(payload.message);
          }
        })
        .subscribe();
    } catch (e) {
      console.warn('[ChatService] Error subscribing to Supabase chat channel:', e);
    }
  }

  // Cleanup function
  return () => {
    window.removeEventListener('motoride:chat_message', handleCustomEvent);
    window.removeEventListener('storage', handleStorageEvent);
    if (bc) {
      try {
        bc.close();
      } catch {}
    }
    if (supabase && supabaseChannel) {
      try {
        supabase.removeChannel(supabaseChannel);
      } catch {}
    }
  };
};

/**
 * Subscribe to unread count changes and new message alerts for a specific role
 */
export const subscribeToUnreadCount = (
  rideId: string,
  userRole: 'passenger' | 'captain',
  onUpdate: (count: number, latestMessage?: ChatMessage) => void
): (() => void) => {
  if (!rideId || typeof window === 'undefined') return () => {};

  // Immediately notify current count
  const initialCount = getUnreadCount(rideId, userRole);
  const stored = getStoredChatMessages(rideId);
  const otherRole = userRole === 'passenger' ? 'captain' : 'passenger';
  const initialLatest = [...stored].reverse().find((m) => m.sender === otherRole);
  onUpdate(initialCount, initialLatest);

  // Listen for unread change events
  const handleUnreadChange = (e: any) => {
    if (e.detail?.rideId === rideId && e.detail?.role === userRole) {
      const currentStored = getStoredChatMessages(rideId);
      const latest = [...currentStored].reverse().find((m) => m.sender === otherRole);
      onUpdate(e.detail.count, latest);
    }
  };
  window.addEventListener('motoride:chat_unread_change', handleUnreadChange);

  // Also listen for incoming chat messages to trigger audio chime and update latest
  const unsubscribeChat = subscribeToRideChat(rideId, (msg) => {
    if (msg.sender !== userRole) {
      // Play audio notification chime for incoming message from other party
      playMessageReceivedChime();
      const currentCount = getUnreadCount(rideId, userRole);
      onUpdate(currentCount, msg);
    }
  });

  return () => {
    window.removeEventListener('motoride:chat_unread_change', handleUnreadChange);
    unsubscribeChat();
  };
};
