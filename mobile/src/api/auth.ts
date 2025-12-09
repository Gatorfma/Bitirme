/**
 * Auth API
 * Authentication endpoints with mock implementations
 */

import type {
  ApiResponse,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
} from '../types';
import type { User } from '../types/models';

// Mock delay to simulate network latency
const mockDelay = (ms: number = 800) => new Promise(resolve => setTimeout(resolve, ms));

// Mock user data
const mockUser: User = {
  id: 'user-1',
  email: 'demo@mindjournal.app',
  displayName: 'Demo User',
  createdAt: new Date().toISOString(),
  isOnboarded: false,
};

/**
 * Login with email and password
 * Currently returns mock data
 */
export async function login(
  request: LoginRequest
): Promise<ApiResponse<LoginResponse>> {
  await mockDelay();
  
  // Mock validation
  if (!request.email || !request.password) {
    return {
      success: false,
      error: 'Email and password are required',
    };
  }
  
  // Mock successful login
  // In production, this would call: api.post<LoginResponse>('/auth/login', request)
  return {
    success: true,
    data: {
      user: { ...mockUser, email: request.email },
      token: 'mock-jwt-token-' + Date.now(),
    },
  };
}

/**
 * Register a new account
 * Currently returns mock data
 */
export async function register(
  request: RegisterRequest
): Promise<ApiResponse<RegisterResponse>> {
  await mockDelay();
  
  // Mock validation
  if (!request.email || !request.password || !request.displayName) {
    return {
      success: false,
      error: 'All fields are required',
    };
  }
  
  if (request.password.length < 6) {
    return {
      success: false,
      error: 'Password must be at least 6 characters',
    };
  }
  
  // Mock successful registration
  // In production, this would call: api.post<RegisterResponse>('/auth/register', request)
  return {
    success: true,
    data: {
      user: {
        ...mockUser,
        id: 'user-' + Date.now(),
        email: request.email,
        displayName: request.displayName,
        isOnboarded: false,
      },
      token: 'mock-jwt-token-' + Date.now(),
    },
  };
}

/**
 * Logout current user
 * In production, this might invalidate the token on the server
 */
export async function logout(): Promise<ApiResponse<void>> {
  await mockDelay(300);
  
  // Mock successful logout
  return {
    success: true,
  };
}

/**
 * Get current user profile
 * Currently returns mock data
 */
export async function getCurrentUser(): Promise<ApiResponse<User>> {
  await mockDelay(500);
  
  // In production, this would call: api.get<User>('/auth/me')
  return {
    success: true,
    data: mockUser,
  };
}

