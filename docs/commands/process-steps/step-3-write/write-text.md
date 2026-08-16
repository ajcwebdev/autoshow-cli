# write

Run the full download plus transcription or extraction pipeline, then generate structured step-3 output with a hosted LLM. The default is the cheapest hosted model.

## Outline

- [Setup](#setup)
  - [Environment](#environment)
- [Usage](#usage)
- [Shared Write Options](#shared-write-options)
- [Write Services](#write-services)
  - [OpenAI](#openai)
  - [Anthropic](#anthropic)
  - [Gemini](#gemini)
  - [Groq](#groq)
  - [MiniMax](#minimax)
  - [Grok](#grok)
  - [Z.AI GLM](#zai-glm)
  - [Kimi](#kimi)
  - [Together](#together)
  - [Cerebras](#cerebras)
- [Prompts](#prompts)
  - [Summary and Overview](#summary-and-overview)
  - [Chapters](#chapters)
  - [Marketing Content](#marketing-content)
  - [Social Media](#social-media)
  - [Song Lyrics](#song-lyrics)
  - [Creative Writing](#creative-writing)
- [Output](#output)
- [Notes](#notes)
- [Provider Capabilities](#provider-capabilities)

## Setup

```bash
# full setup
bun autoshow setup

# check hosted write API-key readiness
bun autoshow setup --step write
```

Write has no local LLM. Step 3 always uses a hosted provider. Omitting `--llm` selects the cheapest hosted model.

### Environment

Hosted LLM providers need API keys:

```bash
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GEMINI_API_KEY=...
GROQ_API_KEY=...
MINIMAX_API_KEY=...
XAI_API_KEY=...
GLM_API_KEY=...
KIMI_API_KEY=...
TOGETHER_API_KEY=...
CEREBRAS_API_KEY=...

# required only for X Space / X post inputs
X_BEARER_TOKEN=...
```

## Usage

```bash
bun autoshow write [input] [flags]
```

`write` uses standard step 1 and step 2 routing. The LLM flag you choose controls step 3. Media inputs route through STT, documents/images route through OCR or native text extraction, HTML/article inputs route through URL article extraction, and X Space or X post inputs route through X Space collection before the LLM runs.

Project lyric draft mode is enabled when the input is `./output/<name>/text` or a `.md` / `.txt` file under that directory. In that mode, `write` treats the input as raw text, reads `./output/<name>/prompt.md` by default, uses `./output/<name>/tracks.md` when present, and writes rendered markdown drafts to `./output/<name>/lyrics`.

## Shared Write Options

| Flag                                                                | Description                                                                                                                                                                       |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--stt`, `--ocr`, `--llm`, `--tts`, `--image`, `--video`, `--music` | Select a pipeline step provider as `provider[=model]`; repeat to run multiple providers/models                                                                                    |
| `--all-providers <step>`                                            | Enable every hosted/API-backed provider for one write step: `stt`, `ocr`, `url`, `llm`, `tts`, `image`, `video`, or `music`                                                       |
| `--all-local <step>`                                                | Enable every local engine/backend for one write step: `stt`, `ocr`, or `url`                                                                                                      |
| `--reasoning-effort <policy>`                                       | Set reasoning effort / thinking policy: `default`, `disabled`, `minimal`, `low`, `medium`, `high`, or `max`                                                                       |
| `--batch-limit <n>`                                                 | Limit batch size; default `5`                                                                                                                                                     |
| `--batch-all`                                                       | Process every batch item                                                                                                                                                          |
| `--batch-order <newest\|oldest>`                                    | Choose batch item order; default `newest`                                                                                                                                         |
| `--batch-concurrency <n>`                                           | Batch items to process concurrently; default `7`                                                                                                                                  |
| `--provider-concurrency <n>`                                        | Hosted providers/models to run concurrently per write item; default `7`                                                                                                           |
| `--local-concurrency <n>`                                           | Local providers/models to run concurrently per write item; default `7`                                                                                                            |
| `--concurrency-mode <ramp\|immediate>`                              | Start each hosted provider/account lane at one request and add one slot every five seconds while demand is queued (`ramp`, default), or start at its configured cap (`immediate`) |
| `--prompt <name...>`                                                | Select prompt presets                                                                                                                                                             |
| `--text-input`                                                      | Treat local `.md` / `.txt` files and directories as raw source text                                                                                                               |
| `--prompt-file <file>`                                              | Prepend instructions from a local text file before named prompt presets                                                                                                           |
| `--rendered-text`                                                   | Save rendered step-3 markdown output inside the run directory                                                                                                                     |
| `--rendered-out-dir <dir>`                                          | Also write rendered step-3 markdown files to this directory                                                                                                                       |
| `--track-list <file>`                                               | Optional `tracks.md` file used to prepend track-number headers on saved rendered text                                                                                             |
| `--prompt-md`                                                       | Save a second prompt file (`prompt-md.md`) with markdown examples alongside the JSON prompt                                                                                       |
| `--price`                                                           | Show the aggregated estimate and exit                                                                                                                                             |

See [Provider Capabilities](#provider-capabilities) for the per-model release date, reasoning, context, and structured-output matrix.

```bash
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm openai=gpt-5.5 --prompt shortSummary longSummary
bun autoshow write https://example.com/article --all-providers url --price
bun autoshow write https://x.com/i/spaces/1DXxyRYNejbKM --price
bun autoshow write ./output/demo/text --prompt rockSong
bun autoshow write ./output/demo/text --price
```

Write price preflight uses the model registry's input/output token rates and local token-count heuristics for the selected prompt/source text. The human `Cost Estimate` table is limited to `step`, `provider`, `model`, and `cost`; use `--json` to inspect the structured token estimates and rates.

## Write Services

Step selectors accept `provider[=model]`. Omitting `--llm` uses the cheapest hosted model. Omitting the model on a provider selector resolves to the cheapest supported model for that provider unless the provider section below documents a different default. Model-selecting flags are repeatable, including repeated selectors from the same provider.

### OpenAI

| Option   | Value                                                                                     |
| -------- | ----------------------------------------------------------------------------------------- |
| Selector | `--llm openai[=<model>]`                                                                  |
| Models   | `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`, `gpt-5.5`, `gpt-5.4-mini`, `gpt-5.4-nano` |
| Default  | Passing `--llm openai` uses `gpt-5.6-luna`                                                |

```bash
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm openai=gpt-5.6-sol
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm openai=gpt-5.5
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm openai=gpt-5.4-nano
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --stt deepgram --llm openai=gpt-5.5
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm openai=gpt-5.5 --llm openai=gpt-5.4-mini
bun autoshow write ./output/demo/text/01-track-one.md --llm openai=gpt-5.5 --prompt folkSong
```

Passing `--llm openai` defaults to `gpt-5.6-luna`. Explicit model selectors or `--all-providers llm` access all registered GPT-5.6, GPT-5.5, and GPT-5.4 tiers.

### Anthropic

| Option   | Value                                                                                                            |
| -------- | ---------------------------------------------------------------------------------------------------------------- |
| Selector | `--llm anthropic[=<model>]`                                                                                      |
| Models   | `claude-fable-5`, `claude-opus-4-8`, `claude-sonnet-5`, `claude-sonnet-4-6`, `claude-haiku-4-5`, `claude-opus-5` |
| Default  | Passing `--llm anthropic` uses `claude-haiku-4-5`                                                                |

```bash
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm anthropic=claude-fable-5
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm anthropic=claude-opus-4-8
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm anthropic=claude-opus-5
```

Passing `--llm anthropic` defaults to `claude-haiku-4-5`. Claude Opus 5 estimates use standard rates of `$5 / 1M input` and `$25 / 1M output`, with a 1M-token context window and 128K maximum output tokens.

### Gemini

| Option   | Value                                                                                     |
| -------- | ----------------------------------------------------------------------------------------- |
| Selector | `--llm gemini[=<model>]`                                                                  |
| Models   | `gemini-3.1-pro-preview`, `gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-3.5-flash-lite` |
| Default  | Passing `--llm gemini` uses `gemini-3.5-flash-lite`                                       |

```bash
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm gemini=gemini-3.5-flash-lite
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm gemini=gemini-3.6-flash
```

Passing `--llm gemini` defaults to `gemini-3.5-flash-lite`. Gemini models use flat Standard rates: Gemini 3.6 Flash at `$1.50 / 1M input` and `$7.50 / 1M output`, Gemini 3.5 Flash at `$1.50 / 1M input` and `$9.00 / 1M output`, and Gemini 3.5 Flash-Lite at `$0.30 / 1M input` and `$2.50 / 1M output`. Gemini 3.1 Pro Preview uses `$2.00 / 1M input` and `$12.00 / 1M output` up to 200K tokens, and `$4.00 / 1M input` and `$18.00 / 1M output` above 200K.

### Groq

| Option   | Value                                          |
| -------- | ---------------------------------------------- |
| Selector | `--llm groq[=<model>]`                         |
| Models   | `openai/gpt-oss-20b`, `openai/gpt-oss-120b`    |
| Default  | Passing `--llm groq` uses `openai/gpt-oss-20b` |

```bash
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm groq=openai/gpt-oss-20b
```

### MiniMax

| Option   | Value                                             |
| -------- | ------------------------------------------------- |
| Selector | `--llm minimax[=<model>]`                         |
| Models   | `MiniMax-M3`                                      |
| Default  | Passing `--llm minimax` uses `MiniMax-M3`         |
| API      | Native MiniMax text API at `/v1/chat/completions` |

```bash
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm minimax=MiniMax-M3
```

`MiniMax-M3` supports a 1M context window. Price estimates use MiniMax Standard pay-as-you-go bands: up to 512K input tokens at `$0.60 / 1M input` and `$2.40 / 1M output`; over 512K input tokens at `$1.20 / 1M input` and `$4.80 / 1M output`.

### Grok

| Option   | Value                                |
| -------- | ------------------------------------ |
| Selector | `--llm grok[=<model>]`               |
| Models   | `grok-4.3`, `grok-4.5`               |
| Default  | Passing `--llm grok` uses `grok-4.3` |

```bash
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm grok=grok-4.3
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm grok=grok-4.5
```

Passing `--llm grok` defaults to `grok-4.3`. Grok 4.5 price estimates use standard rates: `$2 / 1M input` and `$6 / 1M output` through 200K input tokens, then `$4 / 1M input` and `$12 / 1M output` above 200K.

### Z.AI GLM

| Option            | Value                                                 |
| ----------------- | ----------------------------------------------------- |
| Selector          | `--llm glm[=<model>]`                                 |
| Models            | `glm-5.1`                                             |
| Default           | Passing `--llm glm` uses `glm-5.1`                    |
| Structured output | Uses Z.AI's OpenAI-compatible chat API with JSON mode |

```bash
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm glm=glm-5.1
```

GLM 5.1 pricing uses standard rates: `$1.40 / 1M input` and `$4.40 / 1M output`, with a 200K-token context window and 128K maximum output tokens.

### Kimi

| Option            | Value                                                 |
| ----------------- | ----------------------------------------------------- |
| Selector          | `--llm kimi[=<model>]`                                |
| Models            | `kimi-k2.6`, `kimi-k3`                                |
| Default           | Passing `--llm kimi` uses `kimi-k2.6`                 |
| Structured output | Uses Kimi's OpenAI-compatible chat API with JSON mode |

```bash
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm kimi=kimi-k2.6
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm kimi=kimi-k3
```

Passing `--llm kimi` defaults to `kimi-k2.6` (`$0.95 / 1M input`, `$4.00 / 1M output`, 256K context). Kimi K3 uses flat pay-as-you-go rates: `$3.00 / 1M input`, `$15.00 / 1M output`, and a 1M-token context window. K3 runs with always-on thinking by default; reasoning effort can be configured via `--reasoning-effort`.

### Together

| Option   | Value                                   |
| -------- | --------------------------------------- |
| Selector | `--llm together[=<model>]`              |
| Models   | `kimi-k2.6`, `glm-5.1`                  |
| Default  | Passing `--llm together` uses `glm-5.1` |
| API key  | `TOGETHER_API_KEY`                      |

```bash
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm together=kimi-k2.6
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm together=glm-5.1
```

Together provides serverless hosted models via OpenAI-compatible chat completions: `kimi-k2.6` maps to `moonshotai/Kimi-K2.6` (`$1.20 / 1M input`, `$4.50 / 1M output`) and `glm-5.1` maps to `zai-org/GLM-5.1` (`$1.40 / 1M input`, `$4.40 / 1M output`).

### Cerebras

| Option   | Value                                        |
| -------- | -------------------------------------------- |
| Selector | `--llm cerebras[=<model>]`                   |
| Models   | `gpt-oss-120b`, `zai-glm-4.7`                |
| Default  | Passing `--llm cerebras` uses `gpt-oss-120b` |
| API key  | `CEREBRAS_API_KEY`                           |

```bash
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm cerebras=gpt-oss-120b
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm cerebras=zai-glm-4.7
```

Cerebras provides high-throughput hosted inference via OpenAI-compatible chat completions with 131K context and 40,960 maximum completion tokens: `gpt-oss-120b` (`$0.35 / 1M input`, `$0.75 / 1M output`) and `zai-glm-4.7` (`$2.25 / 1M input`, `$2.75 / 1M output`).

AutoShow normalizes structured output schemas for Cerebras strict mode while validating returned JSON against the full local schema.

```bash
# Multi-provider run
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm openai=gpt-5.5 --llm grok=grok-4.5 --llm groq=openai/gpt-oss-20b --llm glm=glm-5.1 --llm kimi=kimi-k2.6 --llm together=kimi-k2.6 --llm together=glm-5.1 --llm cerebras=gpt-oss-120b --llm cerebras=zai-glm-4.7
```

## Prompts

Prompt names are assembled at runtime from JSON files discovered recursively under `src/prompts/entries/`. Available prompts organized by category:

### Summary and Overview

- `default`
- `shortSummary`
- `longSummary`
- `bulletPoints`
- `takeaways`
- `quotes`
- `keyMoments`
- `faq`
- `questions`
- `metadata`

### Chapters

- `chapterTitles`
- `chapterTitlesAndQuotes`
- `shortChapters`
- `mediumChapters`
- `longChapters`
- `pdfChapterBoundaries`

### Marketing Content

- `blog`
- `seoArticle`
- `contentStrategy`
- `emailNewsletter`
- `titles`

### Social Media

- `x`
- `tiktok`
- `facebook`
- `instagram`
- `linkedin`
- `youtubeDescription`

### Song Lyrics

- `countrySong`
- `folkSong`
- `jazzSong`
- `popSong`
- `rockSong`
- `rapSong`
- `rapSongLong`

### Creative Writing

- `poetryCollection`
- `screenplay`
- `shortStory`

## Output

- `write` output is JSON by default.
- Single-target runs write `text.json`.
- Multi-target runs write `text-<model>.json` for each selected LLM target.
- `--rendered-text` writes rendered markdown inside the run directory.
- `--rendered-out-dir <dir>` also writes rendered markdown to another directory.
- `--prompt-md` writes a second prompt file (`prompt-md.md`) with markdown-formatted examples alongside the JSON prompt.
- Project lyric draft mode defaults `--rendered-out-dir` to `./output/<name>/lyrics`.
- Providers with native structured output use it directly; other providers use the internal schema-guided fallback path.
- EPUB inspect mode keeps the extraction payload in the canonical item's metadata and still writes the normal step-3 JSON output.

## Notes

- `write` accepts the same step-2 STT flags documented in [`extract STT`](../step-2-extract/02-extract-stt.md#shared-stt-options) and provider sections, plus the same step-2 OCR flags documented in [`extract OCR`](../step-2-extract/03-extract-ocr.md#shared-ocr-options) and provider sections. Provider/model flags are repeatable, so routed step-2 media and document work can fan out across multiple selected providers.
- `write` also accepts `--epub-bun`; when `--format` is set alongside it, the format must be `json`.
- Resume is exposed as the top-level `resume` command for extract, write, TTS, image, video, and music outputs, not as a `write` flag.
- `write` also accepts post-generation flags for [`tts`](../step-4-tts/text-to-speech-and-voice.md), [`image`](../step-5-image/text-to-image.md), [`video`](../step-6-video/text-to-video-services.md), and [`music`](../step-7-music/text-to-music-services.md). Those options are documented on their own command pages instead of being repeated here.
- Post-generation steps still require exactly one step-3 LLM output. Repeating `--llm` for multiple models produces multiple step-3 outputs and therefore skips TTS, image, video, and music generation for that run.
- `--batch-concurrency` controls how many batch items run at once. `--provider-concurrency` and `--local-concurrency` control provider fan-out inside each write item. Hosted work from batch children and later generation stages shares the run-scoped provider/account ramp; local work remains immediate.
- `write ./output/<name>/text` and files under that directory automatically enable project lyric draft mode. Shorthands such as `write demo` or `write ./output/demo` do not.
- Project lyric draft mode requires `./output/<name>/prompt.md` unless `--prompt-file` is supplied. Explicit `--prompt-file`, `--track-list`, and `--rendered-out-dir` values override the project defaults.

## Provider Capabilities

Marks match the [TTS capability tables](../step-4-tts/text-to-speech-and-voice.md#provider-capabilities): ✅ supported, ⚠️ partial or qualified, ❌ not exposed. Released dates are provider announcement or snapshot dates. Recency marks follow the TTS convention: current-year GA is ✅, older still-current snapshots are ⚠️, and pre-2026 engines are ❌. Rows are newest first. Context uses ✅ 1M or more, ⚠️ 200K to under 1M, and ❌ under 200K or unpublished. Pricing is the AutoShow registry rate per 1M tokens (input / output). Cost rank orders models cheapest-first (1 = cheapest) by the sum of the input and output prices, the same blend cheapest-model selection uses, and ties share a rank.

| Provider                        | Released      | Reasoning                     | Context        | Structured output         | Pricing                       | Cost rank |
| ------------------------------- | ------------- | ----------------------------- | -------------- | ------------------------- | ----------------------------- | --------- |
| OpenAI `gpt-5.6-terra`          | ✅ 2026-08    | ✅ Optional through max       | ❌ Unpublished | ✅ Native                 | $2.00 / $12.00 per 1M tokens  | 20/28     |
| OpenAI `gpt-5.6-luna`           | ✅ 2026-08    | ✅ Optional through max       | ❌ Unpublished | ✅ Native                 | $0.20 / $1.20 per 1M tokens   | 4/28      |
| Gemini `gemini-3.5-flash-lite`  | ✅ 2026-08    | ✅ Optional including minimal | ❌ Unpublished | ✅ Native                 | $0.30 / $2.50 per 1M tokens   | 6/28      |
| OpenAI `gpt-5.6-sol`            | ✅ 2026-07    | ✅ Optional through max       | ❌ Unpublished | ✅ Native                 | $5.00 / $30.00 per 1M tokens  | 26/28     |
| Anthropic `claude-sonnet-5`     | ✅ 2026-07    | ✅ Optional through max       | ❌ Unpublished | ✅ Native                 | $2.00 / $10.00 per 1M tokens  | 19/28     |
| Anthropic `claude-opus-5`       | ✅ 2026-07    | ✅ Optional through max       | ✅ 1M          | ✅ Native                 | $5.00 / $25.00 per 1M tokens  | 24/28     |
| Gemini `gemini-3.6-flash`       | ✅ 2026-07    | ✅ Optional including minimal | ❌ Unpublished | ✅ Native                 | $1.50 / $7.50 per 1M tokens   | 17/28     |
| Grok `grok-4.5`                 | ✅ 2026-07    | ✅ Required                   | ⚠️ 500K        | ✅ Native                 | $2.00 / $6.00 per 1M tokens   | 16/28     |
| Kimi `kimi-k3`                  | ✅ 2026-07    | ✅ Required effort            | ✅ 1M          | ✅ Native                 | $3.00 / $15.00 per 1M tokens  | 22/28     |
| Anthropic `claude-fable-5`      | ✅ 2026-06-09 | ✅ Required adaptive thinking | ❌ Unpublished | ✅ Native                 | $10.00 / $50.00 per 1M tokens | 28/28     |
| Gemini `gemini-3.5-flash`       | ✅ 2026-06    | ✅ Optional including minimal | ❌ Unpublished | ✅ Native                 | $1.50 / $9.00 per 1M tokens   | 18/28     |
| Anthropic `claude-opus-4-8`     | ✅ 2026-05    | ✅ Optional through max       | ❌ Unpublished | ✅ Native                 | $5.00 / $25.00 per 1M tokens  | 24/28     |
| Grok `grok-4.3`                 | ✅ 2026-05    | ❌ Unsupported                | ❌ Unpublished | ✅ Native                 | $1.25 / $2.50 per 1M tokens   | 8/28      |
| OpenAI `gpt-5.5`                | ✅ 2026-04-23 | ✅ Optional through high      | ❌ Unpublished | ✅ Native                 | $5.00 / $30.00 per 1M tokens  | 26/28     |
| OpenAI `gpt-5.4-mini`           | ✅ 2026-03-17 | ✅ Optional through high      | ❌ Unpublished | ✅ Native                 | $0.75 / $4.50 per 1M tokens   | 11/28     |
| OpenAI `gpt-5.4-nano`           | ✅ 2026-03-17 | ✅ Optional through high      | ❌ Unpublished | ✅ Native                 | $0.20 / $1.25 per 1M tokens   | 5/28      |
| Anthropic `claude-sonnet-4-6`   | ✅ 2026-02    | ✅ Optional through max       | ❌ Unpublished | ✅ Native                 | $3.00 / $15.00 per 1M tokens  | 22/28     |
| Kimi `kimi-k2.6`                | ⚠️ 2026-01    | ⚠️ Optional thinking          | ⚠️ 256K        | ✅ Native                 | $0.95 / $4.00 per 1M tokens   | 9/28      |
| Together `kimi-k2.6`            | ⚠️ 2026-01    | ⚠️ Optional thinking          | ⚠️ 262K        | ✅ Native                 | $1.20 / $4.50 per 1M tokens   | 12/28     |
| MiniMax `MiniMax-M3`            | ✅ 2026       | ❌ Unsupported                | ✅ 1M          | ❌ Compatibility fallback | $0.60 / $2.40 per 1M tokens   | 7/28      |
| GLM `glm-5.1`                   | ✅ 2026       | ⚠️ Optional                   | ⚠️ 200K        | ✅ Native                 | $1.40 / $4.40 per 1M tokens   | 13/28     |
| Together `glm-5.1`              | ✅ 2026       | ⚠️ Optional                   | ⚠️ 202K        | ✅ Native                 | $1.40 / $4.40 per 1M tokens   | 13/28     |
| Gemini `gemini-3.1-pro-preview` | ⚠️ 2025-12    | ✅ Optional through high      | ❌ Unpublished | ✅ Native                 | $2.00 / $12.00 per 1M tokens  | 20/28     |
| Cerebras `zai-glm-4.7`          | ⚠️ 2025-12    | ❌ Unsupported                | ❌ 131K        | ⚠️ Strict-mode normalized | $2.25 / $2.75 per 1M tokens   | 10/28     |
| Anthropic `claude-haiku-4-5`    | ⚠️ 2025-10-01 | ❌ Unsupported                | ❌ Unpublished | ✅ Native                 | $1.00 / $5.00 per 1M tokens   | 15/28     |
| Groq `openai/gpt-oss-20b`       | ❌ 2025-08-05 | ✅ Optional through high      | ❌ Unpublished | ✅ Native                 | $0.075 / $0.30 per 1M tokens  | 1/28      |
| Groq `openai/gpt-oss-120b`      | ❌ 2025-08-05 | ✅ Optional through high      | ❌ Unpublished | ✅ Native                 | $0.15 / $0.60 per 1M tokens   | 2/28      |
| Cerebras `gpt-oss-120b`         | ❌ 2025-08-05 | ❌ Unsupported                | ❌ 131K        | ⚠️ Strict-mode normalized | $0.35 / $0.75 per 1M tokens   | 3/28      |

Claude Fable 5 requires 30-day data retention and is unavailable under ZDR. MiniMax M3 has no `response_format` / `json_schema` support, so AutoShow uses the schema-guided fallback. Cerebras structured output is normalized into strict mode while JSON is validated against the full local schema. Kimi K3 thinking is on by default; `--reasoning-effort` can change it.

Write test coverage is documented in [Step 3 Service Tests: Write](write-tests.md).
