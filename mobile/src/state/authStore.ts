/**
 * Auth Store
 * Zustand store for authentication state management.
 */

import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { User } from '../types/models';

type ProfileRow = {
  display_name: string | null;
  avatar_url: string | null;
  is_onboarded: boolean;
};

async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  const { data } = await supabase
    .from('profiles')
    .select('display_name, avatar_url, is_onboarded')
    .eq('id', userId)
    .single();
  return data ?? null;
}

function buildUser(
  supabaseUser: any,
  profile: ProfileRow | null
): User {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email ?? '',
    displayName:
      profile?.display_name ??
      supabaseUser.user_metadata?.display_name ??
      supabaseUser.email?.split('@')[0] ??
      'User',
    avatarUrl: profile?.avatar_url ?? undefined,
    createdAt: supabaseUser.created_at,
    isOnboarded: profile?.is_onboarded ?? false,
  };
}

interface AuthState {
  token: string | null;
  user: User | null;
  isOnboarded: boolean;
  isLoading: boolean;
  isInitialized: boolean;

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

  login: async (token: string, user: User) => {
    set({ token, user, isOnboarded: user.isOnboarded });
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ token: null, user: null, isOnboarded: false });
  },

  setUser: (user: User) => {
    set({ user, isOnboarded: user.isOnboarded });
  },

  setOnboarded: async (value: boolean) => {
    const { user } = get();
    if (!user) return;

    // 1. Update remote database (Source of Truth)
    const { error } = await supabase
      .from('profiles')
      .update({ is_onboarded: value })
      .eq('id', user.id);

    if (error) {
      console.error('[Auth] Failed to update onboarding status:', error.message);
      // We still update local state so the user isn't stuck, 
      // but remote sync failed.
    }

    // 2. Update local state to trigger navigation change in RootNavigator
    set({ 
      isOnboarded: value, 
      user: { ...user, isOnboarded: value } 
    });
  },

  initialize: async () => {
    console.log('[Auth] Initializing...');
    set({ isLoading: true });

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        const user = buildUser(session.user, profile);
        set({
          token: session.access_token,
          user,
          isOnboarded: user.isOnboarded,
          isLoading: false,
          isInitialized: true,
        });
      } else {
        set({ isLoading: false, isInitialized: true });
      }

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
  },
}));
