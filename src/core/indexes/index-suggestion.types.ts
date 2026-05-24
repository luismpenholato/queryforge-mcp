import type { DatabaseProvider } from "../providers/provider.types.js";

export type { DatabaseProvider };

export interface IndexSuggestion {
  provider: DatabaseProvider;
  table: string;
  name: string;
  columns: string[];
  includeColumns?: string[];
  sql: string;
  reason: string;
  warnings: string[];
  confidence?: "low" | "medium" | "high";
  conceptual?: boolean;
}
