/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import type { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createInviteRouter } from './server/supabaseInvite';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
// Render terminates TLS at one trusted proxy hop; this preserves the originating client IP for rate limits.
app.set('trust proxy', 1);
const PORT = Number(process.env.PORT) || 3000;

// Keep the invite endpoint's small, dedicated JSON limit separate from document uploads.
app.use(createInviteRouter());

// Increase payload limit for large document texts
app.use(express.json({ limit: '35mb' }));
app.use(express.urlencoded({ extended: true, limit: '35mb' }));

/**
 * API Route: Health & Configuration Check
 */
app.get('/api/gemini/status', (_req: Request, res: Response) => {
  // Never disclose whether a server-side provider secret is configured.
  // AI routes remain unavailable until authenticated workspace authorization is wired end-to-end.
  res.json({
    status: 'ok',
    available: false,
    reason: 'workspace_authorization_required',
    model: 'gemini-3.8-flash',
    platform: 'ProjectVault Server-Side Engine',
    timestamp: new Date().toISOString(),
  });
});

/**
 * API Route: Reconstruct Knowledge from Document Text
 *
 * Fail closed until authenticated workspace authorization is implemented.
 * Keep this route intentionally small so disabled legacy code cannot drift
 * into an accidentally reachable or type-unsafe state.
 */
app.post('/api/gemini/extract-knowledge', (_req: Request, res: Response) => {
  return res.status(503).json({
    success: false,
    error: 'AI extraction is temporarily unavailable until workspace authorization is enabled.',
    code: 'WORKSPACE_AUTHORIZATION_REQUIRED',
  });
});

/**
 * API Route: Analyze Knowledge Conflicts across Persisted Claims
 *
 * Claims must be loaded from an authorized workspace by the server before
 * this capability can be re-enabled.
 */
app.post('/api/gemini/analyze-conflicts', (_req: Request, res: Response) => {
  return res.status(503).json({
    success: false,
    error: 'AI conflict analysis is temporarily unavailable until workspace authorization is enabled.',
    code: 'WORKSPACE_AUTHORIZATION_REQUIRED',
  });
});

// Start server with Vite middleware in dev or static files in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        port: PORT,
        host: '0.0.0.0',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ProjectVault] Full-Stack server running at http://0.0.0.0:${PORT} (mode: ${isProd ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('[ProjectVault] Failed to launch server:', err);
  process.exit(1);
});
