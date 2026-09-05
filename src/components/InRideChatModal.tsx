import React, { useState, useEffect, useRef } from 'react';
import { Send, X, Shield, Phone, MessageSquare, Check, User, CheckCheck } from 'lucide-react';
import { ChatMessage } from '../types/ride';
import {
  getStoredChatMessages,
  sendChatMessage,
  subscribeToRideChat,
  markMessagesAsRead,
  syncChatMessagesFromDatabase,
} from '../services/chatService';

interface InRideChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  rideId: string;
  currentUserRole: 'passenger' | 'captain';
  currentUserName: string;
  otherPartyName: string;
  otherPartyRole: string;
  otherPartyAvatarUrl?: string;
}

const QUICK_REPLIES = {
  passenger: [
    "I'm waiting at the main entrance.",
    "Wearing a dark jacket and backpack.",
    "Take your time, no rush!",
    "I can see you approaching.",
  ],
  captain: [
    "I'm on my way, ETA 2 minutes.",
    "Arrived! Hazard lights are blinking.",
    "Traffic is moving smoothly.",
    "Please bring your safety helmet if available.",
  ],
};

export const InRideChatModal: React.FC<InRideChatModalProps> = ({
  isOpen,
  onClose,
  rideId,
  currentUserRole,
  currentUserName,
  otherPartyName,
  otherPartyRole,
  otherPartyAvatarUrl,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Load chat and sync with Supabase
  useEffect(() => {
    if (!isOpen || !rideId) return;

    // 1. Initial local load
    const local = getStoredChatMessages(rideId);
    setMessages(local);
    markMessagesAsRead(rideId, currentUserRole);

    // 2. Database background sync
    syncChatMessagesFromDatabase(rideId).then((synced) => {
      if (synced && synced.length > 0) {
        setMessages(synced);
      }
    });

    // 3. Real-time subscription across tabs & devices
    const unsubscribe = subscribeToRideChat(rideId, (newMsg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      // Mark as read immediately since user has modal open
      markMessagesAsRead(rideId, currentUserRole);
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen, rideId, currentUserRole]);

  // Auto scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen) return null;

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMsg).trim();
    if (!text || isSending) return;

    setIsSending(true);
    try {
      const sentMsg = await sendChatMessage(
        rideId,
        currentUserRole,
        currentUserName,
        text
      );

      setMessages((prev) => {
        if (prev.some((m) => m.id === sentMsg.id)) return prev;
        return [...prev, sentMsg];
      });
      setInputMsg('');
    } catch (err) {
      console.error('[InRideChatModal] Error sending message:', err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0f172a] border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col h-[520px]">
        {/* Header */}
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {otherPartyAvatarUrl ? (
              <img
                src={otherPartyAvatarUrl}
                alt={otherPartyName}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-full object-cover border border-emerald-500/40 shadow"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center font-bold">
                <User className="w-5 h-5" />
              </div>
            )}
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                {otherPartyName}
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                  {otherPartyRole}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">In-Ride Encrypted Chat</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0a0f1d]">
          <div className="text-center my-2">
            <span className="text-[10px] bg-slate-800/80 text-slate-400 px-2.5 py-1 rounded-full border border-slate-700">
              Trip Chat · Active Ride #{rideId.slice(0, 6)}
            </span>
          </div>

          {messages.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <p className="text-xs font-semibold">No messages yet</p>
              <p className="text-[11px] text-slate-500 mt-1">Send a message to coordinate pickup or ride details.</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender === currentUserRole;
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <span className="text-[10px] text-slate-400 font-semibold mb-1 px-1">
                    {isMe ? 'You' : msg.senderName || otherPartyName}
                  </span>
                  <div
                    className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-xs shadow-md break-words ${
                      isMe
                        ? 'bg-emerald-500 text-slate-950 font-medium rounded-tr-none'
                        : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700'
                    }`}
                  >
                    <p className="leading-relaxed">{msg.text}</p>
                  </div>
                  <div className="flex items-center gap-1 text-[9px] text-slate-500 mt-1 px-1 font-mono">
                    <span>{msg.timestamp}</span>
                    {isMe && <CheckCheck className="w-3 h-3 text-emerald-400 inline" />}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Reply Chips */}
        <div className="px-3 py-2 bg-slate-900/90 border-t border-slate-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {QUICK_REPLIES[currentUserRole].map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(chip)}
              className="text-[10px] whitespace-nowrap bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-full border border-slate-700 transition-colors shrink-0"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2"
        >
          <input
            type="text"
            value={inputMsg || ''}
            onChange={(e) => setInputMsg(e.target.value)}
            placeholder={`Message ${otherPartyName}...`}
            className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-400"
          />
          <button
            type="submit"
            disabled={!inputMsg.trim()}
            className="p-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold rounded-xl transition-colors shadow-md shadow-emerald-500/20 cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
