import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.replace('Bearer ', '');

  // Verify the calling user
  const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !caller) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Check caller is admin
  const { data: callerProfile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .single();

  if (callerProfile?.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can manage departments' });
  }

  // ── GET: List departments created by this admin ──────────────────
  if (req.method === 'GET') {
    const { data: departments, error } = await supabaseAdmin
      .from('profiles')
      .select('id, username, role, created_at')
      .eq('parent_id', caller.id)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json(departments || []);
  }

  // ── POST: Create a new department sub-account ───────────────────
  if (req.method === 'POST') {
    const { username, password } = req.body;

    if (!username?.trim() || !password?.trim()) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Create email from username (username@docintel.dept)
    const email = `${username.toLowerCase().replace(/[^a-z0-9_-]/g, '')}@docintel.dept`;

    // Check if username already exists
    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', username.trim())
      .single();

    if (existing) {
      return res.status(409).json({ error: 'A department with this username already exists' });
    }

    // Create user in Supabase Auth
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm so they can log in immediately
      user_metadata: { username: username.trim() }
    });

    if (createError) {
      console.error('[Departments] Create user error:', createError);
      return res.status(500).json({ error: createError.message });
    }

    // Update the profile to link to parent and set role
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        username: username.trim(),
        role: 'department',
        parent_id: caller.id,
      })
      .eq('id', newUser.user.id);

    if (profileError) {
      console.error('[Departments] Profile update error:', profileError);
      // Clean up: delete the auth user since profile failed
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return res.status(500).json({ error: 'Failed to create department profile' });
    }

    return res.status(201).json({
      id: newUser.user.id,
      username: username.trim(),
      email,
      role: 'department',
      message: `Department "${username}" created successfully. They can log in with email: ${email}`
    });
  }

  // ── DELETE: Remove a department ────────────────────────────────
  if (req.method === 'DELETE') {
    const { departmentId } = req.body;
    if (!departmentId) {
      return res.status(400).json({ error: 'departmentId is required' });
    }

    // Verify it belongs to this admin
    const { data: dept } = await supabaseAdmin
      .from('profiles')
      .select('id, parent_id')
      .eq('id', departmentId)
      .eq('parent_id', caller.id)
      .single();

    if (!dept) {
      return res.status(404).json({ error: 'Department not found' });
    }

    // Delete from auth (cascade will handle profile)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(departmentId);
    if (deleteError) {
      return res.status(500).json({ error: deleteError.message });
    }

    return res.status(200).json({ message: 'Department deleted' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
