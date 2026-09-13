# write

Generate structured LLM output from local markdown or plaintext. The default model is the cheapest hosted LLM. Transcribe URLs, media, documents, or X Spaces with `extract` first, then pass the extracted `.txt` / `.md` to `write`.

## Outline

- [Setup](#setup)
  - [Environment](#environment)
- [Usage](#usage)
- [Shared Write Options](#shared-write-options)
- [Write Services](#write-services)
  - [OpenAI](#openai)
  - [Anthropic](#anthropic)
  - [Gemini](#gemini)
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

Write has no local LLM; it always uses a hosted provider.

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

`write` accepts only local `.md` / `.txt` files or directories of those files. A `.md` or `.txt` file is always treated as source text, not as a URL or file-path list. `--provider` selects one or more hosted writers. `--llm` is a compatibility alias for `--provider`; repeat either selector to choose multiple targets, and do not combine the two spellings. Use `bun autoshow write --help-topic providers` for selector details. URLs, media, documents, HTML, and X Spaces must go through `extract` first; then pass the extracted `.txt` / `.md` to `write`.

```bash
bun autoshow extract video.mp4 --provider deepgram
bun autoshow write output/<extract-run>/transcription.txt --provider openai --prompt shortSummary --rendered-text
```

Project lyric draft mode is enabled when the input is `./output/<name>/text` or a `.md` / `.txt` file under that directory. In that mode, `write` reads `./output/<name>/prompt.md` by default, uses `./output/<name>/tracks.md` when present, and writes rendered markdown drafts to `./output/<name>/lyrics`.

## Shared Write Options

| Flag                                                                | Description                                                                                                                                                                       |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--provider <provider[=model]>`                                     | Select an LLM provider as `provider[=model]`; repeat to run multiple providers/models                                                                                             |
| `--llm <provider[=model]>`                                          | Compatibility alias for `--provider`; same repeatable values; do not combine the two spellings                                                                                    |
| `--all-providers`                                                   | Run every hosted LLM provider                                                                                                                                                     |
| `--reasoning-effort <policy>`                                       | Set reasoning effort / thinking policy: `default`, `disabled`, `minimal`, `low`, `medium`, `high`, `xhigh`, or `max`                                                              |
| `--batch-limit <n\|all>`                                             | Limit batch size or process all items (`all`); default `5`                                                                                                                        |
| `--batch-order <newest\|oldest>`                                    | Choose batch item order; default `newest`                                                                                                                                         |
| `--batch-concurrency <n>`                                           | Batch items to process concurrently; default `7`                                                                                                                                  |
| `--provider-concurrency <n>`                                        | Hosted providers/models to run concurrently per write item; default `7`                                                                                                           |
| `--concurrency-mode <ramp\|immediate>`                              | Ramp from one request (`ramp`, default) or start at the configured cap (`immediate`)                                                                                              |
| `--prompt <name...>`                                                | Select prompt presets                                                                                                                                                             |
| `--prompt-file <file>`                                              | Prepend instructions from a local text file before named prompt presets                                                                                                           |
| `--rendered-text`                                                   | Save rendered markdown output inside the run directory                                                                                                                            |
| `--rendered-out-dir <dir>`                                          | Also write rendered markdown files to this directory                                                                                                                              |
| `--track-list <file>`                                               | Optional `tracks.md` file used to prepend track-number headers on saved rendered text                                                                                             |
| `--prompt-md`                                                       | Save a second prompt file (`prompt-md.md`) with markdown examples alongside the JSON prompt                                                                                       |
| `--price`                                                           | Show the aggregated estimate and exit                                                                                                                                             |
| `--max-model-cents <n>`                                             | Exclude each provider/model whose estimated total across the invocation exceeds the per-model ceiling in cents; works with or without `--price`                                  |

See [Provider Capabilities](#provider-capabilities) for the per-model reasoning, context, structured-output, and pricing matrix.

```bash
bun autoshow write output/<extract-run>/transcription.txt --provider openai=gpt-5.6-sol --prompt shortSummary longSummary
bun autoshow write notes.md --provider openai=gpt-5.6-sol --prompt blog
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
| Selector | `--provider openai[=<model>]`                                                             |
| Default  | Passing `--provider openai` uses `gpt-5.6-luna`                                           |

```bash
bun autoshow write output/<extract-run>/transcription.txt --provider openai=gpt-5.6-sol
bun autoshow write output/<extract-run>/transcription.txt --provider openai=gpt-5.6-sol --provider openai=gpt-5.6-terra
```

GPT-6 Astra uses `$10.00 / $50.00` per 1M tokens, then `$20.00 / $75.00` for the entire request above 272K input tokens. Reasoning is required; `low`, `medium`, `high`, `xhigh`, and `max` are accepted, while disabled and minimal are rejected.

### Anthropic

| Option   | Value                                                                                                            |
| -------- | ---------------------------------------------------------------------------------------------------------------- |
| Selector | `--provider anthropic[=<model>]`                                                                                 |

```bash
bun autoshow write output/<extract-run>/transcription.txt --provider anthropic=claude-fable-5
```

Claude Fable 5 requires 30-day data retention and is unavailable under ZDR. Claude Fable 5.1 uses always-on adaptive thinking; disabled and minimal reasoning are rejected.

### Gemini

| Option   | Value                                                                                     |
| -------- | ----------------------------------------------------------------------------------------- |
| Selector | `--provider gemini[=<model>]`                                                             |
| Default  | Passing `--provider gemini` uses `gemini-3.5-flash-lite`                                  |

```bash
bun autoshow write output/<extract-run>/transcription.txt --provider gemini=gemini-3.6-flash
```

Gemini 3.7 Flash and Gemini 3.8 Flash accept `--reasoning-effort low`, `medium`, or `high`; `minimal` and `disabled` are rejected. `--price` estimates for those models use the standard `$1.50 / $7.50` rates that take effect 2027-01-01, so they overstate cost during the introductory `$0.75 / $3.75` window through 2026-12-31.

### Grok

| Option   | Value                                |
| -------- | ------------------------------------ |
| Selector | `--provider grok[=<model>]`          |

```bash
bun autoshow write output/<extract-run>/transcription.txt --provider grok=grok-4.5
```

Grok 4.5 and Grok 4.6 price estimates use `$2 / 1M input` and `$6 / 1M output` through 200K input tokens, then `$4 / 1M input` and `$12 / 1M output` above 200K.

### Z.AI GLM

| Option   | Value                              |
| -------- | ---------------------------------- |
| Selector | `--provider glm[=<model>]`         |

```bash
bun autoshow write output/<extract-run>/transcription.txt --provider glm=glm-5.3-flash
```

GLM 5.3 and GLM 5.3 Flash require reasoning and accept `--reasoning-effort low`, `high`, or `max`; omitted effort uses the provider default (`max`). `disabled`, `minimal`, `medium`, and `xhigh` are rejected. `glm-5.3-flash` still disables thinking by default.

### Kimi

| Option   | Value                                 |
| -------- | ------------------------------------- |
| Selector | `--provider kimi[=<model>]`           |
| Models   | `kimi-k2.6`, `kimi-k3`                |
| Default  | Passing `--provider kimi` uses `kimi-k2.6` |

```bash
bun autoshow write output/<extract-run>/transcription.txt --provider kimi=kimi-k3
```

Kimi K3 thinking is on by default; `--reasoning-effort` can change it.

### Together

| Option   | Value                                   |
| -------- | --------------------------------------- |
| Selector | `--provider together[=<model>]`         |

```bash
bun autoshow write output/<extract-run>/transcription.txt --provider together=kimi-k3
```

Together K3, GLM 5.3, and GLM 5.3 Flash accept `--reasoning-effort low`, `high`, or `max`. Together K3 also accepts `disabled`. Together GLM 5.3 and Flash reject `disabled`.

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
- Multi-target runs write `text-<model>.json` for each selected LLM target. When two providers share a model id, the filename includes the provider.
- `--rendered-text` writes rendered markdown inside the run directory: `text.md` for a single target, or `text-<model>.md` per model when multiple targets are selected.

## Notes

- Resume of a write run uses the top-level [`resume`](../00-setup-and-utilities/resume.md) command, not a `write` flag.
- Shorthands such as `write demo` or `write ./output/demo` do not enable project lyric draft mode; the input must be `./output/<name>/text` or a file under that directory.
- Project lyric draft mode requires `./output/<name>/prompt.md` unless `--prompt-file` is supplied. Explicit `--prompt-file`, `--track-list`, and `--rendered-out-dir` values override the project defaults.

## Generate Media from Write Output

`write` stops after text generation. Generate speech, images, video, or music with the standalone commands against rendered markdown:

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
| GLM `glm-5.3-flash`             | ✅ 2026-09     | ✅ Required                   | ✅ 1M          | ✅ Native                  | $0.15 / $0.50 per 1M tokens   | 1/22 |
| Together `glm-5.3-flash`        | ✅ 2026-09     | ✅ Optional through max       | ✅ 1M          | ✅ Native                  | $0.15 / $0.50 per 1M tokens   | 1/22 |
| Gemini `gemini-3.8-flash`       | ✅ 2026-09     | ✅ Optional through high      | ✅ 1M          | ✅ Native                  | $1.50 / $7.50 per 1M tokens   | 10/22 |
| OpenAI `gpt-6-astra`            | ✅ 2026-09     | ✅ Required                   | ❌ Unpublished | ✅ Native                  | $10.00 / $50.00 per 1M tokens | 20/22 |
| Anthropic `claude-fable-5-1`    | ✅ 2026-09     | ✅ Required adaptive thinking | ❌ Unpublished | ✅ Native                  | $10.00 / $50.00 per 1M tokens | 20/22 |
| GLM `glm-5.3`                   | ✅ 2026-09     | ✅ Required                   | ✅ 1M          | ✅ Native                  | $1.40 / $4.40 per 1M tokens   | 6/22 |
| Together `glm-5.3`              | ✅ 2026-09     | ✅ Required                   | ✅ 1M          | ✅ Native                  | $1.40 / $4.40 per 1M tokens   | 6/22 |
| Together `kimi-k3`              | ✅ 2026-09     | ⚠️ Optional thinking         | ✅ 1M          | ✅ Native                  | $3.00 / $15.00 per 1M tokens  | 16/22 |
| Grok `grok-4.6`                 | ✅ 2026-08     | ✅ Required                   | ⚠️ 500K       | ✅ Native                  | $2.00 / $6.00 per 1M tokens   | 8/22 |
| Gemini `gemini-3.7-flash`       | ✅ 2026-08     | ✅ Optional through high      | ✅ 1M          | ✅ Native                  | $1.50 / $7.50 per 1M tokens   | 10/22 |
| OpenAI `gpt-5.6-terra`          | ✅ 2026-08     | ✅ Optional through max       | ❌ Unpublished | ✅ Native                  | $2.00 / $12.00 per 1M tokens  | 15/22 |
| OpenAI `gpt-5.6-luna`           | ✅ 2026-08     | ✅ Optional through max       | ❌ Unpublished | ✅ Native                  | $0.20 / $1.20 per 1M tokens   | 3/22 |
| Gemini `gemini-3.5-flash-lite`  | ✅ 2026-08     | ✅ Optional including minimal | ❌ Unpublished | ✅ Native                  | $0.30 / $2.50 per 1M tokens   | 4/22 |
| OpenAI `gpt-5.6-sol`            | ✅ 2026-07     | ✅ Optional through max       | ❌ Unpublished | ✅ Native                  | $5.00 / $30.00 per 1M tokens  | 19/22 |
| Anthropic `claude-sonnet-5`     | ✅ 2026-07     | ✅ Optional through max       | ❌ Unpublished | ✅ Native                  | $2.00 / $10.00 per 1M tokens  | 14/22 |
| Anthropic `claude-opus-5`       | ✅ 2026-07     | ✅ Optional through max       | ✅ 1M          | ✅ Native                  | $5.00 / $25.00 per 1M tokens  | 18/22 |
| Gemini `gemini-3.6-flash`       | ✅ 2026-07     | ✅ Optional including minimal | ❌ Unpublished | ✅ Native                  | $1.50 / $7.50 per 1M tokens   | 10/22 |
| Grok `grok-4.5`                 | ✅ 2026-07     | ✅ Required                   | ⚠️ 500K       | ✅ Native                  | $2.00 / $6.00 per 1M tokens   | 8/22 |
| Kimi `kimi-k3`                  | ✅ 2026-07     | ✅ Required effort            | ✅ 1M          | ✅ Native                  | $3.00 / $15.00 per 1M tokens  | 16/22 |
| Anthropic `claude-fable-5`      | ✅ 2026-06-09  | ✅ Required adaptive thinking | ❌ Unpublished | ✅ Native                  | $10.00 / $50.00 per 1M tokens | 20/22 |
| Gemini `gemini-3.5-flash`       | ✅ 2026-06     | ✅ Optional including minimal | ❌ Unpublished | ✅ Native                  | $1.50 / $9.00 per 1M tokens   | 13/22 |
| Kimi `kimi-k2.6`                | ⚠️ 2026-01    | ⚠️ Optional thinking         | ⚠️ 256K       | ✅ Native                  | $0.95 / $4.00 per 1M tokens   | 5/22 |
