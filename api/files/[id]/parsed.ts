import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin, createUserClient } from '../../../src/lib/supabaseAdmin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

  const userClient = createUserClient(token);
  const fileId = req.query.id as string;
  if (!fileId) return res.status(400).json({ error: 'File ID is required' });

  const { data: file, error } = await userClient
    .from('files')
    .select('id, original_name, parsing_status, parsed_markdown, parsed_text, parse_error')
    .eq('id', fileId)
    .single();

  if (error || !file) return res.status(404).json({ error: 'File not found' });

  res.json(file);
}
