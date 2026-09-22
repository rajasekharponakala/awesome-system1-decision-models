# Launch video

A 21.5-second launch video for the Snake race, written as a [Hyperframes](https://www.npmjs.com/package/hyperframes) composition. The storyboard follows the rules of the [/brag](https://github.com/latent-spaces/brag) skill: a hook in the first 2 seconds, text held long enough to read, and real product UI rather than filler.

It's rendered by [`.github/workflows/render-video.yml`](../../../.github/workflows/render-video.yml) on every push to this folder, or manually from Actions → Render launch video. That job uses no secrets and no AI agent: it lints, checks, and renders this file, then uploads `snake-race.mp4` and a poster frame as the `snake-race-video` artifact.

## Honesty rules

- **Every number** comes from the `RESULTS` block at the top of the script in `index.html`, copied from [`../RESULTS.md`](../RESULTS.md) (the `bench.mjs` output from GitHub Actions).
- **The race replay and the tick-rate ladder are derived from those numbers.** A lane "misses" a tick rate when its measured p50 is above that rate's deadline, and a snake can only turn when its model answers within the 250 ms tick. A lane with no data shows "n/a" and an empty board, never a made-up replay.
- **Setup caveats are shown on screen:** Jev over the internet, Laya on a CPU-only runner.
- **Mock lanes never appear.**

## Storyboard

| # | Time | Scene | On screen |
|---|---|---|---|
| 1 | 0–3.5 s | Hook | "Every move is one question." → "Answer before the next tick, or crash." → `move = choice(up · down · left)` |
| 2 | 3.5–10.5 s | The race | Split-screen boards recreated from the app UI (lane colors, grid, food), Jev vs Laya at 4 Hz, each with its measured median and "in time" / "too slow" |
| 3 | 10.5–15.5 s | Turn it up | 4 → 6 → 8 → 10 Hz rows, each lane ✓ in time or ✗ misses, from p50 vs deadline |
| 4 | 15.5–18.9 s | Measured | p50, p95, and safe-move % per model, plus the setup caveats |
| 5 | 18.9–21.5 s | Outro | "Race them yourself." + `node showcase/snake-race/server.mjs` + repo URL |

**Audio:** sparse Kenney CC0 impact sounds on scene changes, fetched at render time from brag's pinned commit. There is no music: brag's bundled tracks don't yet have verified redistribution terms.

## Updating the numbers

After a new benchmark run, update `../RESULTS.md` and the `RESULTS` block in `index.html` together, then push. The video re-renders automatically.
