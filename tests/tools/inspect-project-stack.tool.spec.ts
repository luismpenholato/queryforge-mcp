import { describe, expect, it } from 'vitest';
import { ProjectStackService } from '../../src/application/project-stack.service.js';

describe('inspect_project_stack tool output', () => {
  it('should return JSON matching the expected inspection contract', () => {
    const service = new ProjectStackService();
    const result = service.inspect({
      projectFileContent: `
        <Project Sdk="Microsoft.NET.Sdk">
          <PropertyGroup>
            <TargetFramework>net8.0</TargetFramework>
          </PropertyGroup>
          <ItemGroup>
            <PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer" Version="8.0.0" />
            <PackageReference Include="Dapper" Version="2.1.35" />
          </ItemGroup>
        </Project>
      `
    });

    const json = JSON.parse(JSON.stringify(result));

    expect(json).toMatchObject({
      targetFrameworks: ['net8.0'],
      runtimeFamily: 'dotnet',
      queryProviders: expect.arrayContaining(['ef-core', 'dapper', 'linq']),
      databaseProviders: ['sql-server'],
      supportsEfRewrite: true,
      supportsDapperSuggestion: true,
      supportsIndexSuggestion: false,
      warnings: expect.any(Array),
      recommendations: expect.any(Array)
    });
  });
});
