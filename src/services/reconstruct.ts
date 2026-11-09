/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Source, KnowledgeClaim } from '../types';
import { saveStoredClaims, deleteStoredClaimsBySourceId, saveStoredSource } from './db';

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
  onProgress?: ExtractionProgressCallback
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

  const textToAnalyze = source.extractedText || source.rawExcerpt || '';

  if (!textToAnalyze || textToAnalyze.trim().length === 0) {
    inFlightExtractions.delete(source.id);
    onProgress?.('error', 'Source contains no extracted text to reconstruct.', 0);
    return {
      success: false,
      sourceId: source.id,
      sourceName: source.filename,
      claims: [],
      extractedCount: 0,
      groundedCount: 0,
      error: 'Source document has no extractable text content.',
    };
  }

  try {
    onProgress?.('preparing', `Preparing ${source.filename} (${(source.charCount || textToAnalyze.length).toLocaleString()} chars)...`, 15);

    // Short artificial delay for smooth UX transition
    await new Promise((r) => setTimeout(r, 200));

    onProgress?.('sending', 'Submitting document context to secure server-side Gemini gateway...', 35);

    const payload = {
      sourceId: source.id,
      sourceName: source.filename,
      fileType: source.type,
      text: textToAnalyze,
      pages: source.pages?.map((p) => ({ pageNumber: p.pageNumber, text: p.text })),
    };

    onProgress?.('analyzing', 'Gemini 2.5 Flash analyzing architectural commitments & facts...', 55);

    const res = await fetch('/api/gemini/extract-knowledge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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

    onProgress?.('validating', `Verifying ${data.claims.length} claims against source citations and locators...`, 80);

    const claims: KnowledgeClaim[] = data.claims || [];

    onProgress?.('persisting', 'Persisting reconstructed claims into browser-side IndexedDB...', 92);

    // Remove previous claims for this source to prevent duplicate pollution upon reprocessing
    await deleteStoredClaimsBySourceId(source.id);

    // Save newly reconstructed claims
    await saveStoredClaims(claims);

    // Update source's claimsCount and reconstructStatus
    const updatedSource: Source = {
      ...source,
      claimsCount: claims.length,
      reconstructStatus: 'completed',
      reconstructedAt: new Date().toISOString(),
      summary: data.summary || source.summary,
    };
    await saveStoredSource(updatedSource);

    onProgress?.('completed', `Successfully reconstructed ${claims.length} evidence-grounded claims!`, 100);

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
