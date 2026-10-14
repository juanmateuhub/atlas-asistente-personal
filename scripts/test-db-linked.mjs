// Runs supabase/tests/*.test.sql (pgTAP) against the linked Supabase project
// without Docker. `supabase test db --linked` needs Docker for pg_prove, so instead:
//   1. each assertion appends its TAP line to a transaction-local setting;
//   2. the final `rollback;` becomes a RAISE carrying the TAP output.
// The error aborts the explicit transaction, so nothing the test wrote persists.
// Assumes the test file style used here: assertions start at column 0 with
// `select <fn>(` and multi-line ones close with a line containing only `);`.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TEST_DIR = "supabase/tests";
const ASSERT = /^select (plan|ok|is|isnt|is_empty|lives_ok|throws_ok)\(/;
const APPEND = "select set_config('tap.out', coalesce(current_setting('tap.out', true), '') || ";
const END = ") || E'\\n', true);";

function toRunner(sql) {
  const out = [];
  let open = false;
  for (const line of sql.split(/\r?\n/)) {
    if (ASSERT.test(line)) {
      const replaced = line.replace(/^select /, APPEND);
      open = !line.endsWith(");");
      out.push(open ? replaced : replaced.replace(/\);$/, END));
    } else if (open && line === ");") {
      out.push(END);
      open = false;
    } else if (line === "select * from finish();") {
      out.push(`${APPEND}coalesce((select string_agg(f, E'\\n') from finish() f), ''), true);`);
    } else if (line === "rollback;") {
      out.push("do $$ begin raise exception 'TAP-RESULT%', E'\\n' || current_setting('tap.out'); end $$;");
    } else {
      out.push(line);
    }
  }
  if (!out[1]?.startsWith("begin") || !out.some((l) => l.includes("TAP-RESULT"))) {
    throw new Error("Test file must start with `begin;` and end with `rollback;`");
  }
  return out.join("\n");
}

const files = readdirSync(TEST_DIR).filter((f) => f.endsWith(".test.sql"));
const dir = mkdtempSync(join(tmpdir(), "atlas-pgtap-"));
let failed = false;

for (const file of files) {
  const runner = join(dir, file);
  writeFileSync(runner, toRunner(readFileSync(join(TEST_DIR, file), "utf8")));
  let output = "";
  try {
    output = execFileSync("npx", ["supabase", "db", "query", "--linked", "-f", runner], {
      encoding: "utf8",
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err) {
    output = `${err.stdout ?? ""}${err.stderr ?? ""}`;
  }
  const tap = output.match(/TAP-RESULT((?:\\\\n|\\n)[\s\S]*?)(?:\\\\n|\\n){2}CONTEXT/);
  console.log(`# ${file}`);
  if (!tap) {
    console.log(output.trim());
    failed = true;
    continue;
  }
  const lines = tap[1].split(/\\\\n|\\n/).filter(Boolean);
  console.log(lines.join("\n"));
  if (lines.some((l) => l.startsWith("not ok") || l.startsWith("# Looks like"))) failed = true;
}

process.exit(failed ? 1 : 0);
