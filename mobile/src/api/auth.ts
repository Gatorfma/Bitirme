/**
 * Auth API
 * Real authentication using Supabase Auth
 */

import { supabase } from '../lib/supabase';
import type {
  ApiResponse,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
} from '../types';
import type { User } from '../types/models';

/**
 * Build a minimal User from the Supabase auth user.
 * Full profile data (display_name, is_onboarded) is loaded separately
 * from the profiles table inside authStore.
 */
function mapSupabaseUser(
  supabaseUser: NonNullable<Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user']>
): User {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email ?? '',
    displayName: supabaseUser.user_metadata?.display_name ?? supabaseUser.email ?? '',
    createdAt: supabaseUser.created_at,
    isOnboarded: false, // authStore will overwrite this from the profiles table
  };
}

/**
 * Login with email and password
 */
export async function login(
  request: LoginRequest
): Promise<ApiResponse<LoginResponse>> {
  if (!request.email || !request.password) {
    return { success: false, error: 'Email and password are required' };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: request.email.trim(),
    password: request.password,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  if (!data.user || !data.session) {
    return { success: false, error: 'Login failed — no session returned' };
  }

  return {
    success: true,
    data: {
      user: mapSupabaseUser(data.user),
      token: data.session.access_token,
    },
  };
}

/**
 * Register a new account
 */
export async function register(
  request: RegisterRequest
): Promise<ApiResponse<RegisterResponse>> {
  if (!request.email || !request.password || !request.displayName) {
    return { success: false, error: 'All fields are required' };
  }

  if (request.password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters' };
  }

  const { data, error } = await supabase.auth.signUp({
    email: request.email.trim(),
    password: request.password,
    options: {
      data: {
        display_name: request.displayName.trim(),
        is_onboarded: false,
      },
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  if (!data.user) {
    return { success: false, error: 'Registration failed' };
  }

  // If email confirmation is disabled (recommended for dev), session is available immediately.
  // If email confirmation is enabled, session will be null until confirmed.
  if (!data.session) {
    return {
      success: false,
      error: 'Please check your email to confirm your account before signing in.',
    };
  }

  return {
    success: true,
    data: {
      user: mapSupabaseUser(data.user),
      token: data.session.access_token,
    },
  };
}

/**
 * Logout current user
 */
export async function logout(): Promise<ApiResponse<void>> {
  const { error } = await supabase.auth.signOut();
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Get current user profile from Supabase
 */
export async function getCurrentUser(): Promise<ApiResponse<User>> {
  const { data, error } = await supabase.auth.getUser();
  if (error) return { success: false, error: error.message };
  if (!data.user) return { success: false, error: 'No authenticated user' };
  return { success: true, data: mapSupabaseUser(data.user) };
}
