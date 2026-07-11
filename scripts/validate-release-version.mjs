#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const tagArg = process.argv[2];

if (!tagArg) {
  console.error('Usage: node scripts/validate-release-version.mjs vX.Y.Z');
  process.exit(1);
}

if (!/^v\d+\.\d+\.\d+$/.test(tagArg)) {
  console.error(`Tag must follow vX.Y.Z format. Received: ${tagArg}`);
  process.exit(1);
}

const version = tagArg.slice(1);
const root = process.cwd();
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const packageLock = JSON.parse(readFileSync(resolve(root, 'package-lock.json'), 'utf8'));
const changelog = readFileSync(resolve(root, 'CHANGELOG.md'), 'utf8');

if (packageJson.version !== version) {
  console.error(`package.json version ${packageJson.version} does not match tag ${tagArg}.`);
  process.exit(1);
}

if (packageLock.version !== version) {
  console.error(`package-lock.json version ${packageLock.version} does not match tag ${tagArg}.`);
  process.exit(1);
}

const lockRootPackage = packageLock.packages?.[''];

if (!lockRootPackage || lockRootPackage.version !== version) {
  console.error('package-lock.json root package version does not match the release tag.');
  process.exit(1);
}

const sectionPattern = new RegExp(
  `^## \\[${version.replace(/\./g, '\\.')}\\] - \\d{4}-\\d{2}-\\d{2}\\s*$`,
  'm'
);

if (!sectionPattern.test(changelog)) {
  console.error(`CHANGELOG.md does not contain a section for version ${version}.`);
  process.exit(1);
}

const versionOccurrences = (changelog.match(new RegExp(`\\[${version.replace(/\./g, '\\.')}\\]`, 'g')) ?? [])
  .length;

if (versionOccurrences > 2) {
  console.error(`Version ${version} appears duplicated in CHANGELOG.md.`);
  process.exit(1);
}

const releaseLink = `[${version}]: https://github.com/luismpenholato/queryforge-mcp/releases/tag/v${version}`;

if (!changelog.includes(releaseLink)) {
  console.error(`CHANGELOG.md is missing release link:\n${releaseLink}`);
  process.exit(1);
}

const serverPath = resolve(root, 'src/server.ts');

try {
  const serverSource = readFileSync(serverPath, 'utf8');
  const serverVersionMatch = serverSource.match(/version:\s*['"]([^'"]+)['"]/);

  if (!serverVersionMatch) {
    console.error('src/server.ts is missing MCP server version metadata.');
    process.exit(1);
  }

  if (serverVersionMatch[1] !== version) {
    console.error(
      `src/server.ts version ${serverVersionMatch[1]} does not match tag ${tagArg}.`
    );
    process.exit(1);
  }
} catch (error) {
  if (error.code === 'ENOENT') {
    console.error('src/server.ts was not found for server version validation.');
    process.exit(1);
  }

  throw error;
}

console.log(`Release version ${tagArg} is consistent with package metadata and changelog.`);
