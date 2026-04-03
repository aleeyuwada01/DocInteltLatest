import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../src/lib/supabaseAdmin.js';
import { embedText } from '../src/lib/embeddings.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });

  try {
    const result = await embedText(text);
    res.json({ embedding: result.values });
  } catch (err: any) {
    console.error('[Embed API] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
