import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin, createUserClient } from '../src/lib/supabaseAdmin.js';
import { parseDocument, unwrapParsedContent } from '../src/lib/llamaparse.js';
import { embedBatch } from '../src/lib/embeddings.js';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import os from 'os';
import path from 'path';

export const maxDuration = 60; // Max allowed for Vercel Hobby

function chunkText(text: string, chunkSize = 2000, overlap = 200): string[] {
  const chunks: string[] = [];
  if (!text || text.trim().length === 0) return chunks;
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + chunkSize));
    i += chunkSize - overlap;
  }
  return chunks;
}

/**
 * Use Gemini to generate a rich semantic description of file content.
 * For images: uses Gemini Vision with the actual image data.
 * For documents: summarizes the extracted text.
 */
async function generateAIDescription(
  fileName: string,
  mimeType: string,
  contentText: string,
  fileBuffer?: Buffer
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    console.warn('[AI Description] No GEMINI_API_KEY — skipping description');
    return '';
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const isImage = mimeType.startsWith('image/');

    if (isImage && fileBuffer) {
      // Use Gemini Vision for images — send the actual image data
      const base64Image = fileBuffer.toString('base64');
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Image,
                },
              },
              {
                text: `Analyze this image file named "${fileName}" and generate a detailed, searchable description. Include:
1. What the image shows (objects, people, text, logos, designs, charts, etc.)
2. Colors, style, and visual characteristics
3. Any text visible in the image (OCR)
4. The likely purpose/category of this image (logo, photo, screenshot, document scan, diagram, etc.)
5. Keywords that someone might use to search for this file

Format: Write a natural paragraph description followed by a line with "Keywords:" and relevant search terms.
Keep the total description under 500 words.`,
              },
            ],
          },
        ],
      });

      return response.text || '';
    } else {
      // For documents — summarize the text content
      const textPreview = contentText.substring(0, 8000); // Keep within token limits
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Analyze this document named "${fileName}" and generate a detailed, searchable description.

Document content:
---
${textPreview}
---

Generate:
1. A brief summary of what this document is about (1-2 sentences)
2. The type/category of document (invoice, letter, report, contract, manual, etc.)
3. Key entities mentioned (people, companies, dates, amounts, locations)
4. The likely purpose and audience
5. Keywords that someone might use to search for this file

Format: Write a natural paragraph description followed by a line with "Keywords:" and relevant search terms.
Keep the total description under 500 words.`,
      });

      return response.text || '';
    }
  } catch (err: any) {
    console.error('[AI Description] Gemini error:', err.message);
    return '';
  }
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
    const effectiveStoragePath = storagePath || file.storage_path;
    const effectiveMimeType = mimeType || file.mime_type;
    const effectiveOriginalName = originalName || file.original_name || file.name;

    const { data: fileBlob, error: downloadError } = await userClient.storage.from('uploads').download(effectiveStoragePath);
    if (downloadError || !fileBlob) {
      console.error('[Upload Webhook] Storage download error:', downloadError);
      throw new Error('Failed to retrieve file from storage');
    }
    
    // Convert blob to Buffer
    const arrayBuffer = await fileBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let contentText = '';
    
    // B. Content extraction
    if (effectiveMimeType === 'text/plain' || effectiveMimeType === 'text/markdown') {
      contentText = buffer.toString('utf-8');
    } else {
      const tmpFile = path.join(os.tmpdir(), effectiveOriginalName);
      fs.writeFileSync(tmpFile, buffer);
      
      try {
        const parsed = await parseDocument(tmpFile, effectiveMimeType);
        // Use the raw result — unwrap any JSON wrapping
        contentText = unwrapParsedContent(parsed.markdown) || unwrapParsedContent(parsed.text) || '';
      } catch (err) {
         console.error('[Upload Webhook] LlamaParse error:', err);
      } finally {
        try { fs.unlinkSync(tmpFile); } catch {}
      }
    }

    // C. If LlamaParse returned empty or placeholder, ensure we still have something for images
    const isImage = effectiveMimeType?.startsWith('image/');
    
    if (!contentText || contentText.includes('Could not extract text')) {
      if (isImage) {
        // For images with no text, that's fine — AI description will handle it
        contentText = `[Image file: ${effectiveOriginalName}]`;
      } else {
        contentText = `# ${effectiveOriginalName}\n\nDocument content could not be extracted via parsing.`;
      }
    }

    console.log(`[Upload Webhook] Extracted content: ${contentText.length} chars`);

    // D. Generate AI Description using Gemini
    await userClient.from('files').update({ 
      parsing_status: 'analyzing',
      parsed_markdown: contentText 
    }).eq('id', file.id);

    let aiDescription = '';
    try {
      aiDescription = await generateAIDescription(
        effectiveOriginalName,
        effectiveMimeType,
        contentText,
        isImage ? buffer : undefined
      );
      console.log(`[Upload Webhook] AI Description generated: ${aiDescription.length} chars`);
    } catch (descErr: any) {
      console.error('[Upload Webhook] AI Description failed:', descErr.message);
    }

    // Save AI description to DB
    if (aiDescription) {
      await userClient.from('files').update({ ai_description: aiDescription }).eq('id', file.id);
    }

    // E. Embed Content — include AI description as high-priority first chunk
    await userClient.from('files').update({ parsing_status: 'embedding' }).eq('id', file.id);
    
    const allChunks: string[] = [];

    // Add AI description as the FIRST chunk (highest search priority)
    if (aiDescription) {
      // Prefix with file name for context
      allChunks.push(`[File: ${effectiveOriginalName}]\n\n${aiDescription}`);
    }

    // Add a file-name-only chunk for direct name searches
    allChunks.push(`File name: ${effectiveOriginalName}. Type: ${effectiveMimeType}. ${aiDescription ? 'AI analysis available.' : ''}`);

    // Add content text chunks  
    if (contentText && contentText.length > 10 && !contentText.startsWith('[Image file:')) {
      const textChunks = chunkText(contentText);
      allChunks.push(...textChunks);
    }

    console.log(`[Upload Webhook] Embedding ${allChunks.length} chunks for ${effectiveOriginalName}`);
    
    try {
      const embedResults = await embedBatch(allChunks);

      // Save Vector Embeddings to DB — filter out empty embeddings
      const embeddingsToInsert = embedResults
        .map((result, i) => ({
          file_id: file.id,
          text: allChunks[i],
          embedding: result.values
        }))
        .filter(e => e.embedding && e.embedding.length > 0);
      
      if (embeddingsToInsert.length > 0) {
        const { error: embedInsertError } = await userClient.from('embeddings').insert(embeddingsToInsert);
        if (embedInsertError) {
          console.error('[Upload Webhook] Embeddings insert error:', embedInsertError);
          // Try with admin client as fallback (in case RLS blocks)
          const { error: adminInsertError } = await supabaseAdmin.from('embeddings').insert(embeddingsToInsert);
          if (adminInsertError) {
            console.error('[Upload Webhook] Admin embeddings insert also failed:', adminInsertError);
          } else {
            console.log(`[Upload Webhook] ✓ Saved ${embeddingsToInsert.length} embeddings via admin client`);
          }
        } else {
          console.log(`[Upload Webhook] ✓ Saved ${embeddingsToInsert.length} embeddings`);
        }
      } else {
        console.warn('[Upload Webhook] No valid embeddings produced — skipping insert');
      }
    } catch (embedErr: any) {
      console.error('[Upload Webhook] Embedding pipeline error:', embedErr.message);
      // Don't fail the whole upload if embedding fails — mark as completed with note
    }

    // F. Complete
    await userClient.from('files').update({ parsing_status: 'completed' }).eq('id', file.id);
    res.status(200).json({ success: true, file, ai_description: aiDescription ? 'generated' : 'skipped' });

  } catch (error: any) {
    console.error('[Upload Webhook] Pipeline error:', error);
    await userClient.from('files').update({ parsing_status: 'error', parse_error: error.message }).eq('id', file.id);
    res.status(500).json({ error: 'Processing failed', details: error.message });
  }
}
