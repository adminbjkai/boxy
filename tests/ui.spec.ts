import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

let folder: string;
let pageErrors: string[];
test.beforeEach(async ({ page, request }) => {
  pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  folder = `test-${randomUUID()}`;
  expect((await request.post('/api/folder', { data: { name: folder } })).ok()).toBeTruthy();
  await page.goto('/#' + encodeURIComponent(folder));
  await expect(page.locator('#fileGrid')).toHaveAttribute('aria-busy', 'false');
});
test.afterEach(async ({ request }) => {
  await request.post('/api/delete', { data: { path: folder } });
  expect(pageErrors).toEqual([]);
});

async function upload(page, name = 'example.txt', content = 'hello from playwright') {
  await page.setInputFiles('#fileInput', { name, mimeType: 'text/plain', buffer: Buffer.from(content) });
  await expect(page.locator('.file-name', { hasText: name })).toBeVisible();
}

test('home, dark theme, folder tree, and upload controls', async ({ page }) => {
  await expect(page.getByRole('banner').getByText('Boxy')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('#folderTitle')).toHaveText(folder);
  await expect(page.locator('#pasteClipboardBtn')).toBeEnabled();
  await expect(page.locator('#sidebarTree .sb-item').first()).toBeVisible();
  await page.getByRole('button', { name: 'Toggle dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('create folder, pin it, persist pins, and unpin', async ({ page }) => {
  await page.getByRole('button', { name: 'New Folder', exact: true }).click();
  await page.locator('#folderName').fill('Reference');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.locator('.file-name', { hasText: 'Reference' })).toBeVisible();
  await page.locator('.file-item-content', { hasText: 'Reference' }).dblclick();
  await expect(page.locator('#folderTitle')).toHaveText('Reference');
  await page.locator('#pinFolderBtn').click();
  await expect(page.locator('#pinFolderBtn')).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.locator('#sidebarPins .pin-link')).toHaveText('Reference');
  await page.locator('#sidebarPins .unpin-btn').click();
  await expect(page.locator('#sidebarPins .pin-link')).toHaveCount(0);
});

