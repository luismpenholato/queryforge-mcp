#!/usr/bin/env node

import { existsSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runNpm } from './run-npm.mjs';
import { resolveTarballPath, validateTarballArchive } from './validate-package-lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tarballArg = process.argv[2];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function formatBytes(size) {
  return typeof size === 'number' ? `${size} bytes` : 'unknown size';
}

let temporaryTarball;

try {
  if (tarballArg) {
    const tarballPath = resolveTarballPath(root, tarballArg);
    validateTarballArchive(tarballPath);
    console.log(`Package validation passed (${tarballArg}).`);
    process.exit(0);
  }

  const packOutput = runNpm(['pack', '--json', '--ignore-scripts'], { cwd: root });
  const packs = JSON.parse(packOutput);

  if (!packs[0]?.filename) {
    fail('npm pack did not return a tarball filename.');
  }

  temporaryTarball = resolve(root, packs[0].filename);
  validateTarballArchive(temporaryTarball);
  console.log(
    `Package validation passed (${packs[0].filename}, ${formatBytes(packs[0].size)}).`
  );
} catch (error) {
  const message = error.stderr?.toString() ?? error.message ?? String(error);
  fail(`Package validation failed: ${message}`);
} finally {
  if (temporaryTarball && existsSync(temporaryTarball)) {
    rmSync(temporaryTarball, { force: true });
  }
}
