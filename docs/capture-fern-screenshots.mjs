/**
 * Boxy docs-site screenshot capture.
 * Regenerates the screenshots embedded in the Fern docs (fern/assets/*.png).
 *
 * Run against a throwaway instance seeded with demo content:
 *   BOX_PORT=18086 BOX_UPLOAD_DIR=./uploads_docs BOX_THUMB_DIR=/tmp/boxy-docs-thumbs \
 *     cargo run --release &
 *   node docs/capture-fern-screenshots.mjs
 *
 * Expects uploads_docs/ to contain: Code/main.rs, Notes/README.md, Photos/*.png,
 * plus a couple of root-level files (see fern docs "Cookbook" for seeding ideas).
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.BOX_PORT || 18086;
const BASE = `http://localhost:${PORT}`;
const OUT = path.join(__dirname, '..', 'fern', 'assets');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

const shot = async (name) => {
  await page.mouse.move(720, 870);          // clear hover tooltips
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log('captured', name);
};

const setTheme = async (t) => {
  await page.evaluate((t) => {
    localStorage.setItem('theme', t);
    document.documentElement.setAttribute('data-theme', t);
  }, t);
  await page.waitForTimeout(150);
};

const gotoPath = async (hash) => {
  await page.goto(`${BASE}/#${hash}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
};

const ensureGrid = async () => {
  const vm = await page.evaluate(() => localStorage.getItem('viewMode') || 'grid');
  if (vm !== 'grid') { await page.locator('#viewToggle').click(); await page.waitForTimeout(400); }
};

// Home grid, dark + light
await gotoPath('');
await setTheme('dark');
const expandAll = page.locator('button[data-tip*="Expand" i]').first();
if (await expandAll.isVisible().catch(() => false)) { await expandAll.click(); await page.waitForTimeout(400); }
await shot('home-dark');
await setTheme('light');
await shot('home-light');
await setTheme('dark');

// Thumbnails + lightbox
await gotoPath('Photos');
await page.waitForTimeout(1200);
await shot('thumbnails-dark');
await page.locator('.file-item[data-is-dir="false"]').first().dblclick();
await page.waitForTimeout(800);
await shot('lightbox-dark');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// List view
await gotoPath('');
const vm = await page.evaluate(() => localStorage.getItem('viewMode') || 'grid');
if (vm !== 'list') { await page.locator('#viewToggle').click(); await page.waitForTimeout(400); }
await shot('list-view-dark');

// Editor: code with syntax highlighting (view mode)
await gotoPath('Code');
await ensureGrid();
await page.evaluate(() => showEditModal('Code/main.rs'));
await page.waitForSelector('#editModal.active', { timeout: 8000 });
await page.waitForTimeout(800);
await page.evaluate(() => setEditMode('view'));
await page.waitForTimeout(500);
await shot('editor-code-dark');
await page.evaluate(() => closeEditModal());
await page.waitForTimeout(300);

// Editor: rendered markdown preview
await gotoPath('Notes');
await ensureGrid();
await page.evaluate(() => showEditModal('Notes/README.md'));
await page.waitForSelector('#editModal.active', { timeout: 8000 });
await page.waitForTimeout(800);
await page.evaluate(() => setEditMode('view'));
await page.waitForTimeout(500);
await shot('editor-markdown-dark');
await page.evaluate(() => closeEditModal());
await page.waitForTimeout(300);

// Context menu
await gotoPath('Code');
await ensureGrid();
await page.locator('.file-item[data-is-dir="false"]').first().click({ button: 'right' });
await page.waitForTimeout(300);
await shot('context-menu-dark');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// Global search
await gotoPath('');
await page.keyboard.press('/');
await page.waitForTimeout(300);
await page.fill('#globalSearchInput', 'notes');
await page.waitForTimeout(800);
await shot('global-search-dark');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// Shortcuts modal
await page.keyboard.press('?');
await page.waitForTimeout(300);
await shot('shortcuts-dark');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// Multi-select with selection bar
await gotoPath('');
const items = page.locator('.file-item');
await items.nth(0).click();
await items.nth(1).click({ modifiers: ['Control'] });
await items.nth(2).click({ modifiers: ['Control'] }).catch(() => {});
await page.waitForTimeout(400);
await shot('multi-select-dark');

await browser.close();
console.log('done →', OUT);
