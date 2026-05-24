import { suggestIndexesTool } from "../../core/indexes/index-suggestion.service.js";
import { suggestIndexesSchema } from "../schemas/suggest-indexes.schema.js";

export function suggestIndexesMcpTool(
  input: ReturnType<typeof parseSuggestIndexesInput>,
) {
  return suggestIndexesTool(input);
}

export function parseSuggestIndexesInput(input: unknown) {
  return suggestIndexesSchema.parse(input);
}
