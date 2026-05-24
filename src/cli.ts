#!/usr/bin/env node

import { Command } from "commander";
import { resolve } from "node:path";
import { baselinePathFor, runBaselineSave } from "./baseline.js";
import { runClean } from "./clean.js";
import { inspectRepoSafety, renderDoctorReport } from "./doctor.js";
import { renderDriftReport, runDrift, runGitDrift } from "./drift.js";
import { buildCodexPrompt } from "./prompt.js";
import { runScan } from "./scan.js";
import type { OutputFormat, ScanOptions } from "./types.js";

const program = new Command();

program
  .name("forgelens")
  .description("Local-first CLI for repo context scanning for AI coding agents")
  .version("0.1.0");

program
  .command("scan")
  .description("Scan a repository and generate context markdown files")
  .option("--out <path>", "output folder (inside root)", ".forgelens")
  .option("--root <path>", "repository root path", ".")
  .option("--format <format>", "output format (markdown, json, all)", "markdown")
  .option("--verbose", "print scan details", false)
  .addHelpText(
    "after",
    "\nExamples:\n  forgelens scan\n  forgelens scan --root . --out .forgelens --verbose\n  forgelens scan --format all"
  )
  .action(async (cmdOptions: { out: string; root: string; format: string; verbose: boolean }) => {
    const options: ScanOptions = {
      outDir: cmdOptions.out,
      root: cmdOptions.root,
      format: cmdOptions.format as OutputFormat,
      verbose: Boolean(cmdOptions.verbose)
    };

    try {
      const result = await runScan(options);

      if (options.verbose) {
        console.log(`Root: ${result.report.root}`);
        console.log(`Routes found: ${result.report.routes.length}`);
        console.log(`Server actions found: ${result.report.serverActions.count}`);
      }

      console.log(`ForgeLens scan complete: ${result.outDirAbsolute}`);
      for (const [name, filePath] of Object.entries(result.files)) {
        console.log(`- ${name}: ${filePath}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`ForgeLens scan failed: ${message}`);
      process.exitCode = 1;
    }
  });

program
  .command("doctor")
  .description("Check scan safety/readiness without writing any files")
  .option("--root <path>", "repository root path", ".")
  .option("--out <path>", "output folder that scan would use", ".forgelens")
  .addHelpText("after", "\nExample:\n  forgelens doctor --root . --out .forgelens")
  .action(async (cmdOptions: { root: string; out: string }) => {
    try {
      const report = await inspectRepoSafety({
        root: cmdOptions.root,
        outDir: cmdOptions.out
      });
      console.log(renderDoctorReport(report));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`ForgeLens doctor failed: ${message}`);
      process.exitCode = 1;
    }
  });

program
  .command("clean")
  .description("Remove only generated output folder")
  .option("--root <path>", "repository root path", ".")
  .option("--out <path>", "output folder to remove", ".forgelens")
  .option("--yes", "skip confirmation prompt", false)
  .addHelpText("after", "\nExample:\n  forgelens clean --out .forgelens --yes")
  .action(async (cmdOptions: { root: string; out: string; yes: boolean }) => {
    try {
      await runClean({
        root: cmdOptions.root,
        outDir: cmdOptions.out,
        yes: Boolean(cmdOptions.yes)
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`ForgeLens clean failed: ${message}`);
      process.exitCode = 1;
    }
  });

const baselineCommand = program
  .command("baseline")
  .description("Save and manage ForgeLens baseline reports")
  .addHelpText("after", "\nExample:\n  forgelens baseline save --name main");

baselineCommand
  .command("save")
  .description("Scan and save a named baseline report")
  .option("--root <path>", "repository root path", ".")
  .option("--out <path>", "context output folder", ".forgelens")
  .option("--name <name>", "baseline name", "latest")
  .action(async (cmdOptions: { root: string; out: string; name: string }) => {
    try {
      const result = await runBaselineSave({
        root: cmdOptions.root,
        outDir: cmdOptions.out,
        name: cmdOptions.name
      });

      console.log(`ForgeLens baseline saved: ${result.baselinePath}`);
      console.log(`Routes found: ${result.report.routes.length}`);
      console.log(`Server actions found: ${result.report.serverActions.count}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`ForgeLens baseline failed: ${message}`);
      process.exitCode = 1;
    }
  });

program
  .command("drift")
  .description("Compare two ForgeLens JSON reports and flag risky context drift")
  .option("--baseline <path>", "older .forgelens/REPO_REPORT.json path")
  .option("--current <path>", "newer .forgelens/REPO_REPORT.json path")
  .option("--from <name>", "named baseline from the output folder")
  .option("--git <range>", "compare git refs, for example main..HEAD")
  .option("--root <path>", "repository root path for --from or --git", ".")
  .option("--out <path>", "optional output folder for DRIFT_REPORT files")
  .addHelpText(
    "after",
    "\nExamples:\n  forgelens drift --baseline .forgelens/baseline.json --current .forgelens/REPO_REPORT.json --out .forgelens\n  forgelens drift --from latest --out .forgelens\n  forgelens drift --git main..HEAD --out .forgelens"
  )
  .action(async (cmdOptions: {
    baseline?: string;
    current?: string;
    from?: string;
    git?: string;
    root: string;
    out?: string;
  }) => {
    try {
      let result: Awaited<ReturnType<typeof runDrift>>;

      if (cmdOptions.git) {
        result = await runGitDrift({
          root: cmdOptions.root,
          range: cmdOptions.git,
          outDir: cmdOptions.out ? resolve(cmdOptions.root, cmdOptions.out) : undefined
        });
      } else if (cmdOptions.from) {
        const outDir = cmdOptions.out ?? ".forgelens";
        const scanResult = await runScan({
          root: cmdOptions.root,
          outDir,
          format: "all",
          verbose: false
        });

        result = await runDrift({
          baseline: baselinePathFor(cmdOptions.root, outDir, cmdOptions.from),
          current: scanResult.files.REPO_REPORT_JSON,
          outDir: resolve(cmdOptions.root, outDir)
        });
      } else {
        if (!cmdOptions.baseline || !cmdOptions.current) {
          throw new Error("Provide --baseline and --current, or use --from, or use --git.");
        }

        result = await runDrift({
          baseline: cmdOptions.baseline,
          current: cmdOptions.current,
          outDir: cmdOptions.out
        });
      }

      console.log(renderDriftReport(result.report));
      if (Object.keys(result.files).length > 0) {
        console.log("");
        console.log("ForgeLens drift files written:");
        for (const [name, filePath] of Object.entries(result.files)) {
          console.log(`- ${name}: ${filePath}`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`ForgeLens drift failed: ${message}`);
      process.exitCode = 1;
    }
  });

const promptCommand = program
  .command("prompt")
  .description("Print copy-ready prompts for AI coding agents")
  .addHelpText("after", "\nExample:\n  forgelens prompt codex");

promptCommand
  .command("codex")
  .description("Print prompt text for Codex using ForgeLens context files")
  .option("--out <path>", "context folder path", ".forgelens")
  .action((cmdOptions: { out: string }) => {
    console.log(buildCodexPrompt(cmdOptions.out));
  });

void program.parseAsync(process.argv);
