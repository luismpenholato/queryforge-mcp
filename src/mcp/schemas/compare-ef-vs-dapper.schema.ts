import { z } from "zod";

export const compareEfVsDapperSchema = z.object({
  projectPath: z
    .string()
    .min(1, { message: "projectPath is required." }),
  code: z
    .string()
    .min(1, { message: "Query code cannot be empty. Provide the C# LINQ/EF snippet to analyze." }),
  queryCriticality: z.enum(["low", "medium", "high"]).optional(),
  estimatedRows: z.number().optional(),
});

export type CompareEfVsDapperInput = z.infer<typeof compareEfVsDapperSchema>;

export const compareEfVsDapperToolDefinition = {
  name: "compare_ef_vs_dapper",
  description:
    "Compare EF optimized approach versus Dapper for a query and return an objective recommendation.",
  inputSchema: {
    type: "object",
    properties: {
      projectPath: { type: "string" },
      code: { type: "string" },
      queryCriticality: { type: "string", enum: ["low", "medium", "high"] },
      estimatedRows: { type: "number" },
    },
    required: ["projectPath", "code"],
  },
} as const;
