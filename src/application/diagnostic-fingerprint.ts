import { createHash } from 'node:crypto';
import type { SourceRange } from '../domain/source-range.js';

const FINGERPRINT_LENGTH = 16;

export function normalizeFilePath(filePath?: string): string {
  if (!filePath) {
    return '';
  }

  return filePath.replace(/\\/g, '/');
}

export function computeDiagnosticFingerprint(input: {
  filePath?: string;
  ruleCode: string;
  range?: SourceRange;
  matchedText?: string;
}): string {
  const normalizedPath = normalizeFilePath(input.filePath);
  const rangePart = input.range ? `${input.range.start}` : '';
  const matchPart = (input.matchedText ?? '').replace(/\s+/g, ' ').trim();

  const payload = `${normalizedPath}|${input.ruleCode}|${rangePart}|${matchPart}`;
  const digest = createHash('sha256').update(payload, 'utf8').digest('hex');

  return digest.slice(0, FINGERPRINT_LENGTH);
}
