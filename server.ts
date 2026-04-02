import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import jwt from 'jsonwebtoken';
import Stripe from 'stripe';
import { parseDocument } from './src/lib/llamaparse.js';
import { embedText, embedBatch } from './src/lib/embeddings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-docintel';

// Initialize Stripe (use a mock key if not provided)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock', { apiVersion: '2023-10-16' as any });

// In-memory database
const db = {
  users: [] as any[],
  // files: { id, name, originalName, mimeType, size, path, markdown, folderId, ownerId, sharedWith, createdAt, trashedAt,
  //          parsing_status: 'idle'|'parsing'|'embedding'|'completed'|'error',
  //          parsed_markdown, parsed_text, parse_error, file_hash }
  files: [] as any[],
  folders: [] as any[]
};

// ─── In-process Parsing Queue ─────────────────────────────────────────────────
// Tracks files currently being parsed so we don't double-queue them
const parsingInProgress = new Set<string>();

function hashFile(filePath: string, size: number, name: string): string {
  return crypto.createHash('md5').update(`${filePath}:${size}:${name}`).digest('hex');
}

function chunkText(text: string, chunkSize = 2000, overlap = 200): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + chunkSize));
    i += chunkSize - overlap;
  }
  return chunks;
}

async function runParseJob(fileId: string, ai: GoogleGenAI) {
  if (parsingInProgress.has(fileId)) return;
  parsingInProgress.add(fileId);

  const file = db.files.find((f: any) => f.id === fileId);
  if (!file) { parsingInProgress.delete(fileId); return; }

  try {
    // ── Step 1: Parse the document ──
    file.parsing_status = 'parsing';
    console.log(`[Queue] ── Starting parse: ${file.originalName} ──`);

    let contentText = '';

    // Strategy A: Try LlamaParse first
    try {
      const parsed = await parseDocument(file.path, file.mimeType);
      contentText = parsed.markdown || parsed.text || '';
      console.log(`[Queue] LlamaParse returned ${contentText.length} chars for ${file.originalName}`);
    } catch (llamaErr: any) {
      console.warn(`[Queue] LlamaParse failed for ${file.originalName}: ${llamaErr.message}`);
    }

    // Strategy B: Fallback — images → Gemini vision OCR
    if (!contentText && file.mimeType?.startsWith('image/')) {
      console.log(`[Queue] Fallback: using Gemini vision for image OCR: ${file.originalName}`);
      try {
        const imageBuffer = fs.readFileSync(file.path);
        const base64 = imageBuffer.toString('base64');
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: {
            parts: [
              { text: 'Extract ALL text from this image. If it is a receipt, invoice, or document, transcribe everything. Format as Markdown.' },
              { inlineData: { data: base64, mimeType: file.mimeType } },
            ],
          },
        });
        contentText = response.text || '';
        console.log(`[Queue] Gemini OCR returned ${contentText.length} chars`);
      } catch (geminiErr: any) {
        console.warn(`[Queue] Gemini OCR fallback failed: ${geminiErr.message}`);
      }
    }

    // Strategy C: Fallback — plain text / markdown files
    if (!contentText && (file.mimeType === 'text/plain' || file.mimeType === 'text/markdown')) {
      console.log(`[Queue] Fallback: reading plain text file: ${file.originalName}`);
      contentText = fs.readFileSync(file.path, 'utf-8');
    }

    // Strategy D: Final fallback — try to read any file as UTF-8
    if (!contentText) {
      console.log(`[Queue] Fallback: attempting raw UTF-8 read for: ${file.originalName}`);
      try {
        const raw = fs.readFileSync(file.path, 'utf-8');
        if (raw && raw.length > 10 && !raw.includes('\0')) {
          contentText = raw;
        }
      } catch { /* binary file, can't read as text */ }
    }

    if (!contentText) {
      contentText = `# ${file.originalName}\n\nCould not extract text from this file (type: ${file.mimeType}).`;
      console.warn(`[Queue] No content extracted for ${file.originalName}`);
    }

    // Save parsed content
    file.parsed_markdown = contentText;
    file.parsed_text = contentText;
    file.markdown = contentText;
    console.log(`[Queue] Saved ${contentText.length} chars for ${file.originalName}`);

    // ── Step 2: Embed the parsed content ──
    file.parsing_status = 'embedding';
    console.log(`[Queue] Embedding ${file.originalName}…`);

    // Remove ALL old embeddings for this file
    for (let i = vectorStore.length - 1; i >= 0; i--) {
      if (vectorStore[i].fileId === fileId) vectorStore.splice(i, 1);
    }

    const chunks = chunkText(contentText);
    console.log(`[Queue] Split into ${chunks.length} chunks`);

    let embeddedCount = 0;
    const embedResults = await embedBatch(chunks, {
      delayMs: 150,
      onProgress: (done, total) => {
        if (done % 5 === 0 || done === total) {
          console.log(`[Queue] Embedding progress: ${done}/${total}`);
        }
      },
    });

    for (let i = 0; i < embedResults.length; i++) {
      const embedding = embedResults[i].values;
      if (embedding.length > 0) {
        vectorStore.push({ id: uuidv4(), fileId, embedding, text: chunks[i] });
        embeddedCount++;
      }
    }

    console.log(`[Queue] Embedded ${embeddedCount}/${chunks.length} chunks into vectorStore (total: ${vectorStore.length})`);

    file.parsing_status = 'completed';
    console.log(`[Queue] ✓ Completed: ${file.originalName}`);

  } catch (err: any) {
    file.parsing_status = 'error';
    file.parse_error = err.message;
    console.error(`[Queue] ✗ Failed: ${file.originalName}: ${err.message}`);
  } finally {
    parsingInProgress.delete(fileId);
  }
}

