import { ZodError } from "zod";
import { PathTraversalError } from "../shared/fs/safe-path.js";
import {
  ProjectPathError,
  formatProviderValidationError,
} from "../shared/fs/project-path-validator.js";

export function formatToolError(error: unknown): string {
  if (error instanceof ProjectPathError) {
    return error.message;
  }

  if (error instanceof PathTraversalError) {
    return `Project path is not allowed: ${error.message}`;
  }

  if (error instanceof ZodError) {
    return formatZodError(error);
  }

  if (error instanceof Error) {
    return sanitizeErrorMessage(error.message);
  }

  return sanitizeErrorMessage(String(error));
}

function formatZodError(error: ZodError): string {
  const messages = error.errors.map((issue) => {
    const field = issue.path.length > 0 ? issue.path.join(".") : "input";
    if (issue.code === "invalid_enum_value") {
      const received = issue.received;
      if (field === "provider" && typeof received === "string") {
        return formatProviderValidationError(received);
      }
      return `${field}: invalid value "${String(received)}".`;
    }
    return `${field}: ${issue.message}`;
  });

  return messages.join(" ");
}

function sanitizeErrorMessage(message: string): string {
  const firstLine = message.split("\n")[0]?.trim() ?? message;
  if (firstLine.includes("ENOENT")) {
    return "Project path does not exist or cannot be accessed.";
  }
  if (firstLine.includes("EACCES")) {
    return "Permission denied while accessing the project path.";
  }
  return firstLine.replace(/\s+at\s+.+/g, "").trim();
}
