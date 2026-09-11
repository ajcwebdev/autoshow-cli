# write

Generate structured step-3 LLM output from local markdown or plaintext. The default model is the cheapest hosted LLM. Transcribe URLs, media, documents, or X Spaces with `extract` first, then pass the extracted `.txt` / `.md` to `write`.

## Outline

- [Setup](#setup)
  - [Environment](#environment)
- [Usage](#usage)
- [Shared Write Options](#shared-write-options)
- [Write Services](#write-services)
  - [OpenAI](#openai)
  - [Anthropic](#anthropic)
  - [Gemini](#gemini)
  - [MiniMax](#minimax)
  - [Grok](#grok)
  - [Z.AI GLM](#zai-glm)
  - [Kimi](#kimi)
  - [Together](#together)
- [Prompts](#prompts)
  - [Summary and Overview](#summary-and-overview)
  - [Chapters](#chapters)
  - [Marketing Content](#marketing-content)
  - [Social Media](#social-media)
  - [Song Lyrics](#song-lyrics)
  - [Creative Writing](#creative-writing)
- [Output](#output)
- [Notes](#notes)
- [Generate Media from Write Output](#generate-media-from-write-output)
- [Provider Capabilities](#provider-capabilities)

## Setup

```bash
# full setup
bun autoshow setup

# check hosted LLM API-key readiness
bun autoshow setup --doctor
```

Write has no local LLM; step 3 always uses a hosted provider.

### Environment

```bash
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GEMINI_API_KEY=...
MINIMAX_API_KEY=...
XAI_API_KEY=...
GLM_API_KEY=...
KIMI_API_KEY=...
TOGETHER_API_KEY=...
```

## Usage

```bash
bun autoshow write <input> [flags]
```

`write` accepts only local `.md` / `.txt` files or directories of those files. A `.md` or `.txt` file is always treated as source text, not as a URL or file-path list. `--provider` selects one or more hosted writers. `--llm` remains a compatibility alias with the same additive saved-default behavior; repeat either selector to choose multiple targets, and do not combine the two spellings. Use `bun autoshow write --help-topic providers` for selector details. URLs, media, documents, HTML, and X Spaces must go through `extract` first; then pass the extracted `.txt` / `.md` to `write`.

```bash
bun autoshow extract video.mp4 --provider deepgram
bun autoshow write output/<extract-run>/transcription.txt --provider openai --prompt shortSummary --rendered-text
```

Project lyric draft mode is enabled when the input is `./output/<name>/text` or a `.md` / `.txt` file under that directory. In that mode, `write` reads `./output/<name>/prompt.md` by default, uses `./output/<name>/tracks.md` when present, and writes rendered markdown drafts to `./output/<name>/lyrics`.

## Shared Write Options

| Flag                                                                | Description                                                                                                                                                                       |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--llm <provider[=model]>`                                          | Select an LLM provider as `provider[=model]`; repeat to run multiple providers/models                                                                                             |
| `--all-providers`                                                   | Run every hosted LLM provider                                                                                                                                                     |
| `--reasoning-effort <policy>`                                       | Set reasoning effort / thinking policy: `default`, `disabled`, `minimal`, `low`, `medium`, `high`, `xhigh`, or `max`                                                                       |
| `--batch-limit <n\|all>`                                             | Limit batch size or process all items (`all`); default `5`                                                                                                                        |
| `--batch-order <newest\|oldest>`                                    | Choose batch item order; default `newest`                                                                                                                                         |
| `--batch-concurrency <n>`                                           | Batch items to process concurrently; default `7`                                                                                                                                  |
| `--provider-concurrency <n>`                                        | Hosted providers/models to run concurrently per write item; default `7`                                                                                                           |

| `--concurrency-mode <ramp\|immediate>`                              | Start each hosted provider/account lane at one request and add one slot every five seconds while demand is queued (`ramp`, default), or start at its configured cap (`immediate`) |
| `--prompt <name...>`                                                | Select prompt presets                                                                                                                                                             |

| `--prompt-file <file>`                                              | Prepend instructions from a local text file before named prompt presets                                                                                                           |
| `--rendered-text`                                                   | Save rendered step-3 markdown output inside the run directory                                                                                                                     |
| `--rendered-out-dir <dir>`                                          | Also write rendered step-3 markdown files to this directory                                                                                                                       |
| `--track-list <file>`                                               | Optional `tracks.md` file used to prepend track-number headers on saved rendered text                                                                                             |
| `--prompt-md`                                                       | Save a second prompt file (`prompt-md.md`) with markdown examples alongside the JSON prompt                                                                                       |
| `--price`                                                           | Show the aggregated estimate and exit                                                                                                                                             |
| `--max-model-cents <n>`                                             | Exclude each provider/model whose estimated total across the invocation exceeds the per-model ceiling in cents; works with or without `--price`                                  |

See [Provider Capabilities](#provider-capabilities) for the per-model reasoning, context, structured-output, and pricing matrix.

```bash
bun autoshow write output/<extract-run>/transcription.txt --provider openai=gpt-5.5 --prompt shortSummary longSummary
bun autoshow write notes.md --provider openai=gpt-5.5 --prompt blog
bun autoshow write ./output/demo/text --prompt rockSong
bun autoshow write ./output/demo/text --price
bun autoshow write ./output/demo/text --all-providers --max-model-cents 50 --price
```

Write `--price` estimates use the selected prompt and source text. Use `--json` for structured token estimates and rates.

`--max-model-cents` is a selection filter, not a total command budget. For directory and batch inputs, AutoShow sums each provider/model's estimates across the selected inputs before applying the ceiling. Without `--price`, only retained targets execute. Use the existing configured `--max-cents` budget when the combined cost of all retained targets must stay below a command-wide limit.

## Write Services

Step selectors accept `provider[=model]`. Omitting the model resolves to the cheapest supported model for that provider unless the provider section below documents a different default. Model-selecting flags are repeatable, including repeated selectors from the same provider.

### OpenAI

| Option   | Value                                                                                     |
| -------- | ----------------------------------------------------------------------------------------- |
| Selector | `--llm openai[=<model>]`                                                                  |
| Models   | `gpt-6-astra`, `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`, `gpt-5.5`, `gpt-5.4-mini`, `gpt-5.4-nano` |
| Default  | Passing `--llm openai` uses `gpt-5.6-luna`                                                |

```bash
bun autoshow write output/<extract-run>/transcription.txt --provider openai=gpt-5.6-sol
bun autoshow write output/<extract-run>/transcription.txt --provider openai=gpt-5.5 --provider openai=gpt-5.4-mini
```

### Anthropic

| Option   | Value                                                                                                            |
| -------- | ---------------------------------------------------------------------------------------------------------------- |
| Selector | `--llm anthropic[=<model>]`                                                                                      |
| Models   | `claude-fable-5`, `claude-opus-4-8`, `claude-sonnet-5`, `claude-sonnet-4-6`, `claude-haiku-4-5`, `claude-opus-5` |
| Default  | Passing `--llm anthropic` uses `claude-haiku-4-5`                                                                |

```bash
bun autoshow write output/<extract-run>/transcription.txt --provider anthropic=claude-fable-5
```

Claude Fable 5 requires 30-day data retention and is unavailable under ZDR.

### Gemini

Gemini 3.8 Flash is available as `gemini-3.8-flash` for writing/OCR (`gemini`) and prompted audio extraction (`gemini-stt`), with existing selectors and defaults preserved. Writing and OCR support low/medium/high reasoning; minimal and disabled are rejected. STT uses the provider default thinking level (medium), without a reasoning override. Requests omit legacy sampling controls; the transport rejects incompatible 3.8 settings before dispatch. Audio timestamps remain generated, with no native word alignment claim.

Pricing checked 2026-09-08: introductory $0.75/$3.75 per million input/output tokens through 2026-12-31, then $1.50/$7.50 starting 2027-01-01. AutoShow follows its existing conservative policy and uses the standard rates for estimates and usage-based cost calculations even during the introductory window. Automatic date transitions are unsupported; recheck the tariff and refresh all three price paths by 2027-01-01. STT uses a $0.1728/hour audio-input baseline (32 tokens/second), then accounts for prompt, candidate and thinking tokens from returned usage. OCR page and writing/STT latency heuristics are reused and provisional; caching and discounted service tiers are excluded.

Sources: [model specification](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash), [migration guide](https://ai.google.dev/gemini-api/docs/latest-model?hl=en), [pricing](https://ai.google.dev/gemini-api/docs/pricing).

| Option   | Value                                                                                     |
| -------- | ----------------------------------------------------------------------------------------- |
| Selector | `--llm gemini[=<model>]`                                                                  |
| Models   | `gemini-3.1-pro-preview`, `gemini-3.8-flash`, `gemini-3.7-flash`, `gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-3.5-flash-lite` |
| Default  | Passing `--llm gemini` uses `gemini-3.5-flash-lite`                                       |

```bash
bun autoshow write output/<extract-run>/transcription.txt --provider gemini=gemini-3.6-flash
```

Gemini 3.7 Flash `--price` estimates use the standard `$1.50 / $7.50` rates effective 2027-01-01, overstating cost during the introductory `$0.75 / $3.75` window through 2026-12-31. Gemini 3.1 Pro Preview is `$4.00 / $18.00` per 1M tokens above 200K.

### MiniMax

| Option   | Value                                     |
| -------- | ----------------------------------------- |
| Selector | `--llm minimax[=<model>]`                 |
| Models   | `MiniMax-M3`                              |
| Default  | Passing `--llm minimax` uses `MiniMax-M3` |

```bash
bun autoshow write output/<extract-run>/transcription.txt --provider minimax=MiniMax-M3
```

Above 512K input tokens, MiniMax is `$1.20 / 1M input` and `$4.80 / 1M output`.

### Grok

| Option   | Value                                |
| -------- | ------------------------------------ |
| Selector | `--llm grok[=<model>]`               |
| Models   | `grok-4.3`, `grok-4.5`, `grok-4.6`   |
| Default  | Passing `--llm grok` uses `grok-4.3` |

```bash
bun autoshow write output/<extract-run>/transcription.txt --provider grok=grok-4.5
```

Grok 4.5 and Grok 4.6 price estimates use `$2 / 1M input` and `$6 / 1M output` through 200K input tokens, then `$4 / 1M input` and `$12 / 1M output` above 200K.

### Z.AI GLM

| Option   | Value                              |
| -------- | ---------------------------------- |
| Selector | `--llm glm[=<model>]`              |
| Models   | `glm-5.1`, `glm-5.3`, `glm-5.3-flash` |
| Default  | Passing `--llm glm` uses `glm-5.1` |

```bash
bun autoshow write output/<extract-run>/transcription.txt --provider glm=glm-5.1
```

### Kimi

| Option   | Value                                 |
| -------- | ------------------------------------- |
| Selector | `--llm kimi[=<model>]`                |
| Models   | `kimi-k2.6`, `kimi-k3`                |
| Default  | Passing `--llm kimi` uses `kimi-k2.6` |

```bash
bun autoshow write output/<extract-run>/transcription.txt --provider kimi=kimi-k3
```

Kimi K3 thinking is on by default; `--reasoning-effort` can change it.

### Together

| Option   | Value                                   |
| -------- | --------------------------------------- |
| Selector | `--llm together[=<model>]`              |
| Models   | `kimi-k2.6`, `glm-5.1`, `kimi-k3`, `glm-5.3`, `glm-5.3-flash` |
| Default  | Passing `--llm together` uses `glm-5.1` |

```bash
bun autoshow write output/<extract-run>/transcription.txt --provider together=kimi-k2.6
```

## Prompts

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
- `rapSongChapter`
- `rapSongLong`

### Creative Writing

- `poetryCollection`
- `screenplay`
- `shortStory`

## Output

- `write` output is JSON by default.
- Single-target runs write `text.json`.
- Multi-target runs write `text-<model>.json` for each selected LLM target.
- `--rendered-text` writes rendered markdown inside the run directory: `text.md` for a single `--llm` target, or `text-<model>.md` per model when multiple targets are selected.

## Notes

- Resume of a write run uses the top-level [`resume`](../../00-setup-and-utilities/resume.md) command, not a `write` flag.
- Shorthands such as `write demo` or `write ./output/demo` do not enable project lyric draft mode; the input must be `./output/<name>/text` or a file under that directory.
- Project lyric draft mode requires `./output/<name>/prompt.md` unless `--prompt-file` is supplied. Explicit `--prompt-file`, `--track-list`, and `--rendered-out-dir` values override the project defaults.

## Generate Media from Write Output

`write` stops at step 3. Generate speech, images, video, or music with the standalone commands against rendered markdown:

```bash
bun autoshow extract video.mp4 --provider deepgram
bun autoshow write output/<extract-run>/transcription.txt --provider openai --prompt shortSummary --rendered-text
bun autoshow tts output/<write-run>/text.md --provider elevenlabs
bun autoshow music output/<write-run>/text.md --provider elevenlabs
bun autoshow image "$(cat output/<write-run>/text.md)" --provider openai
bun autoshow video "$(cat output/<write-run>/text.md)" --provider grok
```

Lyric drafts pair with `music --lyrics-file`.

## Provider Capabilities

Marks: ✅ supported, ⚠️ partial or qualified, ❌ not exposed. Recency: current-year GA is ✅, older still-current snapshots are ⚠️, and pre-2026 engines are ❌. Rows are newest first. Context uses ✅ 1M or more, ⚠️ 200K to under 1M, and ❌ under 200K or unpublished. Pricing is per 1M tokens (input / output). Cost rank orders models cheapest-first (1 = cheapest); ties share a rank.

| Provider                        | Released      | Reasoning                    | Context       | Structured output         | Pricing                       | Cost rank |
| ------------------------------- | ------------- | ---------------------------- | ------------- | ------------------------- | ----------------------------- | --------- |
| Grok `grok-4.6`                 | ✅ 2026-08     | ✅ Required                   | ⚠️ 500K       | ✅ Native                  | $2.00 / $6.00 per 1M tokens   | 12/26     |
| Gemini `gemini-3.7-flash`       | ✅ 2026-08     | ✅ Optional through high      | ✅ 1M          | ✅ Native                  | $1.50 / $7.50 per 1M tokens   | 14/26     |
| OpenAI `gpt-5.6-terra`          | ✅ 2026-08     | ✅ Optional through max       | ❌ Unpublished | ✅ Native                  | $2.00 / $12.00 per 1M tokens  | 18/26     |
| OpenAI `gpt-5.6-luna`           | ✅ 2026-08     | ✅ Optional through max       | ❌ Unpublished | ✅ Native                  | $0.20 / $1.20 per 1M tokens   | 1/26      |
| Gemini `gemini-3.5-flash-lite`  | ✅ 2026-08     | ✅ Optional including minimal | ❌ Unpublished | ✅ Native                  | $0.30 / $2.50 per 1M tokens   | 3/26      |
| OpenAI `gpt-5.6-sol`            | ✅ 2026-07     | ✅ Optional through max       | ❌ Unpublished | ✅ Native                  | $5.00 / $30.00 per 1M tokens  | 24/26     |
| Anthropic `claude-sonnet-5`     | ✅ 2026-07     | ✅ Optional through max       | ❌ Unpublished | ✅ Native                  | $2.00 / $10.00 per 1M tokens  | 17/26     |
| Anthropic `claude-opus-5`       | ✅ 2026-07     | ✅ Optional through max       | ✅ 1M          | ✅ Native                  | $5.00 / $25.00 per 1M tokens  | 22/26     |
| Gemini `gemini-3.6-flash`       | ✅ 2026-07     | ✅ Optional including minimal | ❌ Unpublished | ✅ Native                  | $1.50 / $7.50 per 1M tokens   | 14/26     |
| Grok `grok-4.5`                 | ✅ 2026-07     | ✅ Required                   | ⚠️ 500K       | ✅ Native                  | $2.00 / $6.00 per 1M tokens   | 12/26     |
| Kimi `kimi-k3`                  | ✅ 2026-07     | ✅ Required effort            | ✅ 1M          | ✅ Native                  | $3.00 / $15.00 per 1M tokens  | 20/26     |
| Anthropic `claude-fable-5`      | ✅ 2026-06-09  | ✅ Required adaptive thinking | ❌ Unpublished | ✅ Native                  | $10.00 / $50.00 per 1M tokens | 26/26     |
| Gemini `gemini-3.5-flash`       | ✅ 2026-06     | ✅ Optional including minimal | ❌ Unpublished | ✅ Native                  | $1.50 / $9.00 per 1M tokens   | 16/26     |
| Anthropic `claude-opus-4-8`     | ✅ 2026-05     | ✅ Optional through max       | ❌ Unpublished | ✅ Native                  | $5.00 / $25.00 per 1M tokens  | 22/26     |
| Grok `grok-4.3`                 | ✅ 2026-05     | ❌ Unsupported                | ❌ Unpublished | ✅ Native                  | $1.25 / $2.50 per 1M tokens   | 5/26      |
| OpenAI `gpt-5.5`                | ✅ 2026-04-23  | ✅ Optional through high      | ❌ Unpublished | ✅ Native                  | $5.00 / $30.00 per 1M tokens  | 24/26     |
| OpenAI `gpt-5.4-mini`           | ✅ 2026-03-17  | ✅ Optional through high      | ❌ Unpublished | ✅ Native                  | $0.75 / $4.50 per 1M tokens   | 7/26     |
| OpenAI `gpt-5.4-nano`           | ✅ 2026-03-17  | ✅ Optional through high      | ❌ Unpublished | ✅ Native                  | $0.20 / $1.25 per 1M tokens   | 2/26      |
| Anthropic `claude-sonnet-4-6`   | ✅ 2026-02     | ✅ Optional through max       | ❌ Unpublished | ✅ Native                  | $3.00 / $15.00 per 1M tokens  | 20/26     |
| Kimi `kimi-k2.6`                | ⚠️ 2026-01    | ⚠️ Optional thinking         | ⚠️ 256K       | ✅ Native                  | $0.95 / $4.00 per 1M tokens   | 6/26      |
| Together `kimi-k2.6`            | ⚠️ 2026-01    | ⚠️ Optional thinking         | ⚠️ 262K       | ✅ Native                  | $1.20 / $4.50 per 1M tokens   | 8/26     |
| MiniMax `MiniMax-M3`            | ✅ 2026        | ❌ Unsupported                | ✅ 1M          | ❌ Compatibility fallback  | $0.60 / $2.40 per 1M tokens   | 4/26      |
| GLM `glm-5.1`                   | ✅ 2026        | ⚠️ Optional                  | ⚠️ 200K       | ✅ Native                  | $1.40 / $4.40 per 1M tokens   | 9/26     |
| Together `glm-5.1`              | ✅ 2026        | ⚠️ Optional                  | ⚠️ 202K       | ✅ Native                  | $1.40 / $4.40 per 1M tokens   | 9/26     |
| Gemini `gemini-3.1-pro-preview` | ⚠️ 2025-12    | ✅ Optional through high      | ❌ Unpublished | ✅ Native                  | $2.00 / $12.00 per 1M tokens  | 18/26     |
| Anthropic `claude-haiku-4-5`    | ⚠️ 2025-10-01 | ❌ Unsupported                | ❌ Unpublished | ✅ Native                  | $1.00 / $5.00 per 1M tokens   | 11/26     |

## Direct GLM 5.3 additions — 2026-09-08

Writing accepts `--llm glm=glm-5.3` and `--llm glm=glm-5.3-flash`, alongside `glm-5.1`. Bare `--llm glm` still selects 5.1; both additions participate in `--all-llm`. Both models require reasoning and accept `--reasoning-effort low`, `high` or `max`. Omitted/default effort leaves the provider default (max); disabled, minimal, medium and xhigh are rejected before HTTP. The existing 5.1 default still disables thinking. See the [flagship contract](https://docs.z.ai/guides/llm/glm-5.3) and [Flash contract](https://docs.z.ai/guides/vlm/glm-5.3-flash).

Both use direct Z.ai Chat Completions with text messages, enabled thinking and the existing 16,000-token request cap (below their published 128K output maximum and 1M context). Structured writing requests JSON-object output through the existing fallback path. Responses preserve returned model identity, provider input/output/total usage and raw usage; valid cached input counts appear in `providerUsage.cachedInputTokenCount` as a subset of prompt tokens. Reasoning content is not inserted into prose or counted again on top of completion usage. Missing usage retains local token-count fallback. Flash vision input, GLM 5.2 and Together additions are outside this integration. See the [API contract](https://docs.z.ai/api-reference/llm/chat-completion).

Standard direct prices per million input/cached-input/output tokens are $1.40/$0.26/$4.40 for 5.3 and $0.15/$0.03/$0.50 for Flash. Flash's separate 50% promotion is $0.075/$0.015/$0.25 through September 9, 2026 at 24:00 UTC+8, expiring at `2026-09-09T16:00:00Z`. Estimates and observed-token costs use standard uncached rates before and after expiry, so they overstate promotional or cached charges. No automatic promotion transition or cache discount is applied. Cache storage is currently temporarily free; future storage charges, batch/enterprise discounts, taxes and credits are excluded. Latency heuristics are inherited and uncalibrated. [Pricing checked September 8, 2026](https://docs.z.ai/guides/overview/pricing).

## Together hosted writing additions — 2026-09-08

Together accepts these additional short selectors. `--llm together` still selects `glm-5.1`; `kimi-k2.6` and `glm-5.1` keep their original host mappings. `--all-llm` includes all five Together choices. These selectors are scoped to Together and do not change direct Kimi or GLM behavior.

| Selector | Exact Together API ID | Input / cached input / output USD per million tokens |
| --- | --- | --- |
| `kimi-k3` | `moonshotai/Kimi-K3` | $3.00 / $0.30 / $15.00 |
| `glm-5.3` | `zai-org/GLM-5.3` | $1.40 / $0.26 / $4.40 |
| `glm-5.3-flash` | `zai-org/GLM-5.3-Flash` | $0.15 / $0.03 / $0.50 |

Together's [serverless catalog](https://docs.together.ai/docs/serverless/models) lists native structured output for all three and context limits of 1,048,576 tokens for K3 and 1,048,575 for both GLMs. Estimates and observed-token costs use flat uncached rates. Cached input rates are metadata only; no direct-provider promotion, automatic cached discount, batch discount, enterprise rate, tax or credit is applied. Latency heuristics remain uncalibrated.

All three accept `--reasoning-effort low`, `high` or `max`; omitted/default effort leaves the host default unchanged. Together K3 also accepts `disabled`, serialized as `reasoning: { enabled: false }`. Its [host quickstart](https://docs.together.ai/docs/kimi-k3-quickstart) documents max as the default and a 131,072-token completion budget, which AutoShow now uses. Reasoning and final text share this budget. The explicit low/high/max list and developer guide take precedence over the conflicting medium value in the quickstart parameter table and TypeScript comment; unsupported minimal/medium/xhigh values fail locally.

The [GLM 5.3 host page](https://www.together.ai/models/glm-5-3) documents always-enabled thinking and max default. The [Flash host page](https://www.together.ai/models/glm-5-3-flash) documents low/high/max but no disable contract, so AutoShow rejects disabled for both GLM additions. Named efforts use Together's top-level `reasoning_effort`; no direct Z.ai `thinking` field is sent. Both retain AutoShow's 32,768-token request cap. This is a local budget, not a claimed host output maximum: Together's checked pages publish context limits but no separate GLM output ceiling. Host context-limit validation remains authoritative. Large reasoning traces can exhaust the local cap before completing the answer.

The existing Chat Completions transport sends text messages and native JSON Schema for structured writing, with the established fallback without `response_format` on compatible schema errors. Final prose reads only message content. Metadata retains returned model identity, raw usage and normalized prompt/completion/total tokens, including valid cached-input counts as a subset of prompt usage, with fallback to Together's top-level `cached_tokens` when the nested counter is unavailable. Reasoning tokens included in completion usage are counted once. Missing usage retains local token-count fallback. Vision/OCR, tools and multi-turn thinking replay are outside this writing addition; no paid access check was performed.
