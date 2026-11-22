#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_REPO = 'https://github.com/luismpenholato/queryforge-mcp';

/**
 * Ensure Keep a Changelog footer links exist for every ## [x.y.z] section.
 * Missing links are appended automatically (deterministic URL from version).
 */
export function ensureChangelogReleaseLinks(
  changelog,
  { repositoryUrl = DEFAULT_REPO } = {},
) {
  const versions = [
    ...changelog.matchAll(/^## \[(\d+\.\d+\.\d+)\] - \d{4}-\d{2}-\d{2}\s*$/gm),
  ].map((match) => match[1]);

  const uniqueVersions = [...new Set(versions)];
  const added = [];
  let next = changelog.replace(/\s*$/, '');

  for (const version of uniqueVersions) {
    const releaseLink = `[${version}]: ${repositoryUrl}/releases/tag/v${version}`;
    if (next.includes(releaseLink)) {
      continue;
    }

    next = `${next}\n${releaseLink}`;
    added.push(version);
  }

  if (added.length > 0 && next.length > 0 && !next.endsWith('\n')) {
    next = `${next}\n`;
  }

  return {
    changelog: added.length > 0 ? next : changelog,
    added,
    changed: added.length > 0,
  };
}

export function ensureChangelogFile(
  changelogPath = resolve(process.cwd(), 'CHANGELOG.md'),
  options = {},
) {
  const current = readFileSync(changelogPath, 'utf8');
  const result = ensureChangelogReleaseLinks(current, options);

  if (result.changed) {
    writeFileSync(changelogPath, result.changelog, 'utf8');
  }

  return result;
}

const isDirectRun = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectRun) {
  const result = ensureChangelogFile();
  if (result.changed) {
    console.log(`Added CHANGELOG release link(s): ${result.added.join(', ')}`);
  } else {
    console.log('CHANGELOG release links are already complete.');
  }
}
