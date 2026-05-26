import { basename, join, relative, resolve } from "node:path";
import { isAbsolute } from "node:path";
import { runScan } from "./scan.js";
import { writeText } from "./utils/fs.js";
import type { GeneratedReportFiles, RepoReport } from "./types.js";

export interface BaselineSaveOptions {
  root: string;
  outDir: string;
  name: string;
}

export async function runBaselineSave(options: BaselineSaveOptions): Promise<{
  report: RepoReport;
  files: GeneratedReportFiles;
  baselinePath: string;
}> {
  const safeName = normalizeBaselineName(options.name);
  const rootAbsolute = resolve(options.root);
  const outDirAbsolute = resolve(rootAbsolute, options.outDir);
  const baselinePath = join(outDirAbsolute, "baselines", `${safeName}.json`);

  if (!isPathInsideRoot(rootAbsolute, baselinePath)) {
    throw new Error("Baseline path must be inside the selected root folder.");
  }

  const result = await runScan({
    root: rootAbsolute,
    outDir: options.outDir,
    format: "all",
    verbose: false,
  });

  await writeText(baselinePath, `${JSON.stringify(result.report, null, 2)}\n`);

  return {
    report: result.report,
    files: result.files,
    baselinePath,
  };
}

export function baselinePathFor(
  root: string,
  outDir: string,
  name: string,
): string {
  return join(
    resolve(root, outDir),
    "baselines",
    `${normalizeBaselineName(name)}.json`,
  );
}

function normalizeBaselineName(name: string): string {
  const trimmed = name.trim();
  if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) {
    throw new Error(
      "Baseline name may contain only letters, numbers, dots, underscores, and dashes.",
    );
  }

  return basename(trimmed, ".json");
}

function isPathInsideRoot(root: string, target: string): boolean {
  const pathFromRoot = relative(root, target);
  return (
    pathFromRoot !== "" &&
    !pathFromRoot.startsWith("..") &&
    !isAbsolute(pathFromRoot)
  );
}
