export interface EfVersionRule {
  supportsAsSplitQuery: boolean;
  supportsFilteredInclude: boolean;
  supportsAsNoTrackingWithIdentityResolution: boolean;
  limitations: string[];
}

export function getEfVersionRules(
  efKind: string,
  efVersion: string,
): EfVersionRule {
  if (efKind === "EF6") {
    return {
      supportsAsSplitQuery: false,
      supportsFilteredInclude: false,
      supportsAsNoTrackingWithIdentityResolution: false,
      limitations: [
        "EF6 uses different APIs than EF Core.",
        "Do not suggest EF Core-only features.",
      ],
    };
  }

  if (efKind !== "EFCore" || efVersion === "unknown") {
    return {
      supportsAsSplitQuery: false,
      supportsFilteredInclude: false,
      supportsAsNoTrackingWithIdentityResolution: false,
      limitations: ["EF Core version could not be determined."],
    };
  }

  const major = parseInt(efVersion.split(".")[0], 10);

  return {
    supportsAsSplitQuery: major >= 5,
    supportsFilteredInclude: major >= 5,
    supportsAsNoTrackingWithIdentityResolution: major >= 6,
    limitations: major < 3
      ? ["EF Core 2.x may allow client evaluation in some scenarios."]
      : major < 5
        ? ["Do not suggest AsSplitQuery because it is not supported by this EF Core version."]
        : [],
  };
}

export function getEfVersionNotes(efKind: string, efVersion: string): string[] {
  return getEfVersionRules(efKind, efVersion).limitations;
}

export function isEfFeatureSupported(
  efKind: string,
  efVersion: string,
  feature: "AsSplitQuery" | "AsNoTrackingWithIdentityResolution" | "FilteredInclude",
): boolean {
  const rules = getEfVersionRules(efKind, efVersion);
  switch (feature) {
    case "AsSplitQuery":
      return rules.supportsAsSplitQuery;
    case "AsNoTrackingWithIdentityResolution":
      return rules.supportsAsNoTrackingWithIdentityResolution;
    case "FilteredInclude":
      return rules.supportsFilteredInclude;
    default:
      return false;
  }
}
