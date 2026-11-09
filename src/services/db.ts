/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Source, KnowledgeClaim, ProjectConflict, MissingInfoFinding, UnresolvedQuestion } from '../types';

// ... existing code ...

/**
 * Review Engine Persistence Functions
 */
export async function getAllStoredConflicts(): Promise<ProjectConflict[]> {
  try {
    const data = localStorage.getItem('projectvault_review_conflicts');
    if (data) return JSON.parse(data);
  } catch (e) {
    console.warn('localStorage conflicts load failed:', e);
  }
  return [];
}

export async function saveStoredConflicts(conflicts: ProjectConflict[]): Promise<void> {
  try {
    localStorage.setItem('projectvault_review_conflicts', JSON.stringify(conflicts));
  } catch (e) {
    console.warn('localStorage conflicts save failed:', e);
  }
}

export async function getAllStoredMissingInfo(): Promise<MissingInfoFinding[]> {
  try {
    const data = localStorage.getItem('projectvault_review_missing');
    if (data) return JSON.parse(data);
  } catch (e) {
    console.warn('localStorage missing info load failed:', e);
  }
  return [];
}

export async function saveStoredMissingInfo(items: MissingInfoFinding[]): Promise<void> {
  try {
    localStorage.setItem('projectvault_review_missing', JSON.stringify(items));
  } catch (e) {
    console.warn('localStorage missing info save failed:', e);
  }
}

export async function getAllStoredQuestions(): Promise<UnresolvedQuestion[]> {
  try {
    const data = localStorage.getItem('projectvault_review_questions');
    if (data) return JSON.parse(data);
  } catch (e) {
    console.warn('localStorage questions load failed:', e);
  }
  return [];
}

export async function saveStoredQuestions(questions: UnresolvedQuestion[]): Promise<void> {
  try {
    localStorage.setItem('projectvault_review_questions', JSON.stringify(questions));
  } catch (e) {
    console.warn('localStorage questions save failed:', e);
  }
}

const DB_NAME = 'ProjectVault_DB';
const DB_VERSION = 2; // Incremented for claims store
const STORE_SOURCES = 'sources';
const STORE_FILES = 'source_files';
const STORE_CLAIMS = 'claims';

// In-memory fallback in case IndexedDB is unavailable
const memorySources = new Map<string, Source>();
const memoryFiles = new Map<string, { blob: Blob; filename: string; mimeType: string }>();
const memoryClaims = new Map<string, KnowledgeClaim>();

let dbPromise: Promise<IDBDatabase> | null = null;

function isIndexedDBAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && 'indexedDB' in window && window.indexedDB !== null;
  } catch {
    return false;
  }
}

export function getDB(): Promise<IDBDatabase> {
  if (!isIndexedDBAvailable()) {
    return Promise.reject(new Error('IndexedDB is not available in this environment. Falling back to memory storage.'));
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Sources metadata and extracted text store
        if (!db.objectStoreNames.contains(STORE_SOURCES)) {
          const sourceStore = db.createObjectStore(STORE_SOURCES, { keyPath: 'id' });
          sourceStore.createIndex('contentHash', 'contentHash', { unique: false });
          sourceStore.createIndex('isUserUploaded', 'isUserUploaded', { unique: false });
          sourceStore.createIndex('type', 'type', { unique: false });
          sourceStore.createIndex('status', 'status', { unique: false });
        }

        // Original binary files store (isolated to keep metadata queries fast)
        if (!db.objectStoreNames.contains(STORE_FILES)) {
          db.createObjectStore(STORE_FILES, { keyPath: 'id' });
        }

        // Claims store for extracted knowledge
        if (!db.objectStoreNames.contains(STORE_CLAIMS)) {
          const claimStore = db.createObjectStore(STORE_CLAIMS, { keyPath: 'id' });
          claimStore.createIndex('sourceId', 'sourceId', { unique: false });
          claimStore.createIndex('category', 'category', { unique: false });
          claimStore.createIndex('verificationStatus', 'verificationStatus', { unique: false });
          claimStore.createIndex('isUserExtracted', 'isUserExtracted', { unique: false });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.warn('Failed to open ProjectVault IndexedDB:', request.error);
        reject(request.error || new Error('Failed to open IndexedDB'));
      };
    } catch (err) {
      reject(err);
    }
  });

  return dbPromise;
}

