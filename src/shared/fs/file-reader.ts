import fs from "node:fs/promises";
import path from "node:path";
import { MAX_FILE_SIZE_BYTES, resolveSafePath } from "./safe-path.js";

export async function readFileSafe(
  projectPath: string,
  filePath: string,
): Promise<string | null> {
  const resolved = resolveSafePath(projectPath, path.relative(projectPath, filePath));
  const stat = await fs.stat(resolved);

  if (!stat.isFile() || stat.size > MAX_FILE_SIZE_BYTES) {
    return null;
  }

  return fs.readFile(resolved, "utf-8");
}
