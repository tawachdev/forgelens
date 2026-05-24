import fg from "fast-glob";
import { join } from "node:path";
import { readTextIfExists } from "../utils/fs.js";
import { defaultIgnores } from "../utils/ignore.js";
import type { ServerActionsInfo } from "../types.js";

const CODE_FILES = "**/*.@(ts|tsx|js|jsx)";

export async function detectServerActions(
  root: string,
  outDir: string
): Promise<ServerActionsInfo> {
  const ignore = defaultIgnores(outDir);
  const files = await fg([CODE_FILES], { cwd: root, ignore });

  const matched: string[] = [];

  for (const file of files) {
    const fullPath = join(root, file);
    const text = await readTextIfExists(fullPath);
    if (!text) {
      continue;
    }

    if (hasUseServerDirective(text)) {
      matched.push(file);
    }
  }

  const uniqueFiles = [...new Set(matched)].sort();

  return {
    count: uniqueFiles.length,
    files: uniqueFiles
  };
}

function hasUseServerDirective(text: string): boolean {
  return /^\s*(?:"use server"|'use server'|`use server`);?\s*$/m.test(text);
}
