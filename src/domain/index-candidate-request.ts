import { DatabaseProvider } from './database-provider.js';

export interface IndexCandidateRequest {
  code: string;
  databaseProvider?: DatabaseProvider;
  tableName?: string;
  context?: string;
}
