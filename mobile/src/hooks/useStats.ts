/**
 * useStats Hook
 * React Query hooks for statistics data
 */

import { useQuery } from '@tanstack/react-query';
import { statsApi } from '../api';

// Query keys for cache management
export const statsKeys = {
  all: ['stats'] as const,
  overview: (range: string) => [...statsKeys.all, 'overview', range] as const,
  mood: (days: number) => [...statsKeys.all, 'mood', days] as const,
  improvement: () => [...statsKeys.all, 'improvement'] as const,
};

/**
 * Hook to fetch statistics overview
 */
export function useStatsOverview(range: 'week' | 'month' | 'year' = 'week') {
  return useQuery({
    queryKey: statsKeys.overview(range),
    queryFn: async () => {
      const response = await statsApi.getStats(range);
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch stats');
      }
      return response.data!.stats;
    },
  });
}

/**
 * Hook to fetch mood history
 */
export function useMoodHistory(days: number = 30) {
  return useQuery({
    queryKey: statsKeys.mood(days),
    queryFn: async () => {
      const response = await statsApi.getMoodHistory(days);
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch mood history');
      }
      return response.data!.moods;
    },
  });
}

/**
 * Hook to fetch improvement score
 */
export function useImprovementScore() {
  return useQuery({
    queryKey: statsKeys.improvement(),
    queryFn: async () => {
      const response = await statsApi.getImprovementScore();
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch improvement score');
      }
      return response.data!;
    },
  });
}

