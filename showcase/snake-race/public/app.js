import { SIZE, newGame, step, encodeState, encodeQuestions, percentile } from "/snake.mjs";

const $ = (id) => document.getElementById(id);
const COLORS = ["--a", "--b"];
let lanesMeta = [];
let run = null;

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

async function init() {
  lanesMeta = await (await fetch("/api/lanes")).json();
  for (const [i, sel] of [$("laneA"), $("laneB")].entries()) {
    for (const l of lanesMeta) sel.add(new Option(l.label + (l.mock ? " [mock]" : ""), l.id));
    sel.selectedIndex = Math.min(i, lanesMeta.length - 1);
  }
  const real = lanesMeta.filter((l) => !l.mock);
  if (real.length >= 2) {
    $("laneA").value = real[0].id;
    $("laneB").value = real[1].id;
  }
  $("start").onclick = start;
  $("stop").onclick = () => finish("Stopped.");
}

function makeLane(slot, id, seed) {
  const meta = lanesMeta.find((l) => l.id === id);
  const el = document.createElement("section");
  el.className = "lane";
  el.style.setProperty("--c", `var(${COLORS[slot]})`);
  el.innerHTML = `
    <h2><span>${meta.label}</span>${meta.mock ? '<span class="tag">mock</span>' : ""}</h2>
    <canvas width="${SIZE * 20}" height="${SIZE * 20}"></canvas>
    <div class="stats">
      <div class="stat"><b data-k="food">0</b><span>food eaten</span></div>
      <div class="stat"><b data-k="deaths">0</b><span>deaths</span></div>
      <div class="stat"><b data-k="missed">0</b><span data-k="missedLabel">missed ticks</span></div>
      <div class="stat"><b data-k="p50">–</b><span>model ms p50</span></div>
      <div class="stat"><b data-k="p95">–</b><span>model ms p95</span></div>
      <div class="stat"><b data-k="e2e">–</b><span>end-to-end ms p50</span></div>
    </div>
    <div class="probs"></div>
    <div class="err"></div>`;
  $("lanes").append(el);
  return {
    id, meta, el, slot, seed,
    game: newGame(seed),
    food: 0, deaths: 0, moves: 0, missed: 0, late: 0, errors: 0,
    modelMs: [], e2eMs: [],
    inflight: null, pending: null, lastAnswer: null, lastError: "",
    missedByHz: {}, ticksByHz: {},
  };
}

async function ask(lane) {
  const g = lane.game;
  const tag = { moves: lane.moves, deaths: lane.deaths };
  const t0 = performance.now();
  lane.inflight = tag;
  try {
    const res = await fetch("/api/decide", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lane: lane.id, state: encodeState(g), questions: encodeQuestions(g) }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
    const answer = body.result?.answers?.move;
    if (!answer?.choice) throw new Error(`no "move" choice in response: ${JSON.stringify(body.result).slice(0, 200)}`);
    lane.modelMs.push(body.upstreamMs);
    lane.e2eMs.push(performance.now() - t0);
    lane.lastAnswer = answer;
    lane.lastError = "";
    return { tag, choice: answer.choice };
  } catch (err) {
    lane.errors++;
    lane.lastError = err.message;
    return { tag, choice: null };
  } finally {
    lane.inflight = null;
  }
}

function advance(lane, choice) {
  const result = step(lane.game, choice);
  lane.moves++;
  if (result === "ate") lane.food++;
  if (result === "died") {
    lane.deaths++;
    lane.game = newGame(lane.seed + lane.deaths);
  }
}

// Fixed tick: every tick, use the answer only if it was computed for the
// current position; otherwise the snake keeps its direction.
function tick() {
  const hz = run.hz;
  for (const lane of run.lanes) {
    lane.ticksByHz[hz] = (lane.ticksByHz[hz] || 0) + 1;
    let choice = null;
    if (lane.pending && (run.applyLate || (lane.pending.tag.moves === lane.moves && lane.pending.tag.deaths === lane.deaths))) {
      choice = lane.pending.choice;
    } else {
      lane.missed++;
      lane.missedByHz[hz] = (lane.missedByHz[hz] || 0) + 1;
    }
    lane.pending = null;
    advance(lane, choice);
    if (!lane.inflight) ask(lane).then((a) => (lane.pending = a));
  }
}

async function freeLoop(lane, r) {
  while (!r.done) {
    const a = await ask(lane);
    if (r.done) return;
    if (a.choice === null) await new Promise((r) => setTimeout(r, 500));
    advance(lane, a.choice);
  }
}

