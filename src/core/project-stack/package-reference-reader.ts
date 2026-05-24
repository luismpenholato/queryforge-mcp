import type { PackageReference } from "./project-stack.types.js";

export function getElementText(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return getElementText(value[0]);
  if (typeof value === "object" && value !== null && "#text" in value) {
    const text = (value as { "#text"?: unknown })["#text"];
    return typeof text === "string" ? text.trim() : undefined;
  }
  return undefined;
}

export function getAttribute(
  node: unknown,
  attr: string,
): string | undefined {
  if (!node || typeof node !== "object") return undefined;
  const record = node as Record<string, unknown>;

  const direct = record[`@_${attr}`];
  if (typeof direct === "string") return direct;

  const attrs = record["@_"];
  if (!attrs || typeof attrs !== "object") return undefined;
  const value = (attrs as Record<string, unknown>)[attr];
  return typeof value === "string" ? value : undefined;
}

function collectPackageReferencesFromGroup(group: unknown, refs: PackageReference[]): void {
  if (!group || typeof group !== "object") return;

  const pkgRefs = (group as Record<string, unknown>).PackageReference;
  if (!pkgRefs) return;

  const items = Array.isArray(pkgRefs) ? pkgRefs : [pkgRefs];
  for (const item of items) {
    if (typeof item === "string") {
      refs.push({ name: item, version: "unknown" });
      continue;
    }
    if (!item || typeof item !== "object") continue;

    const include = getAttribute(item, "Include") ?? getAttribute(item, "Update");
    if (!include) continue;

    const version =
      getAttribute(item, "Version") ??
      getElementText((item as Record<string, unknown>).Version) ??
      "unknown";

    refs.push({ name: include, version });
  }
}

export function parsePackageReferences(projectRoot: unknown): PackageReference[] {
  const refs: PackageReference[] = [];
  if (!projectRoot || typeof projectRoot !== "object") return refs;

  const root = projectRoot as Record<string, unknown>;
  const groups = [
    ...(normalizeGroups(root.PropertyGroup)),
    ...(normalizeGroups(root.ItemGroup)),
  ];

  for (const group of groups) {
    collectPackageReferencesFromGroup(group, refs);
  }

  return refs;
}

function normalizeGroups(value: unknown): unknown[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export function parseTargetFrameworks(propertyGroup: unknown): {
  targetFramework?: string;
  targetFrameworks: string[];
  langVersion?: string;
} {
  let targetFramework: string | undefined;
  let targetFrameworks: string[] = [];
  let langVersion: string | undefined;

  if (!propertyGroup) {
    return { targetFrameworks };
  }

  const groups = Array.isArray(propertyGroup) ? propertyGroup : [propertyGroup];

  for (const group of groups) {
    if (!group || typeof group !== "object") continue;
    const g = group as Record<string, unknown>;

    targetFramework ??= getElementText(g.TargetFramework);
    langVersion ??= getElementText(g.LangVersion);

    const multi = getElementText(g.TargetFrameworks);
    if (multi) {
      targetFrameworks = multi.split(";").map((f) => f.trim()).filter(Boolean);
    }
  }

  if (targetFrameworks.length === 0 && targetFramework) {
    targetFrameworks = [targetFramework];
  }

  return { targetFramework, targetFrameworks, langVersion };
}
