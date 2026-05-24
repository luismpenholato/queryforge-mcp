import fs from "node:fs/promises";
import { findFiles } from "./file-search.js";
import { PathTraversalError, resolveSafePath } from "./safe-path.js";

export class ProjectPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectPathError";
  }
}

export async function assertProjectPathAccessible(projectPath: string): Promise<string> {
  if (!projectPath?.trim()) {
    throw new ProjectPathError("projectPath is required.");
  }

  let resolved: string;
  try {
    resolved = resolveSafePath(projectPath.trim());
  } catch (error) {
    if (error instanceof PathTraversalError) {
      throw new ProjectPathError(
        `Project path is not allowed: ${error.message}`,
      );
    }
    throw error;
  }

  try {
    const stat = await fs.stat(resolved);
    if (!stat.isDirectory()) {
      throw new ProjectPathError(
        `Project path must be a directory: ${projectPath}`,
      );
    }
  } catch (error) {
    if (error instanceof ProjectPathError) {
      throw error;
    }
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new ProjectPathError(`Project path does not exist: ${projectPath}`);
    }
    throw new ProjectPathError(`Cannot access project path: ${projectPath}`);
  }

  return resolved;
}

export async function assertProjectHasCsproj(projectPath: string): Promise<void> {
  const resolved = await assertProjectPathAccessible(projectPath);
  const csprojPaths = await findFiles(resolved, ["**/*.csproj"]);
  if (csprojPaths.length === 0) {
    throw new ProjectPathError(
      `No .csproj files found under project path: ${projectPath}`,
    );
  }
}

export function formatProviderValidationError(provider: string): string {
  return `Unknown provider "${provider}". Use "Auto" or a supported provider value from the tool schema.`;
}
