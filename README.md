# Awesome System 1 Decision Models [![Awesome](https://awesome.re/badge.svg)](https://awesome.re)

> A curated list of **System 1 decision models**: models such as [TypeSafe Jev](https://typesafe.ai/) and [Convai Laya](https://github.com/NandhaKishorM/laya) that return **typed, calibrated decisions** in a single forward pass. They do not generate text, plus you'll find the SDKs, runtimes, integrations, and use cases around them here.

The name comes from Daniel Kahneman's *Thinking, Fast and Slow*. **System 1** is fast and intuitive, and **System 2** is slow and deliberate. A generative LLM behaves like System 2: it writes an answer token by token, and your code then parses it. A System 1 model reads the input once and scores a fixed set of answers you define. The output is always a value from your schema, with a probability attached, so there is no free text to parse and no answer outside the options.

## Contents

- [Core Concepts](#core-concepts)
- [Models](#models)
  - [Commercial](#commercial)
  - [Open Weights](#open-weights)
  - [Open Reproductions and Research](#open-reproductions-and-research)
- [Runtimes and Servers](#runtimes-and-servers)
- [Official SDKs](#official-sdks)
- [Community SDKs and Clients](#community-sdks-and-clients)
- [Provider and Framework Integrations](#provider-and-framework-integrations)
- [Tools and Applications](#tools-and-applications)
- [Evaluation and Calibration](#evaluation-and-calibration)
- [Use Cases: When System 1 Wins](#use-cases-when-system-1-wins)
- [Design Patterns](#design-patterns)
- [Showcase Ideas: Games and Puzzles](#showcase-ideas-games-and-puzzles)
- [Guides and Articles](#guides-and-articles)
- [Related Lists](#related-lists)

---

## Core Concepts

Jev, Laya, Von, and the Jev-compatible runtimes share **three primitives**:

| Primitive | Returns | Use it for | Example question |
|---|---|---|---|
| **Choice** | One option from a list you define, with a probability for each option and a confidence value | Classification, routing, picking a tool or model | "Which team owns this ticket?" → `billing` / `technical` / `other` |
| **Score** | A position on an ordered scale of 2–10 levels described in words; it can land between levels | Rating, triage severity, quality grading, ranking | "How urgent is this incident?" → 1–5 |
| **Noul** (short for Bernoulli) | One probability from 0 to 1 that the answer is yes | Yes/no checks, guardrails, filters | "Does this comment contain personal data?" → `0.93` |

A request carries **state** (unstructured input such as a document, a chat turn, or agent context) and **questions** (the typed primitives above). Many questions can be answered in the same pass, and the answers are read straight from the model's scores, not generated.

Minimal example with the official Python SDK:

```python
from typesafe_sdk import Choice, TypeSafeClient

with TypeSafeClient() as client:  # reads TYPESAFE_API_KEY
    response = client.system_one(
        state={"document": "I was charged twice. Please fix this ASAP."},
        questions={
            "category": Choice(
                instructions="What is this ticket about?",
                criteria={"billing": None, "technical": None, "other": None},
            ),
        },
    )

print(response.choices["category"].choice)  # -> "billing"
```

Jev-compatible open runtimes expose the same `POST /v1/systemone` wire format, so this code can point at a local server.

---

## Models

### Commercial

- [Jev (TypeSafe AI)](https://typesafe.ai/): The model that defined the category, released 15 September 2026. It is served at `POST https://api.typesafe.ai/v1/systemone` (model route `jev-latest`). TypeSafe reports it as 40–200× faster than frontier LLMs on comparable tasks. [Launch post](https://typesafe.ai/blog/introducing-system-one-models-and-jev) · [Docs](https://docs.typesafe.ai/) · [Models & pricing](https://docs.typesafe.ai/models) · [Known limitations (Jev 1.13)](https://docs.typesafe.ai/model-jaggedness/jev-1.13)

### Open Weights

- [Laya (Convai Innovations)](https://github.com/NandhaKishorM/laya): An Apache-2.0 System 1 model trained with RL against strictly proper scoring rules (RLCD), so its probabilities are calibrated. The English model is ModernBERT-large (421M) and the multilingual one is mmBERT-base (322M, 100+ languages). It supports `choice`, `score`, and `noul`, and runs in about 33 ms per question on a T4 GPU (about 7 ms batched). Install with `pip install laya`.
  - Checkpoints: [`laya`](https://huggingface.co/convaiinnovations/laya) · [`laya-multilingual`](https://huggingface.co/convaiinnovations/laya-multilingual) · [`laya-typed-decisions`](https://huggingface.co/convaiinnovations/laya-typed-decisions) (fine-tuned; the authors report 0.766 accuracy against Jev's 0.727 on their typed-decisions benchmark) · [Demo](https://huggingface.co/spaces/convaiinnovations/laya-demo)
- [Von](https://github.com/wfzyx/von): An Apache-2.0 model built on ModernBERT-large (395M). It claims under 15 ms latency and is a drop-in for the `/v1/systemone` spec. Install with `pip install von-sdk`.
- [System One Gemma](https://github.com/akash-kamat/system-one-gemma): Gemma 3 270M with a LoRA scoring head, running in about 50 ms on CPU. The code is Apache-2.0, but the pretrained weights are non-commercial because of CC-BY-NC training data.
- [OpenJev](https://github.com/razorback16/openjev): A Jev-compatible decision server on DiffusionGemma 26B-A4B (Apache-2.0). It runs through vLLM (24 GB+ NVIDIA GPU) or MLX, and adds image support.

### Open Reproductions and Research

- [AnyJev](https://github.com/MorrisZJ/AnyJev): A decision transformer built on open models.
- [Diffusion Jev](https://github.com/Hangzhi/diffusion-jev-sglang): Jev-style decisions on DiffusionGemma served with SGLang.
- [JevForge](https://github.com/zwliJay/jev-forge): A training pipeline for Qwen3.5-based decision models.
- [Jevlike](https://github.com/vinnylarouge/jevlike): A trainable encoder-based decision system.
- [Laya Vision](https://github.com/r33drichards/laya-vision): Adds vision to Laya through SmolVLM.
- [NanoJev](https://github.com/TianyuCodings/NanoJev): A small parallel-decision model.
- [open-jev (MLX)](https://github.com/daseinlabs/open-jev): A Gemma 3 option scorer for Apple silicon.
- [openJev Verdict 2.0](https://github.com/Heman10x-NGU/openJev-verdict-2.0): A decision system built on ModernBERT.
- [Simple Jev](https://github.com/featherless-ai/simple-jev): A minimal transformer that reads decisions from logits.

---

## Runtimes and Servers

- [System One Runtime](https://github.com/LiteVar/system-one): An MIT-licensed, local, cross-platform runtime (macOS/Windows/Linux, x86_64/arm64, Metal/Vulkan) that needs no Python. It exposes a Jev-compatible `POST /v1/systemone` API and a CLI, and currently uses Laya Multilingual as its backend.
- [@receptron/laya](https://github.com/receptron/laya): Runs Laya from Node.js/TypeScript through ONNX Runtime, with no PyTorch. It needs about 2 GB RAM and takes about 140 ms on CPU. Install with `npm install @receptron/laya`.
- [openjev-sglang](https://github.com/ekzhang/openjev-sglang): A Jev-style endpoint on SGLang.
- [jevmlx](https://github.com/bnsd55/jevmlx): Parallel decisions on Apple MLX.

## Official SDKs

- [typesafe-sdk-python](https://github.com/typesafe-ai/typesafe-sdk-python): The Python SDK, with sync and async clients. Install with `uv add typesafe-sdk`.
- [typesafe-sdk-js](https://github.com/typesafe-ai/typesafe-sdk-js): The TypeScript/JavaScript SDK for Node 20+. Install with `npm install @typesafe-ai/sdk`.
- [system-one-adapter-python](https://github.com/typesafe-ai/system-one-adapter-python): Runs System One questions against LLM providers so you can compare the two.
- [typesafe-ai/skills](https://github.com/typesafe-ai/skills): Official agent skills for System One workflows.

## Community SDKs and Clients

- [typesafe-go](https://github.com/zhirschtritt/typesafe-go): An idiomatic Go SDK.
- [typesafe-java](https://github.com/dfa1/typesafe-java): A modular JDK 21+ client.
- [kojev](https://github.com/ItisNoMatter/kojev): A Kotlin Multiplatform client.
- [jev (Elixir)](https://github.com/dannote/jev): An Elixir/OTP client with GenServer patterns.
- [hunch](https://github.com/carldaws/hunch): Probabilistic control flow for Ruby.
- [jevr](https://github.com/simxnherrera/jevr): A native R client.
- [jev-dsl](https://github.com/inanna-malick/jev-dsl): A Haskell DSL (early alpha).
- [zod-jev](https://github.com/jomatsu/zod-jev): Defines System 1 questions from Zod schemas.
- [laravel-typesafe-jev](https://github.com/Butochnikov/laravel-typesafe-jev): A Laravel integration.
- [pytest-jev](https://github.com/allebee/pytest-jev): A pytest plugin that asserts claims with calibrated decisions.

## Provider and Framework Integrations

**Gateways and hosting**
- [Cloudflare Workers AI](https://developers.cloudflare.com/ai/models/typesafe/jev/) · [OpenRouter](https://openrouter.ai/typesafe/jev-1.13) · [Vercel AI Gateway](https://vercel.com/changelog/typesafe-ai-jev-now-available-on-ai-gateway) · [Netlify AI Gateway](https://www.netlify.com/changelog/typesafe-jev-ai-gateway/)

**Frameworks**
- [Pydantic AI](https://github.com/pydantic/pydantic-ai): A TypeSafe model provider with routing.
- [LangChain](https://github.com/langchain-ai/langchain) / [LangChain.js](https://github.com/langchain-ai/langchainjs): A `TypeSafeClassifier` Runnable.
- [LiteLLM](https://github.com/BerriAI/litellm): Complexity routing and guardrails.
- [BAML](https://github.com/BoundaryML/baml): Maps typed function return values to Jev.
- [Ax](https://github.com/ax-llm/ax): A native client for Boolean, Choice, and Score questions.
- [Effect](https://github.com/Effect-TS/effect): `classify`, `probability`, and `rating` operations.
- [TanStack AI](https://github.com/TanStack/ai): The `@tanstack/ai-typesafe` adapter.
- [Rig](https://github.com/0xPlaygrounds/rig): The `rig-typesafeai` crate for Rust.
- [Composio](https://github.com/ComposioHQ/composio): Tool shortlisting and selection.
- [llama-index-jev](https://github.com/WiktorB2004/llama-index-jev): A LlamaIndex reranker.
- [n8n-nodes-typesafe-jev](https://github.com/n3ndor/n8n-nodes-typesafe-jev): An n8n workflow node.

## Tools and Applications

**Agent guardrails and routing**
- [jev-guard](https://github.com/leepokai/jev-guard): Scores the risk of agent tool calls before they run.
- [jev-mcp](https://github.com/BYK/jev-mcp): An eval-first MCP server exposing judgment tools.
- [agent-router](https://github.com/nidhi-singh02/agent-router) / [Switchboard](https://github.com/ruban-24/switchboard): Model and reasoning-effort selection.
- [jev-skill-router](https://github.com/shimo4228/jev-skill-router): Routes prompts to Claude Code skills.
- [jev-belay](https://github.com/valentynkit/jev-belay): A Claude Code stop hook that checks whether the task is actually done.

**Search, RAG, and data**
- [jev-reranker](https://github.com/hotchpotch/jev-reranker): Ranks documents for RAG.
- [jegrep](https://github.com/can1357/jegrep): Semantic grep in Rust with Jev scoring.
- [jevql](https://github.com/kylemclaren/jevql) / [pg-jev](https://github.com/realZachi/pg-jev): Decisions inside PostgreSQL queries.
- [duckdb-jev](https://github.com/colliber/duckdb-jev): A DuckDB extension.
- [jev-curate](https://github.com/AkashPriyadarshii/jev-curate): Filters datasets.

**Ops and inbox triage**
- [jev-logtriage](https://github.com/jyatesdotdev/jev-logtriage) / [jevlogs](https://github.com/reachjalil/jevlogs): Scores log severity and triages OpenTelemetry logs.
- [Inbox Zero](https://github.com/elie222/inbox-zero): An email assistant with a Jev classifier backend.
- [tax-doc-classifier](https://github.com/kyotofin/tax-doc-classifier): Classifies PDF documents.

**Real-time control and games**
- [jev-drone](https://github.com/RomanSlack/jev-drone): Controls a simulated quadrotor.
- [Embodied Jev](https://github.com/FBddcz/embodied-jev): A robot-arm workbench in MuJoCo.
- [jev-tetris](https://github.com/thelau/jev-tetris) / [jev-plays-pokemon-red](https://github.com/valentynkit/jev-plays-pokemon-red): Game-playing agents.

## Evaluation and Calibration

- [jev-benchmarks](https://github.com/AbdelStark/jev-benchmarks): A reproducible evaluation suite.
- [jev-decision-benchmarks](https://github.com/baibizhe/jev-decision-benchmarks): Evaluates agent decision tasks.
- [jev-rerank-bench](https://github.com/anessbelbati/jev-rerank-bench) / [jev-search-rerank-eval](https://github.com/zhuyansen/jev-search-rerank-eval): Evaluates reranking and retrieval.
- [jev-korean-benchmark](https://github.com/mahlernim/jev-korean-benchmark): A study of Korean-language performance.
- [jev-behavior-study](https://github.com/RINNECODER/jev-behavior-study): A study of sensitivity to question framing.
- [jevcal](https://github.com/abhixhek/jevcal): Tunes confidence thresholds on your own labeled data.
- [Laya BENCHMARKS.md](https://github.com/NandhaKishorM/laya): Laya's per-language and per-task results, including where it fails.
- [When a Judgment Layer's Fields Lie](https://doi.org/10.5281/zenodo.22901853): An independent measurement study.

---

## Use Cases: When System 1 Wins

A System 1 model is the better choice when **the answer space is known ahead of time** and you need it **fast, cheap, and reliably parseable**. It is the wrong choice when you need the model to *produce* something.

### Best fits

| Use case | Primitive | Why System 1 beats an LLM here |
|---|---|---|
| **Support ticket / email routing** | Choice | The fixed set of queues matches the schema exactly. It takes milliseconds per ticket and never returns an unknown label. |
| **Content moderation** | Noul (one per policy) | You can ask many independent policy checks in one pass and set a threshold for each in code. Calibrated probabilities make those thresholds meaningful. |
| **Agent tool-call guardrails** | Noul / Score | The check sits on the hot path of every tool call. A 30 ms check is affordable; a 2 s LLM judge is not. |
| **Model / tool / skill routing** | Choice | You decide *which* model to call before paying for it. The router has to cost far less than the thing it routes to. |
| **RAG passage relevance and reranking** | Score / Noul | Scoring 50 passages in parallel is cheap, and there are no LLM-judge parsing failures. |
| **Lead / resume / document triage** | Score + Noul | You get ordinal ratings plus yes/no feature checks ("mentions Kubernetes?"), batched in a single call. |
| **Intent detection in chat and voice** | Choice | Voice and chat need responses under 100 ms, and multilingual models (Laya Multilingual) cover 100+ languages. |
| **Log / alert severity triage** | Score | High volume and low value per item make LLM calls too expensive. |
| **Real-time control (games, robotics, UI)** | Choice | Decisions run at control-loop rates, with no text parsing between the model and an actuator. |
| **Data labeling and filtering** | Choice / Noul | Output is cheap and consistent. Use confidence to send only uncertain rows to humans (active learning). |
| **CI / code-review gates** | Noul / Score | "Does this diff touch auth?" or "Is this commit message conventional?" are deterministic-shaped checks with probabilities attached. |

### When to use a System 2 LLM instead

- **Generating anything**, such as prose, code, summaries, emails, or explanations.
- **Open-ended questions** where you can't list the answers ahead of time.
- **Multi-step reasoning**, math, exact counting, or date arithmetic.
- **Choice spaces too large for one pass**, such as hundreds of labels. Split them into a hierarchy (see [jev-tree](https://github.com/reachjalil/jev-tree)) or shortlist first.
- **When you need a rationale**, for example audits in regulated domains. A System 1 model gives you a number, not a reason.

### Choosing a model

| You need | Pick |
|---|---|
| A managed API, the widest ecosystem, and gateway availability | **Jev** |
| Open weights (Apache-2.0), self-hosting, and multilingual support | **Laya** (Python) or **System One Runtime** / **@receptron/laya** (no Python) |
| The lowest latency on a GPU with local, drop-in `/v1/systemone` | **Von** |
| CPU-only or edge, and you don't need commercial use | **System One Gemma** |
| Large-model accuracy or image input, self-hosted | **OpenJev** (DiffusionGemma, 24 GB+ GPU) |

> Before choosing, benchmark on **your own labeled data**. Published numbers come from the model authors, and the Laya authors note that base checkpoints are near random on zero-shot typed decisions until fine-tuned.

## Design Patterns

- **Confidence-gated cascade.** Ask the System 1 model first. If the confidence or probability clears your threshold, act on it. Otherwise escalate to an LLM or a human. This is the pattern that recurs most often across TypeSafe's docs. [OpenRouter recipe](https://openrouter.ai/docs/cookbook/evaluate-and-optimize/jev-verified-cascade)
- **Parallel questions.** Batch every independent check into one call rather than making N calls. [Official cookbook](https://docs.typesafe.ai/cookbooks/parallel_questions)
- **Gate before you act.** Put a Noul in front of every destructive agent tool call. [OpenRouter recipe](https://openrouter.ai/docs/cookbook/building-agents/gate-tool-calls-with-jev)
- **Hierarchical choice.** Break a large taxonomy into a tree of small Choice questions.
- **Calibrate thresholds per question.** Probabilities are calibrated on average, but the cost of a false positive differs by question, so tune each threshold on labeled data ([jevcal](https://github.com/abhixhek/jevcal)).
- **Pick the right checkpoint for the script.** The English Laya checkpoint fails confidently on non-Latin scripts. Use the multilingual checkpoint or Laya's router.

## Showcase Ideas: Games and Puzzles

To compare models head-to-head (e.g. Jev vs Laya), see **[SHOWCASE_IDEAS.md](SHOWCASE_IDEAS.md)**. It collects 60+ game, puzzle, and simulation ideas: real-time arcade games, bullet chess, quiz buzzers, calibration betting duels, multilingual rounds, NPC swarms, and games that are secretly real work. It also has a fairness checklist so the race measures the models rather than your network.

**Runnable:** [`showcase/snake-race`](showcase/snake-race) is a split-screen Snake race between Jev and Laya (or any `/v1/systemone` backend), with a fixed-tick ladder, a free-run mode, and a headless benchmark. It has no dependencies.

## Guides and Articles

- [Introducing System One Models and Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev): The launch post from TypeSafe.
- [Confidence vs. probability](https://docs.typesafe.ai/confidence): Explains what each field means.
- [Noul primitive docs](https://docs.typesafe.ai/primitives/noul)
- Official cookbooks: [Classifying RAG passages](https://docs.typesafe.ai/cookbooks/classifying_rag_passages) · [Citation check](https://docs.typesafe.ai/cookbooks/citation_check) · [Date extraction](https://docs.typesafe.ai/cookbooks/date_extraction_cookbook) · [Skill suggestion](https://docs.typesafe.ai/cookbooks/skill_suggestion)
- [Building a harness with Jev (LangChain)](https://www.langchain.com/blog/building-a-harness-with-jev)
- [Top use cases of Jev (Cloudraft)](https://www.cloudraft.io/blog/top-use-cases-of-jev-typesafe-ai-model)
- [A deep dive into Jev (Flavio Copes)](https://flaviocopes.com/jev/)
- [What Is Jev? TypeSafe's Decision Model and Its Limits (BenchLM)](https://benchlm.ai/blog/posts/what-is-jev)
- [Jev by Example](https://github.com/ReallyArtificial/jev-by-example): Ten JavaScript lessons.
- [Jev Cookbook](https://github.com/nexibeo/jev-cookbook): Community recipes.
- [Milvus: Search with Jev](https://github.com/milvus-io/bootcamp/tree/master/bootcamp/RAG/search_with_jev): Notebooks.

## Related Lists

- [cobanov/awesome-jev](https://github.com/cobanov/awesome-jev): A comprehensive, source-backed list of Jev projects, and a source for many entries here.
- [awesome-open-system-one](https://github.com/rupeshpoojary9/awesome-open-system-one): Focuses on open models.
- [awesome-typesafe](https://github.com/AbdelStark/awesome-typesafe): Covers the wider TypeSafe ecosystem.
- [Made with Jev](https://madewithjev.com): A directory of use cases.

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[![CC0](https://licensebuttons.net/p/zero/1.0/88x31.png)](https://creativecommons.org/publicdomain/zero/1.0/)

To the extent possible under law, the contributors have waived all copyright and related rights to this work.
