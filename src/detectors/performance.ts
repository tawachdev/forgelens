import { stat } from "node:fs/promises";
import { join } from "node:path";
import fg from "fast-glob";
import { readTextIfExists } from "../utils/fs.js";
import { defaultIgnores } from "../utils/ignore.js";
import type { PerformanceRiskInfo } from "../types.js";

const CODE_FILES = "**/*.@(ts|tsx|js|jsx)";
const LARGE_FILE_BYTES = 24_000;

export async function detectPerformanceRisks(
  root: string,
  outDir: string,
): Promise<PerformanceRiskInfo> {
  const ignore = defaultIgnores(outDir);
  const files = await fg([CODE_FILES], { cwd: root, ignore });
  const indexed = await indexFiles(root, files);

  const largeFiles = await findLargeFiles(root, files);
  const clientComponentFiles = matchingFiles(
    indexed,
    /^\s*["']use client["'];?/m,
  );
  const imageUsageFiles = matchingFiles(
    indexed,
    /<Image\b|next\/image|<img\b/i,
  );
  const rawImageFiles = matchingFiles(indexed, /<img\b/i);
  const fetchFiles = matchingFiles(indexed, /\bfetch\(/);
  const uncachedFetchFiles = matchingFiles(
    indexed,
    /\bfetch\((?![\s\S]{0,180}(cache|revalidate))/,
  );
  const externalApiFiles = matchingFiles(
    indexed,
    /axios\.|fetch\(['"]https?:\/\//i,
  );

  return {
    largeFiles,
    clientComponentFiles,
    imageUsageFiles,
    rawImageFiles,
    fetchFiles,
    uncachedFetchFiles,
    externalApiFiles,
    notes: buildNotes(
      largeFiles,
      clientComponentFiles,
      rawImageFiles,
      uncachedFetchFiles,
      externalApiFiles,
    ),
  };
}

async function indexFiles(
  root: string,
  files: string[],
): Promise<Array<{ file: string; text: string }>> {
  const indexed: Array<{ file: string; text: string }> = [];

  for (const file of files) {
    const text = await readTextIfExists(join(root, file));
    if (!text) {
      continue;
    }
    indexed.push({ file, text });
  }

  return indexed;
}

async function findLargeFiles(
  root: string,
  files: string[],
): Promise<string[]> {
  const largeFiles: string[] = [];

  for (const file of files) {
    const fileStat = await stat(join(root, file));
    if (fileStat.size >= LARGE_FILE_BYTES) {
      largeFiles.push(file);
    }
  }

  return uniqueSorted(largeFiles);
}

function matchingFiles(
  indexed: Array<{ file: string; text: string }>,
  pattern: RegExp,
): string[] {
  return uniqueSorted(
    indexed
      .filter((entry) => pattern.test(entry.text))
      .map((entry) => entry.file),
  );
}

function buildNotes(
  largeFiles: string[],
  clientComponentFiles: string[],
  rawImageFiles: string[],
  uncachedFetchFiles: string[],
  externalApiFiles: string[],
): string[] {
  const notes = [`large file threshold: ${LARGE_FILE_BYTES} bytes`];

  if (largeFiles.length > 0) {
    notes.push("large code files detected");
  }
  if (clientComponentFiles.length > 0) {
    notes.push("client components detected; review bundle impact");
  }
  if (rawImageFiles.length > 0) {
    notes.push("raw img usage detected; review image optimization");
  }
  if (uncachedFetchFiles.length > 0) {
    notes.push("fetch calls without nearby cache/revalidate hints detected");
  }
  if (externalApiFiles.length > 0) {
    notes.push("external API calls detected; review timeout/error handling");
  }

  return notes;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}
