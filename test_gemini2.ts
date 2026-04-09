import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

async function test() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const modelsToTest = ['gemini-1.5-flash-001', 'gemini-1.5-flash-002', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-lite'];
  
  for (const m of modelsToTest) {
    try {
      const res = await ai.models.generateContent({
        model: m,
        contents: 'hi',
      });
      console.log(`Success with: ${m}`);
    } catch (e: any) {
      console.error(`Failed with: ${m} -> ${e.message}`);
    }
  }
}
test();
