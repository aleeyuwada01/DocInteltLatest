import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

  const { fileIdA, fileIdB } = req.body;
  if (!fileIdA || !fileIdB) return res.status(400).json({ error: 'Two file IDs are required (fileIdA, fileIdB)' });

  // Fetch both files
  const [resA, resB] = await Promise.all([
    supabaseAdmin.from('files').select('id, original_name, mime_type, parsed_markdown, parsed_text, ai_description').eq('id', fileIdA).eq('owner_id', user.id).single(),
    supabaseAdmin.from('files').select('id, original_name, mime_type, parsed_markdown, parsed_text, ai_description').eq('id', fileIdB).eq('owner_id', user.id).single(),
  ]);

  if (resA.error || !resA.data) return res.status(404).json({ error: `File A not found: ${resA.error?.message}` });
  if (resB.error || !resB.data) return res.status(404).json({ error: `File B not found: ${resB.error?.message}` });

  const fileA = resA.data;
  const fileB = resB.data;

  const contentA = fileA.parsed_markdown || fileA.parsed_text || fileA.ai_description || '(No content extracted)';
  const contentB = fileB.parsed_markdown || fileB.parsed_text || fileB.ai_description || '(No content extracted)';

  const prompt = `You are a document comparison expert. Compare the following two documents and provide a clear, structured analysis.

DOCUMENT A: "${fileA.original_name}" (${fileA.mime_type || 'unknown type'})
---
${contentA.substring(0, 8000)}
---

DOCUMENT B: "${fileB.original_name}" (${fileB.mime_type || 'unknown type'})
---
${contentB.substring(0, 8000)}
---

Provide a comparison with the following sections:
## Summary
A brief 2-3 sentence overview of how these documents relate to each other.

## Similarities
- List the key things both documents have in common

## Differences
- List the key differences between them

## Key Insights
- Any notable observations, patterns, or recommendations

Be concise and use bullet points. Format in Markdown.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-04-17',
      contents: prompt,
    });

    const comparisonText = response.text || 'Could not generate comparison.';

    return res.status(200).json({
      comparison: comparisonText,
      fileA: { id: fileA.id, name: fileA.original_name, type: fileA.mime_type },
      fileB: { id: fileB.id, name: fileB.original_name, type: fileB.mime_type },
    });
  } catch (err: any) {
    console.error('[Compare] Gemini error:', err.message);
    return res.status(500).json({ error: 'AI comparison failed: ' + err.message });
  }
}
