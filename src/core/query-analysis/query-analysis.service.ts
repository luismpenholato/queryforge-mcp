import type { ProjectStack } from "../project-stack/project-stack.types.js";
import type { QueryAnalysis } from "./query-analysis.types.js";
import {
  analyzeEfQuerySmells as detectQuerySmells,
  getVersionNotesFromStack as collectVersionNotes,
} from "./query-smell-detector.js";

export { analyzeEfQuerySmellsList } from "./query-smell-detector.js";

export function analyzeQuery(
  code: string,
  projectStack?: ProjectStack,
  goal?: string,
): QueryAnalysis {
  return detectQuerySmells(code, projectStack, goal);
}

export function getVersionNotesFromStack(projectStack?: ProjectStack): string[] {
  return collectVersionNotes(projectStack);
}

/** @deprecated Use analyzeQuery */
export const analyzeEfQuerySmells = analyzeQuery;
