import { isAbsolute, relative, resolve } from "node:path";
import { detectAuth } from "./detectors/auth.js";
import { detectDatabase } from "./detectors/database.js";
import { detectEnvSafety } from "./detectors/env.js";
import { buildFocusFileScores, buildFocusMap } from "./detectors/focus.js";
import { detectPerformanceRisks } from "./detectors/performance.js";
import { detectProject } from "./detectors/project.js";
import { detectRoutes } from "./detectors/routes.js";
import { detectSecurity } from "./detectors/security.js";
import { detectServerActions } from "./detectors/server-actions.js";
import { detectUiUx } from "./detectors/ui-ux.js";
import { writeJsonReport } from "./writers/json.js";
import { writeMarkdownReports } from "./writers/markdown.js";
import type { GeneratedReportFiles, RepoReport, ScanOptions } from "./types.js";

export async function scanRepo(
  root: string,
  outDir: string,
): Promise<RepoReport> {
  const absoluteRoot = resolve(root);

  const [
    project,
    routes,
    database,
    auth,
    serverActions,
    security,
    env,
    uiUx,
    performance,
  ] = await Promise.all([
    detectProject(absoluteRoot),
    detectRoutes(absoluteRoot, outDir),
    detectDatabase(absoluteRoot, outDir),
    detectAuth(absoluteRoot, outDir),
    detectServerActions(absoluteRoot, outDir),
    detectSecurity(absoluteRoot, outDir),
    detectEnvSafety(absoluteRoot, outDir),
    detectUiUx(absoluteRoot, outDir),
    detectPerformanceRisks(absoluteRoot, outDir),
  ]);

  const reportWithoutFocus = {
    root: absoluteRoot,
    scannedAt: new Date().toISOString(),
    project,
    routes,
    database,
    auth,
    serverActions,
    security,
    env,
    uiUx,
    performance,
  };

  return {
    ...reportWithoutFocus,
    focus: buildFocusMap(reportWithoutFocus),
    focusFiles: buildFocusFileScores(reportWithoutFocus),
  };
}

export async function runScan(options: ScanOptions): Promise<{
  report: RepoReport;
  files: GeneratedReportFiles;
  outDirAbsolute: string;
}> {
  const rootAbsolute = resolve(options.root);
  const outDirAbsolute = resolve(rootAbsolute, options.outDir);

  if (!["markdown", "json", "all"].includes(options.format)) {
    throw new Error(`Unsupported format: ${options.format}`);
  }

  if (!isPathInsideRoot(rootAbsolute, outDirAbsolute)) {
    throw new Error("Output folder must be inside the selected root folder.");
  }

  const report = await scanRepo(rootAbsolute, options.outDir);

  const files = await writeReports(report, outDirAbsolute, options.format);

  return {
    report,
    files,
    outDirAbsolute,
  };
}

async function writeReports(
  report: RepoReport,
  outDirAbsolute: string,
  format: ScanOptions["format"],
): Promise<GeneratedReportFiles> {
  if (format === "markdown") {
    return writeMarkdownReports(report, outDirAbsolute);
  }
  if (format === "json") {
    return writeJsonReport(report, outDirAbsolute);
  }

  return {
    ...(await writeMarkdownReports(report, outDirAbsolute)),
    ...(await writeJsonReport(report, outDirAbsolute)),
  };
}

function isPathInsideRoot(root: string, target: string): boolean {
  const pathFromRoot = relative(root, target);
  return (
    pathFromRoot !== "" &&
    !pathFromRoot.startsWith("..") &&
    !isAbsolute(pathFromRoot)
  );
}
