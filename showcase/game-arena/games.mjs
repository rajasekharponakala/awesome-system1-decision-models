// The arena's games. Each game builds a fixed, seeded list of items; every lane
// gets byte-identical requests. An item is { state, questions, truth, ... } and
// each game scores a lane's normalised answers with `score(items, answers)`.
//
// A game asks one question per request, named "q", so the latency of an item is
// the latency of one decision.

import { newGame, step, legalMoves, outcome, moveCell, encodeState, encodeQuestions, rng } from "../snake-race/snake.mjs";
import { SPAM, INTENTS, BABEL, SEVERITY, PAGER, COUNTRIES, GEO } from "./fixtures.mjs";

const pct = (a, b) => (b ? (100 * a) / b : null);
const clampP = (p) => Math.min(0.99, Math.max(0.01, p));
const brier = (pairs) => (pairs.length ? pairs.reduce((s, [p, y]) => s + (p - (y ? 1 : 0)) ** 2, 0) / pairs.length : null);

// Kelly bettor at even odds: stakes 2p - 1 of its chips on the side it favours.
// Overconfident wrong answers cost the most, so the final stack rewards calibration.
export function bankroll(pairs, start = 1000) {
  let chips = start;
  for (const [p, y] of pairs) {
    const q = clampP(p);
    chips *= y ? 2 * q : 2 * (1 - q);
  }
  return chips;
}

// ---- Snake: Choice among up to 3 moves, 4 moves per second -------------------
function snakeItems(n, seed) {
  const out = [];
  let g = newGame(seed);
  let r = seed;
  const rand = () => ((r = (r * 1103515245 + 12345) >>> 0) / 2 ** 32);
  const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
  while (out.length < n) {
    const safe = legalMoves(g.dir).filter((d) => !["wall", "body"].includes(outcome(g, d)));
    if (!safe.length) {
      g = newGame(seed + out.length + 1);
      continue;
    }
    const questions = { q: encodeQuestions(g).move };
    const closer = safe.filter((d) => dist(moveCell(g.snake[0], d), g.food) < dist(g.snake[0], g.food));
    out.push({ state: encodeState(g), questions, safe, closer });
    step(g, safe[Math.floor(rand() * safe.length)]);
    if (!g.alive) g = newGame(seed + out.length + 1);
  }
  return out;
}

// ---- Flappy Bird: Noul "flap now?", 10 decisions per second -------------------
const FH = 12; // rows 0 (top) .. 11 (bottom)
const FLAP_V = -2, GRAVITY = 1, MAX_V = 3;
const fly = (y, v, flap) => {
  const nv = flap ? FLAP_V : Math.min(MAX_V, v + GRAVITY);
  return [y + nv, nv];
};
// Can the bird survive from here until it has passed the pipe?
function survives(y, v, d, gap, flap) {
  const [ny, nv] = fly(y, v, flap);
  if (ny < 0 || ny >= FH) return false;
  const nd = d - 1;
  if (nd === 0 && (ny < gap[0] || ny > gap[1])) return false;
  if (nd < 0) return true;
  return survives(ny, nv, nd, gap, true) || survives(ny, nv, nd, gap, false);
}
function flappyItems(n, seed) {
  const rand = rng(seed);
  const out = [];
  let want = true;
  for (let tries = 0; out.length < n && tries < 100000; tries++) {
    const y = 1 + Math.floor(rand() * (FH - 2));
    const v = -2 + Math.floor(rand() * 6);
    const d = 1 + Math.floor(rand() * 5);
    const top = 1 + Math.floor(rand() * (FH - 5));
    const gap = [top, top + 2];
    const okFlap = survives(y, v, d, gap, true);
    const okWait = survives(y, v, d, gap, false);
    if (okFlap === okWait) continue; // keep only positions with exactly one right answer
    if (okFlap !== want) continue; // alternate so half the answers are "flap"
    want = !want;
    const [fy] = fly(y, v, true);
    const [wy] = fly(y, v, false);
    const where = (row) => (row < 0 ? "above the ceiling (dies)" : row >= FH ? "below the floor (dies)" : `row ${row}`);
    const state = [
      `Flappy Bird. The screen has rows 0 (top) to ${FH - 1} (bottom). Leaving the screen or hitting a pipe kills the bird.`,
      `Bird: row ${y}, vertical speed ${v > 0 ? "+" : ""}${v} rows per tick (positive is falling). Gravity adds +1 each tick; a flap sets the speed to ${FLAP_V}.`,
      `Next pipe: ${d} tick${d === 1 ? "" : "s"} away. Its gap is rows ${gap[0]} to ${gap[1]}; every other row of the pipe is solid.`,
      `If the bird flaps now, next tick it is at ${where(fy)}.`,
      `If the bird does not flap, next tick it is at ${where(wy)}.`,
    ].join("\n");
    out.push({
      state,
      questions: { q: { type: "noul", instructions: "Should the bird flap now to survive and pass through the pipe's gap?" } },
      truth: okFlap,
    });
  }
  return out;
}

// ---- Spam Invaders: Noul "is this spam?" --------------------------------------
const spamItems = () =>
  SPAM.map(([text, spam]) => ({
    state: `Incoming message:\n${text}`,
    questions: { q: { type: "noul", instructions: "Is this message spam, a scam or phishing?" } },
    truth: spam,
  }));

