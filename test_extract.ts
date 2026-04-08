import 'dotenv/config';
import { supabaseAdmin } from './src/lib/supabaseAdmin.js';
import { parseDocument } from './src/lib/llamaparse.js';
import fs from 'fs';
import path from 'path';

async function testExtraction() {
  console.log('Fetching files with parse errors or empty text...');
  const { data: files } = await supabaseAdmin.from('files').select('*').limit(3);
  
  if (!files || files.length === 0) {
    console.log('No files found.');
    return;
  }
  
  const file = files[0];
  console.log(`Testing extraction for: ${file.original_name}`);
  
  // download from storage
  const { data: blob, error } = await supabaseAdmin.storage.from('uploads').download(file.storage_path);
  if (error || !blob) {
    console.error('Failed to download:', error);
    return;
  }
  
  const buffer = Buffer.from(await blob.arrayBuffer());
  const tmpFile = path.join(process.cwd(), file.original_name);
  fs.writeFileSync(tmpFile, buffer);
  
  try {
    const result = await parseDocument(tmpFile, file.mime_type);
    console.log('=== EXTRACTION SUCCESS ===');
    console.log('Markdown length:', result.markdown?.length);
    console.log('Snippet:', result.markdown?.substring(0, 500));
  } catch (err: any) {
    console.error('Extraction failed:', err.message);
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

testExtraction().catch(console.error);
