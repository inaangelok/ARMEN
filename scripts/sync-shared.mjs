// Copies the domain's alert-rule service into the Supabase Edge Functions folder, so the browser
// and the server evaluate alerts with exactly the same code. Run after editing alert-rules.ts.
import { readFileSync, writeFileSync } from "node:fs";

const SRC = "src/domain/services/alert-rules.ts";
const DST = "supabase/functions/_shared/rules.ts";
export const BANNER = `// GENERATED from ${SRC} by \`npm run sync:shared\`. Do not edit here.\n\n`;

const code = readFileSync(SRC, "utf8");
if (/^\s*import\s/m.test(code)) throw new Error(`${SRC} must stay import-free so it can run in Deno`);
writeFileSync(DST, BANNER + code);
console.log(`synced ${SRC} -> ${DST}`);
