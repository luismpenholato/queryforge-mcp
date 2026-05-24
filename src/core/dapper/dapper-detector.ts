import type { ProjectStack } from "../project-stack/project-stack.types.js";
import { walkDirectory } from "../../shared/fs/file-search.js";
import { resolveSafePath } from "../../shared/fs/safe-path.js";

export interface DapperAvailability {
  hasDapperPackage: boolean;
  dapperVersion: string;
  hasUsingDapper: boolean;
  hasQueryAsyncUsage: boolean;
  requiresNewDependency: boolean;
}

export async function analyzeDapperAvailability(
  projectPath: string,
  stack?: ProjectStack,
): Promise<DapperAvailability> {
  const resolved = resolveSafePath(projectPath);
  let hasUsingDapper = false;
  let hasQueryAsyncUsage = false;

  await walkDirectory(resolved, (_filePath, content) => {
    if (/using\s+Dapper\s*;/.test(content)) {
      hasUsingDapper = true;
    }
    if (/QueryAsync\s*</.test(content) || /\.QueryAsync\s*\(/.test(content)) {
      hasQueryAsyncUsage = true;
    }
  });

  const hasDapperPackage = stack?.hasDapper ?? false;
  const dapperVersion = stack?.dapperVersion ?? "unknown";

  return {
    hasDapperPackage,
    dapperVersion,
    hasUsingDapper,
    hasQueryAsyncUsage,
    requiresNewDependency: !hasDapperPackage,
  };
}

export function isDapperAvailable(availability: DapperAvailability): boolean {
  return availability.hasDapperPackage || availability.hasUsingDapper;
}
