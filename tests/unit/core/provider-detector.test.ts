import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analyzeProjectStack } from "../../../src/core/project-stack/project-stack.service.js";
import { detectProvidersFromPackages } from "../../../src/core/providers/provider-registry.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const providersDir = path.join(__dirname, "../../fixtures/dotnet-projects/providers");

describe("provider-detector", () => {
  it("should detect MongoDB.EntityFrameworkCore as MongoDB Document supported", async () => {
    const stack = await analyzeProjectStack(path.join(providersDir, "mongodb"));
    expect(stack.provider).toBe("MongoDB");
    expect(stack.providerFamily).toBe("Document");
    expect(stack.providerSupportLevel).toBe("supported");
  });

  it("should detect Microsoft.EntityFrameworkCore.Cosmos as Cosmos Document supported", async () => {
    const stack = await analyzeProjectStack(path.join(providersDir, "cosmos"));
    expect(stack.provider).toBe("Cosmos");
    expect(stack.providerFamily).toBe("Document");
    expect(stack.providerSupportLevel).toBe("supported");
  });

  it("should detect Microsoft.EntityFrameworkCore.InMemory as InMemory", async () => {
    const stack = await analyzeProjectStack(path.join(providersDir, "inmemory"));
    expect(stack.provider).toBe("InMemory");
    expect(stack.providerFamily).toBe("InMemory");
    expect(stack.providerSupportLevel).toBe("supported");
    expect(stack.providerWarnings.some((w) => w.includes("does not represent real database"))).toBe(
      true,
    );
  });

  it("should detect Npgsql.EntityFrameworkCore.PostgreSQL as PostgreSql", async () => {
    const stack = await analyzeProjectStack(path.join(providersDir, "postgresql"));
    expect(stack.provider).toBe("PostgreSql");
    expect(stack.providerFamily).toBe("Relational");
    expect(stack.providerSupportLevel).toBe("first_class");
  });

  it("should detect Pomelo.EntityFrameworkCore.MySql as MySql", async () => {
    const stack = await analyzeProjectStack(path.join(providersDir, "mysql"));
    expect(stack.provider).toBe("MySql");
    expect(stack.providerFamily).toBe("Relational");
    expect(stack.providerSupportLevel).toBe("first_class");
  });

  it("should detect Oracle.EntityFrameworkCore as Oracle", async () => {
    const stack = await analyzeProjectStack(path.join(providersDir, "oracle"));
    expect(stack.provider).toBe("Oracle");
    expect(stack.providerFamily).toBe("Relational");
    expect(stack.providerSupportLevel).toBe("first_class");
  });

  it("should detect FirebirdSql.EntityFrameworkCore.Firebird as Firebird best_effort", async () => {
    const stack = await analyzeProjectStack(path.join(providersDir, "firebird"));
    expect(stack.provider).toBe("Firebird");
    expect(stack.providerFamily).toBe("Relational");
    expect(stack.providerSupportLevel).toBe("best_effort");
  });

  it("should detect IBM.EntityFrameworkCore as DB2 best_effort", async () => {
    const stack = await analyzeProjectStack(path.join(providersDir, "db2"));
    expect(stack.provider).toBe("DB2");
    expect(stack.providerFamily).toBe("Relational");
    expect(stack.providerSupportLevel).toBe("best_effort");
  });

  it("should detect EntityFrameworkCore.Jet as Jet best_effort", async () => {
    const stack = await analyzeProjectStack(path.join(providersDir, "jet"));
    expect(stack.provider).toBe("Jet");
    expect(stack.providerFamily).toBe("Relational");
    expect(stack.providerSupportLevel).toBe("best_effort");
  });

  it("should detect unknown EF provider package as Custom", async () => {
    const stack = await analyzeProjectStack(path.join(providersDir, "custom"));
    expect(stack.provider).toBe("Custom");
    expect(stack.providerFamily).toBe("Custom");
    expect(stack.providerSupportLevel).toBe("custom");
    expect(stack.providerPackageName).toBe("Contoso.EntityFrameworkCore.WidgetStore");
    expect(
      stack.providerWarnings.some((w) => w.includes("Custom or unknown EF provider detected")),
    ).toBe(true);
  });

  it("should classify package map entries without closed-world assumption", () => {
    const detected = detectProvidersFromPackages([
      { name: "Snowflake.EntityFrameworkCore", version: "1.0.0" },
    ]);
    expect(detected[0]?.provider).toBe("Snowflake");
    expect(detected[0]?.confidence).toBe("high");
  });

  it("should return Unknown when no provider package is found", async () => {
    const stack = await analyzeProjectStack(path.join(providersDir, "unknown"));
    expect(stack.provider).toBe("Unknown");
    expect(stack.providerFamily).toBe("Unknown");
    expect(stack.providerSupportLevel).toBe("unknown");
    expect(
      stack.providerWarnings.some((w) => w.includes("No EF database provider was detected")),
    ).toBe(true);
  });
});
