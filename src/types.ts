export type OutputFormat = "markdown";
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

export interface RepoReport {
  root: string;
  scannedAt: string;
  project: ProjectInfo;
  routes: RouteItem[];
  database: DatabaseInfo;
  auth: AuthInfo;
  serverActions: ServerActionsInfo;
  security: SecurityInfo;
}

export interface GeneratedReportFiles {
  FORGE_CONTEXT: string;
  ARCHITECTURE_MAP: string;
  ROUTES_MAP: string;
  DATABASE_MAP: string;
  SERVER_ACTIONS_MAP: string;
  SECURITY_RULES: string;
  RISK_REPORT: string;
}
