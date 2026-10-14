// Copies a game-arena summary.json (from the workflow's arena-report artifact)
// into the RESULTS block of the launch video, so every number on screen comes
// from a measured run.
//
//   node to-video.mjs summary.json "run #N" [../snake-race/video/index.html]

import fs from "node:fs";

const [summaryFile, runLabel = "", videoFile = new URL("../snake-race/video/index.html", import.meta.url).pathname] = process.argv.slice(2);
const s = JSON.parse(fs.readFileSync(summaryFile, "utf8"));

const COLORS = ["--l1", "--l2", "--l3", "--l4", "--l5", "--l6", "--l7", "--l8", "--l9", "--l10"];
const lanes = s.lanes.map((l, i) => ({ id: l.id, label: l.lane, color: COLORS[i % COLORS.length] }));
const byLabel = Object.fromEntries(lanes.map((l) => [l.label, l.id]));

const games = s.games.map((g) => ({
  id: g.id,
  name: g.name,
  primitive: g.primitive,
  tests: g.tests,
  primary: g.primary,
  deadlineMs: g.deadlineMs,
  winner: g.winner ? byLabel[g.winner] : null,
  winners: (g.winners || (g.winner ? [g.winner] : [])).map((w) => byLabel[w]),
  fastest: g.fastest ? byLabel[g.fastest] : null,
  values: Object.fromEntries(
    s.lanes.map((l) => {
      const r = l.games[g.id] || {};
      const ok = r.answered != null && r.items && r.answered >= 0.9 * r.items;
      return [l.id, { v: ok ? r[g.primary] ?? null : null, p50: r["p50 ms"] ?? null, inTime: r["in time %"] ?? null }];
    }),
  ),
}));

const date = new Date(s.date).toISOString().slice(0, 10);
const RESULTS = {
  source: `GitHub Actions ${runLabel} · ${date} · seed ${s.meta.seed} · 4-vCPU runners, no GPU`.replace(/\s+/g, " "),
  caveat: "CPU-only latency. On a GPU every model here is much faster. Text-game labels are hand-written (showcase/game-arena/fixtures.mjs).",
  lanes,
  games,
  overall: s.overall.map((o) => ({ id: byLabel[o.lane], rank: Math.round(o.rank * 10) / 10 })),
};

const html = fs.readFileSync(videoFile, "utf8");
const start = "// ---- RESULTS START";
const end = "// ---- RESULTS END";
const a = html.indexOf(start), b = html.indexOf(end);
if (a === -1 || b === -1) throw new Error(`markers not found in ${videoFile}`);
const block = `${start} (written by showcase/game-arena/to-video.mjs; do not edit by hand)\n      const RESULTS = ${JSON.stringify(RESULTS, null, 2).replace(/\n/g, "\n      ")};\n      `;
fs.writeFileSync(videoFile, html.slice(0, a) + block + html.slice(b));
console.log(`Wrote ${lanes.length} lanes and ${games.length} games into ${videoFile}`);
