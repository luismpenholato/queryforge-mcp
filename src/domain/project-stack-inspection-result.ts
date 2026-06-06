import { DatabaseProvider } from './database-provider.js';
import { DotNetRuntime } from './dotnet-runtime.js';
import { QueryProvider } from './query-provider.js';

export interface ProjectStackInspectionResult {
  targetFrameworks: string[];
  runtimeFamily: DotNetRuntime;
  queryProviders: QueryProvider[];
  databaseProviders: DatabaseProvider[];
  supportsEfRewrite: boolean;
  supportsDapperSuggestion: boolean;
  supportsIndexSuggestion: boolean;
  warnings: string[];
  recommendations: string[];
}
