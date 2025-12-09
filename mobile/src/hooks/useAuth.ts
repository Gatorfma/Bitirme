/**
 * useAuth Hook
 * Wraps common auth logic for screens
 */

import { useCallback } from 'react';
import { useAuthStore } from '../state/authStore';
import { useUIStore } from '../state/uiStore';
import { authApi } from '../api';
import type { LoginRequest, RegisterRequest } from '../types/api';

/**
 * Hook providing auth actions and state
 */
export function useAuth() {
  const { token, user, isOnboarded, isLoading, login: storeLogin, logout: storeLogout, setOnboarded } = useAuthStore();
  const showToast = useUIStore(state => state.showToast);
  
  const isAuthenticated = !!token;

  /**
   * Login with email and password
   */
  const login = useCallback(async (credentials: LoginRequest) => {
    try {
      const response = await authApi.login(credentials);
      
      if (response.success && response.data) {
        await storeLogin(response.data.token, response.data.user);
        showToast('Welcome back!', 'success');
        return { success: true };
      }
      
      showToast(response.error || 'Login failed', 'error');
      return { success: false, error: response.error };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      showToast(message, 'error');
      return { success: false, error: message };
    }
  }, [storeLogin, showToast]);

  /**
   * Register a new account
   */
  const register = useCallback(async (data: RegisterRequest) => {
    try {
      const response = await authApi.register(data);
      
      if (response.success && response.data) {
        await storeLogin(response.data.token, response.data.user);
        showToast('Account created successfully!', 'success');
        return { success: true };
      }
      
      showToast(response.error || 'Registration failed', 'error');
      return { success: false, error: response.error };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      showToast(message, 'error');
      return { success: false, error: message };
    }
  }, [storeLogin, showToast]);

  /**
   * Logout current user
   */
  const logout = useCallback(async () => {
    try {
      await authApi.logout();
      await storeLogout();
      showToast('Logged out successfully', 'info');
    } catch (error) {
      // Still logout locally even if API fails
      await storeLogout();
    }
  }, [storeLogout, showToast]);

  /**
   * Complete onboarding
   */
  const completeOnboarding = useCallback(async () => {
    await setOnboarded(true);
  }, [setOnboarded]);

  return {
    // State
    isAuthenticated,
    isOnboarded,
    isLoading,
    user,
    token,
    
    // Actions
    login,
    register,
    logout,
    completeOnboarding,
  };
}

