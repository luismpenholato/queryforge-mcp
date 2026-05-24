export type DatabaseProvider =
  | "SqlServer"
  | "AzureSql"
  | "SqlServerCompact"
  | "SQLite"
  | "PostgreSql"
  | "CockroachDb"
  | "MySql"
  | "MariaDb"
  | "Oracle"
  | "Firebird"
  | "DB2"
  | "Informix"
  | "SAP_HANA"
  | "Access"
  | "Jet"
  | "VistaDB"
  | "SQLAnywhere"
  | "Sybase"
  | "ProgressOpenEdge"
  | "Spanner"
  | "MongoDB"
  | "Cosmos"
  | "RavenDB"
  | "InMemory"
  | "Snowflake"
  | "ClickHouse"
  | "DuckDB"
  | "Custom"
  | "Unknown";

export type ProviderFamily =
  | "Relational"
  | "Document"
  | "InMemory"
  | "Analytical"
  | "Custom"
  | "Unknown";

export type ProviderSupportLevel =
  | "first_class"
  | "supported"
  | "best_effort"
  | "detection_only"
  | "custom"
  | "unknown";

export type ProviderConfidence = "low" | "medium" | "high";

export const DATABASE_PROVIDER_VALUES = [
  "SqlServer",
  "AzureSql",
  "SqlServerCompact",
  "SQLite",
  "PostgreSql",
  "CockroachDb",
  "MySql",
  "MariaDb",
  "Oracle",
  "Firebird",
  "DB2",
  "Informix",
  "SAP_HANA",
  "Access",
  "Jet",
  "VistaDB",
  "SQLAnywhere",
  "Sybase",
  "ProgressOpenEdge",
  "Spanner",
  "MongoDB",
  "Cosmos",
  "RavenDB",
  "InMemory",
  "Snowflake",
  "ClickHouse",
  "DuckDB",
  "Custom",
  "Unknown",
] as const satisfies readonly DatabaseProvider[];

export interface DetectedProviderPackage {
  name: string;
  version?: string;
  provider: DatabaseProvider;
  confidence: ProviderConfidence;
}

export interface ProviderDetectionResult {
  provider: DatabaseProvider;
  providerFamily: ProviderFamily;
  providerSupportLevel: ProviderSupportLevel;
  providerConfidence: ProviderConfidence;
  providerPackageName?: string;
  providerVersion?: string;
  providerWarnings: string[];
  detectedProviderPackages: DetectedProviderPackage[];
}
