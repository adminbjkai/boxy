import { defineConfig } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Tests must never reuse the production server or its uploads.
const root = process.env.BOX_E2E_ROOT || mkdtempSync(join(tmpdir(), 'boxy-e2e-'));
process.env.BOX_E2E_ROOT = root;
export default defineConfig({
  testDir: './tests',
  globalTeardown: './tests/global-teardown.ts',
  workers: 2,
  fullyParallel: true,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: { baseURL: 'http://127.0.0.1:18087', trace: 'retain-on-failure' },
  webServer: {
    command: 'cargo run --locked',
    env: { RUST_LOG: 'warn', BOX_MAX_UPLOAD_BYTES: '1048576', BOX_PORT: '18087', BOX_BIND_ADDR: '127.0.0.1', BOX_UPLOAD_DIR: join(root, 'uploads'), BOX_THUMB_DIR: join(root, 'thumbs') },
    url: 'http://127.0.0.1:18087/api/health',
    reuseExistingServer: false,
    timeout: 180_000
  }
});
