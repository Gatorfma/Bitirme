/**
 * useCategories Hook
 * React Query hooks for categories and mind map data
 */

import { useQuery } from '@tanstack/react-query';
import { categoriesApi } from '../api';

// Query keys for cache management
export const categoryKeys = {
  all: ['categories'] as const,
  list: () => [...categoryKeys.all, 'list'] as const,
  stats: (id: string, range: string) => [...categoryKeys.all, 'stats', id, range] as const,
  mindMap: () => [...categoryKeys.all, 'mindmap'] as const,
};

/**
 * Hook to fetch all categories
 */
export function useCategories() {
  return useQuery({
    queryKey: categoryKeys.list(),
    queryFn: async () => {
      const response = await categoriesApi.getCategories();
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch categories');
      }
      return response.data!.categories;
    },
  });
}

/**
 * Hook to fetch stats for a specific category
 */
export function useCategoryStats(
  categoryId: string,
  range: 'week' | 'month' | 'year' = 'week'
) {
  return useQuery({
    queryKey: categoryKeys.stats(categoryId, range),
    queryFn: async () => {
      const response = await categoriesApi.getCategoryStats(categoryId, range);
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch category stats');
      }
      return response.data!.stats;
    },
    enabled: !!categoryId,
  });
}

/**
 * Hook to fetch mind map data
 */
export function useMindMap() {
  return useQuery({
    queryKey: categoryKeys.mindMap(),
    queryFn: async () => {
      const response = await categoriesApi.getMindMapData();
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch mind map data');
      }
      return response.data!.nodes;
    },
  });
}

