/**
 * Boxy UI Screenshot Capture Script
 * Generates screenshots for docs/UI_WALKTHROUGH.md in both light and dark themes.
 * Run: node docs/capture-ui-screenshots.mjs
 * Requires: Server running at localhost:8086 with BOX_UPLOAD_DIR=./uploads_docs
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = path.join(__dirname, 'assets', 'images');
const PORT = process.env.BOX_PORT || 8086;
const BASE_URL = `http://localhost:${PORT}`;
const STAMP = '20260701';

fs.mkdirSync(IMAGES_DIR, { recursive: true });

function imgPath(slug, theme) {
  return path.join(IMAGES_DIR, `boxy-ui-${slug}-${theme}-${STAMP}.png`);
}

async function setTheme(page, theme) {
  await page.evaluate((t) => {
    localStorage.setItem('theme', t);
    document.documentElement.setAttribute('data-theme', t);
  }, theme);
  await page.waitForTimeout(100);
}

async function closeAllModals(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
  });
  await page.waitForTimeout(150);
}

async function capture(page, slug, theme, options = {}) {
  const filepath = imgPath(slug, theme);
  await page.screenshot({ path: filepath, fullPage: options.fullPage ?? true });
  console.log(`  Captured: ${path.basename(filepath)}`);
}

async function ensureView(page, mode) {
  const current = await page.evaluate(() => localStorage.getItem('viewMode') || 'grid');
  if (current !== mode) {
    await page.locator('#viewToggle').click();
    await page.waitForTimeout(200);
  }
}

async function openFolder(page, name) {
  const folder = page.locator('.file-item', { hasText: name }).first();
  if (await folder.isVisible().catch(() => false)) {
    await folder.click();
    await page.waitForTimeout(400);
  }
}

async function main() {
  console.log('Starting Boxy UI Screenshot Capture...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Output: ${IMAGES_DIR}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Create demo files
  const demoFilePath = '/tmp/boxy-demo-file.txt';
  const notesFilePath = '/tmp/boxy-notes.txt';
  const extraFilePath = '/tmp/boxy-extra.txt';
  fs.writeFileSync(demoFilePath, 'Demo content for Boxy UI walkthrough screenshot.\nGenerated on 2026-07-01.\n');
  fs.writeFileSync(notesFilePath, '# Notes\n\nBoxy UI walkthrough notes.\n');
  fs.writeFileSync(extraFilePath, 'Extra file used for selection and list view screenshots.\n');

  try {
    // A) Home screen (empty state)
    console.log('\nA) Home screen...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    for (const theme of ['dark', 'light']) {
      await setTheme(page, theme);
      await capture(page, 'home', theme);
    }

    // B) Create folder modal
    console.log('\nB) New folder modal...');
    for (const theme of ['dark', 'light']) {
      await page.goto(BASE_URL, { waitUntil: 'networkidle' });
      await setTheme(page, theme);
      await page.getByRole('button', { name: 'New Folder' }).click();
      await page.waitForSelector('#folderModal.active');
      await page.fill('#folderName', 'Projects');
      await capture(page, 'new-folder-modal', theme);
    }

    // C) Folder created
    console.log('\nC) Folder created...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'New Folder' }).click();
    await page.waitForSelector('#folderModal.active');
    await page.fill('#folderName', 'Projects');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForSelector('.file-item:has-text("Projects")');
    await page.waitForTimeout(300);
    for (const theme of ['dark', 'light']) {
      await setTheme(page, theme);
      await capture(page, 'folder-created', theme);
    }

    // D) Upload progress
    console.log('\nD) Upload progress...');
    await page.setInputFiles('#fileInput', [demoFilePath, notesFilePath, extraFilePath]);
    await page.waitForSelector('.upload-progress.show');
    await page.waitForTimeout(300);
    for (const theme of ['dark', 'light']) {
      await setTheme(page, theme);
      await capture(page, 'upload-progress', theme);
    }
    await page.waitForSelector('.file-item:has-text("boxy-demo-file.txt")');
    await page.waitForTimeout(300);

    // E) List view with inline folder expand
    console.log('\nE) List view...');
    for (const theme of ['dark', 'light']) {
      await closeAllModals(page);
      await setTheme(page, theme);
      await ensureView(page, 'list');
      await page.waitForTimeout(200);
      await capture(page, 'list-view', theme);
    }

    // F) Inline folder expand in list view
    console.log('\nF) Inline folder expand...');
    await ensureView(page, 'list');
    const folderRow = page.locator('.file-item[data-is-dir="true"]').first();
    if (await folderRow.isVisible().catch(() => false)) {
      await folderRow.click();
      await page.waitForTimeout(400);
    }
    for (const theme of ['dark', 'light']) {
      await setTheme(page, theme);
      await capture(page, 'list-inline-expand', theme);
    }

    // G) Inline rename
    console.log('\nG) Inline rename...');
    for (const theme of ['dark', 'light']) {
      await closeAllModals(page);
      await setTheme(page, theme);
      await ensureView(page, 'list');
      const listRow = page.locator('.file-item[data-is-dir="false"]').first();
      await listRow.hover();
      await page.waitForTimeout(150);
      await listRow.locator('button[title="Rename"]').click();
      await page.waitForSelector('.inline-rename');
      await capture(page, 'inline-rename', theme);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
    }

    // H) Bulk selection bar
    console.log('\nH) Bulk selection bar...');
    for (const theme of ['dark', 'light']) {
      await setTheme(page, theme);
      await ensureView(page, 'grid');
      await page.goto(BASE_URL, { waitUntil: 'networkidle' });
      await setTheme(page, theme);
      const firstItem = page.locator('.file-item').nth(0);
      const secondItem = page.locator('.file-item').nth(1);
      await firstItem.click();
      await secondItem.click({ modifiers: ['Control'] });
      await page.waitForSelector('#selectionBar.show');
      await capture(page, 'bulk-selection', theme);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
    }

    // I) Move modal
    console.log('\nI) Move modal...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    for (const theme of ['dark', 'light']) {
      await closeAllModals(page);
      await setTheme(page, theme);
      await ensureView(page, 'grid');
      const fileCard = page.locator('.file-item[data-is-dir="false"]').first();
      await fileCard.hover();
      await page.waitForTimeout(100);
      await fileCard.locator('button[title="Move"]').click();
      await page.waitForSelector('#moveModal.active');
      await capture(page, 'move-modal', theme);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
    }

    // J) Editor with syntax highlighting
    console.log('\nJ) Editor (syntax highlight)...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    for (const theme of ['dark', 'light']) {
      await closeAllModals(page);
      await setTheme(page, theme);
      const fileCard = page.locator('.file-item[data-is-dir="false"]').first();
      if (await fileCard.isVisible().catch(() => false)) {
        await fileCard.dblclick();
        await page.waitForTimeout(600);
      }
      await capture(page, 'editor', theme);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }

    // K) Context menu
    console.log('\nK) Context menu...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    for (const theme of ['dark', 'light']) {
      await setTheme(page, theme);
      const fileCard = page.locator('.file-item[data-is-dir="false"]').first();
      if (await fileCard.isVisible().catch(() => false)) {
        await fileCard.click({ button: 'right' });
        await page.waitForTimeout(200);
      }
      await capture(page, 'context-menu', theme);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
    }

    // L) Search
    console.log('\nL) Search...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(200);
    for (const theme of ['dark', 'light']) {
      await setTheme(page, theme);
      await page.fill('#searchInput', 'boxy');
      await page.waitForTimeout(600);
      await capture(page, 'search', theme);
      await page.fill('#searchInput', '');
      await page.waitForTimeout(200);
    }

    // M) WebSocket sync (two tabs)
    console.log('\nM) WebSocket sync...');
    const page2 = await context.newPage();
    await page2.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    for (const theme of ['dark', 'light']) {
      await setTheme(page, theme);
      await setTheme(page2, theme);
      await page.waitForTimeout(100);
      await capture(page, 'websocket-sync', theme);
    }
    await page2.close();

    console.log('\n=== Screenshot capture complete! ===');
    console.log(`Output directory: ${IMAGES_DIR}`);

  } catch (error) {
    console.error('Error during capture:', error.message);
    throw error;
  } finally {
    await browser.close();
    for (const f of [demoFilePath, notesFilePath, extraFilePath]) {
      try { fs.unlinkSync(f); } catch {}
    }
  }
}

main().catch(console.error);
