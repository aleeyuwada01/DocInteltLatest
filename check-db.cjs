require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const token = jwt.sign({
  aud: 'authenticated',
  exp: Math.floor(Date.now() / 1000) + (60 * 60),
  sub: '3226f70e-a434-4560-86ac-50e3aac55d95',
  email: 'aleeyuwada01@gmail.com',
  role: 'authenticated'
}, process.env.JWT_SECRET);

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
  global: {
    headers: { Authorization: `Bearer ${token}` }
  }
});

async function check() {
  const { data: files, error: fErr } = await supabase.from('files').select('id, name, folder_id');
  const { data: folders, error: folErr } = await supabase.from('folders').select('id, name, parent_id');
  
  console.log('fErr:', fErr);
  console.log('folErr:', folErr);
  console.log('Files:', files?.length);
  console.log(files);
  console.log('Folders:', folders?.length);
  console.log(folders);
}
check();
