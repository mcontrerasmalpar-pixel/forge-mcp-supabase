import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const cases = JSON.parse(readFileSync(resolve("evals/cases.json"), "utf8"));

function pickTool(prompt) {
  const p = prompt.toLowerCase();
  if (p.includes("drop") || p.includes("cuántos") || p.includes("cuantos")) return "run_readonly_sql";
  if (p.includes("plan") || p.includes("explica")) return "explain_query";
  if (p.includes("rls") && p.includes("propón")) return "propose_rls";
  if (p.includes("polític") || p.includes("politic") || p.includes("rls")) return "list_policies";
  if (p.includes("tabla") || p.includes("columna")) return "list_tables";
  return "unknown";
}

let failed = 0;
for (const c of cases) {
  const tool = pickTool(c.prompt);
  const ok = tool === c.expectedTool;
  if (!ok) failed += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.id}  expected=${c.expectedTool} got=${tool}`);
}

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log(`\n${cases.length} cases passed (router smoke test)`);
console.log("Wire this to the live MCP + LLM for full tool-choice evals.");
