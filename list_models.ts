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
    
    console.log('--- Available Embedding Models ---');
    for (const m of models) {
      if (m.supportedGenerationMethods && m.supportedGenerationMethods.includes('embedContent')) {
        console.log(`Name: ${m.name}`);
        console.log(`Version: ${m.version}`);
        console.log(`Methods: ${m.supportedGenerationMethods.join(', ')}`);
        console.log('---');
      }
    }
  } catch(e: any) {
    console.error('Error:', e.message);
  }
}

run();
