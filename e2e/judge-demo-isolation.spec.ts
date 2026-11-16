import { test, expect, type Page } from '@playwright/test';

async function seedDefaultWorkspaceStorage(page: Page) {
  await page.evaluate(async () => {
    const defaultClaims = [{ id: 'default-claim-marker', statement: 'Do not alter this default workspace record.' }];
    localStorage.setItem('projectvault_claims', JSON.stringify(defaultClaims));
    localStorage.setItem('projectvault_review_conflicts', JSON.stringify([
      { id: 'default-conflict-marker', title: 'Preserve this default conflict' },
    ]));

    const request = indexedDB.open('ProjectVault_DB', 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      const sources = db.createObjectStore('sources', { keyPath: 'id' });
      sources.createIndex('contentHash', 'contentHash', { unique: false });
      sources.createIndex('isUserUploaded', 'isUserUploaded', { unique: false });
      sources.createIndex('type', 'type', { unique: false });
      sources.createIndex('status', 'status', { unique: false });

      db.createObjectStore('source_files', { keyPath: 'id' });

      const claims = db.createObjectStore('claims', { keyPath: 'id' });
      claims.createIndex('sourceId', 'sourceId', { unique: false });
      claims.createIndex('category', 'category', { unique: false });
      claims.createIndex('verificationStatus', 'verificationStatus', { unique: false });
      claims.createIndex('isUserExtracted', 'isUserExtracted', { unique: false });
    };

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('sources', 'readwrite');
      transaction.objectStore('sources').put({
        id: 'default-source-marker',
        title: 'DEFAULT WORKSPACE PRESERVATION MARKER',
        filename: 'default-marker.txt',
        timestamp: Date.now(),
        claimsCount: 0,
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    db.close();
  });
}

async function readDefaultStorage(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('ProjectVault_DB', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const sources = await new Promise<unknown[]>((resolve, reject) => {
      const transaction = db.transaction('sources', 'readonly');
      const request = transaction.objectStore('sources').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();

    return {
      claims: localStorage.getItem('projectvault_claims'),
      conflicts: localStorage.getItem('projectvault_review_conflicts'),
      sources,
    };
  });
}

test('interactive Judge Demo keeps default workspace storage intact through entry, edits, exit, and reset', async ({ page }) => {
  const supabaseWriteRequests: string[] = [];
  page.on('request', (request) => {
    if (/(\.supabase\.co|\.invalid)$/i.test(new URL(request.url()).hostname)
      && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) {
      supabaseWriteRequests.push(request.method() + ' ' + request.url());
    }
  });

  await page.goto('/');
  const enterDemo = page.getByRole('button', { name: /Explore interactive demo/i });
  await expect(enterDemo).toBeVisible();

  await seedDefaultWorkspaceStorage(page);
  const before = await readDefaultStorage(page);

  await enterDemo.click();
  await expect(page.getByRole('status')).toContainText('INTERACTIVE JUDGE DEMO');

  const reviewNav = page.getByRole('navigation').getByRole('button', { name: /Review/i });
  await reviewNav.click();
  await page.getByRole('button', { name: /Claim Verification Queue/i }).click();
  await page.getByRole('button', { name: /Verify & Approve Claim/i }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('projectvault_judge_demo_claims'))).not.toBeNull();

  const sourcesNav = page.getByRole('navigation').getByRole('button', { name: /Sources/i });
  await sourcesNav.click();

  const fileName = `judge-demo-isolation-${Date.now()}.txt`;
  await page.locator('input[type="file"]').setInputFiles({
    name: fileName,
    mimeType: 'text/plain',
    buffer: Buffer.from('An isolated Judge Demo test document.', 'utf-8'),
  });
  await expect(page.getByText('Successfully Ingested 1 Document(s)')).toBeVisible({ timeout: 15_000 });

  const demoDbNames = await page.evaluate(async () => (await indexedDB.databases()).map((db) => db.name));
  expect(demoDbNames).toContain('ProjectVault_DB');
  expect(demoDbNames).toContain('ProjectVault_DB_judge_demo');

  const demoSourceExists = await page.evaluate(async (expectedName) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('ProjectVault_DB_judge_demo', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const sources = await new Promise<Array<{ filename?: string }>>((resolve, reject) => {
      const transaction = db.transaction('sources', 'readonly');
      const request = transaction.objectStore('sources').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return sources.some((source) => source.filename === expectedName);
  }, fileName);
  expect(demoSourceExists).toBe(true);

  await page.getByRole('button', { name: 'Exit demo' }).click();
  await expect(page.getByRole('button', { name: /Explore interactive demo/i })).toBeVisible();
  expect(await readDefaultStorage(page)).toEqual(before);

  await page.getByRole('button', { name: /Explore interactive demo/i }).click();
  await expect(page.getByRole('status')).toContainText('INTERACTIVE JUDGE DEMO');

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await expect(page.getByRole('button', { name: /Explore interactive demo/i })).toBeVisible();

  const afterReset = await readDefaultStorage(page);
  expect(afterReset).toEqual(before);

  const demoAfterReset = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('ProjectVault_DB_judge_demo', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const sources = await new Promise<unknown[]>((resolve, reject) => {
      const transaction = db.transaction('sources', 'readonly');
      const request = transaction.objectStore('sources').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return {
      sources,
      demoKeys: Object.keys(localStorage).filter((key) => key.startsWith('projectvault_judge_demo_')),
    };
  });

  expect(demoAfterReset.sources).toEqual([]);
  expect(demoAfterReset.demoKeys).toEqual([]);
  expect(supabaseWriteRequests).toEqual([]);
});
