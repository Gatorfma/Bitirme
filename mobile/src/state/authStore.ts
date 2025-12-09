/**
 * Auth Store
 * Zustand store for authentication state management
 * Persists auth token using Expo SecureStore
 */

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { User } from '../types/models';

const AUTH_TOKEN_KEY = 'mindjournal_auth_token';
const USER_DATA_KEY = 'mindjournal_user_data';

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

/**
 * Helper to safely get item from SecureStore
 */
async function safeGetItem(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch (error) {
    console.warn(`Failed to get ${key} from SecureStore:`, error);
    return null;
  }
}

/**
 * Helper to safely set item in SecureStore
 */
async function safeSetItem(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch (error) {
    console.warn(`Failed to set ${key} in SecureStore:`, error);
  }
}

/**
 * Helper to safely delete item from SecureStore
 */
async function safeDeleteItem(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (error) {
    console.warn(`Failed to delete ${key} from SecureStore:`, error);
  }
}

/**
 * Auth store with persistence
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  // Initial state
  token: null,
  user: null,
  isOnboarded: false,
  isLoading: false,
  isInitialized: false,

  /**
   * Login user and persist credentials
   */
  login: async (token: string, user: User) => {
    // Store token securely
    await safeSetItem(AUTH_TOKEN_KEY, token);
    // Store user data
    await safeSetItem(USER_DATA_KEY, JSON.stringify(user));
    
    set({
      token,
      user,
      isOnboarded: user.isOnboarded,
    });
  },

  /**
   * Logout user and clear persisted credentials
   */
  logout: async () => {
    await safeDeleteItem(AUTH_TOKEN_KEY);
    await safeDeleteItem(USER_DATA_KEY);
    
    set({
      token: null,
      user: null,
      isOnboarded: false,
    });
  },

  /**
   * Update user data
   */
  setUser: (user: User) => {
    set({ user, isOnboarded: user.isOnboarded });
    // Persist updated user data
    safeSetItem(USER_DATA_KEY, JSON.stringify(user));
  },

  /**
   * Set onboarding status
   */
  setOnboarded: async (value: boolean) => {
    const { user } = get();
    if (user) {
      const updatedUser = { ...user, isOnboarded: value };
      set({ isOnboarded: value, user: updatedUser });
      await safeSetItem(USER_DATA_KEY, JSON.stringify(updatedUser));
    } else {
      set({ isOnboarded: value });
    }
  },

  /**
   * Initialize auth state from storage
   * Call this when app starts
   */
  initialize: async () => {
    console.log('Initializing auth state...');
    set({ isLoading: true });
    
    try {
      const [token, userData] = await Promise.all([
        safeGetItem(AUTH_TOKEN_KEY),
        safeGetItem(USER_DATA_KEY),
      ]);
      
      console.log('Auth data loaded:', { hasToken: !!token, hasUserData: !!userData });
      
      if (token && userData) {
        try {
          const user = JSON.parse(userData) as User;
          set({
            token,
            user,
            isOnboarded: user.isOnboarded,
            isLoading: false,
            isInitialized: true,
          });
        } catch (parseError) {
          console.error('Failed to parse user data:', parseError);
          set({
            isLoading: false,
            isInitialized: true,
          });
        }
      } else {
        set({
          isLoading: false,
          isInitialized: true,
        });
      }
    } catch (error) {
      console.error('Failed to initialize auth state:', error);
      // Always set initialized to true so the app can proceed
      set({
        isLoading: false,
        isInitialized: true,
      });
    }
    
    console.log('Auth initialization complete');
  },
}));

// Selector hooks for common patterns
export const useIsAuthenticated = () => useAuthStore(state => !!state.token);
export const useUser = () => useAuthStore(state => state.user);
export const useIsOnboarded = () => useAuthStore(state => state.isOnboarded);
