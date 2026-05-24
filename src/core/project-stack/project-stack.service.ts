import path from "node:path";
import type { PackageReference, ProjectInfo, ProjectStack } from "./project-stack.types.js";
import { getDefaultCsharpVersion } from "./csharp-version-rules.js";
import { getDotnetVersionRules } from "./dotnet-version-rules.js";
import { getEfVersionRules } from "./ef-version-rules.js";
import { detectProjectProvider } from "./provider-detector.js";
import { parseCsproj } from "./csproj-reader.js";
import { parseDirectoryBuildProps } from "./directory-build-props-reader.js";
import { parsePackagesConfig } from "./packages-config-reader.js";
import { findFiles } from "../../shared/fs/file-search.js";
import { readFileSafe } from "../../shared/fs/file-reader.js";
import { assertProjectPathAccessible } from "../../shared/fs/project-path-validator.js";

const EF_CORE_PACKAGES = ["Microsoft.EntityFrameworkCore"];
const EF6_PACKAGES = ["EntityFramework"];
const DAPPER_PACKAGES = ["Dapper"];

interface PackageInfo {
  name: string;
  version: string;
}

export async function analyzeProjectStack(projectPath: string): Promise<ProjectStack> {
  const resolvedPath = await assertProjectPathAccessible(projectPath);
  const csprojPaths = await findFiles(resolvedPath, ["**/*.csproj"]);

  const projects: ProjectInfo[] = [];
  let allPackages: PackageInfo[] = [];
  let langVersion: string | undefined;
  const allTargetFrameworks = new Set<string>();

  const buildPropsPaths = await findFiles(resolvedPath, ["**/Directory.Build.props"]);
  for (const propsPath of buildPropsPaths) {
    const content = await readFileSafe(resolvedPath, propsPath);
    if (!content) continue;
    const props = parseDirectoryBuildProps(content);
    props.targetFrameworks.forEach((tf) => allTargetFrameworks.add(tf));
    langVersion ??= props.langVersion;
    allPackages.push(
      ...props.packageReferences.map((p) => ({ name: p.name, version: p.version })),
    );
  }

  for (const csprojPath of csprojPaths) {
    const content = await readFileSafe(resolvedPath, csprojPath);
    if (!content) continue;

    const csproj = parseCsproj(content, csprojPath);
    csproj.targetFrameworks.forEach((tf) => allTargetFrameworks.add(tf));
    langVersion ??= csproj.langVersion;
    allPackages.push(
      ...csproj.packageReferences.map((p) => ({ name: p.name, version: p.version })),
    );

    projects.push({
      path: csprojPath,
      name: csproj.name,
      targetFrameworks: csproj.targetFrameworks,
      primaryTargetFramework:
        csproj.targetFrameworks[0] ?? csproj.targetFramework ?? "unknown",
    });
  }

  const packagesConfigPaths = await findFiles(resolvedPath, ["**/packages.config"]);
  for (const configPath of packagesConfigPaths) {
    const content = await readFileSafe(resolvedPath, configPath);
    if (!content) continue;
    const packages = parsePackagesConfig(content);
    allPackages.push(...packages.map((p) => ({ name: p.id, version: p.version })));
  }

  allPackages = dedupePackages(allPackages);

  const targetFrameworks = [...allTargetFrameworks];
  const primaryTargetFramework = targetFrameworks[0] ?? "unknown";
  const csharpVersion =
    langVersion ?? getDefaultCsharpVersion(primaryTargetFramework);

  const efCorePkg = findPackage(allPackages, EF_CORE_PACKAGES);
  const ef6Pkg = findPackage(allPackages, EF6_PACKAGES);
  const dapperPkg = findPackage(allPackages, DAPPER_PACKAGES);

  let efKind: ProjectStack["efKind"] = "None";
  let efVersion = "unknown";

  if (efCorePkg) {
    efKind = "EFCore";
    efVersion = efCorePkg.version;
  } else if (ef6Pkg) {
    efKind = "EF6";
    efVersion = ef6Pkg.version;
  }

  const providerDetection = await detectProjectProvider(resolvedPath, allPackages);
  const dotnetRules = getDotnetVersionRules(primaryTargetFramework);
  const efRules = getEfVersionRules(efKind, efVersion);

  const limitations = [...dotnetRules.limitations, ...efRules.limitations];
  const supportedOptimizations = dotnetRules.supportedOptimizations.filter((opt) => {
    if (opt === "AsSplitQuery" && !efRules.supportsAsSplitQuery) return false;
    if (opt === "AsNoTrackingWithIdentityResolution" && !efRules.supportsAsNoTrackingWithIdentityResolution) {
      return false;
    }
    return true;
  });

  const warnings: string[] = [...providerDetection.providerWarnings];
  if (projects.length === 0) {
    warnings.push("No .csproj files found in the project path.");
  }
  if (efKind === "None") {
    warnings.push("No Entity Framework package detected.");
  }

  return {
    projectPath: resolvedPath,
    projects,
    primaryProject: projects.length === 1 ? projects[0] : undefined,
    targetFrameworks,
    primaryTargetFramework,
    csharpVersion,
    efKind,
    efVersion,
    provider: providerDetection.provider,
    providerFamily: providerDetection.providerFamily,
    providerSupportLevel: providerDetection.providerSupportLevel,
    providerConfidence: providerDetection.providerConfidence,
    providerPackageName: providerDetection.providerPackageName,
    providerVersion: providerDetection.providerVersion,
    providerWarnings: providerDetection.providerWarnings,
    detectedProviderPackages: providerDetection.detectedProviderPackages,
    hasDapper: !!dapperPkg,
    dapperVersion: dapperPkg?.version ?? "unknown",
    limitations,
    supportedOptimizations,
    warnings,
  };
}