// ---- Babel Desk: Choice of support queue in 12 languages ----------------------
const babelItems = () =>
  BABEL.map(([lang, latin, text, intent]) => ({
    state: `Customer support message:\n${text}`,
    questions: { q: { type: "choice", instructions: "Which support queue should handle this message?", criteria: { ...INTENTS } } },
    truth: intent,
    lang,
    latin,
  }));

// ---- On-call Pager: Score 1-5 severity ----------------------------------------
const pagerItems = () =>
  PAGER.map(([line, sev]) => ({
    state: `Production log line:\n${line}`,
    questions: { q: { type: "score", instructions: "How severe is this event for the on-call engineer?", criteria: SEVERITY } },
    truth: sev - 1,
  }));

// ---- Text GeoGuessr: Choice among 24 countries --------------------------------
const geoItems = () =>
  GEO.map(([text, country]) => ({
    state: `You are dropped somewhere in the world and see this:\n${text}`,
    questions: { q: { type: "choice", instructions: "Which country are you in?", criteria: Object.fromEntries(COUNTRIES.map((c) => [c, null])) } },
    truth: country,
  }));

// ---- Scoring -------------------------------------------------------------------
function scoreSnake(items, answers) {
  let safe = 0, closer = 0, closerPossible = 0, n = 0;
  items.forEach((it, i) => {
    const a = answers[i];
    if (!a) return;
    n++;
    if (it.safe.includes(a.choice)) safe++;
    if (it.closer.length) {
      closerPossible++;
      if (it.closer.includes(a.choice)) closer++;
    }
  });
  return { answered: n, "safe moves %": pct(safe, n), "closer to food %": pct(closer, closerPossible) };
}

function scoreNoul(items, answers) {
  const pairs = [];
  let right = 0, tp = 0, fp = 0, fn = 0;
  items.forEach((it, i) => {
    const a = answers[i];
    if (!a || a.p == null) return;
    pairs.push([a.p, it.truth]);
    const yes = a.p >= 0.5;
    if (yes === it.truth) right++;
    if (yes && it.truth) tp++;
    if (yes && !it.truth) fp++;
    if (!yes && it.truth) fn++;
  });
  return {
    answered: pairs.length,
    "accuracy %": pct(right, pairs.length),
    F1: tp ? (2 * tp) / (2 * tp + fp + fn) : pairs.length ? 0 : null,
    Brier: brier(pairs),
    bankroll: pairs.length ? bankroll(pairs) : null,
    pairs,
  };
}

function scoreChoice(items, answers) {
  let right = 0, n = 0, latinR = 0, latinN = 0, otherR = 0, otherN = 0;
  const pairs = [];
  items.forEach((it, i) => {
    const a = answers[i];
    if (!a) return;
    n++;
    const ok = a.choice === it.truth;
    if (ok) right++;
    if (a.probabilities && it.truth in a.probabilities) pairs.push([a.probabilities[it.truth], true]);
    if (it.latin === true) (latinN++, ok && latinR++);
    if (it.latin === false) (otherN++, ok && otherR++);
  });
  const out = { answered: n, "accuracy %": pct(right, n) };
  if (latinN || otherN) Object.assign(out, { "Latin script %": pct(latinR, latinN), "other scripts %": pct(otherR, otherN) });
  return out;
}

function scoreScore(items, answers) {
  let exact = 0, near = 0, err = 0, n = 0;
  items.forEach((it, i) => {
    const a = answers[i];
    if (!a || a.score == null) return;
    n++;
    const lvl = Math.round(a.score);
    if (lvl === it.truth) exact++;
    if (Math.abs(lvl - it.truth) <= 1) near++;
    err += Math.abs(a.score - it.truth);
  });
  return { answered: n, "exact %": pct(exact, n), "within one level %": pct(near, n), MAE: n ? err / n : null };
}

// `primary` is the metric that decides "best at this game" (higher is better).
// `tiebreak` settles equal primary scores; models still level are reported as
// a tie. `deadlineMs` is set for the real-time games.
export const GAMES = [
  { id: "snake", name: "Snake", primitive: "Choice (3 moves)", tests: "Reading a board fast, 4 moves per second", deadlineMs: 250, primary: "safe moves %", tiebreak: { metric: "closer to food %" }, build: (o) => snakeItems(o.snakeN, o.seed), score: scoreSnake },
  { id: "flappy", name: "Flappy Bird", primitive: "Noul (flap?)", tests: "One yes/no per frame, 10 per second", deadlineMs: 100, primary: "accuracy %", tiebreak: { metric: "Brier", lowerIsBetter: true }, build: (o) => flappyItems(o.flappyN, o.seed), score: scoreNoul },
  { id: "spam", name: "Spam Invaders", primitive: "Noul (spam?)", tests: "Content moderation, calibrated yes/no", primary: "F1", tiebreak: { metric: "Brier", lowerIsBetter: true }, build: spamItems, score: scoreNoul },
  { id: "babel", name: "Babel Desk", primitive: "Choice (4 queues)", tests: "Ticket routing in 12 languages, 7 non-Latin scripts", primary: "accuracy %", tiebreak: { metric: "other scripts %" }, build: babelItems, score: scoreChoice },
  { id: "pager", name: "On-call Pager", primitive: "Score (1-5)", tests: "Ordinal severity triage", primary: "within one level %", tiebreak: { metric: "exact %" }, build: pagerItems, score: scoreScore },
  { id: "geo", name: "Text GeoGuessr", primitive: "Choice (24 countries)", tests: "World knowledge over a large option set", primary: "accuracy %", build: geoItems, score: scoreChoice },
];