function start() {
  if (run) {
    run.done = true;
    clearTimeout(run.timer);
  }
  $("lanes").innerHTML = "";
  const seed = Number($("seed").value) || 42;
  const mode = $("mode").value;
  run = {
    mode,
    hz: Math.max(1, Number($("hz").value) || 4),
    ladder: $("ladder").checked && mode === "tick",
    applyLate: $("late").checked,
    duration: (Number($("duration").value) || 60) * 1000,
    startedAt: performance.now(),
    lanes: [makeLane(0, $("laneA").value, seed), makeLane(1, $("laneB").value, seed)],
    done: false,
  };
  const mocks = run.lanes.filter((l) => l.meta.mock).length;
  setBanner(mocks ? "Running with a mock lane: the numbers only test the harness." : "Running…", !!mocks);
  for (const l of run.lanes) l.el.querySelector('[data-k="missedLabel"]').textContent = mode === "tick" ? "missed ticks" : "food / 100 moves";
  $("thA").textContent = `${run.lanes[0].meta.label}: missed`;
  $("thB").textContent = `${run.lanes[1].meta.label}: missed`;
  $("ladderTable").hidden = mode !== "tick";
  if (mode === "tick") {
    const r = run;
    const schedule = () => {
      if (r.done) return;
      tick();
      r.timer = setTimeout(schedule, 1000 / r.hz);
    };
    // Prime both lanes so the first tick has an answer to use.
    Promise.all(r.lanes.map((l) => ask(l).then((a) => (l.pending = a)))).then(schedule);
  } else {
    const r = run;
    r.lanes.forEach((l) => freeLoop(l, r));
  }
  const current = run;
  requestAnimationFrame(() => frame(current));
}

function finish(prefix) {
  if (!run || run.done) return;
  run.done = true;
  clearTimeout(run.timer);
  const [a, b] = run.lanes;
  const score = (l) => l.food - l.deaths * 3;
  const w = score(a) === score(b) ? null : score(a) > score(b) ? a : b;
  const verdict = w ? `${w.meta.label} wins, ${score(w)} to ${score(w === a ? b : a)}` : "It's a tie";
  const mock = a.meta.mock || b.meta.mock;
  setBanner(`${prefix} ${verdict} (score = food − 3 × deaths).${mock ? " Mock lane: harness test only." : ""}`, mock);
  draw();
}

function setBanner(text, warn = false) {
  $("banner").textContent = text;
  $("banner").classList.toggle("warn", warn);
}

function frame(r) {
  if (r !== run) return;
  const elapsed = performance.now() - run.startedAt;
  if (!run.done && run.ladder) {
    const base = Math.max(1, Number($("hz").value) || 4);
    run.hz = Math.min(60, base + 2 * Math.floor(elapsed / 10000));
    $("hz").value = run.hz;
  }
  if (!run.done && elapsed >= run.duration) finish("Round over.");
  draw();
  if (!run.done) requestAnimationFrame(() => frame(r));
}

function draw() {
  const colors = { grid: css("--grid"), food: css("--food"), bg: css("--panel") };
  for (const lane of run.lanes) {
    const ctx = lane.el.querySelector("canvas").getContext("2d");
    const s = 20;
    const snakeColor = css(COLORS[lane.slot]);
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, SIZE * s, SIZE * s);
    ctx.fillStyle = colors.grid;
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) ctx.fillRect(c * s + 1, r * s + 1, s - 2, s - 2);
    ctx.fillStyle = colors.food;
    ctx.beginPath();
    ctx.arc(lane.game.food[1] * s + s / 2, lane.game.food[0] * s + s / 2, s / 2 - 3, 0, Math.PI * 2);
    ctx.fill();
    lane.game.snake.forEach(([r, c], i) => {
      ctx.globalAlpha = i === 0 ? 1 : 0.7;
      ctx.fillStyle = snakeColor;
      ctx.fillRect(c * s + 1, r * s + 1, s - 2, s - 2);
    });
    ctx.globalAlpha = 1;

    const set = (k, v) => (lane.el.querySelector(`[data-k="${k}"]`).textContent = v);
    const fmt = (v) => (v == null ? "–" : v.toFixed(0));
    set("food", lane.food);
    set("deaths", lane.deaths);
    set("missed", run.mode === "tick" ? lane.missed : lane.moves ? ((100 * lane.food) / lane.moves).toFixed(1) : "–");
    set("p50", fmt(percentile(lane.modelMs, 50)));
    set("p95", fmt(percentile(lane.modelMs, 95)));
    set("e2e", fmt(percentile(lane.e2eMs, 50)));

    const probs = lane.lastAnswer?.probabilities || {};
    lane.el.querySelector(".probs").innerHTML = Object.entries(probs)
      .map(([k, p]) => `<div class="prob"><span>${k}</span><span class="bar"><i style="width:${(p * 100).toFixed(1)}%"></i></span><span>${(p * 100).toFixed(0)}%</span></div>`)
      .join("");
    lane.el.querySelector(".err").textContent = lane.lastError ? `Error (${lane.errors}): ${lane.lastError}` : "";
  }
  if (run.mode === "tick") {
    const rates = [...new Set(run.lanes.flatMap((l) => Object.keys(l.ticksByHz)))].map(Number).sort((a, b) => a - b);
    const cell = (l, hz) => {
      const t = l.ticksByHz[hz] || 0;
      return t ? `${(((l.missedByHz[hz] || 0) / t) * 100).toFixed(0)}% of ${t}` : "–";
    };
    $("ladderTable").querySelector("tbody").innerHTML = rates.map((hz) => `<tr><td>${hz} Hz</td><td>${cell(run.lanes[0], hz)}</td><td>${cell(run.lanes[1], hz)}</td></tr>`).join("");
  }
}

init();
