# System 1 Game Arena

Every open-weights System 1 model that fits on a CPU, playing the same six games, so you can see which model is best at which kind of decision. It builds on the [Snake race](../snake-race): each move or verdict is one `/v1/systemone` question, and every model gets byte-identical requests.

Results: **[RESULTS.md](RESULTS.md)**. The launch video at the top of the main README is rendered from the same run.

## The games

Each game was picked to test one thing System 1 models are used for in practice.

| Game | Primitive | What it tests | Scored by |
|---|---|---|---|
| **Snake** | Choice (3 moves) | Reading a board and acting at 4 moves per second (250 ms deadline) | Safe moves % |
| **Flappy Bird** | Noul ("flap now?") | One yes/no per frame at 10 per second (100 ms deadline) | Accuracy % |
| **Spam Invaders** | Noul ("spam?") | Content moderation | F1 |
| **Babel Desk** | Choice (4 queues) | Ticket routing in 12 languages, 7 of them in non-Latin scripts | Accuracy % |
| **On-call Pager** | Score (1–5) | Ordinal severity triage of log lines | Within one level % |
| **Text GeoGuessr** | Choice (24 countries) | World knowledge over a large option set | Accuracy % |
| **Bankroll Duel** | Noul probabilities | Calibration: a Kelly bettor stakes each model's yes/no probability on every Flappy Bird and Spam Invaders item, starting from 1,000 chips | Chips left |

Snake and Flappy Bird positions are generated from a seed (7 by default). For both, the state spells out what each action leads to, so the games measure how quickly a model reads a situation and decides, not spatial planning. The text games use hand-written, hand-labelled items in [`fixtures.mjs`](fixtures.mjs). If you think a label is wrong, open an issue: a label change affects every model's score.

"Best" at a game is the model with the highest score among models that answered at least 90% of its items. Ties go to the faster model.

## The models

| Lane | Server | Notes |
|---|---|---|
| Laya english / multilingual / typed-decisions | `laya-serve` ([laya](https://github.com/NandhaKishorM/laya) 0.4.7) | PyTorch on CPU |
| Von 1.3 | `von serve` ([von-sdk](https://github.com/wfzyx/von) 1.3.7, OpenVINO) | Default Noul "band" setting, as shipped |
| Largha | [`phocinae-server`](https://github.com/Phocinae/phocinae-server) 0.1.6 | Its API takes bare option strings and fixed instructions, so [`lanes.mjs`](lanes.mjs) puts the question at the top of the state and maps Largha's 2–10 score scale onto the game's levels |
| Kev-0.8B | `kev.serve` ([kev](https://github.com/jaredpalmer/kev) at a pinned commit) | fp32 on CPU |
| OneJev 1.5-0.8B | `qev serve` ([OneJev](https://github.com/OmniJev/OneJev) at a pinned commit) | Text only, fp32 on CPU |
| System One Gemma | [`servers/gemma_server.py`](servers/gemma_server.py) | The project ships a Gradio demo, not an API, so the arena wraps its scorer. The base weights come from Unsloth's ungated copy of Gemma 3 270M because the job has no Hugging Face token. The scorer reads at most 256 tokens, so long Snake states are cut |

**Not in the arena:** these open models need more memory than a 16 GB, GPU-less runner has: Clef and Clef-flash (Cloudflare, 27B/9B, about 85 GB / 41 GB of VRAM), OpenJev (DiffusionGemma 26B, 24 GB+ GPU), Kev-4B/9B/27B, and OneJev 4B/9B/27B. Hosted models (Jev, Hesperan, Mercury Decide, Microsoft-Decision-1, OpenAI's Decisions API) are left out on purpose: this arena compares models you can run yourself.

## Run it

```bash
cd showcase/game-arena

# One lane: any Jev-compatible server
pip install "laya[serve]" && LAYA_DEVICE=cpu laya-serve &      # port 8000
ARENA_URL=http://127.0.0.1:8000 ARENA_MODEL=english ARENA_LABEL="Laya english" \
  node arena.mjs --out results/laya-english

# Merge lanes into one report
node report.mjs results/* --summary summary.json > report.md

# Test the harness with no models (random stand-ins; never report these numbers)
node arena.mjs --mock
```

Set `ARENA_FORMAT=phocinae` for Largha's server. `--games snake,spam` runs a subset, and `--snake` / `--flappy` / `--seed` change the generated positions.

In CI, [`.github/workflows/game-arena.yml`](../../.github/workflows/game-arena.yml) runs every lane in its own job (no secrets in any of them) and uploads `arena-report` with `report.md` and `summary.json`. To update the video, run `node to-video.mjs summary.json "run #N"`, which writes the numbers into [`../snake-race/video/index.html`](../snake-race/video/index.html), then push. The render workflow does the rest.

## Files

| File | What it does |
|---|---|
| `games.mjs` | Game definitions, item generation, and scoring |
| `fixtures.mjs` | Hand-labelled items for Spam Invaders, Babel Desk, On-call Pager and Text GeoGuessr |
| `lanes.mjs` | Lane config, the `jev` and `phocinae` wire adapters, answer normalisation, mock lanes |
| `arena.mjs` | Plays every game against one lane and writes `results.json` |
| `report.mjs` | Merges lanes into a Markdown report and `summary.json` |
| `to-video.mjs` | Copies `summary.json` into the launch video's data block |
| `servers/gemma_server.py` | `/v1/systemone` wrapper for System One Gemma |
