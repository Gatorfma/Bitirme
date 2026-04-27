/**
 * Categories Repository
 * Handles active and pending category management
 */

import { supabase } from '../lib/supabase';

/**
 * Get all active categories
 * @returns Array of active categories with id, name, and thought_count
 */
export async function getActiveCategories(): Promise<
  Array<{ id: string; name: string; thought_count: number }>
> {
  try {
    console.log('[CategoriesRepo] Fetching active categories');

    const { data, error } = await supabase
      .from('categories_active')
      .select('id, name, thought_count')
      .order('thought_count', { ascending: false });

    if (error) {
      console.error('[CategoriesRepo] Error fetching active categories:', {
        error: error.message,
        errorCode: error.code,
        errorDetails: error.details,
      });
      throw error;
    }

    if (!data) {
      console.log('[CategoriesRepo] No active categories found');
      return [];
    }

    console.log('[CategoriesRepo] Fetched active categories:', {
      count: data.length,
    });

    return data.map((row) => ({
      id: row.id,
      name: row.name,
      thought_count: row.thought_count,
    }));
  } catch (error) {
    console.error('[CategoriesRepo] Failed to fetch active categories:', {
      error: (error as any)?.message ?? String(error),
      stack: (error as any)?.stack,
    });
    throw error;
  }
}

/**
 * Find an active category by name
 * @param name - Category name to search for
 * @returns Category with id and name, or null if not found
 */
export async function findActiveCategoryByName(
  name: string
): Promise<{ id: string; name: string } | null> {
  try {
    console.log('[CategoriesRepo] Finding active category by name:', { name });

    if (!name || name.trim().length === 0) {
      throw new Error('Category name is required');
    }

    const { data, error } = await supabase
      .from('categories_active')
      .select('id, name')
      .eq('name', name.trim())
      .maybeSingle();

    if (error) {
      console.error('[CategoriesRepo] Error finding active category:', {
        name,
        error: error.message,
        errorCode: error.code,
        errorDetails: error.details,
      });
      throw error;
    }

    if (!data) {
      console.log('[CategoriesRepo] Active category not found:', name);
      return null;
    }

    console.log('[CategoriesRepo] Found active category:', {
      id: data.id,
      name: data.name,
    });

    return {
      id: data.id,
      name: data.name,
    };
  } catch (error) {
    console.error('[CategoriesRepo] Failed to find active category:', {
      name,
      error: (error as any)?.message ?? String(error),
      stack: (error as any)?.stack,
    });
    throw error;
  }
}

/**
 * Get all pending categories
 * @returns Array of pending categories with id, name, hit_count, and threshold
 */
export async function getPendingCategories(): Promise<
  Array<{ id: string; name: string; hit_count: number; threshold: number }>
> {
  try {
    console.log('[CategoriesRepo] Fetching pending categories');

    const { data, error } = await supabase
      .from('categories_pending')
      .select('id, name, hit_count, threshold')
      .order('hit_count', { ascending: false });

    if (error) {
      console.error('[CategoriesRepo] Error fetching pending categories:', {
        error: error.message,
        errorCode: error.code,
        errorDetails: error.details,
      });
      throw error;
    }

    if (!data) {
      console.log('[CategoriesRepo] No pending categories found');
      return [];
    }

    console.log('[CategoriesRepo] Fetched pending categories:', {
      count: data.length,
    });

    return data.map((row) => ({
      id: row.id,
      name: row.name,
      hit_count: row.hit_count,
      threshold: row.threshold,
    }));
  } catch (error) {
    console.error('[CategoriesRepo] Failed to fetch pending categories:', {
      error: (error as any)?.message ?? String(error),
      stack: (error as any)?.stack,
    });
    throw error;
  }
}

/**
 * Find a pending category by name
 * @param name - Category name to search for
 * @returns Category with id, name, hit_count, and threshold, or null if not found
 */
export async function findPendingCategoryByName(
  name: string
): Promise<{ id: string; name: string; hit_count: number; threshold: number } | null> {
  try {
    console.log('[CategoriesRepo] Finding pending category by name:', { name });

    if (!name || name.trim().length === 0) {
      throw new Error('Category name is required');
    }

    const { data, error } = await supabase
      .from('categories_pending')
      .select('id, name, hit_count, threshold')
      .eq('name', name.trim())
      .maybeSingle();

    if (error) {
      console.error('[CategoriesRepo] Error finding pending category:', {
        name,
        error: error.message,
        errorCode: error.code,
        errorDetails: error.details,
      });
      throw error;
    }

    if (!data) {
      console.log('[CategoriesRepo] Pending category not found:', name);
      return null;
    }

    console.log('[CategoriesRepo] Found pending category:', {
      id: data.id,
      name: data.name,
      hit_count: data.hit_count,
      threshold: data.threshold,
    });

    return {
      id: data.id,
      name: data.name,
      hit_count: data.hit_count,
      threshold: data.threshold,
    };
  } catch (error) {
    console.error('[CategoriesRepo] Failed to find pending category:', {
      name,
      error: (error as any)?.message ?? String(error),
      stack: (error as any)?.stack,
    });
    throw error;
  }
}

