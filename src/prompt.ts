export function buildCodexPrompt(outDir = ".forgelens"): string {
  return `Use \`${outDir}/FORGE_CONTEXT.md\`, \`${outDir}/ARCHITECTURE_MAP.md\`, \`${outDir}/SECURITY_RULES.md\`, and \`${outDir}/RISK_REPORT.md\` as repo context before editing.`;
}
