import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2, Home, RotateCcw } from 'lucide-react';
import { safeStorage } from '../utils/safeStorage';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[MotoRide Uncaught Error Boundary]:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleTryRecover = () => {
    // Attempt state recovery without full page reload
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleReload = () => {
    try {
      window.location.reload();
    } catch {
      window.location.href = '/';
    }
  };

  private handleResetAndReload = () => {
    try {
      const keysToClear = [
        'motoride_active_ride',
        'motoride_last_status_event',
        'motoride_offers_',
        'motoride_chat_',
      ];
      keysToClear.forEach((prefix) => {
        safeStorage.removeItem(prefix);
      });
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        try {
          const storage = window.localStorage;
          for (let i = storage.length - 1; i >= 0; i--) {
            const key = storage.key(i);
            if (key && keysToClear.some((prefix) => key.startsWith(prefix))) {
              storage.removeItem(key);
            }
          }
        } catch {}
      }
    } catch {}
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 selection:bg-amber-500 selection:text-slate-950">
          <div className="w-full max-w-md bg-slate-900/95 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-xl flex flex-col items-center text-center">
            {/* Logo */}
            <div className="flex items-center gap-2.5 mb-6">
              <img
                src="/app-icon.png"
                alt="MotoRide"
                className="w-12 h-12 rounded-xl object-cover shadow-md border border-amber-400/30"
                referrerPolicy="no-referrer"
              />
              <div className="text-left">
                <div className="text-lg font-bold tracking-tight text-white leading-none">
                  Moto<span className="text-amber-500">Ride</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Tricity Live Moto Dispatch
                </div>
              </div>
            </div>

            {/* Error Icon */}
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h1 className="text-xl font-bold text-white mb-2">
              Display Notice
            </h1>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">
              The mobile application encountered a temporary display issue. Tap below to reconnect immediately.
            </p>

            {/* Action Buttons */}
            <div className="w-full flex flex-col gap-2.5">
              <button
                type="button"
                onClick={this.handleTryRecover}
                className="w-full py-3.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 font-bold text-sm transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Resume Application
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-slate-200 font-medium text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reload Page
              </button>

              <button
                type="button"
                onClick={this.handleResetAndReload}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-slate-400 font-medium text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer border border-slate-800"
              >
                <Trash2 className="w-3 h-3 text-slate-500" />
                Clear Local Cache &amp; Reconnect
              </button>
            </div>

            {/* Technical details accordion */}
            {this.state.error && (
              <details className="w-full mt-6 text-left">
                <summary className="text-xs text-slate-500 hover:text-slate-400 cursor-pointer select-none">
                  View technical details
                </summary>
                <div className="mt-2 p-3 bg-slate-950 rounded-lg text-[11px] font-mono text-rose-400 overflow-x-auto border border-slate-800/80 max-h-32">
                  {this.state.error.toString()}
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

