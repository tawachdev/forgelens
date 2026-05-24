import fg from "fast-glob";
import { join } from "node:path";
import { readTextIfExists } from "../utils/fs.js";
import { defaultIgnores } from "../utils/ignore.js";
import type { SecurityInfo } from "../types.js";

export async function detectSecurity(root: string, outDir: string): Promise<SecurityInfo> {
  const ignore = defaultIgnores(outDir);

  const [envFiles, middlewareFiles, codeFiles] = await Promise.all([
    fg([".env*", "**/.env*"], { cwd: root, ignore }),
    fg(["middleware.@(ts|tsx|js|jsx)", "src/middleware.@(ts|tsx|js|jsx)"], {
      cwd: root,
      ignore
    }),
    fg(["**/*.@(ts|tsx|js|jsx)"], { cwd: root, ignore })
  ]);

  const riskyFiles: string[] = [];
  const sensitiveFiles: string[] = [];
  let envUsageCount = 0;

  for (const file of codeFiles.filter(isEvidenceCodeFile)) {
    const text = await readTextIfExists(join(root, file));
    if (!text) {
      continue;
    }

    if (text.includes("process.env")) {
      envUsageCount += 1;
    }

    if (
      text.includes("eval(") ||
      text.includes("dangerouslySetInnerHTML") ||
      text.includes("child_process")
    ) {
      riskyFiles.push(file);
    }

    if (isSensitiveFile(file, text)) {
      sensitiveFiles.push(file);
    }
  }

  const notes: string[] = [];
  notes.push(`process.env usage files: ${envUsageCount}`);
  notes.push(
    middlewareFiles.length > 0
      ? "middleware detected"
      : "no middleware detected (unknown route protection coverage)"
  );

  if (envFiles.length === 0) {
    notes.push("no .env files detected");
  }
  if (sensitiveFiles.length > 0) {
    const sample = uniqueSorted(sensitiveFiles).slice(0, 8).join(", ");
    notes.push(`security-sensitive files detected: ${sample}`);
  }

  return {
    envFiles: uniqueSorted(envFiles),
    middlewareFiles: uniqueSorted(middlewareFiles),
    riskyFiles: uniqueSorted(riskyFiles),
    sensitiveFiles: uniqueSorted(sensitiveFiles),
    notes
  };
}

function isSensitiveFile(file: string, text: string): boolean {
  const lowerFile = file.toLowerCase();
  if (
    lowerFile.includes("admin") ||
    lowerFile.includes("auth") ||
    lowerFile.includes("middleware") ||
    lowerFile.includes("/actions.") ||
    lowerFile.includes("/api/")
  ) {
    return true;
  }

  if (text.includes("\"use server\"") || text.includes("'use server'")) {
    return true;
  }

  return false;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function isEvidenceCodeFile(file: string): boolean {
  return !/(^|\/)(tests?|__tests__|fixtures?)\/|\.test\.|\.spec\.|^src\/detectors\//.test(file);
}
