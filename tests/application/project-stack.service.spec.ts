import { describe, expect, it } from 'vitest';
import { ProjectStackService } from '../../src/application/project-stack.service.js';

describe('ProjectStackService', () => {
  const service = new ProjectStackService();

  it('should detect .NET Framework 4.6.1 with EF6 and SQL Server', () => {
    const result = service.inspect({
      projectFileContent: `
        <Project>
          <PropertyGroup>
            <TargetFramework>net461</TargetFramework>
          </PropertyGroup>
          <ItemGroup>
            <Reference Include="EntityFramework" />
            <Reference Include="System.Data.SqlClient" />
          </ItemGroup>
        </Project>
      `
    });

    expect(result.targetFrameworks).toEqual(['net461']);
    expect(result.runtimeFamily).toBe('net-framework');
    expect(result.queryProviders).toContain('ef6');
    expect(result.queryProviders).toContain('linq');
    expect(result.databaseProviders).toContain('sql-server');
    expect(result.supportsEfRewrite).toBe(true);
    expect(result.supportsDapperSuggestion).toBe(true);
  });

  it('should detect .NET Core 2.1 with EF Core SQL Server', () => {
    const result = service.inspect({
      projectFileContent: `
        <Project Sdk="Microsoft.NET.Sdk">
          <PropertyGroup>
            <TargetFramework>netcoreapp2.1</TargetFramework>
          </PropertyGroup>
          <ItemGroup>
            <PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer" Version="2.1.14" />
          </ItemGroup>
        </Project>
      `
    });

    expect(result.targetFrameworks).toEqual(['netcoreapp2.1']);
    expect(result.runtimeFamily).toBe('net-core');
    expect(result.queryProviders).toContain('ef-core');
    expect(result.databaseProviders).toContain('sql-server');
    expect(result.supportsEfRewrite).toBe(true);
  });

  it('should detect .NET 6 with Dapper and PostgreSQL', () => {
    const result = service.inspect({
      projectFileContent: `
        <Project Sdk="Microsoft.NET.Sdk">
          <PropertyGroup>
            <TargetFramework>net6.0</TargetFramework>
          </PropertyGroup>
          <ItemGroup>
            <PackageReference Include="Dapper" Version="2.1.35" />
            <PackageReference Include="Npgsql" Version="8.0.0" />
          </ItemGroup>
        </Project>
      `
    });

    expect(result.targetFrameworks).toEqual(['net6.0']);
    expect(result.runtimeFamily).toBe('dotnet');
    expect(result.queryProviders).toContain('dapper');
    expect(result.databaseProviders).toContain('postgresql');
    expect(result.supportsDapperSuggestion).toBe(true);
    expect(result.recommendations).not.toContain(
      'Project uses EF Core and Dapper. QueryForge can suggest Dapper alternatives for read-only queries.'
    );
  });

  it('should detect .NET 10 with Pomelo MySQL provider', () => {
    const result = service.inspect({
      projectFileContent: `
        <Project Sdk="Microsoft.NET.Sdk">
          <PropertyGroup>
            <TargetFramework>net10.0</TargetFramework>
          </PropertyGroup>
          <ItemGroup>
            <PackageReference Include="Microsoft.EntityFrameworkCore" Version="10.0.0" />
            <PackageReference Include="Pomelo.EntityFrameworkCore.MySql" Version="10.0.0" />
          </ItemGroup>
        </Project>
      `
    });

    expect(result.targetFrameworks).toEqual(['net10.0']);
    expect(result.runtimeFamily).toBe('dotnet');
    expect(result.queryProviders).toContain('ef-core');
    expect(result.databaseProviders).toContain('mysql');
    expect(result.supportsEfRewrite).toBe(true);
  });

  it('should warn for InMemory provider', () => {
    const result = service.inspect({
      projectFileContent: `
        <Project Sdk="Microsoft.NET.Sdk">
          <PropertyGroup>
            <TargetFramework>net8.0</TargetFramework>
          </PropertyGroup>
          <ItemGroup>
            <PackageReference Include="Microsoft.EntityFrameworkCore.InMemory" Version="8.0.0" />
          </ItemGroup>
        </Project>
      `
    });

    expect(result.targetFrameworks).toEqual(['net8.0']);
    expect(result.databaseProviders).toContain('in-memory');
    expect(result.warnings.some((warning) => warning.includes('Non-relational provider'))).toBe(true);
    expect(result.supportsIndexSuggestion).toBe(false);
  });

  it('should detect multiple target frameworks', () => {
    const result = service.inspect({
      projectFileContent: `
        <Project Sdk="Microsoft.NET.Sdk">
          <PropertyGroup>
            <TargetFrameworks>net472;net8.0</TargetFrameworks>
          </PropertyGroup>
          <ItemGroup>
            <PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer" Version="8.0.0" />
          </ItemGroup>
        </Project>
      `
    });

    expect(result.targetFrameworks).toEqual(['net472', 'net8.0']);
    expect(result.recommendations.some((item) => item.includes('Multiple target frameworks'))).toBe(true);
    expect(result.warnings.some((warning) => warning.includes('.NET Framework with EF Core'))).toBe(true);
  });

  it('should return unknown with warnings for empty csproj content', () => {
    const result = service.inspect({
      projectFileContent: ''
    });

    expect(result.targetFrameworks).toEqual([]);
    expect(result.runtimeFamily).toBe('unknown');
    expect(result.queryProviders).toEqual(['unknown']);
    expect(result.databaseProviders).toEqual(['unknown']);
    expect(result.supportsEfRewrite).toBe(false);
    expect(result.supportsDapperSuggestion).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('should recommend EF Core and Dapper when both are present', () => {
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

    expect(result.queryProviders).toContain('ef-core');
    expect(result.queryProviders).toContain('dapper');
    expect(result.recommendations).toContain(
      'Project uses EF Core and Dapper. QueryForge can suggest Dapper alternatives for read-only queries.'
    );
  });
});
