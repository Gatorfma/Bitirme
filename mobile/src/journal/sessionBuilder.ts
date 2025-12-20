/**
 * Session Builder
 * Converts in-memory chat state to JournalSession format
 */

import type { ChatMessage } from '../types/models';
import type { JournalSession, SessionMessage } from './sessionTypes';

/**
 * Build a JournalSession from chat messages
 * Pure function - no side effects
 */
export function buildJournalSession(params: {
  sessionId: string;
  startedAt: Date;
  messages: ChatMessage[];
}): JournalSession {
  const { sessionId, startedAt, messages } = params;

  // Filter and convert messages, preserving chronological order
  const sessionMessages: SessionMessage[] = messages
    .filter((msg) => {
      // Ignore system messages and typing placeholders
      return msg.type !== 'system' && msg.content.trim().length > 0;
    })
    .map((msg): SessionMessage => {
      // Map user messages to role "user"
      if (msg.type === 'user') {
        return {
          role: 'user',
          content: msg.content,
          timestamp: msg.timestamp, // Already ISO string
        };
      }

      // Map assistant/journaling agent messages (type "question") to role "agent"
      if (msg.type === 'question') {
        return {
          role: 'agent',
          content: msg.content,
          timestamp: msg.timestamp, // Already ISO string
        };
      }

      // This shouldn't happen due to filter above, but TypeScript needs it
      throw new Error(`Unexpected message type: ${(msg as ChatMessage).type}`);
    })
    .sort((a, b) => {
      // Ensure chronological order by timestamp
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });

  return {
    sessionId,
    startedAt: startedAt.toISOString(),
    messages: sessionMessages,
  };
}

