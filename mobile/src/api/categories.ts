/**
 * Categories API
 * Thought categories and mind map endpoints with mock implementations
 */

import type {
  ApiResponse,
  GetCategoriesResponse,
  GetCategoryStatsResponse,
} from '../types';
import type { ThoughtCategory, CategoryStats, MindMapNode } from '../types/models';

// Mock delay to simulate network latency
const mockDelay = (ms: number = 800) => new Promise(resolve => setTimeout(resolve, ms));

// Mock categories data
const mockCategories: ThoughtCategory[] = [
  {
    id: 'cat-1',
    name: 'Work',
    description: 'Career and professional thoughts',
    color: '#5B8A72',
    icon: '💼',
    thoughtCount: 24,
    averageSentiment: -0.2,
  },
  {
    id: 'cat-2',
    name: 'Relationships',
    description: 'Family, friends, and social connections',
    color: '#89A4C7',
    icon: '❤️',
    thoughtCount: 18,
    averageSentiment: 0.4,
  },
  {
    id: 'cat-3',
    name: 'Health',
    description: 'Physical and mental wellness',
    color: '#B8A9C9',
    icon: '🏥',
    thoughtCount: 12,
    averageSentiment: 0.1,
  },
  {
    id: 'cat-4',
    name: 'Self-Growth',
    description: 'Personal development and learning',
    color: '#D4B896',
    icon: '🌱',
    thoughtCount: 15,
    averageSentiment: 0.6,
  },
  {
    id: 'cat-5',
    name: 'Anxiety',
    description: 'Worries and anxious thoughts',
    color: '#C4A484',
    icon: '😰',
    thoughtCount: 9,
    averageSentiment: -0.7,
  },
];

// Mock mind map nodes
const mockMindMapNodes: MindMapNode[] = [
  { id: 'center', label: 'My Thoughts', type: 'category', x: 200, y: 200, size: 60, color: '#5B8A72', connections: ['cat-1', 'cat-2', 'cat-3', 'cat-4', 'cat-5'] },
  { id: 'cat-1', label: 'Work', type: 'category', x: 100, y: 100, size: 45, color: '#5B8A72', connections: ['center'] },
  { id: 'cat-2', label: 'Relationships', type: 'category', x: 300, y: 100, size: 40, color: '#89A4C7', connections: ['center'] },
  { id: 'cat-3', label: 'Health', type: 'category', x: 350, y: 250, size: 35, color: '#B8A9C9', connections: ['center'] },
  { id: 'cat-4', label: 'Self-Growth', type: 'category', x: 250, y: 320, size: 38, color: '#D4B896', connections: ['center'] },
  { id: 'cat-5', label: 'Anxiety', type: 'category', x: 80, y: 280, size: 32, color: '#C4A484', connections: ['center', 'cat-1'] },
];

/**
 * Get all thought categories
 * Currently returns mock data
 */
export async function getCategories(): Promise<ApiResponse<GetCategoriesResponse>> {
  await mockDelay();
  
  // In production: api.get<GetCategoriesResponse>('/categories')
  return {
    success: true,
    data: {
      categories: mockCategories,
    },
  };
}

/**
 * Get statistics for a specific category
 * Currently returns mock data
 */
export async function getCategoryStats(
  categoryId: string,
  range: 'week' | 'month' | 'year' = 'week'
): Promise<ApiResponse<GetCategoryStatsResponse>> {
  await mockDelay();
  
  // In production: api.get<GetCategoryStatsResponse>(`/categories/${categoryId}/stats?range=${range}`)
  
  // Generate mock trend data based on range
  const days = range === 'week' ? 7 : range === 'month' ? 30 : 365;
  const sentimentTrend = Array.from({ length: Math.min(days, 14) }, (_, i) => ({
    date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
    value: Math.random() * 2 - 1, // Random sentiment between -1 and 1
  })).reverse();
  
  const frequencyByDay = Array.from({ length: 7 }, (_, i) => ({
    date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
    count: Math.floor(Math.random() * 5) + 1,
  })).reverse();
  
  const stats: CategoryStats = {
    categoryId,
    thoughtCount: mockCategories.find(c => c.id === categoryId)?.thoughtCount || 0,
    sentimentTrend,
    topKeywords: ['stress', 'deadline', 'meeting', 'project', 'team'],
    frequencyByDay,
  };
  
  return {
    success: true,
    data: { stats },
  };
}

/**
 * Get mind map data
 * Currently returns mock data
 */
export async function getMindMapData(): Promise<ApiResponse<{ nodes: MindMapNode[] }>> {
  await mockDelay();
  
  // In production: api.get<{ nodes: MindMapNode[] }>('/categories/mindmap')
  return {
    success: true,
    data: {
      nodes: mockMindMapNodes,
    },
  };
}

