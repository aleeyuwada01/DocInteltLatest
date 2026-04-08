import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.log('Missing env variables');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabaseAdmin.from('folders').select('*').limit(1);
  console.log('Folders query:');
  console.log('error:', error);
  console.log('data:', data);
  
  if (error && error.code === '42P01') {
    console.log("Table 'folders' does not exist!");
  }
}

check();
