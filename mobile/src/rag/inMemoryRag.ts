/**
 * In-Memory RAG Implementation
 * Temporarily disabled - will be replaced with Supabase dataset fetch
 */

import type { RagHit } from './types';

/**
 * Initialize RAG
 * Currently disabled - no-op
 */
export async function initRag(): Promise<void> {
  console.log('[RAG] RAG is temporarily disabled - waiting for Supabase implementation');
}

/**
 * Retrieve top K most similar documents for a query
 * Temporarily disabled - returns empty array
 * Interface preserved for future Supabase implementation
 */
export async function retrieve(query: string, topK: number = 4): Promise<RagHit[]> {
  console.log('[RAG] RAG is temporarily disabled - returning empty results');
  console.log('[RAG] Query:', query.substring(0, 50) + '...');
  console.log('[RAG] Top K:', topK);
  
  // Return empty array - RAG temporarily disabled
  return [];
}

