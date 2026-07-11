#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const outputIndex = args.indexOf('--output');
const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : undefined;
const versionArg = args.find((arg) => arg !== '--output' && arg !== outputPath);

if (!versionArg) {
  console.error('Usage: node scripts/extract-changelog.mjs <version> [--output file.md]');
  process.exit(1);
}

const version = versionArg.startsWith('v') ? versionArg.slice(1) : versionArg;

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`Invalid SemVer: ${versionArg}`);
  process.exit(1);
}

const changelogPath = resolve(process.cwd(), 'CHANGELOG.md');
const changelog = readFileSync(changelogPath, 'utf8');
const sectionPattern = new RegExp(
  `^## \\[${version.replace(/\./g, '\\.')}\\] - \\d{4}-\\d{2}-\\d{2}\\s*$`,
  'm'
);
const sectionMatch = sectionPattern.exec(changelog);

if (!sectionMatch) {
  console.error(`Changelog section not found for version ${version}.`);
  process.exit(1);
}

const contentStart = sectionMatch.index + sectionMatch[0].length;
const nextSectionMatch = /^## \[/m.exec(changelog.slice(contentStart));
const contentEnd = nextSectionMatch ? contentStart + nextSectionMatch.index : changelog.length;
const extracted = changelog.slice(contentStart, contentEnd).trim();

if (!extracted) {
  console.error(`Changelog section for version ${version} is empty.`);
  process.exit(1);
}

if (outputPath) {
  writeFileSync(resolve(process.cwd(), outputPath), `${extracted}\n`, 'utf8');
} else {
  process.stdout.write(`${extracted}\n`);
}
