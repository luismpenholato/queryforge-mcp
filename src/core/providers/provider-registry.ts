import type {
  DatabaseProvider,
  DetectedProviderPackage,
  ProviderConfidence,
  ProviderFamily,
  ProviderSupportLevel,
} from "./provider.types.js";
import type { ProjectStack } from "../project-stack/project-stack.types.js";

export interface ProviderPackageEntry {
  packageName: string;
  provider: DatabaseProvider;
  confidence?: ProviderConfidence;
}

/**
 * Ordered registry: more specific packages must appear before generic ones.
 * Unknown packages matching EF provider heuristics fall back to Custom.
 */
export const PROVIDER_PACKAGE_MAP: ProviderPackageEntry[] = [
  { packageName: "Npgsql.EntityFrameworkCore.PostgreSQL.CockroachDB", provider: "CockroachDb", confidence: "high" },
  { packageName: "Npgsql.EntityFrameworkCore.PostgreSQL", provider: "PostgreSql", confidence: "high" },
  { packageName: "Devart.Data.PostgreSql.EFCore", provider: "PostgreSql", confidence: "high" },
  { packageName: "Devart.Data.PostgreSql.EF6", provider: "PostgreSql", confidence: "high" },
  { packageName: "EntityFrameworkCore.SqlServerCompact", provider: "SqlServerCompact", confidence: "high" },
  { packageName: "EntityFramework.SqlServerCompact", provider: "SqlServerCompact", confidence: "high" },
  { packageName: "Microsoft.EntityFrameworkCore.SqlServer", provider: "SqlServer", confidence: "high" },
  { packageName: "EntityFramework.SqlServer", provider: "SqlServer", confidence: "high" },
  { packageName: "Microsoft.EntityFrameworkCore.Sqlite", provider: "SQLite", confidence: "high" },
  { packageName: "Devart.Data.SQLite.EFCore", provider: "SQLite", confidence: "high" },
  { packageName: "Devart.Data.SQLite.EF6", provider: "SQLite", confidence: "high" },
  { packageName: "System.Data.SQLite.EF6", provider: "SQLite", confidence: "high" },
  { packageName: "System.Data.SQLite.Core", provider: "SQLite", confidence: "medium" },
  { packageName: "Pomelo.EntityFrameworkCore.MySql", provider: "MySql", confidence: "high" },
  { packageName: "MySql.EntityFrameworkCore", provider: "MySql", confidence: "high" },
  { packageName: "MySql.Data.EntityFrameworkCore", provider: "MySql", confidence: "high" },
  { packageName: "Devart.Data.MySql.EFCore", provider: "MySql", confidence: "high" },
  { packageName: "Devart.Data.MySql.EF6", provider: "MySql", confidence: "high" },
  { packageName: "Oracle.EntityFrameworkCore", provider: "Oracle", confidence: "high" },
  { packageName: "Devart.Data.Oracle.EFCore", provider: "Oracle", confidence: "high" },
  { packageName: "Devart.Data.Oracle.EF6", provider: "Oracle", confidence: "high" },
  { packageName: "MongoDB.EntityFrameworkCore", provider: "MongoDB", confidence: "high" },
  { packageName: "Microsoft.EntityFrameworkCore.Cosmos", provider: "Cosmos", confidence: "high" },
  { packageName: "Microsoft.EntityFrameworkCore.InMemory", provider: "InMemory", confidence: "high" },
  { packageName: "FirebirdSql.EntityFrameworkCore.Firebird", provider: "Firebird", confidence: "high" },
  { packageName: "EntityFrameworkCore.FirebirdSql", provider: "Firebird", confidence: "high" },
  { packageName: "IBM.EntityFrameworkCore-lnx", provider: "DB2", confidence: "high" },
  { packageName: "IBM.EntityFrameworkCore", provider: "DB2", confidence: "medium" },
  { packageName: "Devart.Data.DB2.EFCore", provider: "DB2", confidence: "high" },
  { packageName: "Sap.EntityFrameworkCore.Hana", provider: "SAP_HANA", confidence: "high" },
  { packageName: "EntityFrameworkCore.Hana", provider: "SAP_HANA", confidence: "high" },
  { packageName: "EntityFrameworkCore.Jet", provider: "Jet", confidence: "high" },
  { packageName: "EntityFrameworkCore.Jet.Data", provider: "Jet", confidence: "high" },
  { packageName: "JetEntityFrameworkProvider", provider: "Jet", confidence: "high" },
  { packageName: "EntityFramework.Jet", provider: "Jet", confidence: "high" },
  { packageName: "VistaDB.EntityFrameworkCore", provider: "VistaDB", confidence: "high" },
  { packageName: "VistaDB.Provider", provider: "VistaDB", confidence: "high" },
  { packageName: "iAnywhere.Data.SQLAnywhere.EFCore", provider: "SQLAnywhere", confidence: "high" },
  { packageName: "Sap.Data.SQLAnywhere.EFCore", provider: "SQLAnywhere", confidence: "high" },
  { packageName: "Sybase.Data.AseClient", provider: "Sybase", confidence: "high" },
  { packageName: "EntityFrameworkCore.Sybase", provider: "Sybase", confidence: "high" },
  { packageName: "EntityFrameworkCore.OpenEdge", provider: "ProgressOpenEdge", confidence: "high" },
  { packageName: "Progress.OpenEdge.EntityFrameworkCore", provider: "ProgressOpenEdge", confidence: "high" },
  { packageName: "Google.Cloud.EntityFrameworkCore.Spanner", provider: "Spanner", confidence: "high" },
  { packageName: "Snowflake.EntityFrameworkCore", provider: "Snowflake", confidence: "high" },
  { packageName: "Snowflake.Data", provider: "Snowflake", confidence: "medium" },
  { packageName: "ClickHouse.EntityFrameworkCore", provider: "ClickHouse", confidence: "high" },
  { packageName: "ClickHouse.Client", provider: "ClickHouse", confidence: "medium" },
  { packageName: "DuckDB.NET.Data.Full", provider: "DuckDB", confidence: "high" },
  { packageName: "DuckDB.NET.Data", provider: "DuckDB", confidence: "medium" },
  { packageName: "RavenDB.Client", provider: "RavenDB", confidence: "medium" },
];

