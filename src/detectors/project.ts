import { access } from "node:fs/promises";
import { join } from "node:path";
import { readJsonIfExists } from "../utils/fs.js";
import type { ProjectInfo } from "../types.js";

interface PackageJson {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export async function detectProject(root: string): Promise<ProjectInfo> {
  const packageJsonPath = join(root, "package.json");
  const pkg = await readJsonIfExists<PackageJson>(packageJsonPath);

  const dependencies = Object.keys(pkg?.dependencies ?? {}).sort();
  const devDependencies = Object.keys(pkg?.devDependencies ?? {}).sort();
  const allDeps = new Set([...dependencies, ...devDependencies]);

  const framework: ProjectInfo["framework"] = allDeps.has("next")
    ? "nextjs"
    : allDeps.has("vite")
      ? "vite"
      : "unknown";

  const language = (await fileExists(join(root, "tsconfig.json")))
    ? "typescript"
    : "javascript";

  const packageManager = await detectPackageManager(root);

  return {
    framework,
    language,
    packageManager,
    scripts: pkg?.scripts ?? {},
    dependencies,
    devDependencies,
  };
}

async function detectPackageManager(
  root: string,
): Promise<ProjectInfo["packageManager"]> {
  if (await fileExists(join(root, "pnpm-lock.yaml"))) {
    return "pnpm";
  }
  if (await fileExists(join(root, "yarn.lock"))) {
    return "yarn";
  }
  if (await fileExists(join(root, "bun.lockb"))) {
    return "bun";
  }
  if (await fileExists(join(root, "package-lock.json"))) {
    return "npm";
  }

  return "unknown";
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
