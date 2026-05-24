import { describe, expect, it } from "vitest";
import { defaultIgnores } from "../src/utils/ignore.js";

describe("defaultIgnores", () => {
  it("ignores common generated files and output folders", () => {
    const ignores = defaultIgnores(".forgelens");

    expect(ignores).toContain("**/public/workbox-*.js");
    expect(ignores).toContain("**/__generated__/**");
    expect(ignores).toContain("**/*.generated.*");
    expect(ignores).toContain(".forgelens/**");
  });
});
