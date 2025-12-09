/**
 * Journal API
 * Journal session and thought endpoints with mock implementations
 */

import type {
  ApiResponse,
  PaginatedResponse,
  CreateSessionRequest,
  CreateSessionResponse,
  AppendThoughtRequest,
  AppendThoughtResponse,
} from '../types';
import type { JournalSession, Thought } from '../types/models';

// Mock delay to simulate network latency
const mockDelay = (ms: number = 800) => new Promise(resolve => setTimeout(resolve, ms));

// Mock sessions data
const mockSessions: JournalSession[] = [
  {
    id: 'session-1',
    userId: 'user-1',
    startedAt: new Date(Date.now() - 86400000).toISOString(), // Yesterday
    endedAt: new Date(Date.now() - 86400000 + 1800000).toISOString(),
    thoughts: [
      {
        id: 'thought-1',
        sessionId: 'session-1',
        content: 'I felt overwhelmed at work today with all the deadlines.',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        sentiment: 'negative',
        emotionalIntensity: 7,
      },
      {
        id: 'thought-2',
        sessionId: 'session-1',
        content: 'But I managed to complete the most important task.',
        timestamp: new Date(Date.now() - 86400000 + 600000).toISOString(),
        sentiment: 'positive',
        emotionalIntensity: 5,
      },
    ],
    mood: 6,
    summary: 'Mixed feelings about work productivity',
  },
  {
    id: 'session-2',
    userId: 'user-1',
    startedAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
    endedAt: new Date(Date.now() - 172800000 + 1200000).toISOString(),
    thoughts: [
      {
        id: 'thought-3',
        sessionId: 'session-2',
        content: 'Had a great conversation with an old friend.',
        timestamp: new Date(Date.now() - 172800000).toISOString(),
        sentiment: 'positive',
        emotionalIntensity: 8,
      },
    ],
    mood: 8,
    summary: 'Reconnecting with friends',
  },
  {
    id: 'session-3',
    userId: 'user-1',
    startedAt: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
    endedAt: new Date(Date.now() - 259200000 + 900000).toISOString(),
    thoughts: [
      {
        id: 'thought-4',
        sessionId: 'session-3',
        content: 'Feeling anxious about the upcoming presentation.',
        timestamp: new Date(Date.now() - 259200000).toISOString(),
        sentiment: 'negative',
        emotionalIntensity: 6,
      },
    ],
    mood: 4,
    summary: 'Presentation anxiety',
  },
];

// Guiding questions pool
const guidingQuestions = [
  "What triggered this feeling?",
  "How did your body react to this situation?",
  "What thoughts came to mind first?",
  "Have you experienced something similar before?",
  "What would you tell a friend in this situation?",
  "What's one small thing that could help right now?",
  "Can you identify any patterns in these feelings?",
  "What are you grateful for today?",
];

/**
 * Get all journal sessions
 * Currently returns mock data
 */
export async function getSessions(
  page: number = 1,
  pageSize: number = 10
): Promise<ApiResponse<PaginatedResponse<JournalSession>>> {
  await mockDelay();
  
  // In production: api.get<PaginatedResponse<JournalSession>>(`/journal/sessions?page=${page}&pageSize=${pageSize}`)
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const items = mockSessions.slice(startIndex, endIndex);
  
  return {
    success: true,
    data: {
      items,
      total: mockSessions.length,
      page,
      pageSize,
      hasMore: endIndex < mockSessions.length,
    },
  };
}

/**
 * Get a single session by ID
 * Currently returns mock data
 */
export async function getSession(
  sessionId: string
): Promise<ApiResponse<JournalSession>> {
  await mockDelay(500);
  
  // In production: api.get<JournalSession>(`/journal/sessions/${sessionId}`)
  const session = mockSessions.find(s => s.id === sessionId);
  
  if (!session) {
    return {
      success: false,
      error: 'Session not found',
    };
  }
  
  return {
    success: true,
    data: session,
  };
}

/**
 * Create a new journal session
 * Currently returns mock data
 */
export async function createSession(
  request: CreateSessionRequest
): Promise<ApiResponse<CreateSessionResponse>> {
  await mockDelay();
  
  // In production: api.post<CreateSessionResponse>('/journal/sessions', request)
  const newSession: JournalSession = {
    id: 'session-' + Date.now(),
    userId: 'user-1',
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    thoughts: request.thoughts.map((t, index) => ({
      ...t,
      id: `thought-${Date.now()}-${index}`,
      sessionId: 'session-' + Date.now(),
      timestamp: new Date().toISOString(),
    })),
    mood: request.mood,
  };
  
  // Add to mock data (in memory only)
  mockSessions.unshift(newSession);
  
  return {
    success: true,
    data: {
      session: newSession,
    },
  };
}

/**
 * Append a thought to an existing session
 * Currently returns mock data with a guiding question
 */
export async function appendThought(
  sessionId: string,
  request: AppendThoughtRequest
): Promise<ApiResponse<AppendThoughtResponse>> {
  await mockDelay(600);
  
  // In production: api.post<AppendThoughtResponse>(`/journal/sessions/${sessionId}/thoughts`, request)
  const thought: Thought = {
    id: 'thought-' + Date.now(),
    sessionId,
    content: request.content,
    timestamp: new Date().toISOString(),
    sentiment: request.sentiment,
  };
  
  // Return a random guiding question
  const randomQuestion = guidingQuestions[Math.floor(Math.random() * guidingQuestions.length)];
  
  return {
    success: true,
    data: {
      thought,
      guidingQuestion: randomQuestion,
    },
  };
}

