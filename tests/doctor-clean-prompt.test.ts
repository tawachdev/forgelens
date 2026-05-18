import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runClean } from "../src/clean.js";
import { inspectRepoSafety } from "../src/doctor.js";
import { buildCodexPrompt } from "../src/prompt.js";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe("doctor", () => {
  it("inspects repo without writing files", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgelens-doctor-"));

    try {
      await writeFile(
        join(root, "package.json"),
        JSON.stringify({ name: "tmp", dependencies: { next: "15.0.0" } })
      );
      await writeFile(join(root, ".env.example"), "DATABASE_URL=\n");

      const outPath = join(root, ".forgelens");
      expect(await exists(outPath)).toBe(false);

      const report = await inspectRepoSafety({ root, outDir: ".forgelens" });

      expect(report.rootExists).toBe(true);
      expect(report.packageJsonExists).toBe(true);
      expect(report.framework).toBe("nextjs");
      expect(report.envFiles).toContain(".env.example");
      expect(await exists(outPath)).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("clean", () => {
  it("removes only selected output folder", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgelens-clean-"));

    try {
      const outDir = join(root, ".forgelens");
      const keepDir = join(root, "src");
      const keepFile = join(keepDir, "keep.ts");
      const generatedFile = join(outDir, "FORGE_CONTEXT.md");

      await mkdir(outDir, { recursive: true });
      await mkdir(keepDir, { recursive: true });
      await writeFile(generatedFile, "generated");
      await writeFile(keepFile, "keep");

      const logs: string[] = [];
      const result = await runClean({
        root,
        outDir: ".forgelens",
        yes: true,
        logger: { log: (line: string) => logs.push(line) }
      });

      expect(result.removed).toBe(true);
      expect(logs.join("\n")).toContain("Planned removal:");
      expect(logs.join("\n")).toContain(generatedFile);
      expect(await exists(outDir)).toBe(false);
      expect(await exists(keepFile)).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("prompt codex", () => {
  it("returns useful prompt text", () => {
    const prompt = buildCodexPrompt();
    expect(prompt).toContain("FORGE_CONTEXT.md");
    expect(prompt).toContain("ARCHITECTURE_MAP.md");
    expect(prompt).toContain("SECURITY_RULES.md");
    expect(prompt).toContain("RISK_REPORT.md");
    expect(prompt.toLowerCase()).toContain("before editing");
  });
});
