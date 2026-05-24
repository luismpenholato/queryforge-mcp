import path from "node:path";

const IGNORED_DIRS = new Set([
  "bin",
  "obj",
  "node_modules",
  ".git",
  "dist",
  "build",
]);

export const MAX_FILE_SIZE_BYTES = 512 * 1024; // 512 KB
export const MAX_DIRECTORY_DEPTH = 12;

export class PathTraversalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathTraversalError";
  }
}

export function resolveSafePath(projectPath: string, relativePath?: string): string {
  const resolvedProject = path.resolve(projectPath);

  if (!relativePath) {
    return resolvedProject;
  }

  const resolved = path.resolve(resolvedProject, relativePath);
  const normalizedProject = resolvedProject.endsWith(path.sep)
    ? resolvedProject
    : resolvedProject + path.sep;

  if (resolved !== resolvedProject && !resolved.startsWith(normalizedProject)) {
    throw new PathTraversalError(
      `Path traversal blocked: "${relativePath}" resolves outside project root.`,
    );
  }

  return resolved;
}

export function isIgnoredDirectory(dirName: string): boolean {
  return IGNORED_DIRS.has(dirName);
}

export function isWithinProject(projectPath: string, targetPath: string): boolean {
  try {
    resolveSafePath(projectPath, path.relative(path.resolve(projectPath), path.resolve(targetPath)));
    return true;
  } catch {
    return false;
  }
}
