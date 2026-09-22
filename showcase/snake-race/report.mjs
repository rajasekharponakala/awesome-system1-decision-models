// Merges one or more bench.mjs --out directories into a single Markdown
// report (used by CI, where each lane runs in its own job).
//
//   node report.mjs results/jev results/laya > report.md

import fs from "node:fs";
import path from "node:path";

const runs = process.argv
  .slice(2)
  .map((dir) => path.join(dir, "results.json"))
  .filter((f) => fs.existsSync(f))
  .map((f) => ({ source: path.basename(path.dirname(f)), ...JSON.parse(fs.readFileSync(f, "utf8")) }));

if (!runs.length) {
  console.log("No benchmark results were produced.");
  process.exit(0);
}

const rows = runs.flatMap((r) => r.rows.map((row) => ({ ...row, runner: r.meta.runner || r.meta.platform })));
const cols = Object.keys(rows[0]).filter((c) => c !== "last error");
const esc = (v) => String(v ?? "–").replace(/\|/g, "\\|");
const lines = [
  `| ${cols.join(" | ")} |`,
  `| ${cols.map(() => "---").join(" | ")} |`,
  ...rows.map((r) => `| ${cols.map((c) => esc(r[c])).join(" | ")} |`),
  "",
];
const seeds = [...new Set(runs.map((r) => `${r.meta.positions} positions, seed ${r.meta.seed}, ${r.meta.warmup} warm-up`))];
lines.push(`Positions: ${seeds.join("; ")}. Every lane got byte-identical requests.`);
for (const r of rows.filter((r) => r["last error"])) lines.push("", `**${r.lane}** last error: \`${r["last error"]}\``);
console.log(lines.join("\n"));
