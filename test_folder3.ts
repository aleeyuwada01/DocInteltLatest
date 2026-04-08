import 'dotenv/config';

// Re-read .env manually in case dotenv is failing due to path issues
import fs from 'fs';
const envContent = fs.readFileSync('.env', 'utf-8');
const envVars = envContent.split('\n').reduce((acc: any, line: string) => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) acc[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '');
  return acc;
}, {});

const supabaseUrl = envVars.VITE_SUPABASE_URL || '';
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.log('Missing env variables', Object.keys(envVars));
  process.exit(1);
}

import { createClient } from '@supabase/supabase-js';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('folders').insert({
    name: 'Test Folder CLI',
    owner_id: '00000000-0000-0000-0000-000000000000'
  });
  console.log('Insert attempt:');
  console.log('error:', error);
  
  if (error) {
     console.log('Error details:', error.details, error.message, error.hint);
  }
}

check();
