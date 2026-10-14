// Lane configuration, request adapters and answer normalisation.
//
// A lane is one model behind one HTTP endpoint. Most open models speak the
// TypeSafe `/v1/systemone` wire format ("jev"). Largha's phocinae-server takes
// a list of questions with bare option strings and fixed instructions
// ("phocinae"), so its adapter folds the question into the state and maps
// option indexes back to names.
//
// Every answer is normalised to { choice, probabilities, p, score }:
//   choice  chosen option name (choice questions)
//   p       probability of "yes" (noul questions)
//   score   expected level index from 0 (score questions)

import { rng } from "../snake-race/snake.mjs";

const TIMEOUT_MS = Number(process.env.DECISION_TIMEOUT_MS || 60000);

export function laneFromEnv(env = process.env) {
  if (!env.ARENA_URL) return null;
  return {
    id: env.ARENA_LANE || "lane",
    label: env.ARENA_LABEL || env.ARENA_LANE || env.ARENA_MODEL || "lane",
    baseURL: env.ARENA_URL,
    model: env.ARENA_MODEL || "jev-latest",
    format: env.ARENA_FORMAT || "jev",
    apiKey: env.ARENA_API_KEY || undefined,
  };
}

export const MOCK_LANES = [
  { id: "mock-a", label: "Mock A [mock]", mock: true, skill: 0.85, latencyMs: 30 },
  { id: "mock-b", label: "Mock B [mock]", mock: true, skill: 0.6, latencyMs: 120 },
];

// ---- wire adapters -------------------------------------------------------------
function phocinaeRequest(lane, state, questions) {
  const [[, q]] = Object.entries(questions);
  const keys = q.type === "choice" ? Object.keys(q.criteria) : null;
  const options = keys?.map((k) => (q.criteria[k] ? `${k}: ${q.criteria[k]}` : k));
  const levels = q.type === "score" ? q.criteria : null;
  const head = [`Question: ${q.instructions}`];
  if (levels) head.push(`Scale, lowest to highest: ${levels.join(" | ")}`);
  const body = {
    model: lane.model,
    state: `${head.join("\n")}\n\n${state}`,
    questions: [{ id: "q", type: q.type, ...(options ? { options } : {}) }],
  };
  return { body, keys, levels };
}

// Largha answers score questions on its own fixed 2-10 scale; map it linearly
// onto the request's levels.
function phocinaeAnswer(res, ctx, type) {
  const v = res.answers?.q;
  const conf = res.answer_confidence?.q;
  if (type === "choice") return { choice: ctx.keys[v] };
  if (type === "noul") return { p: conf == null ? (v ? 1 : 0) : v ? conf : 1 - conf };
  if (type === "score") return { score: ((v - 2) / 8) * (ctx.levels.length - 1) };
  return {};
}

function jevAnswer(res, type) {
  const a = res.answers?.q;
  if (!a) return {};
  if (type === "choice") return { choice: a.choice, probabilities: a.probabilities };
  if (type === "noul") {
    const p = typeof a.noul === "number" ? a.noul : typeof a.noul === "boolean" ? (a.confidence == null ? +a.noul : a.noul ? a.confidence : 1 - a.confidence) : null;
    return { p };
  }
  if (type === "score") return { score: typeof a.score === "number" ? a.score : null, probabilities: a.probabilities };
  return {};
}

// ---- mock (harness testing only, never a result) --------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function mockDecide(lane, item, i) {
  const rand = rng((i + 1) * 7919 + lane.skill * 1000);
  await sleep(lane.latencyMs * (0.8 + 0.4 * rand()));
  const q = item.questions.q;
  const good = rand() < lane.skill;
  if (q.type === "noul") return { p: good === !!item.truth ? 0.6 + 0.35 * rand() : 0.4 - 0.35 * rand() };
  if (q.type === "score") return { score: good ? item.truth : Math.min(q.criteria.length - 1, item.truth + 1) };
  const keys = Object.keys(q.criteria);
  const want = item.truth ?? item.safe?.[0];
  return { choice: good && want ? want : keys[Math.floor(rand() * keys.length)] };
}

// Returns { ms, answer, error, served }.
export async function decide(lane, item, i) {
  const t0 = performance.now();
  const type = item.questions.q.type;
  try {
    if (lane.mock) {
      const answer = await mockDecide(lane, item, i);
      return { ms: performance.now() - t0, answer, served: "mock" };
    }
    const ctx = lane.format === "phocinae" ? phocinaeRequest(lane, item.state, item.questions) : { body: { model: lane.model, state: item.state, questions: item.questions } };
    const res = await fetch(`${lane.baseURL.replace(/\/$/, "")}/v1/systemone`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", ...(lane.apiKey ? { authorization: `Bearer ${lane.apiKey}` } : {}) },
      body: JSON.stringify(ctx.body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const text = await res.text();
    const ms = performance.now() - t0;
    if (!res.ok) return { ms, error: `HTTP ${res.status}: ${text.slice(0, 300)}` };
    const json = JSON.parse(text);
    const answer = lane.format === "phocinae" ? phocinaeAnswer(json, ctx, type) : jevAnswer(json, type);
    return { ms, answer, served: json.model };
  } catch (err) {
    return { ms: performance.now() - t0, error: err.message };
  }
}
