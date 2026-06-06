import { DatabaseProvider } from '../domain/database-provider.js';
import { DotNetRuntime } from '../domain/dotnet-runtime.js';
import { ProjectStackInspectionRequest } from '../domain/project-stack-inspection-request.js';
import { ProjectStackInspectionResult } from '../domain/project-stack-inspection-result.js';
import { QueryProvider } from '../domain/query-provider.js';

const EF_CORE_PACKAGES = new Set([
  'Microsoft.EntityFrameworkCore',
  'Microsoft.EntityFrameworkCore.SqlServer',
  'Pomelo.EntityFrameworkCore.MySql',
  'Npgsql.EntityFrameworkCore.PostgreSQL',
  'Microsoft.EntityFrameworkCore.Sqlite',
  'Oracle.EntityFrameworkCore',
  'Microsoft.EntityFrameworkCore.Cosmos',
  'Microsoft.EntityFrameworkCore.InMemory'
]);

const EF6_PACKAGES = new Set(['EntityFramework']);

const DAPPER_PACKAGES = new Set(['Dapper']);

const PACKAGE_TO_DATABASE_PROVIDER: Record<string, DatabaseProvider> = {
  'Microsoft.EntityFrameworkCore.SqlServer': 'sql-server',
  'System.Data.SqlClient': 'sql-server',
  'Microsoft.Data.SqlClient': 'sql-server',
  'Pomelo.EntityFrameworkCore.MySql': 'mysql',
  'MySql.Data': 'mysql',
  'MySqlConnector': 'mysql',
  'MariaDB.EntityFrameworkCore': 'mariadb',
  'Npgsql.EntityFrameworkCore.PostgreSQL': 'postgresql',
  'Npgsql': 'postgresql',
  'Microsoft.EntityFrameworkCore.Sqlite': 'sqlite',
  'Oracle.EntityFrameworkCore': 'oracle',
  'Oracle.ManagedDataAccess': 'oracle',
  'Microsoft.EntityFrameworkCore.Cosmos': 'cosmos',
  'MongoDB.Driver': 'mongodb',
  'Microsoft.EntityFrameworkCore.InMemory': 'in-memory'
};

const RELATIONAL_DATABASE_PROVIDERS = new Set<DatabaseProvider>([
  'sql-server',
  'mysql',
  'mariadb',
  'postgresql',
  'sqlite',
  'oracle'
]);

const NON_RELATIONAL_DATABASE_PROVIDERS = new Set<DatabaseProvider>([
  'cosmos',
  'mongodb',
  'in-memory'
]);

export class ProjectStackService {
  inspect(request: ProjectStackInspectionRequest): ProjectStackInspectionResult {
    const content = request.projectFileContent ?? '';
    const targetFrameworks = this.extractTargetFrameworks(content);
    const packages = this.extractPackages(content);
    const runtimeFamily = this.resolveRuntimeFamily(targetFrameworks);
    const queryProviders = this.detectQueryProviders(packages, targetFrameworks);
    const databaseProviders = this.detectDatabaseProviders(packages);

    const warnings: string[] = [];
    const recommendations: string[] = [];

    if (!content.trim()) {
      warnings.push('Project file content is empty. Paste a .csproj to detect runtime and packages.');
    } else if (targetFrameworks.length === 0 && packages.length === 0) {
      warnings.push('Could not detect target frameworks or package references. Validate the pasted .csproj content.');
    }

    if (databaseProviders.some((provider) => NON_RELATIONAL_DATABASE_PROVIDERS.has(provider))) {
      warnings.push(
        'Non-relational provider detected (Cosmos DB, MongoDB, or InMemory). SQL/Dapper suggestions may not apply.'
      );
    }

    const hasNetFrameworkTarget = targetFrameworks.some(
      (framework) => this.classifyFramework(framework) === 'net-framework'
    );

    if (hasNetFrameworkTarget && queryProviders.includes('ef-core')) {
      warnings.push(
        '.NET Framework with EF Core detected. Validate EF Core version and compatibility with your target framework.'
      );
    }

    const supportsEfRewrite = queryProviders.includes('ef-core') || queryProviders.includes('ef6');
    const supportsDapperSuggestion =
      queryProviders.includes('dapper') ||
      databaseProviders.some((provider) => RELATIONAL_DATABASE_PROVIDERS.has(provider));

    if (queryProviders.includes('ef-core') && queryProviders.includes('dapper')) {
      recommendations.push(
        'Project uses EF Core and Dapper. QueryForge can suggest Dapper alternatives for read-only queries.'
      );
    }

    if (queryProviders.includes('ef6')) {
      recommendations.push(
        'Entity Framework 6 detected. EF rewrite suggestions are partial; validate generated SQL and behavior manually.'
      );
    }

    if (supportsEfRewrite && !supportsDapperSuggestion) {
      recommendations.push(
        'EF detected without a relational Dapper provider. Use analyze_query and suggest_ef_rewrite for LINQ/EF review.'
      );
    }

    if (targetFrameworks.length > 1) {
      recommendations.push(
        `Multiple target frameworks detected (${targetFrameworks.join(', ')}). Validate suggestions per target framework.`
      );
    }

    return {
      targetFrameworks,
      runtimeFamily,
      queryProviders: queryProviders.length > 0 ? queryProviders : ['unknown'],
      databaseProviders: databaseProviders.length > 0 ? databaseProviders : ['unknown'],
      supportsEfRewrite,
      supportsDapperSuggestion,
      supportsIndexSuggestion: false,
      warnings,
      recommendations
    };
  }

