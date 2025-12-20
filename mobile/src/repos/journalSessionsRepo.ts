/**
 * Journal Sessions Repository
 * Handles updating summary and thoughts for journal sessions
 */

import { supabase } from '../lib/supabase';

/**
 * Update session summary and thoughts in journal_sessions table
 * @param params - Session ID, summary text, and thoughts array
 */
export async function updateSessionSummaryAndThoughts(params: {
  sessionId: string;
  summary: string;
  thoughts: Array<{ text: string; timestamp?: string; confidence?: number }>;
}): Promise<void> {
  try {
    console.log('[JournalSessionsRepo] Updating session summary and thoughts:', {
      sessionId: params.sessionId,
      summaryLength: params.summary.length,
      thoughtsCount: params.thoughts.length,
    });

    // Validate inputs
    if (!params.sessionId || params.sessionId.trim().length === 0) {
      throw new Error('Session ID is required');
    }

    if (!params.summary || params.summary.trim().length === 0) {
      throw new Error('Summary is required');
    }

    if (!Array.isArray(params.thoughts)) {
      throw new Error('Thoughts must be an array');
    }

    // Prepare thoughts array for jsonb storage
    // Ensure all required fields are present, with optional fields
    const thoughtsForStorage = params.thoughts.map((thought, index) => ({
      text: thought.text || '',
      timestamp: thought.timestamp || null,
      confidence: typeof thought.confidence === 'number' ? thought.confidence : null,
    }));

    console.log('[JournalSessionsRepo] Prepared thoughts for storage:', {
      count: thoughtsForStorage.length,
      sample: thoughtsForStorage.slice(0, 1),
    });

    // Update the session with summary and thoughts
    const { error } = await supabase
      .from('journal_sessions')
      .update({
        summary: params.summary,
        thoughts: thoughtsForStorage,
      })
      .eq('id', params.sessionId);

    if (error) {
      console.error('[JournalSessionsRepo] Error updating session:', {
        sessionId: params.sessionId,
        error: error.message,
        errorCode: error.code,
        errorDetails: error.details,
      });
      throw error;
    }

    console.log('[JournalSessionsRepo] Session updated successfully:', {
      sessionId: params.sessionId,
      summaryLength: params.summary.length,
      thoughtsCount: thoughtsForStorage.length,
      postProcessedAtSet: params.setPostProcessedAt || false,
    });
  } catch (error) {
    console.error('[JournalSessionsRepo] Failed to update session summary and thoughts:', {
      sessionId: params.sessionId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

