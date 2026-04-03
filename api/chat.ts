import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin, createUserClient } from '../src/lib/supabaseAdmin.js';
import { GoogleGenAI } from '@google/genai';

export const maxDuration = 60;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

  const { query, context } = req.body;
  if (!query) return res.status(400).json({ error: 'Query is required' });

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    
    let prompt = query;
    if (context) {
      prompt = `Context information is below.\n---------------------\n${context}\n---------------------\nGiven the context information, answer the following question. Do not hallucinate. Format your output as Markdown. Use bullet points where appropriate.\n\nQuestion: ${query}`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    res.json({ reply: response.text });
  } catch (error: any) {
    console.error('[Chat API] Error:', error);
    res.status(500).json({ error: 'Chat completion failed', details: error.message });
  }
}
