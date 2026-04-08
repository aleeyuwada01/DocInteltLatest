import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseAdminKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseAdminKey);

async function testFolderCreate() {
  // 1. Get a valid user
  const { data: { users }, error: authErr } = await supabaseAdmin.auth.admin.listUsers();
  if (authErr || !users.length) {
    console.error("No users found", authErr);
    return;
  }
  const user = users[0];

  // 2. Insert with service role (bypass RLS)
  console.log("Inserting with service role...");
  const srRes = await supabaseAdmin.from('folders').insert({
    name: 'Service Role Folder',
    owner_id: user.id
  });
  console.log('Service Role Insert:', srRes.error ? srRes.error.message : 'Success');

  // 3. Try to insert with Anon client WITHOUT a session!
  const supabaseClient = createClient(supabaseUrl, supabaseKey);
  console.log("\nInserting with Anon client (no session/auth.uid)...");
  const anonRes = await supabaseClient.from('folders').insert({
    name: 'Anon Folder',
    owner_id: user.id
  });
  console.log('Anon Insert:', anonRes.error ? anonRes.error.message : 'Success');
}

testFolderCreate();
