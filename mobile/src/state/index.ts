/**
 * State Index
 * Re-export all stores for convenient imports
 */

export {
  useAuthStore,
  useIsAuthenticated,
  useUser,
  useIsOnboarded,
} from './authStore';

export {
  useUIStore,
  useTheme,
  useGlobalLoading,
  useToast,
} from './uiStore';

