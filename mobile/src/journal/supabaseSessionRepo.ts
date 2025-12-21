/**
 * Supabase Session Repository
 * Handles journal session persistence to Supabase
 */

import { supabase } from '../lib/supabase';
import type { ChatMessage, JournalSession, Thought } from '../types/models';

export type SessionMessage = {
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
};

type SupabaseSessionRow = {
  id: string;
  started_at: string;
  ended_at: string | null;
  messages: SessionMessage[];
  summary: string | null;
  thoughts: Array<{ text: string; timestamp?: string; confidence?: number }> | null;
  created_at: string;
};

/**
 * Convert ChatMessage[] to SessionMessage[] format for Supabase
 */
function convertMessagesToSessionFormat(messages: ChatMessage[]): SessionMessage[] {
  console.log('[SupabaseSession] Converting messages:', {
    inputCount: messages.length,
    messageTypes: messages.map(m => m.type),
  });

  const filtered = messages.filter((msg) => {
    // Filter out system messages and empty content
    const keep = msg.type !== 'system' && msg.content.trim().length > 0;
    if (!keep) {
      console.log('[SupabaseSession] Filtered out message:', { type: msg.type, contentLength: msg.content.length });
    }
    return keep;
  });

  console.log('[SupabaseSession] After filtering:', { count: filtered.length });

  const converted = filtered.map((msg): SessionMessage => {
    if (msg.type === 'user') {
      return {
        role: 'user',
        content: msg.content,
        timestamp: msg.timestamp,
      };
    } else if (msg.type === 'question') {
      // 'question' type maps to 'agent'
      return {
        role: 'agent',
        content: msg.content,
        timestamp: msg.timestamp,
      };
    } else {
      // Fallback for any other type (shouldn't happen after filter, but be safe)
      console.warn('[SupabaseSession] Unexpected message type:', msg.type);
      return {
        role: 'agent',
        content: msg.content,
        timestamp: msg.timestamp,
      };
    }
  });

  const sorted = converted.sort((a, b) => {
    // Ensure chronological order
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  console.log('[SupabaseSession] Converted messages:', {
    count: sorted.length,
    roles: sorted.map(m => m.role),
  });

  return sorted;
}

/**
 * Create a new journal session in Supabase
 * @returns Session ID from Supabase
 */
export async function createSession(params: {
  startedAt: string;
}): Promise<{ id: string }> {
  try {
    console.log('[SupabaseSession] Creating session, startedAt:', params.startedAt);

    const { data, error } = await supabase
      .from('journal_sessions')
      .insert({
        started_at: params.startedAt,
        messages: [], // Start with empty messages array
        summary: null, // Optional, null on creation
        thoughts: null, // Optional, null on creation
      })
      .select('id')
      .single();

    if (error) {
      console.error('[SupabaseSession] Error creating session:', error);
      throw error;
    }

    if (!data || !data.id) {
      throw new Error('No session ID returned from Supabase');
    }

    console.log('[SupabaseSession] Session created successfully, id:', data.id);
    return { id: data.id };
  } catch (error) {
    console.error('[SupabaseSession] Failed to create session:', error);
    throw error;
  }
}

/**
 * Delete a journal session from Supabase
 */
export async function deleteSession(id: string): Promise<void> {
  try {
    console.log('[SupabaseSession] Deleting session:', id);

    const { error } = await supabase
      .from('journal_sessions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[SupabaseSession] Error deleting session:', error);
      throw error;
    }

    console.log('[SupabaseSession] Session deleted successfully:', id);
  } catch (error) {
    console.error('[SupabaseSession] Failed to delete session:', error);
    throw error;
  }
}

/**
 * Check if messages contain at least one user message
 */
export function hasUserMessages(messages: ChatMessage[]): boolean {
  return messages.some(msg => msg.type === 'user' && msg.content.trim().length > 0);
}

/**
 * Convert Supabase session row to JournalSession format
 */
function convertSupabaseSessionToJournalSession(row: SupabaseSessionRow): JournalSession {
  // Extract user messages as thoughts
  const thoughts: Thought[] = (row.messages || [])
    .filter((msg) => msg.role === 'user')
    .map((msg, index) => ({
      id: `${row.id}-thought-${index}`,
      sessionId: row.id,
      content: msg.content,
      timestamp: msg.timestamp,
      // Sentiment and emotionalIntensity could be extracted from thoughts array if stored
    }));

  // Extract summary directly from row (no longer from meta)
  const summary = row.summary || undefined;
  // Mood is not stored in the current schema, so it's undefined
  const mood = undefined;

  return {
    id: row.id,
    userId: 'user-1', // Placeholder - in production, use auth.uid()
    startedAt: row.started_at,
    endedAt: row.ended_at || undefined,
    thoughts,
    mood,
    summary,
  };
}

/**
 * Fetch all journal sessions from Supabase
 * Returns sessions ordered by started_at descending (newest first)
 */
export async function fetchSessions(
  page: number = 1,
  pageSize: number = 10
): Promise<{ items: JournalSession[]; total: number; page: number; pageSize: number; hasMore: boolean }> {
  try {
    console.log('[SupabaseSession] Fetching sessions:', { page, pageSize });

    // Fetch all sessions first (we'll filter client-side for simplicity)
    // Note: In production with many sessions, consider using a Postgres function or view
    const { data: allData, error: fetchError } = await supabase
      .from('journal_sessions')
      .select('*')
      .order('started_at', { ascending: false });

    if (fetchError) {
      console.error('[SupabaseSession] Error fetching sessions:', fetchError);
      throw fetchError;
    }

    // Filter out empty sessions (sessions with no user messages)
    const rowsWithMessages = (allData || []).filter((row: SupabaseSessionRow) => {
      const messages = row.messages || [];
      return Array.isArray(messages) && messages.length > 0 && 
             messages.some((msg: SessionMessage) => msg.role === 'user');
    }) as SupabaseSessionRow[];

    const total = rowsWithMessages.length;

    // Calculate pagination
    const from = (page - 1) * pageSize;
    const to = Math.min(from + pageSize, total);
    const rows = rowsWithMessages.slice(from, to);

    const items = rows.map(convertSupabaseSessionToJournalSession);

    console.log('[SupabaseSession] Fetched sessions:', {
      count: items.length,
      total,
      page,
      pageSize,
    });

    return {
      items,
      total,
      page,
      pageSize,
      hasMore: to < total,
    };
  } catch (error) {
    console.error('[SupabaseSession] Failed to fetch sessions:', error);
    throw error;
  }
}

/**
 * Fetch a single session by ID from Supabase
 */
export async function fetchSessionById(sessionId: string): Promise<JournalSession | null> {
  try {
    console.log('[SupabaseSession] Fetching session:', sessionId);

    const { data, error } = await supabase
      .from('journal_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        console.log('[SupabaseSession] Session not found:', sessionId);
        return null;
      }
      console.error('[SupabaseSession] Error fetching session:', error);
      throw error;
    }

    if (!data) {
      return null;
    }

    const session = convertSupabaseSessionToJournalSession(data as SupabaseSessionRow);
    console.log('[SupabaseSession] Fetched session:', { id: session.id, thoughtCount: session.thoughts.length });
    return session;
  } catch (error) {
    console.error('[SupabaseSession] Failed to fetch session:', error);
    throw error;
  }
}