/**
 * Upsert a pending category (insert if not exists, update if exists)
 * Atomic operation using upsert with onConflict
 * @param name - Category name
 * @returns Category with id, hit_count, and threshold
 */
export async function upsertPendingCategory(
  name: string
): Promise<{ id: string; hit_count: number; threshold: number }> {
  try {
    console.log('[CategoriesRepo] Upserting pending category:', { name });

    if (!name || name.trim().length === 0) {
      throw new Error('Category name is required');
    }

    const trimmedName = name.trim();

    // Atomic upsert: insert if not exists, return existing if exists
    // Use onConflict: 'name' to handle the unique constraint on name
    const { data: result, error: upsertError } = await supabase
      .from('categories_pending')
      .upsert(
        {
          name: trimmedName,
          hit_count: 0, // Only set on insert, not on update
          threshold: 5, // Only set on insert, not on update
        },
        {
          onConflict: 'name',
          // Don't update hit_count and threshold if row already exists
          ignoreDuplicates: false,
        }
      )
      .select('id, hit_count, threshold')
      .single();

    if (upsertError) {
      console.error('[CategoriesRepo] Error upserting pending category:', {
        name: trimmedName,
        error: upsertError.message,
        errorCode: upsertError.code,
        errorDetails: upsertError.details,
      });
      throw upsertError;
    }

    if (!result) {
      throw new Error('Failed to upsert pending category - no data returned');
    }

    // Infer if it was created or existing based on returned values
    // If hit_count is 0 and threshold is 5 (our defaults), it's likely a new row
    // Otherwise, it's an existing row that was returned
    const wasCreated = result.hit_count === 0 && result.threshold === 5;

    if (wasCreated) {
      console.log('[CategoriesRepo] Created new pending category:', {
        id: result.id,
        name: trimmedName,
        hit_count: result.hit_count,
        threshold: result.threshold,
      });
    } else {
      console.log('[CategoriesRepo] Found existing pending category:', {
        id: result.id,
        name: trimmedName,
        hit_count: result.hit_count,
        threshold: result.threshold,
      });
    }

    return {
      id: result.id,
      hit_count: result.hit_count,
      threshold: result.threshold,
    };
  } catch (error) {
    console.error('[CategoriesRepo] Failed to upsert pending category:', {
      name,
      error: (error as any)?.message ?? String(error),
      stack: (error as any)?.stack,
    });
    throw error;
  }
}

/**
 * Increment hit count for a pending category
 * Prevents duplicate increments from the same session using last_hit_session_id
 * @param pendingId - Pending category ID
 * @param sessionId - Session ID to check against last_hit_session_id
 * @returns Updated hit_count and threshold
 */
