import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60 * 1000,
  expect: { timeout: 10 * 1000 },
  use: {
    baseURL: 'http://localhost:8086',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'cargo run',
    url: 'http://localhost:8086',
    reuseExistingServer: true,
    timeout: 120 * 1000
  }
});
