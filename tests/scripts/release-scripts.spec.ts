import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(process.cwd());
const node = process.execPath;

function runScript(scriptRelativePath: string, args: string[] = [], cwd = root): {
  status: number;
  stdout: string;
  stderr: string;
} {
  try {
    const result = execFileSync(node, [join(root, scriptRelativePath), ...args], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });

    return { status: 0, stdout: result, stderr: '' };
  } catch (error) {
    const execError = error as { status?: number; stdout?: string; stderr?: string };
    return {
      status: execError.status ?? 1,
      stdout: execError.stdout ?? '',
      stderr: execError.stderr ?? ''
    };
  }
}

describe('extract-changelog script', () => {
  it('should extract an existing version', () => {
    const result = runScript('scripts/extract-changelog.mjs', ['0.7.0']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('### Added');
    expect(result.stdout).toContain('public programmatic API');
    expect(result.stdout).not.toContain('## [0.6.2]');
    expect(result.stderr).toBe('');
  });

  it('should accept v-prefixed versions', () => {
    const result = runScript('scripts/extract-changelog.mjs', ['v0.7.0']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('### Changed');
    expect(result.stderr).toBe('');
  });

  it('should fail for missing versions', () => {
    const result = runScript('scripts/extract-changelog.mjs', ['9.9.9']);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Changelog section not found for version 9.9.9.');
  });

  it('should fail for invalid SemVer', () => {
    const result = runScript('scripts/extract-changelog.mjs', ['not-a-version']);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Invalid SemVer');
  });

  it('should write to output file when requested', () => {
    const dir = mkdtempSync(join(tmpdir(), 'queryforge-changelog-'));
    const output = join(dir, 'release-notes.md');
    const result = runScript('scripts/extract-changelog.mjs', ['0.7.0', '--output', output]);

    expect(result.status).toBe(0);
    expect(readFileSync(output, 'utf8')).toContain('### Compatibility');
    expect(result.stderr).toBe('');
  });

  it('should fail when changelog section is empty', () => {
    const dir = mkdtempSync(join(tmpdir(), 'queryforge-changelog-empty-'));
    writeFileSync(
      join(dir, 'CHANGELOG.md'),
      '## [1.0.0] - 2026-01-01\n\n## [0.9.0] - 2025-12-01\n',
      'utf8'
    );

    const result = runScript('scripts/extract-changelog.mjs', ['1.0.0'], dir);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Changelog section for version 1.0.0 is empty.');
  });
});

describe('validate-release-version script', () => {
  it('should validate the current release metadata', () => {
    const result = runScript('scripts/validate-release-version.mjs', ['v0.7.1']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Release version v0.7.1 is consistent');
    expect(result.stderr).toBe('');
  });

  it('should fail for mismatched tags', () => {
    const result = runScript('scripts/validate-release-version.mjs', ['v9.9.9']);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('does not match tag v9.9.9');
  });
});
