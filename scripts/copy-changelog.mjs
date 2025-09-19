#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';

async function main() {
  try {
    const root = process.cwd();
    const src = path.join(root, 'CHANGELOG.md');
    const destDir = path.join(root, 'public');
    const dest = path.join(destDir, 'CHANGELOG.md');

    try { await fs.mkdir(destDir, { recursive: true }); } catch {}
    const content = await fs.readFile(src, 'utf8');
    await fs.writeFile(dest, content, 'utf8');
    console.log(`[changelog] Copied ${src} -> ${dest}`);
  } catch (err) {
    console.warn('[changelog] Skipped copying CHANGELOG.md:', err?.message || err);
  }
}

main();
