// Offline stand-in for a /v1/systemone backend. It plays Snake with a simple
// heuristic and sleeps for a configurable latency. It is NOT a model: use it
// to test the harness and the UI, never to report results.

import { SIZE, legalMoves, moveCell, outcome, parseState, freeSpace } from "./snake.mjs";

export const MOCK_PROFILES = {
  "mock-fast": { label: "Mock A (fast, ~35 ms)", latencyMs: 35, jitterMs: 10, noise: 0.6 },
  "mock-slow": { label: "Mock B (slow, ~250 ms)", latencyMs: 250, jitterMs: 40, noise: 0.6 },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function softmax(scores) {
  const max = Math.max(...Object.values(scores));
  const exps = Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, Math.exp(v - max)]));
  const sum = Object.values(exps).reduce((a, b) => a + b, 0);
  return Object.fromEntries(Object.entries(exps).map(([k, v]) => [k, v / sum]));
}

function answerMove(state, options, noise) {
  const g = parseState(state);
  const scores = {};
  for (const d of options) {
    if (!g.snake.length || !legalMoves(g.dir).includes(d)) {
      scores[d] = 0;
      continue;
    }
    const res = outcome(g, d);
    if (res === "wall" || res === "body") {
      scores[d] = -8;
      continue;
    }
    const next = moveCell(g.snake[0], d);
    const dist = Math.abs(next[0] - g.food[0]) + Math.abs(next[1] - g.food[1]);
    const room = freeSpace(g, next) / (SIZE * SIZE);
    scores[d] = (res === "food" ? 3 : 0) - dist * 0.25 + (room < g.snake.length / (SIZE * SIZE) ? -4 : room * 2) + (Math.random() - 0.5) * noise;
  }
  return scores;
}

export async function mockSystemOne(profileId, body) {
  const profile = MOCK_PROFILES[profileId];
  await sleep(Math.max(1, profile.latencyMs + (Math.random() * 2 - 1) * profile.jitterMs));
  const answers = {};
  for (const [name, q] of Object.entries(body.questions ?? {})) {
    const options = Object.keys(q.criteria ?? {});
    if (q.type !== "choice" || !options.length) {
      answers[name] = { type: "noul", noul: 0.5 };
      continue;
    }
    const scores = name === "move" ? answerMove(body.state, options, profile.noise) : Object.fromEntries(options.map((o) => [o, 0]));
    const probabilities = softmax(scores);
    const choice = Object.entries(probabilities).sort((a, b) => b[1] - a[1])[0][0];
    answers[name] = { type: "choice", choice, confidence: probabilities[choice], probabilities };
  }
  return { model: profileId, answers, usage: {} };
}
