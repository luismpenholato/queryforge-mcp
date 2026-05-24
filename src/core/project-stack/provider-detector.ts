import type { ProviderDetectionResult } from "../providers/provider.types.js";
import {
  buildCustomProviderResult,
  buildUnknownProviderResult,
  detectProvidersFromPackages,
  getProviderFamily,
  getProviderSupportLevel,
  resolvePrimaryProvider,
} from "../providers/provider-registry.js";
import { getProviderVersionNotes } from "../providers/provider-capabilities.js";
import { findFiles } from "../../shared/fs/file-search.js";
import { readFileSafe } from "../../shared/fs/file-reader.js";

interface PackageInfo {
  name: string;
  version?: string;
}

export async function detectProjectProvider(
  projectPath: string,
  packages: PackageInfo[],
): Promise<ProviderDetectionResult> {
  let detected = detectProvidersFromPackages(packages);
  const configHints = await scanProviderConfigHints(projectPath);

  detected = applyConfigHints(detected, configHints);

  const primary = resolvePrimaryProvider(detected);

  if (!primary) {
    return buildUnknownProviderResult();
  }

  if (primary.provider === "Custom") {
    const custom = buildCustomProviderResult(primary.name, primary.version, detected);
    return {
      ...custom,
      providerWarnings: mergeWarnings(custom.providerWarnings, configHints.warnings),
    };
  }

  let provider = primary.provider;
  let confidence = primary.confidence;
  const warnings: string[] = [];

  if (provider === "SqlServer" && configHints.isAzureSql) {
    provider = "AzureSql";
    confidence = "medium";
    warnings.push("Azure SQL detected from configuration hints.");
  }

  if (provider === "DB2" && configHints.isInformix) {
    provider = "Informix";
    confidence = "medium";
    warnings.push("Informix detected from connection/provider configuration hints.");
  }

  if ((provider === "Jet" || provider === "Access") && configHints.isAccessDatabase) {
    provider = "Access";
    confidence = "medium";
    warnings.push("Microsoft Access database detected from configuration hints.");
  }

  if (provider === "InMemory") {
    warnings.push("InMemory provider does not represent real database query performance.");
  }

  warnings.push(...getProviderVersionNotes(provider));
  warnings.push(...configHints.warnings);

  return {
    provider,
    providerFamily: getProviderFamily(provider),
    providerSupportLevel: getProviderSupportLevel(provider),
    providerConfidence: confidence,
    providerPackageName: primary.name,
    providerVersion: primary.version,
    providerWarnings: [...new Set(warnings)],
    detectedProviderPackages: detected,
  };
}

interface ConfigHints {
  isAzureSql: boolean;
  isInformix: boolean;
  isAccessDatabase: boolean;
  warnings: string[];
}

async function scanProviderConfigHints(projectPath: string): Promise<ConfigHints> {
  const hints: ConfigHints = {
    isAzureSql: false,
    isInformix: false,
    isAccessDatabase: false,
    warnings: [],
  };

  const patterns = ["**/Program.cs", "**/Startup.cs", "**/appsettings*.json"];
  const files = await findFiles(projectPath, patterns);

  for (const file of files.slice(0, 20)) {
    const content = await readFileSafe(projectPath, file);
    if (!content) continue;

    if (/UseAzureSql|Azure\s*SQL|"AzureSql"/i.test(content)) {
      hints.isAzureSql = true;
    }

    if (/Informix|IBM\.Data\.Informix|Ifx/i.test(content)) {
      hints.isInformix = true;
    }

    if (/Microsoft Access|\.mdb|\.accdb|Jet\.OleDb/i.test(content)) {
      hints.isAccessDatabase = true;
    }
  }

  return hints;
}

function applyConfigHints(
  detected: ReturnType<typeof detectProvidersFromPackages>,
  hints: ConfigHints,
) {
  return detected.map((entry) => {
    if (entry.provider === "SqlServer" && hints.isAzureSql) {
      return { ...entry, provider: "AzureSql" as const, confidence: "medium" as const };
    }
    if (entry.provider === "DB2" && hints.isInformix) {
      return { ...entry, provider: "Informix" as const, confidence: "medium" as const };
    }
    if (entry.provider === "Jet" && hints.isAccessDatabase) {
      return { ...entry, provider: "Access" as const, confidence: "medium" as const };
    }
    return entry;
  });
}

function mergeWarnings(base: string[], extra: string[]): string[] {
  return [...new Set([...base, ...extra])];
}
