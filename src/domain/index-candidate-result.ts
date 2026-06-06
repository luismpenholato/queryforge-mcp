import { DatabaseProvider } from './database-provider.js';
import { IndexCandidate } from './index-candidate.js';

export interface IndexCandidateResult {
  summary: string;
  databaseProvider: DatabaseProvider;
  tableName: string;
  candidates: IndexCandidate[];
  warnings: string[];
  analysisSmells: string[];
  manualReviewRequired: boolean;
}
