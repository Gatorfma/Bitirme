/**
 * Thought Items Repository
 * Handles thought items persistence and retrieval
 */

import { supabase } from '../lib/supabase';

/**
 * Insert or update thought items in the thought_items table (upsert)
 * Uses unique constraint on (session_id, text) to prevent duplicates
 * @param params - Session ID and thoughts array
 * @returns Array of inserted/upserted rows with id and text
 */
export async function insertThoughtItems(params: {
  sessionId: string;
  thoughts: Array<{ text: string; timestamp?: string }>;
}): Promise<Array<{ id: string; text: string }>> {
  try {
    const attemptedCount = params.thoughts.length;
    console.log('[ThoughtItemsRepo] Upserting thought items:', {
      sessionId: params.sessionId,
      attemptedCount,
    });

    // Validate inputs
    if (!params.sessionId || params.sessionId.trim().length === 0) {
      throw new Error('Session ID is required');
    }

    if (!Array.isArray(params.thoughts)) {
      throw new Error('Thoughts must be an array');
    }

    if (params.thoughts.length === 0) {
      console.log('[ThoughtItemsRepo] No thoughts to upsert');
      return [];
    }

    // Prepare thought items for upsert
    const itemsToUpsert = params.thoughts.map((thought) => {
      const item: {
        session_id: string;
        text: string;
        source_timestamp?: string;
      } = {
        session_id: params.sessionId,
        text: thought.text || '',
      };

      // Add source_timestamp if provided
      if (thought.timestamp) {
        item.source_timestamp = thought.timestamp;
      }

      return item;
    });

    console.log('[ThoughtItemsRepo] Prepared items for upsert:', {
      attemptedCount: itemsToUpsert.length,
      sample: itemsToUpsert.slice(0, 1),
    });

    // Upsert thought items using unique constraint on (session_id, text)
    const { data, error } = await supabase
      .from('thought_items')
      .upsert(itemsToUpsert, {
        onConflict: 'session_id,text',
      })
      .select('id, text');

    if (error) {
      console.error('[ThoughtItemsRepo] Error upserting thought items:', {
        sessionId: params.sessionId,
        attemptedCount,
        error: error.message,
        errorCode: error.code,
        errorDetails: error.details,
      });
      throw error;
    }

    if (!data || data.length === 0) {
      console.warn('[ThoughtItemsRepo] No rows returned after upsert');
      return [];
    }

    const insertedCount = data.length;
    console.log('[ThoughtItemsRepo] Thought items upserted successfully:', {
      sessionId: params.sessionId,
      attemptedCount,
      insertedCount,
      difference: attemptedCount - insertedCount,
    });

    // Return inserted/upserted rows with id and text
    return data.map((row) => ({
      id: row.id,
      text: row.text,
    }));
  } catch (error) {
    console.error('[ThoughtItemsRepo] Failed to upsert thought items:', {
      sessionId: params.sessionId,
      attemptedCount: params.thoughts.length,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

/**
 * Get thoughts by active category
 * @param categoryId - The assigned_category_id to filter by
 * @returns Array of thoughts with id, text, and created_at
 */
export async function getThoughtsByActiveCategory(
  categoryId: string
): Promise<Array<{ id: string; text: string; created_at: string }>> {
  try {
    console.log('[ThoughtItemsRepo] Fetching thoughts by active category:', {
      categoryId,
    });

    // Validate input
    if (!categoryId || categoryId.trim().length === 0) {
      throw new Error('Category ID is required');
    }

    // Fetch thought items by assigned_category_id
    const { data, error } = await supabase
      .from('thought_items')
      .select('id, text, created_at')
      .eq('assigned_category_id', categoryId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[ThoughtItemsRepo] Error fetching thoughts by category:', {
        categoryId,
        error: error.message,
        errorCode: error.code,
        errorDetails: error.details,
      });
      throw error;
    }

    if (!data || data.length === 0) {
      console.log('[ThoughtItemsRepo] No thoughts found for category:', categoryId);
      return [];
    }

    console.log('[ThoughtItemsRepo] Fetched thoughts successfully:', {
      categoryId,
      count: data.length,
    });

    // Return thoughts with id, text, and created_at
    return data.map((row) => ({
      id: row.id,
      text: row.text,
      created_at: row.created_at,
    }));
  } catch (error) {
    console.error('[ThoughtItemsRepo] Failed to fetch thoughts by category:', {
      categoryId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

