import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The Edge Function evaluates alerts with a generated copy of the domain service. Keep them identical.
describe("alert rules shared with the Edge Function", () => {
  it("supabase/functions/_shared/rules.ts matches src/domain/services/alert-rules.ts (run `npm run sync:shared`)", () => {
    const domain = readFileSync("src/domain/services/alert-rules.ts", "utf8");
    const shared = readFileSync("supabase/functions/_shared/rules.ts", "utf8");
    expect(shared.endsWith(domain)).toBe(true);
  });
  it("the domain service stays import-free so it can run in Deno", () => {
    expect(readFileSync("src/domain/services/alert-rules.ts", "utf8")).not.toMatch(/^\s*import\s/m);
  });
});
