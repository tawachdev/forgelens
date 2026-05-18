import { access } from "node:fs/promises";
import { resolve } from "node:path";
import fg from "fast-glob";
import { detectProject } from "./detectors/project.js";
import { detectSecurity } from "./detectors/security.js";
import { defaultIgnores } from "./utils/ignore.js";

export interface DoctorOptions {
  root: string;
  outDir: string;
}

export interface DoctorReport {
  rootPath: string;
  rootExists: boolean;
  packageJsonExists: boolean;
  framework: string;
  packageManager: string;
  ignoredFoldersConfigured: boolean;
  outputFolderPath: string;
  outputPathValid: boolean;
  sourceRepoWillNotBeModified: boolean;
  networkOrApiRequired: boolean;
  envFiles: string[];
  scannableSourceFiles: number;
  warnings: string[];
}

export async function inspectRepoSafety(options: DoctorOptions): Promise<DoctorReport> {
  const rootPath = resolve(options.root);
  const outputFolderPath = resolve(rootPath, options.outDir);

  const rootExists = await pathExists(rootPath);
  if (!rootExists) {
    return {
      rootPath,
      rootExists: false,
      packageJsonExists: false,
      framework: "unknown",
      packageManager: "unknown",
      ignoredFoldersConfigured: defaultIgnores(options.outDir).length > 0,
      outputFolderPath,
      outputPathValid: isValidOutputPath(rootPath, outputFolderPath),
      sourceRepoWillNotBeModified: true,
      networkOrApiRequired: false,
      envFiles: [],
      scannableSourceFiles: 0,
      warnings: ["Root path does not exist."]
    };
  }

  const packageJsonExists = await pathExists(resolve(rootPath, "package.json"));
  const project = await detectProject(rootPath);
  const security = await detectSecurity(rootPath, options.outDir);
  const scannableSourceFiles = await detectScannableSourceFiles(rootPath, options.outDir);
  const warnings: string[] = [];

  if (!packageJsonExists) {
    warnings.push("No package.json found at root. Check if --root points to the real project root.");
  }

  if (scannableSourceFiles === 0) {
    warnings.push("No scannable source files found after ignore rules.");
  }

  return {
    rootPath,
    rootExists,
    packageJsonExists,
    framework: project.framework,
    packageManager: project.packageManager,
    ignoredFoldersConfigured: defaultIgnores(options.outDir).length > 0,
    outputFolderPath,
    outputPathValid: isValidOutputPath(rootPath, outputFolderPath),
    sourceRepoWillNotBeModified: true,
    networkOrApiRequired: false,
    envFiles: security.envFiles,
    scannableSourceFiles,
    warnings
  };
}

export function renderDoctorReport(report: DoctorReport): string {
  const lines = [
    "ForgeLens Doctor",
    `- Root path exists: ${status(report.rootExists)}`,
    `- package.json exists: ${status(report.packageJsonExists)}`,
    `- Detected framework: ${report.framework}`,
    `- Detected package manager: ${report.packageManager}`,
    `- Ignored folders configured: ${status(report.ignoredFoldersConfigured)}`,
    `- Output folder path: ${report.outputFolderPath}`,
    `- Output folder path valid: ${status(report.outputPathValid)}`,
    `- Source repo will not be modified: ${status(report.sourceRepoWillNotBeModified)}`,
    `- Network/API usage needed: ${report.networkOrApiRequired ? "yes" : "no"}`,
    `- Scannable source files: ${report.scannableSourceFiles}`
  ];

  if (report.envFiles.length > 0) {
    lines.push("- .env files found:");
    for (const file of report.envFiles) {
      lines.push(`  - ${file}`);
    }
  } else {
    lines.push("- .env files found: none");
  }

  lines.push("- Secret values printed: no");
  if (report.warnings.length > 0) {
    lines.push("- Warnings:");
    for (const warning of report.warnings) {
      lines.push(`  - ${warning}`);
    }
  }

  return lines.join("\n");
}

function status(ok: boolean): string {
  return ok ? "ok" : "no";
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function isValidOutputPath(root: string, output: string): boolean {
  if (!output || output === root || output === "/") {
    return false;
  }

  return output.startsWith(`${root}/`);
}

async function detectScannableSourceFiles(root: string, outDir: string): Promise<number> {
  const files = await fg(["**/*.@(ts|tsx|js|jsx)"], {
    cwd: root,
    ignore: defaultIgnores(outDir)
  });
  return files.length;
}
