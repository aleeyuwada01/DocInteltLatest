import 'dotenv/config';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

async function run() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error('Failed to fetch:', res.status, await res.text());
      return;
    }
    const data = await res.json();
    const models = data.models || [];
    
    const embedModels = models.filter((m: any) => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('embedContent'));
    console.log("AVAILABLE_MODELS_JSON=" + JSON.stringify(embedModels.map((m: any) => m.name)));
  } catch(e: any) {
    console.error('Error:', e.message);
  }
}

run();
