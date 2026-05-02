/**
 * Stats API
 * Statistics and analytics endpoints using Supabase data
 */

import { supabase } from '../lib/supabase';
import type { ApiResponse, GetStatsResponse } from '../types';
import type { StatsOverview, DailyCount } from '../types/models';

/**
 * Helper to check if two dates are the same day in local time
 */
function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

/**
 * Get a local date string (YYYY-MM-DD)
 */
function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get statistics overview from Supabase for the current user
 */
export async function getStats(
  range: 'week' | 'month' | 'year' = 'week'
): Promise<ApiResponse<GetStatsResponse>> {
  try {
    // Get current authenticated user
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      throw new Error('User not authenticated');
    }

    // Fetch journal sessions for this specific user
    const { data: sessions, error } = await supabase
      .from('journal_sessions')
      .select('started_at, messages')
      .eq('user_id', authUser.id) // Filter by user_id
      .order('started_at', { ascending: false });

    if (error) throw error;

    // Filter sessions that have at least one user message
    const validSessions = (sessions || []).filter(s => 
      Array.isArray(s.messages) && s.messages.some((m: any) => m.role === 'user')
    );

    // 1. Calculate Current Streak
    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const uniqueTimestamps = Array.from(new Set(validSessions.map(s => {
      const d = new Date(s.started_at);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }))).sort((a, b) => b - a);

    if (uniqueTimestamps.length > 0) {
      const latestSessionDate = new Date(uniqueTimestamps[0]);
      const diffDays = Math.floor((today.getTime() - latestSessionDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays <= 1) {
        currentStreak = 1;
        let lastDate = latestSessionDate;

        for (let i = 1; i < uniqueTimestamps.length; i++) {
          const currentDate = new Date(uniqueTimestamps[i]);
          const expectedDate = new Date(lastDate);
          expectedDate.setDate(expectedDate.getDate() - 1);

          if (isSameDay(currentDate, expectedDate)) {
            currentStreak++;
            lastDate = currentDate;
          } else {
            break;
          }
        }
      }
    }

    // 2. Weekly Activity
    const weeklyActivity: DailyCount[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      
      const count = validSessions.filter(s => {
        const sd = new Date(s.started_at);
        return isSameDay(sd, dayStart);
      }).length;

      weeklyActivity.push({
        date: toLocalDateString(dayStart),
        count
      });
    }

    // 3. Active Dates
    const activeDates = Array.from(new Set(validSessions.map(s => toLocalDateString(new Date(s.started_at)))));

    // 4. Totals
    const totalSessions = validSessions.length;
    const totalThoughts = validSessions.reduce((acc, s) => {
      const userMsgs = (s.messages as any[] || []).filter(m => m.role === 'user').length;
      return acc + userMsgs;
    }, 0);

    const stats: StatsOverview = {
      totalSessions,
      totalThoughts,
      averageMood: 7.0,
      currentStreak,
      sentimentTrend: [],
      emotionBreakdown: [],
      weeklyActivity,
      activeDates
    };

    return {
      success: true,
      data: { stats },
    };
  } catch (error) {
    console.error('[StatsAPI] Error getting stats:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch statistics',
    };
  }
}

/**
 * Get mood history for current user
 */
export async function getMoodHistory(
  days: number = 30
): Promise<ApiResponse<{ moods: { date: string; value: number }[] }>> {
  // In a full implementation, this would also filter by user_id
  const moods = Array.from({ length: days }, (_, i) => {
    const date = new Date(Date.now() - (days - 1 - i) * 86400000);
    return {
      date: date.toISOString().split('T')[0],
      value: 7, 
    };
  });
  
  return {
    success: true,
    data: { moods },
  };
}

/**
 * Get improvement score
 */
export async function getImprovementScore(): Promise<ApiResponse<{ score: number; change: number }>> {
  return {
    success: true,
    data: {
      score: 75,
      change: 5,
    },
  };
}
