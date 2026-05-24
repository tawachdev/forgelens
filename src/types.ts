export type OutputFormat = "markdown" | "json" | "all";
export type Confidence = "high" | "medium" | "low";

export interface ScanOptions {
  root: string;
  outDir: string;
  format: OutputFormat;
  verbose: boolean;
}

export interface ProjectInfo {
  framework: "nextjs" | "unknown";
  language: "typescript" | "javascript" | "unknown";
  packageManager: "pnpm" | "npm" | "yarn" | "bun" | "unknown";
  scripts: Record<string, string>;
  dependencies: string[];
  devDependencies: string[];
}

export interface RouteItem {
  kind: "page" | "api";
  route: string;
  file: string;
  source: "app" | "pages";
}

export interface DetectionSignal {
  name: string;
  confidence: Confidence;
  evidenceFiles: string[];
  notes: string[];
}

export interface DatabaseInfo {
  providers: DetectionSignal[];
  files: string[];
  schemaFiles: string[];
  migrations: string[];
  clientFiles: string[];
  notes: string[];
}

export interface AuthInfo {
  providers: DetectionSignal[];
  files: string[];
  evidenceFiles: string[];
  middlewareFiles: string[];
  notes: string[];
}

export interface ServerActionsInfo {
  count: number;
  files: string[];
}

export interface SecurityInfo {
  envFiles: string[];
  middlewareFiles: string[];
  riskyFiles: string[];
  sensitiveFiles: string[];
  notes: string[];
}

export interface EnvSafetyInfo {
  envFiles: string[];
  exampleFiles: string[];
  referencedKeys: string[];
  exampleKeys: string[];
  missingExampleKeys: string[];
  publicRiskKeys: string[];
  serverSecretClientFiles: string[];
  notes: string[];
}

export interface UiUxInfo {
  pageFiles: string[];
  componentFiles: string[];
  formFiles: string[];
  loadingStateFiles: string[];
  emptyStateFiles: string[];
  errorStateFiles: string[];
  responsiveFiles: string[];
  accessibilityRiskFiles: string[];
  notes: string[];
}

export interface PerformanceRiskInfo {
  largeFiles: string[];
  clientComponentFiles: string[];
  imageUsageFiles: string[];
  rawImageFiles: string[];
  fetchFiles: string[];
  uncachedFetchFiles: string[];
  externalApiFiles: string[];
  notes: string[];
}

export interface FocusItem {
  priority: "high" | "medium" | "low";
  area: string;
  reason: string;
  files: string[];
}

export interface FocusFileScore {
  file: string;
  score: number;
  priority: "high" | "medium" | "low";
  reasons: string[];
}

export interface RepoReport {
  root: string;
  scannedAt: string;
  project: ProjectInfo;
  routes: RouteItem[];
  database: DatabaseInfo;
  auth: AuthInfo;
  serverActions: ServerActionsInfo;
  security: SecurityInfo;
  env: EnvSafetyInfo;
  uiUx: UiUxInfo;
  performance: PerformanceRiskInfo;
  focus: FocusItem[];
  focusFiles: FocusFileScore[];
}

export type GeneratedReportFiles = Record<string, string>;
