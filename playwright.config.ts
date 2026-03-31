import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: process.env.BASE_URL || 'https://takehome-desktop.d.tekvisionflow.com',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop-v1',
      use: { desktopPath: '/desktop' } as any,
    },
    {
      name: 'desktop-v2',
      use: { desktopPath: '/desktopv2' } as any,
    },
  ],
});
