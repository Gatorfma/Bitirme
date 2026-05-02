/**
 * Auth Store
 * Zustand store for authentication state management.
 * Source of truth for user identity is the `profiles` table.
 * Session persistence is handled by Supabase via AsyncStorage.
 */

import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { User } from '../types/models';

// ─── Profile helpers ──────────────────────────────────────────────────────────

type ProfileRow = {
  display_name: string | null;
  avatar_url: string | null;
  is_onboarded: boolean;
};

/**
 * Fetch the profiles row for a given user ID.
 * Returns null if not found (e.g. trigger hasn't run yet).
 */
async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  const { data } = await supabase
    .from('profiles')
    .select('display_name, avatar_url, is_onboarded')
    .eq('id', userId)
    .single();
  return data ?? null;
}

/**
 * Build our User model from a Supabase auth user + its profiles row.
 */
function buildUser(
  supabaseUser: NonNullable<Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user']>,
  profile: ProfileRow | null
): User {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email ?? '',
    // Prefer profiles table; fall back to signup metadata
    displayName:
      profile?.display_name ??
      supabaseUser.user_metadata?.display_name ??
      supabaseUser.email ??
      '',
    avatarUrl: profile?.avatar_url ?? undefined,
    createdAt: supabaseUser.created_at,
    isOnboarded: profile?.is_onboarded ?? false,
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface AuthState {
  // State
  token: string | null;
  user: User | null;
  isOnboarded: boolean;
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  setOnboarded: (value: boolean) => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isOnboarded: false,
  isLoading: false,
  isInitialized: false,

  /**
   * Store the session returned after login/register.
   */
  login: async (token: string, user: User) => {
    set({ token, user, isOnboarded: user.isOnboarded });
  },

  /**
   * Sign out from Supabase and clear local state.
   */
  logout: async () => {
    await supabase.auth.signOut();
    set({ token: null, user: null, isOnboarded: false });
  },

  /**
   * Update user in local state (e.g. after profile edit).
   */
  setUser: (user: User) => {
    set({ user, isOnboarded: user.isOnboarded });
  },

  /**
   * Mark onboarding complete — writes to profiles table (source of truth).
   */
  setOnboarded: async (value: boolean) => {
    const { user } = get();
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update({ is_onboarded: value })
      .eq('id', user.id);

    if (error) {
      console.error('[Auth] Failed to update onboarding status:', error.message);
      return;
    }

    set({ isOnboarded: value, user: { ...user, isOnboarded: value } });
  },

  /**
   * Restore session on app start.
   * 1. Gets Supabase session (rehydrated from AsyncStorage automatically).
   * 2. Fetches the profiles row for full user data.
   * 3. Subscribes to auth state changes for token refreshes / sign-outs.
   */
  initialize: async () => {
    console.log('[Auth] Initializing...');
    set({ isLoading: true });

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        const user = buildUser(session.user, profile);
        console.log('[Auth] Session restored for:', user.email);
        set({
          token: session.access_token,
          user,
          isOnboarded: user.isOnboarded,
          isLoading: false,
          isInitialized: true,
        });
      } else {
        console.log('[Auth] No existing session');
        set({ isLoading: false, isInitialized: true });
      }

      // Stay in sync with Supabase token refreshes and sign-outs
      supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          const profile = await fetchProfile(session.user.id);
          const user = buildUser(session.user, profile);
          set({ token: session.access_token, user, isOnboarded: user.isOnboarded });
        } else {
          set({ token: null, user: null, isOnboarded: false });
        }
      });
    } catch (error) {
      console.error('[Auth] Initialization failed:', error);
      set({ isLoading: false, isInitialized: true });
    }

    console.log('[Auth] Initialization complete');
  },
}));

// ─── Selector hooks ───────────────────────────────────────────────────────────

export const useIsAuthenticated = () => useAuthStore(state => !!state.token);
export const useUser             = () => useAuthStore(state => state.user);
export const useIsOnboarded      = () => useAuthStore(state => state.isOnboarded);
