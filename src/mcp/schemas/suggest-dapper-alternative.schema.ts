import { z } from "zod";
import { providerSchema } from "./provider.schema.js";

export const suggestDapperAlternativeSchema = z.object({
  projectPath: z
    .string()
    .min(1, { message: "projectPath is required." }),
  code: z
    .string()
    .min(1, { message: "Query code cannot be empty. Provide the C# LINQ/EF snippet to analyze." }),
  dtoName: z.string().optional(),
  provider: providerSchema.optional(),
  onlyIfDapperExists: z.boolean().optional(),
});

export type SuggestDapperAlternativeInput = z.infer<typeof suggestDapperAlternativeSchema>;

export const suggestDapperAlternativeToolDefinition = {
  name: "suggest_dapper_alternative",
  description:
    "Suggest a parameterized Dapper alternative for read-only queries when appropriate.",
  inputSchema: {
    type: "object",
    properties: {
      projectPath: { type: "string" },
      code: { type: "string" },
      dtoName: { type: "string" },
      provider: { type: "string", enum: providerSchema.options },
      onlyIfDapperExists: { type: "boolean", default: true },
    },
    required: ["projectPath", "code"],
  },
} as const;
