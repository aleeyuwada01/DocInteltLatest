import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

async function test() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const modelsToTest = ['gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-flash-8b', 'gemini-2.5-flash'];
  
  for (const m of modelsToTest) {
    try {
      const res = await ai.models.generateContent({
        model: m,
        contents: 'hi',
      });
      console.log(`Success with: ${m} -> ${res.text}`);
    } catch (e: any) {
      console.error(`Failed with: ${m} -> ${e.message}`);
    }
  }
}
test();
