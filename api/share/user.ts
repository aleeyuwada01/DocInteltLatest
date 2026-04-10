import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin, createUserClient } from '../../src/lib/supabaseAdmin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.split(' ')[1];

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

  const userClient = createUserClient(token);

  const { fileId, targetEmail, action } = req.body;

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

    // Look up emails by UUID from public.profiles or auth.users?
    // Let's use supabaseAdmin to fetch auth.users (requires service_role)
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.listUsers();
    
    if (authErr) {
      console.error('Error fetching users:', authErr);
      return res.status(500).json({ error: 'Failed to retrieve user list' });
    }

    const sharedUsers = (authData.users as any[])
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
  if (targetAuthErr) return res.status(500).json({ error: 'Error querying users' });

  const targetUser = (targetAuthData.users as any[]).find(u => u.email?.toLowerCase() === targetEmail.toLowerCase());
  
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

}
