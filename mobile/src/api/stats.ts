/**
 * Stats API
 * Statistics and analytics endpoints with mock implementations
 */

import type { ApiResponse, GetStatsResponse } from '../types';
import type { StatsOverview, SentimentDataPoint, EmotionData, DailyCount } from '../types/models';

// Mock delay to simulate network latency
const mockDelay = (ms: number = 800) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generate mock sentiment trend data
 */
function generateMockSentimentTrend(days: number): SentimentDataPoint[] {
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(Date.now() - (days - 1 - i) * 86400000);
    return {
      date: date.toISOString().split('T')[0],
      value: Math.sin(i / 3) * 0.3 + Math.random() * 0.4 - 0.2, // Wave pattern with noise
    };
  });
}

/**
 * Generate mock weekly activity data
 */
function generateMockWeeklyActivity(): DailyCount[] {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return {
      date: date.toISOString().split('T')[0],
      count: Math.floor(Math.random() * 5) + 1,
    };
  });
}

// Mock emotion breakdown data
const mockEmotionBreakdown: EmotionData[] = [
  { emotion: 'Calm', count: 28, percentage: 25 },
  { emotion: 'Anxious', count: 22, percentage: 20 },
  { emotion: 'Happy', count: 20, percentage: 18 },
  { emotion: 'Stressed', count: 18, percentage: 16 },
  { emotion: 'Grateful', count: 12, percentage: 11 },
  { emotion: 'Sad', count: 11, percentage: 10 },
];

/**
 * Get statistics overview
 * Currently returns mock data
 */
export async function getStats(
  range: 'week' | 'month' | 'year' = 'week'
): Promise<ApiResponse<GetStatsResponse>> {
  await mockDelay();
  
  // In production: api.get<GetStatsResponse>(`/stats?range=${range}`)
  
  const days = range === 'week' ? 7 : range === 'month' ? 30 : 365;
  
  const stats: StatsOverview = {
    totalSessions: range === 'week' ? 12 : range === 'month' ? 48 : 520,
    totalThoughts: range === 'week' ? 47 : range === 'month' ? 186 : 2100,
    averageMood: 6.8,
    currentStreak: 7,
    sentimentTrend: generateMockSentimentTrend(Math.min(days, 30)),
    emotionBreakdown: mockEmotionBreakdown,
    weeklyActivity: generateMockWeeklyActivity(),
  };
  
  return {
    success: true,
    data: { stats },
  };
}

/**
 * Get mood history
 * Currently returns mock data
 */
export async function getMoodHistory(
  days: number = 30
): Promise<ApiResponse<{ moods: { date: string; value: number }[] }>> {
  await mockDelay(500);
  
  // In production: api.get<...>(`/stats/mood?days=${days}`)
  
  const moods = Array.from({ length: days }, (_, i) => {
    const date = new Date(Date.now() - (days - 1 - i) * 86400000);
    return {
      date: date.toISOString().split('T')[0],
      value: Math.floor(Math.random() * 4) + 5, // Random mood 5-8
    };
  });
  
  return {
    success: true,
    data: { moods },
  };
}

/**
 * Get improvement score
 * Currently returns mock data
 */
export async function getImprovementScore(): Promise<ApiResponse<{ score: number; change: number }>> {
  await mockDelay(400);
  
  // In production: api.get<...>('/stats/improvement')
  
  return {
    success: true,
    data: {
      score: 72,
      change: 8, // Percentage improvement from last period
    },
  };
}

