import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';

export const REQUIRED_PATHS = [
  'dist/index.js',
  'dist/public-api.js',
  'dist/public-api.d.ts',
  'README.md',
  'LICENSE',
  'CHANGELOG.md',
  'package.json'
];

export const FORBIDDEN_PREFIXES = ['src/', 'tests/', '.github/', 'coverage/'];

const FORBIDDEN_EXACT = new Set(['release-notes.md']);

const FORBIDDEN_PATH_PATTERNS = [
  /^\.env$/,
  /^\.env\./,
  /(^|\/)credentials\.json$/i,
  /(^|\/)secrets?\.(json|ya?ml|env)$/i,
  /(^|\/)token\.json$/i
];

export function normalizeTarEntry(entry) {
  return entry.replace(/^package\//, '').replace(/^\.\//, '');
}

export function listTarballContents(tarballPath) {
  const output = execFileSync('tar', ['-tzf', tarballPath], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.endsWith('/'))
    .map(normalizeTarEntry);
}

export function readTarballFile(tarballPath, entryPath) {
  const archiveEntry = entryPath.startsWith('package/') ? entryPath : `package/${entryPath}`;

  return execFileSync('tar', ['-xOf', tarballPath, archiveEntry], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

export function isForbiddenPackagePath(path) {
  if (FORBIDDEN_EXACT.has(path)) {
    return true;
  }

  if (FORBIDDEN_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return true;
  }

  if (path.endsWith('.tgz')) {
    return true;
  }

  return FORBIDDEN_PATH_PATTERNS.some((pattern) => pattern.test(path));
}

export function validatePackagePaths(paths) {
  const listedPaths = new Set(paths);

  for (const required of REQUIRED_PATHS) {
    if (!listedPaths.has(required)) {
      throw new Error(`Missing required package file: ${required}`);
    }
  }

  for (const path of listedPaths) {
    if (isForbiddenPackagePath(path)) {
      throw new Error(`Forbidden package file: ${path}`);
    }
  }
}

export function validateTarballArchive(tarballPath) {
  if (!existsSync(tarballPath)) {
    throw new Error(`Tarball not found: ${tarballPath}`);
  }

  if (!tarballPath.endsWith('.tgz')) {
    throw new Error(`Package validation requires a .tgz file. Received: ${basename(tarballPath)}`);
  }

  const paths = listTarballContents(tarballPath);
  validatePackagePaths(paths);

  const indexContent = readTarballFile(tarballPath, 'dist/index.js');

  if (!indexContent.startsWith('#!/usr/bin/env node')) {
    throw new Error('dist/index.js inside the tarball is missing the Node shebang.');
  }

  const declarations = readTarballFile(tarballPath, 'dist/public-api.d.ts').trim();

  if (!declarations) {
    throw new Error('dist/public-api.d.ts inside the tarball is empty.');
  }

  return {
    filename: basename(tarballPath),
    paths
  };
}

export function resolveTarballPath(root, arg) {
  return resolve(root, arg);
}
