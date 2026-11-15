import { test, expect } from '@playwright/test';

test('interactive demo navigation works across all seven sections', async ({ page }) => {
  const pageErrors: string[] = [];

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.goto('/');

  // If authentication is required, enter the isolated local judge demo.
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

  const sections = [
    'Overview',
    'Sources',
    'Knowledge Ledger',
    'Knowledge Graph',
    'Review',
    'Handover',
    'Settings',
  ];

  for (const section of sections) {
    const button = navigation.getByRole('button', {
      name: new RegExp(section, 'i'),
    });

    await expect(button).toBeVisible();
    await button.click();

    // The selected section receives the application's active orange style.
    await expect(button).toHaveClass(/bg-\[#F36B3F\]/);
  }

  expect(pageErrors).toEqual([]);
});
