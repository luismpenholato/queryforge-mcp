import { compareEfVsDapper } from "../../core/dapper/compare-ef-dapper.service.js";
import { compareEfVsDapperSchema } from "../schemas/compare-ef-vs-dapper.schema.js";

export async function compareEfVsDapperTool(
  input: ReturnType<typeof parseCompareEfVsDapperInput>,
) {
  return compareEfVsDapper(input);
}

export function parseCompareEfVsDapperInput(input: unknown) {
  return compareEfVsDapperSchema.parse(input);
}
