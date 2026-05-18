import { join } from "node:path";
import { writeText } from "../utils/fs.js";
import type { DetectionSignal, GeneratedReportFiles, RepoReport } from "../types.js";

export async function writeMarkdownReports(
  report: RepoReport,
  outDirAbsolute: string
): Promise<GeneratedReportFiles> {
  const files: GeneratedReportFiles = {
    FORGE_CONTEXT: join(outDirAbsolute, "FORGE_CONTEXT.md"),
    ARCHITECTURE_MAP: join(outDirAbsolute, "ARCHITECTURE_MAP.md"),
    ROUTES_MAP: join(outDirAbsolute, "ROUTES_MAP.md"),
    DATABASE_MAP: join(outDirAbsolute, "DATABASE_MAP.md"),
    SERVER_ACTIONS_MAP: join(outDirAbsolute, "SERVER_ACTIONS_MAP.md"),
    SECURITY_RULES: join(outDirAbsolute, "SECURITY_RULES.md"),
    RISK_REPORT: join(outDirAbsolute, "RISK_REPORT.md")
  };

  await Promise.all([
    writeText(files.FORGE_CONTEXT, renderForgeContext(report)),
    writeText(files.ARCHITECTURE_MAP, renderArchitectureMap(report)),
    writeText(files.ROUTES_MAP, renderRoutesMap(report)),
    writeText(files.DATABASE_MAP, renderDatabaseMap(report)),
    writeText(files.SERVER_ACTIONS_MAP, renderServerActionsMap(report)),
    writeText(files.SECURITY_RULES, renderSecurityRules(report)),
    writeText(files.RISK_REPORT, renderRiskReport(report))
  ]);

  return files;
}

function renderForgeContext(report: RepoReport): string {
  return [
    "# FORGE_CONTEXT",
    "",
    `- Root: \`${report.root}\``,
    `- Scanned at: ${report.scannedAt}`,
    `- Framework: ${report.project.framework}`,
    `- Language: ${report.project.language}`,
    `- Package manager: ${report.project.packageManager}`,
    `- Route count: ${report.routes.length}`,
    `- API route count: ${report.routes.filter((r) => r.kind === "api").length}`,
    `- Server actions: ${report.serverActions.count}`,
    `- Database providers: ${signalsSummary(report.database.providers)}`,
    `- Auth providers: ${signalsSummary(report.auth.providers)}`,
    "",
    "## Package Scripts",
    ...renderKeyValueMap(report.project.scripts)
  ].join("\n");
}

function renderArchitectureMap(report: RepoReport): string {
  return [
    "# ARCHITECTURE_MAP",
    "",
    "## Project",
    `- Framework: ${report.project.framework}`,
    `- Language: ${report.project.language}`,
    "",
    "## Important Areas",
    `- App/API routes: ${report.routes.length > 0 ? "detected" : "unknown"}`,
    `- Database: ${report.database.files.length > 0 ? "detected" : "unknown"}`,
    `- Auth: ${hasNonUnknown(report.auth.providers) ? "detected" : "unknown"}`,
    `- Middleware: ${report.security.middlewareFiles.length > 0 ? "detected" : "unknown"}`,
    "",
    "## Key Files",
    ...renderListWithFallback(
      uniqueSorted([
        ...report.auth.files,
        ...report.security.middlewareFiles,
        ...report.database.schemaFiles,
        ...report.serverActions.files
      ]),
      "unknown"
    )
  ].join("\n");
}

function renderRoutesMap(report: RepoReport): string {
  const lines = [
    "# ROUTES_MAP",
    "",
    "| Kind | Route | Source | File |",
    "|---|---|---|---|"
  ];

  if (report.routes.length === 0) {
    lines.push("| unknown | unknown | unknown | unknown |");
    return lines.join("\n");
  }

  for (const route of report.routes) {
    lines.push(`| ${route.kind} | \`${route.route}\` | ${route.source} | \`${route.file}\` |`);
  }

  return lines.join("\n");
}

function renderDatabaseMap(report: RepoReport): string {
  return [
    "# DATABASE_MAP",
    "",
    "## Detected Providers",
    ...renderSignals(report.database.providers),
    "",
    "## Schema Files",
    ...renderListWithFallback(report.database.schemaFiles, "unknown"),
    "",
    "## Migration Files",
    ...renderListWithFallback(report.database.migrations, "unknown"),
    "",
    "## Database Clients",
    ...renderListWithFallback(report.database.clientFiles, "unknown"),
    "",
    "## Unknown/Manual Review Notes",
    ...renderListWithFallback(report.database.notes, "unknown")
  ].join("\n");
}

function renderServerActionsMap(report: RepoReport): string {
  return [
    "# SERVER_ACTIONS_MAP",
    "",
    `- Total files: ${report.serverActions.count}`,
    "",
    "## Files",
    ...renderListWithFallback(report.serverActions.files, "unknown")
  ].join("\n");
}

