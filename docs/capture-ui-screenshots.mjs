/**
 * Boxy UI Screenshot Capture Script
 * Generates screenshots for docs/UI_WALKTHROUGH.md in both light and dark themes
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
const STAMP = '20260206';

// Ensure images directory exists
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

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
  // Close modals by removing active class directly
  await page.evaluate(() => {
    document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
  });
  await page.waitForTimeout(150);
}

async function captureScreenshot(page, slug, theme, options = {}) {
  const filepath = imgPath(slug, theme);
  const fullPage = options.fullPage !== undefined ? options.fullPage : true;
  await page.screenshot({ path: filepath, fullPage });
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

async function resetBoards(page) {
  await page.evaluate(async () => {
    const defaultColumns = [
      { id: 'backlog', name: 'Backlog', order: 0 },
      { id: 'todo', name: 'Todo', order: 1 },
      { id: 'in-progress', name: 'In Progress', order: 2 },
      { id: 'done', name: 'Done', order: 3 }
    ];
    const boards = [{
      id: Date.now().toString(36),
      name: 'My Board',
      columns: defaultColumns,
      tasks: [],
      createdAt: Date.now()
    }];
    await fetch('/api/data/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(boards)
    });
  });
  await page.waitForTimeout(300);
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
  const largeUploadPath = '/tmp/boxy-large-upload.bin';
  fs.writeFileSync(demoFilePath, 'Demo content for Boxy UI walkthrough screenshot.\nGenerated on 2026-02-06.\n');
  fs.writeFileSync(notesFilePath, 'Notes for Boxy UI walkthrough.\n');
  fs.writeFileSync(extraFilePath, 'Extra file used for selection and list view screenshots.\n');
  fs.writeFileSync(largeUploadPath, Buffer.alloc(50 * 1024 * 1024, 0));

  try {
    // A) Home screen (empty state)
    console.log('\nA) Home screen...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Drop files here');
    for (const theme of ['light', 'dark']) {
      await setTheme(page, theme);
      await captureScreenshot(page, 'home', theme);
    }

    // B) Create folder modal
    console.log('\nB) New folder modal...');
    for (const theme of ['light', 'dark']) {
      await page.goto(BASE_URL, { waitUntil: 'networkidle' });
      await setTheme(page, theme);
      await page.getByRole('button', { name: 'New Folder' }).click();
      await page.waitForSelector('#folderModal.active');
      await page.fill('#folderName', 'Projects');
      await captureScreenshot(page, 'new-folder-modal', theme);
    }

    // C) Folder created (do once, capture both themes)
    console.log('\nC) Folder created...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'New Folder' }).click();
    await page.waitForSelector('#folderModal.active');
    await page.fill('#folderName', 'Projects');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForSelector('.file-item:has-text("Projects")');
    await page.waitForTimeout(300);
    for (const theme of ['light', 'dark']) {
      await setTheme(page, theme);
      await captureScreenshot(page, 'folder-created', theme);
    }

    // D) Upload progress (per-file status)
    console.log('\nD) Upload progress...');
    await page.setInputFiles('#fileInput', [largeUploadPath, demoFilePath, notesFilePath, extraFilePath]);
    await page.waitForSelector('.upload-progress.show');
    await page.waitForSelector('.upload-progress-item');
    await page.waitForTimeout(300);
    for (const theme of ['light', 'dark']) {
      await setTheme(page, theme);
      await captureScreenshot(page, 'upload-progress', theme);
    }
    await page.waitForSelector('.file-item:has-text("boxy-demo-file.txt")');
    await page.waitForTimeout(300);

    // E) Inline rename (list view)
    console.log('\nE) Inline rename...');
    for (const theme of ['light', 'dark']) {
      await closeAllModals(page);
      await setTheme(page, theme);
      await ensureView(page, 'list');
      const listRow = page.locator('.file-item', { hasText: 'boxy-notes.txt' }).first();
      await listRow.hover();
      await page.waitForTimeout(150);
      await listRow.locator('button[title="Rename"]').click();
      await page.waitForSelector('.inline-rename-input');
      await captureScreenshot(page, 'inline-rename', theme);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
    }

    // F) Bulk selection bar
    console.log('\nF) Bulk selection bar...');
    for (const theme of ['light', 'dark']) {
      await setTheme(page, theme);
      await ensureView(page, 'grid');
      const firstItem = page.locator('.file-item').nth(0);
      const secondItem = page.locator('.file-item').nth(1);
      await firstItem.click();
      await secondItem.click({ modifiers: ['Control'] });
      await page.waitForSelector('#selectionBar.show');
      await captureScreenshot(page, 'bulk-selection', theme);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
    }

    // G) Rename modal
    console.log('\nG) Rename modal...');
    for (const theme of ['light', 'dark']) {
      await closeAllModals(page);
      await setTheme(page, theme);
      await ensureView(page, 'grid');
      const fileCard = page.locator('.file-item', { hasText: 'boxy-demo-file.txt' }).first();
      await fileCard.hover();
      await page.waitForTimeout(100);
      await fileCard.locator('button[title="Rename"]').click();
      await page.waitForSelector('#renameModal.active');
      await page.fill('#renameName', 'report-final.txt');
      await captureScreenshot(page, 'rename-modal', theme);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
    }

    // H) Rename complete
    console.log('\nH) Rename complete...');
    await closeAllModals(page);
    await ensureView(page, 'grid');
    const fileCardRename = page.locator('.file-item', { hasText: 'boxy-demo-file.txt' }).first();
    await fileCardRename.hover();
    await fileCardRename.locator('button[title="Rename"]').click();
    await page.waitForSelector('#renameModal.active');
    await page.fill('#renameName', 'report-final.txt');
    await page.locator('#renameModal').getByRole('button', { name: 'Rename' }).click();
    await page.waitForSelector('.file-item:has-text("report-final.txt")');
    await page.waitForTimeout(300);
    for (const theme of ['light', 'dark']) {
      await setTheme(page, theme);
      await captureScreenshot(page, 'rename-complete', theme);
    }

    // I) Move modal (light theme only - capture before move)
    console.log('\nI) Move modal...');
    await closeAllModals(page);
    await setTheme(page, 'light');
    let fileCardMove = page.locator('.file-item', { hasText: 'report-final.txt' }).first();
    await fileCardMove.hover();
    await page.waitForTimeout(100);
    await fileCardMove.locator('button[title="Move"]').click();
    await page.waitForSelector('#moveModal.active');
    await page.locator('#moveModal .tree-folder-name', { hasText: 'Projects' }).click();
    await page.waitForTimeout(200);
    await captureScreenshot(page, 'move-modal', 'light');
    // Dark theme
    await setTheme(page, 'dark');
    await page.waitForTimeout(100);
    await captureScreenshot(page, 'move-modal', 'dark');

    // J) Folder view after move - actually perform the move
    console.log('\nJ) Folder view after move...');
    await page.locator('#moveModal').getByRole('button', { name: 'Move here' }).click();
    await page.waitForTimeout(500);
    await openFolder(page, 'Projects');
    for (const theme of ['light', 'dark']) {
      await setTheme(page, theme);
      await captureScreenshot(page, 'folder-view', theme);
    }

    // K) Search filtered
    console.log('\nK) Search filtered...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(200);
    for (const theme of ['light', 'dark']) {
      await setTheme(page, theme);
      await page.fill('#searchInput', 'report');
      await page.waitForTimeout(600);
      await captureScreenshot(page, 'search-filtered', theme);
      await page.fill('#searchInput', '');
      await page.waitForTimeout(200);
    }

    // L) Sort applied
    console.log('\nL) Sort applied...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    for (const theme of ['light', 'dark']) {
      await setTheme(page, theme);
      const sortSelect = page.locator('#sortSelect');
      if (await sortSelect.isVisible().catch(() => false)) {
        await sortSelect.selectOption('size');
        await page.waitForTimeout(200);
      }
      await captureScreenshot(page, 'sort-applied', theme);
    }

    // M) Download (hover to show download button)
    console.log('\nM) Download...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await openFolder(page, 'Projects');
    await page.waitForTimeout(200);
    for (const theme of ['light', 'dark']) {
      await setTheme(page, theme);
      const dlCard = page.locator('.file-item').first();
      if (await dlCard.isVisible().catch(() => false)) {
        await dlCard.hover();
        await page.waitForTimeout(200);
      }
      await captureScreenshot(page, 'download', theme);
    }

    // N) New file creation
    console.log('\nN) New file...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    const newFileBtn = page.getByRole('button', { name: 'New File' });
    if (await newFileBtn.isVisible().catch(() => false)) {
      for (const theme of ['light', 'dark']) {
        await setTheme(page, theme);
        await newFileBtn.click();
        await page.waitForTimeout(300);
        await captureScreenshot(page, 'new-file', theme);
        await closeAllModals(page);
      }
    } else {
      console.log('  New File button not visible, capturing grid state...');
      for (const theme of ['light', 'dark']) {
        await setTheme(page, theme);
        await captureScreenshot(page, 'new-file', theme);
      }
    }

    // O) Edit content (double-click to preview/edit)
    console.log('\nO) Edit content...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await openFolder(page, 'Projects');
    await page.waitForTimeout(200);
    for (const theme of ['light', 'dark']) {
      await closeAllModals(page);
      await setTheme(page, theme);
      const editCard = page.locator('.file-item').first();
      if (await editCard.isVisible().catch(() => false)) {
        await editCard.dblclick();
        await page.waitForTimeout(500);
      }
      await captureScreenshot(page, 'edit-content', theme);
    }

    // P) Delete
    console.log('\nP) Delete...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    // Upload a file to delete
    const deleteFilePath = '/tmp/boxy-delete-me.txt';
    fs.writeFileSync(deleteFilePath, 'This file will be deleted.\n');
    await page.setInputFiles('#fileInput', deleteFilePath);
    await page.waitForSelector('.file-item:has-text("boxy-delete-me.txt")');
    await page.waitForTimeout(300);
    for (const theme of ['light', 'dark']) {
      await setTheme(page, theme);
      const delCard = page.locator('.file-item', { hasText: 'boxy-delete-me.txt' }).first();
      await delCard.hover();
      await page.waitForTimeout(150);
      await captureScreenshot(page, 'delete', theme);
    }
    // Actually delete
    const delCard2 = page.locator('.file-item', { hasText: 'boxy-delete-me.txt' }).first();
    await delCard2.hover();
    await delCard2.locator('button[title="Delete"]').click();
    await page.waitForTimeout(400);

    // Q) Tasks board (empty CTA)
    console.log('\nQ) Tasks board (empty CTA)...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await resetBoards(page);
    const tasksTab = page.locator('button:has-text("Tasks"), [data-tab="tasks"], .tab:has-text("Tasks")').first();
    if (await tasksTab.isVisible().catch(() => false)) {
      await tasksTab.click();
      await page.waitForTimeout(400);
    }
    for (const theme of ['light', 'dark']) {
      await setTheme(page, theme);
      await captureScreenshot(page, 'tasks-board', theme);
    }

    // R) Tasks action
    console.log('\nR) Tasks action...');
    const addTaskBtn = page.locator('button:has-text("Add"), button:has-text("New Task"), .add-task').first();
    if (await addTaskBtn.isVisible().catch(() => false)) {
      await addTaskBtn.click();
      await page.waitForTimeout(300);
    }
    for (const theme of ['light', 'dark']) {
      await setTheme(page, theme);
      await captureScreenshot(page, 'tasks-action', theme);
    }

    // S) WebSocket sync (two tabs)
    console.log('\nS) WebSocket sync...');
    const page2 = await context.newPage();
    await page2.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    for (const theme of ['light', 'dark']) {
      await setTheme(page, theme);
      await setTheme(page2, theme);
      await page.waitForTimeout(100);
      await captureScreenshot(page, 'websocket-sync', theme);
    }
    await page2.close();

    console.log('\n=== Screenshot capture complete! ===');
    console.log(`Output directory: ${IMAGES_DIR}`);

  } catch (error) {
    console.error('Error during capture:', error.message);
    throw error;
  } finally {
    await browser.close();
    try { fs.unlinkSync(demoFilePath); } catch (e) {}
    try { fs.unlinkSync(notesFilePath); } catch (e) {}
    try { fs.unlinkSync(extraFilePath); } catch (e) {}
    try { fs.unlinkSync(largeUploadPath); } catch (e) {}
    try { fs.unlinkSync('/tmp/boxy-delete-me.txt'); } catch (e) {}
  }
}

main().catch(console.error);