// ──────────────────────────────────────────────────────────────────────────────

// Setup multer for file uploads
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Simple in-memory vector store for demo purposes
const vectorStore: { id: string, fileId: string, embedding: number[], text: string }[] = [];

function cosineSimilarity(vecA: number[], vecB: number[]) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Middleware to authenticate user
const authenticate = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = db.users.find(u => u.id === decoded.id);
    if (!req.user) return res.status(401).json({ error: 'User not found' });
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

async function startServer() {
  const app = express();
  app.use(express.json());

  // Initialize Gemini AI (shared for embedding in parse queue)
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

  // API Routes

  // ── Health Check ──────────────────────────────────────────────────────────
  app.get('/api/health', async (req, res) => {
    const results: Record<string, any> = {
      timestamp: new Date().toISOString(),
      llamaparse: { status: 'unknown', message: '' },
      gemini: { status: 'unknown', message: '' },
      queue: {
        inProgress: parsingInProgress.size,
        totalFiles: db.files.length,
        completed: db.files.filter((f: any) => f.parsing_status === 'completed').length,
        parsing: db.files.filter((f: any) => f.parsing_status === 'parsing' || f.parsing_status === 'embedding').length,
        errored: db.files.filter((f: any) => f.parsing_status === 'error').length,
      }
    };

    // Test LlamaParse v2
    try {
      if (!process.env.LLAMA_CLOUD_API_KEY) throw new Error('LLAMA_CLOUD_API_KEY is not set');
      const llamaRes = await fetch('https://api.cloud.llamaindex.ai/api/v2/parse?page_size=1', {
        headers: { Authorization: `Bearer ${process.env.LLAMA_CLOUD_API_KEY}`, accept: 'application/json' },
      });
      if (!llamaRes.ok) throw new Error(`API returned ${llamaRes.status}`);
      results.llamaparse = { status: 'ok', message: 'Connected to LlamaCloud v2 API', tier: process.env.LLAMA_PARSE_TIER, version: process.env.LLAMA_PARSE_VERSION };
    } catch (err: any) {
      results.llamaparse = { status: 'error', message: err.message };
    }

    // Test Gemini Embeddings (v1 REST API)
    try {
      if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');
      const embedResult = await embedText('health check');
      const dim = embedResult.values.length;
      results.gemini = { status: 'ok', message: `Embedding model responding (${dim}-dim vectors)`, model: 'gemini-embedding-2-preview (v1 REST)' };
    } catch (err: any) {
      results.gemini = { status: 'error', message: err.message };
    }

    const overallOk = results.llamaparse.status === 'ok' && results.gemini.status === 'ok';
    res.status(overallOk ? 200 : 207).json(results);
  });

  // Auth
  app.post('/api/auth/register', (req, res) => {
    const { username, password } = req.body;
    if (db.users.find(u => u.username === username)) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    const user = {
      id: uuidv4(),
      username,
      password, // In production, hash this!
      role: 'admin',
      storageLimit: 1 * 1024 * 1024 * 1024 // 1GB starter
    };
    db.users.push(user);
    const token = jwt.sign({ id: user.id }, JWT_SECRET);
    res.json({ token, user: { id: user.id, username: user.username, role: user.role, storageLimit: user.storageLimit } });
  });

  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const user = db.users.find(u => u.username === username && u.password === password);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id }, JWT_SECRET);
    res.json({ token, user: { id: user.id, username: user.username, role: user.role, storageLimit: user.storageLimit } });
  });

  app.get('/api/auth/me', authenticate, (req: any, res) => {
    res.json({ user: { id: req.user.id, username: req.user.username, role: req.user.role, storageLimit: req.user.storageLimit } });
  });

  // Departments
  app.post('/api/departments', authenticate, (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Only admins can create departments' });
    const { username, password } = req.body;
    if (db.users.find(u => u.username === username)) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    const dept = {
      id: uuidv4(),
      username,
      password,
      role: 'department',
      creatorId: req.user.id,
      storageLimit: 0 // Uses creator's storage
    };
    db.users.push(dept);
    res.json({ id: dept.id, username: dept.username });
  });

  app.get('/api/departments', authenticate, (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const depts = db.users.filter(u => u.creatorId === req.user.id).map(u => ({ id: u.id, username: u.username }));
    res.json(depts);
  });

  // Stripe Checkout
  app.post('/api/create-checkout-session', authenticate, async (req: any, res) => {
    const { plan } = req.body;
    // Mock success for AI Studio environment
    if (!process.env.STRIPE_SECRET_KEY) {
      if (plan === 'pro') req.user.storageLimit = 50 * 1024 * 1024 * 1024;
      if (plan === 'enterprise') req.user.storageLimit = 1024 * 1024 * 1024 * 1024;
      return res.json({ url: '/?payment=success' });
    }

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: plan === 'pro' ? 'Pro Plan (50GB)' : 'Enterprise Plan (1TB)',
              },
              unit_amount: plan === 'pro' ? 999 : 4999,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${req.headers.origin}/?payment=success&plan=${plan}`,
        cancel_url: `${req.headers.origin}/?payment=cancelled`,
        client_reference_id: req.user.id,
      });
      res.json({ url: session.url });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/upgrade-storage', authenticate, (req: any, res) => {
    const { plan } = req.body;
    if (plan === 'pro') req.user.storageLimit = 50 * 1024 * 1024 * 1024;
    if (plan === 'enterprise') req.user.storageLimit = 1024 * 1024 * 1024 * 1024;
    res.json({ success: true, limit: req.user.storageLimit });
  });

  // Get all files and folders
  app.get('/api/drive', authenticate, (req: any, res) => {
    const parentId = req.query.folderId || null;
    const isTrash = req.query.trash === 'true';
    const userId = req.user.id;
    
    // Filter by ownership or shared access
    const hasAccess = (item: any) => item.ownerId === userId || item.sharedWith?.includes(userId);

    if (isTrash) {
      const folders = db.folders.filter(f => f.trashedAt != null && hasAccess(f));
      const files = db.files.filter(f => f.trashedAt != null && hasAccess(f)).map(f => ({
        id: f.id, name: f.name, originalName: f.originalName, mimeType: f.mimeType, size: f.size, folderId: f.folderId, createdAt: f.createdAt, trashedAt: f.trashedAt, ownerId: f.ownerId, sharedWith: f.sharedWith
      }));
      return res.json({ folders, files });
    }

    const folders = db.folders.filter(f => f.parentId === parentId && f.trashedAt == null && hasAccess(f));
    const files = db.files.filter(f => f.folderId === parentId && f.trashedAt == null && hasAccess(f)).map(f => ({
      id: f.id, name: f.name, originalName: f.originalName, mimeType: f.mimeType, size: f.size, folderId: f.folderId, createdAt: f.createdAt, ownerId: f.ownerId, sharedWith: f.sharedWith
    }));
    
    res.json({ folders, files });
  });

  // Get storage info
  app.get('/api/storage', authenticate, (req: any, res) => {
    const ownerId = req.user.role === 'department' ? req.user.creatorId : req.user.id;
    const owner = db.users.find(u => u.id === ownerId) || req.user;
    const totalSize = db.files.filter(f => f.ownerId === ownerId).reduce((acc, file) => acc + (file.size || 0), 0);
    res.json({ used: totalSize, limit: owner.storageLimit });
  });

  // Create folder
  app.post('/api/folders', authenticate, (req: any, res) => {
    const { name, parentId } = req.body;
    const id = uuidv4();
    const newFolder = { 
      id, 
      name, 
      parentId: parentId || null, 
      ownerId: req.user.id,
      sharedWith: [],
      createdAt: new Date().toISOString() 
    };
    db.folders.push(newFolder);
    res.json(newFolder);
  });

  // Share file/folder
  app.post('/api/share', authenticate, (req: any, res) => {
    const { itemId, type, departmentId } = req.body;
    const collection = type === 'file' ? db.files : db.folders;
    const item = collection.find(i => i.id === itemId);
    
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (item.ownerId !== req.user.id) return res.status(403).json({ error: 'Only owner can share' });
    
    if (!item.sharedWith) item.sharedWith = [];
    if (!item.sharedWith.includes(departmentId)) {
      item.sharedWith.push(departmentId);
    }
    res.json({ success: true });
  });

  // Upload file
  app.post('/api/upload', authenticate, upload.single('file'), async (req: any, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const folderId = req.body.folderId === 'null' ? null : req.body.folderId;
    const fileId = uuidv4();

    // Check storage limit
    const ownerId = req.user.role === 'department' ? req.user.creatorId : req.user.id;
    const owner = db.users.find((u: any) => u.id === ownerId) || req.user;
    const totalSize = db.files.filter((f: any) => f.ownerId === ownerId).reduce((acc: number, file: any) => acc + (file.size || 0), 0);
    if (totalSize + req.file.size > owner.storageLimit) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Storage limit exceeded' });
    }

    // Deduplication: check if same file already exists (same hash)
    const fileHash = hashFile(req.file.path, req.file.size, req.file.originalname);
    const duplicate = db.files.find((f: any) => f.file_hash === fileHash && f.ownerId === req.user.id && !f.trashedAt);
    if (duplicate) {
      fs.unlinkSync(req.file.path); // clean up re-upload
      return res.json({
        id: duplicate.id,
        name: duplicate.name,
        originalName: duplicate.originalName,
        mimeType: duplicate.mimeType,
        size: duplicate.size,
        parsing_status: duplicate.parsing_status,
        duplicate: true,
      });
    }

    // For plain text/markdown, read content directly as fallback
    let initialMarkdown = `# ${req.file.originalname}\n\nProcessing...`;
    if (req.file.mimetype === 'text/plain' || req.file.mimetype === 'text/markdown') {
      initialMarkdown = fs.readFileSync(req.file.path, 'utf-8');
    }

    // Save to DB immediately with 'parsing' queued status
    const newFile = {
      id: fileId,
      name: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      markdown: initialMarkdown,
      parsed_markdown: null,
      parsed_text: null,
      parse_error: null,
      parsing_status: 'idle' as string,
      file_hash: fileHash,
      folderId: folderId || null,
      ownerId: req.user.id,
      sharedWith: [],
      createdAt: new Date().toISOString(),
      trashedAt: null,
    };
    db.files.push(newFile);

    // Kick off background parsing (non-blocking)
    setImmediate(() => runParseJob(fileId, ai));

    res.json({
      id: fileId,
      name: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      parsing_status: 'parsing',
    });
  });

  // Get file content
  app.get('/api/files/:id', authenticate, (req: any, res) => {
    const file = db.files.find((f: any) => f.id === req.params.id);
    if (!file) return res.status(404).json({ error: 'File not found' });
    if (file.ownerId !== req.user.id && !file.sharedWith?.includes(req.user.id)) return res.status(403).json({ error: 'Forbidden' });
    res.json(file);
  });

  // Get parsing status (lightweight polling endpoint)
  app.get('/api/files/:id/status', authenticate, (req: any, res) => {
    const file = db.files.find((f: any) => f.id === req.params.id);
    if (!file) return res.status(404).json({ error: 'File not found' });
    if (file.ownerId !== req.user.id && !file.sharedWith?.includes(req.user.id)) return res.status(403).json({ error: 'Forbidden' });
    res.json({
      id: file.id,
      parsing_status: file.parsing_status || 'idle',
      parse_error: file.parse_error || null,
    });
  });

  // Get parsed content (markdown + text)
  app.get('/api/files/:id/parsed', authenticate, (req: any, res) => {
    const file = db.files.find((f: any) => f.id === req.params.id);
    if (!file) return res.status(404).json({ error: 'File not found' });
    if (file.ownerId !== req.user.id && !file.sharedWith?.includes(req.user.id)) return res.status(403).json({ error: 'Forbidden' });
    res.json({
      id: file.id,
      originalName: file.originalName,
      parsing_status: file.parsing_status || 'idle',
      parsed_markdown: file.parsed_markdown || file.markdown || null,
      parsed_text: file.parsed_text || null,
      parse_error: file.parse_error || null,
    });
  });

  // Download file
  app.get('/api/files/:id/download', (req: any, res) => {
    const file = db.files.find((f: any) => f.id === req.params.id);
    if (!file) return res.status(404).json({ error: 'File not found' });
    res.download(file.path, file.originalName);
  });

  // Embed text (for frontend chat to get query embeddings)
  app.post('/api/embed', authenticate, async (req: any, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });
    try {
      const result = await embedText(text);
      res.json({ embedding: result.values });
    } catch (err: any) {
      console.error('[Embed API]', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Vector search
  app.post('/api/search', authenticate, async (req: any, res) => {
    const { embedding, topK = 5 } = req.body;
    if (!embedding || !Array.isArray(embedding)) {
      return res.status(400).json({ error: 'embedding array is required' });
    }

    // Cosine similarity search
    const scored = vectorStore.map((v: any) => ({
      ...v,
      score: cosineSimilarity(embedding, v.embedding),
    }));
    scored.sort((a: any, b: any) => b.score - a.score);
    const topResults = scored.slice(0, topK);

    // Attach file metadata
    const results = topResults.map((r: any) => {
      const file = db.files.find((f: any) => f.id === r.fileId);
      return {
        text: r.text,
        score: r.score,
        fileId: r.fileId,
        fileName: file?.originalName || 'Unknown',
      };
    });

    res.json({ results });
  });

  // Summarize Drive
  app.post('/api/summarize-drive', authenticate, async (req: any, res) => {
    const userId = req.user.id;
    const files = db.files.filter(f => f.trashedAt == null && (f.ownerId === userId || f.sharedWith?.includes(userId)));
    if (files.length === 0) return res.json({ summary: 'Your drive is empty.' });
    
    const allText = files.map(f => f.markdown).join('\n\n---\n\n');
    
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Summarize the following documents in a few sentences:\n\n${allText.substring(0, 30000)}`
      });
      res.json({ summary: response.text });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Trash endpoints
  app.put('/api/files/:id/trash', authenticate, (req: any, res) => {
    const file = db.files.find(f => f.id === req.params.id);
    if (!file) return res.status(404).json({ error: 'File not found' });
    if (file.ownerId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    file.trashedAt = new Date().toISOString();
    res.json({ success: true });
  });

  app.put('/api/folders/:id/trash', authenticate, (req: any, res) => {
    const folder = db.folders.find(f => f.id === req.params.id);
    if (!folder) return res.status(404).json({ error: 'Folder not found' });
    if (folder.ownerId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    folder.trashedAt = new Date().toISOString();
    res.json({ success: true });
  });

  app.put('/api/files/:id/restore', authenticate, (req: any, res) => {
    const file = db.files.find(f => f.id === req.params.id);
    if (!file) return res.status(404).json({ error: 'File not found' });
    if (file.ownerId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    file.trashedAt = null;
    res.json({ success: true });
  });

  app.put('/api/folders/:id/restore', authenticate, (req: any, res) => {
    const folder = db.folders.find(f => f.id === req.params.id);
    if (!folder) return res.status(404).json({ error: 'Folder not found' });
    if (folder.ownerId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    folder.trashedAt = null;
    res.json({ success: true });
  });

  app.delete('/api/files/:id', authenticate, (req: any, res) => {
    const index = db.files.findIndex(f => f.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'File not found' });
    if (db.files[index].ownerId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    
    const file = db.files[index];
    try {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    } catch (e) {
      console.error('Failed to delete file from disk', e);
    }
    
    db.files.splice(index, 1);
    res.json({ success: true });
  });

  app.delete('/api/folders/:id', authenticate, (req: any, res) => {
    const index = db.folders.findIndex(f => f.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Folder not found' });
    if (db.folders[index].ownerId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    db.folders.splice(index, 1);
    res.json({ success: true });
  });

  // Cleanup job (runs every hour)
  setInterval(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    for (let i = db.files.length - 1; i >= 0; i--) {
      const file = db.files[i];
      if (file.trashedAt && new Date(file.trashedAt) < thirtyDaysAgo) {
        try {
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        } catch (e) {}
        db.files.splice(i, 1);
      }
    }

    for (let i = db.folders.length - 1; i >= 0; i--) {
      const folder = db.folders[i];
      if (folder.trashedAt && new Date(folder.trashedAt) < thirtyDaysAgo) {
        db.folders.splice(i, 1);
      }
    }
  }, 60 * 60 * 1000);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.post('/api/search', authenticate, (req: any, res) => {
    const { embedding } = req.body;
    const userId = req.user.id;
    
    let context = '';
    let sourceFiles: any[] = [];
    
    if (embedding && Array.isArray(embedding) && embedding.length > 0 && vectorStore.length > 0) {
      const results = vectorStore.map(doc => ({
        ...doc,
        score: cosineSimilarity(embedding, doc.embedding)
      })).sort((a, b) => b.score - a.score).slice(0, 5);
      
      // Filter results by user access
      const accessibleResults = results.filter(r => {
        const file = db.files.find(f => f.id === r.fileId);
        return file && (file.ownerId === userId || file.sharedWith?.includes(userId));
      });
      
      context = accessibleResults.map(r => r.text).join('\n\n---\n\n');
      
      const fileIds = accessibleResults.map(r => r.fileId);
      if (fileIds.length > 0) {
        sourceFiles = db.files
          .filter(f => fileIds.includes(f.id))
          .map(f => ({ id: f.id, originalName: f.originalName }));
      }
    }
    
    res.json({ context, sourceFiles });
  });

  const server = app.listen(PORT, "0.0.0.0" as any, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
