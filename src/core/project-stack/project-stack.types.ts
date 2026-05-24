import type {
  DatabaseProvider,
  DetectedProviderPackage,
  ProviderConfidence,
  ProviderFamily,
  ProviderSupportLevel,
} from "../providers/provider.types.js";

export type {
  DatabaseProvider,
  DetectedProviderPackage,
  ProviderConfidence,
  ProviderFamily,
  ProviderSupportLevel,
};

export type EfKind = "EFCore" | "EF6" | "None" | "unknown";

export interface ProjectInfo {
  path: string;
  name: string;
  targetFrameworks: string[];
  primaryTargetFramework: string;
}

export interface ProjectStack {
  projectPath: string;
  projects: ProjectInfo[];
  primaryProject?: ProjectInfo;
  targetFrameworks: string[];
  primaryTargetFramework: string;
  csharpVersion: string;
  efKind: EfKind;
  efVersion: string;
  provider: DatabaseProvider;
  providerFamily: ProviderFamily;
  providerSupportLevel: ProviderSupportLevel;
  providerConfidence: ProviderConfidence;
  providerPackageName?: string;
  providerVersion?: string;
  providerWarnings: string[];
  detectedProviderPackages: DetectedProviderPackage[];
  hasDapper: boolean;
  dapperVersion: string;
  limitations: string[];
  supportedOptimizations: string[];
  warnings: string[];
}

export interface PackageReference {
  name: string;
  version: string;
}

export interface CsprojData {
  path: string;
  name: string;
  targetFramework?: string;
  targetFrameworks: string[];
  langVersion?: string;
  packageReferences: PackageReference[];
}
