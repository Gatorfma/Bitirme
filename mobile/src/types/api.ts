/**
 * API Response Types
 * Defines the shape of API responses and requests
 */

import type {
  User,
  UserPreferences,
  JournalSession,
  Thought,
  ThoughtCategory,
  CategoryStats,
  StatsOverview,
  Behavior,
  BehaviorFeedback,
} from './models';

// Generic API Response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Paginated response for lists
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// Auth API Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
}

export interface RegisterResponse {
  user: User;
  token: string;
}

// Journal API Types
export interface CreateSessionRequest {
  thoughts: Omit<Thought, 'id' | 'sessionId'>[];
  mood?: number;
}

export interface CreateSessionResponse {
  session: JournalSession;
}

export interface AppendThoughtRequest {
  content: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
}

export interface AppendThoughtResponse {
  thought: Thought;
  guidingQuestion?: string;
}

// Categories API Types
export interface GetCategoriesResponse {
  categories: ThoughtCategory[];
}

export interface GetCategoryStatsRequest {
  categoryId: string;
  range: 'week' | 'month' | 'year';
}

export interface GetCategoryStatsResponse {
  stats: CategoryStats;
}

// Stats API Types
export interface GetStatsRequest {
  range: 'week' | 'month' | 'year';
}

export interface GetStatsResponse {
  stats: StatsOverview;
}

// Behaviors API Types
export interface GetBehaviorsResponse {
  behaviors: Behavior[];
}

export interface SendBehaviorFeedbackRequest {
  behaviorId: string;
  feedback: Omit<BehaviorFeedback, 'behaviorId' | 'timestamp'>;
}

export interface SendBehaviorFeedbackResponse {
  success: boolean;
  updatedBehavior: Behavior;
}

// Onboarding API Types
export interface OnboardingRequest {
  preferences: UserPreferences;
}

export interface OnboardingResponse {
  user: User;
}

