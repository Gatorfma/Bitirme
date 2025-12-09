/**
 * UI Store
 * Zustand store for UI state management
 * Handles loading states, modals, theme, etc.
 */

import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';

interface UIState {
  // State
  theme: Theme;
  isGlobalLoading: boolean;
  globalLoadingMessage: string | null;
  
  // Toast/snackbar
  toast: {
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  };
  
  // Actions
  setTheme: (theme: Theme) => void;
  setGlobalLoading: (isLoading: boolean, message?: string) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  hideToast: () => void;
}

/**
 * UI store for app-wide UI state
 */
export const useUIStore = create<UIState>((set) => ({
  // Initial state
  theme: 'system',
  isGlobalLoading: false,
  globalLoadingMessage: null,
  toast: {
    visible: false,
    message: '',
    type: 'info',
  },

  /**
   * Set app theme
   */
  setTheme: (theme: Theme) => {
    set({ theme });
  },

  /**
   * Set global loading state with optional message
   */
  setGlobalLoading: (isLoading: boolean, message?: string) => {
    set({
      isGlobalLoading: isLoading,
      globalLoadingMessage: message || null,
    });
  },

  /**
   * Show a toast notification
   */
  showToast: (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    set({
      toast: {
        visible: true,
        message,
        type,
      },
    });
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      set(state => ({
        toast: {
          ...state.toast,
          visible: false,
        },
      }));
    }, 3000);
  },

  /**
   * Hide current toast
   */
  hideToast: () => {
    set(state => ({
      toast: {
        ...state.toast,
        visible: false,
      },
    }));
  },
}));

// Selector hooks
export const useTheme = () => useUIStore(state => state.theme);
export const useGlobalLoading = () => useUIStore(state => ({
  isLoading: state.isGlobalLoading,
  message: state.globalLoadingMessage,
}));
export const useToast = () => useUIStore(state => state.toast);

