import fg from "fast-glob";
import { join } from "node:path";
import { readJsonIfExists, readTextIfExists } from "../utils/fs.js";
import { defaultIgnores } from "../utils/ignore.js";
import type { AuthInfo, DetectionSignal } from "../types.js";

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export async function detectAuth(
  root: string,
  outDir: string,
): Promise<AuthInfo> {
  const ignore = defaultIgnores(outDir);

  const [codeFiles, authFiles, middlewareFiles, envFiles, pkg] =
    await Promise.all([
      fg(["**/*.@(ts|tsx|js|jsx|mjs|cjs)"], { cwd: root, ignore }),
      fg(
        ["**/*auth*.@(ts|tsx|js|jsx|mjs|cjs)", "app/**/auth.@(ts|tsx|js|jsx)"],
        {
          cwd: root,
          ignore,
        },
      ),
      fg(["middleware.@(ts|tsx|js|jsx)", "src/middleware.@(ts|tsx|js|jsx)"], {
        cwd: root,
        ignore,
      }),
      fg([".env*", "**/.env*"], { cwd: root, ignore }),
      readJsonIfExists<PackageJson>(join(root, "package.json")),
    ]);

  const deps = new Set([
    ...Object.keys(pkg?.dependencies ?? {}),
    ...Object.keys(pkg?.devDependencies ?? {}),
  ]);

  const evidenceAuthFiles = authFiles.filter(isEvidenceCodeFile);
  const codeIndex = await indexCode(root, codeFiles.filter(isEvidenceCodeFile));
  const providers: DetectionSignal[] = [];

  pushProvider(
    providers,
    detectProvider(
      "clerk",
      deps.has("@clerk/nextjs"),
      findFiles(codeIndex, /@clerk\/|clerkMiddleware|currentUser\(|auth\(\)/),
      "Clerk dependency or usage",
    ),
  );
  pushProvider(
    providers,
    detectProvider(
      "nextauth-authjs",
      deps.has("next-auth") ||
        deps.has("@auth/core") ||
        deps.has("@auth/nextjs"),
      findFiles(codeIndex, /next-auth|\bNextAuth\(|@auth\//),
      "Auth.js/NextAuth dependency or imports",
    ),
  );
  pushProvider(
    providers,
    detectProvider(
      "supabase-auth",
      deps.has("@supabase/supabase-js"),
      findFiles(
        codeIndex,
        /supabase\.auth|@supabase\/supabase-js|createServerClient|createBrowserClient/,
      ),
      "Supabase auth SDK usage",
    ),
  );
  pushProvider(
    providers,
    detectProvider(
      "firebase-auth",
      deps.has("firebase") ||
        deps.has("firebase-admin") ||
        deps.has("@google-cloud/firestore"),
      findFiles(codeIndex, /from ["']firebase\/auth|getAuth\(|admin\.auth\(/i),
      "Firebase auth SDK usage",
    ),
  );
  pushProvider(
    providers,
    detectProvider(
      "lucia",
      deps.has("lucia"),
      findFiles(codeIndex, /from ["']lucia|new Lucia\(/),
      "Lucia dependency or usage",
    ),
  );
  pushProvider(
    providers,
    detectProvider(
      "better-auth",
      deps.has("better-auth"),
      findFiles(codeIndex, /better-auth|betterAuth\(/),
      "Better Auth dependency or usage",
    ),
  );

  const jwtFiles = findFiles(
    codeIndex,
    /\bjwt\b|jsonwebtoken|jose|sign\(|verify\(/i,
  );
  if (jwtFiles.length > 0) {
    providers.push({
      name: "jwt-custom-auth",
      confidence:
        deps.has("jsonwebtoken") || deps.has("jose") ? "high" : "medium",
      evidenceFiles: jwtFiles.slice(0, 12),
      notes: ["JWT-like auth patterns detected"],
    });
  }

  const cookieSessionFiles = findFiles(
    codeIndex,
    /cookies\(|["']cookie["']|iron-session|next-session|getServerSession|sessionToken|createSession|verifySession/i,
  );
  if (cookieSessionFiles.length > 0) {
    providers.push({
      name: "cookie-session-custom-auth",
      confidence:
        deps.has("iron-session") || deps.has("next-session")
          ? "high"
          : "medium",
      evidenceFiles: cookieSessionFiles.slice(0, 12),
      notes: ["Cookie/session auth patterns detected"],
    });
  }

  if (middlewareFiles.length > 0) {
    providers.push({
      name: "middleware-based-auth",
      confidence: "medium",
      evidenceFiles: middlewareFiles.slice(0, 12),
      notes: ["Middleware files detected"],
    });
  }

  const mergedProviders = uniqueSignals(providers);
  const hasStrongProvider = mergedProviders.some(
    (provider) => provider.name !== "middleware-based-auth",
  );

  if (!hasStrongProvider && evidenceAuthFiles.length > 0) {
    mergedProviders.push({
      name: "custom-auth",
      confidence: "low",
      evidenceFiles: evidenceAuthFiles.slice(0, 12),
      notes: ["Auth-related files found without a clear provider"],
    });
  }

  if (mergedProviders.length === 0) {
    mergedProviders.push({
      name: "unknown",
      confidence: "low",
      evidenceFiles: [],
      notes: ["No auth provider signal detected"],
    });
  }

  return {
    providers: uniqueSignals(mergedProviders),
    files: uniqueSorted(evidenceAuthFiles),
    evidenceFiles: uniqueSorted([
      ...evidenceAuthFiles,
      ...middlewareFiles,
      ...envFiles,
      ...mergedProviders.flatMap((provider) => provider.evidenceFiles),
    ]),
    middlewareFiles: uniqueSorted(middlewareFiles),
    notes: uniqueSorted(mergedProviders.flatMap((provider) => provider.notes)),
  };
}

function detectProvider(
  name: string,
  dependencyMatched: boolean,
  evidenceFiles: string[],
  note: string,
): DetectionSignal | null {
  const hasEvidenceFiles = evidenceFiles.length > 0;
  if (!dependencyMatched && !hasEvidenceFiles) {
    return null;
  }

  let confidence: DetectionSignal["confidence"] = "low";
  if (dependencyMatched && hasEvidenceFiles) {
    confidence = "high";
  } else if (dependencyMatched || hasEvidenceFiles) {
    confidence = "medium";
  }

  return {
    name,
    confidence,
    evidenceFiles: evidenceFiles.slice(0, 12),
    notes: [note],
  };
}

function pushProvider(
  target: DetectionSignal[],
  signal: DetectionSignal | null,
): void {
  if (signal) {
    target.push(signal);
  }
}

async function indexCode(
  root: string,
  files: string[],
): Promise<Array<{ file: string; text: string }>> {
  const indexed: Array<{ file: string; text: string }> = [];

  for (const file of files) {
    const text = await readTextIfExists(join(root, file));
    if (!text) {
      continue;
    }
    indexed.push({ file, text });
  }

  return indexed;
}

function findFiles(
  index: Array<{ file: string; text: string }>,
  pattern: RegExp,
): string[] {
  return uniqueSorted(
    index
      .filter((entry) => pattern.test(entry.text) || pattern.test(entry.file))
      .map((entry) => entry.file),
  );
}

function isEvidenceCodeFile(file: string): boolean {
  return !/(^|\/)(tests?|__tests__|fixtures?)\/|\.test\.|\.spec\.|^src\/detectors\//.test(
    file,
  );
}

function uniqueSignals(signals: DetectionSignal[]): DetectionSignal[] {
  const map = new Map<string, DetectionSignal>();

  for (const signal of signals) {
    const existing = map.get(signal.name);
    if (!existing) {
      map.set(signal.name, signal);
      continue;
    }

    map.set(signal.name, {
      ...signal,
      confidence: maxConfidence(existing.confidence, signal.confidence),
      evidenceFiles: uniqueSorted([
        ...existing.evidenceFiles,
        ...signal.evidenceFiles,
      ]).slice(0, 12),
      notes: uniqueSorted([...existing.notes, ...signal.notes]),
    });
  }

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function maxConfidence(
  left: DetectionSignal["confidence"],
  right: DetectionSignal["confidence"],
): DetectionSignal["confidence"] {
  const rank = { low: 1, medium: 2, high: 3 } as const;
  return rank[left] >= rank[right] ? left : right;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}
