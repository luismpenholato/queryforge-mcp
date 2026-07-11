import { describe, expect, it } from 'vitest';
import {
  computeDiagnosticFingerprint,
  normalizeFilePath
} from '../../src/application/diagnostic-fingerprint.js';

describe('diagnostic fingerprint', () => {
  it('should be deterministic for the same input', () => {
    const input = {
      filePath: 'Features/ProductService.cs',
      ruleCode: 'COUNT_GREATER_THAN_ZERO',
      range: { start: 10, end: 30 },
      matchedText: 'CountAsync() > 0'
    };

    expect(computeDiagnosticFingerprint(input)).toBe(computeDiagnosticFingerprint(input));
  });

  it('should normalize path separators', () => {
    const left = computeDiagnosticFingerprint({
      filePath: 'Features\\ProductService.cs',
      ruleCode: 'COUNT_GREATER_THAN_ZERO',
      range: { start: 1, end: 5 },
      matchedText: 'Count'
    });

    const right = computeDiagnosticFingerprint({
      filePath: 'Features/ProductService.cs',
      ruleCode: 'COUNT_GREATER_THAN_ZERO',
      range: { start: 1, end: 5 },
      matchedText: 'Count'
    });

    expect(left).toBe(right);
    expect(normalizeFilePath('A\\B\\C')).toBe('A/B/C');
  });

  it('should produce different fingerprints for different files', () => {
    const base = {
      ruleCode: 'COUNT_GREATER_THAN_ZERO',
      range: { start: 1, end: 5 },
      matchedText: 'Count'
    };

    const a = computeDiagnosticFingerprint({ ...base, filePath: 'A.cs' });
    const b = computeDiagnosticFingerprint({ ...base, filePath: 'B.cs' });

    expect(a).not.toBe(b);
  });

  it('should produce different fingerprints for different occurrences', () => {
    const base = {
      filePath: 'A.cs',
      ruleCode: 'COUNT_GREATER_THAN_ZERO',
      matchedText: 'Count'
    };

    const a = computeDiagnosticFingerprint({ ...base, range: { start: 1, end: 5 } });
    const b = computeDiagnosticFingerprint({ ...base, range: { start: 20, end: 24 } });

    expect(a).not.toBe(b);
  });

  it('should produce different fingerprints for different rules', () => {
    const base = {
      filePath: 'A.cs',
      range: { start: 1, end: 5 },
      matchedText: 'Count'
    };

    const a = computeDiagnosticFingerprint({ ...base, ruleCode: 'COUNT_GREATER_THAN_ZERO' });
    const b = computeDiagnosticFingerprint({ ...base, ruleCode: 'LARGE_TAKE' });

    expect(a).not.toBe(b);
  });
});
