export function buildCodexPrompt(outDir = ".forgelens"): string {
  return `Use \`${outDir}/AI_COMPACT_CONTEXT.md\` first when context is tight. Then use \`${outDir}/AI_FOCUS_MAP.md\`, \`${outDir}/FORGE_CONTEXT.md\`, \`${outDir}/ARCHITECTURE_MAP.md\`, \`${outDir}/SECURITY_RULES.md\`, \`${outDir}/ENV_REPORT.md\`, \`${outDir}/UI_UX_REPORT.md\`, \`${outDir}/PERFORMANCE_RISK_REPORT.md\`, and \`${outDir}/RISK_REPORT.md\` as repo context before editing. If available, use \`${outDir}/REPO_REPORT.json\` for tool-readable data.`;
}
