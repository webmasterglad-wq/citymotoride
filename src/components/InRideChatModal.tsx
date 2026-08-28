import React, { useState, useEffect, useRef } from 'react';
import { Send, X, Shield, Phone, MessageSquare, Check, User } from 'lucide-react';
import { ChatMessage } from '../types/ride';

interface InRideChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  rideId: string;
  currentUserRole: 'passenger' | 'captain';
  currentUserName: string;
  otherPartyName: string;
  otherPartyRole: string;
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
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Storage key per ride
  const storageKey = `motoride_chat_${rideId}`;

  // Load chat from localStorage or seed initial welcome message
  useEffect(() => {
    if (!isOpen) return;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        setMessages(JSON.parse(stored));
      } catch (e) {
        setMessages([]);
      }
    } else {
      const initial: ChatMessage[] = [
        {
          id: 'sys-1',
          rideId,
          sender: currentUserRole === 'passenger' ? 'captain' : 'passenger',
          senderName: otherPartyName,
          text: currentUserRole === 'passenger'
            ? `Hi ${currentUserName}! I'm on my way to pick you up.`
            : `Hi ${otherPartyName}! I'm waiting at the pickup spot.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ];
      setMessages(initial);
      localStorage.setItem(storageKey, JSON.stringify(initial));
    }
  }, [isOpen, rideId, storageKey, currentUserRole, currentUserName, otherPartyName]);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen) return null;

  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend || inputMsg).trim();
    if (!text) return;

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      rideId,
      sender: currentUserRole,
      senderName: currentUserName,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updated = [...messages, newMsg];
    setMessages(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setInputMsg('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0f172a] border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col h-[520px]">
        {/* Header */}
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center font-bold">
              <User className="w-5 h-5" />
            </div>
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

          {messages.map((msg) => {
            const isMe = msg.sender === currentUserRole;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs shadow-md ${
                    isMe
                      ? 'bg-emerald-500 text-slate-950 font-medium rounded-tr-none'
                      : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700'
                  }`}
                >
                  <p>{msg.text}</p>
                </div>
                <span className="text-[9px] text-slate-500 mt-1 px-1 font-mono">
                  {msg.timestamp}
                </span>
              </div>
            );
          })}
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
            value={inputMsg}
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
