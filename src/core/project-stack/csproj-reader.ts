import path from "node:path";
import { XMLParser } from "fast-xml-parser";
import type { CsprojData } from "./project-stack.types.js";
import {
  getElementText,
  parsePackageReferences,
  parseTargetFrameworks,
} from "./package-reference-reader.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
});

export function parseCsproj(content: string, filePath: string): CsprojData {
  const parsed = parser.parse(content);
  const project = parsed.Project ?? parsed.project ?? parsed;
  const propertyGroup = project.PropertyGroup;
  const { targetFramework, targetFrameworks, langVersion } =
    parseTargetFrameworks(propertyGroup);
  const packageReferences = parsePackageReferences(project);

  return {
    path: filePath,
    name: path.basename(filePath, ".csproj"),
    targetFramework,
    targetFrameworks,
    langVersion,
    packageReferences,
  };
}

export function parseDirectoryBuildProps(content: string): {
  targetFramework?: string;
  targetFrameworks: string[];
  langVersion?: string;
  packageReferences: ReturnType<typeof parsePackageReferences>;
} {
  const parsed = parser.parse(content);
  const root = parsed.Project ?? parsed.project ?? parsed;
  const propertyGroup = root.PropertyGroup;
  const { targetFramework, targetFrameworks, langVersion } =
    parseTargetFrameworks(propertyGroup);
  const packageReferences = parsePackageReferences(root);

  return { targetFramework, targetFrameworks, langVersion, packageReferences };
}

export function parsePackagesConfig(content: string): Array<{ id: string; version: string }> {
  const parsed = parser.parse(content);
  const packages = parsed.packages?.package ?? parsed.Packages?.Package;
  if (!packages) return [];

  const items = Array.isArray(packages) ? packages : [packages];
  return items
    .map((pkg: Record<string, unknown>) => {
      const id = (pkg["@_id"] ?? pkg["@_Id"]) as string | undefined;
      const version = (pkg["@_version"] ?? pkg["@_Version"]) as string | undefined;
      if (!id) return null;
      return { id, version: version ?? "unknown" };
    })
    .filter((p): p is { id: string; version: string } => p !== null);
}

export { getElementText };
