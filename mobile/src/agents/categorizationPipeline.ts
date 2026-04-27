/**
 * Categorization Pipeline
 * Processes unassigned thought items and categorizes them
 */

import { supabase } from '../lib/supabase';
import { categorizeThought } from './categorizerAgent';
import {
  getActiveCategories,
  getPendingCategories,
  findPendingCategoryByName,
  upsertPendingCategory,
  incrementPendingHit,
  incrementActiveCount,
  promotePendingToActive,
} from '../repos/categoriesRepo';

type ThoughtItem = {
  id: string;
  text: string;
  session_id: string;
  assigned_category_id: string | null;
  pending_category_id: string | null;
};

/**
 * Canonical variant mapping for common category label variations
 * Maps similar labels to a canonical form
 */
const CANONICAL_VARIANTS: Record<string, string> = {
  'Feeling Overwhelmed': 'Overwhelm',
  'Emotional Overwhelm': 'Overwhelm',
  'Overwhelmed': 'Overwhelm',
  'Time Management Struggle': 'Time Pressure',
  'No Time': 'Time Pressure',
  'Time Pressure': 'Time Pressure',
  'Lack Of Time': 'Time Pressure',
};

/**
 * Canonicalize a category label
 * - Trim whitespace
 * - Convert to Title Case
 * - Normalize common variants using mapping
 */
function canonicalizeLabel(label: string): string {
  // Trim whitespace
  let canonical = label.trim();

  // Convert to Title Case (capitalize first letter of each word)
  canonical = canonical
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  // Normalize common variants
  if (CANONICAL_VARIANTS[canonical]) {
    canonical = CANONICAL_VARIANTS[canonical];
  }

  return canonical;
}

/**
 * Run categorization pipeline for a session
 * Implements lock mechanism using categorization_status to prevent concurrent runs
 * @param sessionId - Session ID to process
 */
