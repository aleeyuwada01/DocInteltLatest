import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin, createUserClient } from '../../src/lib/supabaseAdmin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
    const tokenParts = authHeader.split(' ');
    const token = tokenParts.length > 1 ? tokenParts[1] : '';
    if (!token || token === 'undefined') return res.status(401).json({ error: 'Invalid token signature' });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Invalid token user verification' });

    const userClient = createUserClient(token);

    const { fileId, targetEmail, action } = req.body || {};

    if (!fileId) return res.status(400).json({ error: 'Missing fileId' });
    if (!['add', 'remove', 'list'].includes(action)) return res.status(400).json({ error: 'Invalid action' });

    // Verify ownership
    const { data: file, error: fileError } = await userClient
      .from('files')
      .select('id, owner_id, shared_with')
      .eq('id', fileId)
      .single();

    if (fileError || !file) return res.status(404).json({ error: 'File not found or no permission' });
    if (file.owner_id !== user.id) return res.status(403).json({ error: 'Only the file owner can modify shares' });

    const currentSharedWith: string[] = file.shared_with || [];

    if (action === 'list') {
      if (currentSharedWith.length === 0) return res.json({ users: [] });

      // Look up emails by UUID
      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.listUsers();
      
      if (authErr) {
        console.error('Error fetching users:', authErr);
        // Fallback: just return the UUIDs if we can't fetch emails
        return res.json({ users: currentSharedWith.map(id => ({ id, email: 'Hidden (Admin Rights Req)' })) });
      }

      const sharedUsers = (authData?.users || [])
        .filter(u => currentSharedWith.includes(u.id))
        .map(u => ({ id: u.id, email: u.email }));

      return res.json({ users: sharedUsers });
    }

    // Common checks for ADD and REMOVE
    if (!targetEmail || typeof targetEmail !== 'string') {
      return res.status(400).json({ error: 'Missing targetEmail' });
    }

    if (targetEmail.toLowerCase() === user.email?.toLowerCase()) {
      return res.status(400).json({ error: 'You automatically have access to your own files' });
    }

    // Lookup target user ID by email via admin API
    const { data: targetAuthData, error: targetAuthErr } = await supabaseAdmin.auth.admin.listUsers();
    if (targetAuthErr) {
      console.error('targetAuthErr:', targetAuthErr);
      return res.status(500).json({ error: 'System error: Cannot list users without service_role key configured.' });
    }

    const targetUser = (targetAuthData?.users || []).find((u: any) => u.email?.toLowerCase() === targetEmail.toLowerCase());
    
    if (!targetUser) {
      return res.status(404).json({ error: 'User does not exist in the system' });
    }
    const targetUserId = targetUser.id;

    if (action === 'add') {
      if (currentSharedWith.includes(targetUserId)) {
        return res.status(400).json({ error: 'File is already shared with this user' });
      }

      const { error: updateError } = await userClient
        .from('files')
        .update({ shared_with: [...currentSharedWith, targetUserId] })
        .eq('id', fileId);

      if (updateError) return res.status(500).json({ error: 'Failed to update file share' });

      return res.json({ success: true, message: 'File shared successfully', addedUser: { id: targetUserId, email: targetUser.email } });
    }

    if (action === 'remove') {
      if (!currentSharedWith.includes(targetUserId)) {
        return res.status(400).json({ error: 'File is not shared with this user' });
      }

      const newSharedWith = currentSharedWith.filter(f => f !== targetUserId);

      const { error: updateError } = await userClient
        .from('files')
        .update({ shared_with: newSharedWith })
        .eq('id', fileId);

      if (updateError) return res.status(500).json({ error: 'Failed to update file share' });

      return res.json({ success: true, message: 'Access revoked successfully', removedUserId: targetUserId });
    }
  } catch (err: any) {
    console.error('Unhandled API Error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
