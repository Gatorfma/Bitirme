/**
 * useBehaviors Hook
 * React Query hooks for behavioral interventions
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { behaviorsApi } from '../api';
import type { SendBehaviorFeedbackRequest } from '../types/api';
import type { BehaviorFeedback } from '../types/models';

// Query keys for cache management
export const behaviorKeys = {
  all: ['behaviors'] as const,
  list: () => [...behaviorKeys.all, 'list'] as const,
  recommended: () => [...behaviorKeys.all, 'recommended'] as const,
};

/**
 * Hook to fetch all behaviors
 */
export function useBehaviors() {
  return useQuery({
    queryKey: behaviorKeys.list(),
    queryFn: async () => {
      const response = await behaviorsApi.getBehaviors();
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch behaviors');
      }
      return response.data!.behaviors;
    },
  });
}

/**
 * Hook to fetch recommended behaviors
 */
export function useRecommendedBehaviors(context?: { mood?: number; categoryId?: string }) {
  return useQuery({
    queryKey: [...behaviorKeys.recommended(), context],
    queryFn: async () => {
      const response = await behaviorsApi.getRecommendedBehaviors(context);
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch recommended behaviors');
      }
      return response.data!.behaviors;
    },
  });
}

/**
 * Hook to send behavior feedback
 */
export function useBehaviorFeedback() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      behaviorId,
      feedback,
    }: {
      behaviorId: string;
      feedback: Omit<BehaviorFeedback, 'behaviorId' | 'timestamp'>;
    }) => {
      const request: SendBehaviorFeedbackRequest = {
        behaviorId,
        feedback,
      };
      
      const response = await behaviorsApi.sendBehaviorFeedback(request);
      if (!response.success) {
        throw new Error(response.error || 'Failed to send feedback');
      }
      return response.data!;
    },
    onSuccess: () => {
      // Invalidate behaviors list to refetch with updated stats
      queryClient.invalidateQueries({ queryKey: behaviorKeys.list() });
      queryClient.invalidateQueries({ queryKey: behaviorKeys.recommended() });
    },
  });
}

