import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { formatToolError } from "../../../src/mcp/format-tool-error.js";
import { PathTraversalError } from "../../../src/shared/fs/safe-path.js";
import {
  ProjectPathError,
  formatProviderValidationError,
} from "../../../src/shared/fs/project-path-validator.js";
import { optimizeExistingQuerySchema } from "../../../src/mcp/schemas/optimize-existing-query.schema.js";

describe("formatToolError", () => {
  it("should format ProjectPathError without stack trace", () => {
    const message = formatToolError(new ProjectPathError("Project path does not exist: /missing"));
    expect(message).toBe("Project path does not exist: /missing");
    expect(message).not.toContain("at ");
  });

  it("should format PathTraversalError", () => {
    const message = formatToolError(
      new PathTraversalError('Path traversal blocked: "../etc" resolves outside project root.'),
    );
    expect(message).toContain("Project path is not allowed");
  });

  it("should format empty code validation error", () => {
    try {
      optimizeExistingQuerySchema.parse({ projectPath: "/tmp", code: "" });
    } catch (error) {
      expect(formatToolError(error)).toContain("Query code cannot be empty");
    }
  });

  it("should format unknown provider enum error", () => {
    const error = new ZodError([
      {
        code: "invalid_enum_value",
        received: "NotAProvider",
        options: ["Auto", "SqlServer"],
        path: ["provider"],
        message: "Invalid enum value",
      },
    ]);
    expect(formatToolError(error)).toBe(formatProviderValidationError("NotAProvider"));
  });
});
