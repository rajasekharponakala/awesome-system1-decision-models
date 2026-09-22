// Headless benchmark: sends the same fixed set of Snake positions to every
// lane, one request at a time after a warm-up, and reports latency and
// decision quality.
//
//   node bench.mjs [--n 200] [--warmup 10] [--seed 7] [--mock]

import { newGame, step, legalMoves, outcome, moveCell, encodeState, encodeQuestions, percentile } from "./snake.mjs";
import { lanes, decide } from "./server.mjs";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? dflt : Number(process.argv[i + 1]);
};
const N = arg("n", 200);
const WARMUP = arg("warmup", 10);
const SEED = arg("seed", 7);

const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);

// Build positions by playing random safe moves, so the set is identical for
// every lane and every run with the same seed.
function positions(n, seed) {
  const out = [];
  let g = newGame(seed);
  let r = seed;
  const rand = () => ((r = (r * 1103515245 + 12345) >>> 0) / 2 ** 32);
  while (out.length < n) {
    const safe = legalMoves(g.dir).filter((d) => !["wall", "body"].includes(outcome(g, d)));
    if (!safe.length) {
      g = newGame(seed + out.length + 1);
      continue;
    }
    out.push({ state: encodeState(g), questions: encodeQuestions(g), safe, closer: safe.filter((d) => dist(moveCell(g.snake[0], d), g.food) < dist(g.snake[0], g.food)) });
    step(g, safe[Math.floor(rand() * safe.length)]);
    if (!g.alive) g = newGame(seed + out.length + 1);
  }
  return out;
}

const set = positions(N + WARMUP, SEED);
const rows = [];
for (const [id, lane] of Object.entries(lanes)) {
  process.stdout.write(`${lane.label} … `);
  const ms = [];
  let safe = 0, closer = 0, closerPossible = 0, errors = 0, lastError = "";
  for (const [i, p] of set.entries()) {
    const out = await decide(id, p.state, p.questions);
    if (out.status !== 200) {
      errors++;
      lastError = out.body.error;
      continue;
    }
    if (i < WARMUP) continue;
    ms.push(out.body.upstreamMs);
    const choice = out.body.result?.answers?.move?.choice;
    if (p.safe.includes(choice)) safe++;
    if (p.closer.length) {
      closerPossible++;
      if (p.closer.includes(choice)) closer++;
    }
  }
  console.log(errors ? `${errors} errors (last: ${lastError})` : "done");
  const f = (v) => (v == null ? "–" : v.toFixed(1));
  rows.push({
    lane: lane.label + (lane.mock ? " [mock]" : ""),
    n: ms.length,
    "p50 ms": f(percentile(ms, 50)),
    "p95 ms": f(percentile(ms, 95)),
    "p99 ms": f(percentile(ms, 99)),
    "safe move %": ms.length ? ((100 * safe) / ms.length).toFixed(1) : "–",
    "closer to food %": closerPossible ? ((100 * closer) / closerPossible).toFixed(1) : "–",
    errors,
  });
}
console.log(`\n${N} positions (seed ${SEED}), ${WARMUP} warm-up calls discarded per lane.`);
console.table(rows);
if (rows.some((r) => r.lane.includes("[mock]"))) console.log("Mock lanes are a heuristic with simulated latency: do not report them as model results.");
