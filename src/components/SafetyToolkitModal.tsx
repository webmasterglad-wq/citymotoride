import React, { useState } from 'react';
import { Shield, Phone, Share2, KeyRound, Check, AlertTriangle, X, Lock } from 'lucide-react';

interface SafetyToolkitModalProps {
  isOpen: boolean;
  onClose: () => void;
  rideId: string;
  pinCode: string;
  captainName?: string;
  vehicleDetails?: string;
}

export const SafetyToolkitModal: React.FC<SafetyToolkitModalProps> = ({
  isOpen,
  onClose,
  rideId,
  pinCode,
  captainName,
  vehicleDetails,
}) => {
  const [copied, setCopied] = useState(false);
  const [sosTriggered, setSosTriggered] = useState(false);

  if (!isOpen) return null;

  const handleShareTrip = () => {
    const url = `https://motoride.app/track/${rideId}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSos = () => {
    setSosTriggered(true);
    setTimeout(() => setSosTriggered(false), 5000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0f172a] border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center font-bold">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Safety Toolkit</h3>
              <p className="text-[11px] text-slate-400">24/7 Real-Time Trip Protection</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Safety PIN Card */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-center">
            <div className="flex items-center justify-center gap-1.5 text-amber-400 font-semibold text-xs">
              <KeyRound className="w-4 h-4" />
              <span>Verify Ride PIN</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Provide this code to your Captain before mounting the motorcycle:
            </p>
            <div className="flex items-center justify-center gap-2 pt-1">
              {pinCode.split('').map((digit, i) => (
                <span
                  key={i}
                  className="w-10 h-12 rounded-xl bg-slate-900 border-2 border-amber-500/50 text-amber-300 font-mono text-xl font-black flex items-center justify-center shadow-lg"
                >
                  {digit}
                </span>
              ))}
            </div>
          </div>

          {/* Share Live Trip Link */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="font-bold text-slate-200 block">Share Live Trip ETA</span>
              <p className="text-[11px] text-slate-400">
                Let family follow your route & captain details in real-time.
              </p>
            </div>
            <button
              onClick={handleShareTrip}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-xl font-bold text-xs border border-slate-700 flex items-center gap-1.5 transition-colors shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Share'}
            </button>
          </div>

          {/* Captain & Vehicle Check */}
          {captainName && (
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-500">Verified Captain Identity</span>
              <div className="flex items-center justify-between text-xs text-slate-200">
                <span className="font-bold">{captainName}</span>
                <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                  <Lock className="w-3 h-3" /> Background Checked
                </span>
              </div>
              <p className="text-[11px] text-slate-400">{vehicleDetails}</p>
            </div>
          )}

          {/* SOS Emergency Assistance */}
          <div className="pt-2">
            <button
              onClick={handleSos}
              className="w-full py-3 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-lg"
            >
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              {sosTriggered ? '🚨 Emergency Dispatch Alerted (Simulation)' : 'Emergency Assistance (SOS)'}
            </button>
            <p className="text-[10px] text-slate-500 text-center mt-1.5">
              For immediate danger, always dial local emergency services directly (911).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
