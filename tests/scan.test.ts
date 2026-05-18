import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
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
    const outParent = await mkdtemp(join(tmpdir(), "forgelens-test-"));
    createdDirs.push(outParent);

    const fixtureRoot = join(process.cwd(), "tests/fixtures/next-app");
    const outDir = join(outParent, ".forgelens");

    const result = await runScan({
      root: fixtureRoot,
      outDir,
      format: "markdown",
      verbose: false
    });

    const filePaths = Object.values(result.files);
    expect(filePaths).toHaveLength(7);

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
  });

  it("adds specific risk warnings when middleware is missing and server actions exist", async () => {
    const outParent = await mkdtemp(join(tmpdir(), "forgelens-risk-test-"));
    createdDirs.push(outParent);

    const fixtureRoot = join(process.cwd(), "tests/fixtures/next-app-no-middleware");
    const outDir = join(outParent, ".forgelens");

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
    const outParent = await mkdtemp(join(tmpdir(), "forgelens-auth-risk-test-"));
    createdDirs.push(outParent);

    const fixtureRoot = join(process.cwd(), "tests/fixtures/stacks/prisma");
    const outDir = join(outParent, ".forgelens");

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
  });
});
