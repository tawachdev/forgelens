import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { scanRepo } from "./scan.js";
import { writeText } from "./utils/fs.js";
import type {
  DetectionSignal,
  DriftCategory,
  DriftChange,
  DriftReport,
  DriftSeverity,
  FocusFileScore,
  GeneratedReportFiles,
  RepoReport,
  RouteItem,
} from "./types.js";

const MARKDOWN_ITEM_LIMIT = 8;
const execFileAsync = promisify(execFile);

export interface DriftOptions {
  baseline: string;
  current: string;
  outDir?: string;
}

export async function runDrift(options: DriftOptions): Promise<{
  report: DriftReport;
  files: GeneratedReportFiles;
}> {
  const baselinePath = resolve(options.baseline);
  const currentPath = resolve(options.current);
  const [baseline, current] = await Promise.all([
    readRepoReport(baselinePath),
    readRepoReport(currentPath),
  ]);

  const report = buildDriftReport(baseline, current, baselinePath, currentPath);
  const files = options.outDir
    ? await writeDriftReports(report, resolve(options.outDir))
    : {};

  return { report, files };
}

export async function runGitDrift(options: {
  root: string;
  range: string;
  outDir?: string;
}): Promise<{
  report: DriftReport;
  files: GeneratedReportFiles;
}> {
  const rootAbsolute = resolve(options.root);
  const { baselineRef, currentRef } = parseGitRange(options.range);
  const tempRoot = await mkdtemp(join(tmpdir(), "forgelens-git-drift-"));

  try {
    const baselineRoot = join(tempRoot, "baseline");
    const currentRoot = join(tempRoot, "current");

    await Promise.all([
      exportGitTree(rootAbsolute, baselineRef, baselineRoot),
      exportGitTree(rootAbsolute, currentRef, currentRoot),
    ]);

    const [baseline, current] = await Promise.all([
      scanRepo(baselineRoot, ".forgelens"),
      scanRepo(currentRoot, ".forgelens"),
    ]);

    const report = buildDriftReport(
      baseline,
      current,
      `git:${baselineRef}`,
      `git:${currentRef}`,
    );
    const files = options.outDir
      ? await writeDriftReports(report, resolve(rootAbsolute, options.outDir))
      : {};

    return { report, files };
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

export function buildDriftReport(
  baseline: RepoReport,
  current: RepoReport,
  baselinePath: string,
  currentPath: string,
): DriftReport {
  const changes = [
    ...buildAuthChanges(baseline, current),
    ...buildRouteChanges(baseline, current),
    ...buildServerActionChanges(baseline, current),
    ...buildDatabaseChanges(baseline, current),
    ...buildEnvChanges(baseline, current),
    ...buildSecurityChanges(baseline, current),
    ...buildFocusChanges(baseline, current),
  ];

  return {
    baselinePath,
    currentPath,
    comparedAt: new Date().toISOString(),
    changes,
    summary: {
      high: changes.filter((change) => change.severity === "high").length,
      medium: changes.filter((change) => change.severity === "medium").length,
      low: changes.filter((change) => change.severity === "low").length,
      total: changes.length,
    },
    recommendations: buildRecommendations(changes),
  };
}

export function renderDriftReport(report: DriftReport): string {
  return [
    "# DRIFT_REPORT",
    "",
    `- Baseline: \`${report.baselinePath}\``,
    `- Current: \`${report.currentPath}\``,
    `- Compared at: ${report.comparedAt}`,
    `- High changes: ${report.summary.high}`,
    `- Medium changes: ${report.summary.medium}`,
    `- Low changes: ${report.summary.low}`,
    `- Total changes: ${report.summary.total}`,
    "",
    "## Executive Summary",
    ...renderExecutiveSummary(report),
    "",
    "## Changes",
    ...renderDriftChanges(report.changes),
    "",
    "## Recommendations",
    ...renderPlainList(report.recommendations),
  ].join("\n");
}

async function writeDriftReports(
  report: DriftReport,
  outDirAbsolute: string,
): Promise<GeneratedReportFiles> {
  const files = {
    DRIFT_REPORT: join(outDirAbsolute, "DRIFT_REPORT.md"),
    DRIFT_REPORT_JSON: join(outDirAbsolute, "DRIFT_REPORT.json"),
  };

  await Promise.all([
    writeText(files.DRIFT_REPORT, renderDriftReport(report)),
    writeText(files.DRIFT_REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`),
  ]);

  return files;
}

async function readRepoReport(path: string): Promise<RepoReport> {
  const text = await readFile(path, "utf8");
  const parsed: unknown = JSON.parse(text);

  if (!isRepoReport(parsed)) {
    throw new Error(`Invalid ForgeLens report: ${path}`);
  }

  return parsed;
}

function parseGitRange(range: string): {
  baselineRef: string;
  currentRef: string;
} {
  const normalized = range.trim();
  const delimiter = normalized.includes("...") ? "..." : "..";
  const [baselineRef, currentRef] = normalized.split(delimiter);

  if (!baselineRef || !currentRef) {
    throw new Error("Git drift range must look like base..head.");
  }

  return { baselineRef, currentRef };
}

async function exportGitTree(
  root: string,
  ref: string,
  outDir: string,
): Promise<void> {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  await execFileAsync("git", [
    "clone",
    "--quiet",
    "--no-checkout",
    root,
    outDir,
  ]);
  await execFileAsync("git", [
    "-C",
    outDir,
    "checkout",
    "--detach",
    "--quiet",
    ref,
  ]);

  // Keep scan fast and avoid reading git history metadata.
  await rm(join(outDir, ".git"), { recursive: true, force: true });
}

function buildAuthChanges(
  baseline: RepoReport,
  current: RepoReport,
): DriftChange[] {
  return [
    compareValues({
      category: "auth",
      severity: "high",
      title: "Auth provider drift",
      baseline: signalNames(baseline.auth.providers),
      current: signalNames(current.auth.providers),
      note: "Auth provider changes can make agent rules stale around login and sessions.",
    }),
    compareValues({
      category: "auth",
      severity: "high",
      title: "Middleware drift",
      baseline: baseline.security.middlewareFiles,
      current: current.security.middlewareFiles,
      note: "Middleware changes can alter route protection boundaries.",
    }),
  ].filter(isChange);
}

function buildRouteChanges(
  baseline: RepoReport,
  current: RepoReport,
): DriftChange[] {
  const baselineApi = baseline.routes
    .filter((route) => route.kind === "api")
    .map(routeKey);
  const currentApi = current.routes
    .filter((route) => route.kind === "api")
    .map(routeKey);
  const baselineAdmin = baseline.routes.filter(isAdminRoute).map(routeKey);
  const currentAdmin = current.routes.filter(isAdminRoute).map(routeKey);

  return [
    compareValues({
      category: "routes",
      severity: "high",
      title: "API route drift",
      baseline: baselineApi,
      current: currentApi,
      note: "New or removed API routes change exposed server boundaries.",
    }),
    compareValues({
      category: "routes",
      severity: "high",
      title: "Admin route drift",
      baseline: baselineAdmin,
      current: currentAdmin,
      note: "Admin route changes need auth, role, and ownership review.",
    }),
  ].filter(isChange);
}

function buildServerActionChanges(
  baseline: RepoReport,
  current: RepoReport,
): DriftChange[] {
  return [
    compareValues({
      category: "server-actions",
      severity: "high",
      title: "Server action drift",
      baseline: baseline.serverActions.files,
      current: current.serverActions.files,
      note: "Server action changes can introduce new data mutations.",
    }),
  ].filter(isChange);
}

function buildDatabaseChanges(
  baseline: RepoReport,
  current: RepoReport,
): DriftChange[] {
  return [
    compareValues({
      category: "database",
      severity: "high",
      title: "Database provider drift",
      baseline: signalNames(baseline.database.providers),
      current: signalNames(current.database.providers),
      note: "Provider changes can affect data access assumptions.",
    }),
    compareValues({
      category: "database",
      severity: "high",
      title: "Migration drift",
      baseline: baseline.database.migrations,
      current: current.database.migrations,
      note: "Migration changes need schema and data-safety review.",
    }),
    compareValues({
      category: "database",
      severity: "high",
      title: "Schema drift",
      baseline: baseline.database.schemaFiles,
      current: current.database.schemaFiles,
      note: "Schema changes can change data access and validation rules.",
    }),
    compareValues({
      category: "database",
      severity: "medium",
      title: "Database client drift",
      baseline: baseline.database.clientFiles,
      current: current.database.clientFiles,
      note: "Database client changes can alter query and tenant-scope behavior.",
    }),
  ].filter(isChange);
}

function buildEnvChanges(
  baseline: RepoReport,
  current: RepoReport,
): DriftChange[] {
  return [
    compareValues({
      category: "env",
      severity: "medium",
      title: "Referenced env key drift",
      baseline: baseline.env.referencedKeys,
      current: current.env.referencedKeys,
      note: "New env keys can make setup docs and deployment config stale.",
    }),
    compareValues({
      category: "env",
      severity: "medium",
      title: "Missing example env key drift",
      baseline: baseline.env.missingExampleKeys,
      current: current.env.missingExampleKeys,
      note: "Missing examples make onboarding and deployment less reliable.",
    }),
    compareValues({
      category: "env",
      severity: "high",
      title: "Public env risk drift",
      baseline: baseline.env.publicRiskKeys,
      current: current.env.publicRiskKeys,
      note: "Secret-like public env names need manual review.",
    }),
  ].filter(isChange);
}

function buildSecurityChanges(
  baseline: RepoReport,
  current: RepoReport,
): DriftChange[] {
  return [
    compareValues({
      category: "security",
      severity: "high",
      title: "Risky pattern drift",
      baseline: baseline.security.riskyFiles,
      current: current.security.riskyFiles,
      note: "Risky pattern changes need manual code review.",
    }),
    compareValues({
      category: "security",
      severity: "medium",
      title: "Security-sensitive file drift",
      baseline: baseline.security.sensitiveFiles,
      current: current.security.sensitiveFiles,
      note: "Sensitive area changes can make the agent focus map stale.",
    }),
  ].filter(isChange);
}

function buildFocusChanges(
  baseline: RepoReport,
  current: RepoReport,
): DriftChange[] {
  const baselineHighFocus = baseline.focusFiles
    .filter((file) => file.priority === "high")
    .map(focusKey);
  const currentHighFocus = current.focusFiles
    .filter((file) => file.priority === "high")
    .map(focusKey);

  return [
    compareValues({
      category: "focus",
      severity: "high",
      title: "High-priority focus file drift",
      baseline: baselineHighFocus,
      current: currentHighFocus,
      note: "New high-priority files should be read before AI edits.",
    }),
  ].filter(isChange);
}

function compareValues(input: {
  category: DriftCategory;
  severity: DriftSeverity;
  title: string;
  baseline: string[];
  current: string[];
  note: string;
}): DriftChange | null {
  const baseline = uniqueSorted(input.baseline);
  const current = uniqueSorted(input.current);
  const added = current.filter((value) => !baseline.includes(value));
  const removed = baseline.filter((value) => !current.includes(value));

  if (added.length === 0 && removed.length === 0) {
    return null;
  }

  return {
    category: input.category,
    severity: input.severity,
    title: input.title,
    added,
    removed,
    note: input.note,
  };
}

function buildRecommendations(changes: DriftChange[]): string[] {
  if (changes.length === 0) {
    return ["No drift detected. Existing context appears current."];
  }

  const recommendations = [
    "Regenerate and read `AI_COMPACT_CONTEXT.md` before new AI edits.",
  ];

  if (
    changes.some(
      (change) => change.category === "auth" || change.category === "routes",
    )
  ) {
    recommendations.push(
      "Review auth, roles, route protection, and admin/API boundaries.",
    );
  }
  if (
    changes.some(
      (change) =>
        change.category === "server-actions" || change.category === "database",
    )
  ) {
    recommendations.push(
      "Review data writes, migrations, schema changes, and tenant/account scope.",
    );
  }
  if (changes.some((change) => change.category === "env")) {
    recommendations.push(
      "Update env examples and deployment config before release.",
    );
  }
  if (changes.some((change) => change.category === "focus")) {
    recommendations.push(
      "Read new high-priority focus files before editing related flows.",
    );
  }

  return uniqueSorted(recommendations);
}

function renderDriftChanges(changes: DriftChange[]): string[] {
  if (changes.length === 0) {
    return ["- No drift detected."];
  }

  return changes.flatMap((change) => [
    `### ${change.title}`,
    "",
    `- Severity: ${change.severity}`,
    `- Category: ${change.category}`,
    `- Added: ${renderLimitedInlineList(change.added)}`,
    `- Removed: ${renderLimitedInlineList(change.removed)}`,
    `- Note: ${change.note}`,
    "",
  ]);
}

function renderExecutiveSummary(report: DriftReport): string[] {
  if (report.changes.length === 0) {
    return ["- No drift detected."];
  }

  const highChanges = report.changes.filter(
    (change) => change.severity === "high",
  );
  const mediumChanges = report.changes.filter(
    (change) => change.severity === "medium",
  );
  const lines = [
    `- ${report.summary.high} high, ${report.summary.medium} medium, ${report.summary.low} low drift groups detected.`,
    `- Highest-risk groups: ${renderChangeTitles(highChanges.slice(0, 5))}.`,
    "- Full added/removed lists are available in `DRIFT_REPORT.json`.",
  ];

  if (mediumChanges.length > 0) {
    lines.push(
      `- Medium-risk groups: ${renderChangeTitles(mediumChanges.slice(0, 5))}.`,
    );
  }

  return lines;
}

function renderPlainList(items: string[]): string[] {
  return items.map((item) => `- ${item}`);
}

function renderInlineList(items: string[]): string {
  if (items.length === 0) {
    return "none";
  }

  return items.map((item) => `\`${item}\``).join(", ");
}

function renderLimitedInlineList(items: string[]): string {
  if (items.length === 0) {
    return "none";
  }

  const visibleItems = items.slice(0, MARKDOWN_ITEM_LIMIT);
  const remaining = items.length - visibleItems.length;
  const suffix =
    remaining > 0 ? `, and ${remaining} more in \`DRIFT_REPORT.json\`` : "";

  return `${renderInlineList(visibleItems)}${suffix}`;
}

function renderChangeTitles(changes: DriftChange[]): string {
  if (changes.length === 0) {
    return "none";
  }

  return changes.map((change) => change.title).join(", ");
}

function signalNames(signals: DetectionSignal[]): string[] {
  return signals.map((signal) => `${signal.name}:${signal.confidence}`);
}

function routeKey(route: RouteItem): string {
  return `${route.route} (${route.file})`;
}

function focusKey(file: FocusFileScore): string {
  return `${file.file} (${file.score})`;
}

function isAdminRoute(route: RouteItem): boolean {
  return route.route === "/admin" || route.route.includes("/admin/");
}

function isChange(change: DriftChange | null): change is DriftChange {
  return change !== null;
}

function isRepoReport(value: unknown): value is RepoReport {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.root === "string" &&
    Array.isArray(value.routes) &&
    isRecord(value.database) &&
    isRecord(value.auth) &&
    isRecord(value.serverActions) &&
    isRecord(value.security) &&
    isRecord(value.env) &&
    Array.isArray(value.focusFiles)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}
