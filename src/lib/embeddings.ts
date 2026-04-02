/**
 * Gemini Embeddings via REST API (v1)
 * 
 * The @google/genai SDK uses v1beta which doesn't support embedding models.
 * This module calls the v1 endpoint directly to get text embeddings.
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const EMBED_MODEL = 'gemini-embedding-2-preview';
const EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${GEMINI_API_KEY}`;

export interface EmbeddingResult {
  values: number[];
}

/**
 * Generate an embedding vector for a single text string.
 */
export async function embedText(text: string): Promise<EmbeddingResult> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  // Truncate very long text to avoid token limits (8192 token limit ≈ ~30k chars)
  const truncated = text.length > 25000 ? text.substring(0, 25000) : text;

  const res = await fetch(EMBED_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${EMBED_MODEL}`,
      content: {
        parts: [{ text: truncated }],
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Embedding failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const values = data.embedding?.values || [];

  if (values.length === 0) {
    throw new Error('Embedding returned empty vector');
  }

  return { values };
}

/**
 * Generate embeddings for multiple text chunks.
 * Uses sequential calls with rate-limit-aware delays.
 */
export async function embedBatch(
  chunks: string[],
  options?: { delayMs?: number; onProgress?: (done: number, total: number) => void }
): Promise<EmbeddingResult[]> {
  const results: EmbeddingResult[] = [];
  const delayMs = options?.delayMs ?? 100; // small delay to avoid rate limiting

  for (let i = 0; i < chunks.length; i++) {
    try {
      const result = await embedText(chunks[i]);
      results.push(result);
    } catch (err: any) {
      console.error(`[Embeddings] Chunk ${i + 1}/${chunks.length} failed: ${err.message}`);
      results.push({ values: [] }); // empty placeholder so indices stay aligned
    }

    options?.onProgress?.(i + 1, chunks.length);

    // Rate limit protection
    if (i < chunks.length - 1 && delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return results;
}
