import type {
  DatabaseProvider,
  ProviderConfidence,
  ProviderFamily,
  ProviderSupportLevel,
} from "./provider.types.js";
import type { ProjectStack } from "../project-stack/project-stack.types.js";

export interface ProviderRule {
  supportsIncludeIndex: boolean;
  paginationSyntax: string;
  warnings: string[];
  indexConfidence: ProviderConfidence;
}

export function getProviderRules(provider: DatabaseProvider): ProviderRule {
  switch (provider) {
    case "SqlServer":
    case "AzureSql":
      return {
        supportsIncludeIndex: true,
        paginationSyntax: "OFFSET/FETCH",
        warnings: [],
        indexConfidence: "high",
      };
    case "PostgreSql":
    case "CockroachDb":
      return {
        supportsIncludeIndex: true,
        paginationSyntax: "LIMIT/OFFSET",
        warnings: ["Use INCLUDE columns cautiously; validate with execution plan."],
        indexConfidence: "high",
      };
    case "MySql":
    case "MariaDb":
      return {
        supportsIncludeIndex: false,
        paginationSyntax: "LIMIT/OFFSET",
        warnings: ["MySQL/MariaDB does not support INCLUDE columns in indexes."],
        indexConfidence: "high",
      };
    case "SQLite":
      return {
        supportsIncludeIndex: false,
        paginationSyntax: "LIMIT/OFFSET",
        warnings: ["Keep index suggestions simple for SQLite."],
        indexConfidence: "medium",
      };
    case "Oracle":
      return {
        supportsIncludeIndex: false,
        paginationSyntax: "OFFSET/FETCH or ROWNUM",
        warnings: ["Use simple Oracle index syntax; validate with execution plan."],
        indexConfidence: "medium",
      };
    case "MongoDB":
      return {
        supportsIncludeIndex: false,
        paginationSyntax: "n/a",
        warnings: [
          "MongoDB uses document indexes, not relational CREATE INDEX SQL.",
          "Validate with explain plan.",
        ],
        indexConfidence: "low",
      };
    case "Cosmos":
      return {
        supportsIncludeIndex: false,
        paginationSyntax: "n/a",
        warnings: [
          "Cosmos DB uses indexing policy, not CREATE INDEX SQL.",
          "Review container indexing policy instead.",
        ],
        indexConfidence: "low",
      };
    case "InMemory":
      return {
        supportsIncludeIndex: false,
        paginationSyntax: "n/a",
        warnings: ["InMemory provider does not represent real database query performance."],
        indexConfidence: "low",
      };
    default:
      return {
        supportsIncludeIndex: false,
        paginationSyntax: "unknown",
        warnings: ["Provider-specific index syntax is not fully supported."],
        indexConfidence: "low",
      };
  }
}

export function getConnectionType(provider: DatabaseProvider): string {
  switch (provider) {
    case "SqlServer":
    case "AzureSql":
    case "SqlServerCompact":
      return "SqlConnection";
    case "MySql":
    case "MariaDb":
      return "MySqlConnection";
    case "PostgreSql":
    case "CockroachDb":
      return "NpgsqlConnection";
    case "SQLite":
      return "SqliteConnection";
    case "Oracle":
      return "OracleConnection";
    case "Firebird":
      return "FbConnection";
    case "DB2":
      return "DB2Connection";
    case "SAP_HANA":
      return "HanaConnection";
    default:
      return "IDbConnection";
  }
}

export interface DapperCapability {
  allowed: boolean;
  reason: string;
  needsManualReview: boolean;
}

export function getDapperCapability(
  stack: Pick<ProjectStack, "provider" | "providerFamily" | "providerSupportLevel">,
): DapperCapability {
  const { provider, providerFamily, providerSupportLevel } = stack;

  if (providerFamily !== "Relational") {
    return {
      allowed: false,
      reason: `Dapper is not supported for ${providerFamily} provider family (${provider}).`,
      needsManualReview: false,
    };
  }

  if (providerSupportLevel === "custom" || provider === "Custom") {
    return {
      allowed: false,
      reason: "Custom EF provider detected. Dapper suggestions are disabled by default.",
      needsManualReview: true,
    };
  }

  if (providerSupportLevel === "unknown" || provider === "Unknown") {
    return {
      allowed: false,
      reason: "Unknown provider. Dapper suggestions are disabled.",
      needsManualReview: false,
    };
  }

  if (providerSupportLevel === "detection_only") {
    return {
      allowed: false,
      reason: `${provider} is detection-only. Dapper is not recommended automatically.`,
      needsManualReview: true,
    };
  }

  if (providerSupportLevel === "best_effort") {
    return {
      allowed: true,
      reason: `${provider} has best-effort support. Dapper allowed only when already installed.`,
      needsManualReview: true,
    };
  }

  return {
    allowed: true,
    reason: "Relational provider with supported Dapper path.",
    needsManualReview: false,
  };
}

