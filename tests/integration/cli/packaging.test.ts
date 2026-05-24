import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, beforeAll } from "vitest";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../../..");
const distIndex = path.join(rootDir, "dist/index.js");
const packageJsonPath = path.join(rootDir, "package.json");

describe("CLI packaging", () => {
  beforeAll(() => {
    execSync("npm run build", { cwd: rootDir, stdio: "pipe" });
  });

  it("should produce dist/index.js after build", () => {
    expect(fs.existsSync(distIndex)).toBe(true);
  });

  it("should include shebang in dist/index.js", () => {
    const content = fs.readFileSync(distIndex, "utf-8");
    expect(content.startsWith("#!/usr/bin/env node")).toBe(true);
  });

  it("should point bin to dist/index.js in package.json", () => {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")) as {
      bin: Record<string, string>;
    };
    expect(pkg.bin["queryforge-mcp"]).toBe("dist/index.js");
  });

  it("should not write bootstrap logs to stdout", async () => {
    const stdout = await collectProcessOutput(
      process.execPath,
      [distIndex],
      1500,
    );
    expect(stdout.trim()).toBe("");
  });
});

function collectProcessOutput(
  command: string,
  args: string[],
  timeoutMs: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    });

    let stdout = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      resolve(stdout);
    }, timeoutMs);

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("exit", () => {
      clearTimeout(timer);
      resolve(stdout);
    });
  });
}