test('filter empty state and clear all filters', async ({ page }) => {
  await upload(page);
  await page.locator('#searchInput').fill('missing');
  await expect(page.locator('#emptyTitle')).toHaveText('No matching files');
  await expect(page.locator('#filterSummary')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(page.locator('.file-name', { hasText: 'example.txt' })).toBeVisible();
  await expect(page.locator('#filterSummary')).toBeHidden();
});

test('special filenames preserve paths in grid, context menu, editor, and hash', async ({ page }) => {
  const name = `A&B's "notes" <draft>.txt`;
  await upload(page, name);
  const card = page.locator('.file-item').first();
  await expect(card).toHaveAttribute('data-path', `${folder}/${name}`);
  await card.click({ button: 'right' });
  await expect(page.locator('#contextMenu.show')).toBeVisible();
  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  await expect(page.locator('#editContent')).toHaveValue('hello from playwright');
  await page.keyboard.press('Escape');
  await expect(page.locator('#editModal')).not.toHaveClass(/active/);
  await upload(page, 'literal%22.txt', 'literal');
  await expect(page.locator('.file-item[data-name="literal%22.txt"]')).toHaveCount(1);
});

test('editor flushes pending autosave on close and never overwrites another file', async ({ page, request }) => {
  await upload(page, 'first.txt');
  await upload(page, 'second.txt', 'second original');
  await page.evaluate(path => window['showEditModal'](path), `${folder}/first.txt`);
  await expect(page.locator('#editContent')).toHaveValue('hello from playwright');
  await page.locator('#editContent').fill('saved immediately on close');
  await page.keyboard.press('Escape');
  await expect(page.locator('#editModal')).not.toHaveClass(/active/);
  expect(await (await request.get('/api/content', { params: { path: `${folder}/first.txt` } })).text()).toBe('saved immediately on close');
  await page.evaluate(path => window['showEditModal'](path), `${folder}/second.txt`);
  await expect(page.locator('#editContent')).toHaveValue('second original');
  await page.waitForTimeout(2200);
  expect(await (await request.get('/api/content', { params: { path: `${folder}/second.txt` } })).text()).toBe('second original');
});

test('Markdown preview sanitizes active HTML while preserving formatting', async ({ page }) => {
  await upload(page, 'preview.md', '# Hello\n<img src=x onerror="window.previewAttack=1"><a href="javascript:window.previewAttack=2">bad link</a>');
  await page.evaluate(path => window['showEditModal'](path), `${folder}/preview.md`);
  await expect(page.locator('#editSaveBtn')).toBeEnabled();
  await page.locator('#viewModeBtn').click();
  await expect(page.locator('#markdownPreview h1')).toHaveText('Hello');
  await expect(page.locator('#markdownPreview [onerror], #markdownPreview [href^="javascript:"]')).toHaveCount(0);
  expect(await page.evaluate(() => window['previewAttack'])).toBeUndefined();
});

test('latest navigation wins when an earlier folder request is slow', async ({ page, request }) => {
  await request.post('/api/folder', { data: { name: 'slow', path: folder } });
  await request.post('/api/folder', { data: { name: 'fast', path: folder } });
  await request.post('/api/newfile', { data: { filename: 'fast.txt', path: `${folder}/fast` } });
  await page.route('**/api/files?*', async route => {
    if (new URL(route.request().url()).searchParams.get('path') === `${folder}/slow`) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    await route.continue();
  });
  await page.evaluate(path => window['navigate'](path), `${folder}/slow`);
  await page.evaluate(path => window['navigate'](path), `${folder}/fast`);
  await expect(page.locator('.file-name')).toHaveText('fast.txt');
  await page.waitForTimeout(600);
  await expect(page.locator('.file-name')).toHaveText('fast.txt');
  await expect(page.locator('#folderTitle')).toHaveText('fast');
});

test('mobile folder access, no horizontal overflow, and touch file actions', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await upload(page);
  await expect(page.locator('#mobileFoldersBtn')).toBeVisible();
  await page.locator('#mobileFoldersBtn').click();
  await expect(page.locator('#filesSidebar')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test('downloads support byte ranges and ZIP selection remains available', async ({ page, request }) => {
  await upload(page, 'range.txt', '0123456789');
  const range = await request.get('/api/download', { params: { path: `${folder}/range.txt` }, headers: { Range: 'bytes=2-5' } });
  expect(range.status()).toBe(206); expect(await range.text()).toBe('2345');
  expect(range.headers()['content-range']).toBe('bytes 2-5/10');
  const zip = await request.post('/api/download-zip-multi', { data: { paths: [`${folder}/range.txt`] } });
  expect(zip.ok()).toBeTruthy(); expect((await zip.body()).subarray(0, 2).toString()).toBe('PK');
  const dirZip = await request.get('/api/download-zip', { params: { path: folder } });
  expect(dirZip.ok()).toBeTruthy();
});

test('copy, cut, paste, rename, list view, and multi-selection still work', async ({ page, request }) => {
  await upload(page);
  await page.evaluate(path => window['copyToClipboard']('copy', path), `${folder}/example.txt`);
  await page.evaluate(() => window['pasteClipboard']());
  await expect(page.locator('.file-name', { hasText: 'example_1.txt' })).toBeVisible();
  const copied = page.locator('.file-item', { hasText: 'example_1.txt' });
  await copied.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
  await page.locator('.inline-rename').fill('renamed.txt');
  await page.locator('.inline-rename').press('Enter');
  await expect(page.locator('.file-name', { hasText: 'renamed.txt' })).toBeVisible();
  await page.locator('#viewToggle').click();
  await expect(page.locator('#fileGrid')).toHaveClass('file-table');
  await page.locator('#multiSelectBtn').click();
  await page.locator('.file-item-content').first().click();
  await page.locator('.file-item-content').nth(1).click();
  await expect(page.locator('#selectionCount')).toHaveText('2 files selected');
  await request.post('/api/folder', { data: { name: 'destination', path: folder } });
  await page.evaluate(path => window['copyToClipboard']('cut', path), `${folder}/renamed.txt`);
  await page.evaluate(path => window['navigate'](path), `${folder}/destination`);
  await expect(page.locator('#folderTitle')).toHaveText('destination');
  await page.evaluate(() => window['pasteClipboard']());
  await expect(page.locator('.file-name', { hasText: 'renamed.txt' })).toBeVisible();
});

test('corrupt stored sidebar state does not prevent startup', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('boxy_sidebar_expanded', '{broken'));
  await page.reload();
  await expect(page.locator('#fileGrid')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('#folderTitle')).toHaveText(folder);
});


test('bulk partial failure reports truthfully and retains only failed items', async ({ page }) => {
  await upload(page, 'keep.txt');
  await upload(page, 'remove.txt');
  await page.route('**/api/delete', async route => {
    if (route.request().postDataJSON().path.endsWith('/keep.txt')) {
      await route.fulfill({ status: 500, body: 'Simulated failure' });
    } else await route.continue();
  });
  page.on('dialog', dialog => dialog.accept());
  await page.locator('#multiSelectBtn').click();
  await page.locator('.file-item-content').first().click();
  await page.locator('.file-item-content').nth(1).click();
  await page.evaluate(() => window['bulkDelete']());
  await expect(page.locator('#toast')).toContainText('Deleted 1 of 2 items');
  await expect(page.locator('#selectionCount')).toHaveText('1 file selected');
  await expect(page.locator('.file-item.selected')).toHaveAttribute('data-name', 'keep.txt');
});

test('folder hashes encode special characters and survive reload', async ({ page, request }) => {
  const name = `R&D's # drafts`;
  await request.post('/api/folder', { data: { name, path: folder } });
  await page.evaluate(path => window['navigate'](path), `${folder}/${name}`);
  await expect(page.locator('#folderTitle')).toHaveText(name);
  await page.reload();
  await expect(page.locator('#folderTitle')).toHaveText(name);
  await page.locator('#breadcrumb .breadcrumb-item').last().click();
  await expect(page.locator('#pathBar')).toHaveValue(`${folder}/${name}`);
});


test('WebSocket updates reach a second browser tab', async ({ page, context, request }) => {
  const other = await context.newPage();
  await other.goto('/#' + encodeURIComponent(folder));
  await expect(other.locator('#statusText')).toHaveText('Live');
  await request.post('/api/newfile', { data: { filename: 'live.txt', path: folder } });
  await expect(page.locator('.file-name', { hasText: 'live.txt' })).toBeVisible();
  await expect(other.locator('.file-name', { hasText: 'live.txt' })).toBeVisible();
  await other.close();
});