/**
 * Retrieve all user-uploaded source records from IndexedDB
 */
export async function getAllStoredSources(): Promise<Source[]> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_SOURCES, 'readonly');
      const store = transaction.objectStore(STORE_SOURCES);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = (request.result as Source[]) || [];
        // Sort descending by timestamp or id
        results.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        resolve(results);
      };

      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('IndexedDB getAllStoredSources fallback to memory:', error);
    return Array.from(memorySources.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }
}

/**
 * Retrieve a specific source record by ID
 */
export async function getStoredSourceById(id: string): Promise<Source | null> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_SOURCES, 'readonly');
      const store = transaction.objectStore(STORE_SOURCES);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return memorySources.get(id) || null;
  }
}

/**
 * Save or update a source record in IndexedDB
 */
export async function saveStoredSource(source: Source): Promise<void> {
  memorySources.set(source.id, source);

  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_SOURCES, 'readwrite');
      const store = transaction.objectStore(STORE_SOURCES);
      const request = store.put(source);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('IndexedDB saveStoredSource saved in memory only:', error);
  }
}

/**
 * Store the original binary file
 */
export async function saveStoredFile(id: string, file: File): Promise<void> {
  const fileData = {
    id,
    filename: file.name,
    mimeType: file.type || 'application/octet-stream',
    blob: file,
    size: file.size,
    updatedAt: Date.now(),
  };

  memoryFiles.set(id, { blob: file, filename: file.name, mimeType: fileData.mimeType });

  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_FILES, 'readwrite');
      const store = transaction.objectStore(STORE_FILES);
      const request = store.put(fileData);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('IndexedDB saveStoredFile saved in memory only:', error);
  }
}

/**
 * Retrieve original binary file for downloading
 */
export async function getStoredFile(id: string): Promise<{ blob: Blob; filename: string; mimeType: string } | null> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_FILES, 'readonly');
      const store = transaction.objectStore(STORE_FILES);
      const request = store.get(id);

      request.onsuccess = () => {
        if (request.result && request.result.blob) {
          resolve({
            blob: request.result.blob,
            filename: request.result.filename,
            mimeType: request.result.mimeType,
          });
        } else {
          resolve(memoryFiles.get(id) || null);
        }
      };

      request.onerror = () => resolve(memoryFiles.get(id) || null);
    });
  } catch {
    return memoryFiles.get(id) || null;
  }
}

/**
 * Delete a source, its associated stored file, and all associated claims
 */
export async function deleteStoredSource(id: string): Promise<void> {
  memorySources.delete(id);
  memoryFiles.delete(id);

  // Remove in-memory claims for this source
  for (const [claimId, claim] of memoryClaims.entries()) {
    if (claim.sourceId === id) {
      memoryClaims.delete(claimId);
    }
  }

  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_SOURCES, STORE_FILES, STORE_CLAIMS], 'readwrite');
      const sourceStore = transaction.objectStore(STORE_SOURCES);
      const fileStore = transaction.objectStore(STORE_FILES);
      const claimStore = transaction.objectStore(STORE_CLAIMS);

      sourceStore.delete(id);
      fileStore.delete(id);

      // Delete claims matching sourceId index
      const index = claimStore.index('sourceId');
      const request = index.openCursor(IDBKeyRange.only(id));
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.warn('IndexedDB deleteStoredSource deleted from memory only:', error);
  }
}

/**
 * Check if a source with identical content hash already exists
 */
