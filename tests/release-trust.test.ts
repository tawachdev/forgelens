import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("release trust checks", () => {
  it("keeps CLI version aligned with package version", async () => {
    const root = process.cwd();
    const [packageJsonText, cliText] = await Promise.all([
      readFile(join(root, "package.json"), "utf8"),
      readFile(join(root, "src/cli.ts"), "utf8"),
    ]);

    const packageVersion = JSON.parse(packageJsonText) as { version?: string };
    const versionMatch = cliText.match(/\.version\("([^"]+)"\)/);

    expect(packageVersion.version).toBeDefined();
    expect(versionMatch?.[1]).toBe(packageVersion.version);
  });

  it("documents heuristic/static limits explicitly in README", async () => {
    const readme = await readFile(join(process.cwd(), "README.md"), "utf8");
    expect(readme).toContain(
      "Security and auth findings are heuristic signals, not guarantees.",
    );
    expect(readme).toContain("No warning does not mean safe.");
    expect(readme).toContain(
      "Do not use ForgeLens as a security scanner or compliance gate.",
    );
  });
});
