/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PageContent, SourceType, ExtractionStatus } from '../types';

// Set worker source for pdfjs-dist
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker || `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  }
}

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export interface FileValidationResult {
  isValid: boolean;
  type?: SourceType;
  error?: string;
}

export interface ExtractedDocumentData {
  text: string;
  pages?: PageContent[];
  pageCount?: number;
  charCount: number;
  wordCount: number;
  summary: string;
  rawExcerpt: string;
  extractionStatus: ExtractionStatus;
  errorMessage?: string;
  contentHash: string;
}

/**
 * Validate file format, MIME type, and size
 */
export function validateFile(file: File): FileValidationResult {
  if (!file) {
    return { isValid: false, error: 'No file provided.' };
  }

  // Check empty file
  if (file.size === 0) {
    return {
      isValid: false,
      error: `File "${file.name}" is empty (0 bytes). Documents must contain text content.`,
    };
  }

  // Check 20 MB size limit
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      isValid: false,
      error: `File "${file.name}" exceeds the 20 MB limit (${sizeInMB} MB). Please choose a smaller file.`,
    };
  }

  // Determine file type from extension and mime
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'pdf' || file.type === 'application/pdf') {
    return { isValid: true, type: 'pdf' };
  }

  if (extension === 'md' || file.type === 'text/markdown') {
    return { isValid: true, type: 'markdown' };
  }

  if (extension === 'txt' || file.type === 'text/plain') {
    return { isValid: true, type: 'text' };
  }

  return {
    isValid: false,
    error: `Unsupported format for "${file.name}". ProjectVault currently supports PDF (.pdf), Markdown (.md), and Plain text (.txt) files.`,
  };
}

/**
 * Format raw byte count into human readable string
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Compute SHA-256 hash of a file for duplicate checking
 */
export async function computeFileHash(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    console.warn('Crypto subtle SHA-256 failed, using fallback hash:', err);
    return `hash-${file.name}-${file.size}-${file.lastModified}`;
  }
}

/**
 * Sanitize filename to prevent directory traversal or malformed display
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/^.*[\\/]/, '') // Strip path directories
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_') // Replace illegal chars
    .trim();
}

/**
 * Extract actual text from a PDF file using pdfjs-dist
 */
async function extractPdfText(
  file: File,
  onProgress?: (message: string, percent: number) => void
): Promise<{
  text: string;
  pages: PageContent[];
  pageCount: number;
  extractionStatus: ExtractionStatus;
  errorMessage?: string;
}> {
  onProgress?.('Loading PDF document structure...', 20);
  const arrayBuffer = await file.arrayBuffer();

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      useSystemFonts: true,
    });

    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    const pages: PageContent[] = [];
    let combinedText = '';

    onProgress?.(`Extracting text across ${numPages} page(s)...`, 35);

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Cleanly join text items, observing line positions
      let lastY: number | null = null;
      let pageText = '';

      for (const item of textContent.items) {
        if ('str' in item) {
          const textItem = item as { str: string; transform: number[] };
          const currentY = textItem.transform[5];

          if (lastY !== null && Math.abs(currentY - lastY) > 5) {
            pageText += '\n';
          } else if (pageText.length > 0 && !pageText.endsWith(' ') && !pageText.endsWith('\n') && !textItem.str.startsWith(' ')) {
            pageText += ' ';
          }

          pageText += textItem.str;
          lastY = currentY;
        }
      }

      const trimmedPageText = pageText.trim();
      pages.push({
        pageNumber: pageNum,
        text: trimmedPageText,
        charCount: trimmedPageText.length,
      });

      if (combinedText.length > 0 && trimmedPageText.length > 0) {
        combinedText += '\n\n';
      }
      combinedText += trimmedPageText;

      const progressPercent = 35 + Math.round((pageNum / numPages) * 55);
      onProgress?.(`Parsed page ${pageNum} of ${numPages}...`, progressPercent);
    }

    const totalExtractedChars = combinedText.trim().length;

    // Detect scanned/rasterized PDF with zero characters
    if (totalExtractedChars === 0) {
      return {
        text: '',
        pages,
        pageCount: numPages,
        extractionStatus: 'unsupported_scanned',
        errorMessage: 'No extractable text found in this PDF. Scanned or image-only documents require OCR (optical character recognition), which is not supported in this stage.',
      };
    }

    return {
      text: combinedText,
      pages,
      pageCount: numPages,
      extractionStatus: 'success',
    };
  } catch (error: any) {
    console.error('PDF parsing error:', error);

    if (error?.name === 'PasswordException') {
      return {
        text: '',
        pages: [],
        pageCount: 0,
        extractionStatus: 'failed',
        errorMessage: 'This PDF document is password-protected. Please remove encryption before uploading.',
      };
    }

    if (error?.name === 'InvalidPDFException') {
      return {
        text: '',
        pages: [],
        pageCount: 0,
        extractionStatus: 'failed',
        errorMessage: 'Invalid or corrupted PDF file. The document could not be read.',
      };
    }

    return {
      text: '',
      pages: [],
      pageCount: 0,
      extractionStatus: 'failed',
      errorMessage: `Failed to extract PDF text: ${error?.message || 'Unknown parser error'}.`,
    };
  }
}

/**
 * Main extractor controller for PDF, Markdown, and Plain text
 */
export async function extractDocument(
  file: File,
  onProgress?: (message: string, percent: number) => void
): Promise<ExtractedDocumentData> {
  const validation = validateFile(file);
  if (!validation.isValid || !validation.type) {
    throw new Error(validation.error || 'Invalid file.');
  }

  onProgress?.('Computing file fingerprint (SHA-256)...', 10);
  const contentHash = await computeFileHash(file);

  let rawText = '';
  let pages: PageContent[] | undefined;
  let pageCount: number | undefined;
  let extractionStatus: ExtractionStatus = 'success';
  let errorMessage: string | undefined;

  if (validation.type === 'pdf') {
    const pdfResult = await extractPdfText(file, onProgress);
    rawText = pdfResult.text;
    pages = pdfResult.pages;
    pageCount = pdfResult.pageCount;
    extractionStatus = pdfResult.extractionStatus;
    errorMessage = pdfResult.errorMessage;
  } else {
    // Markdown or Plain Text
    onProgress?.('Reading text content (UTF-8)...', 50);
    rawText = await file.text();

    if (rawText.trim().length === 0) {
      extractionStatus = 'empty';
      errorMessage = 'The document was read successfully but contains no readable text characters.';
    } else {
      extractionStatus = 'success';
    }
  }

  onProgress?.('Synthesizing metadata and character metrics...', 95);

  const charCount = rawText.length;
  const wordCount = rawText.trim().length > 0 ? rawText.trim().split(/\s+/).length : 0;

  // Generate an excerpt (first 300 chars)
  const cleanExcerpt = rawText.trim().slice(0, 320).replace(/\s+/g, ' ');
  const rawExcerpt = cleanExcerpt.length > 0 ? (cleanExcerpt.length >= 320 ? `${cleanExcerpt}...` : cleanExcerpt) : '(No extractable excerpt)';

  // Generate a synthesized summary for UI display
  let summary = '';
  if (validation.type === 'pdf') {
    summary = `Parsed PDF artifact containing ${pageCount || 1} page(s) and ${charCount.toLocaleString()} extracted characters.`;
  } else if (validation.type === 'markdown') {
    const headingMatches = rawText.match(/^#+\s+.+$/gm) || [];
    summary = `Markdown document with ${headingMatches.length} section heading(s) and ${wordCount.toLocaleString()} words.`;
  } else {
    const lineCount = rawText.split('\n').length;
    summary = `Plain text specification containing ${lineCount.toLocaleString()} line(s) and ${wordCount.toLocaleString()} words.`;
  }

  if (errorMessage) {
    summary = errorMessage;
  }

  onProgress?.('Complete', 100);

  return {
    text: rawText,
    pages,
    pageCount,
    charCount,
    wordCount,
    summary,
    rawExcerpt,
    extractionStatus,
    errorMessage,
    contentHash,
  };
}
