import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function getModels() {
  const response = await ai.models.list();
  for await (const model of response) {
    if (model.name.includes('gemini') && !model.name.includes('vision')) {
      console.log(model.name);
    }
  }
}
getModels().catch(console.error);
