import type { DatabaseProvider } from './database-provider.js';
import type { DotNetRuntime } from './dotnet-runtime.js';

export interface ProjectAnalysisContext {
  targetFramework?: string;
  entityFrameworkVersion?: string;
  databaseProvider?: DatabaseProvider | string;
  usesEntityFramework?: boolean;
  usesDapper?: boolean;
  dotnetRuntime?: DotNetRuntime;
}