const EXCLUDED_EF_PACKAGES = new Set([
  "microsoft.entityframeworkcore",
  "microsoft.entityframeworkcore.design",
  "microsoft.entityframeworkcore.tools",
  "microsoft.entityframeworkcore.analyzers",
  "microsoft.entityframeworkcore.abstractions",
  "microsoft.entityframeworkcore.relational",
  "entityframework",
]);

const PROVIDER_FAMILY_MAP: Record<DatabaseProvider, ProviderFamily> = {
  SqlServer: "Relational",
  AzureSql: "Relational",
  SqlServerCompact: "Relational",
  SQLite: "Relational",
  PostgreSql: "Relational",
  CockroachDb: "Relational",
  MySql: "Relational",
  MariaDb: "Relational",
  Oracle: "Relational",
  Firebird: "Relational",
  DB2: "Relational",
  Informix: "Relational",
  SAP_HANA: "Relational",
  Access: "Relational",
  Jet: "Relational",
  VistaDB: "Relational",
  SQLAnywhere: "Relational",
  Sybase: "Relational",
  ProgressOpenEdge: "Relational",
  Spanner: "Relational",
  MongoDB: "Document",
  Cosmos: "Document",
  RavenDB: "Document",
  InMemory: "InMemory",
  Snowflake: "Analytical",
  ClickHouse: "Analytical",
  DuckDB: "Analytical",
  Custom: "Custom",
  Unknown: "Unknown",
};

const PROVIDER_SUPPORT_LEVEL_MAP: Record<DatabaseProvider, ProviderSupportLevel> = {
  SqlServer: "first_class",
  AzureSql: "first_class",
  SQLite: "first_class",
  PostgreSql: "first_class",
  MySql: "first_class",
  MariaDb: "first_class",
  Oracle: "first_class",
  MongoDB: "supported",
  Cosmos: "supported",
  InMemory: "supported",
  Firebird: "best_effort",
  DB2: "best_effort",
  Informix: "best_effort",
  SAP_HANA: "best_effort",
  Access: "best_effort",
  Jet: "best_effort",
  SqlServerCompact: "best_effort",
  CockroachDb: "best_effort",
  VistaDB: "best_effort",
  SQLAnywhere: "best_effort",
  Sybase: "best_effort",
  ProgressOpenEdge: "best_effort",
  Spanner: "detection_only",
  Snowflake: "detection_only",
  ClickHouse: "detection_only",
  DuckDB: "detection_only",
  RavenDB: "detection_only",
  Custom: "custom",
  Unknown: "unknown",
};

const CONFIDENCE_RANK: Record<ProviderConfidence, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

const SUPPORT_RANK: Record<ProviderSupportLevel, number> = {
  unknown: 0,
  custom: 1,
  detection_only: 2,
  best_effort: 3,
  supported: 4,
  first_class: 5,
};

