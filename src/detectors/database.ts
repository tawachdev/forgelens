import fg from "fast-glob";
import { join } from "node:path";
import { readJsonIfExists } from "../utils/fs.js";
import { defaultIgnores } from "../utils/ignore.js";
import type { DatabaseInfo, DetectionSignal } from "../types.js";

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export async function detectDatabase(
  root: string,
  outDir: string,
): Promise<DatabaseInfo> {
  const ignore = defaultIgnores(outDir);

  const [
    prismaFiles,
    drizzleFiles,
    typeOrmFiles,
    mongoFiles,
    firebaseFiles,
    supabaseFiles,
    sqlFiles,
    migrationFiles,
    dbClientFiles,
    pkg,
  ] = await Promise.all([
    fg(["prisma/**/*.prisma"], { cwd: root, ignore }),
    fg(
      [
        "drizzle/**/*",
        "drizzle.config.@(ts|js|mjs|cjs)",
        "db/drizzle/**/*",
        "db/schema.@(ts|tsx|js|jsx|mjs|cjs)",
        "src/db/schema.@(ts|tsx|js|jsx|mjs|cjs)",
        "server/db/schema.@(ts|tsx|js|jsx|mjs|cjs)",
        "lib/db/schema.@(ts|tsx|js|jsx|mjs|cjs)",
      ],
      {
        cwd: root,
        ignore,
      },
    ),
    fg(["ormconfig.@(ts|js|json)", "src/entity/**/*", "**/*.entity.@(ts|js)"], {
      cwd: root,
      ignore,
    }),
    fg(["**/*mongo*.@(ts|tsx|js|jsx)", "**/*mongoose*.@(ts|tsx|js|jsx)"], {
      cwd: root,
      ignore,
    }),
    fg(["**/*firebase*.@(ts|tsx|js|jsx)", "**/*firestore*.@(ts|tsx|js|jsx)"], {
      cwd: root,
      ignore,
    }),
    fg(["supabase/**/*", "**/*supabase*.@(ts|tsx|js|jsx)"], {
      cwd: root,
      ignore,
    }),
    fg(["**/*.sql"], { cwd: root, ignore }),
    fg(["**/migrations/**/*", "**/migration/**/*", "**/migrate/**/*"], {
      cwd: root,
      ignore,
    }),
    fg(
      [
        "**/*db*.@(ts|tsx|js|jsx)",
        "**/*database*.@(ts|tsx|js|jsx)",
        "**/lib/*sql*.@(ts|tsx|js|jsx)",
      ],
      {
        cwd: root,
        ignore,
      },
    ),
    readJsonIfExists<PackageJson>(join(root, "package.json")),
  ]);

  const filteredTypeOrmFiles = typeOrmFiles.filter(isEvidenceFile);
  const filteredMongoFiles = mongoFiles.filter(isEvidenceFile);
  const filteredFirebaseFiles = firebaseFiles.filter(isEvidenceFile);
  const filteredSupabaseFiles = supabaseFiles.filter(isEvidenceFile);
  const filteredDbClientFiles = dbClientFiles.filter(isEvidenceFile);

  const deps = new Set([
    ...Object.keys(pkg?.dependencies ?? {}),
    ...Object.keys(pkg?.devDependencies ?? {}),
  ]);

  const providers: DetectionSignal[] = [];

  addSignal(
    providers,
    "prisma",
    deps.has("prisma") || deps.has("@prisma/client"),
    prismaFiles,
    "Prisma dependency and schema files",
  );
  addSignal(
    providers,
    "drizzle",
    deps.has("drizzle-orm") || deps.has("drizzle-kit"),
    drizzleFiles,
    "Drizzle dependency and config/files",
  );
  addSignal(
    providers,
    "supabase",
    deps.has("@supabase/supabase-js"),
    filteredSupabaseFiles,
    "Supabase SDK and related files",
  );
  addSignal(
    providers,
    "typeorm",
    deps.has("typeorm"),
    filteredTypeOrmFiles,
    "TypeORM dependency and entity/config files",
  );
  addSignal(
    providers,
    "mongoose-mongodb",
    deps.has("mongoose") || deps.has("mongodb"),
    filteredMongoFiles,
    "MongoDB/Mongoose dependency and files",
  );
  addSignal(
    providers,
    "firebase-firestore",
    deps.has("firebase") ||
      deps.has("firebase-admin") ||
      deps.has("@google-cloud/firestore"),
    filteredFirebaseFiles,
    "Firebase/Firestore dependency and files",
  );
  addSignal(
    providers,
    "postgres-client",
    deps.has("pg") || deps.has("postgres") || deps.has("slonik"),
    filteredDbClientFiles.filter((f) => /postgres|pg/i.test(f)),
    "PostgreSQL client dependencies/files",
  );
  addSignal(
    providers,
    "mysql-client",
    deps.has("mysql") || deps.has("mysql2"),
    filteredDbClientFiles.filter((f) => /mysql/i.test(f)),
    "MySQL client dependencies/files",
  );
  addSignal(
    providers,
    "sqlite",
    deps.has("sqlite3") || deps.has("better-sqlite3"),
    filteredDbClientFiles.filter((f) => /sqlite/i.test(f)),
    "SQLite dependencies/files",
  );

  if (sqlFiles.length > 0 || migrationFiles.length > 0) {
    providers.push({
      name: "sql-migrations",
      confidence:
        sqlFiles.length > 0 && migrationFiles.length > 0 ? "high" : "medium",
      evidenceFiles: uniqueSorted([...sqlFiles, ...migrationFiles]).slice(
        0,
        12,
      ),
      notes: ["SQL files and migration-style paths detected"],
    });
  }

  const hasKnownProvider = providers.some(
    (provider) => provider.name !== "sql-migrations",
  );
  const customLayerFiles = filteredDbClientFiles.filter(
    (file) =>
      !/supabase|prisma|drizzle|typeorm|mongo|mongoose|firebase|firestore/i.test(
        file,
      ),
  );

  if (!hasKnownProvider && customLayerFiles.length > 0) {
    providers.push({
      name: "custom-database-layer",
      confidence: "low",
      evidenceFiles: uniqueSorted(customLayerFiles).slice(0, 12),
      notes: ["Database-like files found without strong provider signals"],
    });
  }

  if (providers.length === 0) {
    providers.push({
      name: "unknown",
      confidence: "low",
      evidenceFiles: [],
      notes: ["No clear database provider detected"],
    });
  }

  const schemaFiles = uniqueSorted([
    ...prismaFiles,
    ...sqlFiles.filter((file) => /schema|setup|init/i.test(file)),
  ]);

  return {
    providers: uniqueSignals(providers),
    files: uniqueSorted([
      ...prismaFiles,
      ...drizzleFiles,
      ...typeOrmFiles,
      ...mongoFiles,
      ...firebaseFiles,
      ...supabaseFiles,
      ...sqlFiles,
      ...migrationFiles,
      ...filteredDbClientFiles,
    ]),
    schemaFiles,
    migrations: uniqueSorted(migrationFiles),
    clientFiles: uniqueSorted(filteredDbClientFiles),
    notes: buildDatabaseNotes(uniqueSignals(providers)),
  };
}

function addSignal(
  target: DetectionSignal[],
  name: string,
  hasDependency: boolean,
  evidenceFiles: string[],
  note: string,
): void {
  const hasFiles = evidenceFiles.length > 0;
  if (!hasDependency && !hasFiles) {
    return;
  }

  let confidence: DetectionSignal["confidence"] = "low";
  if (hasDependency && hasFiles) {
    confidence = "high";
  } else if (hasDependency || hasFiles) {
    confidence = "medium";
  }

  target.push({
    name,
    confidence,
    evidenceFiles: uniqueSorted(evidenceFiles).slice(0, 12),
    notes: [note],
  });
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

function buildDatabaseNotes(providers: DetectionSignal[]): string[] {
  if (providers.length === 0) {
    return ["unknown"];
  }

  return providers.map(
    (provider) => `${provider.name}: ${provider.confidence} confidence`,
  );
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function isEvidenceFile(file: string): boolean {
  return !/(^|\/)(tests?|__tests__|fixtures?)\/|\.test\.|\.spec\.|^src\/detectors\//.test(
    file,
  );
}
