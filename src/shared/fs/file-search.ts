import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import {
  isIgnoredDirectory,
  MAX_DIRECTORY_DEPTH,
  MAX_FILE_SIZE_BYTES,
  resolveSafePath,
} from "./safe-path.js";

export async function findFiles(
  projectPath: string,
  patterns: string[],
): Promise<string[]> {
  const resolved = resolveSafePath(projectPath);
  const results = await fg(patterns, {
    cwd: resolved,
    absolute: true,
    onlyFiles: true,
    suppressErrors: true,
    deep: MAX_DIRECTORY_DEPTH,
    ignore: ["**/bin/**", "**/obj/**", "**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**"],
  });

  return results.filter((file) => isWithinDepth(resolved, file));
}

function isWithinDepth(root: string, filePath: string): boolean {
  const relative = path.relative(root, filePath);
  const depth = relative.split(path.sep).length;
  return depth <= MAX_DIRECTORY_DEPTH;
}

export async function walkDirectory(
  projectPath: string,
  callback: (filePath: string, content: string) => void | Promise<void>,
  extensions: string[] = [".cs"],
): Promise<void> {
  const root = resolveSafePath(projectPath);
  await walkDirRecursive(root, root, 0, extensions, callback);
}

async function walkDirRecursive(
  projectPath: string,
  currentDir: string,
  depth: number,
  extensions: string[],
  callback: (filePath: string, content: string) => void | Promise<void>,
): Promise<void> {
  if (depth > MAX_DIRECTORY_DEPTH) return;

  let entries;
  try {
    entries = await fs.readdir(currentDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (isIgnoredDirectory(entry.name)) continue;
      await walkDirRecursive(
        projectPath,
        path.join(currentDir, entry.name),
        depth + 1,
        extensions,
        callback,
      );
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (!extensions.includes(ext)) continue;

      const fullPath = path.join(currentDir, entry.name);
      try {
        const stat = await fs.stat(fullPath);
        if (stat.size > MAX_FILE_SIZE_BYTES) continue;
        const content = await fs.readFile(fullPath, "utf-8");
        await callback(fullPath, content);
      } catch {
        // skip unreadable files
      }
    }
  }
}
