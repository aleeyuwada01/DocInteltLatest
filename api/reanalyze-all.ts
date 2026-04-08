import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin, createUserClient } from '../src/lib/supabaseAdmin.js';

/**
 * Get all file IDs for re-analysis. The browser will then call upload-webhook for each.
 * POST /api/reanalyze-all
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.split(' ')[1];

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

  const userClient = createUserClient(token);

  // Get all files for this user
  const { data: files, error } = await userClient
    .from('files')
    .select('id, name, original_name, mime_type, size, storage_path, folder_id')
    .is('trashed_at', null)
    .order('created_at', { ascending: true });

  if (error || !files) {
    return res.status(500).json({ error: 'Failed to fetch files', details: error?.message });
  }

  res.status(200).json({ files });
}