export function getProviderFamily(provider: DatabaseProvider): ProviderFamily {
  return PROVIDER_FAMILY_MAP[provider] ?? "Unknown";
}

export function getProviderSupportLevel(provider: DatabaseProvider): ProviderSupportLevel {
  return PROVIDER_SUPPORT_LEVEL_MAP[provider] ?? "unknown";
}

export function matchKnownProviderPackage(
  packageName: string,
): ProviderPackageEntry | undefined {
  const normalized = packageName.trim();
  return PROVIDER_PACKAGE_MAP.find(
    (entry) => entry.packageName.toLowerCase() === normalized.toLowerCase(),
  );
}

export function isEfProviderPackageCandidate(packageName: string): boolean {
  const lower = packageName.toLowerCase();
  if (EXCLUDED_EF_PACKAGES.has(lower)) return false;
  if (matchKnownProviderPackage(packageName)) return true;

  return (
    lower.includes("entityframeworkcore") ||
    (lower.includes("entityframework") && !lower.endsWith(".design")) ||
    lower.includes(".efcore") ||
    lower.endsWith(".ef6")
  );
}

export function detectProvidersFromPackages(
  packages: Array<{ name: string; version?: string }>,
): DetectedProviderPackage[] {
  const detected: DetectedProviderPackage[] = [];
  const seen = new Set<string>();

  for (const pkg of packages) {
    const known = matchKnownProviderPackage(pkg.name);
    if (known) {
      const key = `${known.provider}:${pkg.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      detected.push({
        name: pkg.name,
        version: pkg.version,
        provider: known.provider,
        confidence: known.confidence ?? "high",
      });
      continue;
    }

    if (isEfProviderPackageCandidate(pkg.name)) {
      const key = `Custom:${pkg.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      detected.push({
        name: pkg.name,
        version: pkg.version,
        provider: "Custom",
        confidence: "low",
      });
    }
  }

  return detected;
}

export function resolvePrimaryProvider(
  detected: DetectedProviderPackage[],
): DetectedProviderPackage | undefined {
  if (detected.length === 0) return undefined;

  return [...detected].sort((a, b) => {
    const supportDiff =
      SUPPORT_RANK[getProviderSupportLevel(b.provider)] -
      SUPPORT_RANK[getProviderSupportLevel(a.provider)];
    if (supportDiff !== 0) return supportDiff;

    const confidenceDiff = CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence];
    if (confidenceDiff !== 0) return confidenceDiff;

    if (a.provider === "Custom" && b.provider !== "Custom") return 1;
    if (b.provider === "Custom" && a.provider !== "Custom") return -1;
    return 0;
  })[0];
}

export function buildUnknownProviderResult(): Pick<
  ProjectStack,
  | "provider"
  | "providerFamily"
  | "providerSupportLevel"
  | "providerConfidence"
  | "providerWarnings"
  | "detectedProviderPackages"
> {
  return {
    provider: "Unknown",
    providerFamily: "Unknown",
    providerSupportLevel: "unknown",
    providerConfidence: "low",
    providerWarnings: [
      "No EF database provider was detected. QueryForge will apply only generic analysis.",
    ],
    detectedProviderPackages: [],
  };
}

export function buildCustomProviderResult(
  packageName: string,
  version?: string,
  detected: DetectedProviderPackage[] = [],
): Pick<
  ProjectStack,
  | "provider"
  | "providerFamily"
  | "providerSupportLevel"
  | "providerConfidence"
  | "providerPackageName"
  | "providerVersion"
  | "providerWarnings"
  | "detectedProviderPackages"
> {
  return {
    provider: "Custom",
    providerFamily: "Custom",
    providerSupportLevel: "custom",
    providerConfidence: "low",
    providerPackageName: packageName,
    providerVersion: version,
    providerWarnings: [
      "Custom or unknown EF provider detected. QueryForge will apply only generic LINQ/EF analysis.",
    ],
    detectedProviderPackages: detected,
  };
}

/** @deprecated Use detectProvidersFromPackages */
export function detectProviderFromPackages(
  packages: Array<{ name: string }>,
): DatabaseProvider {
  const detected = detectProvidersFromPackages(packages);
  return resolvePrimaryProvider(detected)?.provider ?? "Unknown";
}

/** @deprecated Use PROVIDER_PACKAGE_MAP */
export const PROVIDER_PACKAGES: Record<string, DatabaseProvider> = Object.fromEntries(
  PROVIDER_PACKAGE_MAP.map((entry) => [entry.packageName, entry.provider]),
);
