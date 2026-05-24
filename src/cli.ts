#!/usr/bin/env node

import { Command } from "commander";
import { runClean } from "./clean.js";
import { inspectRepoSafety, renderDoctorReport } from "./doctor.js";
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