/**
 * Update an existing journal session in Supabase
 * Updates messages and optionally endedAt timestamp
 */
export async function updateSession(params: {
  id: string;
  endedAt?: string;
  messages: ChatMessage[];
}): Promise<void> {
  try {
    console.log('[SupabaseSession] Updating session:', {
      id: params.id,
      messageCount: params.messages.length,
      hasEndedAt: !!params.endedAt,
    });

    const sessionMessages = convertMessagesToSessionFormat(params.messages);

    const updateData: {
      messages: SessionMessage[];
      ended_at?: string;
    } = {
      messages: sessionMessages,
    };

    if (params.endedAt) {
      updateData.ended_at = params.endedAt;
    }

    console.log('[SupabaseSession] Sending update to Supabase:', {
      id: params.id,
      messagesCount: sessionMessages.length,
      messagesPreview: sessionMessages.slice(0, 2).map(m => ({ role: m.role, contentLength: m.content.length })),
      updateDataKeys: Object.keys(updateData),
      messagesArraySample: JSON.stringify(sessionMessages.slice(0, 1)),
    });

    const { error } = await supabase
      .from('journal_sessions')
      .update(updateData)
      .eq('id', params.id);

    if (error) {
      console.error('[SupabaseSession] Error updating session:', error);
      throw error;
    }

    console.log('[SupabaseSession] Session updated successfully:', {
      id: params.id,
      messageCount: sessionMessages.length,
    });
  } catch (error) {
    console.error('[SupabaseSession] Failed to update session:', error);
    throw error;
  }
}

