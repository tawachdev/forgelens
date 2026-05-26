const DEFAULT_IGNORED_DIRS = [
  "node_modules",
  ".next",
  "dist",
  "build",
  ".git",
  "coverage",
  "vendor",
  "generated",
];

const DEFAULT_IGNORED_PATTERNS = [
  "tests/fixtures/**",
  "**/tests/fixtures/**",
  "__generated__/**",
  "**/__generated__/**",
  "**/*.generated.*",
  "**/*.gen.*",
  "public/workbox-*.js",
  "**/public/workbox-*.js",
  "public/sw.js",
  "**/public/sw.js",
  "public/**/*.map",
  "**/public/**/*.map",
];

export function defaultIgnores(outDir: string): string[] {
  const normalizedOutDir = normalizeOutDir(outDir);
  const core = DEFAULT_IGNORED_DIRS.flatMap((dir) => [
    `${dir}/**`,
    `**/${dir}/**`,
  ]);

  return normalizedOutDir
    ? [
        ...core,
        ...DEFAULT_IGNORED_PATTERNS,
        `${normalizedOutDir}/**`,
        `**/${normalizedOutDir}/**`,
      ]
    : [...core, ...DEFAULT_IGNORED_PATTERNS];
}

function normalizeOutDir(outDir: string): string {
  const trimmed = outDir.replace(/^\.\//, "").replace(/\\/g, "/");
  return trimmed.replace(/^\/+|\/+$/g, "");
}
