import {
  analyzeProjectStack,
  toInspectOutput,
} from "../../core/project-stack/project-stack.service.js";
import { PathTraversalError } from "../../shared/fs/safe-path.js";
import { ProjectPathError } from "../../shared/fs/project-path-validator.js";
import { inspectProjectStackSchema } from "../schemas/inspect-project-stack.schema.js";

export async function inspectProjectStackTool(projectPath: string) {
  try {
    const stack = await analyzeProjectStack(projectPath);
    return toInspectOutput(stack);
  } catch (error) {
    if (error instanceof PathTraversalError || error instanceof ProjectPathError) {
      throw error;
    }
    throw new Error(
      `Failed to inspect project stack: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function parseInspectProjectStackInput(input: unknown) {
  return inspectProjectStackSchema.parse(input);
}
