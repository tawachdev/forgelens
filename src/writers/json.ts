import { join } from "node:path";
import { writeText } from "../utils/fs.js";
import type { GeneratedReportFiles, RepoReport } from "../types.js";

export async function writeJsonReport(
  report: RepoReport,
  outDirAbsolute: string
): Promise<GeneratedReportFiles> {
  const files: GeneratedReportFiles = {
    REPO_REPORT_JSON: join(outDirAbsolute, "REPO_REPORT.json")
  };

  await writeText(files.REPO_REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`);

  return files;
}
