import { createClient } from '@supabase/supabase-js';

const url = 'https://gwojzfkeahkzlygoasyy.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3b2p6ZmtlYWhremx5Z29hc3l5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwODczOTAsImV4cCI6MjA5MDY2MzM5MH0.B7rHjzLeYhxYrcX9Dgf3eT95etJbOMJuKl1wYiDrtZ8';
const sb = createClient(url, key);

async function test() {
  const { data: authData, error: authErr } = await sb.auth.signInWithPassword({
    email: 'debug_j@example.com',
    password: 'Pass1234!'
  });
  if (authErr) {
    console.log('Auth error:', authErr.message);
    return;
  }
  console.log('Auth OK, userId:', authData.user?.id);
  const token = authData.session?.access_token;

  const res = await fetch('http://localhost:3000/api/upload-webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      originalName: 'test.txt',
      mimeType: 'text/plain',
      size: 10,
      storagePath: 'test/test.txt',
      folderId: null
    })
  });
  const body = await res.text();
  console.log('Status:', res.status);
  console.log('Body:', body);
}

test();
