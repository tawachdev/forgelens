import fg from "fast-glob";
import { posix } from "node:path";
import { defaultIgnores } from "../utils/ignore.js";
import type { RouteItem } from "../types.js";

const APP_PAGE_GLOBS = [
  "app/**/page.@(ts|tsx|js|jsx|mdx)",
  "src/app/**/page.@(ts|tsx|js|jsx|mdx)",
];
const APP_API_GLOBS = [
  "app/**/route.@(ts|tsx|js|jsx)",
  "src/app/**/route.@(ts|tsx|js|jsx)",
];
const PAGES_API_GLOBS = [
  "pages/api/**/*.@(ts|tsx|js|jsx)",
  "src/pages/api/**/*.@(ts|tsx|js|jsx)",
];

export async function detectRoutes(
  root: string,
  outDir: string,
): Promise<RouteItem[]> {
  const ignore = defaultIgnores(outDir);

  const [appPages, appApiRoutes, pagesApiRoutes] = await Promise.all([
    fg(APP_PAGE_GLOBS, { cwd: root, ignore, dot: false }),
    fg(APP_API_GLOBS, { cwd: root, ignore, dot: false }),
    fg(PAGES_API_GLOBS, { cwd: root, ignore, dot: false }),
  ]);

  const pageItems = appPages.map((file) => ({
    kind: "page" as const,
    route: appPageToRoute(file),
    file,
    source: "app" as const,
  }));

  const appApiItems = appApiRoutes.map((file) => ({
    kind: "api" as const,
    route: appApiToRoute(file),
    file,
    source: "app" as const,
  }));

  const pagesApiItems = pagesApiRoutes.map((file) => ({
    kind: "api" as const,
    route: pagesApiToRoute(file),
    file,
    source: "pages" as const,
  }));

  return [...pageItems, ...appApiItems, ...pagesApiItems].sort((a, b) =>
    a.route.localeCompare(b.route),
  );
}

function appPageToRoute(file: string): string {
  const normalized = file.replace(/\\/g, "/");
  const rootRelative = stripPrefix(normalized, ["src/app/", "app/"]);
  const segments = rootRelative.split("/").slice(0, -1);

  const cleanSegments = segments
    .filter((segment) => !segment.startsWith("(") && !segment.endsWith(")"))
    .filter((segment) => !segment.startsWith("@"));

  if (cleanSegments.length === 0) {
    return "/";
  }

  return `/${cleanSegments.join("/")}`;
}

function appApiToRoute(file: string): string {
  const normalized = file.replace(/\\/g, "/");
  const noPrefix = stripPrefix(normalized, ["src/app/", "app/"]);
  const withoutFile = noPrefix.replace(/\/route\.[^.]+$/, "");
  return ensureLeadingSlash(withoutFile);
}

function pagesApiToRoute(file: string): string {
  const normalized = file.replace(/\\/g, "/");
  const noPrefix = stripPrefix(normalized, ["src/pages/", "pages/"]);
  const withoutExt = noPrefix.replace(/\.[^.]+$/, "");
  const withoutIndex = withoutExt.endsWith("/index")
    ? withoutExt.slice(0, -"/index".length)
    : withoutExt;

  return ensureLeadingSlash(posix.join(withoutIndex));
}

function ensureLeadingSlash(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

function stripPrefix(path: string, prefixes: string[]): string {
  for (const prefix of prefixes) {
    if (path.startsWith(prefix)) {
      return path.slice(prefix.length);
    }
  }

  return path;
}
