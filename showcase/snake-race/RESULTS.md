# Benchmark results

Output of [`bench.mjs`](bench.mjs) from GitHub Actions: [run #8](https://github.com/rajasekharponakala/awesome-system1-decision-models/actions/runs/35774667262), 22 September 2026. Both models got the same 100 Snake positions (seed 7) as byte-identical requests, one at a time, after 10 warm-up calls that were discarded.

| Model | Served model | p50 | p95 | p99 | Safe moves | Closer to food | Errors |
|---|---|---|---|---|---|---|---|
| Jev (TypeSafe API) | `jev-1.13.0` | 164.3 ms | 243.4 ms | 386.5 ms | 100.0% | 100.0% | 0 |
| Laya (System One Runtime, CPU) | `laya-multilingual` | 3621.6 ms | 3731.7 ms | 3770.0 ms | 81.0% | 45.5% | 0 |

- **Safe moves:** the chosen move did not hit a wall or the snake's own body.
- **Closer to food:** the move reduced the distance to the food. This is counted only on positions where such a safe move existed.

## Laya runtimes and checkpoints (run #9)

[Run #9](https://github.com/rajasekharponakala/awesome-system1-decision-models/actions/runs/36175016878), 25 September 2026: same 100 positions (seed 7), 10 warm-up calls discarded, each lane on its own CPU-only `ubuntu-latest` runner. This run compares ways of running Laya: its own server, [`laya-serve`](https://github.com/NandhaKishorM/laya) (v0.3.20, PyTorch, CPU), with each checkpoint, and System One Runtime.

| Laya lane | p50 | p95 | p99 | Safe moves | Closer to food | Errors |
|---|---|---|---|---|---|---|
| `multilingual` via laya-serve | 586.8 ms | 609.4 ms | 610.6 ms | 81.0% | 43.4% | 0 |
| `typed-decisions` via laya-serve | 1452.8 ms | 1504.9 ms | 1528.0 ms | 95.0% | 50.5% | 0 |
| `english` via laya-serve | 1568.0 ms | 1626.1 ms | 1636.8 ms | 88.0% | 47.5% | 0 |
| `laya-multilingual` via System One Runtime | 2218.9 ms | 2312.2 ms | 2453.1 ms | 81.0% | 45.5% | 0 |

- **Runtime matters.** The same multilingual checkpoint is about 3.8× faster through `laya-serve` than through System One (587 ms vs 2,219 ms p50), with the same 81% safe moves. System One's time also varies between runs: 3,622 ms in run #8.
- **Checkpoint matters for quality.** The fine-tuned `typed-decisions` checkpoint makes the best choices (95% safe moves). It was fine-tuned on a different task (the typed-decisions benchmark), not on Snake.
- **Everything is still on CPU.** The English and typed-decisions checkpoints are larger (421M vs 322M) and slower here. Laya's authors report about 33 ms per question on a T4 GPU, so none of these are GPU numbers.
- `laya-serve` reports every checkpoint as `laya-rl-agent` in the response's `model` field. The differing speed and quality across lanes show that each request's checkpoint choice was applied.
- Jev also ran in this job, but its numbers are not published here while [TypeSafe's terms of use](https://typesafe.ai/) on benchmarking are being checked.

## Read this before quoting it (run #8)

These numbers describe **this setup**, not the models in general.

- **Different machines.** Each lane ran on its own GitHub-hosted `ubuntu-latest` runner.
- **Jev** was called over the internet from the runner, so its latency includes that network round trip.
- **Laya ran on a CPU with no GPU.** It used System One Runtime (`LiteVar/system-one@80302bd`) with llama.cpp `b10964` built for AVX2. Laya's authors report about 33 ms per question on a T4 GPU; [@receptron/laya](https://github.com/receptron/laya) reports about 140 ms on CPU. The 3.6 s here is far slower than either figure, so this setup should not be read as a general Laya speed claim.
- **The prompts are long.** Each Snake request is roughly 400 tokens, including a 16×16 text grid. System One sets up llama.cpp with a 16-sequence, 1,024-token-per-sequence context, and encoder cost grows with input length. A shorter state would be faster.
- **Laya used the base multilingual checkpoint.** Laya's authors note that the base checkpoints are weak on zero-shot typed decisions and that the fine-tuned `laya-typed-decisions` checkpoint is much stronger. System One Runtime currently serves only `laya-multilingual`.
- **A workaround was needed to run Laya on Linux.** System One's managed Linux llama.cpp runtime loads its compute backends as plugins, and System One never loads them, so the model fails with "no backends are loaded". The workflow builds the same llama.cpp release with the CPU backend linked in instead. See [`.github/workflows/snake-race-bench.yml`](../../.github/workflows/snake-race-bench.yml).

## What it means for the race

At 4 Hz the game gives each model 250 ms per move.

- **Jev:** its median (164 ms) and p95 (243 ms) both fit within that deadline.
- **Laya:** in this CPU setup it misses nearly every tick, so its snake can't steer in fixed-tick mode.

Free-run mode still lets Laya play at its own pace. It's the fairer view of decision quality for this setup.

## Reproduce

Actions → **Snake race benchmark** → Run workflow. Set positions, seed, and the `LiteVar/system-one` ref there. To compare Laya fairly on speed, run the harness locally on a GPU machine: `node bench.mjs` with `LAYA_BASE_URL` pointing at your own System One Runtime.
