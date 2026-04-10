import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../src/lib/supabaseAdmin.js';

export const maxDuration = 30;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { token } = req.query as { token: string };
  if (!token) return res.status(400).json({ error: 'Missing share token' });

  try {
    // 1. Validate token using service_role (bypasses RLS — safe because we check is_active + expiry)
    const { data: link, error: linkError } = await supabaseAdmin
      .from('share_links')
      .select('file_id, is_active, expires_at')
      .eq('token', token)
      .single();

    if (linkError || !link) {
      return res.status(404).json({ error: 'Share link not found' });
    }

    if (!link.is_active) {
      return res.status(410).json({ error: 'This share link has been revoked.' });
    }

    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return res.status(410).json({ error: 'This share link has expired.' });
    }

    // 2. Fetch file metadata using service_role
    const { data: file, error: fileError } = await supabaseAdmin
      .from('files')
      .select('id, original_name, size, mime_type, storage_path, trashed_at')
      .eq('id', link.file_id)
      .single();

    if (fileError || !file) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (file.trashed_at) {
      return res.status(410).json({ error: 'This file has been deleted.' });
    }

    // 3. Generate a signed URL server-side (2-hour window) using service_role key
    const { data: signedData, error: signedError } = await supabaseAdmin.storage
      .from('uploads')
      .createSignedUrl(file.storage_path, 7200);

    if (signedError || !signedData?.signedUrl) {
      return res.status(500).json({ error: 'Could not generate file access URL' });
    }

    // 4. Increment access count (best-effort, don't fail if this errors)
    supabaseAdmin
      .from('share_links')
      .update({ access_count: supabaseAdmin.rpc('increment_share_access', { share_token: token }) })
      .eq('token', token)
      .then();

    // 5. Increment via the existing RPC
    supabaseAdmin.rpc('increment_share_access', { share_token: token }).then();

    return res.status(200).json({
      file: {
        id: file.id,
        original_name: file.original_name,
        size: file.size,
        mime_type: file.mime_type,
      },
      signedUrl: signedData.signedUrl,
    });
  } catch (err: any) {
    console.error('[Share API] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
