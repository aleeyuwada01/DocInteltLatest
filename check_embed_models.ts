import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';
import fs from 'fs';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const candidates = [
  'text-embedding-004',
  'text-embedding-005',
  'embedding-001',
  'gemini-embedding-exp-03-07',
  'gemini-2.0-flash',
  'gemini-2.5-flash',
];

async function run() {
  const results: string[] = [];
  for (const model of candidates) {
    try {
      const result = await ai.models.embedContent({ model, contents: ['hello world'] });
      const dim = result.embeddings?.[0]?.values?.length ?? 0;
      results.push(`OK: ${model} (${dim}-dim)`);
    } catch (e: any) {
      results.push(`FAIL: ${model} — ${e.message?.substring(0, 120)}`);
    }
  }
  const output = results.join('\n');
  console.log(output);
  fs.writeFileSync('embed_results.txt', output);
}
run();
