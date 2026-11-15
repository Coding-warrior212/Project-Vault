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
import { authorizeGeminiWorkspace } from './server/geminiAuth';
import {
  analyzeKnowledgeConflicts,
  consumeGeminiRateLimit,
  extractKnowledge,
  isGeminiConfigured,
  normalizeConflictClaims,
  normalizeStoredPages,
} from './server/geminiService';


dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

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
  res.json({
    status: 'ok',
    available: isGeminiConfigured(),
    model: 'gemini-3.8-flash',
    platform: 'ProjectVault Server-Side Engine',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Extract knowledge from a source stored in the authenticated workspace.
 * The browser supplies identifiers only; source content is retrieved here.
 */
app.post('/api/gemini/extract-knowledge', async (req: Request, res: Response) => {
  const { workspaceId, sourceId } = req.body ?? {};

  if (
    typeof sourceId !== 'string' ||
    sourceId.trim().length === 0 ||
    sourceId.length > 256
  ) {
    return res.status(400).json({
      success: false,
      error: 'A valid source ID is required.',
    });
  }

  const authorization = await authorizeGeminiWorkspace(
    req.get('authorization'),
    workspaceId,
    ['owner', 'admin', 'editor'],
  );

  if (!authorization.ok) {
    return res.status(authorization.status).json({
      success: false,
      error: authorization.error,
      isAuth: authorization.status === 401 || authorization.status === 403,
    });
  }

  if (!consumeGeminiRateLimit(authorization.userId, 'extract-knowledge', 6)) {
    return res.status(429).json({
      success: false,
      error: 'Too many extraction requests. Please wait before trying again.',
      isRateLimit: true,
    });
  }

  try {
    const { data: source, error: sourceError } = await authorization.db
      .from('sources')
      .select('id, filename, extracted_text, pages')
      .eq('id', sourceId)
      .eq('workspace_id', authorization.workspaceId)
      .maybeSingle();

    if (sourceError) {
      console.error('[Gemini extraction] Source lookup failed:', sourceError.code);
      return res.status(503).json({
        success: false,
        error: 'The source could not be loaded. Please try again.',
      });
    }

    if (!source) {
      return res.status(404).json({
        success: false,
        error: 'The requested source was not found in this workspace.',
      });
    }

    if (
      typeof source.extracted_text !== 'string' ||
      !source.extracted_text.trim()
    ) {
      return res.status(422).json({
        success: false,
        error: 'This source has no persisted extracted text. Re-ingest the source before reconstruction.',
      });
    }

    const result = await extractKnowledge({
      sourceId: source.id,
      filename: source.filename || 'Untitled source',
      extractedText: source.extracted_text,
      pages: normalizeStoredPages(source.pages),
    });

    return res.json({
      success: true,
      sourceId: source.id,
      sourceName: source.filename,
      ...result,
    });
  } catch (error) {
    console.error(
      '[Gemini extraction] Request failed:',
      error instanceof Error ? error.message : 'Unknown error',
    );

    const message = error instanceof Error ? error.message : '';

    if (message.includes('not configured')) {
      return res.status(503).json({
        success: false,
        error: 'The AI service is temporarily unavailable.',
      });
    }

    if (message.includes('too large')) {
      return res.status(413).json({
        success: false,
        error: message,
      });
    }

    return res.status(502).json({
      success: false,
      error: 'Knowledge extraction failed. Please try again.',
    });
  }
});

/**
 * Analyze claims loaded directly from the authenticated workspace.
 * The browser cannot submit or substitute its own claim collection.
 */
app.post('/api/gemini/analyze-conflicts', async (req: Request, res: Response) => {
  const { workspaceId } = req.body ?? {};

  const authorization = await authorizeGeminiWorkspace(
    req.get('authorization'),
    workspaceId,
    ['owner', 'admin', 'reviewer'],
  );

  if (!authorization.ok) {
    return res.status(authorization.status).json({
      success: false,
      error: authorization.error,
      isAuth: authorization.status === 401 || authorization.status === 403,
    });
  }

  if (!consumeGeminiRateLimit(authorization.userId, 'analyze-conflicts', 4)) {
    return res.status(429).json({
      success: false,
      error: 'Too many conflict-analysis requests. Please wait before trying again.',
      isRateLimit: true,
    });
  }

  try {
    const { data: rows, error: claimsError } = await authorization.db
      .from('claims')
      .select(
        'id, statement, source_id, source_name, source_location, source_evidence_quote, category, verification_status, confidence_score, confidence_tier',
      )
      .eq('workspace_id', authorization.workspaceId)
      .limit(301);

    if (claimsError) {
      console.error('[Gemini conflict analysis] Claims lookup failed:', claimsError.code);
      return res.status(503).json({
        success: false,
        error: 'Workspace claims could not be loaded. Please try again.',
      });
    }

    if ((rows ?? []).length > 300) {
      return res.status(413).json({
        success: false,
        error: 'This workspace has more than 300 claims. Narrow the analysis before retrying.',
      });
    }

    const claims = normalizeConflictClaims(rows ?? []);

    if (claims.length < 2) {
      return res.json({
        success: true,
        analyzedCount: claims.length,
        conflicts: [],
      });
    }

    const result = await analyzeKnowledgeConflicts({ claims });

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error(
      '[Gemini conflict analysis] Request failed:',
      error instanceof Error ? error.message : 'Unknown error',
    );

    return res.status(502).json({
      success: false,
      error: 'Conflict analysis failed. Please try again.',
    });
  }
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
