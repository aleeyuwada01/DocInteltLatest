import type { VercelRequest, VercelResponse } from '@vercel/node';
import { embedText } from '../src/lib/embeddings.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    llamaparse: { status: 'unknown', message: '' },
    gemini: { status: 'unknown', message: '' },
    queue: { inProgress: 0, totalFiles: 0, completed: 0, parsing: 0, errored: 0 }
  };

  // Test LlamaParse v2
  try {
    if (!process.env.LLAMA_CLOUD_API_KEY) throw new Error('LLAMA_CLOUD_API_KEY is not set');
    const llamaRes = await fetch('https://api.cloud.llamaindex.ai/api/v2/parse?page_size=1', {
      headers: { Authorization: `Bearer ${process.env.LLAMA_CLOUD_API_KEY}`, accept: 'application/json' },
    });
    if (!llamaRes.ok) throw new Error(`API returned ${llamaRes.status}`);
    results.llamaparse = { status: 'ok', message: 'Connected to LlamaCloud v2 API' };
  } catch (err: any) {
    results.llamaparse = { status: 'error', message: err.message };
  }

  // Test Gemini Embeddings
  try {
    if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');
    const embedResult = await embedText('health check');
    const dim = embedResult.values.length;
    results.gemini = { status: 'ok', message: `Embedding model responding (${dim}-dim vectors)`, model: 'gemini-embedding-2-preview' };
  } catch (err: any) {
    results.gemini = { status: 'error', message: err.message };
  }

  const overallOk = results.llamaparse.status === 'ok' && results.gemini.status === 'ok';
  res.status(overallOk ? 200 : 207).json(results);
}
