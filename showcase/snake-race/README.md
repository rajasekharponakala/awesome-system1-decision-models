# System 1 Snake Race

Two System 1 decision models play the same game of Snake, side by side and from the same seed. Out of the box it races **Jev** against **Laya**. Every move is one `choice` question sent to the model's `/v1/systemone` endpoint, and the answer steers the snake directly.

There are two modes:

- **Fixed tick.** The game moves on a timer. If a model hasn't answered by the next tick, its snake keeps going straight and the tick counts as *missed*. Turn on **Ladder** to add 2 Hz every 10 s; the table shows each model's miss rate at each speed, so you can see where it breaks.
- **Free run.** Each snake moves as soon as its model answers. The faster model plays more moves in the same time, and **food per 100 moves** compares decision quality regardless of speed.

Each lane shows food eaten, deaths, missed ticks, model latency (p50/p95), end-to-end latency, and the probabilities for the last decision. Score is `food − 3 × deaths`.

There are no dependencies to install; it needs only Node.js 20+.

## Run it

```bash
cd showcase/snake-race
cp .env.example .env        # add TYPESAFE_API_KEY, check LAYA_BASE_URL

# Terminal 1: serve Laya with System One Runtime (https://github.com/LiteVar/system-one)
git clone https://github.com/LiteVar/system-one && cd system-one
cargo run --release -- serve   # 127.0.0.1:8080, downloads Laya Multilingual on first use

# Terminal 2: the race
node server.mjs
# open http://127.0.0.1:5173
```

Pick a lane for each side, choose a mode, and press **Start**.

To try the UI with no keys or models, run `node server.mjs --mock`. That adds two **mock** lanes: a simple heuristic with simulated ~35 ms and ~250 ms latency. They exist only to test the harness, and the UI labels them. Never report their numbers as model results.

Your API key stays in `.env` (git-ignored) and on the local server. The browser only talks to `127.0.0.1`.

## Benchmark without the UI

```bash
node bench.mjs --n 200 --warmup 10 --seed 7
```

This sends the same fixed set of positions to every configured lane, one request at a time after a warm-up, and prints p50/p95/p99 latency, **safe move %** (didn't walk into a wall or its own body), and **closer to food %**. The fixed seed means every lane sees byte-identical requests, and runs are repeatable.

## Keep the race fair

- **Jev is remote and Laya is local**, so Jev's model time includes the internet round trip. Say so when you share results. Run from a region near the API, or put Laya behind a remote server too if you want a like-for-like network.
- **Name the hardware** Laya runs on (GPU or CPU) and the exact models (`JEV_MODEL`, `LAYA_MODEL`).
- **Report p50/p95/p99**, not a single fastest run, and publish the `bench.mjs` output alongside any video.
- **Prompts are identical by construction.** Both lanes get the same state string and question from [`snake.mjs`](snake.mjs). If you change the wording, rerun both.

## How a move is asked

The state spells out the board, head, food, direction, and what each legal move would hit, followed by an ASCII grid:

```
Snake game on a 16x16 grid. Row 0 is the top, column 0 is the left.
Legend: H = snake head, o = snake body, * = food, . = empty. Leaving the grid or hitting the body kills the snake.
Head: (row 8, col 5). Food: (row 3, col 11). Current direction: right. Length: 3.
Moving up: is empty, food is then 10 steps away.
Moving down: is empty, food is then 12 steps away.
Moving right: is empty, food is then 10 steps away.
Grid:
................
...
```

The question is a `choice` over the legal moves (never the reverse direction):

```json
{
  "move": {
    "type": "choice",
    "instructions": "Pick the snake's next move. Never move into a wall or the snake's body. Among safe moves, get closer to the food.",
    "criteria": { "up": "Move one cell up (row - 1).", "down": "…", "right": "…" }
  }
}
```

The state deliberately includes the consequence of each move, because this showcase measures *speed at reading the situation and deciding*, not spatial reasoning. To test raw board reading instead, remove the `Moving …` lines in `encodeState` and compare how both models do.

## Files

| File | What it does |
|---|---|
| `server.mjs` | Serves the page and proxies `/api/decide` to each lane's `/v1/systemone`, timing the upstream call |
| `snake.mjs` | Game rules, seeded RNG, and the shared state/question encoding |
| `public/` | The split-screen UI |
| `bench.mjs` | Headless latency and quality benchmark |
| `mock.mjs` | Offline mock backend for testing |
