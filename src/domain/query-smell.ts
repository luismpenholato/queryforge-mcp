import type { QueryFix } from './query-fix.js';
import type { Severity } from './severity.js';
import type { SourceRange } from './source-range.js';

export interface QuerySmell {
  code: string;
  title: string;
  severity: Severity;
  message: string;
  suggestion: string;
  confidence: number;
  category?: string;
  whyItMatters?: string;
  rewritePlan?: string[];
  safeAutoFix?: boolean;
  range?: SourceRange;
  fixes?: QueryFix[];
  fingerprint?: string;
}

export function deriveSafeAutoFix(smell: QuerySmell): boolean {
  return smell.fixes?.some((fix) => fix.safety === 'safe' && fix.edits && fix.edits.length > 0) ?? false;
}

export function withSafeAutoFix(smell: QuerySmell): QuerySmell {
  const safeAutoFix = deriveSafeAutoFix(smell);

  if (smell.safeAutoFix === safeAutoFix) {
    return smell;
  }

  return { ...smell, safeAutoFix };
}

export function createReviewRequiredFix(id: string, title: string): QueryFix {
  return {
    id,
    title,
    safety: 'review-required'
  };
}
