import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../src/lib/supabaseAdmin.js';
import { embedText } from '../src/lib/embeddings.js';

export const maxDuration = 60; // Max allowed for Vercel Hobby

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

  const { query, folderId } = req.body;
  if (!query) return res.status(400).json({ error: 'Query isREQUIRED' });

  try {
    const embedResult = await embedText(query);
    const embedding = embedResult.values;

    // Vector Similarity using Supabase pgvector using the `match_embeddings` RPC.
    // If you haven't created the RPC, we will need to create it!
    const { data: results, error: searchError } = await supabaseAdmin.rpc('match_embeddings', {
      query_embedding: embedding,
      match_threshold: 0.5,
      match_count: 5,
      filter_owner_id: user.id
    });

    if (searchError) throw searchError;

    const context = (results || []).map((r: any) => r.text).join('\n\n---\n\n');
    const sourceFiles = (results || []).map((r: any) => ({
      id: r.file_id,
      originalName: r.original_name
    }));

    res.json({ context, sourceFiles });
  } catch (error: any) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed', details: error.message });
  }
}
