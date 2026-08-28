import React, { useState, useRef } from 'react';
import { Camera, Upload, Trash2, Sparkles, Check, Image as ImageIcon, RefreshCw } from 'lucide-react';

interface AvatarUploaderProps {
  currentAvatarUrl?: string;
  userName: string;
  role: 'passenger' | 'captain';
  onAvatarChange: (url: string | undefined) => void;
  accentColor?: 'emerald' | 'amber';
}

// Curated avatar presets suitable for riders and captains
const PASSENGER_PRESETS = [
  {
    label: 'Urban Rider',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=250&auto=format&fit=crop&q=80',
  },
  {
    label: 'Commuter',
    url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=250&auto=format&fit=crop&q=80',
  },
  {
    label: 'Street Style',
    url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=250&auto=format&fit=crop&q=80',
  },
  {
    label: 'Tech Traveler',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=250&auto=format&fit=crop&q=80',
  },
];

const CAPTAIN_PRESETS = [
  {
    label: 'Helmet Pro',
    url: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=250&auto=format&fit=crop&q=80',
  },
  {
    label: 'Moto Rider',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=250&auto=format&fit=crop&q=80',
  },
  {
    label: 'Captain Alex',
    url: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=250&auto=format&fit=crop&q=80',
  },
  {
    label: 'Night Cruiser',
    url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=250&auto=format&fit=crop&q=80',
  },
];

export const AvatarUploader: React.FC<AvatarUploaderProps> = ({
  currentAvatarUrl,
  userName,
  role,
  onAvatarChange,
  accentColor = 'emerald',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [showPresets, setShowPresets] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const presets = role === 'captain' ? CAPTAIN_PRESETS : PASSENGER_PRESETS;
  const isAmber = accentColor === 'amber';

  const handleFile = (file: File) => {
    setUploadError(null);

    // Validate image format
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a valid image file (JPG, PNG, WebP, GIF).');
      return;
    }

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image size should be under 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        onAvatarChange(event.target.result);
        setUploadSuccess('Profile picture updated successfully!');
        setTimeout(() => setUploadSuccess(null), 3000);
      }
    };
    reader.onerror = () => {
      setUploadError('Failed to read image file. Please try another image.');
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFile(file);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      handleFile(file);
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3.5">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleInputChange}
        className="hidden"
        id={`${role}-avatar-file-input`}
      />

      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
          <Camera className={`w-3.5 h-3.5 ${isAmber ? 'text-amber-400' : 'text-emerald-400'}`} />
          Profile Picture
        </h4>
        {currentAvatarUrl && (
          <button
            type="button"
            onClick={() => onAvatarChange(undefined)}
            className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            Remove Picture
          </button>
        )}
      </div>

      {/* Drop Zone & Avatar Preview */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-4 transition-all flex flex-col sm:flex-row items-center gap-4 cursor-pointer text-center sm:text-left ${
          isDragging
            ? isAmber
              ? 'border-amber-400 bg-amber-500/10'
              : 'border-emerald-400 bg-emerald-500/10'
            : 'border-slate-700/80 hover:border-slate-600 bg-slate-950/60'
        }`}
      >
        {/* Avatar Display */}
        <div className="relative shrink-0 group">
          {currentAvatarUrl ? (
            <img
              src={currentAvatarUrl}
              alt={userName}
              referrerPolicy="no-referrer"
              className="w-18 h-18 rounded-2xl object-cover border-2 border-slate-700 shadow-lg group-hover:opacity-90 transition-opacity"
            />
          ) : (
            <div
              className={`w-18 h-18 rounded-2xl flex items-center justify-center font-black text-2xl shadow-lg border-2 border-slate-700 ${
                isAmber
                  ? 'bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950'
                  : 'bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950'
              }`}
            >
              {role === 'captain' ? '🏍️' : userName.charAt(0)}
            </div>
          )}

          <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
            <Camera className="w-5 h-5" />
          </div>

          <div
            className={`absolute -bottom-1 -right-1 p-1 rounded-lg text-slate-950 shadow-md ${
              isAmber ? 'bg-amber-400' : 'bg-emerald-400'
            }`}
          >
            <Upload className="w-3 h-3" />
          </div>
        </div>

        {/* Upload Instruction */}
        <div className="flex-1 space-y-1">
          <p className="text-xs font-bold text-slate-100">
            {isDragging ? 'Drop photo here to upload' : 'Click or Drag & Drop photo here'}
          </p>
          <p className="text-[11px] text-slate-400">
            Supports JPG, PNG, WebP up to 5MB. Visible on live trips & ride matching.
          </p>
          <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                isAmber
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              }`}
            >
              Browse Files
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowPresets(!showPresets);
              }}
              className="text-[10px] text-slate-300 hover:text-white underline underline-offset-2 flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-2.5 h-2.5 text-amber-300" />
              {showPresets ? 'Hide sample avatars' : 'Or choose sample avatar'}
            </button>
          </div>
        </div>
      </div>

      {/* Success / Error Messages */}
      {uploadSuccess && (
        <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
          <Check className="w-3.5 h-3.5 shrink-0" />
          <span>{uploadSuccess}</span>
        </div>
      )}

      {uploadError && (
        <div className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
          <span>{uploadError}</span>
        </div>
      )}

      {/* Sample Avatar Presets */}
      {showPresets && (
        <div className="pt-2 border-t border-slate-800/80 space-y-2 animate-in fade-in">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Choose a sample profile portrait:</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {presets.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  onAvatarChange(preset.url);
                  setUploadSuccess(`Applied ${preset.label} avatar!`);
                  setTimeout(() => setUploadSuccess(null), 2500);
                }}
                className={`p-1.5 rounded-xl bg-slate-950 border transition-all text-center group cursor-pointer ${
                  currentAvatarUrl === preset.url
                    ? isAmber
                      ? 'border-amber-400 ring-2 ring-amber-400/30'
                      : 'border-emerald-400 ring-2 ring-emerald-400/30'
                    : 'border-slate-800 hover:border-slate-600'
                }`}
              >
                <img
                  src={preset.url}
                  alt={preset.label}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-lg object-cover mx-auto group-hover:scale-105 transition-transform"
                />
                <span className="text-[10px] text-slate-300 block truncate mt-1">
                  {preset.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
