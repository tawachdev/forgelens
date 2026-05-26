import fg from "fast-glob";
import { join } from "node:path";
import { readTextIfExists } from "../utils/fs.js";
import { defaultIgnores } from "../utils/ignore.js";
import type { UiUxInfo } from "../types.js";

const UI_FILE_GLOBS = [
  "app/**/*.@(tsx|jsx)",
  "src/app/**/*.@(tsx|jsx)",
  "pages/**/*.@(tsx|jsx)",
  "src/pages/**/*.@(tsx|jsx)",
  "components/**/*.@(tsx|jsx)",
  "src/components/**/*.@(tsx|jsx)",
];

export async function detectUiUx(
  root: string,
  outDir: string,
): Promise<UiUxInfo> {
  const files = await fg(UI_FILE_GLOBS, {
    cwd: root,
    ignore: defaultIgnores(outDir),
  });
  const indexed = await indexFiles(root, files);

  const pageFiles = uniqueSorted(files.filter(isPageFile));
  const componentFiles = uniqueSorted(
    files.filter((file) => /(^|\/)components\//.test(file)),
  );
  const formFiles = matchingFiles(
    indexed,
    /<form\b|<input\b|<textarea\b|<select\b|useForm\(/i,
  );
  const loadingStateFiles = matchingFiles(
    indexed,
    /loading|spinner|skeleton|pending|isLoading/i,
  );
  const emptyStateFiles = matchingFiles(
    indexed,
    /empty|no results|not found|no data/i,
  );
  const errorStateFiles = matchingFiles(
    indexed,
    /error|try again|failed|notFound\(/i,
  );
  const responsiveFiles = matchingFiles(
    indexed,
    /(?:sm|md|lg|xl|2xl):|@media|\bcontainer\b/i,
  );
  const accessibilityRiskFiles = matchingFiles(
    indexed,
    /<img\b(?![^>]*\salt=)|<button\b(?![^>]*(aria-label|title|>))/i,
  );

  return {
    pageFiles,
    componentFiles,
    formFiles,
    loadingStateFiles,
    emptyStateFiles,
    errorStateFiles,
    responsiveFiles,
    accessibilityRiskFiles,
    notes: buildNotes(
      pageFiles,
      formFiles,
      loadingStateFiles,
      emptyStateFiles,
      errorStateFiles,
      responsiveFiles,
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

function isPageFile(file: string): boolean {
  return /(^|\/)(page|layout|loading|error|not-found)\.(tsx|jsx)$/.test(file);
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
  pageFiles: string[],
  formFiles: string[],
  loadingStateFiles: string[],
  emptyStateFiles: string[],
  errorStateFiles: string[],
  responsiveFiles: string[],
): string[] {
  const notes = [`UI files scanned: ${pageFiles.length} pages/layout states`];

  if (formFiles.length > 0 && errorStateFiles.length === 0) {
    notes.push("forms detected but no obvious error state text found");
  }
  if (pageFiles.length > 0 && loadingStateFiles.length === 0) {
    notes.push("no obvious loading states detected");
  }
  if (pageFiles.length > 0 && emptyStateFiles.length === 0) {
    notes.push("no obvious empty states detected");
  }
  if (pageFiles.length > 0 && responsiveFiles.length === 0) {
    notes.push("no obvious responsive class or media-query signals detected");
  }

  return notes;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}
