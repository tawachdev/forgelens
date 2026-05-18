import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scanRepo } from "../src/scan.js";

function fixturePath(name: string): string {
  return join(process.cwd(), "tests/fixtures/stacks", name);
}

describe("provider detection", () => {
  it("detects prisma with confidence and evidence", async () => {
    const report = await scanRepo(fixturePath("prisma"), ".forgelens");

    const prisma = report.database.providers.find((provider) => provider.name === "prisma");
    expect(prisma).toBeDefined();
    expect(prisma?.confidence).toBe("high");
    expect((prisma?.evidenceFiles.length ?? 0) > 0).toBe(true);
    expect(report.auth.providers.some((provider) => provider.name === "unknown")).toBe(true);
  });

  it("detects drizzle and postgres client", async () => {
    const report = await scanRepo(fixturePath("drizzle"), ".forgelens");

    expect(report.database.providers.some((provider) => provider.name === "drizzle")).toBe(true);
    expect(report.database.providers.some((provider) => provider.name === "postgres-client")).toBe(true);
  });

  it("detects auth providers across stacks", async () => {
    const clerk = await scanRepo(fixturePath("clerk"), ".forgelens");
    const nextAuth = await scanRepo(fixturePath("nextauth"), ".forgelens");
    const firebase = await scanRepo(fixturePath("firebase"), ".forgelens");
    const jwt = await scanRepo(fixturePath("jwt-session"), ".forgelens");

    expect(clerk.auth.providers.some((provider) => provider.name === "clerk")).toBe(true);
    expect(nextAuth.auth.providers.some((provider) => provider.name === "nextauth-authjs")).toBe(true);
    expect(firebase.auth.providers.some((provider) => provider.name === "firebase-auth")).toBe(true);
    expect(jwt.auth.providers.some((provider) => provider.name === "jwt-custom-auth")).toBe(true);
    expect(jwt.auth.providers.some((provider) => provider.name === "cookie-session-custom-auth")).toBe(true);
  });

  it("uses unknown/custom fallback when auth evidence is weak", async () => {
    const report = await scanRepo(join(process.cwd(), "tests/fixtures/next-app"), ".forgelens");
    expect(
      report.auth.providers.some((provider) =>
        ["custom-auth", "unknown", "supabase-auth", "nextauth-authjs"].includes(provider.name)
      )
    ).toBe(true);
  });

  it("includes confidence for all detected providers", async () => {
    const report = await scanRepo(fixturePath("clerk"), ".forgelens");

    for (const provider of report.auth.providers) {
      expect(["high", "medium", "low"]).toContain(provider.confidence);
    }
    for (const provider of report.database.providers) {
      expect(["high", "medium", "low"]).toContain(provider.confidence);
    }
  });
});