  private extractTargetFrameworks(content: string): string[] {
    const frameworks: string[] = [];

    const singleMatches = content.matchAll(/<TargetFramework>([^<]+)<\/TargetFramework>/gi);
    for (const match of singleMatches) {
      const value = match[1]?.trim();
      if (value) frameworks.push(value);
    }

    const multiMatch = content.match(/<TargetFrameworks>([^<]+)<\/TargetFrameworks>/i);
    if (multiMatch?.[1]) {
      frameworks.push(
        ...multiMatch[1]
          .split(';')
          .map((item) => item.trim())
          .filter(Boolean)
      );
    }

    return [...new Set(frameworks)];
  }

  private extractPackages(content: string): string[] {
    const packages: string[] = [];

    const packageReferences = content.matchAll(/PackageReference\s+Include="([^"]+)"/gi);
    for (const match of packageReferences) {
      const value = match[1]?.trim();
      if (value) packages.push(value);
    }

    const references = content.matchAll(/<Reference\s+Include="([^",]+)/gi);
    for (const match of references) {
      const value = match[1]?.trim();
      if (value) packages.push(value);
    }

    return [...new Set(packages)];
  }

  private resolveRuntimeFamily(targetFrameworks: string[]): DotNetRuntime {
    if (targetFrameworks.length === 0) {
      return 'unknown';
    }

    const families = targetFrameworks.map((framework) => this.classifyFramework(framework));
    const uniqueFamilies = [...new Set(families.filter((family) => family !== 'unknown'))];

    if (uniqueFamilies.length === 1) {
      return uniqueFamilies[0];
    }

    if (uniqueFamilies.includes('dotnet')) {
      return 'dotnet';
    }

    if (uniqueFamilies.includes('net-core')) {
      return 'net-core';
    }

    if (uniqueFamilies.includes('net-framework')) {
      return 'net-framework';
    }

    return 'unknown';
  }

  private classifyFramework(framework: string): DotNetRuntime {
    const normalized = framework.trim().toLowerCase();

    if (/^net(4\d{2}|4[0-9](\.\d+)?)$/.test(normalized) || /^net4\d{2}$/.test(normalized)) {
      return 'net-framework';
    }

    if (/^netcoreapp[23]\.\d+$/.test(normalized)) {
      return 'net-core';
    }

    if (/^net(5|6|7|8|9|10)\.\d+$/.test(normalized)) {
      return 'dotnet';
    }

    return 'unknown';
  }

  private detectQueryProviders(packages: string[], targetFrameworks: string[]): QueryProvider[] {
    const providers: QueryProvider[] = [];

    if (packages.some((pkg) => EF_CORE_PACKAGES.has(pkg) || pkg.startsWith('Microsoft.EntityFrameworkCore'))) {
      providers.push('ef-core');
    }

    if (packages.some((pkg) => EF6_PACKAGES.has(pkg))) {
      providers.push('ef6');
    }

    if (packages.some((pkg) => DAPPER_PACKAGES.has(pkg))) {
      providers.push('dapper');
    }

    if (targetFrameworks.length > 0 || providers.length > 0) {
      providers.push('linq');
    }

    return [...new Set(providers)];
  }

  private detectDatabaseProviders(packages: string[]): DatabaseProvider[] {
    const providers: DatabaseProvider[] = [];

    for (const pkg of packages) {
      const mapped = PACKAGE_TO_DATABASE_PROVIDER[pkg];
      if (mapped) {
        providers.push(mapped);
      }
    }

    return [...new Set(providers)];
  }
}
