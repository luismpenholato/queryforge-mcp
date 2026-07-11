import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runNpm } from '../../scripts/run-npm.mjs';
import {
  isForbiddenPackagePath,
  listTarballContents,
  normalizeTarEntry,
  validatePackagePaths,
  validateTarballArchive
} from '../../scripts/validate-package-lib.mjs';

const root = resolve(process.cwd());
const node = process.execPath;

const REQUIRED_PACKAGE_FILES = {
  'dist/index.js': '#!/usr/bin/env node\nexport {};\n',
  'dist/public-api.js': 'export {};\n',
  'dist/public-api.d.ts': 'export {};\n',
  'README.md': '# Test package\n',
  'LICENSE': 'MIT\n',
  'CHANGELOG.md': '# Changelog\n',
  'package.json': '{"name":"test","version":"0.0.0"}\n'
};

function runScript(scriptRelativePath: string, args: string[] = []): {
  status: number;
  stdout: string;
  stderr: string;
} {
  try {
    const stdout = execFileSync(node, [join(root, scriptRelativePath), ...args], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
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

function listTarballs(directory: string): string[] {
  return readdirSync(directory).filter((name) => name.endsWith('.tgz'));
}

function createTarballFromFiles(
  tempDir: string,
  files: Record<string, string>,
  tarballName = 'fixture.tgz'
): string {
  const workDir = mkdtempSync(join(tempDir, 'pkg-'));
  const packageDir = join(workDir, 'package');

  for (const [relativePath, content] of Object.entries(files)) {
    const targetPath = join(packageDir, relativePath);
    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, content, 'utf8');
  }

  const tarballPath = join(tempDir, tarballName);
  execFileSync('tar', ['-czf', tarballPath, '-C', workDir, 'package'], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  rmSync(workDir, { recursive: true, force: true });

  return tarballPath;
}

function ensureBuiltPackage(): void {
  if (!existsSync(join(root, 'dist/index.js'))) {
    runNpm(['run', 'build'], { cwd: root });
  }
}

describe('validate-package-lib', () => {
  it('should normalize package/ prefixes from tar entries', () => {
    expect(normalizeTarEntry('package/dist/index.js')).toBe('dist/index.js');
    expect(normalizeTarEntry('./README.md')).toBe('README.md');
  });

  it('should flag forbidden package paths without false positives on docs', () => {
    expect(isForbiddenPackagePath('src/index.ts')).toBe(true);
    expect(isForbiddenPackagePath('tests/foo.spec.ts')).toBe(true);
    expect(isForbiddenPackagePath('.github/workflows/ci.yml')).toBe(true);
    expect(isForbiddenPackagePath('coverage/lcov.info')).toBe(true);
    expect(isForbiddenPackagePath('release-notes.md')).toBe(true);
    expect(isForbiddenPackagePath('nested/queryforge-mcp-0.7.0.tgz')).toBe(true);
    expect(isForbiddenPackagePath('.env')).toBe(true);
    expect(isForbiddenPackagePath('.env.local')).toBe(true);
    expect(isForbiddenPackagePath('config/credentials.json')).toBe(true);
    expect(isForbiddenPackagePath('README.md')).toBe(false);
    expect(isForbiddenPackagePath('docs/token-usage.md')).toBe(false);
  });

  it('should reject missing required files', () => {
    expect(() => validatePackagePaths(['README.md', 'LICENSE'])).toThrow(
      'Missing required package file: dist/index.js'
    );
  });

  it('should reject forbidden files in package paths', () => {
    expect(() =>
      validatePackagePaths([
        ...Object.keys(REQUIRED_PACKAGE_FILES),
        'src/server.ts'
      ])
    ).toThrow('Forbidden package file: src/server.ts');
  });
});

describe('validate-package script', () => {
  let realTarball: string | undefined;
  let fixtureTempDir: string | undefined;

  beforeAll(() => {
    ensureBuiltPackage();
    fixtureTempDir = mkdtempSync(join(tmpdir(), 'queryforge-validate-package-'));

    const packOutput = runNpm(['pack', '--json', '--ignore-scripts'], { cwd: root });
    const packs = JSON.parse(packOutput) as Array<{ filename: string }>;
    const packedPath = resolve(root, packs[0].filename);

    realTarball = join(fixtureTempDir, 'preserved-package.tgz');
    copyFileSync(packedPath, realTarball);
    rmSync(packedPath, { force: true });
  });

  afterAll(() => {
    if (fixtureTempDir && existsSync(fixtureTempDir)) {
      rmSync(fixtureTempDir, { recursive: true, force: true });
    }

    for (const leftover of listTarballs(root)) {
      rmSync(join(root, leftover), { force: true });
    }
  });

  it('should validate an existing tarball without removing it', () => {
    expect(realTarball).toBeDefined();
    const beforeMtime = statSync(realTarball!).mtimeMs;

    const result = runScript('scripts/validate-package.mjs', [realTarball!]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Package validation passed');
    expect(result.stderr).toBe('');
    expect(existsSync(realTarball!)).toBe(true);
    expect(statSync(realTarball!).mtimeMs).toBe(beforeMtime);
  });

  it('should not create a second tarball when validating an existing archive', () => {
    const beforeTarballs = new Set(listTarballs(root));

    const result = runScript('scripts/validate-package.mjs', [realTarball!]);

    expect(result.status).toBe(0);
    expect(new Set(listTarballs(root))).toEqual(beforeTarballs);
  });

  it('should validate local mode, then remove the temporary tarball', () => {
    const beforeTarballs = new Set(listTarballs(root));
    const result = runScript('scripts/validate-package.mjs');

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Package validation passed');
    expect(result.stderr).toBe('');
    expect(new Set(listTarballs(root))).toEqual(beforeTarballs);
  });

  it('should fail for a missing tarball', () => {
    const result = runScript('scripts/validate-package.mjs', ['missing-package.tgz']);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Tarball not found');
  });

  it('should fail when the argument is not a .tgz file', () => {
    const invalidPath = join(fixtureTempDir!, 'not-a-tarball.txt');
    writeFileSync(invalidPath, 'not a tarball', 'utf8');

    const result = runScript('scripts/validate-package.mjs', [invalidPath]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('requires a .tgz file');
  });

  it('should fail when a required file is missing from the tarball', () => {
    const files = { ...REQUIRED_PACKAGE_FILES };
    delete files['dist/public-api.d.ts'];

    const tarballPath = createTarballFromFiles(fixtureTempDir!, files, 'missing-required.tgz');
    const result = runScript('scripts/validate-package.mjs', [tarballPath]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Missing required package file: dist/public-api.d.ts');
  });

  it('should fail when a forbidden file is present in the tarball', () => {
    const tarballPath = createTarballFromFiles(
      fixtureTempDir!,
      {
        ...REQUIRED_PACKAGE_FILES,
        'src/server.ts': 'export {};\n'
      },
      'forbidden-file.tgz'
    );

    const result = runScript('scripts/validate-package.mjs', [tarballPath]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Forbidden package file: src/server.ts');
  });

  it('should fail when dist/index.js inside the tarball is missing the shebang', () => {
    const tarballPath = createTarballFromFiles(
      fixtureTempDir!,
      {
        ...REQUIRED_PACKAGE_FILES,
        'dist/index.js': 'export {};\n'
      },
      'missing-shebang.tgz'
    );

    const result = runScript('scripts/validate-package.mjs', [tarballPath]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('missing the Node shebang');
  });

  it('should fail when dist/public-api.d.ts inside the tarball is empty', () => {
    const tarballPath = createTarballFromFiles(
      fixtureTempDir!,
      {
        ...REQUIRED_PACKAGE_FILES,
        'dist/public-api.d.ts': '   \n'
      },
      'empty-declarations.tgz'
    );

    const result = runScript('scripts/validate-package.mjs', [tarballPath]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('dist/public-api.d.ts inside the tarball is empty');
  });

  it('should inspect tarball contents with tar instead of trusting npm pack metadata', () => {
    expect(realTarball).toBeDefined();

    const paths = listTarballContents(realTarball!);
    expect(paths).toContain('dist/index.js');
    expect(paths).toContain('dist/public-api.d.ts');
    expect(paths).not.toContain('src/index.ts');

    expect(() => validateTarballArchive(realTarball!)).not.toThrow();
  });

  it('should read shebang and declarations from inside the tarball', () => {
    expect(realTarball).toBeDefined();

    const indexContent = execFileSync('tar', ['-xOf', realTarball!, 'package/dist/index.js'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const declarations = execFileSync('tar', ['-xOf', realTarball!, 'package/dist/public-api.d.ts'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });

    expect(indexContent.startsWith('#!/usr/bin/env node')).toBe(true);
    expect(declarations.trim().length).toBeGreaterThan(0);
    expect(readFileSync(join(root, 'dist/public-api.d.ts'), 'utf8').trim().length).toBeGreaterThan(0);
  });
});