export async function findDuplicateSourceByHash(hash: string): Promise<Source | null> {
  if (!hash) return null;

  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_SOURCES, 'readonly');
      const store = transaction.objectStore(STORE_SOURCES);
      const index = store.index('contentHash');
      const request = index.get(hash);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    for (const source of memorySources.values()) {
      if (source.contentHash === hash) return source;
    }
    return null;
  }
}

/**
 * Save an array of knowledge claims to IndexedDB and localStorage backup with diagnostics
 */
export async function saveStoredClaims(claims: KnowledgeClaim[]): Promise<void> {
  if (!claims || claims.length === 0) return;

  for (const claim of claims) {
    memoryClaims.set(claim.id, claim);
    console.log(`[DIAGNOSTIC] saveStoredClaims called for claim ${claim.id}:`, {
      id: claim.id,
      verificationStatus: claim.verificationStatus,
      isFlagged: claim.isFlagged,
      statement: claim.statement?.substring(0, 40),
    });
  }

  // Backup to localStorage for 100% reliable cross-refresh persistence
  let localStorageSuccess = false;
  try {
    const existingMap = new Map<string, KnowledgeClaim>();
    const localData = localStorage.getItem('projectvault_claims');
    if (localData) {
      const parsed: KnowledgeClaim[] = JSON.parse(localData);
      parsed.forEach((c) => existingMap.set(c.id, c));
    }
    claims.forEach((c) => existingMap.set(c.id, c));
    localStorage.setItem('projectvault_claims', JSON.stringify(Array.from(existingMap.values())));
    localStorageSuccess = true;
    console.log('[DIAGNOSTIC] localStorage write SUCCESS for claims:', claims.map(c => ({ id: c.id, status: c.verificationStatus, flag: c.isFlagged })));
  } catch (e) {
    console.error('[DIAGNOSTIC] localStorage claims save FAILED:', e);
    throw e;
  }

  let indexedDBSuccess = false;
  try {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_CLAIMS, 'readwrite');
      const store = transaction.objectStore(STORE_CLAIMS);

      for (const claim of claims) {
        store.put(claim);
      }

      transaction.oncomplete = () => {
        indexedDBSuccess = true;
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Transaction aborted'));
    });
    console.log('[DIAGNOSTIC] IndexedDB write SUCCESS for claims:', claims.map(c => c.id));
  } catch (error) {
    console.error('[DIAGNOSTIC] IndexedDB saveStoredClaims FAILED:', error);
    throw error;
  }

  // Immediate read-back validation test
  try {
    const immediateCheck = await getAllStoredClaims();
    const verifiedReadBack = claims.every(c => {
      const found = immediateCheck.find(fc => fc.id === c.id);
      return found && found.verificationStatus === c.verificationStatus && found.isFlagged === c.isFlagged;
    });
    console.log('[DIAGNOSTIC] Immediate read-back verification test:', {
      success: verifiedReadBack,
      savedClaims: claims.map(c => ({ id: c.id, status: c.verificationStatus, isFlagged: c.isFlagged })),
      readBackClaims: claims.map(c => {
        const f = immediateCheck.find(fc => fc.id === c.id);
        return f ? { id: f.id, status: f.verificationStatus, isFlagged: f.isFlagged } : null;
      }),
      localStorageStatus: localStorageSuccess,
      indexedDBStatus: indexedDBSuccess,
    });
    if (!verifiedReadBack) {
      throw new Error('Immediate read-back validation failed: saved data does not match read-back data.');
    }
  } catch (err) {
    console.error('[DIAGNOSTIC] Immediate read-back assertion FAILED:', err);
    throw err;
  }
}

/**
 * Save a single knowledge claim
 */
export async function saveStoredClaim(claim: KnowledgeClaim): Promise<void> {
  return saveStoredClaims([claim]);
}

/**
 * Retrieve all persistent claims from IndexedDB with localStorage fallback/merge and diagnostics
 */
