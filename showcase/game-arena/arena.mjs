// Runs every arena game against one lane (or the two mock lanes) and writes
// results.json. Items are sent one at a time, after warm-up calls that are
// discarded, so latency is the time of one decision.
//
//   ARENA_URL=http://127.0.0.1:8000 ARENA_MODEL=english ARENA_LABEL="Laya english" \
//     node arena.mjs [--snake 60] [--flappy 40] [--seed 7] [--warmup 5] [--out dir]
//   node arena.mjs --mock            # harness test only; never report mock numbers
//
// --games snake,spam limits the run to some games.

import fs from "node:fs";
import path from "node:path";
import { GAMES } from "./games.mjs";
import { laneFromEnv, MOCK_LANES, decide } from "./lanes.mjs";
import { percentile } from "../snake-race/snake.mjs";

const argv = process.argv;
const arg = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? dflt : argv[i + 1];
};
const opts = { snakeN: Number(arg("snake", 60)), flappyN: Number(arg("flappy", 40)), seed: Number(arg("seed", 7)) };
const WARMUP = Number(arg("warmup", 5));
const OUT = arg("out", null);
const only = arg("games", null)?.split(",");

const lanes = argv.includes("--mock") ? MOCK_LANES : [laneFromEnv()].filter(Boolean);
if (!lanes.length) {
  console.error("No lane: set ARENA_URL (and ARENA_MODEL, ARENA_LABEL, ARENA_FORMAT), or pass --mock.");
  process.exit(1);
}

const games = GAMES.filter((g) => !only || only.includes(g.id)).map((g) => ({ ...g, items: g.build(opts) }));
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);

const results = [];
for (const lane of lanes) {
  console.log(`\n== ${lane.label}`);
  // Warm-up on the first game's items; answers and timings are discarded.
  const warm = games[0].items.slice(0, WARMUP);
  for (const [i, it] of warm.entries()) await decide(lane, it, i);
  let served = "";
  const out = { lane: lane.label, id: lane.id, mock: !!lane.mock, games: {} };
  for (const g of games) {
    const ms = [], answers = [];
    let errors = 0, lastError = "";
    for (const [i, it] of g.items.entries()) {
      const r = await decide(lane, it, i);
      if (r.error) {
        errors++;
        lastError = r.error;
        answers.push(null);
        continue;
      }
      served = r.served || served;
      ms.push(r.ms);
      answers.push(r.answer);
    }
    const { pairs, ...metrics } = g.score(g.items, answers);
    const row = {
      items: g.items.length,
      ...Object.fromEntries(Object.entries(metrics).map(([k, v]) => [k, typeof v === "number" ? Math.round(v * 1000) / 1000 : v])),
      "p50 ms": r1(percentile(ms, 50)),
      "p95 ms": r1(percentile(ms, 95)),
      ...(g.deadlineMs ? { "in time %": ms.length ? r1((100 * ms.filter((m) => m <= g.deadlineMs).length) / ms.length) : null } : {}),
      errors,
      ...(lastError ? { "last error": lastError.slice(0, 300) } : {}),
    };
    if (pairs) row.pairs = pairs.map(([p, y]) => [Math.round(p * 1e4) / 1e4, y ? 1 : 0]);
    out.games[g.id] = row;
    console.log(`  ${g.name.padEnd(15)} ${g.primary} = ${row[g.primary] ?? "–"}  p50 ${row["p50 ms"] ?? "–"} ms  errors ${errors}${lastError ? ` (${lastError.slice(0, 120)})` : ""}`);
  }
  out.served = served || null;
  results.push(out);
}

if (OUT) {
  fs.mkdirSync(OUT, { recursive: true });
  const meta = { date: new Date().toISOString(), seed: opts.seed, snake: opts.snakeN, flappy: opts.flappyN, warmup: WARMUP, node: process.version, runner: process.env.ARENA_RUNNER || `${process.platform}/${process.arch}` };
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ meta, lanes: results }, null, 2));
  console.log(`\nWrote ${path.join(OUT, "results.json")}`);
}
if (results.some((r) => r.mock)) console.log("\nMock lanes are random stand-ins with fake latency: do not report them as model results.");
