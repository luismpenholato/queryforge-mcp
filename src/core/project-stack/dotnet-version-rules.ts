export interface DotnetVersionRule {
  maxCsharpVersion: string;
  unsupportedFeatures: string[];
  limitations: string[];
  supportedOptimizations: string[];
}

const DEFAULT_RULE: DotnetVersionRule = {
  maxCsharpVersion: "12.0",
  unsupportedFeatures: [],
  limitations: [],
  supportedOptimizations: [
    "AsNoTracking",
    "ProjectionToDto",
    "MoveWhereBeforeMaterialization",
    "DatabasePagination",
    "AsSplitQuery",
    "AsNoTrackingWithIdentityResolution",
  ],
};

const RULES: Record<string, DotnetVersionRule> = {
  netcoreapp2_1: {
    maxCsharpVersion: "7.3",
    unsupportedFeatures: [
      "AsSplitQuery",
      "filtered Include",
      "records",
      "switch expressions",
      "target-typed new",
      "top-level statements",
      "nullable reference types",
    ],
    limitations: [
      "EF Core 2.x may allow client evaluation in some scenarios.",
      "Do not suggest AsSplitQuery because it is not supported by this EF Core version.",
      "Avoid modern C# features not supported by default LangVersion.",
    ],
    supportedOptimizations: [
      "AsNoTracking",
      "ProjectionToDto",
      "MoveWhereBeforeMaterialization",
      "DatabasePagination",
    ],
  },
  net6_0: {
    maxCsharpVersion: "10.0",
    unsupportedFeatures: [],
    limitations: [],
    supportedOptimizations: [
      "AsNoTracking",
      "AsNoTrackingWithIdentityResolution",
      "ProjectionToDto",
      "MoveWhereBeforeMaterialization",
      "DatabasePagination",
      "AsSplitQuery",
    ],
  },
  net8_0: {
    maxCsharpVersion: "12.0",
    unsupportedFeatures: [],
    limitations: [],
    supportedOptimizations: [
      "AsNoTracking",
      "AsNoTrackingWithIdentityResolution",
      "ProjectionToDto",
      "MoveWhereBeforeMaterialization",
      "DatabasePagination",
      "AsSplitQuery",
    ],
  },
};

function normalizeFramework(tf: string): string {
  return tf.toLowerCase().replace(/\./g, "_").replace(/-/g, "_");
}

export function getDotnetVersionRules(targetFramework: string): DotnetVersionRule {
  const key = normalizeFramework(targetFramework);

  if (RULES[key]) return RULES[key];

  if (key.startsWith("netcoreapp2")) return RULES.netcoreapp2_1;
  if (key.startsWith("net6")) return RULES.net6_0;
  if (key.startsWith("net8") || key.startsWith("net9") || key.startsWith("net10")) {
    return RULES.net8_0;
  }

  if (key.startsWith("net4") || key.startsWith("net48") || key.startsWith("net472")) {
    return {
      maxCsharpVersion: "7.3",
      unsupportedFeatures: ["AsSplitQuery", "EF Core APIs"],
      limitations: ["Legacy .NET Framework may use EF6 with different APIs."],
      supportedOptimizations: ["AsNoTracking", "ProjectionToDto", "MoveWhereBeforeMaterialization"],
    };
  }

  return DEFAULT_RULE;
}

export function isFeatureSupported(
  targetFramework: string,
  feature: string,
): boolean {
  const rules = getDotnetVersionRules(targetFramework);
  return !rules.unsupportedFeatures.some(
    (f) => f.toLowerCase() === feature.toLowerCase(),
  );
}
