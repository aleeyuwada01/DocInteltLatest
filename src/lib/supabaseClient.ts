import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase credentials are not set in environment variables");
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    storage: localStorage,          // WHERE tokens are stored — survives page refresh
    persistSession: true,           // ENABLE persistence to localStorage
    autoRefreshToken: true,         // AUTO-RENEW expired tokens silently
  },
});

/**
 * Map Supabase snake_case rows to frontend camelCase for consistency.
 */
export function mapFile(row: any): any {
  if (!row) return row;
  return {
    ...row,
    id: row.id,
    name: row.name,
    originalName: row.original_name ?? row.originalName,
    mimeType: row.mime_type ?? row.mimeType,
    size: row.size,
    storagePath: row.storage_path ?? row.storagePath,
    markdown: row.markdown,
    parsedMarkdown: row.parsed_markdown ?? row.parsedMarkdown,
    parsedText: row.parsed_text ?? row.parsedText,
    parseError: row.parse_error ?? row.parseError,
    parsing_status: row.parsing_status,
    fileHash: row.file_hash ?? row.fileHash,
    folderId: row.folder_id ?? row.folderId,
    ownerId: row.owner_id ?? row.ownerId,
    sharedWith: row.shared_with ?? row.sharedWith,
    createdAt: row.created_at ?? row.createdAt,
    trashedAt: row.trashed_at ?? row.trashedAt,
    starred_at: row.starred_at,
    last_opened_at: row.last_opened_at,
  };
}

export function mapFolder(row: any): any {
  if (!row) return row;
  return {
    ...row,
    id: row.id,
    name: row.name,
    parentId: row.parent_id ?? row.parentId,
    ownerId: row.owner_id ?? row.ownerId,
    sharedWith: row.shared_with ?? row.sharedWith,
    createdAt: row.created_at ?? row.createdAt,
    trashedAt: row.trashed_at ?? row.trashedAt,
  };
}
