import type { ProjectStack } from "../project-stack/project-stack.types.js";
import type { QueryAnalysis } from "./query-analysis.types.js";
import type { QuerySmell } from "./query-smell.types.js";
import { isEfFeatureSupported } from "../project-stack/ef-version-rules.js";
import { getEfVersionNotes } from "../project-stack/ef-version-rules.js";
import { getProviderVersionNotes } from "../providers/provider-capabilities.js";
import {
  applyProviderSmellPolicy,
  getAnalysisMode,
  getConservativeAnalysisNotes,
} from "../providers/provider-policy.js";
import { enrichQuerySmells } from "./query-smell-enricher.js";
import {
  analyzeLinqForSmells,
  analyzeLinqPattern,
  detectTrackingRisk,
  isReadOnlyQuery,
} from "./linq-pattern-analyzer.js";

export function analyzeEfQuerySmells(
  code: string,
  projectStack?: ProjectStack,
  goal?: string,
): QueryAnalysis {
  const linqPattern = analyzeLinqPattern(code);
  const rawSmells = analyzeEfQuerySmellsList(code, projectStack, goal, linqPattern);
  const smells = applyProviderSmellPolicy(rawSmells, projectStack);

  return {
    smells,
    linqPattern,
    isReadOnly: isReadOnlyQuery(code, linqPattern),
    hasTrackingRisk: detectTrackingRisk(code),
    analysisMode: getAnalysisMode(projectStack),
  };
}

export function analyzeEfQuerySmellsList(
  code: string,
  projectStack?: ProjectStack,
  goal?: string,
  linqPattern = analyzeLinqPattern(code),
): QuerySmell[] {
  let smells = analyzeLinqForSmells(code);

  if (goal && /grid|list|pagination|paging|page/i.test(goal) && !linqPattern.hasSkipTake) {
    smells.push(createSmell({
      type: "MISSING_PAGINATION",
      severity: "medium",
      message: "Goal indicates list/grid but query has no pagination.",
      impact: "May load excessive rows for UI listing.",
      suggestion: "Add Skip/Take with OrderBy for database pagination.",
    }));
  }

  if (projectStack?.efKind === "EFCore" && projectStack.primaryTargetFramework.startsWith("netcoreapp2")) {
    const hasClientRisk = /\.AsEnumerable\s*\(|\.ToList\s*\(\)\s*\.Where/.test(code);
    if (hasClientRisk) {
      smells.push(createSmell({
        type: "CLIENT_EVALUATION_RISK",
        severity: "high",
        message: "EF Core 2.x client evaluation risk detected.",
        impact: "Filters may run in memory after loading data.",
        suggestion: "Keep operations on IQueryable before materialization.",
        needsManualReview: true,
        canAutoFix: false,
        confidence: "low",
      }));
    }
  }

  smells = enrichQuerySmells(code, linqPattern, smells, {
    hasTrackingRisk: detectTrackingRisk(code),
    isReadOnly: isReadOnlyQuery(code, linqPattern),
  });

  smells = enhanceSmellsWithVersionContext(smells, projectStack);

  return dedupeSmells(smells);
}

function createSmell(
  partial: Omit<QuerySmell, "confidence" | "needsManualReview" | "canAutoFix"> &
    Partial<Pick<QuerySmell, "confidence" | "needsManualReview" | "canAutoFix">>,
): QuerySmell {
  return {
    confidence: "medium",
    needsManualReview: true,
    canAutoFix: false,
    ...partial,
  };
}

function enhanceSmellsWithVersionContext(
  smells: QuerySmell[],
  projectStack?: ProjectStack,
): QuerySmell[] {
  if (!projectStack) {
    return smells;
  }

  return smells.map((smell) => {
    if (smell.type !== "MULTIPLE_COLLECTION_INCLUDES") {
      return smell;
    }

    const supportsSplitQuery = isEfFeatureSupported(
      projectStack.efKind,
      projectStack.efVersion,
      "AsSplitQuery",
    );

    if (supportsSplitQuery) {
      return {
        ...smell,
        suggestion: `${smell.suggestion} For EF Core 5+, consider AsSplitQuery() when multiple collection Includes are required.`,
        needsManualReview: true,
        canAutoFix: false,
      };
    }

    return {
      ...smell,
      suggestion: `${smell.suggestion} AsSplitQuery is not available in this EF Core version.`,
    };
  });
}

export function getVersionNotesFromStack(projectStack?: ProjectStack): string[] {
  if (!projectStack) return [];
  return [
    ...projectStack.limitations,
    ...projectStack.providerWarnings,
    ...getConservativeAnalysisNotes(projectStack),
    ...getEfVersionNotes(projectStack.efKind, projectStack.efVersion),
    ...getProviderVersionNotes(projectStack.provider),
  ];
}

function dedupeSmells(smells: QuerySmell[]): QuerySmell[] {
  const seen = new Set<string>();
  return smells.filter((s) => {
    const key = `${s.type}:${s.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
