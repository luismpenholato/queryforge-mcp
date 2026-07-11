#!/usr/bin/env node

import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runNpm } from './run-npm.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const REQUIRED_PATHS = [
  'dist/index.js',
  'dist/public-api.js',
  'dist/public-api.d.ts',
  'README.md',
  'LICENSE',
  'CHANGELOG.md',
  'package.json'
];

const FORBIDDEN_PREFIXES = ['src/', 'tests/', '.github/', 'coverage/'];

function fail(message) {
  console.error(message);
  process.exit(1);
}

let packFile;

try {
  const packOutput = runNpm(['pack', '--json', '--ignore-scripts'], { cwd: root });
  const packs = JSON.parse(packOutput);

  if (!packs[0]?.filename) {
    fail('npm pack did not return a tarball filename.');
  }

  packFile = resolve(root, packs[0].filename);
  const listedPaths = new Set(packs[0].files.map((entry) => entry.path));

  for (const required of REQUIRED_PATHS) {
    if (!listedPaths.has(required)) {
      fail(`Missing required package file: ${required}`);
    }
  }

  for (const path of listedPaths) {
    if (FORBIDDEN_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      fail(`Forbidden package file: ${path}`);
    }

    if (path === 'release-notes.md' || path.endsWith('.tgz') || path.includes('.env')) {
      fail(`Forbidden package file: ${path}`);
    }
  }

  const indexContent = readFileSync(join(root, 'dist/index.js'), 'utf8');

  if (!indexContent.startsWith('#!/usr/bin/env node')) {
    fail('dist/index.js is missing the Node shebang.');
  }

  console.log(`Package validation passed (${packs[0].filename}, ${packs[0].size} bytes).`);
} catch (error) {
  fail(`Package validation failed: ${error.stderr?.toString() ?? error.message}`);
} finally {
  if (packFile && existsSync(packFile) && process.env.KEEP_PACKAGE_TARBALL !== '1') {
    rmSync(packFile, { force: true });
  }
}
