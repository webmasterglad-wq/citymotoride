import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import { UserProfile } from '../types/ride';

export type AppRole = 'passenger' | 'captain' | 'admin';

export interface AuthUser extends UserProfile {
  email: string;
  avatar_url?: string;
  createdAt?: string;
}

export interface SignUpPayload {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role: AppRole;
}

export interface SignInPayload {
  email: string;
  password: string;
  role?: AppRole;
}

interface AuthContextType {
  // Current active role and users
  activeRole: AppRole;
  setActiveRole: (role: AppRole) => void;
  getUserForRole: (role: AppRole) => AuthUser | null;
  isAuthenticated: (role: AppRole) => boolean;

  // Authentication actions
  signUp: (payload: SignUpPayload) => Promise<{ success: boolean; error?: string; user?: AuthUser; emailConfirmationRequired?: boolean }>;
  signIn: (payload: SignInPayload) => Promise<{ success: boolean; error?: string; user?: AuthUser }>;
  signOut: (role?: AppRole) => Promise<void>;
  quickDemoLogin: (role: AppRole) => Promise<AuthUser>;

  // Loading state
  isLoading: boolean;
  authError: string | null;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Storage keys
const STORAGE_PREFIX = 'motoride_auth_user_';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeRole, setActiveRole] = useState<AppRole>('passenger');
  const [roleUsers, setRoleUsers] = useState<Record<AppRole, AuthUser | null>>({
    passenger: null,
    captain: null,
    admin: null,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Initialize stored users on mount
  useEffect(() => {
    try {
      const storedPassenger = localStorage.getItem(`${STORAGE_PREFIX}passenger`);
      const storedCaptain = localStorage.getItem(`${STORAGE_PREFIX}captain`);
      const storedAdmin = localStorage.getItem(`${STORAGE_PREFIX}admin`);

      setRoleUsers({
        passenger: storedPassenger ? JSON.parse(storedPassenger) : null,
        captain: storedCaptain ? JSON.parse(storedCaptain) : null,
        admin: storedAdmin ? JSON.parse(storedAdmin) : null,
      });
    } catch (e) {
      console.warn('[Motoride Auth] Failed loading cached users:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Listen to Supabase onAuthStateChange
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;

    const { data: authListener } = client.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const metadata = session.user.user_metadata || {};
        const role = (metadata.role as AppRole) || 'passenger';
        const userObj: AuthUser = {
          id: session.user.id,
          name: metadata.full_name || session.user.email?.split('@')[0] || 'User',
          email: session.user.email || '',
          phone: metadata.phone || '',
          role,
          rating: role === 'captain' ? 4.95 : 4.9,
          vehicle_details: metadata.vehicle_details || (role === 'captain' ? 'Yamaha MT-07 · Dark Edition' : undefined),
          avatar_url: metadata.avatar_url,
          createdAt: session.user.created_at,
        };

        setRoleUsers((prev) => {
          const updated = { ...prev, [role]: userObj };
          localStorage.setItem(`${STORAGE_PREFIX}${role}`, JSON.stringify(userObj));
          return updated;
        });
      } else if (event === 'SIGNED_OUT') {
        // If Supabase fired signed out
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  const getUserForRole = useCallback(
    (role: AppRole): AuthUser | null => {
      return roleUsers[role];
    },
    [roleUsers]
  );

  const isAuthenticated = useCallback(
    (role: AppRole): boolean => {
      return Boolean(roleUsers[role]?.id);
    },
    [roleUsers]
  );

  /**
   * Supabase Sign Up:
   * Requires: Full Name, Email ID, Phone Number, Password
   */
  const signUp = async (payload: SignUpPayload): Promise<{
    success: boolean;
    error?: string;
    user?: AuthUser;
    emailConfirmationRequired?: boolean;
  }> => {
    setAuthError(null);
    const { fullName, email, phone, password, role } = payload;

    // Strict validation of all 4 required fields
    if (!fullName || !fullName.trim()) {
      const err = 'Full Name is required';
      setAuthError(err);
      return { success: false, error: err };
    }
    if (!email || !email.trim()) {
      const err = 'Email ID is required';
      setAuthError(err);
      return { success: false, error: err };
    }
    if (!phone || !phone.trim()) {
      const err = 'Phone Number is required';
      setAuthError(err);
      return { success: false, error: err };
    }
    if (!password || password.length < 6) {
      const err = 'Password must be at least 6 characters long';
      setAuthError(err);
      return { success: false, error: err };
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim();
    const cleanPhone = phone.trim();

    try {
      const client = getSupabaseClient();
      let createdUser: AuthUser;

      if (client && isSupabaseConfigured()) {
        const { data, error } = await client.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              full_name: cleanName,
              phone: cleanPhone,
              role,
              vehicle_details: role === 'captain' ? 'Honda CB300R · Black #4819' : undefined,
            },
          },
        });

        if (error) {
          // Handle common Supabase auth errors
          let friendlyError = error.message;
          if (error.message.includes('User already registered')) {
            friendlyError = 'An account with this email already exists. Please sign in instead.';
          } else if (error.message.includes('Password should be')) {
            friendlyError = 'Password is too weak. Please use at least 6 characters.';
          }
          setAuthError(friendlyError);
          return { success: false, error: friendlyError };
        }

        const authId = data.user?.id || (crypto.randomUUID ? crypto.randomUUID() : `usr_${Date.now()}`);
        createdUser = {
          id: authId,
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          role,
          rating: role === 'captain' ? 4.96 : 4.92,
          vehicle_details: role === 'captain' ? 'Honda CB300R · Black #4819' : undefined,
          createdAt: new Date().toISOString(),
        };

        const emailConfirmationRequired = Boolean(data.user && !data.session);

        // Save in state & localStorage
        setRoleUsers((prev) => {
          const updated = { ...prev, [role]: createdUser };
          localStorage.setItem(`${STORAGE_PREFIX}${role}`, JSON.stringify(createdUser));
          return updated;
        });

        return { success: true, user: createdUser, emailConfirmationRequired };
      } else {
        // Local fallback if Supabase not configured
        const authId = crypto.randomUUID ? crypto.randomUUID() : `usr_${Date.now()}`;
        createdUser = {
          id: authId,
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          role,
          rating: role === 'captain' ? 4.95 : 4.9,
          vehicle_details: role === 'captain' ? 'Honda CB300R · Black #4819' : undefined,
          createdAt: new Date().toISOString(),
        };

        setRoleUsers((prev) => {
          const updated = { ...prev, [role]: createdUser };
          localStorage.setItem(`${STORAGE_PREFIX}${role}`, JSON.stringify(createdUser));
          return updated;
        });

        return { success: true, user: createdUser, emailConfirmationRequired: false };
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to sign up';
      setAuthError(msg);
      return { success: false, error: msg };
    }
  };

  /**
   * Supabase Sign In:
   * Requires: Email ID and Password
   */
  const signIn = async (payload: SignInPayload): Promise<{ success: boolean; error?: string; user?: AuthUser }> => {
    setAuthError(null);
    const { email, password, role = activeRole } = payload;

    if (!email || !email.trim()) {
      const err = 'Please enter your email ID';
      setAuthError(err);
      return { success: false, error: err };
    }
    if (!password) {
      const err = 'Please enter your password';
      setAuthError(err);
      return { success: false, error: err };
    }

    const cleanEmail = email.trim().toLowerCase();

    try {
      const client = getSupabaseClient();

      if (client && isSupabaseConfigured()) {
        const { data, error } = await client.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) {
          let friendlyError = error.message;
          if (error.message.includes('Invalid login credentials')) {
            friendlyError = 'Invalid email or password. Please check your credentials or sign up.';
          } else if (error.message.includes('Email not confirmed')) {
            friendlyError = 'Email address not yet confirmed. Please verify your email inbox, or test using Demo Sign In.';
          }
          setAuthError(friendlyError);
          return { success: false, error: friendlyError };
        }

        const user = data.user;
        const metadata = user.user_metadata || {};
        const assignedRole: AppRole = (metadata.role as AppRole) || role;

        const authUser: AuthUser = {
          id: user.id,
          name: metadata.full_name || user.email?.split('@')[0] || (assignedRole === 'captain' ? 'Captain' : 'User'),
          email: user.email || cleanEmail,
          phone: metadata.phone || '+1 (555) 000-0000',
          role: assignedRole,
          rating: assignedRole === 'captain' ? 4.96 : 4.92,
          vehicle_details: metadata.vehicle_details || (assignedRole === 'captain' ? 'Yamaha MT-07 · Black Edition' : undefined),
          avatar_url: metadata.avatar_url,
          createdAt: user.created_at,
        };

        setRoleUsers((prev) => {
          const updated = { ...prev, [assignedRole]: authUser };
          localStorage.setItem(`${STORAGE_PREFIX}${assignedRole}`, JSON.stringify(authUser));
          return updated;
        });

        return { success: true, user: authUser };
      } else {
        // Local fallback when Supabase is not connected
        const cached = localStorage.getItem(`${STORAGE_PREFIX}${role}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.email === cleanEmail) {
            setRoleUsers((prev) => ({ ...prev, [role]: parsed }));
            return { success: true, user: parsed };
          }
        }

        // Demo fallback user
        const fallbackUser: AuthUser = {
          id: crypto.randomUUID ? crypto.randomUUID() : `usr_${Date.now()}`,
          name: cleanEmail.split('@')[0],
          email: cleanEmail,
          phone: '+1 (555) 749-3021',
          role,
          rating: role === 'captain' ? 4.96 : 4.9,
          createdAt: new Date().toISOString(),
        };

        setRoleUsers((prev) => {
          const updated = { ...prev, [role]: fallbackUser };
          localStorage.setItem(`${STORAGE_PREFIX}${role}`, JSON.stringify(fallbackUser));
          return updated;
        });

        return { success: true, user: fallbackUser };
      }
    } catch (err: any) {
      const msg = err?.message || 'Sign in failed';
      setAuthError(msg);
      return { success: false, error: msg };
    }
  };

  /**
   * Sign Out for a role (or active role)
   */
  const signOut = async (role: AppRole = activeRole): Promise<void> => {
    try {
      const client = getSupabaseClient();
      if (client) {
        await client.auth.signOut().catch(() => {});
      }
    } catch (e) {
      console.warn('[Motoride Auth] Supabase signOut note:', e);
    }

    setRoleUsers((prev) => {
      const updated = { ...prev, [role]: null };
      localStorage.removeItem(`${STORAGE_PREFIX}${role}`);
      return updated;
    });
    setAuthError(null);
  };

  /**
   * Quick 1-click Demo Login for fast testing/evaluation
   */
  const quickDemoLogin = async (role: AppRole): Promise<AuthUser> => {
    const demoConfigs: Record<AppRole, { name: string; email: string; phone: string; vehicle?: string }> = {
      passenger: {
        name: 'Sarah Jenkins',
        email: 'passenger.sarah@motoride.demo',
        phone: '+1 (555) 392-1049',
      },
      captain: {
        name: 'Captain Alex Rivera',
        email: 'captain.alex@motoride.demo',
        phone: '+1 (555) 749-3021',
        vehicle: 'Yamaha MT-07 · Stealth Black #7492',
      },
      admin: {
        name: 'Operations Dispatcher',
        email: 'admin.ops@motoride.demo',
        phone: '+1 (555) 992-8000',
      },
    };

    const config = demoConfigs[role];
    const demoUser: AuthUser = {
      id: role === 'passenger'
        ? 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
        : role === 'captain'
        ? 'b82ac71b-39dd-4172-b567-0e02b2c3d981'
        : 'a11bd90c-28cc-4172-b567-0e02b2c3d999',
      name: config.name,
      email: config.email,
      phone: config.phone,
      role,
      rating: role === 'captain' ? 4.96 : 4.94,
      vehicle_details: config.vehicle,
      createdAt: new Date().toISOString(),
    };

    setRoleUsers((prev) => {
      const updated = { ...prev, [role]: demoUser };
      localStorage.setItem(`${STORAGE_PREFIX}${role}`, JSON.stringify(demoUser));
      return updated;
    });

    return demoUser;
  };

  return (
    <AuthContext.Provider
      value={{
        activeRole,
        setActiveRole,
        getUserForRole,
        isAuthenticated,
        signUp,
        signIn,
        signOut,
        quickDemoLogin,
        isLoading,
        authError,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
