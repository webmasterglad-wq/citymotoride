import React, { useState } from 'react';
import {
  DollarSign,
  Clock,
  CheckCircle2,
  TrendingUp,
  X,
  Minus,
  Maximize2,
  Minimize2,
  ExternalLink,
  Receipt,
  Wallet,
  Calendar,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { CaptainEarningsSummary } from '../types/ride';

interface TodayIncomeWindowProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenFullEarnings: () => void;
  earningsSummary: CaptainEarningsSummary;
  onlineMinutes: number;
  isLight: boolean;
}

export const TodayIncomeWindow: React.FC<TodayIncomeWindowProps> = ({
  isOpen,
  onClose,
  onOpenFullEarnings,
  earningsSummary,
  onlineMinutes,
  isLight,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);

  if (!isOpen) return null;

  const targetGoal = 1500;
  const progressPercent = Math.min(100, Math.round((earningsSummary.todayIncome / targetGoal) * 100));
  const hours = Math.floor(onlineMinutes / 60);
  const minutes = onlineMinutes % 60;
  const avgPerTrip =
    earningsSummary.todayCompletedCount > 0
      ? (earningsSummary.todayIncome / earningsSummary.todayCompletedCount).toFixed(0)
      : '0';

  return (
    <div
      id="today-income-floating-window"
      className="fixed z-50 top-16 left-3 sm:left-6 max-w-sm w-[calc(100vw-24px)] animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <div
        className={`rounded-2xl border shadow-2xl overflow-hidden transition-all duration-300 backdrop-blur-md ${
          isLight
            ? 'bg-white/95 border-emerald-200/90 text-slate-900 shadow-emerald-500/10'
            : 'bg-slate-950/95 border-emerald-500/30 text-slate-100 shadow-2xl shadow-emerald-950/50'
        }`}
      >
        {/* Window Top Title Bar */}
        <div
          className={`px-3 py-2.5 flex items-center justify-between border-b select-none ${
            isLight
              ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-100'
              : 'bg-gradient-to-r from-emerald-950/60 to-slate-900 border-emerald-900/50'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-xs shrink-0 shadow-xs">
              ₹
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 truncate">
                  Today's Income
                </span>
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                    isLight ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-500/20 text-emerald-300'
                  }`}
                >
                  Live
                </span>
              </div>
            </div>
          </div>

          {/* Window Control Buttons: Minimize, Expand to Full Modal, Close */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              id="today-income-window-minimize-btn"
              onClick={() => setIsMinimized(!isMinimized)}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                isLight
                  ? 'hover:bg-slate-100 text-slate-600 border-slate-200'
                  : 'hover:bg-slate-800 text-slate-400 border-slate-700'
              }`}
              title={isMinimized ? 'Expand Window' : 'Minimize Window'}
            >
              {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              id="today-income-window-full-modal-btn"
              onClick={() => {
                onOpenFullEarnings();
                onClose();
              }}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                isLight
                  ? 'hover:bg-slate-100 text-slate-600 border-slate-200'
                  : 'hover:bg-slate-800 text-slate-400 border-slate-700'
              }`}
              title="Open Full Earnings Statement"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              id="today-income-window-close-btn"
              onClick={onClose}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                isLight
                  ? 'hover:bg-rose-100 text-slate-600 hover:text-rose-600 border-slate-200'
                  : 'hover:bg-rose-900/30 text-slate-400 hover:text-rose-400 border-slate-700'
              }`}
              title="Close Income Window"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Minimized Compact View */}
        {isMinimized ? (
          <div className="p-3 flex items-center justify-between gap-3">
            <div>
              <span className={`text-[10px] uppercase font-bold block ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                Today's Net Cash
              </span>
              <span className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
                ₹{earningsSummary.todayIncome.toFixed(2)}
              </span>
            </div>
            <div className="text-right">
              <span className={`text-[10px] uppercase font-bold block ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                Trips Completed
              </span>
              <span className="text-sm font-black text-slate-700 dark:text-slate-200">
                {earningsSummary.todayCompletedCount} rides ({hours}h {minutes}m)
              </span>
            </div>
          </div>
        ) : (
          /* Full Minimized Window Content */
          <div className="p-3.5 space-y-3">
            {/* Income Hero Figure Card */}
            <div
              className={`p-3 rounded-xl border flex items-center justify-between ${
                isLight
                  ? 'bg-gradient-to-br from-emerald-50 to-teal-50/50 border-emerald-200'
                  : 'bg-gradient-to-br from-emerald-950/40 to-slate-900 border-emerald-500/20'
              }`}
            >
              <div>
                <span className={`text-[10px] uppercase font-bold tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Net Take-Home Earnings
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                    ₹{earningsSummary.todayIncome.toFixed(2)}
                  </span>
                  <span className={`text-[10px] font-bold ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                    INR
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  {earningsSummary.todayIncome >= earningsSummary.yesterdayIncome ? '+Active Day' : 'On Track'}
                </span>
                <span className={`text-[9px] block mt-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                  Yesterday: ₹{earningsSummary.yesterdayIncome.toFixed(0)}
                </span>
              </div>
            </div>

            {/* Quick KPI Stats Row */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className={`p-2 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
                <span className={`text-[9px] uppercase font-bold block ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                  Rides
                </span>
                <span className="text-xs font-black mt-0.5 block text-slate-800 dark:text-slate-200">
                  {earningsSummary.todayCompletedCount}
                </span>
              </div>
              <div className={`p-2 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
                <span className={`text-[9px] uppercase font-bold block ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                  Shift Time
                </span>
                <span className="text-xs font-black mt-0.5 block text-slate-800 dark:text-slate-200">
                  {hours}h {minutes}m
                </span>
              </div>
              <div className={`p-2 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
                <span className={`text-[9px] uppercase font-bold block ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                  Avg / Trip
                </span>
                <span className="text-xs font-black mt-0.5 block text-emerald-600 dark:text-emerald-400 font-mono">
                  ₹{avgPerTrip}
                </span>
              </div>
            </div>

            {/* Daily Goal Target Progress */}
            <div className={`p-2.5 rounded-xl border space-y-1.5 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/60 border-slate-800'}`}>
              <div className="flex items-center justify-between text-[10px] font-bold">
                <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>Daily Goal Target</span>
                <span className="text-amber-500 font-black">
                  ₹{earningsSummary.todayIncome.toFixed(0)} / ₹{targetGoal} ({progressPercent}%)
                </span>
              </div>
              <div className={`w-full h-1.5 rounded-full overflow-hidden ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`}>
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Today's Completed Trips List preview */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-[10px] uppercase font-bold tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Today's Rides ({earningsSummary.todayRides?.length || 0})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onOpenFullEarnings();
                    onClose();
                  }}
                  className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  View All <ArrowUpRight className="w-2.5 h-2.5" />
                </button>
              </div>

              {earningsSummary.todayRides && earningsSummary.todayRides.length > 0 ? (
                <div className="max-h-28 overflow-y-auto space-y-1.5 pr-0.5 no-scrollbar">
                  {earningsSummary.todayRides.slice(0, 3).map((ride) => (
                    <div
                      key={ride.id}
                      className={`p-2 rounded-lg border flex items-center justify-between text-xs ${
                        isLight ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-slate-800'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <span className="font-bold block truncate text-[11px] text-slate-800 dark:text-slate-200">
                          {ride.dropoff_location?.split(',')[0] || 'Trip Destination'}
                        </span>
                        <span className={`text-[9px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                          {ride.completed_at
                            ? new Date(ride.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : 'Completed'}
                        </span>
                      </div>
                      <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 shrink-0 text-xs">
                        +₹{Number(ride.fare || 0).toFixed(0)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`p-3 rounded-lg border text-center text-[10px] ${
                  isLight ? 'bg-slate-50 border-slate-200 text-slate-400' : 'bg-slate-900 border-slate-800 text-slate-500'
                }`}>
                  No completed rides yet today. Go online to earn!
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="flex gap-2 pt-1 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  onOpenFullEarnings();
                  onClose();
                }}
                className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1"
              >
                <Receipt className="w-3.5 h-3.5" /> Full Statement
              </button>
              <button
                type="button"
                onClick={onClose}
                className={`px-3 py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                  isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
