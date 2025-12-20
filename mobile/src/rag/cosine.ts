/**
 * Cosine Similarity Utilities
 * Vector math functions for similarity computation
 */

/**
 * Compute dot product of two vectors
 */
export function dot(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * Compute L2 norm (magnitude) of a vector
 */
export function norm(a: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * a[i];
  }
  return Math.sqrt(sum);
}

/**
 * Compute cosine similarity between two vectors
 * Returns 0 if either vector is zero (to avoid division by zero)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  const normA = norm(a);
  const normB = norm(b);

  // Handle zero vectors
  if (normA === 0 || normB === 0) {
    return 0;
  }

  const dotProduct = dot(a, b);
  return dotProduct / (normA * normB);
}

