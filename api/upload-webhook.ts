import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin, createUserClient } from '../src/lib/supabaseAdmin.js';
import { parseDocument } from '../src/lib/llamaparse.js';
import { embedBatch } from '../src/lib/embeddings.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

export const maxDuration = 60; // Max allowed for Vercel Hobby

function chunkText(text: string, chunkSize = 2000, overlap = 200): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + chunkSize));
    i += chunkSize - overlap;
  }
  return chunks;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 1. Authenticate Request
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.split(' ')[1];
  
  // Verify user via admin client (JWT verification)
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

  // Create an authenticated client for DB operations (so auth.uid() works in RLS)
  const userClient = createUserClient(token);

  const { originalName, mimeType, size, storagePath, folderId, fileId } = req.body;

  let file;
  if (fileId) {
    // Re-analyzing an existing file
    const { data, error } = await userClient.from('files')
      .update({ parsing_status: 'parsing', parse_error: null })
      .eq('id', fileId)
      .select('*').single();
    
    if (error) {
      console.error('[Upload Webhook] DB update error:', error);
      return res.status(500).json({ error: 'Failed to update file in database', details: error.message });
    }
    
    // Clear old embeddings for this file
    await userClient.from('embeddings').delete().eq('file_id', fileId);
    file = data;
  } else {
    // 2. Track new File in DB (using user-authenticated client for RLS)
    const { data, error: insertError } = await userClient.from('files').insert({
      name: originalName,
      original_name: originalName,
      mime_type: mimeType,
      size: size,
      storage_path: storagePath,
      folder_id: folderId,
      owner_id: user.id,
      parsing_status: 'parsing'
    }).select('*').single();

    if (insertError) {
      console.error('[Upload Webhook] DB insert error:', insertError);
      return res.status(500).json({ error: 'Failed to record file in database', details: insertError.message });
    }
    file = data;
  }

  // --- Start Processing Pipeline ---
  try {
    // A. Download file from Supabase Storage (use user client so storage RLS passes)
    const { data: fileBlob, error: downloadError } = await userClient.storage.from('uploads').download(storagePath);
    if (downloadError || !fileBlob) {
      console.error('[Upload Webhook] Storage download error:', downloadError);
      throw new Error('Failed to retrieve file from storage');
    }
    
    // Convert blob to Buffer for LlamaParse
    const arrayBuffer = await fileBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let contentText = '';
    
    // B. LlamaParse extraction (or text fallback)
    if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
      contentText = buffer.toString('utf-8');
    } else {
      const tmpFile = path.join(os.tmpdir(), originalName);
      fs.writeFileSync(tmpFile, buffer);
      
      try {
        const parsed = await parseDocument(tmpFile, mimeType);
        contentText = parsed.markdown || parsed.text || '';
      } catch (err) {
         console.error('[Upload Webhook] LlamaParse error:', err);
      } finally {
        try { fs.unlinkSync(tmpFile); } catch {}
      }
    }

    if (!contentText) {
       contentText = `# ${originalName}\n\nCould not extract text.`;
    }

    // C. Embed Content
    await userClient.from('files').update({ parsing_status: 'embedding', parsed_markdown: contentText }).eq('id', file.id);
    
    const chunks = chunkText(contentText);
    
    try {
      const embedResults = await embedBatch(chunks);

      // Save Vector Embeddings to DB
      const embeddingsToInsert = embedResults.map((result, i) => ({
        file_id: file.id,
        text: chunks[i],
        embedding: result.values
      }));
      
      if (embeddingsToInsert.length > 0) {
        const { error: embedInsertError } = await userClient.from('embeddings').insert(embeddingsToInsert);
        if (embedInsertError) {
          console.error('[Upload Webhook] Embeddings insert error:', embedInsertError);
        }
      }
    } catch (embedErr: any) {
      console.error('[Upload Webhook] Embedding pipeline error:', embedErr.message);
      // Don't fail the whole upload if embedding fails — mark as completed with note
    }

    // D. Complete
    await userClient.from('files').update({ parsing_status: 'completed' }).eq('id', file.id);
    res.status(200).json({ success: true, file });

  } catch (error: any) {
    console.error('[Upload Webhook] Pipeline error:', error);
    await userClient.from('files').update({ parsing_status: 'error', parse_error: error.message }).eq('id', file.id);
    res.status(500).json({ error: 'Processing failed', details: error.message });
  }
}
