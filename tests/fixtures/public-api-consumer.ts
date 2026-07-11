import {
  QueryAnalysisService,
  type QueryAnalysisRequest,
  type QueryAnalysisResult,
  type QuerySmell,
  type QueryFix,
  type SourceRange,
  type AnalysisOptions
} from '@luispenholato/queryforge-mcp';

const request: QueryAnalysisRequest = {
  code: 'var exists = query.Count() > 0;',
  provider: 'ef-core',
  filePath: 'ProductService.cs',
  languageId: 'csharp'
};

const options: AnalysisOptions = {
  maxIssues: 10
};

const service = new QueryAnalysisService();
const result: QueryAnalysisResult = service.analyze(request, options);

const smell: QuerySmell | undefined = result.smells[0];
const range: SourceRange | undefined = smell?.range;
const fix: QueryFix | undefined = smell?.fixes?.[0];

void range;
void fix;
