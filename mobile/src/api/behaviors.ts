/**
 * Behaviors API
 * Behavioral interventions endpoints with mock implementations
 */

import type {
  ApiResponse,
  GetBehaviorsResponse,
  SendBehaviorFeedbackRequest,
  SendBehaviorFeedbackResponse,
} from '../types';
import type { Behavior } from '../types/models';

// Mock delay to simulate network latency
const mockDelay = (ms: number = 800) => new Promise(resolve => setTimeout(resolve, ms));

// Mock behaviors data
const mockBehaviors: Behavior[] = [
  {
    id: 'behavior-1',
    name: 'Deep Breathing',
    description: 'Take 5 slow, deep breaths. Inhale for 4 seconds, hold for 4, exhale for 6.',
    category: 'mindfulness',
    successRate: 78,
    timesUsed: 45,
    lastUsed: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'behavior-2',
    name: 'Short Walk',
    description: 'Take a 10-minute walk outside. Focus on your surroundings and the sensation of movement.',
    category: 'physical',
    successRate: 85,
    timesUsed: 32,
    lastUsed: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: 'behavior-3',
    name: 'Call a Friend',
    description: 'Reach out to someone you trust. Even a short conversation can shift your perspective.',
    category: 'social',
    successRate: 72,
    timesUsed: 18,
    lastUsed: new Date(Date.now() - 259200000).toISOString(),
  },
  {
    id: 'behavior-4',
    name: 'Thought Reframing',
    description: 'Write down the negative thought, then challenge it with evidence and write a balanced alternative.',
    category: 'cognitive',
    successRate: 68,
    timesUsed: 28,
    lastUsed: new Date(Date.now() - 43200000).toISOString(),
  },
  {
    id: 'behavior-5',
    name: 'Body Scan',
    description: 'Spend 5 minutes scanning your body from head to toe, noticing any tension and releasing it.',
    category: 'mindfulness',
    successRate: 74,
    timesUsed: 22,
    lastUsed: new Date(Date.now() - 604800000).toISOString(),
  },
  {
    id: 'behavior-6',
    name: 'Gratitude List',
    description: 'Write down 3 things you are grateful for right now, no matter how small.',
    category: 'cognitive',
    successRate: 81,
    timesUsed: 56,
    lastUsed: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'behavior-7',
    name: 'Stretching',
    description: 'Do 5 minutes of gentle stretching, focusing on areas where you hold tension.',
    category: 'physical',
    successRate: 76,
    timesUsed: 38,
    lastUsed: new Date(Date.now() - 129600000).toISOString(),
  },
  {
    id: 'behavior-8',
    name: 'Hobby Time',
    description: 'Spend 15 minutes on an activity you enjoy - reading, drawing, music, etc.',
    category: 'activity',
    successRate: 88,
    timesUsed: 24,
    lastUsed: new Date(Date.now() - 345600000).toISOString(),
  },
];

/**
 * Get all behavioral interventions
 * Currently returns mock data
 */
export async function getBehaviors(): Promise<ApiResponse<GetBehaviorsResponse>> {
  await mockDelay();
  
  // In production: api.get<GetBehaviorsResponse>('/behaviors')
  return {
    success: true,
    data: {
      behaviors: mockBehaviors,
    },
  };
}

/**
 * Send feedback for a behavior
 * Currently returns mock data
 */
export async function sendBehaviorFeedback(
  request: SendBehaviorFeedbackRequest
): Promise<ApiResponse<SendBehaviorFeedbackResponse>> {
  await mockDelay();
  
  // In production: api.post<SendBehaviorFeedbackResponse>(`/behaviors/${request.behaviorId}/feedback`, request.feedback)
  
  // Find and update the behavior (mock)
  const behaviorIndex = mockBehaviors.findIndex(b => b.id === request.behaviorId);
  
  if (behaviorIndex === -1) {
    return {
      success: false,
      error: 'Behavior not found',
    };
  }
  
  // Update mock behavior stats
  const behavior = mockBehaviors[behaviorIndex];
  const newTimesUsed = behavior.timesUsed + 1;
  const moodImprovement = request.feedback.moodAfter > request.feedback.moodBefore;
  
  // Recalculate success rate (simplified)
  const oldSuccessCount = Math.round(behavior.successRate * behavior.timesUsed / 100);
  const newSuccessCount = oldSuccessCount + (moodImprovement ? 1 : 0);
  const newSuccessRate = Math.round((newSuccessCount / newTimesUsed) * 100);
  
  const updatedBehavior: Behavior = {
    ...behavior,
    timesUsed: newTimesUsed,
    successRate: newSuccessRate,
    lastUsed: new Date().toISOString(),
  };
  
  mockBehaviors[behaviorIndex] = updatedBehavior;
  
  return {
    success: true,
    data: {
      success: true,
      updatedBehavior,
    },
  };
}

/**
 * Get recommended behaviors based on current mood/context
 * Currently returns mock data
 */
export async function getRecommendedBehaviors(
  context?: { mood?: number; categoryId?: string }
): Promise<ApiResponse<GetBehaviorsResponse>> {
  await mockDelay(500);
  
  // In production: api.get<GetBehaviorsResponse>('/behaviors/recommended', { params: context })
  
  // Simple mock logic: return top 3 by success rate
  const recommended = [...mockBehaviors]
    .sort((a, b) => b.successRate - a.successRate)
    .slice(0, 3);
  
  return {
    success: true,
    data: {
      behaviors: recommended,
    },
  };
}

