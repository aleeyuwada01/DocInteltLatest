import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json());

  // ── Vercel Serverless Function Proxy for Local Dev ──────────────────────
  // This proxy ensures that `npm run dev` uses the same serverless endpoints
  // located in the `api/` folder as the Vercel production environment.
  
  app.all('/api/*', async (req: any, res: any) => {
    try {
      let functionPath = `.${req.path}`;
      
      // Handle dynamic routes like /api/files/123/parsed
      if (req.path.startsWith('/api/files/')) {
        const parts = req.path.split('/');
        if (parts.length === 5) {
          // /api/files/[id]/parsed or /api/files/[id]/download
          const action = parts[4];
          functionPath = `./api/files/[id]/${action}`;
          req.query.id = parts[3]; // Inject the pseudo-slug
        }
      }

      try {
        // Find the module
        const modulePath = path.resolve(__dirname, `${functionPath}.ts`);
        if (!fs.existsSync(modulePath)) {
          return res.status(404).json({ error: `Endpoint not found: ${functionPath}.ts` });
        }
        
        const { pathToFileURL } = await import('url');
        // Add cache-busting to force fresh module loading in dev
        const moduleUrl = pathToFileURL(modulePath).href + '?t=' + Date.now();
        const { default: handler } = await import(moduleUrl);
        await handler(req, res);
      } catch (importErr: any) {
        console.error(`[Proxy] Error executing ${req.path}:`, importErr?.message || importErr);
        if (importErr?.stack) console.error(importErr.stack);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Internal server error', details: importErr?.message });
        }
      }
    } catch (err: any) {
      console.error(`[Proxy] Error routing ${req.path}:`, err);
      res.status(500).json({ error: err.message });
    }
  });

  // ────────────────────────────────────────────────────────────────────────

  // Setup Vite for development
  let vite: any;
  if (process.env.NODE_ENV !== 'production') {
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom'
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static('dist'));
  }

  // Handle SPA routing
  app.use('*', async (req, res, next) => {
    const url = req.originalUrl;
    try {
      let template, render;
      if (process.env.NODE_ENV !== 'production') {
        template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
      } else {
        template = fs.readFileSync(path.resolve(__dirname, 'dist/index.html'), 'utf-8');
      }
      res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
    } catch (e: any) {
      if (vite) vite.ssrFixStacktrace(e);
      next(e);
    }
  });

  const server = app.listen(PORT, () => {
    console.log(`[Local Dev Proxy] Server running at http://localhost:${PORT}`);
    console.log(`[Local Dev Proxy] All /api/* requests are being proxied to local api/*.ts files to match Vercel architecture.`);
  });
}

startServer().catch((err) => {
  console.error('[Server Start Error]', err);
});