export async function incrementPendingHit(
  pendingId: string,
  sessionId: string
): Promise<{ hit_count: number; threshold: number }> {
  try {
    console.log('[CategoriesRepo] Incrementing pending hit:', {
      pendingId,
      sessionId,
    });

    if (!pendingId || pendingId.trim().length === 0) {
      throw new Error('Pending category ID is required');
    }

    if (!sessionId || sessionId.trim().length === 0) {
      throw new Error('Session ID is required');
    }

    // Fetch pending category row by id (hit_count, threshold, last_hit_session_id)
    const { data: current, error: fetchError } = await supabase
      .from('categories_pending')
      .select('hit_count, threshold, last_hit_session_id')
      .eq('id', pendingId)
      .single();

    if (fetchError) {
      console.error('[CategoriesRepo] Error fetching pending category:', {
        pendingId,
        error: fetchError.message,
        errorCode: fetchError.code,
      });
      throw fetchError;
    }

    if (!current) {
      throw new Error(`Pending category not found: ${pendingId}`);
    }

    // Check if last_hit_session_id === sessionId
    if (current.last_hit_session_id === sessionId) {
      // DO NOT increment - already hit by this session
      console.log('[CategoriesRepo] ⏭️  Skipped increment (already hit by this session):', {
        pendingId,
        sessionId,
        currentHitCount: current.hit_count,
        threshold: current.threshold,
        lastHitSessionId: current.last_hit_session_id,
      });

      return {
        hit_count: current.hit_count,
        threshold: current.threshold,
      };
    }

    // Else: increment hit_count by 1 and set last_hit_session_id = sessionId
    const { data: updated, error: updateError } = await supabase
      .from('categories_pending')
      .update({
        hit_count: current.hit_count + 1,
        last_hit_session_id: sessionId,
      })
      .eq('id', pendingId)
      .select('hit_count, threshold')
      .single();

    if (updateError) {
      console.error('[CategoriesRepo] Error incrementing pending hit:', {
        pendingId,
        sessionId,
        error: updateError.message,
        errorCode: updateError.code,
      });
      throw updateError;
    }

    if (!updated) {
      throw new Error('Failed to update pending category - no data returned');
    }

    console.log('[CategoriesRepo] ✅ Incremented pending hit:', {
      pendingId,
      sessionId,
      oldHitCount: current.hit_count,
      newHitCount: updated.hit_count,
      threshold: updated.threshold,
      previousLastHitSessionId: current.last_hit_session_id,
    });

    return {
      hit_count: updated.hit_count,
      threshold: updated.threshold,
    };
  } catch (error) {
    console.error('[CategoriesRepo] Failed to increment pending hit:', {
      pendingId,
      sessionId,
      error: (error as any)?.message ?? String(error),
      stack: (error as any)?.stack,
    });
    throw error;
  }
}

/**
 * Create a new active category
 * @param name - Category name
 * @returns Created category with id and name
 */
export async function createActiveCategory(
  name: string
): Promise<{ id: string; name: string }> {
  try {
    console.log('[CategoriesRepo] Creating active category:', { name });

    if (!name || name.trim().length === 0) {
      throw new Error('Category name is required');
    }

    const trimmedName = name.trim();

    // Check if category already exists
    const existing = await findActiveCategoryByName(trimmedName);
    if (existing) {
      console.log('[CategoriesRepo] Active category already exists:', {
        id: existing.id,
        name: existing.name,
      });
      return existing;
    }

    // Create new active category
    const { data, error } = await supabase
      .from('categories_active')
      .insert({
        name: trimmedName,
        thought_count: 0,
      })
      .select('id, name')
      .single();

    if (error) {
      console.error('[CategoriesRepo] Error creating active category:', {
        name: trimmedName,
        error: error.message,
        errorCode: error.code,
        errorDetails: error.details,
      });
      throw error;
    }

    if (!data) {
      throw new Error('Failed to create active category - no data returned');
    }

    console.log('[CategoriesRepo] Created active category:', {
      id: data.id,
      name: data.name,
    });

    return {
      id: data.id,
      name: data.name,
    };
  } catch (error) {
    console.error('[CategoriesRepo] Failed to create active category:', {
      name,
      error: (error as any)?.message ?? String(error),
      stack: (error as any)?.stack,
    });
    throw error;
  }
}

/**
 * Increment thought count for an active category
 * @param activeId - Active category ID
 * @param delta - Amount to increment (can be negative)
 */
export async function incrementActiveCount(
  activeId: string,
  delta: number
): Promise<void> {
  try {
    console.log('[CategoriesRepo] Incrementing active count:', {
      activeId,
      delta,
    });

    if (!activeId || activeId.trim().length === 0) {
      throw new Error('Active category ID is required');
    }

    if (typeof delta !== 'number' || isNaN(delta)) {
      throw new Error('Delta must be a valid number');
    }

    // Get current thought_count
    const { data: current, error: fetchError } = await supabase
      .from('categories_active')
      .select('thought_count')
      .eq('id', activeId)
      .single();

    if (fetchError) {
      console.error('[CategoriesRepo] Error fetching active category:', {
        activeId,
        error: fetchError.message,
        errorCode: fetchError.code,
      });
      throw fetchError;
    }

    if (!current) {
      throw new Error(`Active category not found: ${activeId}`);
    }

    // Calculate new count (ensure it doesn't go below 0)
    const newCount = Math.max(0, current.thought_count + delta);

    // Update thought_count
    const { error: updateError } = await supabase
      .from('categories_active')
      .update({ thought_count: newCount })
      .eq('id', activeId);

    if (updateError) {
      console.error('[CategoriesRepo] Error incrementing active count:', {
        activeId,
        error: updateError.message,
        errorCode: updateError.code,
      });
      throw updateError;
    }

    console.log('[CategoriesRepo] Incremented active count:', {
      activeId,
      oldCount: current.thought_count,
      newCount,
      delta,
    });
  } catch (error) {
    console.error('[CategoriesRepo] Failed to increment active count:', {
      activeId,
      delta,
      error: (error as any)?.message ?? String(error),
      stack: (error as any)?.stack,
    });
    throw error;
  }
}

