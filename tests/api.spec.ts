import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { mkdir, symlink, readdir } from 'node:fs/promises';
let folder: string;
test.beforeEach(async ({ request }) => {
  folder = 'api-' + randomUUID();
  expect((await request.post('/api/folder', { data: { name: folder } })).ok()).toBeTruthy();
});
test.afterEach(async ({ request }) => {
  await request.post('/api/delete', { data: { path: folder } });
});

test('stats cache invalidates after each mutation', async ({ request }) => {
  const stats = async () => (await request.get('/api/stats', { params: { path: folder } })).json();
  expect(await stats()).toEqual({ files: 0, folders: 0, bytes: 0 });
  await request.post('/api/newfile', { data: { filename: 'note.txt', path: folder } });
  await request.post('/api/content', { data: { path: `${folder}/note.txt`, content: '12345' } });
  expect(await stats()).toEqual({ files: 1, folders: 0, bytes: 5 });
  await request.post('/api/delete', { data: { path: `${folder}/note.txt` } });
  expect(await stats()).toEqual({ files: 0, folders: 0, bytes: 0 });
});

test('oversized streaming upload returns 413 and removes partial file', async ({ request }) => {
  const response = await request.post('/api/upload', {
    params: { path: folder }, multipart: { files: { name: 'too-large.bin', mimeType: 'application/octet-stream', buffer: Buffer.alloc(1048577, 1) } }
  });
  expect(response.status()).toBe(413);
  expect(await (await request.get('/api/files', { params: { path: folder } })).json()).toEqual([]);
});

test('nested upload rejects a symlink escaping the storage root', async ({ request }) => {
  const root = process.env.BOX_E2E_ROOT!;
  const outside = join(root, 'outside-' + randomUUID());
  await mkdir(outside);
  await symlink(outside, join(root, 'uploads', folder, 'escape'));
  const response = await request.post('/api/upload', {
    params: { path: folder }, multipart: { original_name: 'escape/private.txt', files: { name: 'safe.txt', mimeType: 'text/plain', buffer: Buffer.from('blocked') } }
  });
  expect(response.status()).toBe(403);
  expect(await readdir(outside)).toEqual([]);
});

test('thumbnail generation produces cached JPEG, and invalid images fall back', async ({ request }) => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC', 'base64');
  await request.post('/api/upload', { params: { path: folder }, multipart: { files: { name: 'tiny.png', mimeType: 'image/png', buffer: png } } });
  const thumb = await request.get('/api/thumb', { params: { path: `${folder}/tiny.png` } });
  expect(thumb.status()).toBe(200);
  expect(thumb.headers()['content-type']).toBe('image/jpeg');
  const cached = await request.get('/api/thumb', { params: { path: `${folder}/tiny.png` } });
  expect(await cached.body()).toEqual(await thumb.body());
  await request.post('/api/upload', { params: { path: folder }, multipart: { files: { name: 'invalid.png', mimeType: 'image/png', buffer: Buffer.from('not a PNG') } } });
  expect((await request.get('/api/thumb', { params: { path: `${folder}/invalid.png` } })).status()).toBe(404);
});

test('streamed downloads expose conditional requests and sandbox uploaded HTML', async ({ request }) => {
  await request.post('/api/newfile', { data: { filename: 'page.html', path: folder } });
  await request.post('/api/content', { data: { path: `${folder}/page.html`, content: '<script>alert(1)</script>' } });
  const response = await request.get('/api/download', { params: { path: `${folder}/page.html` } });
  expect(response.headers()['content-security-policy']).toBe('sandbox');
  expect(response.headers()['x-content-type-options']).toBe('nosniff');
  const cached = await request.get('/api/download', { params: { path: `${folder}/page.html` }, headers: { 'If-None-Match': response.headers().etag } });
  expect(cached.status()).toBe(304);
});
