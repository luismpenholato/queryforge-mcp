import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(process.cwd());
const node = process.execPath;

function runExtractor(args: string[], cwd = root, scriptPath = join(root, 'scripts/extract-changelog.mjs')): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(node, [scriptPath, ...args], {
      cwd,
      encoding: 'utf8'
    });

    return { status: 0, stdout, stderr: '' };
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
    const result = runExtractor(['0.7.0']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('### Added');
    expect(result.stdout).toContain('public programmatic API');
    expect(result.stdout).not.toContain('## [0.6.2]');
  });

  it('should accept v-prefixed versions', () => {
    const result = runExtractor(['v0.7.0']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('### Changed');
  });

  it('should fail for missing versions', () => {
    const result = runExtractor(['9.9.9']);
    expect(result.status).not.toBe(0);
  });

  it('should fail for invalid SemVer', () => {
    const result = runExtractor(['not-a-version']);
    expect(result.status).not.toBe(0);
  });

  it('should write to output file when requested', () => {
    const dir = mkdtempSync(join(tmpdir(), 'queryforge-changelog-'));
    const output = join(dir, 'release-notes.md');
    const result = runExtractor(['0.7.0', '--output', output]);

    expect(result.status).toBe(0);
    expect(readFileSync(output, 'utf8')).toContain('### Compatibility');
  });

  it('should fail when changelog section is empty', () => {
    const dir = mkdtempSync(join(tmpdir(), 'queryforge-changelog-empty-'));
    writeFileSync(
      join(dir, 'CHANGELOG.md'),
      '## [1.0.0] - 2026-01-01\n\n## [0.9.0] - 2025-12-01\n',
      'utf8'
    );

    const result = runExtractor(['1.0.0'], dir, join(root, 'scripts/extract-changelog.mjs'));
    expect(result.status).not.toBe(0);
  });
});

describe('validate-release-version script', () => {
  it('should validate the current release metadata', () => {
    const stdout = execFileSync(node, ['scripts/validate-release-version.mjs', 'v0.7.0'], {
      cwd: root,
      encoding: 'utf8'
    });

    expect(stdout).toContain('Release version v0.7.0 is consistent');
  });

  it('should fail for mismatched tags', () => {
    expect(() =>
      execFileSync(node, ['scripts/validate-release-version.mjs', 'v9.9.9'], {
        cwd: root,
        encoding: 'utf8'
      })
    ).toThrow();
  });
});
