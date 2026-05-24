import type { FocusFileScore, FocusItem, RepoReport } from "../types.js";

type FocusInput = Omit<RepoReport, "focus" | "focusFiles">;

export function buildFocusMap(report: FocusInput): FocusItem[] {
  const items: FocusItem[] = [];
  const apiRouteFiles = report.routes.filter((route) => route.kind === "api").map((route) => route.file);
  const adminRouteFiles = report.routes
    .filter((route) => route.route === "/admin" || route.route.includes("/admin/"))
    .map((route) => route.file);

  pushItem(items, {
    priority: "high",
    area: "Auth and sessions",
    reason: "Review login, roles, and access boundaries before changing protected behavior.",
    files: uniqueSorted([
      ...report.auth.evidenceFiles.filter((file) => !isEnvFile(file)),
      ...report.security.middlewareFiles,
      ...adminRouteFiles
    ])
  });

  pushItem(items, {
    priority: "high",
    area: "Server actions",
    reason: "Write actions can change data; verify auth, ownership, and input validation.",
    files: report.serverActions.files
  });

  pushItem(items, {
    priority: "high",
    area: "API routes",
    reason: "Exposed endpoints need validation, auth, and safe error handling.",
    files: apiRouteFiles
  });

  pushItem(items, {
    priority: "high",
    area: "Database writes and schema",
    reason: "Schema, migrations, and database clients can affect stored data.",
    files: uniqueSorted([
      ...report.database.schemaFiles,
      ...report.database.migrations,
      ...report.database.clientFiles
    ])
  });

  pushItem(items, {
    priority: "medium",
    area: "Env and secrets",
    reason: "Missing examples or risky public env names can create production config mistakes.",
    files: uniqueSorted([...report.env.envFiles, ...report.env.serverSecretClientFiles])
  });

  pushItem(items, {
    priority: "medium",
    area: "UI, UX, and responsive states",
    reason: "Pages, forms, and accessibility-risk files deserve review during user-facing changes.",
    files: uniqueSorted([
      ...report.uiUx.pageFiles,
      ...report.uiUx.formFiles,
      ...report.uiUx.accessibilityRiskFiles
    ])
  });

  pushItem(items, {
    priority: "medium",
    area: "Performance and failure points",
    reason: "Large files, client components, fetch calls, and external APIs can slow or break flows.",
    files: uniqueSorted([
      ...report.performance.largeFiles,
      ...report.performance.clientComponentFiles,
      ...report.performance.uncachedFetchFiles,
      ...report.performance.externalApiFiles
    ])
  });

  if (items.length === 0) {
    items.push({
      priority: "low",
      area: "General repository context",
      reason: "No focused hotspots were detected by static analysis.",
      files: []
    });
  }

  return items.sort((left, right) => priorityRank(right.priority) - priorityRank(left.priority));
}

export function buildFocusFileScores(report: FocusInput): FocusFileScore[] {
  const scores = new Map<string, { score: number; reasons: string[] }>();
  const apiRouteFiles = report.routes.filter((route) => route.kind === "api").map((route) => route.file);
  const adminRouteFiles = report.routes
    .filter((route) => route.route === "/admin" || route.route.includes("/admin/"))
    .map((route) => route.file);

  addScores(scores, report.serverActions.files, 55, "server action");
  addScores(scores, apiRouteFiles, 45, "API route");
  addScores(scores, adminRouteFiles, 35, "admin route");
  addScores(scores, report.auth.evidenceFiles.filter((file) => !isEnvFile(file)), 22, "auth/session evidence");
  addScores(scores, report.security.middlewareFiles, 35, "middleware");
  addScores(scores, report.database.schemaFiles, 45, "database schema");
  addScores(scores, report.database.migrations, 40, "database migration");
  addScores(scores, report.database.clientFiles, 30, "database client");
  addScores(scores, report.env.serverSecretClientFiles, 50, "server secret-like env in client file");
  addScores(scores, report.env.envFiles, 15, "env/config file");
  addScores(scores, report.uiUx.formFiles, 10, "form UI");
  addScores(scores, report.uiUx.accessibilityRiskFiles, 15, "accessibility risk hint");
  addScores(scores, report.uiUx.pageFiles, 8, "page/layout state");
  addScores(scores, report.performance.largeFiles, 12, "large code file");
  addScores(scores, report.performance.clientComponentFiles, 8, "client component");
  addScores(scores, report.performance.uncachedFetchFiles, 12, "fetch without nearby cache hint");
  addScores(scores, report.performance.externalApiFiles, 25, "external API call");
  addScores(scores, report.security.riskyFiles, 35, "risky code pattern");
  addScores(scores, report.security.sensitiveFiles, 12, "security-sensitive path");

  return [...scores.entries()]
    .map(([file, value]) => ({
      file,
      score: value.score,
      priority: scorePriority(value.score),
      reasons: uniqueSorted(value.reasons)
    }))
    .sort((left, right) => right.score - left.score || left.file.localeCompare(right.file))
    .slice(0, 20);
}

function pushItem(items: FocusItem[], item: FocusItem): void {
  if (item.files.length === 0) {
    return;
  }
  items.push({ ...item, files: item.files.slice(0, 12) });
}

function addScores(
  scores: Map<string, { score: number; reasons: string[] }>,
  files: string[],
  amount: number,
  reason: string
): void {
  for (const file of files) {
    const existing = scores.get(file) ?? { score: 0, reasons: [] };
    existing.score += amount;
    existing.reasons.push(reason);
    scores.set(file, existing);
  }
}

function scorePriority(score: number): FocusFileScore["priority"] {
  if (score >= 50) {
    return "high";
  }
  if (score >= 25) {
    return "medium";
  }
  return "low";
}

function priorityRank(priority: FocusItem["priority"]): number {
  const ranks = { low: 1, medium: 2, high: 3 } as const;
  return ranks[priority];
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function isEnvFile(file: string): boolean {
  return file.split("/").some((segment) => segment.startsWith(".env"));
}