/**
 * Promote a pending category to active
 * This is a multi-step operation:
 * 1. Read pending row (name, hit_count)
 * 2. Create/find active category with same name
 * 3. Move ALL thought_items with pending_category_id=pendingId:
 *    - Set assigned_category_id=activeId
 *    - Set pending_category_id=NULL
 * 4. Update categories_active.thought_count by the number moved
 * 5. Delete the pending category row after migration
 * @param pendingId - Pending category ID to promote
 * @returns Active category ID
 */
export async function promotePendingToActive(
  pendingId: string
): Promise<{ activeId: string }> {
  try {
    console.log('[CategoriesRepo] Promoting pending to active:', { pendingId });

    if (!pendingId || pendingId.trim().length === 0) {
      throw new Error('Pending category ID is required');
    }

    // Step 1: Read pending row
    const { data: pending, error: fetchError } = await supabase
      .from('categories_pending')
      .select('id, name, hit_count')
      .eq('id', pendingId)
      .single();

    if (fetchError) {
      console.error('[CategoriesRepo] Error fetching pending category:', {
        pendingId,
        error: fetchError.message,
        errorCode: fetchError.code,
      });
      throw fetchError;
    }

    if (!pending) {
      throw new Error(`Pending category not found: ${pendingId}`);
    }

    console.log('[CategoriesRepo] Found pending category:', {
      id: pending.id,
      name: pending.name,
      hit_count: pending.hit_count,
    });

    // Step 2: Create/find active category with same name
    const activeCategory = await createActiveCategory(pending.name);
    const activeId = activeCategory.id;

    console.log('[CategoriesRepo] Active category ready:', {
      activeId,
      name: activeCategory.name,
    });

    // Step 3: Move ALL thought_items that currently have pending_category_id=pendingId
    // First, count how many items will be moved
    const { data: itemsToMove, error: countError } = await supabase
      .from('thought_items')
      .select('id')
      .eq('pending_category_id', pendingId);

    if (countError) {
      console.error('[CategoriesRepo] Error counting thought items:', {
        pendingId,
        error: countError.message,
        errorCode: countError.code,
      });
      throw countError;
    }

    const movedCount = itemsToMove?.length || 0;
    console.log('[CategoriesRepo] Found thought items to move:', {
      pendingId,
      activeId,
      movedCount,
    });

    if (movedCount > 0) {
      // Update thought_items: set assigned_category_id=activeId and pending_category_id=NULL
      const { error: updateItemsError } = await supabase
        .from('thought_items')
        .update({
          assigned_category_id: activeId,
          pending_category_id: null,
        })
        .eq('pending_category_id', pendingId);

      if (updateItemsError) {
        console.error('[CategoriesRepo] Error moving thought items:', {
          pendingId,
          activeId,
          movedCount,
          error: updateItemsError.message,
          errorCode: updateItemsError.code,
        });
        throw updateItemsError;
      }

      console.log('[CategoriesRepo] Moved thought items:', {
        pendingId,
        activeId,
        movedCount,
      });
    }

    // Step 4: Update categories_active.thought_count by the number moved
    await incrementActiveCount(activeId, movedCount);

    console.log('[CategoriesRepo] Updated active category thought_count:', {
      activeId,
      movedCount,
    });

    // Step 5: Delete the pending category row after migration
    const { error: deleteError } = await supabase
      .from('categories_pending')
      .delete()
      .eq('id', pendingId);

    if (deleteError) {
      console.error('[CategoriesRepo] Error deleting pending category:', {
        pendingId,
        error: deleteError.message,
        errorCode: deleteError.code,
      });
      throw deleteError;
    }

    console.log('[CategoriesRepo] Deleted pending category:', { pendingId });

    // Final summary log
    console.log('[CategoriesRepo] Promotion completed successfully:', {
      pendingId,
      activeId,
      movedCount,
    });

    return { activeId };
  } catch (error) {
    console.error('[CategoriesRepo] Failed to promote pending to active:', {
      pendingId,
      error: (error as any)?.message ?? String(error),
      stack: (error as any)?.stack,
    });
    throw error;
  }
}

