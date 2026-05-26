import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

const execFileAsync = promisify(execFile);
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

async function runNpmExec(args, cwd) {
  const { stdout, stderr } = await execFileAsync(npmCmd, args, { cwd });
  if (stdout) {
    process.stdout.write(stdout);
  }
  if (stderr) {
    process.stderr.write(stderr);
  }
}

async function runBinary(binPath, args) {
  const { stdout, stderr } = await execFileAsync(binPath, args);
  if (stdout) {
    process.stdout.write(stdout);
  }
  if (stderr) {
    process.stderr.write(stderr);
  }
  return stdout ?? "";
}

async function main() {
  const rootPackage = JSON.parse(await readFile("package.json", "utf8"));
  const expectedVersion = rootPackage?.version;
  if (typeof expectedVersion !== "string" || expectedVersion.length === 0) {
    throw new Error("Could not read package version for smoke assertion");
  }

  const packRaw = await readFile("npm-pack.json", "utf8");
  const pack = JSON.parse(packRaw);
  const tarball = pack?.[0]?.filename;

  if (typeof tarball !== "string" || tarball.length === 0) {
    throw new Error("npm pack output did not include a tarball filename");
  }

  const tarballPath = resolve(tarball);
  const smokeRoot = await mkdtemp(join(tmpdir(), "forgelens-npm-smoke-"));

  try {
    await runNpmExec(["init", "-y"], smokeRoot);
    await runNpmExec(["install", "--no-save", tarballPath], smokeRoot);

    const binName = process.platform === "win32" ? "forgelens.cmd" : "forgelens";
    const binPath = join(smokeRoot, "node_modules", ".bin", binName);

    const versionOutput = (await runBinary(binPath, ["--version"])).trim();
    if (versionOutput !== expectedVersion) {
      throw new Error(`Expected tarball CLI version ${expectedVersion}, got ${versionOutput}`);
    }

    const fixtureRoot = join("tests", "fixtures", "next-app");
    const outDir = ".tmp/ci-smoke";
    await rm(join(fixtureRoot, outDir), { recursive: true, force: true });

    await runBinary(binPath, [
      "scan",
      "--root",
      fixtureRoot,
      "--out",
      outDir,
      "--format",
      "json"
    ]);

    await access(join(fixtureRoot, outDir, "REPO_REPORT.json"));
  } finally {
    await rm(smokeRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Tarball smoke test failed: ${message}`);
  process.exitCode = 1;
});