export async function runCategorizationForSession(sessionId: string): Promise<void> {
  // Step 1: Load session row and check lock status
  const { data: sessionRow, error: sessionError } = await supabase
    .from('journal_sessions')
    .select('summary, thoughts, categorization_status')
    .eq('id', sessionId)
    .single();

  if (sessionError) {
    console.error('[CategorizationPipeline] Error loading session:', {
      sessionId,
      error: sessionError.message,
      errorCode: sessionError.code,
    });
    throw sessionError;
  }

  if (!sessionRow) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  // Check lock status - if already running or done, skip
  if (sessionRow.categorization_status === 'running' || sessionRow.categorization_status === 'done') {
    console.log('[CategorizationPipeline] Session categorization already in progress or completed:', {
      sessionId,
      status: sessionRow.categorization_status,
    });
    return;
  }

  const sessionSummary = sessionRow.summary || '';
  const sessionThoughts = (sessionRow.thoughts as Array<{ text: string; timestamp?: string }>) || [];

  console.log('[CategorizationPipeline] Loaded session:', {
    sessionId,
    summaryLength: sessionSummary.length,
    thoughtsCount: sessionThoughts.length,
    currentStatus: sessionRow.categorization_status,
  });

  if (!sessionSummary || sessionSummary.trim().length === 0) {
    console.log('[CategorizationPipeline] Session has no summary, skipping categorization');
    return;
  }

  // Step 2: Update status to 'running' (acquire lock)
  const { error: lockError } = await supabase
    .from('journal_sessions')
    .update({ categorization_status: 'running' })
    .eq('id', sessionId);

  if (lockError) {
    console.error('[CategorizationPipeline] Error setting status to running:', {
      sessionId,
      error: lockError.message,
      errorCode: lockError.code,
    });
    throw lockError;
  }

  console.log('[CategorizationPipeline] Lock acquired, status set to running:', { sessionId });

  // Step 3: Run categorization with try/finally to ensure status is always updated
  try {

    // Step 4: Load active categories (names + ids)
    const activeCategories = await getActiveCategories();
    const activeCategoryNames = activeCategories.map((cat) => cat.name);
    const activeCategoryMap = new Map<string, string>(); // name -> id
    activeCategories.forEach((cat) => {
      activeCategoryMap.set(cat.name, cat.id);
    });

    console.log('[CategorizationPipeline] Loaded active categories:', {
      count: activeCategoryNames.length,
      names: activeCategoryNames,
    });

    // Step 5: Load pending categories (names + ids + hit_count + threshold)
    const pendingCategories = await getPendingCategories();
    const pendingCategoryNames = pendingCategories.map((cat) => cat.name);
    const pendingCategoryMap = new Map<string, { id: string; hit_count: number; threshold: number }>(); // name -> {id, hit_count, threshold}
    pendingCategories.forEach((cat) => {
      pendingCategoryMap.set(cat.name, {
        id: cat.id,
        hit_count: cat.hit_count,
        threshold: cat.threshold,
      });
    });

    console.log('[CategorizationPipeline] Loaded pending categories:', {
      count: pendingCategoryNames.length,
      names: pendingCategoryNames,
      categories: pendingCategories.map((c) => ({
        name: c.name,
        hit_count: c.hit_count,
        threshold: c.threshold,
      })),
    });

    // Step 6: Fetch thought_items for that session where assigned_category_id is null AND pending_category_id is null
    const { data: unassignedThoughts, error: thoughtsError } = await supabase
      .from('thought_items')
      .select('id, text, session_id, assigned_category_id, pending_category_id')
      .eq('session_id', sessionId)
      .is('assigned_category_id', null)
      .is('pending_category_id', null);

    if (thoughtsError) {
      console.error('[CategorizationPipeline] Error fetching unassigned thoughts:', {
        sessionId,
        error: thoughtsError.message,
        errorCode: thoughtsError.code,
      });
      throw thoughtsError;
    }

    if (!unassignedThoughts || unassignedThoughts.length === 0) {
      console.log('[CategorizationPipeline] No unassigned thoughts found for session (all are already categorized or pending):', sessionId);
      return;
    }

    console.log('[CategorizationPipeline] Found unassigned thoughts:', {
      count: unassignedThoughts.length,
    });

    // Step 7: Process each thought_item
    let processedCount = 0;
    let activeAssignments = 0;
    let pendingAssignments = 0;
    let newCategoryAssignments = 0;
    let promotionsTriggered = 0;

    for (const thoughtItem of unassignedThoughts as ThoughtItem[]) {
      try {
        console.log('[CategorizationPipeline] Processing thought item:', {
          id: thoughtItem.id,
          text: thoughtItem.text.substring(0, 50),
        });

        // Call categorizeThought with BOTH active and pending category names
        const classification = await categorizeThought({
          sessionSummary,
          thoughtText: thoughtItem.text,
          activeCategoryNames,
          pendingCategoryNames,
        });

        console.log('[CategorizationPipeline] Classification result:', {
          thoughtItemId: thoughtItem.id,
          matchType: classification.matchType,
          label: classification.label,
          confidence: classification.confidence,
        });

        if (classification.matchType === 'active') {
          // PATH: Active category match
          console.log('[CategorizationPipeline] Taking ACTIVE path for:', {
            thoughtItemId: thoughtItem.id,
            categoryName: classification.label,
          });

          // Attach thought_item to active category
          const activeCategoryId = activeCategoryMap.get(classification.label);
          if (!activeCategoryId) {
            console.error('[CategorizationPipeline] Active category ID not found:', {
              label: classification.label,
              availableCategories: Array.from(activeCategoryMap.keys()),
            });
            continue; // Skip this item
          }

          // Update thought_items.assigned_category_id
          const { error: updateError } = await supabase
            .from('thought_items')
            .update({ assigned_category_id: activeCategoryId })
            .eq('id', thoughtItem.id);

          if (updateError) {
            console.error('[CategorizationPipeline] Error assigning to active category:', {
              thoughtItemId: thoughtItem.id,
              categoryId: activeCategoryId,
              error: updateError.message,
            });
            continue;
          }

          // Increment active category thought_count by 1
          await incrementActiveCount(activeCategoryId, 1);

          activeAssignments++;
          processedCount++;

          console.log('[CategorizationPipeline] ✓ Assigned to active category:', {
            thoughtItemId: thoughtItem.id,
            categoryId: activeCategoryId,
            categoryName: classification.label,
          });
        } else if (classification.matchType === 'pending') {
          // PATH: Pending category match
          console.log('[CategorizationPipeline] Taking PENDING path for:', {
            thoughtItemId: thoughtItem.id,
            categoryName: classification.label,
          });

          // Find that pending category by name (avoid duplicates)
          const pendingCategoryInfo = pendingCategoryMap.get(classification.label);
          let pendingId: string;
          let currentHitCount: number;
          let threshold: number;

          if (pendingCategoryInfo) {
            // Category already exists in our map
            pendingId = pendingCategoryInfo.id;
            currentHitCount = pendingCategoryInfo.hit_count;
            threshold = pendingCategoryInfo.threshold;
            console.log('[CategorizationPipeline] Found existing pending category:', {
              pendingId,
              currentHitCount,
              threshold,
            });
          } else {
            // Category might have been created after we loaded, find it
            const foundPending = await findPendingCategoryByName(classification.label);
            if (!foundPending) {
              console.error('[CategorizationPipeline] Pending category not found by name:', {
                label: classification.label,
                availablePending: Array.from(pendingCategoryMap.keys()),
              });
              continue; // Skip this item
            }
            pendingId = foundPending.id;
            currentHitCount = foundPending.hit_count;
            threshold = foundPending.threshold;
            console.log('[CategorizationPipeline] Found pending category via lookup:', {
              pendingId,
              currentHitCount,
              threshold,
            });
          }

          // Always attach thought_item to pending category first (so it appears in the pool)
          const { error: updateError } = await supabase
            .from('thought_items')
            .update({ pending_category_id: pendingId })
            .eq('id', thoughtItem.id);

          if (updateError) {
            console.error('[CategorizationPipeline] Error assigning to pending category:', {
              thoughtItemId: thoughtItem.id,
              pendingId,
              error: updateError.message,
            });
            continue;
          }

          // Call incrementPendingHit (session-aware, may skip if already hit by this session)
          const updatedPending = await incrementPendingHit(pendingId, sessionId);
          const hitIncremented = updatedPending.hit_count > currentHitCount;

          pendingAssignments++;
          processedCount++;

          console.log('[CategorizationPipeline] ✓ Assigned to pending category:', {
            thoughtItemId: thoughtItem.id,
            pendingId,
            categoryName: classification.label,
            hitIncremented,
            currentHitCount: updatedPending.hit_count,
            threshold: updatedPending.threshold,
          });

          // Check if hit_count >= threshold (5) using returned hit_count
          if (updatedPending.hit_count >= updatedPending.threshold) {
            console.log('[CategorizationPipeline] ⚡ Threshold reached, promoting category:', {
              pendingId,
              hitCount: updatedPending.hit_count,
              threshold: updatedPending.threshold,
            });

            // Promote pending to active
            const { activeId } = await promotePendingToActive(pendingId);

            promotionsTriggered++;

            console.log('[CategorizationPipeline] ✓ Category promoted successfully:', {
              pendingId,
              activeId,
            });
          }
        } else {
          // PATH: New category (matchType="new")
          console.log('[CategorizationPipeline] Taking NEW path for:', {
            thoughtItemId: thoughtItem.id,
            proposedLabel: classification.label,
          });

          // Canonicalize label before upserting
          const canonicalLabel = canonicalizeLabel(classification.label);
          console.log('[CategorizationPipeline] Canonicalized label:', {
            original: classification.label,
            canonical: canonicalLabel,
          });

          // Upsert pending category by canonical label (creates if missing, avoids duplicates)
          const pendingCategory = await upsertPendingCategory(canonicalLabel);
          const pendingId = pendingCategory.id;
          const initialHitCount = pendingCategory.hit_count;

          // Update our map so subsequent items in this batch can find it (use canonical label)
          if (!pendingCategoryMap.has(canonicalLabel)) {
            pendingCategoryMap.set(canonicalLabel, {
              id: pendingId,
              hit_count: pendingCategory.hit_count,
              threshold: pendingCategory.threshold,
            });
            console.log('[CategorizationPipeline] Added new category to map:', {
              name: canonicalLabel,
              id: pendingId,
            });
          }

          // Always attach thought_item to that pending category first (so it appears in the pool)
          const { error: updateError } = await supabase
            .from('thought_items')
            .update({ pending_category_id: pendingId })
            .eq('id', thoughtItem.id);

          if (updateError) {
            console.error('[CategorizationPipeline] Error assigning to new pending category:', {
              thoughtItemId: thoughtItem.id,
              pendingId,
              error: updateError.message,
            });
            continue;
          }

          // Call incrementPendingHit (session-aware, may skip if already hit by this session)
          const updatedPending = await incrementPendingHit(pendingId, sessionId);
          const hitIncremented = updatedPending.hit_count > initialHitCount;

          newCategoryAssignments++;
          processedCount++;

          console.log('[CategorizationPipeline] ✓ Created and assigned to new pending category:', {
            thoughtItemId: thoughtItem.id,
            pendingId,
            categoryName: canonicalLabel,
            originalLabel: classification.label,
            hitIncremented,
            currentHitCount: updatedPending.hit_count,
            threshold: updatedPending.threshold,
          });

          // Check if hit_count >= threshold → promote (using returned hit_count)
          if (updatedPending.hit_count >= updatedPending.threshold) {
            console.log('[CategorizationPipeline] ⚡ Threshold reached for new category, promoting:', {
              pendingId,
              hitCount: updatedPending.hit_count,
              threshold: updatedPending.threshold,
            });

            // Promote pending to active
            const { activeId } = await promotePendingToActive(pendingId);

            promotionsTriggered++;

            console.log('[CategorizationPipeline] ✓ New category promoted successfully:', {
              pendingId,
              activeId,
            });
          }
        }
      } catch (error) {
        console.error('[CategorizationPipeline] Error processing thought item:', {
          thoughtItemId: thoughtItem.id,
          error: (error as any)?.message ?? String(error),
          stack: (error as any)?.stack,
        });
        // Continue with next item instead of failing entire pipeline
      }
    }

    // Final summary log
    console.log('[CategorizationPipeline] Pipeline completed successfully:', {
      sessionId,
      processedThoughtCount: processedCount,
      activeAssignments,
      pendingAssignments,
      newCategoryAssignments,
      promotionsTriggered,
    });

    // Step 8: On success, set status to 'done'
    const { error: successStatusError } = await supabase
      .from('journal_sessions')
      .update({
        categorization_status: 'done',
        categorization_error: null, // Clear any previous error
      })
      .eq('id', sessionId);

    if (successStatusError) {
      console.error('[CategorizationPipeline] Error setting status to done:', {
        sessionId,
        error: successStatusError.message,
      });
      // Don't throw - categorization succeeded, just status update failed
    } else {
      console.log('[CategorizationPipeline] Status set to done:', { sessionId });
    }
  } catch (error) {
    // Step 9: On error, set status to 'error' and write categorization_error
    const errorMessage = (error as any)?.message ?? String(error);
    const errorStack = (error as any)?.stack;

    console.error('[CategorizationPipeline] Categorization failed, setting error status:', {
      sessionId,
      error: errorMessage,
    });

    const { error: errorStatusError } = await supabase
      .from('journal_sessions')
      .update({
        categorization_status: 'error',
        categorization_error: errorMessage,
      })
      .eq('id', sessionId);

    if (errorStatusError) {
      console.error('[CategorizationPipeline] Error setting status to error:', {
        sessionId,
        statusError: errorStatusError.message,
        originalError: errorMessage,
      });
    } else {
      console.log('[CategorizationPipeline] Status set to error:', {
        sessionId,
        errorMessage,
      });
    }

    // Re-throw the original error
    throw error;
  }
}

