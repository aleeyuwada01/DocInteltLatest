import 'dotenv/config';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const EMBED_MODEL = 'gemini-embedding-2-preview';
const EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${GEMINI_API_KEY}`;

async function testEmbed() {
  console.log(`Testing embedding against: ${EMBED_URL}`);
  try {
    const res = await fetch(EMBED_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${EMBED_MODEL}`,
        content: { parts: [{ text: "Hello, world!" }] },
      }),
    });
    
    if (!res.ok) {
      console.error(`FAILED: ${res.status} ${await res.text()}`);
      return;
    }
    
    const data = await res.json();
    console.log("SUCCESS! Dimensions:", data.embedding?.values?.length);
  } catch (e: any) {
    console.error("ERROR:", e.message);
  }
}

testEmbed();
