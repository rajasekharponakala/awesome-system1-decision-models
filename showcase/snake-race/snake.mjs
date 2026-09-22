// Shared game logic: used by the browser (app.js), the mock backend, and bench.mjs.

export const SIZE = 16;
export const DIRS = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
};
const OPPOSITE = { up: "down", down: "up", left: "right", right: "left" };

// Small deterministic PRNG so both lanes see the same food sequence.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function newGame(seed) {
  const g = {
    rand: rng(seed),
    snake: [
      [8, 5],
      [8, 4],
      [8, 3],
    ],
    dir: "right",
    food: null,
    alive: true,
  };
  placeFood(g);
  return g;
}

export function placeFood(g) {
  const taken = new Set(g.snake.map(key));
  const free = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) if (!taken.has(r * SIZE + c)) free.push([r, c]);
  g.food = free[Math.floor(g.rand() * free.length)];
}

export const key = ([r, c]) => r * SIZE + c;
export const moveCell = ([r, c], dir) => [r + DIRS[dir][0], c + DIRS[dir][1]];
export const legalMoves = (dir) => Object.keys(DIRS).filter((d) => d !== OPPOSITE[dir]);

// What a move would hit. The tail moves away this tick unless we eat.
export function outcome(g, dir) {
  const [r, c] = moveCell(g.snake[0], dir);
  if (r < 0 || c < 0 || r >= SIZE || c >= SIZE) return "wall";
  const eats = r === g.food[0] && c === g.food[1];
  const body = eats ? g.snake : g.snake.slice(0, -1);
  if (body.some(([br, bc]) => br === r && bc === c)) return "body";
  return eats ? "food" : "empty";
}

// Advances one tick. Returns "ate", "moved" or "died".
export function step(g, dir) {
  if (dir && legalMoves(g.dir).includes(dir)) g.dir = dir;
  const res = outcome(g, g.dir);
  if (res === "wall" || res === "body") {
    g.alive = false;
    return "died";
  }
  g.snake.unshift(moveCell(g.snake[0], g.dir));
  if (res === "food") {
    placeFood(g);
    return "ate";
  }
  g.snake.pop();
  return "moved";
}

const manhattan = ([a, b], [c, d]) => Math.abs(a - c) + Math.abs(b - d);

export function gridText(g) {
  const rows = Array.from({ length: SIZE }, () => Array(SIZE).fill("."));
  g.snake.forEach(([r, c], i) => (rows[r][c] = i === 0 ? "H" : "o"));
  rows[g.food[0]][g.food[1]] = "*";
  return rows.map((r) => r.join("")).join("\n");
}

// The state string sent to every lane. Byte-identical across models.
export function encodeState(g) {
  const [hr, hc] = g.snake[0];
  const lines = [
    `Snake game on a ${SIZE}x${SIZE} grid. Row 0 is the top, column 0 is the left.`,
    "Legend: H = snake head, o = snake body, * = food, . = empty. Leaving the grid or hitting the body kills the snake.",
    `Head: (row ${hr}, col ${hc}). Food: (row ${g.food[0]}, col ${g.food[1]}). Current direction: ${g.dir}. Length: ${g.snake.length}.`,
  ];
  for (const d of legalMoves(g.dir)) {
    const res = outcome(g, d);
    const next = moveCell(g.snake[0], d);
    const what = res === "wall" ? "hits the wall and dies" : res === "body" ? "hits the body and dies" : res === "food" ? "eats the food" : `is empty, food is then ${manhattan(next, g.food)} steps away`;
    lines.push(`Moving ${d}: ${what}.`);
  }
  lines.push("Grid:", gridText(g));
  return lines.join("\n");
}

export function encodeQuestions(g) {
  const text = {
    up: "Move one cell up (row - 1).",
    down: "Move one cell down (row + 1).",
    left: "Move one cell left (col - 1).",
    right: "Move one cell right (col + 1).",
  };
  const criteria = {};
  for (const d of legalMoves(g.dir)) criteria[d] = text[d];
  return {
    move: {
      type: "choice",
      instructions: "Pick the snake's next move. Never move into a wall or the snake's body. Among safe moves, get closer to the food.",
      criteria,
    },
  };
}

// Rebuilds a game from the state string. Used by the mock backend.
export function parseState(text) {
  const lines = String(text).split("\n");
  const start = lines.indexOf("Grid:") + 1;
  const dirMatch = /Current direction: (\w+)/.exec(text);
  const g = { snake: [], dir: dirMatch ? dirMatch[1] : "right", food: [0, 0] };
  const body = [];
  lines.slice(start, start + SIZE).forEach((row, r) =>
    [...row].forEach((ch, c) => {
      if (ch === "H") g.snake.unshift([r, c]);
      else if (ch === "o") body.push([r, c]);
      else if (ch === "*") g.food = [r, c];
    }),
  );
  // Order body cells by adjacency from the head so the tail is last.
  while (body.length) {
    const last = g.snake[g.snake.length - 1];
    const i = body.findIndex((b) => manhattan(b, last) === 1);
    g.snake.push(body.splice(i === -1 ? 0 : i, 1)[0]);
  }
  return g;
}

// Cells reachable from a cell; used to avoid trapping moves.
export function freeSpace(g, from) {
  const blocked = new Set(g.snake.slice(0, -1).map(key));
  const seen = new Set([key(from)]);
  const queue = [from];
  while (queue.length) {
    const cell = queue.pop();
    for (const d of Object.keys(DIRS)) {
      const [r, c] = moveCell(cell, d);
      const k = r * SIZE + c;
      if (r < 0 || c < 0 || r >= SIZE || c >= SIZE || blocked.has(k) || seen.has(k)) continue;
      seen.add(k);
      queue.push([r, c]);
    }
  }
  return seen.size;
}

export function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}
