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
const STAMP = '20260118';

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

async function captureScreenshot(page, slug, theme) {
  const filepath = imgPath(slug, theme);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`  Captured: ${path.basename(filepath)}`);
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
  fs.writeFileSync(demoFilePath, 'Demo content for Boxy UI walkthrough screenshot.\nGenerated on 2026-01-18.\n');

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

    // D) Upload file
    console.log('\nD) Upload complete...');
    await page.setInputFiles('#fileInput', demoFilePath);
    await page.waitForSelector('.file-item:has-text("boxy-demo-file.txt")');
    await page.waitForTimeout(300);
    for (const theme of ['light', 'dark']) {
      await setTheme(page, theme);
      await captureScreenshot(page, 'upload-complete', theme);
    }

    // E) Rename modal
    console.log('\nE) Rename modal...');
    for (const theme of ['light', 'dark']) {
      await closeAllModals(page);
      await setTheme(page, theme);
      const fileCard = page.locator('.file-item', { hasText: 'boxy-demo-file.txt' }).first();
      await fileCard.hover();
      await page.waitForTimeout(100);
      await fileCard.locator('button[title="Rename"]').click();
      await page.waitForSelector('#renameModal.active');
      await page.fill('#renameName', 'report-final.txt');
      await captureScreenshot(page, 'rename-modal', theme);
    }

    // F) Rename complete
    console.log('\nF) Rename complete...');
    await closeAllModals(page);
    // Actually rename
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

    // G) Move modal (light theme only - capture before move)
    console.log('\nG) Move modal...');
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

    // H) Folder view after move - actually perform the move
    console.log('\nH) Folder view after move...');
    await page.locator('#moveModal').getByRole('button', { name: 'Move here' }).click();
    await page.waitForTimeout(500);
    // Navigate into Projects folder
    await page.locator('.file-item', { hasText: 'Projects' }).click();
    await page.waitForTimeout(500);
    for (const theme of ['light', 'dark']) {
      await setTheme(page, theme);
      await captureScreenshot(page, 'folder-view', theme);
    }

    // I) Search filtered
    console.log('\nI) Search filtered...');
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

    // J) Sort applied
    console.log('\nJ) Sort applied...');
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

    // K) Download (hover to show download button)
    console.log('\nK) Download...');
    // Navigate to Projects folder which contains report-final.txt
    await page.goto(BASE_URL + '?path=Projects', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    for (const theme of ['light', 'dark']) {
      await setTheme(page, theme);
      // Hover over any file item to show actions
      const dlCard = page.locator('.file-item').first();
      if (await dlCard.isVisible().catch(() => false)) {
        await dlCard.hover();
        await page.waitForTimeout(200);
      }
      await captureScreenshot(page, 'download', theme);
    }

    // L) New file creation
    console.log('\nL) New file...');
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

    // M) Edit content (double-click to preview/edit)
    console.log('\nM) Edit content...');
    await page.goto(BASE_URL + '?path=Projects', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
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

    // N) Delete
    console.log('\nN) Delete...');
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

    // O) Tasks board
    console.log('\nO) Tasks board...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    // Look for tasks tab/button
    const tasksTab = page.locator('button:has-text("Tasks"), [data-tab="tasks"], .tab:has-text("Tasks")').first();
    if (await tasksTab.isVisible().catch(() => false)) {
      await tasksTab.click();
      await page.waitForTimeout(400);
    }
    for (const theme of ['light', 'dark']) {
      await setTheme(page, theme);
      await captureScreenshot(page, 'tasks-board', theme);
    }

    // P) Tasks action
    console.log('\nP) Tasks action...');
    // Try to create a task if UI supports it
    const addTaskBtn = page.locator('button:has-text("Add"), button:has-text("New Task"), .add-task').first();
    if (await addTaskBtn.isVisible().catch(() => false)) {
      await addTaskBtn.click();
      await page.waitForTimeout(300);
    }
    for (const theme of ['light', 'dark']) {
      await setTheme(page, theme);
      await captureScreenshot(page, 'tasks-action', theme);
    }

    // Q) WebSocket sync (two tabs)
    console.log('\nQ) WebSocket sync...');
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
    try { fs.unlinkSync('/tmp/boxy-delete-me.txt'); } catch (e) {}
  }
}

main().catch(console.error);
