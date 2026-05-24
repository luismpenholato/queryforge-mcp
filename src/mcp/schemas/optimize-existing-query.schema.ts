import { z } from "zod";
import { providerSchema } from "./provider.schema.js";

export const optimizeExistingQuerySchema = z.object({
  projectPath: z
    .string()
    .min(1, { message: "projectPath is required." }),
  code: z
    .string()
    .min(1, { message: "Query code cannot be empty. Provide the C# LINQ/EF snippet to analyze." }),
  goal: z.string().optional(),
  provider: providerSchema.optional(),
  preserveBehavior: z.boolean().optional(),
  mode: z.enum(["strict", "safe"]).optional(),
  rewriteCode: z.boolean().optional(),
});

export type OptimizeExistingQueryInput = z.infer<typeof optimizeExistingQuerySchema>;

export const optimizeExistingQueryToolDefinition = {
  name: "optimize_existing_query",
  description:
    "Analyze and suggest safer EF/LINQ optimizations for an existing query while preserving behavior.",
  inputSchema: {
    type: "object",
    properties: {
      projectPath: { type: "string" },
      code: { type: "string", description: "C# query code snippet to analyze." },
      goal: { type: "string", description: "Optional optimization goal (e.g. grid/list pagination)." },
      provider: { type: "string", enum: providerSchema.options },
      preserveBehavior: { type: "boolean", default: true },
      mode: {
        type: "string",
        enum: ["strict", "safe"],
        default: "strict",
        description: "strict = analysis and rewritePlan only; safe = may emit high-confidence optimizedEfCode.",
      },
      rewriteCode: {
        type: "boolean",
        description: "In safe mode, allow consolidated optimizedEfCode when all auto-fixes are high confidence.",
      },
    },
    required: ["projectPath", "code"],
  },
} as const;
