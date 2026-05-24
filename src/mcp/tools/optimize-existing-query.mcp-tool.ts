import { optimizeExistingQuery } from "../../core/query-optimization/query-optimization.service.js";
import { optimizeExistingQuerySchema } from "../schemas/optimize-existing-query.schema.js";

export async function optimizeExistingQueryTool(
  input: ReturnType<typeof parseOptimizeExistingQueryInput>,
) {
  return optimizeExistingQuery(input);
}

export function parseOptimizeExistingQueryInput(input: unknown) {
  return optimizeExistingQuerySchema.parse(input);
}
