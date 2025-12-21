/**
 * Journal Session Types
 * Schema for storing journaling conversations
 */

export type SessionMessage = {
  role: 'user' | 'agent';
  content: string;
  timestamp: string; // ISO
};

export type JournalSession = {
  sessionId: string;
  startedAt: string; // ISO
  endedAt?: string; // ISO
  messages: SessionMessage[];
};

