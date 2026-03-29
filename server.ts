import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import jwt from 'jsonwebtoken';
import Stripe from 'stripe';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-docintel';

// Initialize Stripe (use a mock key if not provided)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock', { apiVersion: '2023-10-16' as any });

// In-memory database
const db = {
  users: [] as any[], // { id, username, password, role: 'admin' | 'department', creatorId?, storageLimit }
  files: [] as any[], // { id, name, originalName, mimeType, size, path, markdown, folderId, ownerId, sharedWith: [], createdAt, trashedAt }
  folders: [] as any[] // { id, name, parentId, ownerId, sharedWith: [], createdAt, trashedAt }
};

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

  // API Routes

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
    const owner = db.users.find(u => u.id === ownerId) || req.user;
    const totalSize = db.files.filter(f => f.ownerId === ownerId).reduce((acc, file) => acc + (file.size || 0), 0);
    if (totalSize + req.file.size > owner.storageLimit) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Storage limit exceeded' });
    }
    
    let markdown = req.body.markdown || `# ${req.file.originalname}\n\nThis is the extracted content of ${req.file.originalname}.\n\n`;
    
    if (req.file.mimetype === 'text/plain' || req.file.mimetype === 'text/markdown') {
      markdown = fs.readFileSync(req.file.path, 'utf-8');
    }

    // Save to DB
    const newFile = {
      id: fileId,
      name: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      markdown,
      folderId: folderId || null,
      ownerId: req.user.id,
      sharedWith: [],
      createdAt: new Date().toISOString(),
      trashedAt: null
    };
    db.files.push(newFile);
    
    // Save embedding if provided
    if (req.body.embedding) {
      try {
        const embedding = JSON.parse(req.body.embedding);
        if (Array.isArray(embedding) && embedding.length > 0) {
          vectorStore.push({
            id: uuidv4(),
            fileId,
            embedding,
            text: markdown
          });
        }
      } catch (e) {
        console.error('Error parsing embedding:', e);
      }
    }
    
    res.json({
      id: fileId,
      name: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size
    });
  });

  // Get file content
  app.get('/api/files/:id', authenticate, (req: any, res) => {
    const file = db.files.find(f => f.id === req.params.id);
    if (!file) return res.status(404).json({ error: 'File not found' });
    if (file.ownerId !== req.user.id && !file.sharedWith?.includes(req.user.id)) return res.status(403).json({ error: 'Forbidden' });
    res.json(file);
  });

  // Download file
  app.get('/api/files/:id/download', (req: any, res) => {
    // For simplicity, allowing download without auth if they have the ID, or we could pass token in query
    const file = db.files.find(f => f.id === req.params.id);
    if (!file) return res.status(404).json({ error: 'File not found' });
    res.download(file.path, file.originalName);
  });

  // Summarize Drive
  app.post('/api/summarize-drive', authenticate, async (req: any, res) => {
    const userId = req.user.id;
    const files = db.files.filter(f => f.trashedAt == null && (f.ownerId === userId || f.sharedWith?.includes(userId)));
    if (files.length === 0) return res.json({ summary: 'Your drive is empty.' });
    
    const allText = files.map(f => f.markdown).join('\n\n---\n\n');
    
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
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
