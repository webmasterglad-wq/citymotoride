import React, { useState } from 'react';
import {
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  Shield,
  Bike,
  Sparkles,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  KeyRound,
} from 'lucide-react';
import { useAuth, AppRole, AuthUser } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

interface AuthScreenProps {
  role: AppRole;
  onSuccess?: (user: AuthUser) => void;
  onOpenSqlModal?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ role, onSuccess, onOpenSqlModal }) => {
  const { signUp, signIn, isLoading: authContextLoading, authError, clearAuthError } = useAuth();
  const { isLight } = useTheme();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const roleMeta: Record<
    AppRole,
    { title: string; badge: string; subtitle: string; icon: any; color: string; bgBadge: string; accentColor: string }
  > = {
    passenger: {
      title: 'Passenger Portal',
      badge: '🛵 Passenger Access',
      subtitle: 'Sign in to book rides, track captains in real-time, and manage trips',
      icon: User,
      color: 'text-sky-500',
      bgBadge: isLight ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-sky-950/60 text-sky-400 border-sky-800',
      accentColor: 'from-sky-500 to-blue-600',
    },
    captain: {
      title: 'Captain Partner Portal',
      badge: '⚡ Captain Driver Access',
      subtitle: 'Sign in to receive dispatch orders, verify passenger PINs, and track earnings',
      icon: Bike,
      color: 'text-emerald-500',
      bgBadge: isLight ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-emerald-950/60 text-emerald-400 border-emerald-800',
      accentColor: 'from-emerald-500 to-teal-600',
    },
    admin: {
      title: 'Admin Fleet Command',
      badge: '🛡️ Admin Dispatch Access',
      subtitle: 'Sign in to monitor fleet activity, control surge rates, and manage system database',
      icon: Shield,
      color: 'text-amber-500',
      bgBadge: isLight ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-amber-950/60 text-amber-400 border-amber-800',
      accentColor: 'from-amber-500 to-orange-600',
    },
  };

  const meta = roleMeta[role];
  const RoleIcon = meta.icon;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setInfoMessage(null);
    clearAuthError();

    if (mode === 'signup') {
      // Validate all 4 required fields
      if (!fullName.trim()) {
        setLocalError('Full Name is required.');
        return;
      }
      if (!email.trim()) {
        setLocalError('Email ID is required.');
        return;
      }
      if (!phone.trim()) {
        setLocalError('Phone Number is required.');
        return;
      }
      if (!password) {
        setLocalError('Password is required (at least 6 characters).');
        return;
      }
      if (password.length < 6) {
        setLocalError('Password must be at least 6 characters long.');
        return;
      }

      setIsSubmitting(true);
      try {
        const result = await signUp({
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password,
          role,
        });

        if (!result.success) {
          setLocalError(result.error || 'Failed to create account.');
        } else {
          if (result.emailConfirmationRequired) {
            setInfoMessage(
              'Account created in Supabase! You can now sign in with your credentials, or continue directly.'
            );
          } else {
            setInfoMessage('Account created successfully with Supabase!');
          }
          if (result.user && onSuccess) {
            onSuccess(result.user);
          }
        }
      } catch (err: any) {
        setLocalError(err?.message || 'Error creating account');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Sign In
      if (!email.trim()) {
        setLocalError('Please enter your Email ID.');
        return;
      }
      if (!password) {
        setLocalError('Please enter your Password.');
        return;
      }

      setIsSubmitting(true);
      try {
        const result = await signIn({
          email: email.trim(),
          password,
          role,
        });

        if (!result.success) {
          setLocalError(result.error || 'Failed to sign in.');
        } else if (result.user && onSuccess) {
          onSuccess(result.user);
        }
      } catch (err: any) {
        setLocalError(err?.message || 'Error signing in');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const displayError = localError || authError;

  return (
    <div className="w-full max-w-md mx-auto py-8 px-4">
      {/* Brand Header */}
      <div className="text-center mb-6">
        <h1 className={`text-2xl font-black tracking-tight ${isLight ? 'text-slate-900' : 'text-slate-50'}`}>
          Moto<span className="text-amber-500">Ride</span>
        </h1>
        <div className="mt-1 flex items-center justify-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${meta.bgBadge}`}>
            <RoleIcon className="w-3.5 h-3.5" />
            {meta.badge}
          </span>
        </div>
        <p className={`text-xs mt-2 max-w-sm mx-auto ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
          {meta.subtitle}
        </p>
      </div>

      {/* Auth Card */}
      <div
        className={`rounded-2xl border shadow-xl p-6 transition-all ${
          isLight ? 'bg-white border-slate-200 shadow-slate-200/60' : 'bg-slate-900 border-slate-800 shadow-black/40'
        }`}
      >
        {/* Toggle between Sign In and Sign Up */}
        <div
          className={`grid grid-cols-2 p-1 rounded-xl mb-6 border text-xs font-bold ${
            isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-slate-800'
          }`}
        >
          <button
            type="button"
            id="auth-tab-signin"
            onClick={() => {
              setMode('signin');
              setLocalError(null);
              clearAuthError();
            }}
            className={`py-2 rounded-lg transition-all cursor-pointer ${
              mode === 'signin'
                ? isLight
                  ? 'bg-white text-slate-900 shadow-xs font-extrabold'
                  : 'bg-slate-800 text-white shadow-xs font-extrabold'
                : isLight
                ? 'text-slate-600 hover:text-slate-900'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            id="auth-tab-signup"
            onClick={() => {
              setMode('signup');
              setLocalError(null);
              clearAuthError();
            }}
            className={`py-2 rounded-lg transition-all cursor-pointer ${
              mode === 'signup'
                ? isLight
                  ? 'bg-white text-slate-900 shadow-xs font-extrabold'
                  : 'bg-slate-800 text-white shadow-xs font-extrabold'
                : isLight
                ? 'text-slate-600 hover:text-slate-900'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Error Alert */}
        {displayError && (
          <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-600 dark:text-rose-400 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">
              <span className="font-bold">Authentication Notice: </span>
              {displayError}
            </div>
          </div>
        )}

        {/* Success / Info Alert */}
        {infoMessage && (
          <div className="mb-5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5 text-xs text-emerald-600 dark:text-emerald-400 animate-in fade-in duration-150">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{infoMessage}</div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Sign Up Fields */}
          {mode === 'signup' && (
            <>
              {/* Field 1: Full Name */}
              <div>
                <label
                  htmlFor="signup-fullname"
                  className={`block text-xs font-bold mb-1.5 flex items-center justify-between ${
                    isLight ? 'text-slate-800' : 'text-slate-200'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-amber-500" />
                    Full Name
                  </span>
                  <span className="text-[10px] font-semibold text-rose-500">* Required</span>
                </label>
                <div className="relative">
                  <input
                    id="signup-fullname"
                    type="text"
                    required
                    placeholder={
                      role === 'captain'
                        ? 'e.g. Captain Name'
                        : role === 'admin'
                        ? 'e.g. Admin Dispatcher'
                        : 'e.g. Passenger Name'
                    }
                    value={fullName || ''}
                    onChange={(e) => setFullName(e.target.value)}
                    className={`w-full rounded-xl px-3.5 py-2.5 text-xs border focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:border-amber-500'
                        : 'bg-slate-950 border-slate-700 text-slate-100 focus:border-amber-500'
                    }`}
                  />
                </div>
              </div>

              {/* Field 2: Email ID */}
              <div>
                <label
                  htmlFor="signup-email"
                  className={`block text-xs font-bold mb-1.5 flex items-center justify-between ${
                    isLight ? 'text-slate-800' : 'text-slate-200'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-amber-500" />
                    Email ID
                  </span>
                  <span className="text-[10px] font-semibold text-rose-500">* Required</span>
                </label>
                <div className="relative">
                  <input
                    id="signup-email"
                    type="email"
                    required
                    placeholder="e.g. user@example.com"
                    value={email || ''}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full rounded-xl px-3.5 py-2.5 text-xs border focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:border-amber-500'
                        : 'bg-slate-950 border-slate-700 text-slate-100 focus:border-amber-500'
                    }`}
                  />
                </div>
              </div>

              {/* Field 3: Phone Number */}
              <div>
                <label
                  htmlFor="signup-phone"
                  className={`block text-xs font-bold mb-1.5 flex items-center justify-between ${
                    isLight ? 'text-slate-800' : 'text-slate-200'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-amber-500" />
                    Phone Number
                  </span>
                  <span className="text-[10px] font-semibold text-rose-500">* Required</span>
                </label>
                <div className="relative">
                  <input
                    id="signup-phone"
                    type="tel"
                    required
                    placeholder="e.g. +91 98765 43210"
                    value={phone || ''}
                    onChange={(e) => setPhone(e.target.value)}
                    className={`w-full rounded-xl px-3.5 py-2.5 text-xs border focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:border-amber-500'
                        : 'bg-slate-950 border-slate-700 text-slate-100 focus:border-amber-500'
                    }`}
                  />
                </div>
              </div>

              {/* Field 4: Password */}
              <div>
                <label
                  htmlFor="signup-password"
                  className={`block text-xs font-bold mb-1.5 flex items-center justify-between ${
                    isLight ? 'text-slate-800' : 'text-slate-200'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-500" />
                    Password
                  </span>
                  <span className="text-[10px] font-semibold text-rose-500">* Required (min 6)</span>
                </label>
                <div className="relative">
                  <input
                    id="signup-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Create a secure password"
                    value={password || ''}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full rounded-xl pl-3.5 pr-10 py-2.5 text-xs border focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:border-amber-500'
                        : 'bg-slate-950 border-slate-700 text-slate-100 focus:border-amber-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Sign In Fields */}
          {mode === 'signin' && (
            <>
              {/* Field: Email ID */}
              <div>
                <label
                  htmlFor="signin-email"
                  className={`block text-xs font-bold mb-1.5 flex items-center justify-between ${
                    isLight ? 'text-slate-800' : 'text-slate-200'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-amber-500" />
                    Email ID
                  </span>
                  <span className="text-[10px] font-semibold text-rose-500">* Required</span>
                </label>
                <div className="relative">
                  <input
                    id="signin-email"
                    type="email"
                    required
                    placeholder={
                      role === 'captain'
                        ? 'captain@example.com'
                        : role === 'admin'
                        ? 'admin@example.com'
                        : 'passenger@example.com'
                    }
                    value={email || ''}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full rounded-xl px-3.5 py-2.5 text-xs border focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:border-amber-500'
                        : 'bg-slate-950 border-slate-700 text-slate-100 focus:border-amber-500'
                    }`}
                  />
                </div>
              </div>

              {/* Field: Password */}
              <div>
                <label
                  htmlFor="signin-password"
                  className={`block text-xs font-bold mb-1.5 flex items-center justify-between ${
                    isLight ? 'text-slate-800' : 'text-slate-200'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-500" />
                    Password
                  </span>
                  <span className="text-[10px] font-semibold text-rose-500">* Required</span>
                </label>
                <div className="relative">
                  <input
                    id="signin-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter your password"
                    value={password || ''}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full rounded-xl pl-3.5 pr-10 py-2.5 text-xs border focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:border-amber-500'
                        : 'bg-slate-950 border-slate-700 text-slate-100 focus:border-amber-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            id={mode === 'signup' ? 'btn-submit-signup' : 'btn-submit-signin'}
            disabled={isSubmitting}
            className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
              role === 'captain'
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                : role === 'admin'
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                : 'bg-sky-500 hover:bg-sky-400 text-white shadow-sky-500/20'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>Processing Supabase Auth...</span>
              </>
            ) : mode === 'signup' ? (
              <>
                <KeyRound className="w-4 h-4" />
                <span>Sign Up as {role.charAt(0).toUpperCase() + role.slice(1)}</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </>
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                <span>Sign In to {role.charAt(0).toUpperCase() + role.slice(1)}</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </>
            )}
          </button>
        </form>

        {/* Bottom Switch Mode link */}
        <div className="mt-5 text-center text-xs">
          {mode === 'signup' ? (
            <p className={isLight ? 'text-slate-600' : 'text-slate-400'}>
              Already registered with Supabase?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setLocalError(null);
                  clearAuthError();
                }}
                className="font-bold text-amber-500 hover:text-amber-600 underline cursor-pointer"
              >
                Sign In here
              </button>
            </p>
          ) : (
            <p className={isLight ? 'text-slate-600' : 'text-slate-400'}>
              Don't have an account yet?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setLocalError(null);
                  clearAuthError();
                }}
                className="font-bold text-amber-500 hover:text-amber-600 underline cursor-pointer"
              >
                Sign Up with 4 required fields
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
