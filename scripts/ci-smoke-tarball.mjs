import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

const execFileAsync = promisify(execFile);
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

async function runCommand(label, command, args, options = {}) {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, options);
    if (stdout) {
      process.stdout.write(stdout);
    }
    if (stderr) {
      process.stderr.write(stderr);
    }
    return stdout ?? "";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} failed: ${message}`);
  }
}

async function runNpmExec(args, cwd) {
  const stdout = await runCommand("npm", npmCmd, args, {
    cwd,
    shell: process.platform === "win32"
  });
  return stdout;
}

async function runNodeScript(scriptPath, args, cwd) {
  const stdout = await runCommand("node", process.execPath, [scriptPath, ...args], {
    cwd
  });
  return stdout;
}

async function writeSmokePackageJson(smokeRoot) {
  await writeFile(
    join(smokeRoot, "package.json"),
    `${JSON.stringify(
      {
        name: "forgelens-npm-smoke",
        version: "1.0.0",
        private: true
      },
      null,
      2
    )}\n`
  );
}

async function assertCliEntrypointExists(cliEntrypoint) {
  await access(cliEntrypoint);
}

async function assertReportExists(reportPath) {
  await access(reportPath);
}

async function readPackageVersion() {
  const rootPackage = JSON.parse(await readFile("package.json", "utf8"));
  const expectedVersion = rootPackage?.version;
  if (typeof expectedVersion !== "string" || expectedVersion.length === 0) {
    throw new Error("Could not read package version for smoke assertion");
  }
  return expectedVersion;
}

async function readPackedTarballPath() {
  const packRaw = await readFile("npm-pack.json", "utf8");
  const pack = JSON.parse(packRaw);
  const tarball = pack?.[0]?.filename;

  if (typeof tarball !== "string" || tarball.length === 0) {
    throw new Error("npm pack output did not include a tarball filename");
  }

  return resolve(tarball);
}

async function assertVersion(cliEntrypoint, expectedVersion) {
  const versionOutput = (await runNodeScript(cliEntrypoint, ["--version"], process.cwd())).trim();
  if (versionOutput !== expectedVersion) {
    throw new Error(`Expected tarball CLI version ${expectedVersion}, got ${versionOutput}`);
  }
}

async function runSmokeScan(cliEntrypoint) {
  const fixtureRoot = join("tests", "fixtures", "next-app");
  const outDir = ".tmp/ci-smoke";
  await rm(join(fixtureRoot, outDir), { recursive: true, force: true });

  await runNodeScript(
    cliEntrypoint,
    ["scan", "--root", fixtureRoot, "--out", outDir, "--format", "json"],
    process.cwd()
  );

  await assertReportExists(join(fixtureRoot, outDir, "REPO_REPORT.json"));
}

async function installPackedTarball(smokeRoot, tarballPath) {
  await writeSmokePackageJson(smokeRoot);
  await runNpmExec(["install", "--no-save", tarballPath], smokeRoot);
}

async function main() {
  const expectedVersion = await readPackageVersion();
  const tarballPath = await readPackedTarballPath();
  const smokeRoot = await mkdtemp(join(tmpdir(), "forgelens-npm-smoke-"));

  try {
    await installPackedTarball(smokeRoot, tarballPath);

    const cliEntrypoint = join(smokeRoot, "node_modules", "forgelens", "dist", "cli.js");
    await assertCliEntrypointExists(cliEntrypoint);
    await assertVersion(cliEntrypoint, expectedVersion);
    await runSmokeScan(cliEntrypoint);
  } finally {
    await rm(smokeRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Tarball smoke test failed: ${message}`);
  process.exitCode = 1;
});
