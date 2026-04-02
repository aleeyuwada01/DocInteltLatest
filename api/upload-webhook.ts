import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../src/lib/supabaseAdmin.js';
import { GoogleGenAI } from '@google/genai';
import { parseDocument } from '../src/lib/llamaparse.js';
import { embedBatch } from '../src/lib/embeddings.js';

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
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

  const { originalName, mimeType, size, storagePath, folderId } = req.body;

  // 2. Track File in DB
  const { data: file, error: insertError } = await supabaseAdmin.from('files').insert({
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
    return res.status(500).json({ error: 'Failed to record file in database' });
  }

  // --- Start Processing Pipeline ---
  try {
    // A. Download file from Supabase Storage
    const { data: fileBlob, error: downloadError } = await supabaseAdmin.storage.from('uploads').download(storagePath);
    if (downloadError || !fileBlob) throw new Error('Failed to retrieve file from storage');
    
    // Convert blob to Buffer for LlamaParse / Gemini
    const arrayBuffer = await fileBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let contentText = '';
    
    // B. LlamaParse extraction (or text fallback)
    if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
      contentText = buffer.toString('utf-8');
    } else {
      // Actually we have to save it to /tmp temporarily for LlamaParse or pass buffer if supported.
      // But llamaparse in lib expects a file path. Let's write to /tmp.
      const fs = require('fs');
      const os = require('os');
      const path = require('path');
      const tmpFile = path.join(os.tmpdir(), originalName);
      fs.writeFileSync(tmpFile, buffer);
      
      try {
        const parsed = await parseDocument(tmpFile, mimeType);
        contentText = parsed.markdown || parsed.text || '';
      } catch (err) {
         console.error('LlamaParse error:', err);
      } finally {
        try { fs.unlinkSync(tmpFile); } catch {}
      }
    }

    if (!contentText) {
       contentText = `# ${originalName}\n\nCould not extract text.`;
    }

    // C. Embed Content
    await supabaseAdmin.from('files').update({ parsing_status: 'embedding', parsed_markdown: contentText }).eq('id', file.id);
    
    const chunks = chunkText(contentText);
    const embedResults = await embedBatch(chunks);

    // Save Vector Embeddings to DB
    const embeddingsToInsert = embedResults.map((result, i) => ({
      file_id: file.id,
      text: chunks[i],
      embedding: result.values
    }));
    
    if (embeddingsToInsert.length > 0) {
       await supabaseAdmin.from('embeddings').insert(embeddingsToInsert);
    }

    // D. Complete
    await supabaseAdmin.from('files').update({ parsing_status: 'completed' }).eq('id', file.id);
    res.status(200).json({ success: true, file });

  } catch (error: any) {
    console.error('Webhook error:', error);
    await supabaseAdmin.from('files').update({ parsing_status: 'error', parse_error: error.message }).eq('id', file.id);
    res.status(500).json({ error: 'Processing failed', details: error.message });
  }
}