export function getProviderVersionNotes(provider: DatabaseProvider): string[] {
  switch (provider) {
    case "MongoDB":
      return [
        "MongoDB EF provider uses document queries. Relational SQL optimizations do not apply.",
      ];
    case "Cosmos":
      return [
        "Cosmos DB EF provider uses NoSQL APIs. Relational JOIN/index SQL does not apply.",
      ];
    case "InMemory":
      return [
        "InMemory provider does not represent real database query performance.",
      ];
    case "RavenDB":
      return [
        "RavenDB is a document database. QueryForge applies detection-only generic analysis.",
      ];
    default:
      return [];
  }
}

export function shouldApplyGenericAnalysisOnly(
  stack: Pick<ProjectStack, "providerFamily" | "providerSupportLevel" | "provider">,
): boolean {
  return (
    stack.providerFamily === "Document" ||
    stack.providerFamily === "Unknown" ||
    stack.providerFamily === "Custom" ||
    stack.providerFamily === "InMemory" ||
    stack.providerFamily === "Analytical" ||
    stack.providerSupportLevel === "detection_only" ||
    stack.provider === "Custom" ||
    stack.provider === "Unknown" ||
    stack.provider === "MongoDB" ||
    stack.provider === "Cosmos" ||
    stack.provider === "InMemory"
  );
}

export function getIndexCapability(
  stack: Pick<ProjectStack, "provider" | "providerFamily" | "providerSupportLevel">,
): {
  canGenerateSql: boolean;
  conceptualOnly: boolean;
  confidence: ProviderConfidence;
  warnings: string[];
} {
  const { provider, providerFamily, providerSupportLevel } = stack;
  const rules = getProviderRules(provider);

  if (providerFamily === "InMemory") {
    return {
      canGenerateSql: false,
      conceptualOnly: false,
      confidence: "low",
      warnings: ["InMemory provider does not benefit from database indexes."],
    };
  }

  if (providerFamily === "Custom" || providerFamily === "Unknown") {
    return {
      canGenerateSql: false,
      conceptualOnly: false,
      confidence: "low",
      warnings: ["No provider-specific index suggestions for Custom/Unknown providers."],
    };
  }

  if (provider === "Cosmos") {
    return {
      canGenerateSql: false,
      conceptualOnly: true,
      confidence: "low",
      warnings: [
        "Review Cosmos DB indexing policy for the container instead of CREATE INDEX SQL.",
      ],
    };
  }

  if (provider === "MongoDB") {
    return {
      canGenerateSql: false,
      conceptualOnly: true,
      confidence: "low",
      warnings: [
        "Consider a MongoDB document index on filtered/sorted fields.",
        "Validate with explain plan.",
      ],
    };
  }

  if (providerSupportLevel === "best_effort") {
    return {
      canGenerateSql: true,
      conceptualOnly: true,
      confidence: "low",
      warnings: [
        ...rules.warnings,
        "Best-effort provider: index suggestion is conceptual. Validate syntax for your engine.",
      ],
    };
  }

  if (providerSupportLevel === "detection_only") {
    return {
      canGenerateSql: false,
      conceptualOnly: true,
      confidence: "low",
      warnings: [`${provider} is detection-only. No relational CREATE INDEX SQL generated.`],
    };
  }

  if (providerSupportLevel === "first_class") {
    return {
      canGenerateSql: true,
      conceptualOnly: false,
      confidence: rules.indexConfidence,
      warnings: rules.warnings,
    };
  }

  return {
    canGenerateSql: false,
    conceptualOnly: true,
    confidence: "low",
    warnings: rules.warnings,
  };
}

export type { ProviderFamily, ProviderSupportLevel };
