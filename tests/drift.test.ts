import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { renderDriftReport, runDrift } from "../src/drift.js";
import { scanRepo } from "../src/scan.js";
import type { RepoReport } from "../src/types.js";

const createdDirs: string[] = [];

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
