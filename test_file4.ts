import { createClient } from '@supabase/supabase-js';

const url = "https://gwojzfkeahkzlygoasyy.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3b2p6ZmtlYWhremx5Z29hc3l5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwODczOTAsImV4cCI6MjA5MDY2MzM5MH0.B7rHjzLeYhxYrcX9Dgf3eT95etJbOMJuKl1wYiDrtZ8";

const sb = createClient(url, key);

async function check() {
  const { data, error } = await sb.from('files').insert({
    name: 'Test File',
    size: 100,
    type: 'application/pdf',
    owner_id: '00000000-0000-0000-0000-000000000000'
  });
  console.log("Files Insert Error:", error);
}

check();
