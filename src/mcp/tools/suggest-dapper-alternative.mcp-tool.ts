import { suggestDapperAlternative } from "../../core/dapper/dapper-suggestion.service.js";
import { suggestDapperAlternativeSchema } from "../schemas/suggest-dapper-alternative.schema.js";

export async function suggestDapperAlternativeTool(
  input: ReturnType<typeof parseSuggestDapperAlternativeInput>,
) {
  return suggestDapperAlternative(input);
}

export function parseSuggestDapperAlternativeInput(input: unknown) {
  return suggestDapperAlternativeSchema.parse(input);
}
