import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../src/lib/supabaseAdmin.js';
import { GoogleGenAI } from '@google/genai';

export const maxDuration = 60; // Max allowed for Vercel Hobby

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

  try {
    const { data: files } = await supabaseAdmin.from('files').select('original_name, parsed_markdown').eq('owner_id', user.id).not('parsed_markdown', 'is', null);

    if (!files || files.length === 0) {
      return res.json({ summary: "Your drive is currently empty or contains no fully parsed documents." });
    }

    let allText = files.map(f => `File: ${f.original_name}\n${f.parsed_markdown?.substring(0, 500)}...`).join('\n\n');
    if (allText.length > 50000) allText = allText.substring(0, 50000);

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Summarize the following documents from the user's secure drive. Give a high-level executive summary of the content topics.\n\n${allText}`,
    });

    res.json({ summary: response.text });
  } catch (error: any) {
    console.error('Summarize error:', error);
    res.status(500).json({ error: 'Failed to summarize drive', details: error.message });
  }
}
