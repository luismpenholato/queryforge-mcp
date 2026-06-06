import { Severity } from './severity.js';

export interface QuerySmell {
  code: string;
  title: string;
  severity: Severity;
  message: string;
  suggestion: string;
  confidence: number;
}
