/**
 * MindJournal Domain Models
 * Core data structures used throughout the application
 */

// User & Authentication
export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  createdAt: string;
  isOnboarded: boolean;
}

export interface UserPreferences {
  age?: number;
  goals?: string[];
  notificationsEnabled: boolean;
  theme: 'light' | 'dark' | 'system';
}

// Journal & Thoughts
export interface JournalSession {
  id: string;
  userId: string;
  startedAt: string;
  endedAt?: string;
  thoughts: Thought[];
  mood?: number;
  summary?: string;
}

export interface Thought {
  id: string;
  sessionId: string;
  content: string;
  timestamp: string;
  categoryId?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  emotionalIntensity?: number;
}

export interface GuidingQuestion {
  id: string;
  content: string;
  triggeredBy?: string; // thought id or keyword
}

// Categories & Mind Map
export interface ThoughtCategory {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  thoughtCount: number;
  averageSentiment?: number;
}

export interface CategoryStats {
  categoryId: string;
  thoughtCount: number;
  sentimentTrend: SentimentDataPoint[];
  topKeywords: string[];
  frequencyByDay: DailyCount[];
}

export interface MindMapNode {
  id: string;
  label: string;
  type: 'category' | 'thought' | 'trigger';
  x: number;
  y: number;
  size: number;
  color: string;
  connections: string[];
}

// Statistics
export interface SentimentDataPoint {
  date: string;
  value: number;
}

export interface DailyCount {
  date: string;
  count: number;
}

export interface EmotionData {
  emotion: string;
  count: number;
  percentage: number;
}

export interface StatsOverview {
  totalSessions: number;
  totalThoughts: number;
  averageMood: number;
  currentStreak: number;
  sentimentTrend: SentimentDataPoint[];
  emotionBreakdown: EmotionData[];
  weeklyActivity: DailyCount[];
}

// Behaviors & Interventions
export interface Behavior {
  id: string;
  name: string;
  description: string;
  category: 'mindfulness' | 'activity' | 'social' | 'cognitive' | 'physical';
  successRate: number;
  timesUsed: number;
  lastUsed?: string;
}

export interface BehaviorFeedback {
  behaviorId: string;
  helpful: boolean;
  moodBefore: number;
  moodAfter: number;
  notes?: string;
  timestamp: string;
}

// Chat Messages for Journal
export interface ChatMessage {
  id: string;
  type: 'user' | 'system' | 'question';
  content: string;
  timestamp: string;
}

