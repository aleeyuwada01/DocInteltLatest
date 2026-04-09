import { supabase } from './supabaseClient';

export async function logActivity(userId: string, fileId: string | null, action: string, details: any = {}) {
  if (!userId) return;

  try {
    const entityName = details.originalName || details.newName || details.targetFolderName || 'Unknown File';
    const normalizedAction = action.replace(/_file$/, '');

    const { error } = await supabase.from('activity_log').insert({
      user_id: userId,
      action: normalizedAction,
      entity_type: 'file',
      entity_id: fileId,
      entity_name: entityName,
      metadata: details
    });

    if (error) {
      console.error('[ActivityLog] Failed to insert activity:', error.message);
    }
  } catch (e: any) {
    console.error('[ActivityLog] Exception during insertion:', e.message);
  }
}
