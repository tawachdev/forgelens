import { readdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

export interface CleanOptions {
  root: string;
  outDir: string;
  yes: boolean;
  logger?: Pick<typeof console, "log">;
}

export async function runClean(options: CleanOptions): Promise<{
  targetPath: string;
  removed: boolean;
  planned: string[];
}> {
  const rootPath = resolve(options.root);
  const targetPath = resolve(rootPath, options.outDir);

  ensureSafeDeletePath(rootPath, targetPath);

  const planned = await listPathsToRemove(targetPath);

  const log = options.logger?.log ?? console.log;
  log(`Target output folder: ${targetPath}`);
  log("Planned removal:");
  if (planned.length === 0) {
    log("- (nothing; folder does not exist)");
    return { targetPath, removed: false, planned };
  }

  for (const item of planned) {
    log(`- ${item}`);
  }

  const confirmed = options.yes || (await askForConfirmation());
  if (!confirmed) {
    log("Clean canceled.");
    return { targetPath, removed: false, planned };
  }

  await rm(targetPath, { recursive: true, force: true });
  log("Clean complete.");

  return { targetPath, removed: true, planned };
}

export function ensureSafeDeletePath(rootPath: string, targetPath: string): void {
  if (targetPath === "/" || targetPath === rootPath) {
    throw new Error("Refusing to delete root path.");
  }

  if (!targetPath.startsWith(`${rootPath}/`)) {
    throw new Error("Refusing to delete outside the selected root folder.");
  }
}

async function listPathsToRemove(targetPath: string): Promise<string[]> {
  const exists = await pathExists(targetPath);
  if (!exists) {
    return [];
  }

  const items = [targetPath];
  await walk(targetPath, items);
  return items;
}

async function walk(path: string, items: string[]): Promise<void> {
  const entries = await readdir(path, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = `${path}/${entry.name}`;
    items.push(fullPath);
    if (entry.isDirectory()) {
      await walk(fullPath, items);
    }
  }
}

async function askForConfirmation(): Promise<boolean> {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question("Confirm clean? Type 'yes' to continue: ");
    return answer.trim().toLowerCase() === "yes";
  } finally {
    rl.close();
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await readdir(path);
    return true;
  } catch {
    return false;
  }
}
