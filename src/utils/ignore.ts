const DEFAULT_IGNORED_DIRS = [
  "node_modules",
  ".next",
  "dist",
  "build",
  ".git",
  "coverage",
  "vendor",
  "generated"
];

const DEFAULT_IGNORED_PATTERNS = ["tests/fixtures/**", "**/tests/fixtures/**"];

export function defaultIgnores(outDir: string): string[] {
  const normalizedOutDir = normalizeOutDir(outDir);
  const core = DEFAULT_IGNORED_DIRS.flatMap((dir) => [
    `${dir}/**`,
    `**/${dir}/**`
  ]);

  return normalizedOutDir
    ? [...core, ...DEFAULT_IGNORED_PATTERNS, `${normalizedOutDir}/**`, `**/${normalizedOutDir}/**`]
    : [...core, ...DEFAULT_IGNORED_PATTERNS];
}

function normalizeOutDir(outDir: string): string {
  const trimmed = outDir.replace(/^\.\//, "").replace(/\\/g, "/");
  return trimmed.replace(/^\/+|\/+$/g, "");
}
