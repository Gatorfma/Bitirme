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
 */
function canonicalizeLabel(label: string): string {
  let canonical = label.trim();
  canonical = canonical
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  if (CANONICAL_VARIANTS[canonical]) {
    canonical = CANONICAL_VARIANTS[canonical];
  }
  return canonical;
}

/**
 * Run categorization pipeline for a session
 */
export async function runCategorizationForSession(sessionId: string): Promise<void> {
  const { data: sessionRow, error: sessionError } = await supabase
    .from('journal_sessions')
    .select('summary, thoughts, categorization_status')
    .eq('id', sessionId)
    .single();

  if (sessionError) throw sessionError;
  if (!sessionRow) throw new Error(`Session not found: ${sessionId}`);

  if (sessionRow.categorization_status === 'running' || sessionRow.categorization_status === 'done') {
    return;
  }

  const sessionSummary = sessionRow.summary || '';
  if (!sessionSummary || sessionSummary.trim().length === 0) return;

  await supabase
    .from('journal_sessions')
    .update({ categorization_status: 'running' })
    .eq('id', sessionId);

  try {
    const activeCategories = await getActiveCategories();
    const activeCategoryNames = activeCategories.map((cat) => cat.name);
    const activeCategoryMap = new Map<string, string>();
    activeCategories.forEach((cat) => activeCategoryMap.set(cat.name, cat.id));

    const pendingCategories = await getPendingCategories();
    const pendingCategoryNames = pendingCategories.map((cat) => cat.name);
    const pendingCategoryMap = new Map<string, { id: string; hit_count: number; threshold: number }>();
    pendingCategories.forEach((cat) => {
      pendingCategoryMap.set(cat.name, {
        id: cat.id,
        hit_count: cat.hit_count,
        threshold: cat.threshold,
      });
    });

    const { data: unassignedThoughts, error: thoughtsError } = await supabase
      .from('thought_items')
      .select('id, text, session_id, assigned_category_id, pending_category_id')
      .eq('session_id', sessionId)
      .is('assigned_category_id', null)
      .is('pending_category_id', null);

    if (thoughtsError) throw thoughtsError;
    if (!unassignedThoughts || unassignedThoughts.length === 0) return;

    for (const thoughtItem of unassignedThoughts as ThoughtItem[]) {
      try {
        const classification = await categorizeThought({
          sessionSummary,
          thoughtText: thoughtItem.text,
          activeCategoryNames,
          pendingCategoryNames,
        });

        if (classification.matchType === 'active') {
          const activeCategoryId = activeCategoryMap.get(classification.label);
          if (!activeCategoryId) continue;

          await supabase
            .from('thought_items')
            .update({ assigned_category_id: activeCategoryId })
            .eq('id', thoughtItem.id);

          await incrementActiveCount(activeCategoryId, 1);
        } else if (classification.matchType === 'pending') {
          const pendingCategoryInfo = pendingCategoryMap.get(classification.label);
          let pendingId: string;
          let currentHitCount: number;

          if (pendingCategoryInfo) {
            pendingId = pendingCategoryInfo.id;
            currentHitCount = pendingCategoryInfo.hit_count;
          } else {
            const foundPending = await findPendingCategoryByName(classification.label);
            if (!foundPending) continue;
            pendingId = foundPending.id;
            currentHitCount = foundPending.hit_count;
          }

          await supabase
            .from('thought_items')
            .update({ pending_category_id: pendingId })
            .eq('id', thoughtItem.id);

          const updatedPending = await incrementPendingHit(pendingId, sessionId);

          // Check if hit_count >= threshold → promote
          if (updatedPending.hit_count >= updatedPending.threshold) {
            await promotePendingToActive(pendingId);
          }
        } else {
          // PATH: New category
          const canonicalLabel = canonicalizeLabel(classification.label);
          const pendingCategory = await upsertPendingCategory(canonicalLabel);
          const pendingId = pendingCategory.id;

          if (!pendingCategoryMap.has(canonicalLabel)) {
            pendingCategoryMap.set(canonicalLabel, {
              id: pendingId,
              hit_count: pendingCategory.hit_count,
              threshold: pendingCategory.threshold,
            });
          }

          await supabase
            .from('thought_items')
            .update({ pending_category_id: pendingId })
            .eq('id', thoughtItem.id);

          const updatedPending = await incrementPendingHit(pendingId, sessionId);

          if (updatedPending.hit_count >= updatedPending.threshold) {
            await promotePendingToActive(pendingId);
          }
        }
      } catch (error) {
        console.error('[CategorizationPipeline] Error processing item:', error);
      }
    }

    await supabase
      .from('journal_sessions')
      .update({ categorization_status: 'done', categorization_error: null })
      .eq('id', sessionId);

  } catch (error) {
    const errorMessage = (error as any)?.message ?? String(error);
    await supabase
      .from('journal_sessions')
      .update({ categorization_status: 'error', categorization_error: errorMessage })
      .eq('id', sessionId);
    throw error;
  }
}