function dedupePackages(packages: PackageInfo[]): PackageInfo[] {
  const map = new Map<string, PackageInfo>();
  for (const pkg of packages) {
    const existing = map.get(pkg.name.toLowerCase());
    if (!existing || (existing.version === "unknown" && pkg.version !== "unknown")) {
      map.set(pkg.name.toLowerCase(), pkg);
    }
  }
  return [...map.values()];
}

function findPackage(
  packages: PackageReference[] | PackageInfo[],
  names: string[],
): PackageInfo | undefined {
  const lowerNames = names.map((n) => n.toLowerCase());
  return packages.find((p) => lowerNames.includes(p.name.toLowerCase())) as
    | PackageInfo
    | undefined;
}

export function toInspectOutput(stack: ProjectStack): Omit<ProjectStack, "projectPath" | "projects" | "primaryProject"> & {
  projects?: ProjectInfo[];
  primaryProject?: ProjectInfo;
} {
  const output: ReturnType<typeof toInspectOutput> = {
    targetFrameworks: stack.targetFrameworks,
    primaryTargetFramework: stack.primaryTargetFramework,
    csharpVersion: stack.csharpVersion,
    efKind: stack.efKind,
    efVersion: stack.efVersion,
    provider: stack.provider,
    providerFamily: stack.providerFamily,
    providerSupportLevel: stack.providerSupportLevel,
    providerConfidence: stack.providerConfidence,
    providerPackageName: stack.providerPackageName,
    providerVersion: stack.providerVersion,
    providerWarnings: stack.providerWarnings,
    detectedProviderPackages: stack.detectedProviderPackages,
    hasDapper: stack.hasDapper,
    dapperVersion: stack.dapperVersion,
    limitations: stack.limitations,
    supportedOptimizations: stack.supportedOptimizations,
    warnings: stack.warnings,
  };

  if (stack.projects.length > 0) {
    output.projects = stack.projects.map((p) => ({
      ...p,
      path: path.relative(stack.projectPath, p.path) || p.path,
    }));
  }
  if (stack.primaryProject) {
    output.primaryProject = {
      ...stack.primaryProject,
      path:
        path.relative(stack.projectPath, stack.primaryProject.path) ||
        stack.primaryProject.path,
    };
  }

  return output;
}
