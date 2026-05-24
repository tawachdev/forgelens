import fg from "fast-glob";
import { join } from "node:path";
import { readTextIfExists } from "../utils/fs.js";
import { defaultIgnores } from "../utils/ignore.js";
import type { EnvSafetyInfo } from "../types.js";

const CODE_FILES = "**/*.@(ts|tsx|js|jsx|mjs|cjs)";
const PUBLIC_ENV_PREFIXES = ["NEXT_PUBLIC_", "PUBLIC_", "VITE_", "NUXT_PUBLIC_"];
const SECRET_KEY_PARTS = [
  "SECRET",
  "TOKEN",
  "PASSWORD",
  "PRIVATE",
  "SERVICE_ROLE",
  "DATABASE_URL",
  "WEBHOOK"
];

export async function detectEnvSafety(root: string, outDir: string): Promise<EnvSafetyInfo> {
  const ignore = defaultIgnores(outDir);
  const [envFiles, codeFiles] = await Promise.all([
    fg([".env*", "**/.env*"], { cwd: root, ignore, dot: true }),
    fg([CODE_FILES], { cwd: root, ignore })
  ]);

  const exampleFiles = envFiles.filter(isExampleEnvFile).sort();
  const exampleKeys = await collectExampleKeys(root, exampleFiles);
  const codeIndex = await indexCode(root, codeFiles);
  const referencedKeys = uniqueSorted(codeIndex.flatMap((entry) => extractReferencedEnvKeys(entry.text)));
  const missingExampleKeys = referencedKeys.filter((key) => !exampleKeys.includes(key));
  const publicRiskKeys = referencedKeys.filter((key) => isPublicEnvKey(key) && looksSecretLike(key));
  const serverSecretClientFiles = uniqueSorted(
    codeIndex
      .filter((entry) => isClientFile(entry.text))
      .filter((entry) =>
        extractReferencedEnvKeys(entry.text).some((key) => !isPublicEnvKey(key) && looksSecretLike(key))
      )
      .map((entry) => entry.file)
  );

  return {
    envFiles: uniqueSorted(envFiles),
    exampleFiles,
    referencedKeys,
    exampleKeys,
    missingExampleKeys,
    publicRiskKeys,
    serverSecretClientFiles,
    notes: buildEnvNotes(envFiles, exampleFiles, referencedKeys, missingExampleKeys, publicRiskKeys)
  };
}

async function collectExampleKeys(root: string, files: string[]): Promise<string[]> {
  const keys: string[] = [];

  for (const file of files) {
    const text = await readTextIfExists(join(root, file));
    if (!text) {
      continue;
    }
    keys.push(...extractEnvFileKeys(text));
  }

  return uniqueSorted(keys);
}

async function indexCode(root: string, files: string[]): Promise<Array<{ file: string; text: string }>> {
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

function extractEnvFileKeys(text: string): string[] {
  return uniqueSorted(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"))
      .map((line) => line.match(/^(?:export\s+)?([A-Z0-9_]+)\s*=/)?.[1])
      .filter((key): key is string => Boolean(key))
  );
}

function extractReferencedEnvKeys(text: string): string[] {
  const keys: string[] = [];
  const dotPattern = /process\.env\.([A-Z0-9_]+)/g;
  const bracketPattern = /process\.env\[['"]([A-Z0-9_]+)['"]\]/g;

  for (const match of text.matchAll(dotPattern)) {
    keys.push(match[1]);
  }
  for (const match of text.matchAll(bracketPattern)) {
    keys.push(match[1]);
  }

  return uniqueSorted(keys);
}

function isExampleEnvFile(file: string): boolean {
  const lower = file.toLowerCase();
  return lower.includes(".example") || lower.includes(".sample") || lower.endsWith(".env.template");
}

function isPublicEnvKey(key: string): boolean {
  return PUBLIC_ENV_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function looksSecretLike(key: string): boolean {
  return SECRET_KEY_PARTS.some((part) => key.includes(part));
}

function isClientFile(text: string): boolean {
  return /^\s*["']use client["'];?/m.test(text);
}

function buildEnvNotes(
  envFiles: string[],
  exampleFiles: string[],
  referencedKeys: string[],
  missingExampleKeys: string[],
  publicRiskKeys: string[]
): string[] {
  const notes = [
    `env files found: ${envFiles.length}`,
    `example env files found: ${exampleFiles.length}`,
    `process.env keys referenced: ${referencedKeys.length}`
  ];

  if (missingExampleKeys.length > 0) {
    notes.push("some referenced keys are missing from example env files");
  }
  if (publicRiskKeys.length > 0) {
    notes.push("public env keys with secret-like names require review");
  }

  return notes;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}
