# Game arena results

Output of [`report.mjs`](report.mjs) for [run #2](https://github.com/rajasekharponakala/awesome-system1-decision-models/actions/runs/38551999470) of the [game-arena workflow](../../.github/workflows/game-arena.yml), 14 October 2026. Eight open models, each on its own GitHub-hosted `ubuntu-latest` runner (4 vCPU, **no GPU**), got byte-identical requests one at a time, after 5 warm-up calls that were discarded. The run's [`summary.json`](results/run-2/summary.json) is committed, and the launch video is rendered from it.

[Run #1](https://github.com/rajasekharponakala/awesome-system1-decision-models/actions/runs/38550499821) gave the same quality score for every model in every game. [Run #3](https://github.com/rajasekharponakala/awesome-system1-decision-models/actions/runs/38554283984) named the same winner in every game; one quality score moved (Von's Spam Invaders F1, 0.913 → 0.936). Latency varies much more between runs, by up to about 1.7×, because each lane gets a different shared runner.

Ties are settled by a second quality metric (for example exact level on On-call Pager). Models still level share the win. The tables below were re-derived from run #2's data with that rule, which the workflow now applies itself.

## What's best for what

- **Real-time control (Snake, Flappy Bird):** **Kev-0.8B** makes the best moves (100% safe Snake moves, 65% correct flaps), with OneJev 1.5-0.8B close behind. On a CPU only the small models get near Snake's 250 ms tick: **Von** made it in this run (224 ms), and **Largha** missed narrowly (267 ms) but made it in run #3 (156 ms). No model meets Flappy Bird's 100 ms. If the deadline matters more than the last few percent of quality, pick Von or Largha; for quality, run Kev or OneJev on a GPU.
- **Flappy Bird is hard for everyone.** Six of the eight models score exactly 50%, because they give the same answer for every frame. Deciding whether to flap means projecting the bird a few ticks ahead, which is closer to System 2 work than to reading a situation.
- **Content moderation (Spam Invaders):** **Laya english** is clearly best (0.98 F1, 97.9% accuracy), ahead of Von (0.91). Largha and System One Gemma are near chance here.
- **Multilingual routing (Babel Desk):** **Kev-0.8B and OneJev 1.5-0.8B tie at 100%**, Latin and non-Latin scripts alike. For speed, **Largha** (97.9%, 113 ms) and **Laya multilingual** (95.8%, 146 ms) are nearly as accurate at a fraction of the latency. Laya's English checkpoint drops to 67% on non-Latin scripts, as its authors warn, and Von reaches 48%.
- **Severity triage (On-call Pager, Score):** **OneJev 1.5-0.8B** is within one level on every log line and exactly right on 83%. Kev-0.8B is also always within one level, but exactly right on only 50%.
- **Large option sets (Text GeoGuessr, 24 countries):** **Von** wins (83.3%) and is also the fastest model there. Largha scores 12.5% here; its server has no per-question instructions, so this game depends on the adapter described below.
- **Calibration (Bankroll Duel):** **OneJev 1.5-0.8B** ends with the most chips, ahead of Laya typed-decisions. Laya english, the best spam filter, nearly goes broke because it is confidently wrong on Flappy Bird. Good accuracy on one task does not make probabilities trustworthy on another.
- **Overall:** by mean rank across all seven games, **OneJev 1.5-0.8B** (2.0) is the best all-rounder, then Kev-0.8B (2.7). Both are the largest models here and the slowest on CPU, at 1–3 s per decision.

## Read this before quoting it

- **CPU only.** Every latency here is CPU latency on a shared 4-vCPU runner, with each model on a different runner. All of these models are much faster on a GPU (their authors report tens of milliseconds), so the "in time" columns describe this setup only.
- **Small, hand-labelled test sets.** The text games have 24–48 items each, with labels written for this benchmark in [`fixtures.mjs`](fixtures.mjs). A difference of one or two items is within noise.
- **Each model runs as its server ships**, with default settings. Von's default Noul "band" moves every yes/no probability outside 0.2–0.8, which shapes its Bankroll Duel result.
- **Adapters.** Largha's server takes bare options and fixed instructions, so the question is placed at the top of its state, and its 2–10 score scale is mapped onto the game's levels. System One Gemma runs through the arena's own wrapper, with base weights from Unsloth's ungated copy of Gemma 3 270M, and reads at most 256 tokens. See [README.md](README.md#the-models).
- **Not included:** Clef, Clef-flash, OpenJev, and the 4B-and-up sizes of Kev and OneJev need a data-centre GPU. Hosted models (Jev and the other commercial APIs) are out of scope.

## Best at each game

| Game | Primitive | What it tests | Best | Runner-up | Fastest (p50) |
|---|---|---|---|---|---|
| Snake | Choice (3 moves) | Reading a board fast, 4 moves per second | **Kev-0.8B** (100% safe moves) | OneJev 1.5-0.8B (98.3%) | Von 1.3 (395M) (224 ms) |
| Flappy Bird | Noul (flap?) | One yes/no per frame, 10 per second | **Kev-0.8B** (65% accuracy) | OneJev 1.5-0.8B (57.5%) | Largha (144M) (181 ms) |
| Spam Invaders | Noul (spam?) | Content moderation, calibrated yes/no | **Laya english (421M)** (0.980 F1) | Von 1.3 (395M) (0.913) | Largha (144M) (83 ms) |
| Babel Desk | Choice (4 queues) | Ticket routing in 12 languages, 7 non-Latin scripts | **Kev-0.8B** and **OneJev 1.5-0.8B**, tied (100% accuracy) | Largha (144M) (97.9%) | Von 1.3 (395M) (107 ms) |
| On-call Pager | Score (1-5) | Ordinal severity triage | **OneJev 1.5-0.8B** (100% within one level) | Kev-0.8B (100%) | Von 1.3 (395M) (111 ms) |
| Text GeoGuessr | Choice (24 countries) | World knowledge over a large option set | **Von 1.3 (395M)** (83.3% accuracy) | OneJev 1.5-0.8B (79.2%) | Von 1.3 (395M) (112 ms) |
| Bankroll Duel | Noul probabilities | Calibration: bets its confidence on every yes/no answer | **OneJev 1.5-0.8B** (2.3e+9 chips) | Laya typed-decisions (421M) (1.1e+9) | – |

Overall (mean rank across 7 games): 1. OneJev 1.5-0.8B (2.0) · 2. Kev-0.8B (2.7) · 3. Laya typed-decisions (421M) (3.7) · 4. Von 1.3 (395M) (4.4) · 5. Laya english (421M) (5.4) · 6. System One Gemma (270M) (5.7) · 7. Largha (144M) (5.9) · 8. Laya multilingual (322M) (5.9)

## Per-game results

### Snake: Choice (3 moves)

Reading a board fast, 4 moves per second. Best = highest **safe moves %**; ties go to higher closer to food %. Deadline 250 ms per decision.

| Lane | answered | safe moves % | closer to food % | p50 ms | p95 ms | in time % | errors |
|---|---|---|---|---|---|---|---|
| Kev-0.8B | 60 | 100% | 67.8% | 1690 ms | 1779 ms | 0% | 0 |
| OneJev 1.5-0.8B | 60 | 98.3% | 67.8% | 2761 ms | 2900 ms | 0% | 0 |
| Laya typed-decisions (421M) | 60 | 96.7% | 44.1% | 966 ms | 1002 ms | 0% | 0 |
| System One Gemma (270M) | 60 | 95% | 32.2% | 1293 ms | 1370 ms | 0% | 0 |
| Laya english (421M) | 60 | 93.3% | 47.5% | 1435 ms | 1494 ms | 0% | 0 |
| Von 1.3 (395M) | 60 | 93.3% | 37.3% | 224 ms | 228 ms | 100% | 0 |
| Largha (144M) | 60 | 91.7% | 45.8% | 267 ms | 271 ms | 0% | 0 |
| Laya multilingual (322M) | 60 | 76.7% | 28.8% | 408 ms | 431 ms | 0% | 0 |

### Flappy Bird: Noul (flap?)

One yes/no per frame, 10 per second. Best = highest **accuracy %**; ties go to lower Brier. Deadline 100 ms per decision.

| Lane | answered | accuracy % | F1 | Brier | bankroll | p50 ms | p95 ms | in time % | errors |
|---|---|---|---|---|---|---|---|---|---|
| Kev-0.8B | 40 | 65% | 0.741 | 0.226 | 7477 | 1226 ms | 1277 ms | 0% | 0 |
| OneJev 1.5-0.8B | 40 | 57.5% | 0.702 | 0.237 | 2817 | 2109 ms | 2145 ms | 0% | 0 |
| Largha (144M) | 40 | 55% | 0.182 | 0.241 | 2058 | 181 ms | 183 ms | 0% | 0 |
| Laya english (421M) | 40 | 50% | 0.667 | 0.451 | 0 | 1024 ms | 1055 ms | 0% | 0 |
| Laya multilingual (322M) | 40 | 50% | 0.667 | 0.422 | 0 | 266 ms | 274 ms | 0% | 0 |
| Laya typed-decisions (421M) | 40 | 50% | 0.667 | 0.310 | 4 | 680 ms | 717 ms | 0% | 0 |
| System One Gemma (270M) | 40 | 50% | 0 | 0.254 | 716 | 602 ms | 641 ms | 0% | 0 |
| Von 1.3 (395M) | 40 | 50% | 0 | 0.351 | 0 | 207 ms | 215 ms | 0% | 0 |

### Spam Invaders: Noul (spam?)

Content moderation, calibrated yes/no. Best = highest **F1**; ties go to lower Brier.

| Lane | answered | accuracy % | F1 | Brier | bankroll | p50 ms | p95 ms | errors |
|---|---|---|---|---|---|---|---|---|
| Laya english (421M) | 48 | 97.9% | 0.980 | 0.027 | 1.5e+15 | 463 ms | 511 ms | 0 |
| Von 1.3 (395M) | 48 | 91.7% | 0.913 | 0.082 | 9.2e+10 | 96 ms | 104 ms | 0 |
| Laya multilingual (322M) | 48 | 85.4% | 0.873 | 0.135 | 2.2e+6 | 110 ms | 125 ms | 0 |
| Laya typed-decisions (421M) | 48 | 83.3% | 0.810 | 0.089 | 2.8e+11 | 297 ms | 340 ms | 0 |
| OneJev 1.5-0.8B | 48 | 77.1% | 0.703 | 0.133 | 8.3e+8 | 1269 ms | 1344 ms | 0 |
| System One Gemma (270M) | 48 | 52.1% | 0.676 | 0.246 | 1657 | 216 ms | 253 ms | 0 |
| Largha (144M) | 48 | 54.2% | 0.633 | 0.245 | 1671 | 83 ms | 91 ms | 0 |
| Kev-0.8B | 48 | 72.9% | 0.629 | 0.156 | 3.2e+7 | 582 ms | 646 ms | 0 |

### Babel Desk: Choice (4 queues)

Ticket routing in 12 languages, 7 non-Latin scripts. Best = highest **accuracy %**; ties go to higher other scripts %.

| Lane | answered | accuracy % | Latin script % | other scripts % | p50 ms | p95 ms | errors |
|---|---|---|---|---|---|---|---|
| Kev-0.8B | 48 | 100% | 100% | 100% | 807 ms | 857 ms | 0 |
| OneJev 1.5-0.8B | 48 | 100% | 100% | 100% | 1474 ms | 1545 ms | 0 |
| Largha (144M) | 48 | 97.9% | 100% | 95.8% | 113 ms | 121 ms | 0 |
| Laya multilingual (322M) | 48 | 95.8% | 95.8% | 95.8% | 146 ms | 159 ms | 0 |
| Laya typed-decisions (421M) | 48 | 83.3% | 100% | 66.7% | 439 ms | 592 ms | 0 |
| Laya english (421M) | 48 | 79.2% | 91.7% | 66.7% | 683 ms | 883 ms | 0 |
| System One Gemma (270M) | 48 | 72.9% | 75% | 70.8% | 428 ms | 486 ms | 0 |
| Von 1.3 (395M) | 48 | 47.9% | 58.3% | 37.5% | 107 ms | 157 ms | 0 |

### On-call Pager: Score (1-5)

Ordinal severity triage. Best = highest **within one level %**; ties go to higher exact %.

| Lane | answered | exact % | within one level % | MAE | p50 ms | p95 ms | errors |
|---|---|---|---|---|---|---|---|
| Kev-0.8B | 30 | 50% | 100% | 0.604 | 971 ms | 1025 ms | 0 |
| OneJev 1.5-0.8B | 30 | 83.3% | 100% | 0.322 | 1878 ms | 1942 ms | 0 |
| Laya typed-decisions (421M) | 30 | 23.3% | 96.7% | 0.813 | 516 ms | 535 ms | 0 |
| Von 1.3 (395M) | 30 | 46.7% | 93.3% | 0.724 | 111 ms | 117 ms | 0 |
| Laya english (421M) | 30 | 36.7% | 86.7% | 0.882 | 796 ms | 824 ms | 0 |
| Laya multilingual (322M) | 30 | 20% | 63.3% | 1.302 | 209 ms | 231 ms | 0 |
| System One Gemma (270M) | 30 | 26.7% | 63.3% | 1.185 | 541 ms | 611 ms | 0 |
| Largha (144M) | 30 | 23.3% | 56.7% | 1.700 | 162 ms | 168 ms | 0 |

### Text GeoGuessr: Choice (24 countries)

World knowledge over a large option set. Best = highest **accuracy %**.

| Lane | answered | accuracy % | p50 ms | p95 ms | errors |
|---|---|---|---|---|---|
| Von 1.3 (395M) | 24 | 83.3% | 112 ms | 115 ms | 0 |
| OneJev 1.5-0.8B | 24 | 79.2% | 2277 ms | 2327 ms | 0 |
| Kev-0.8B | 24 | 70.8% | 1129 ms | 1193 ms | 0 |
| Laya multilingual (322M) | 24 | 62.5% | 174 ms | 184 ms | 0 |
| Laya typed-decisions (421M) | 24 | 62.5% | 467 ms | 489 ms | 0 |
| Laya english (421M) | 24 | 58.3% | 721 ms | 748 ms | 0 |
| System One Gemma (270M) | 24 | 29.2% | 2628 ms | 2855 ms | 0 |
| Largha (144M) | 24 | 12.5% | 127 ms | 130 ms | 0 |

### Bankroll Duel: Noul probabilities

Calibration: bets its confidence on every yes/no answer. Best = highest **chips**.

| Lane | answered | chips |
|---|---|---|
| OneJev 1.5-0.8B | 88 | 2.3e+9 |
| Laya typed-decisions (421M) | 88 | 1.1e+9 |
| Kev-0.8B | 88 | 2.4e+8 |
| Von 1.3 (395M) | 88 | 2.8e+6 |
| Largha (144M) | 88 | 3440 |
| System One Gemma (270M) | 88 | 1186 |
| Laya english (421M) | 88 | 6 |
| Laya multilingual (322M) | 88 | 0 |

Items: seed 7, 60 Snake and 40 Flappy positions, 5 warm-up calls. Every lane got byte-identical requests, one at a time. Runners: GitHub ubuntu-latest, 4 vCPU, no GPU.
