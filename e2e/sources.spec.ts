import { test, expect, type Page } from '@playwright/test';

async function openDemoSources(page: Page) {
  await page.goto('/');

  const demoButton = page.getByRole('button', {
    name: /Explore interactive demo/i,
  });

  if (await demoButton.isVisible().catch(() => false)) {
    await demoButton.click();
    await expect(page.getByRole('status')).toContainText(
      'INTERACTIVE JUDGE DEMO',
    );
  }

  const navigation = page.getByRole('navigation');
  await expect(navigation).toBeVisible();

  const sourcesButton = navigation.getByRole('button', {
    name: /Sources/i,
  });

  await sourcesButton.click();
  await expect(sourcesButton).toHaveClass(/bg-\[#F36B3F\]/);

  await expect(
    page.getByPlaceholder('Search title, filename, or extracted text...'),
  ).toBeVisible();
}

test('uploaded document can be searched, inspected, and deleted', async ({
  page,
}) => {
  const fileName = `e2e-projectvault-${Date.now()}.txt`;
  const documentText =
    'PROJECTVAULT E2E VERIFICATION: The primary database must enforce workspace isolation and preserve source evidence.';

  await openDemoSources(page);

  await page.locator('input[type="file"]').setInputFiles({
    name: fileName,
    mimeType: 'text/plain',
    buffer: Buffer.from(documentText, 'utf-8'),
  });

  await expect(
    page.getByText('Successfully Ingested 1 Document(s)'),
  ).toBeVisible({ timeout: 15_000 });

  const search = page.getByPlaceholder(
    'Search title, filename, or extracted text...',
  );

  await search.fill(fileName);

  const sourceRow = page.getByRole('row').filter({
    hasText: fileName,
  });

  await expect(sourceRow).toBeVisible();

  await sourceRow.getByRole('button', { name: 'Inspect' }).click();

  await expect(
    page.getByRole('button', { name: 'Full Extracted Text' }),
  ).toBeVisible();

  await expect(page.getByText(documentText, { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Close modal' }).click();

  await expect(sourceRow).toBeVisible();

  await sourceRow.locator(
    'button[title="Delete this uploaded source"]',
  ).click();

  await sourceRow.getByRole('button', { name: 'Confirm' }).click();

  await expect(sourceRow).toHaveCount(0);
});

test('identical document upload is skipped as a duplicate', async ({
  page,
}) => {
  const fileName = `e2e-projectvault-duplicate-${Date.now()}.txt`;
  const documentText =
    'PROJECTVAULT DUPLICATE CHECK: Identical content must not create duplicate source records.';

  await openDemoSources(page);

  const fileInput = page.locator('input[type="file"]');

  const file = {
    name: fileName,
    mimeType: 'text/plain',
    buffer: Buffer.from(documentText, 'utf-8'),
  };

  await fileInput.setInputFiles(file);

  await expect(
    page.getByText('Successfully Ingested 1 Document(s)'),
  ).toBeVisible({ timeout: 15_000 });

  const search = page.getByPlaceholder(
    'Search title, filename, or extracted text...',
  );

  await search.fill(fileName);

  const sourceRows = page.getByRole('row').filter({
    hasText: fileName,
  });

  await expect(sourceRows).toHaveCount(1);

  await fileInput.setInputFiles(file);

  await expect(
    page.getByText(/1 duplicates, 0 failed/),
  ).toBeVisible({ timeout: 15_000 });

  await expect(sourceRows).toHaveCount(1);
});
