import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { runBaselineSave } from "../src/baseline.js";
import { renderDriftReport, runDrift, runGitDrift } from "../src/drift.js";
import { scanRepo } from "../src/scan.js";
import type { RepoReport } from "../src/types.js";

function normalizePathForAssert(value: string): string {
  return value.replaceAll("\\", "/");
}

const createdDirs: string[] = [];
const execFileAsync = promisify(execFile);

afterEach(async () => {
  await Promise.all(
    createdDirs.splice(0).map(async (dir) => {
      await rm(dir, { recursive: true, force: true });
    })
  );
});

describe("drift", () => {
  it("detects risky drift between baseline and current reports", async () => {
    const fixtureRoot = join(process.cwd(), "tests/fixtures/next-app");
    const current = await scanRepo(fixtureRoot, ".forgelens");
    const baseline = removeRiskSignals(current);
    const paths = await writeReports(baseline, current);

    const result = await runDrift({
      baseline: paths.baselinePath,
      current: paths.currentPath,
      outDir: paths.outDir
    });

    expect(result.report.summary.high).toBeGreaterThan(0);
    expect(result.report.changes.some((change) => change.title === "API route drift")).toBe(true);
    expect(result.report.changes.some((change) => change.title === "Server action drift")).toBe(true);
    expect(result.report.changes.some((change) => change.title === "Schema drift")).toBe(true);
    expect(result.files.DRIFT_REPORT).toBeDefined();
    expect(result.files.DRIFT_REPORT_JSON).toBeDefined();

    const markdown = renderDriftReport(result.report);
    expect(markdown).toContain("# DRIFT_REPORT");
    expect(markdown).toContain("## Executive Summary");
    expect(markdown).toContain("Review data writes");
    expect(markdown).toContain("DRIFT_REPORT.json");
    expect(markdown).not.toContain("FORGELENS_TEST_PLACEHOLDER");
  });

  it("reports no drift for identical reports", async () => {
    const fixtureRoot = join(process.cwd(), "tests/fixtures/next-app");
    const current = await scanRepo(fixtureRoot, ".forgelens");
    const paths = await writeReports(current, current);

    const result = await runDrift({
      baseline: paths.baselinePath,
      current: paths.currentPath
    });

    expect(result.report.summary.total).toBe(0);
    expect(renderDriftReport(result.report)).toContain("No drift detected");
  });

  it("saves a named baseline report", async () => {
    const fixtureRoot = join(process.cwd(), "tests/fixtures/next-app");
    const outDir = `.tmp/forgelens-baseline-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    createdDirs.push(join(fixtureRoot, outDir));

    const result = await runBaselineSave({
      root: fixtureRoot,
      outDir,
      name: "main"
    });

    expect(normalizePathForAssert(result.baselinePath)).toContain("baselines/main.json");
    expect(result.report.routes.length).toBeGreaterThan(0);
  });

  it("detects drift across a git range without changing the worktree", async () => {
    const root = await createGitFixture();
    const { stdout } = await execFileAsync("git", ["-C", root, "rev-parse", "HEAD~1"]);
    const baselineRef = stdout.trim();

    const result = await runGitDrift({
      root,
      range: `${baselineRef}..HEAD`
    });

    expect(result.report.summary.high).toBeGreaterThan(0);
    expect(result.report.changes.some((change) => change.title === "API route drift")).toBe(true);
    expect(result.report.changes.some((change) => change.title === "Server action drift")).toBe(true);
  });
});

function removeRiskSignals(report: RepoReport): RepoReport {
  return {
    ...report,
    routes: report.routes.filter((route) => route.kind !== "api" && !route.route.includes("/admin")),
    database: {
      ...report.database,
      migrations: [],
      schemaFiles: []
    },
    serverActions: {
      count: 0,
      files: []
    },
    env: {
      ...report.env,
      referencedKeys: [],
      missingExampleKeys: []
    },
    focusFiles: []
  };
}

async function writeReports(
  baseline: RepoReport,
  current: RepoReport
): Promise<{ baselinePath: string; currentPath: string; outDir: string }> {
  const root = await mkdtemp(join(tmpdir(), "forgelens-drift-"));
  createdDirs.push(root);

  const baselinePath = join(root, "baseline.json");
  const currentPath = join(root, "current.json");
  const outDir = join(root, "out");

  await mkdir(outDir, { recursive: true });
  await Promise.all([
    writeFile(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`),
    writeFile(currentPath, `${JSON.stringify(current, null, 2)}\n`)
  ]);

  return { baselinePath, currentPath, outDir };
}

async function createGitFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "forgelens-git-fixture-"));
  createdDirs.push(root);

  await mkdir(join(root, "app"), { recursive: true });
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ name: "git-fixture", dependencies: { next: "15.0.0" } })
  );
  await writeFile(join(root, "tsconfig.json"), "{}\n");
  await writeFile(join(root, "app/page.tsx"), "export default function Page() { return null; }\n");

  await execFileAsync("git", ["-C", root, "init"]);
  await execFileAsync("git", ["-C", root, "config", "user.email", "test@example.com"]);
  await execFileAsync("git", ["-C", root, "config", "user.name", "ForgeLens Test"]);
  await execFileAsync("git", ["-C", root, "add", "."]);
  await execFileAsync("git", ["-C", root, "commit", "-m", "initial"]);

  await mkdir(join(root, "app/api/admin/export"), { recursive: true });
  await mkdir(join(root, "app/actions"), { recursive: true });
  await writeFile(join(root, "app/api/admin/export/route.ts"), "export async function GET() { return Response.json({ ok: true }); }\n");
  await writeFile(join(root, "app/actions/admin.ts"), "\"use server\";\nexport async function saveAdmin() { return { ok: true }; }\n");
  await execFileAsync("git", ["-C", root, "add", "."]);
  await execFileAsync("git", ["-C", root, "commit", "-m", "add risky edges"]);

  return root;
}
