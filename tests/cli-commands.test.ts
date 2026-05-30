import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const cliPath = join(process.cwd(), "src/cli.ts");

describe("cli command names and aliases", () => {
  it("shows primary commands in top-level help", async () => {
    const { stdout } = await runCli(["--help"]);

    expect(stdout).toContain("scan [options]");
    expect(stdout).toContain("quick [options]");
    expect(stdout).toContain("ux|ui-ux [options]");
    expect(stdout).toContain("check|doctor [options]");
    expect(stdout).toContain("clear|clean [options]");
    expect(stdout).toContain("snapshot|baseline");
    expect(stdout).toContain("compare|drift [options]");
    expect(stdout).toContain("prompt [options]");
    expect(stdout).toContain("Daily flow:");
  });

  it("keeps compare and drift help equivalent", async () => {
    const compareHelp = await runCli(["compare", "--help"]);
    const driftHelp = await runCli(["drift", "--help"]);

    expect(compareHelp.stdout).toContain(
      "Compare reports and flag risky context drift",
    );
    expect(driftHelp.stdout).toContain(
      "Compare reports and flag risky context drift",
    );
  });

  it("keeps check and doctor help equivalent", async () => {
    const checkHelp = await runCli(["check", "--help"]);
    const doctorHelp = await runCli(["doctor", "--help"]);

    expect(checkHelp.stdout).toContain(
      "Check scan safety/readiness without writing any files",
    );
    expect(doctorHelp.stdout).toContain(
      "Check scan safety/readiness without writing any files",
    );
  });

  it("keeps prompt codex legacy alias available", async () => {
    const { stdout } = await runCli(["prompt", "codex", "--help"]);
    expect(stdout).toContain("Legacy alias for prompt output");
  });
});

async function runCli(
  args: string[],
): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync("node", ["--import", "tsx", cliPath, ...args], {
    cwd: process.cwd(),
    env: process.env,
  });
}
