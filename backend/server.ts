import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';

// Handle both ESM and CJS environments
const _dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath((typeof import.meta !== 'undefined' && import.meta.url) ? import.meta.url : 'file://' + __filename));
const rootDir = path.resolve(_dirname, '..');

const registeredFunctions = new Map<string, (req: Request) => Promise<Response>>();

(globalThis as any).Deno = {
  env: {
    get: (key: string) => process.env[key],
    set: (key: string, value: string) => { process.env[key] = value; },
    toObject: () => process.env,
  },
  serve: (handler: (req: Request) => Promise<Response>) => {
    (globalThis as any).__latestHandler = handler;
  },
  errors: {
    HttpError: Error,
  },
};

async function loadEdgeFunctions() {
  const functionsDir = path.join(rootDir, 'supabase', 'functions');
  if (!fs.existsSync(functionsDir)) return;
  
  const entries = fs.readdirSync(functionsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith('_')) {
      const indexPath = path.join(functionsDir, entry.name, 'index.ts');
      if (fs.existsSync(indexPath)) {
        try {
          (globalThis as any).__latestHandler = null;
          await import(pathToFileURL(indexPath).href);
          
          if ((globalThis as any).__latestHandler) {
            registeredFunctions.set(entry.name, (globalThis as any).__latestHandler);
            console.log(`Loaded Edge Function: ${entry.name}`);
          }
        } catch (error) {
          console.error(`Failed to load Edge Function ${entry.name}:`, error);
        }
      }
    }
  }
}

async function startServer() {
  await loadEdgeFunctions();

  const app = express();
  app.use(cors());

  app.use('/api/supabase/functions/v1', express.raw({ type: '*/*', limit: '50mb' }));

  app.all(/^\/api\/supabase\/functions\/v1\/.*/, async (req, res) => {
    const route = req.path.replace(/^\/api\/supabase\/functions\/v1\//, '').split('?')[0];
    const functionName = route.split('/')[0];
    
    const handler = registeredFunctions.get(functionName);
    
    if (handler) {
      try {
        const url = new URL(req.originalUrl, `http://${req.headers.host || 'localhost'}`);
        const headers = new Headers();
        for (const [key, value] of Object.entries(req.headers)) {
          if (value) headers.set(key, Array.isArray(value) ? value.join(',') : (value as string));
        }
        
        const reqInit: RequestInit = {
          method: req.method,
          headers,
        };
        
        if (req.method !== 'GET' && req.method !== 'HEAD' && req.body && Buffer.isBuffer(req.body) && req.body.length > 0) {
          reqInit.body = req.body;
        }

        const standardReq = new Request(url, reqInit);
        const standardRes = await handler(standardReq);
        
        res.status(standardRes.status);
        standardRes.headers.forEach((value, key) => {
          res.setHeader(key, value);
        });
        
        const buf = await standardRes.arrayBuffer();
        res.send(Buffer.from(buf));
      } catch (error) {
        console.error(`Error executing ${functionName}:`, error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    } else {
      res.status(404).json({ error: "Function not found" });
    }
  });

  // OAuth popup callback handler to transmit auth session safely across window boundaries
  app.get(['/auth/callback', '/auth/callback/'], (req, res) => {
    res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Authenticating...</title>
  <style>
    body {
      background: #090a0f;
      color: #f1f5f9;
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
    }
    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid rgba(255,255,255,0.1);
      border-top-color: #ef4444;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 16px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="spinner"></div>
  <p>Authenticating your account...</p>
  <script>
    (function() {
      try {
        const hash = window.location.hash ? window.location.hash.substring(1) : "";
        const search = window.location.search ? window.location.search.substring(1) : "";
        const params = new URLSearchParams(hash || search);
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        const error = params.get('error') || params.get('error_description');

        if (window.opener) {
          if (access_token && refresh_token) {
            window.opener.postMessage({
              type: 'OAUTH_SUCCESS',
              session: { access_token, refresh_token }
            }, '*');
          } else if (error) {
            window.opener.postMessage({
              type: 'OAUTH_ERROR',
              error: error
            }, '*');
          } else {
            window.opener.postMessage({
              type: 'OAUTH_SUCCESS',
              hash: window.location.hash,
              search: window.location.search
            }, '*');
          }
          setTimeout(() => {
            window.close();
          }, 300);
        } else {
          window.location.href = '/dashboard';
        }
      } catch (e) {
        console.error("Callback error:", e);
      }
    })();
  </script>
</body>
</html>`);
  });

  const supabaseUrl = process.env.SUPABASE_URL || 'https://mqotnlflwrgqpbhjkwyq.supabase.co';
  if (supabaseUrl) {
    app.use('/api/supabase', createProxyMiddleware({
      target: supabaseUrl,
      changeOrigin: true,
      pathRewrite: { '^/api/supabase': '' },
      ws: true,
    }));
  }

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(rootDir, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error(err);
  process.exit(1);
});