export async function getAllStoredClaims(): Promise<KnowledgeClaim[]> {
  let dbClaims: KnowledgeClaim[] = [];
  try {
    const db = await getDB();
    dbClaims = await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_CLAIMS, 'readonly');
      const store = transaction.objectStore(STORE_CLAIMS);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve((request.result as KnowledgeClaim[]) || []);
      };

      request.onerror = () => reject(request.error);
    });
    console.log(`[DIAGNOSTIC] Loaded ${dbClaims.length} claims from IndexedDB.`);
  } catch (error) {
    console.warn('[DIAGNOSTIC] IndexedDB getAllStoredClaims fallback:', error);
  }

  let localClaims: KnowledgeClaim[] = [];
  try {
    const localData = localStorage.getItem('projectvault_claims');
    if (localData) {
      localClaims = JSON.parse(localData);
    }
    console.log(`[DIAGNOSTIC] Loaded ${localClaims.length} claims from localStorage ('projectvault_claims').`);
  } catch (e) {
    console.warn('[DIAGNOSTIC] localStorage claims load failed:', e);
  }

  // Merge dbClaims and localClaims by id, falling back to memoryClaims
  const map = new Map<string, KnowledgeClaim>();
  memoryClaims.forEach((c) => map.set(c.id, c));
  localClaims.forEach((c) => map.set(c.id, c));
  dbClaims.forEach((c) => map.set(c.id, c));

  const finalClaims = Array.from(map.values());
  console.log(`[DIAGNOSTIC] getAllStoredClaims returned ${finalClaims.length} merged claims.`);
  return finalClaims;
}

/**
 * Retrieve all claims for a given source ID
 */
export async function getStoredClaimsBySourceId(sourceId: string): Promise<KnowledgeClaim[]> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_CLAIMS, 'readonly');
      const store = transaction.objectStore(STORE_CLAIMS);
      const index = store.index('sourceId');
      const request = index.getAll(IDBKeyRange.only(sourceId));

      request.onsuccess = () => {
        resolve((request.result as KnowledgeClaim[]) || []);
      };

      request.onerror = () => reject(request.error);
    });
  } catch {
    return Array.from(memoryClaims.values()).filter((c) => c.sourceId === sourceId);
  }
}

/**
 * Delete claims associated with a given source ID (used during reprocessing)
 */
export async function deleteStoredClaimsBySourceId(sourceId: string): Promise<void> {
  for (const [id, claim] of memoryClaims.entries()) {
    if (claim.sourceId === sourceId) {
      memoryClaims.delete(id);
    }
  }

  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_CLAIMS, 'readwrite');
      const store = transaction.objectStore(STORE_CLAIMS);
      const index = store.index('sourceId');
      const request = index.openCursor(IDBKeyRange.only(sourceId));

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.warn('IndexedDB deleteStoredClaimsBySourceId deleted from memory only:', error);
  }
}

/**
 * Delete a specific claim by ID
 */
export async function deleteStoredClaim(claimId: string): Promise<void> {
  memoryClaims.delete(claimId);

  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_CLAIMS, 'readwrite');
      const store = transaction.objectStore(STORE_CLAIMS);
      const request = store.delete(claimId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('IndexedDB deleteStoredClaim deleted from memory only:', error);
  }
}

/**
 * Update an individual claim's status, review notes, etc.
 */
export async function updateStoredClaim(claim: KnowledgeClaim): Promise<void> {
  return saveStoredClaim(claim);
}

/**
 * Clear all user-uploaded stored sources and claims
 */
export async function clearAllStoredSources(): Promise<void> {
  memorySources.clear();
  memoryFiles.clear();
  memoryClaims.clear();

  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_SOURCES, STORE_FILES, STORE_CLAIMS], 'readwrite');
      transaction.objectStore(STORE_SOURCES).clear();
      transaction.objectStore(STORE_FILES).clear();
      transaction.objectStore(STORE_CLAIMS).clear();

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.warn('IndexedDB clearAllStoredSources cleared memory only:', error);
  }
}
