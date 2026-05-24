import { z } from "zod";
import { indexProviderSchema } from "./provider.schema.js";

export const suggestIndexesSchema = z.object({
  provider: indexProviderSchema,
  code: z.string().optional(),
  sql: z.string().optional(),
  tableName: z.string().optional(),
});

export type SuggestIndexesInput = z.infer<typeof suggestIndexesSchema>;

export const suggestIndexesToolDefinition = {
  name: "suggest_indexes",
  description:
    "Suggest possible database indexes based on WHERE/JOIN/ORDER BY patterns. Always requires validation.",
  inputSchema: {
    type: "object",
    properties: {
      provider: { type: "string", enum: indexProviderSchema.options },
      code: { type: "string" },
      sql: { type: "string" },
      tableName: { type: "string" },
    },
    required: ["provider"],
  },
} as const;
