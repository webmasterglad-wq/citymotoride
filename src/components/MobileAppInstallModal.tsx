import React, { useState } from 'react';
import {
  Smartphone,
  Download,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  X,
  Share2,
  PlusSquare,
  ShieldCheck,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { ApkMetadata, downloadRealApk, formatFileSize } from '../services/apkService';

interface MobileAppInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  apkMeta: ApkMetadata | null;
  onOpenAdmin?: () => void;
  isLight?: boolean;
}

export const MobileAppInstallModal: React.FC<MobileAppInstallModalProps> = ({
  isOpen,
  onClose,
  apkMeta,
  onOpenAdmin,
  isLight = false,
}) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);

  if (!isOpen) return null;

  const handleDownloadApk = async () => {
    setIsDownloading(true);
    setDownloadSuccess(false);
    try {
      await downloadRealApk();
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleNativeInstall = async () => {
    const success = await install();
    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden transition-all max-h-[92vh] flex flex-col ${
          isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-slate-100'
        }`}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 font-black text-xs shadow-md shadow-amber-500/20">
              MR
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight leading-tight">MotoRide Mobile App</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Install or Download for Android & iOS</p>
            </div>
          </div>
          <button
            type="button"
            id="close-mobile-install-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Option 1: 1-Tap Direct Install (Recommended) */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              isLight
                ? 'bg-gradient-to-br from-emerald-50 to-teal-50/50 border-emerald-200 text-slate-900'
                : 'bg-gradient-to-br from-emerald-950/40 to-teal-950/20 border-emerald-500/30 text-slate-100'
            }`}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/30">
                  <Smartphone className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-black tracking-tight">1-Tap Direct Mobile Install</h3>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                    Fastest & Recommended (Zero Parsing Errors)
                  </span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                Official
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
              Installs MotoRide directly to your phone screen as a standalone mobile app with full-screen view, instant offline caching, and real-time ride tracking.
            </p>

            {isInstalled ? (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>MotoRide is already installed on this device!</span>
              </div>
            ) : isInstallable ? (
              <button
                type="button"
                id="pwa-one-tap-install-btn"
                onClick={handleNativeInstall}
                className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer active:scale-98"
              >
                <Smartphone className="w-4 h-4" />
                <span>Install MotoRide on This Device</span>
              </button>
            ) : isIOS ? (
              <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-xs text-sky-950 dark:text-sky-200 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5">
                  <Share2 className="w-3.5 h-3.5 text-sky-500" />
                  <span>How to install on iPhone / iPad:</span>
                </div>
                <ol className="list-decimal pl-5 space-y-1 text-[11px]">
                  <li>
                    Tap Safari's <strong>Share</strong> button at the bottom.
                  </li>
                  <li>
                    Scroll down and tap <strong>Add to Home Screen</strong>.
                  </li>
                </ol>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <PlusSquare className="w-3.5 h-3.5" />
                  <span>How to install on Android Chrome:</span>
                </div>
                <ol className="list-decimal pl-5 space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                  <li>
                    Tap Chrome's <strong>three dots menu (⋮)</strong> in the top-right.
                  </li>
                  <li>
                    Select <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                  </li>
                  <li>MotoRide will appear on your device home screen like a native Play Store app!</li>
                </ol>
              </div>
            )}
          </div>

          {/* Option 2: Download APK File */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-900/60 border-slate-800 text-slate-100'
            }`}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-amber-500/10 text-amber-500">
                  <Download className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-black tracking-tight">Download Android APK (.apk)</h3>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {apkMeta?.fileName || 'MotoRide_Mobile_App.apk'} • {apkMeta?.fileSize ? formatFileSize(apkMeta.fileSize) : 'Android Package'}
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 font-bold">
                v{apkMeta?.version || '1.2.0'}
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">
              Standalone package archive for manual sideloading on Android devices and testing.
            </p>

            <button
              type="button"
              id="modal-download-apk-btn"
              onClick={handleDownloadApk}
              disabled={isDownloading}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white dark:bg-slate-800 dark:hover:bg-slate-700 font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition-all cursor-pointer active:scale-98"
            >
              <Download className={`w-4 h-4 ${isDownloading ? 'animate-bounce' : ''}`} />
              <span>{isDownloading ? 'Downloading APK...' : 'Download APK Package'}</span>
            </button>

            {downloadSuccess && (
              <div className="mt-2.5 flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>APK download initiated successfully!</span>
              </div>
            )}
          </div>

          {/* Troubleshooting Accordion for "Cannot install app on your device" */}
          <div
            className={`rounded-2xl border overflow-hidden transition-all ${
              isLight ? 'bg-amber-50/60 border-amber-200/80' : 'bg-amber-950/20 border-amber-800/40'
            }`}
          >
            <button
              type="button"
              onClick={() => setShowTroubleshooting(!showTroubleshooting)}
              className="w-full p-3.5 flex items-center justify-between text-left cursor-pointer select-none"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-xs font-bold text-amber-800 dark:text-amber-200">
                  Seeing "You cannot install app on your device"?
                </span>
              </div>
              {showTroubleshooting ? (
                <ChevronUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              )}
            </button>

            {showTroubleshooting && (
              <div className="px-4 pb-4 pt-1 text-xs text-slate-700 dark:text-slate-300 space-y-3 border-t border-amber-200/60 dark:border-amber-900/40">
                <div className="space-y-1">
                  <p className="font-bold text-slate-900 dark:text-white">Why Android displays this message:</p>
                  <ul className="list-disc pl-5 space-y-1.5 text-[11px] leading-relaxed">
                    <li>
                      <strong>"Install Unknown Apps" permission</strong>: Android blocks APKs downloaded from browsers by default. To fix: Open <code>Settings &gt; Apps &gt; Chrome (or My Files) &gt; Install unknown apps &gt; Allow from this source</code>.
                    </li>
                    <li>
                      <strong>Package parsing / Signature check</strong>: Android OS requires a signed binary package built for your device CPU architecture. If a placeholder file was downloaded, Android's package manager will fail verification.
                    </li>
                    <li>
                      <strong>Recommended Solution</strong>: Use the <strong>"1-Tap Direct Mobile Install"</strong> at the top of this modal! It installs the real web application directly to your home screen with zero package parsing errors or signing issues.
                    </li>
                  </ul>
                </div>

                {onOpenAdmin && (
                  <div className="pt-2 border-t border-amber-200/60 dark:border-amber-900/40 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Are you an Admin?</span>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenAdmin();
                      }}
                      className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
                    >
                      <span>Upload Real APK in Admin Panel</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Secure TLS &amp; Realtime Sync</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
