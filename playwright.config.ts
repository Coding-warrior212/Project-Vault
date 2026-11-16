import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  timeout: 30_000,

  use: {
    baseURL: 'http://127.0.0.1:3000',
    ...devices['Desktop Chrome'],
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    // Give E2E a deliberately non-production Supabase config so AuthGate exposes
    // the interactive demo entry point without connecting to a real project.
    env: {
      VITE_SUPABASE_URL: 'https://projectvault-e2e.invalid',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'e2e-only-publishable-key',
    },
    url: 'http://127.0.0.1:3000/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
