import 'dotenv/config';
import fs from 'fs';

const LLAMA_API_KEY = process.env.LLAMA_CLOUD_API_KEY || '';
const BASE_URL = 'https://api.cloud.llamaindex.ai/api/v2';

async function checkJob(jobId: string) {
  const res = await fetch(`${BASE_URL}/parse/${jobId}?expand=markdown,text`, {
    headers: {
      Authorization: `Bearer ${LLAMA_API_KEY}`,
      accept: 'application/json',
    },
  });
  
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

checkJob('pjb-qxfux8yzrqxgrmm7u6duc7gkh5kj').catch(console.error);