function renderSecurityRules(report: RepoReport): string {
  const apiRouteFiles = report.routes.filter((route) => route.kind === "api").map((route) => route.file);

  return [
    "# SECURITY_RULES",
    "",
    "## Auth providers/signals detected",
    ...renderSignals(report.auth.providers),
    "",
    "## Auth evidence files",
    ...renderListWithFallback(report.auth.evidenceFiles, "unknown"),
    "",
    "## Middleware status",
    ...renderListWithFallback(report.security.middlewareFiles, "unknown"),
    "",
    "## Server actions requiring review",
    ...renderListWithFallback(report.serverActions.files, "unknown"),
    "",
    "## API routes requiring review",
    ...renderListWithFallback(apiRouteFiles, "unknown"),
    "",
    "## Environment files (names only)",
    ...renderListWithFallback(report.security.envFiles, "unknown"),
    "",
    "## Admin/security-sensitive areas",
    ...renderListWithFallback(report.security.sensitiveFiles, "unknown"),
    "",
    "## Manual verification checklist",
    ...buildSecurityChecklist(report).map((item) => `- [ ] ${item}`)
  ].join("\n");
}

function renderRiskReport(report: RepoReport): string {
  const risks: string[] = [];
  const apiRoutes = report.routes.filter((route) => route.kind === "api");
  const adminRoutes = report.routes.filter(
    (route) => route.route.includes("/admin") || route.route === "/admin"
  );
  const authNames = report.auth.providers.map((provider) => provider.name);

  if (adminRoutes.length > 0 && report.security.middlewareFiles.length === 0) {
    risks.push(
      `Admin routes detected but no middleware: ${adminRoutes
        .map((route) => `\`${route.file}\``)
        .join(", ")}. Verify authorization guards.`
    );
  }

  if (report.serverActions.count > 0) {
    risks.push(
      `Server actions detected (${report.serverActions.count}): ${report.serverActions.files
        .slice(0, 6)
        .map((file) => `\`${file}\``)
        .join(", ")}. Verify auth and input validation.`
    );
  }

  if (apiRoutes.length > 0) {
    risks.push(
      `API routes detected (${apiRoutes.length}): ${apiRoutes
        .slice(0, 6)
        .map((route) => `\`${route.file}\``)
        .join(", ")}. Verify auth and input validation.`
    );
  } else {
    risks.push("No API routes detected.");
  }

  const dbProviders = report.database.providers.filter((provider) => provider.name !== "unknown");
  if (dbProviders.length > 0) {
    risks.push(
      `Database providers detected: ${dbProviders
        .map((provider) => `${provider.name} (${provider.confidence})`)
        .join(", ")}. Verify credentials are server-only.`
    );
  }

  if (report.security.envFiles.length > 0) {
    risks.push(
      `Environment files detected (names only): ${report.security.envFiles
        .map((file) => `\`${file}\``)
        .join(", ")}.`
    );
  }

  const weakAuthSignals = authNames.filter((name) => name === "unknown" || name === "custom-auth");
  if (weakAuthSignals.length > 0) {
    risks.push("Auth provider is custom/unknown. Manual review required.");
  }

  if (report.security.riskyFiles.length > 0) {
    risks.push(
      `Potential risky patterns found in: ${report.security.riskyFiles
        .map((file) => `\`${file}\``)
        .join(", ")}.`
    );
  }

  if (risks.length === 0) {
    risks.push("No obvious static risks found. Dynamic/runtime risks remain unknown.");
  }

  return [
    "# RISK_REPORT",
    "",
    "## Summary",
    ...risks.map((risk) => `- ${risk}`),
    "",
    "## Unknowns",
    "- Authorization guard coverage inside route handlers is unknown.",
    "- Row-level tenant/account isolation checks are unknown.",
    "- Runtime secrets handling and deployment config are unknown."
  ].join("\n");
}

function renderSignals(signals: DetectionSignal[]): string[] {
  if (signals.length === 0) {
    return ["- unknown"];
  }

  return signals.flatMap((signal) => {
    const lines = [`- ${signal.name} (confidence: ${signal.confidence})`];
    lines.push(`  evidence: ${renderInlineEvidence(signal.evidenceFiles)}`);
    if (signal.notes.length > 0) {
      lines.push(`  notes: ${signal.notes.join("; ")}`);
    }
    return lines;
  });
}

function renderInlineEvidence(files: string[]): string {
  if (files.length === 0) {
    return "unknown";
  }

  return files.map((file) => `\`${file}\``).join(", ");
}

function renderKeyValueMap(values: Record<string, string>): string[] {
  const entries = Object.entries(values);
  if (entries.length === 0) {
    return ["- unknown"];
  }

  return entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `- \`${key}\`: \`${value}\``);
}

function renderListWithFallback(items: string[], fallback: string): string[] {
  if (items.length === 0) {
    return [`- ${fallback}`];
  }

  return items.map((item) => `- \`${item}\``);
}

function signalsSummary(signals: DetectionSignal[]): string {
  if (signals.length === 0) {
    return "unknown";
  }

  return signals.map((signal) => `${signal.name} (${signal.confidence})`).join(", ");
}

function hasNonUnknown(signals: DetectionSignal[]): boolean {
  return signals.some((signal) => signal.name !== "unknown");
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function buildSecurityChecklist(report: RepoReport): string[] {
  const checklist = [
    "Confirm auth checks for admin pages and server actions.",
    "Confirm API routes validate input and enforce auth.",
    "Confirm server actions validate input and enforce auth.",
    "Confirm secrets are never exposed to client code."
  ];

  if (report.security.middlewareFiles.length === 0) {
    checklist.push("Review if middleware is required for route protection.");
  }

  return checklist;
}
