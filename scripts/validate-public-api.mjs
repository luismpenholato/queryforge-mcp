#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(root, 'dist');

const REQUIRED_FILES = [
  'public-api.js',
  'public-api.d.ts',
  'index.js'
];

const OPTIONAL_SOURCE_MAPS = ['public-api.js.map', 'index.js.map'];

const REQUIRED_SERVICES = [
  'QueryAnalysisService',
  'QueryBatchAnalysisService',
  'ProjectStackService',
  'EfRewriteService',
  'ReviewReportService',
  'IndexCandidateService'
];

const REQUIRED_DECLARATION_SYMBOLS = [
  'QueryAnalysisService',
  'QueryBatchAnalysisService',
  'QueryAnalysisRequest',
  'QueryAnalysisResult',
  'QuerySmell',
  'QueryFix',
  'SourceRange',
  'AnalysisOptions'
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function assertFileExists(relativePath) {
  const absolutePath = join(distDir, relativePath);

  if (!existsSync(absolutePath)) {
    fail(`Missing required build artifact: dist/${relativePath}`);
  }

  return absolutePath;
}

for (const file of REQUIRED_FILES) {
  assertFileExists(file);
}

for (const file of OPTIONAL_SOURCE_MAPS) {
  if (!existsSync(join(distDir, file))) {
    continue;
  }
}

const indexPath = assertFileExists('index.js');
const indexContent = readFileSync(indexPath, 'utf8');

if (!indexContent.startsWith('#!/usr/bin/env node')) {
  fail('dist/index.js must start with #!/usr/bin/env node');
}

const declarationsPath = assertFileExists('public-api.d.ts');
const declarations = readFileSync(declarationsPath, 'utf8').trim();

if (!declarations) {
  fail('dist/public-api.d.ts is empty.');
}

for (const symbol of REQUIRED_DECLARATION_SYMBOLS) {
  if (!declarations.includes(symbol)) {
    fail(`dist/public-api.d.ts does not export ${symbol}.`);
  }
}

const publicApiModule = await import(pathToFileURL(join(distDir, 'public-api.js')).href);

for (const serviceName of REQUIRED_SERVICES) {
  if (typeof publicApiModule[serviceName] !== 'function') {
    fail(`${serviceName} is not exported from dist/public-api.js`);
  }
}

if (globalThis.__queryforgeMcpStarted) {
  fail('Importing dist/public-api.js must not start the MCP server.');
}

const { applyTextEdits } = await import(pathToFileURL(join(distDir, 'rules/support/apply-text-edits.js')).href);
const service = new publicApiModule.QueryAnalysisService();

const code = 'var exists = await query.CountAsync() > 0;';

const result = service.analyze({
  code,
  provider: 'ef-core',
  filePath: 'Features/ProductService.cs',
  languageId: 'csharp'
});

const countIssue = result.smells.find((smell) => smell.code === 'COUNT_GREATER_THAN_ZERO');

if (!countIssue) {
  fail('Smoke test did not return COUNT_GREATER_THAN_ZERO.');
}

if (!countIssue.range || countIssue.range.start < 0 || countIssue.range.end <= countIssue.range.start) {
  fail('COUNT_GREATER_THAN_ZERO is missing a valid source range.');
}

if (!countIssue.fingerprint) {
  fail('COUNT_GREATER_THAN_ZERO is missing a fingerprint.');
}

const safeFix = countIssue.fixes?.find((fix) => fix.safety === 'safe' && fix.edits?.length);

if (!safeFix) {
  fail('COUNT_GREATER_THAN_ZERO is missing a safe fix with edits.');
}

const rewritten = applyTextEdits(code, safeFix.edits);

if (rewritten !== 'var exists = await query.AnyAsync();') {
  fail(`Safe fix rewrite mismatch.\nExpected: var exists = await query.AnyAsync();\nReceived: ${rewritten}`);
}

validateConsumerTypes();

console.log('Public API validation passed.');

function validateConsumerTypes() {
  const tscPath = join(root, 'node_modules', 'typescript', 'bin', 'tsc');
  const tsconfigPath = join(root, 'tests', 'fixtures', 'tsconfig.public-api.json');

  try {
    execFileSync(process.execPath, [tscPath, '--noEmit', '-p', tsconfigPath], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch (error) {
    const stderr = error.stderr?.toString() ?? error.message;
    fail(`Consumer TypeScript validation failed.\n${stderr}`);
  }
}
