import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { applyTextEdits } from '../dist/rules/support/apply-text-edits.js';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const publicApiPath = join(scriptDir, '../dist/public-api.js');
const module = await import(pathToFileURL(publicApiPath).href);

if (!module.QueryAnalysisService) {
  console.error('QueryAnalysisService export is missing from the public API.');
  process.exit(1);
}

const service = new module.QueryAnalysisService();

const code = `
var exists = await _context.Products
  .Where(product => product.IsActive)
  .CountAsync() > 0;
`;

const result = service.analyze({
  code,
  provider: 'ef-core',
  filePath: 'Features/Products/ProductService.cs',
  languageId: 'csharp'
});

if (!Array.isArray(result.smells) || result.smells.length === 0) {
  console.error('Expected at least one smell from the public API smoke test.');
  process.exit(1);
}

const countIssue = result.smells.find((smell) => smell.code === 'COUNT_GREATER_THAN_ZERO');

if (!countIssue?.range || countIssue.range.start < 0 || countIssue.range.end <= countIssue.range.start) {
  console.error('Expected a valid source range on COUNT_GREATER_THAN_ZERO.');
  process.exit(1);
}

const safeFix = countIssue.fixes?.find((fix) => fix.safety === 'safe' && fix.edits?.length);

if (!safeFix) {
  console.error('Expected a safe fix for COUNT_GREATER_THAN_ZERO.');
  process.exit(1);
}

const rewritten = applyTextEdits(code, safeFix.edits);

if (!/\.AnyAsync\s*\(/.test(rewritten) || /\.CountAsync\s*\([^)]*\)\s*>\s*0/.test(rewritten)) {
  console.error('Safe fix did not produce the expected rewritten code.');
  process.exit(1);
}

if (globalThis.__queryforgeMcpStarted) {
  console.error('Importing the public API must not start the MCP server.');
  process.exit(1);
}

console.log('Public API smoke test passed.');
