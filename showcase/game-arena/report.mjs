// Merges arena.mjs results (one directory per lane) into a Markdown report and
// a summary.json that the launch video reads.
//
//   node report.mjs results/* [--summary summary.json] > report.md
//
// "Best at a game" is the lane with the highest primary metric among lanes that
// answered at least 90% of that game's items. Equal scores are split by the
// game's tie-break metric; lanes still level share the win.

import fs from "node:fs";
import path from "node:path";
import { GAMES, bankroll } from "./games.mjs";

const args = process.argv.slice(2);
const si = args.indexOf("--summary");
const SUMMARY = si === -1 ? null : args.splice(si, 2)[1];

const runs = args
  .map((d) => path.join(d, "results.json"))
  .filter((f) => fs.existsSync(f))
  .map((f) => JSON.parse(fs.readFileSync(f, "utf8")));
if (!runs.length) {
  console.log("No arena results were produced.");
  process.exit(0);
}
const lanes = runs.flatMap((r) => r.lanes.map((l) => ({ ...l, runner: r.meta.runner, meta: r.meta })));

// Bankroll duel: a Kelly bettor follows each lane's yes/no probabilities on
// every Flappy Bird and Spam Invaders item.
const BANK = { id: "bankroll", name: "Bankroll Duel", primitive: "Noul probabilities", tests: "Calibration: bets its confidence on every yes/no answer", primary: "chips" };
for (const l of lanes) {
  if (l.games.bankroll && !l.games.flappy?.pairs) continue; // already computed (rebuilt from a summary)
  const pairs = ["flappy", "spam"].flatMap((g) => l.games[g]?.pairs ?? []);
  const expected = ["flappy", "spam"].reduce((s, g) => s + (l.games[g]?.items ?? 0), 0);
  l.games.bankroll = { items: expected, answered: pairs.length, chips: pairs.length ? Math.round(bankroll(pairs)) : null };
}
const games = [...GAMES, BANK];

const fmt = (v, k = "") => {
  if (v == null) return "–";
  if (typeof v !== "number") return String(v);
  if (k === "chips" || k === "bankroll") return v >= 1e6 ? v.toExponential(1) : String(Math.round(v));
  if (/%$/.test(k)) return `${Number.isInteger(v) ? v : v.toFixed(1)}%`;
  if (/ms$/.test(k)) return `${Math.round(v)} ms`;
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(3);
};
const esc = (s) => String(s).replace(/\|/g, "\\|");

const best = {};
for (const g of games) {
  const ok = lanes.filter((l) => {
    const r = l.games[g.id];
    return r && r[g.primary] != null && r.answered >= 0.9 * r.items;
  });
  const tb = (l) => {
    const v = g.tiebreak ? l.games[g.id][g.tiebreak.metric] : null;
    return v == null ? -Infinity : g.tiebreak.lowerIsBetter ? -v : v;
  };
  const level = (a, b) => a.games[g.id][g.primary] === b.games[g.id][g.primary] && tb(a) === tb(b);
  ok.sort((a, b) => b.games[g.id][g.primary] - a.games[g.id][g.primary] || tb(b) - tb(a) || (a.games[g.id]["p50 ms"] ?? 1e9) - (b.games[g.id]["p50 ms"] ?? 1e9));
  const winners = ok.filter((l) => level(l, ok[0]));
  const next = ok[winners.length];
  const fastest = lanes.filter((l) => l.games[g.id]?.["p50 ms"] != null).sort((a, b) => a.games[g.id]["p50 ms"] - b.games[g.id]["p50 ms"])[0];
  best[g.id] = { winner: ok[0]?.lane ?? null, winners: winners.map((l) => l.lane), value: ok[0]?.games[g.id][g.primary] ?? null, runnerUp: next?.lane ?? null, runnerUpValue: next?.games[g.id][g.primary] ?? null, fastest: fastest?.lane ?? null, fastestMs: fastest?.games[g.id]["p50 ms"] ?? null, ranking: ok.map((l) => l.lane), rank: Object.fromEntries(ok.map((l) => [l.lane, ok.findIndex((m) => level(m, l)) + 1])) };
}

