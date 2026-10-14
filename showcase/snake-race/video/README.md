# Launch video

A 41-second launch video for the [game arena](../../game-arena), written as a [Hyperframes](https://www.npmjs.com/package/hyperframes) composition. Every open System 1 model that runs on a CPU plays six games, and the video shows which model wins each one. The storyboard follows the rules of the [/brag](https://github.com/latent-spaces/brag) skill: a hook in the first 2 seconds, text held long enough to read, and real measured results rather than filler.

It's rendered by [`.github/workflows/render-video.yml`](../../../.github/workflows/render-video.yml) on every push to this folder, or manually from Actions → Render launch video. That job uses no secrets and no AI agent: it lints, checks, and renders this file, then uploads `snake-race.mp4`, a poster frame and a GIF preview as the `snake-race-video` artifact. On the default branch it also commits them to `docs/media/`.

## Honesty rules

- **Every number** comes from the `RESULTS` block in `index.html`. [`to-video.mjs`](../../game-arena/to-video.mjs) writes that block from the `summary.json` of a [game-arena workflow](../../../.github/workflows/game-arena.yml) run, and [`../../game-arena/RESULTS.md`](../../game-arena/RESULTS.md) records the same run.
- **Bars are drawn to scale** from those numbers (a log scale for Bankroll Duel chips, which span many orders of magnitude). A model that answered less than 90% of a game's items shows "did not finish", never a guessed value.
- **The setup caveat is on screen:** CPU-only runners, hand-labelled text games.
- **Mock lanes never appear.**

## Storyboard

| # | Time | Scene | On screen |
|---|---|---|---|
| 1 | 0–3.5 s | Hook | "8 open models. 7 games." → "One question per move. Which one plays best?" → `choice` · `noul` · `score` |
| 2 | 3.5–7.5 s | Line-up | Every model in the arena, plus the open models too big for a CPU runner |
| 3–9 | 7.5–32.7 s | One scene per game | Game name, primitive, what it tests, ranked bars for every model, a BEST tag, median latency, and for real-time games how many models meet the deadline |
| 10 | 32.7–38.2 s | What's best for what | Winner and fastest model for each game, and the best all-rounder by mean rank |
| 11 | 38.2–41 s | Outro | "Run the arena yourself." + `node showcase/game-arena/arena.mjs` + repo URL and run |

**Audio:** sparse Kenney CC0 impact sounds on scene changes, fetched at render time from brag's pinned commit. There is no music: brag's bundled tracks don't yet have verified redistribution terms.

## Updating the numbers

After a new game-arena run, download its `arena-report` artifact, then:

```bash
node showcase/game-arena/to-video.mjs path/to/summary.json "run #N"
```

Update `../../game-arena/RESULTS.md` from the same run's `report.md`, then push. The video re-renders automatically.
