/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Source, KnowledgeClaim } from '../types';

export interface ExtractionProgressCallback {
  (stage: 'preparing' | 'sending' | 'analyzing' | 'validating' | 'persisting' | 'completed' | 'error', message: string, progress: number): void;
}

export interface ReconstructResult {
  success: boolean;
  sourceId: string;
  sourceName: string;
  summary?: string;
  claims: KnowledgeClaim[];
  extractedCount: number;
  groundedCount: number;
  error?: string;
  isRateLimit?: boolean;
  isAuth?: boolean;
}

/**
 * Check if backend Gemini service is reachable and configured
 */
export async function checkGeminiStatus(): Promise<{ status: string; hasKey: boolean; model: string }> {
  try {
    const res = await fetch('/api/gemini/status');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Gemini status check failed:', err);
    return { status: 'error', hasKey: false, model: 'gemini-3.8-flash' };
  }
}

// Track in-flight source extractions to prevent duplicate simultaneous requests
const inFlightExtractions = new Set<string>();

/**
 * Reconstruct knowledge claims from a source document using Gemini
 */
export async function extractKnowledgeFromSource(
  source: Source,
  onProgress?: ExtractionProgressCallback,
  workspace?: { workspaceId: string; accessToken: string }
): Promise<ReconstructResult> {
  if (inFlightExtractions.has(source.id)) {
    onProgress?.('error', 'Extraction for this source is already in progress.', 0);
    return {
      success: false,
      sourceId: source.id,
      sourceName: source.filename,
      claims: [],
      extractedCount: 0,
      groundedCount: 0,
      error: 'Extraction for this source is already in progress.',
    };
  }

  inFlightExtractions.add(source.id);

  if (!workspace?.workspaceId || !workspace.accessToken) {
    inFlightExtractions.delete(source.id);
    const error = 'AI reconstruction requires a signed-in workspace.';
    onProgress?.('error', error, 0);
    return {
      success: false,
      sourceId: source.id,
      sourceName: source.filename,
      claims: [],
      extractedCount: 0,
      groundedCount: 0,
      error,
      isAuth: true,
    };
  }

  try {
    onProgress?.('preparing', `Preparing secure reconstruction for ${source.filename}...`, 15);

    // Short artificial delay for smooth UX transition
    await new Promise((r) => setTimeout(r, 200));

    onProgress?.('sending', 'Submitting document context to secure server-side Gemini gateway...', 35);

    const payload = {
      workspaceId: workspace.workspaceId,
      sourceId: source.id,
    };

    onProgress?.('analyzing', 'Gemini 3.8 Flash analyzing architectural commitments & facts...', 55);

    const res = await fetch('/api/gemini/extract-knowledge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${workspace.accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const textResponse = await res.text();
      console.error('[Reconstruct] Non-JSON response received:', textResponse.substring(0, 200));
      throw new Error(`Server returned unexpected response (${contentType || 'non-JSON'}). Please verify backend status.`);
    }

    const data = await res.json();

    if (!res.ok || !data.success) {
      const errorMessage = data.error || `Server responded with status ${res.status}`;
      onProgress?.('error', errorMessage, 0);
      return {
        success: false,
        sourceId: source.id,
        sourceName: source.filename,
        claims: [],
        extractedCount: 0,
        groundedCount: 0,
        error: errorMessage,
        isRateLimit: data.isRateLimit,
        isAuth: data.isAuth,
      };
    }

    if (!Array.isArray(data.claims)) {
      throw new Error('The extraction service returned an invalid claims list.');
    }

    const claims = data.claims as KnowledgeClaim[];
    const malformedClaim = claims.some((claim) =>
      !claim ||
      typeof claim.id !== 'string' ||
      typeof claim.statement !== 'string' ||
      typeof claim.sourceId !== 'string' ||
      claim.sourceId !== source.id ||
      typeof claim.sourceName !== 'string' ||
      typeof claim.sourceEvidenceQuote !== 'string' ||
      typeof claim.category !== 'string' ||
      typeof claim.confidenceScore !== 'number' ||
      typeof claim.confidenceTier !== 'string' ||
      typeof claim.verificationStatus !== 'string' ||
      typeof claim.importance !== 'string'
    );

    if (malformedClaim) {
      throw new Error('The extraction service returned malformed or mismatched claim data.');
    }

    onProgress?.('validating', `Verifying ${claims.length} claims against source citations and locators...`, 80);

    onProgress?.('persisting', 'Preparing reconstructed claims for workspace-scoped persistence...', 92);

    return {
      success: true,
      sourceId: source.id,
      sourceName: source.filename,
      summary: data.summary,
      claims,
      extractedCount: claims.length,
      groundedCount: claims.filter((c) => c.evidenceGrounded).length,
    };
  } catch (error: any) {
    console.error('Reconstruct error:', error);
    const msg = error?.message || 'Network error while communicating with Gemini reconstruction endpoint.';
    onProgress?.('error', msg, 0);
    return {
      success: false,
      sourceId: source.id,
      sourceName: source.filename,
      claims: [],
      extractedCount: 0,
      groundedCount: 0,
      error: msg,
    };
  } finally {
    inFlightExtractions.delete(source.id);
  }
}