// Overall: mean rank across games. Tied lanes share a rank; lanes that did not
// finish a game rank last there.
const overall = lanes
  .map((l) => ({ lane: l.lane, rank: games.reduce((s, g) => s + (best[g.id].rank[l.lane] ?? lanes.length), 0) / games.length }))
  .sort((a, b) => a.rank - b.rank);

const out = [];
out.push("### Best at each game", "", "| Game | Primitive | What it tests | Best | Runner-up | Fastest (p50) |", "|---|---|---|---|---|---|");
for (const g of games) {
  const b = best[g.id];
  const who = b.winners.map((w) => `**${esc(w)}**`).join(" and ") + (b.winners.length > 1 ? ", tied" : "");
  out.push(`| ${g.name} | ${g.primitive} | ${g.tests} | ${b.winner ? `${who} (${fmt(b.value, g.primary)} ${g.primary.replace(/ %$/, "")})` : "–"} | ${b.runnerUp ? `${esc(b.runnerUp)} (${fmt(b.runnerUpValue, g.primary)})` : "–"} | ${b.fastest ? `${esc(b.fastest)} (${fmt(b.fastestMs, "ms")})` : "–"} |`);
}
out.push("", `Overall (mean rank across ${games.length} games): ${overall.map((o, i) => `${i + 1}. ${esc(o.lane)} (${o.rank.toFixed(1)})`).join(" · ")}`, "");

for (const g of games) {
  const cols = [...new Set(lanes.flatMap((l) => Object.keys(l.games[g.id] ?? {})))].filter((c) => !["pairs", "last error", "items"].includes(c));
  out.push(`### ${g.name}: ${g.primitive}`, "", `${g.tests}. Best = highest **${g.primary}**${g.tiebreak ? `; ties go to ${g.tiebreak.lowerIsBetter ? "lower" : "higher"} ${g.tiebreak.metric}` : ""}.${g.deadlineMs ? ` Deadline ${g.deadlineMs} ms per decision.` : ""}`, "");
  out.push(`| Lane | ${cols.join(" | ")} |`, `|---|${cols.map(() => "---").join("|")}|`);
  const sorted = [...lanes].sort((a, b) => (b.games[g.id]?.[g.primary] ?? -1e18) - (a.games[g.id]?.[g.primary] ?? -1e18));
  for (const l of sorted) out.push(`| ${esc(l.lane)} | ${cols.map((c) => fmt(l.games[g.id]?.[c], c)).join(" | ")} |`);
  for (const l of sorted.filter((l) => l.games[g.id]?.["last error"])) out.push("", `**${esc(l.lane)}** last error: \`${esc(l.games[g.id]["last error"]).slice(0, 200)}\``);
  out.push("");
}
const metaLine = [...new Set(lanes.map((l) => `seed ${l.meta.seed}, ${l.meta.snake} Snake and ${l.meta.flappy} Flappy positions, ${l.meta.warmup} warm-up calls`))].join("; ");
out.push(`Items: ${metaLine}. Every lane got byte-identical requests, one at a time. Runners: ${[...new Set(lanes.map((l) => l.runner))].join("; ")}.`);
console.log(out.join("\n"));

if (SUMMARY) {
  const summary = {
    date: lanes[0].meta.date,
    meta: lanes[0].meta,
    games: games.map((g) => ({ id: g.id, name: g.name, primitive: g.primitive, tests: g.tests, primary: g.primary, deadlineMs: g.deadlineMs ?? null, ...best[g.id] })),
    overall,
    lanes: lanes.map((l) => ({ lane: l.lane, id: l.id, served: l.served, runner: l.runner, games: Object.fromEntries(Object.entries(l.games).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).filter(([c]) => c !== "pairs"))])) })),
  };
  fs.writeFileSync(SUMMARY, JSON.stringify(summary, null, 2));
}
