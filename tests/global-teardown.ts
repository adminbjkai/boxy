import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export default async function teardown() {
  const root = process.env.BOX_E2E_ROOT;
  if (root?.startsWith(join(tmpdir(), 'boxy-e2e-'))) await rm(root, { recursive: true, force: true });
}
