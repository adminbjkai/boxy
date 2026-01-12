import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

async function writeFixture(path: string, contents: string) {
  await fs.writeFile(path, contents, 'utf8');
}

test('loads the home screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Boxy')).toBeVisible();
  await expect(page.getByText('Drop files here, click Upload, or paste from clipboard')).toBeVisible();
});

test('creates a folder and shows it in the grid', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New Folder' }).click();
  await page.locator('#folderName').fill('e2e-folder');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText('e2e-folder')).toBeVisible();
});

test('uploads a file and finds it with search', async ({ page }, testInfo) => {
  await page.goto('/');

  const filePath = testInfo.outputPath('example.txt');
  await writeFixture(filePath, 'hello from playwright');

  await page.setInputFiles('#fileInput', filePath);
  await expect(page.getByText('example.txt')).toBeVisible();

  await page.locator('#searchInput').fill('example');
  await expect(page.getByText('example.txt')).toBeVisible();
});
