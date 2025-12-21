/**
 * OpenAI Embeddings API
 * Wrapper for OpenAI text-embedding API with batching support
 */

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings';
const BATCH_SIZE = 16; // Process 16 texts per API request

/**
 * Embed a single text string
 */
export async function embedText(text: string): Promise<number[]> {
  console.log('[Embeddings] Embedding single text, length:', text.length);

  if (!OPENAI_API_KEY) {
    console.error('[Embeddings] API key is not configured');
    throw new Error('OpenAI API key is not configured');
  }

  const response = await fetch(OPENAI_EMBEDDINGS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  console.log('[Embeddings] Response status:', response.status, response.statusText);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[Embeddings] API error:', {
      status: response.status,
      statusText: response.statusText,
      error: errorData,
    });
    throw new Error(
      errorData.error?.message || `OpenAI API error: ${response.statusText}`
    );
  }

  const data = await response.json();
  const embedding = data.data?.[0]?.embedding;

  if (!embedding || !Array.isArray(embedding)) {
    console.error('[Embeddings] No embedding in response');
    throw new Error('No embedding returned from OpenAI');
  }

  console.log('[Embeddings] Success! Embedding dimension:', embedding.length);
  return embedding;
}

/**
 * Embed multiple texts with batching
 * Processes texts in batches to avoid rate limits
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  console.log('[Embeddings] Embedding batch, total texts:', texts.length);
  console.log('[Embeddings] API key configured:', !!OPENAI_API_KEY);

  if (!OPENAI_API_KEY) {
    console.error('[Embeddings] API key is not configured');
    throw new Error('OpenAI API key is not configured');
  }

  const results: number[][] = [];

  // Process in batches
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    console.log(
      `[Embeddings] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}, size: ${batch.length}`
    );

    const response = await fetch(OPENAI_EMBEDDINGS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: batch,
      }),
    });

    console.log('[Embeddings] Batch response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Embeddings] Batch API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });
      throw new Error(
        errorData.error?.message || `OpenAI API error: ${response.statusText}`
      );
    }

    const data = await response.json();
    const embeddings = data.data;

    if (!embeddings || !Array.isArray(embeddings)) {
      console.error('[Embeddings] No embeddings in batch response');
      throw new Error('No embeddings returned from OpenAI');
    }

    // Sort embeddings by index to maintain order (OpenAI returns them in order)
    const sortedEmbeddings = embeddings
      .sort((a, b) => a.index - b.index)
      .map((item: { embedding: number[] }) => item.embedding);

    results.push(...sortedEmbeddings);
    console.log(
      `[Embeddings] Batch complete, total embeddings so far: ${results.length}`
    );
  }

  console.log('[Embeddings] Batch embedding complete! Total:', results.length);
  return results;
}

