import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runScan } from "../src/scan.js";

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    createdDirs.splice(0).map(async (dir) => {
      await rm(dir, { recursive: true, force: true });
    })
  );
});

describe("runScan", () => {
  it("generates all markdown context files for a Next.js fixture", async () => {
    const fixtureRoot = join(process.cwd(), "tests/fixtures/next-app");
    const { outDir } = createFixtureOutDir(fixtureRoot, "forgelens-test");

    const result = await runScan({
      root: fixtureRoot,
      outDir,
      format: "markdown",
      verbose: false
    });

    const filePaths = Object.values(result.files);
    expect(filePaths).toHaveLength(12);

    for (const filePath of filePaths) {
      const text = await readFile(filePath, "utf8");
      expect(text.length).toBeGreaterThan(20);
    }

    const routesMap = await readFile(result.files.ROUTES_MAP, "utf8");
    expect(routesMap).toContain("`/dashboard`");
    expect(routesMap).toContain("`/admin`");
    expect(routesMap).toContain("`/api/health`");

    const databaseMap = await readFile(result.files.DATABASE_MAP, "utf8");
    expect(databaseMap).toContain("## Detected Providers");
    expect(databaseMap).toContain("prisma");
    expect(databaseMap).toContain("confidence");
    expect(databaseMap).toContain("supabase/setup.sql");
    expect(databaseMap).toContain("## Database Clients");

    const actionsMap = await readFile(result.files.SERVER_ACTIONS_MAP, "utf8");
    expect(actionsMap).toContain("src/actions/user.ts");

    const forgeContext = await readFile(result.files.FORGE_CONTEXT, "utf8");
    expect(forgeContext).toContain("Auth providers");
    expect(forgeContext).toContain("Database providers");

    const securityRules = await readFile(result.files.SECURITY_RULES, "utf8");
    expect(securityRules).toContain("## Auth providers/signals detected");
    expect(securityRules).toContain("## Auth evidence files");
    expect(securityRules).toContain("## Middleware status");
    expect(securityRules).toContain("## Server actions requiring review");
    expect(securityRules).toContain("## API routes requiring review");
    expect(securityRules).toContain("## Environment files (names only)");
    expect(securityRules).toContain("## Admin/security-sensitive areas");
    expect(securityRules).toContain("## Manual verification checklist");
    expect(securityRules).not.toContain("FORGELENS_TEST_PLACEHOLDER");

    const focusMap = await readFile(result.files.AI_FOCUS_MAP, "utf8");
    expect(focusMap).toContain("# AI_FOCUS_MAP");
    expect(focusMap).toContain("Auth and sessions");
    expect(focusMap).toContain("## Top Files");
    expect(focusMap).toContain("Suggested Read Order");

    const compactContext = await readFile(result.files.AI_COMPACT_CONTEXT, "utf8");
    expect(compactContext).toContain("# AI_COMPACT_CONTEXT");
    expect(compactContext).toContain("## Top Files");

    const envReport = await readFile(result.files.ENV_REPORT, "utf8");
    expect(envReport).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(envReport).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(envReport).toContain("## Env Key Groups");
    expect(envReport).toContain("### Public client");
    expect(envReport).not.toContain("FORGELENS_TEST_PLACEHOLDER");

    const uiUxReport = await readFile(result.files.UI_UX_REPORT, "utf8");
    expect(uiUxReport).toContain("# UI_UX_REPORT");
    expect(uiUxReport).toContain("app/dashboard/page.tsx");

    const performanceReport = await readFile(result.files.PERFORMANCE_RISK_REPORT, "utf8");
    expect(performanceReport).toContain("# PERFORMANCE_RISK_REPORT");
    expect(performanceReport).toContain("## Client Components");
  });

  it("adds specific risk warnings when middleware is missing and server actions exist", async () => {
    const fixtureRoot = join(process.cwd(), "tests/fixtures/next-app-no-middleware");
    const { outDir } = createFixtureOutDir(fixtureRoot, "forgelens-risk-test");

    const result = await runScan({
      root: fixtureRoot,
      outDir,
      format: "markdown",
      verbose: false
    });

    const riskReport = await readFile(result.files.RISK_REPORT, "utf8");
    expect(riskReport).toContain("Admin routes detected but no middleware");
    expect(riskReport).toContain("Server actions detected");
    expect(riskReport).toContain("Database providers detected");
    expect(riskReport).toContain("No API routes detected");

    const securityRules = await readFile(result.files.SECURITY_RULES, "utf8");
    expect(securityRules).toContain(".env.local");
    expect(securityRules).not.toContain("TEST_ONLY_NOT_A_SECRET");
  });

  it("warns when auth is unknown/custom and never leaks env secret values", async () => {
    const fixtureRoot = join(process.cwd(), "tests/fixtures/stacks/prisma");
    const { outDir } = createFixtureOutDir(fixtureRoot, "forgelens-auth-risk-test");

    const result = await runScan({
      root: fixtureRoot,
      outDir,
      format: "markdown",
      verbose: false
    });

    const riskReport = await readFile(result.files.RISK_REPORT, "utf8");
    expect(riskReport).toContain("Auth provider is custom/unknown");

    const securityRules = await readFile(result.files.SECURITY_RULES, "utf8");
    expect(securityRules).not.toContain("SUPER_SECRET");

    const envReport = await readFile(result.files.ENV_REPORT, "utf8");
    expect(envReport).not.toContain("SUPER_SECRET");
  });

  it("rejects output folders outside the selected root", async () => {
    const fixtureRoot = join(process.cwd(), "tests/fixtures/next-app");

    await expect(
      runScan({
        root: fixtureRoot,
        outDir: join(process.cwd(), ".tmp/outside-root"),
        format: "markdown",
        verbose: false
      })
    ).rejects.toThrow("Output folder must be inside the selected root folder.");
  });

  it("writes tool-readable JSON output when requested", async () => {
    const fixtureRoot = join(process.cwd(), "tests/fixtures/next-app");
    const { outDir } = createFixtureOutDir(fixtureRoot, "forgelens-json-test");

    const result = await runScan({
      root: fixtureRoot,
      outDir,
      format: "json",
      verbose: false
    });

    expect(Object.keys(result.files)).toEqual(["REPO_REPORT_JSON"]);

    const jsonText = await readFile(result.files.REPO_REPORT_JSON, "utf8");
    const parsed = JSON.parse(jsonText) as { focusFiles?: Array<{ file: string; score: number }> };

    expect(parsed.focusFiles?.length).toBeGreaterThan(0);
    expect(parsed.focusFiles?.[0]?.score).toBeGreaterThan(0);
    expect(jsonText).not.toContain("FORGELENS_TEST_PLACEHOLDER");
  });

  it("writes markdown and JSON output together with all format", async () => {
    const fixtureRoot = join(process.cwd(), "tests/fixtures/next-app");
    const { outDir } = createFixtureOutDir(fixtureRoot, "forgelens-all-test");

    const result = await runScan({
      root: fixtureRoot,
      outDir,
      format: "all",
      verbose: false
    });

    expect(result.files.AI_FOCUS_MAP).toBeDefined();
    expect(result.files.REPO_REPORT_JSON).toBeDefined();
  });

  it("extracts Vite import.meta.env keys in env report", async () => {
    const fixtureRoot = join(process.cwd(), "tests/fixtures/stacks/vite");
    const { outDir } = createFixtureOutDir(fixtureRoot, "forgelens-vite-env-test");

    const result = await runScan({
      root: fixtureRoot,
      outDir,
      format: "markdown",
      verbose: false
    });

    const envReport = await readFile(result.files.ENV_REPORT, "utf8");
    expect(envReport).toContain("VITE_API_URL");
    expect(envReport).toContain("VITE_FEATURE_FLAG");
  });
});

function createFixtureOutDir(fixtureRoot: string, prefix: string): { outDir: string } {
  const outDir = `.tmp/${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  createdDirs.push(join(fixtureRoot, outDir));
  return { outDir };
}
