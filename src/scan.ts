import { isAbsolute, relative, resolve } from "node:path";
import { detectAuth } from "./detectors/auth.js";
import { detectDatabase } from "./detectors/database.js";
import { detectProject } from "./detectors/project.js";
import { detectRoutes } from "./detectors/routes.js";
import { detectSecurity } from "./detectors/security.js";
import { detectServerActions } from "./detectors/server-actions.js";
import { writeMarkdownReports } from "./writers/markdown.js";
import type { GeneratedReportFiles, RepoReport, ScanOptions } from "./types.js";

export async function scanRepo(root: string, outDir: string): Promise<RepoReport> {
  const absoluteRoot = resolve(root);

  const [project, routes, database, auth, serverActions, security] = await Promise.all([
    detectProject(absoluteRoot),
    detectRoutes(absoluteRoot, outDir),
    detectDatabase(absoluteRoot, outDir),
    detectAuth(absoluteRoot, outDir),
    detectServerActions(absoluteRoot, outDir),
    detectSecurity(absoluteRoot, outDir)
  ]);

  return {
    root: absoluteRoot,
    scannedAt: new Date().toISOString(),
    project,
    routes,
    database,
    auth,
    serverActions,
    security
  };
}

export async function runScan(options: ScanOptions): Promise<{
  report: RepoReport;
  files: GeneratedReportFiles;
  outDirAbsolute: string;
}> {
  const rootAbsolute = resolve(options.root);
  const outDirAbsolute = resolve(rootAbsolute, options.outDir);

  if (options.format !== "markdown") {
    throw new Error(`Unsupported format: ${options.format}`);
  }

  if (!isPathInsideRoot(rootAbsolute, outDirAbsolute)) {
    throw new Error("Output folder must be inside the selected root folder.");
  }

  const report = await scanRepo(rootAbsolute, options.outDir);

  const files = await writeMarkdownReports(report, outDirAbsolute);

  return {
    report,
    files,
    outDirAbsolute
  };
}

function isPathInsideRoot(root: string, target: string): boolean {
  const pathFromRoot = relative(root, target);
  return pathFromRoot !== "" && !pathFromRoot.startsWith("..") && !isAbsolute(pathFromRoot);
}
