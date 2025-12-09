/**
 * useJournal Hook
 * React Query hooks for journal data
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { journalApi } from '../api';
import type { CreateSessionRequest, AppendThoughtRequest } from '../types/api';

// Query keys for cache management
export const journalKeys = {
  all: ['journal'] as const,
  sessions: () => [...journalKeys.all, 'sessions'] as const,
  session: (id: string) => [...journalKeys.all, 'session', id] as const,
};

/**
 * Hook to fetch all journal sessions
 */
export function useJournalSessions(page: number = 1, pageSize: number = 10) {
  return useQuery({
    queryKey: [...journalKeys.sessions(), page, pageSize],
    queryFn: async () => {
      const response = await journalApi.getSessions(page, pageSize);
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch sessions');
      }
      return response.data!;
    },
  });
}

/**
 * Hook to fetch a single session
 */
export function useJournalSession(sessionId: string) {
  return useQuery({
    queryKey: journalKeys.session(sessionId),
    queryFn: async () => {
      const response = await journalApi.getSession(sessionId);
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch session');
      }
      return response.data!;
    },
    enabled: !!sessionId,
  });
}

/**
 * Hook to create a new session
 */
export function useCreateSession() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (request: CreateSessionRequest) => {
      const response = await journalApi.createSession(request);
      if (!response.success) {
        throw new Error(response.error || 'Failed to create session');
      }
      return response.data!;
    },
    onSuccess: () => {
      // Invalidate sessions list to refetch
      queryClient.invalidateQueries({ queryKey: journalKeys.sessions() });
    },
  });
}

/**
 * Hook to append a thought to a session
 */
export function useAppendThought(sessionId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (request: AppendThoughtRequest) => {
      const response = await journalApi.appendThought(sessionId, request);
      if (!response.success) {
        throw new Error(response.error || 'Failed to append thought');
      }
      return response.data!;
    },
    onSuccess: () => {
      // Invalidate the specific session to refetch
      queryClient.invalidateQueries({ queryKey: journalKeys.session(sessionId) });
    },
  });
}

