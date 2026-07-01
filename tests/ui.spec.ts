import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

async function writeFixture(path: string, contents: string) {
  await fs.writeFile(path, contents, 'utf8');
}

test('loads the home screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('banner').getByText('Boxy')).toBeVisible();
  await expect(page.getByText('Drop files here, click Upload, or paste from clipboard')).toBeVisible();
});

test('creates a folder and shows it in the grid', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New Folder' }).click();
  await page.locator('#folderName').fill('e2e-folder');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.locator('.file-name', { hasText: 'e2e-folder' })).toBeVisible();
});

test('uploads a file and finds it with search', async ({ page }, testInfo) => {
  await page.goto('/');

  const filePath = testInfo.outputPath('example.txt');
  await writeFixture(filePath, 'hello from playwright');

  await page.setInputFiles('#fileInput', filePath);
  await expect(page.locator('.file-name', { hasText: 'example.txt' })).toBeVisible();

  await page.locator('#searchInput').fill('example');
  await expect(page.locator('.file-name', { hasText: 'example.txt' })).toBeVisible();
});

test('defaults to dark theme and renders the sidebar tree', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('#filesSidebar')).toBeVisible();
  await expect(page.locator('#sidebarTree .sb-item').first()).toBeVisible();
});


test('context menu opens on right-click and closes on Escape', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New Folder' }).click();
  await page.locator('#folderName').fill('ctx-folder');
  await page.getByRole('button', { name: 'Create' }).click();
  const card = page.locator('.file-item', { hasText: 'ctx-folder' }).first();
  await card.click({ button: 'right' });
  await expect(page.locator('#contextMenu.show')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#contextMenu.show')).toHaveCount(0);
});
