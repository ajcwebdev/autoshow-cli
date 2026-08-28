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
GROQ_API_KEY=...
MINIMAX_API_KEY=...
XAI_API_KEY=...
GLM_API_KEY=...
KIMI_API_KEY=...
TOGETHER_API_KEY=...
CEREBRAS_API_KEY=...
```

## Usage

```bash
bun autoshow write [input] [flags]
```

`write` accepts only local `.md` / `.txt` files or directories of those files. A `.md` or `.txt` file is always treated as source text, not as a URL or file-path list. `--llm` selects one or more hosted writers. URLs, media, documents, HTML, and X Spaces must go through `extract` first; then pass the extracted `.txt` / `.md` to `write`.

```bash
bun autoshow extract video.mp4 --provider deepgram
bun autoshow write output/<extract-run>/transcription.txt --llm openai --prompt shortSummary --rendered-text
```

Project lyric draft mode is enabled when the input is `./output/<name>/text` or a `.md` / `.txt` file under that directory. In that mode, `write` reads `./output/<name>/prompt.md` by default, uses `./output/<name>/tracks.md` when present, and writes rendered markdown drafts to `./output/<name>/lyrics`.

## Shared Write Options

| Flag                                                                | Description                                                                                                                                                                       |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--llm <provider[=model]>`                                          | Select an LLM provider as `provider[=model]`; repeat to run multiple providers/models                                                                                             |
| `--all-providers`                                                   | Run every hosted LLM provider                                                                                                                                                     |
| `--reasoning-effort <policy>`                                       | Set reasoning effort / thinking policy: `default`, `disabled`, `minimal`, `low`, `medium`, `high`, or `max`                                                                       |
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

See [Provider Capabilities](#provider-capabilities) for the per-model reasoning, context, structured-output, and pricing matrix.

```bash
bun autoshow write output/<extract-run>/transcription.txt --llm openai=gpt-5.5 --prompt shortSummary longSummary
bun autoshow write notes.md --llm openai=gpt-5.5 --prompt blog
bun autoshow write ./output/demo/text --prompt rockSong
bun autoshow write ./output/demo/text --price
```

Write `--price` estimates use the selected prompt and source text. Use `--json` for structured token estimates and rates.

## Write Services

Step selectors accept `provider[=model]`. Omitting the model resolves to the cheapest supported model for that provider unless the provider section below documents a different default. Model-selecting flags are repeatable, including repeated selectors from the same provider.

### OpenAI

| Option   | Value                                                                                     |
| -------- | ----------------------------------------------------------------------------------------- |
| Selector | `--llm openai[=<model>]`                                                                  |
| Models   | `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`, `gpt-5.5`, `gpt-5.4-mini`, `gpt-5.4-nano` |
| Default  | Passing `--llm openai` uses `gpt-5.6-luna`                                                |

```bash
bun autoshow write output/<extract-run>/transcription.txt --llm openai=gpt-5.6-sol
bun autoshow write output/<extract-run>/transcription.txt --llm openai=gpt-5.5 --llm openai=gpt-5.4-mini
```

### Anthropic

| Option   | Value                                                                                                            |
| -------- | ---------------------------------------------------------------------------------------------------------------- |
| Selector | `--llm anthropic[=<model>]`                                                                                      |
| Models   | `claude-fable-5`, `claude-opus-4-8`, `claude-sonnet-5`, `claude-sonnet-4-6`, `claude-haiku-4-5`, `claude-opus-5` |
| Default  | Passing `--llm anthropic` uses `claude-haiku-4-5`                                                                |

```bash
bun autoshow write output/<extract-run>/transcription.txt --llm anthropic=claude-fable-5
```

Claude Fable 5 requires 30-day data retention and is unavailable under ZDR.

### Gemini

| Option   | Value                                                                                     |
| -------- | ----------------------------------------------------------------------------------------- |
| Selector | `--llm gemini[=<model>]`                                                                  |
| Models   | `gemini-3.1-pro-preview`, `gemini-3.7-flash`, `gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-3.5-flash-lite` |
| Default  | Passing `--llm gemini` uses `gemini-3.5-flash-lite`                                       |

```bash
bun autoshow write output/<extract-run>/transcription.txt --llm gemini=gemini-3.6-flash
```

Gemini 3.7 Flash `--price` estimates use the standard `$1.50 / $7.50` rates effective 2027-01-01, overstating cost during the introductory `$0.75 / $3.75` window through 2026-12-31. Gemini 3.1 Pro Preview is `$4.00 / $18.00` per 1M tokens above 200K.

### Groq

| Option   | Value                                          |
| -------- | ---------------------------------------------- |
| Selector | `--llm groq[=<model>]`                         |
| Models   | `openai/gpt-oss-20b`, `openai/gpt-oss-120b`    |
| Default  | Passing `--llm groq` uses `openai/gpt-oss-20b` |

```bash
bun autoshow write output/<extract-run>/transcription.txt --llm groq=openai/gpt-oss-20b
```

### MiniMax

| Option   | Value                                     |
| -------- | ----------------------------------------- |
| Selector | `--llm minimax[=<model>]`                 |
| Models   | `MiniMax-M3`                              |
| Default  | Passing `--llm minimax` uses `MiniMax-M3` |

```bash
bun autoshow write output/<extract-run>/transcription.txt --llm minimax=MiniMax-M3
```

Above 512K input tokens, MiniMax is `$1.20 / 1M input` and `$4.80 / 1M output`.

### Grok

| Option   | Value                                |
| -------- | ------------------------------------ |
| Selector | `--llm grok[=<model>]`               |
| Models   | `grok-4.3`, `grok-4.5`, `grok-4.6`   |
| Default  | Passing `--llm grok` uses `grok-4.3` |

```bash
bun autoshow write output/<extract-run>/transcription.txt --llm grok=grok-4.5
```

Grok 4.5 and Grok 4.6 price estimates use `$2 / 1M input` and `$6 / 1M output` through 200K input tokens, then `$4 / 1M input` and `$12 / 1M output` above 200K.

### Z.AI GLM

| Option   | Value                              |
| -------- | ---------------------------------- |
| Selector | `--llm glm[=<model>]`              |
| Models   | `glm-5.1`                          |
| Default  | Passing `--llm glm` uses `glm-5.1` |

```bash
bun autoshow write output/<extract-run>/transcription.txt --llm glm=glm-5.1
```

### Kimi

| Option   | Value                                 |
| -------- | ------------------------------------- |
| Selector | `--llm kimi[=<model>]`                |
| Models   | `kimi-k2.6`, `kimi-k3`                |
| Default  | Passing `--llm kimi` uses `kimi-k2.6` |

```bash
bun autoshow write output/<extract-run>/transcription.txt --llm kimi=kimi-k3
```

Kimi K3 thinking is on by default; `--reasoning-effort` can change it.

### Together

| Option   | Value                                   |
| -------- | --------------------------------------- |
| Selector | `--llm together[=<model>]`              |
| Models   | `kimi-k2.6`, `glm-5.1`                  |
| Default  | Passing `--llm together` uses `glm-5.1` |

```bash
bun autoshow write output/<extract-run>/transcription.txt --llm together=kimi-k2.6
```

### Cerebras

| Option   | Value                                        |
| -------- | -------------------------------------------- |
| Selector | `--llm cerebras[=<model>]`                   |
| Models   | `gpt-oss-120b`, `zai-glm-4.7`                |
| Default  | Passing `--llm cerebras` uses `gpt-oss-120b` |

```bash
bun autoshow write output/<extract-run>/transcription.txt --llm cerebras=gpt-oss-120b
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

- Resume of a write run uses the top-level [`resume`](../../setup-and-utilities/resume/resume.md) command, not a `write` flag.
- Shorthands such as `write demo` or `write ./output/demo` do not enable project lyric draft mode; the input must be `./output/<name>/text` or a file under that directory.
- Project lyric draft mode requires `./output/<name>/prompt.md` unless `--prompt-file` is supplied. Explicit `--prompt-file`, `--track-list`, and `--rendered-out-dir` values override the project defaults.

## Generate Media from Write Output

`write` stops at step 3. Generate speech, images, video, or music with the standalone commands against rendered markdown:

```bash
bun autoshow extract video.mp4 --provider deepgram
bun autoshow write output/<extract-run>/transcription.txt --llm openai --prompt shortSummary --rendered-text
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
| Grok `grok-4.6`                 | ✅ 2026-08     | ✅ Required                   | ⚠️ 500K       | ✅ Native                  | $2.00 / $6.00 per 1M tokens   | 16/30     |
| Gemini `gemini-3.7-flash`       | ✅ 2026-08     | ✅ Optional through high      | ✅ 1M          | ✅ Native                  | $1.50 / $7.50 per 1M tokens   | 18/30     |
| OpenAI `gpt-5.6-terra`          | ✅ 2026-08     | ✅ Optional through max       | ❌ Unpublished | ✅ Native                  | $2.00 / $12.00 per 1M tokens  | 22/30     |
| OpenAI `gpt-5.6-luna`           | ✅ 2026-08     | ✅ Optional through max       | ❌ Unpublished | ✅ Native                  | $0.20 / $1.20 per 1M tokens   | 4/30      |
| Gemini `gemini-3.5-flash-lite`  | ✅ 2026-08     | ✅ Optional including minimal | ❌ Unpublished | ✅ Native                  | $0.30 / $2.50 per 1M tokens   | 6/30      |
| OpenAI `gpt-5.6-sol`            | ✅ 2026-07     | ✅ Optional through max       | ❌ Unpublished | ✅ Native                  | $5.00 / $30.00 per 1M tokens  | 28/30     |
| Anthropic `claude-sonnet-5`     | ✅ 2026-07     | ✅ Optional through max       | ❌ Unpublished | ✅ Native                  | $2.00 / $10.00 per 1M tokens  | 21/30     |
| Anthropic `claude-opus-5`       | ✅ 2026-07     | ✅ Optional through max       | ✅ 1M          | ✅ Native                  | $5.00 / $25.00 per 1M tokens  | 26/30     |
| Gemini `gemini-3.6-flash`       | ✅ 2026-07     | ✅ Optional including minimal | ❌ Unpublished | ✅ Native                  | $1.50 / $7.50 per 1M tokens   | 18/30     |
| Grok `grok-4.5`                 | ✅ 2026-07     | ✅ Required                   | ⚠️ 500K       | ✅ Native                  | $2.00 / $6.00 per 1M tokens   | 16/30     |
| Kimi `kimi-k3`                  | ✅ 2026-07     | ✅ Required effort            | ✅ 1M          | ✅ Native                  | $3.00 / $15.00 per 1M tokens  | 24/30     |
| Anthropic `claude-fable-5`      | ✅ 2026-06-09  | ✅ Required adaptive thinking | ❌ Unpublished | ✅ Native                  | $10.00 / $50.00 per 1M tokens | 30/30     |
| Gemini `gemini-3.5-flash`       | ✅ 2026-06     | ✅ Optional including minimal | ❌ Unpublished | ✅ Native                  | $1.50 / $9.00 per 1M tokens   | 20/30     |
| Anthropic `claude-opus-4-8`     | ✅ 2026-05     | ✅ Optional through max       | ❌ Unpublished | ✅ Native                  | $5.00 / $25.00 per 1M tokens  | 26/30     |
| Grok `grok-4.3`                 | ✅ 2026-05     | ❌ Unsupported                | ❌ Unpublished | ✅ Native                  | $1.25 / $2.50 per 1M tokens   | 8/30      |
| OpenAI `gpt-5.5`                | ✅ 2026-04-23  | ✅ Optional through high      | ❌ Unpublished | ✅ Native                  | $5.00 / $30.00 per 1M tokens  | 28/30     |
| OpenAI `gpt-5.4-mini`           | ✅ 2026-03-17  | ✅ Optional through high      | ❌ Unpublished | ✅ Native                  | $0.75 / $4.50 per 1M tokens   | 11/30     |
| OpenAI `gpt-5.4-nano`           | ✅ 2026-03-17  | ✅ Optional through high      | ❌ Unpublished | ✅ Native                  | $0.20 / $1.25 per 1M tokens   | 5/30      |
| Anthropic `claude-sonnet-4-6`   | ✅ 2026-02     | ✅ Optional through max       | ❌ Unpublished | ✅ Native                  | $3.00 / $15.00 per 1M tokens  | 24/30     |
| Kimi `kimi-k2.6`                | ⚠️ 2026-01    | ⚠️ Optional thinking         | ⚠️ 256K       | ✅ Native                  | $0.95 / $4.00 per 1M tokens   | 9/30      |
| Together `kimi-k2.6`            | ⚠️ 2026-01    | ⚠️ Optional thinking         | ⚠️ 262K       | ✅ Native                  | $1.20 / $4.50 per 1M tokens   | 12/30     |
| MiniMax `MiniMax-M3`            | ✅ 2026        | ❌ Unsupported                | ✅ 1M          | ❌ Compatibility fallback  | $0.60 / $2.40 per 1M tokens   | 7/30      |
| GLM `glm-5.1`                   | ✅ 2026        | ⚠️ Optional                  | ⚠️ 200K       | ✅ Native                  | $1.40 / $4.40 per 1M tokens   | 13/30     |
| Together `glm-5.1`              | ✅ 2026        | ⚠️ Optional                  | ⚠️ 202K       | ✅ Native                  | $1.40 / $4.40 per 1M tokens   | 13/30     |
| Gemini `gemini-3.1-pro-preview` | ⚠️ 2025-12    | ✅ Optional through high      | ❌ Unpublished | ✅ Native                  | $2.00 / $12.00 per 1M tokens  | 22/30     |
| Cerebras `zai-glm-4.7`          | ⚠️ 2025-12    | ❌ Unsupported                | ❌ 131K        | ⚠️ Strict-mode normalized | $2.25 / $2.75 per 1M tokens   | 10/30     |
| Anthropic `claude-haiku-4-5`    | ⚠️ 2025-10-01 | ❌ Unsupported                | ❌ Unpublished | ✅ Native                  | $1.00 / $5.00 per 1M tokens   | 15/30     |
| Groq `openai/gpt-oss-20b`       | ❌ 2025-08-05  | ✅ Optional through high      | ❌ Unpublished | ✅ Native                  | $0.075 / $0.30 per 1M tokens  | 1/30      |
| Groq `openai/gpt-oss-120b`      | ❌ 2025-08-05  | ✅ Optional through high      | ❌ Unpublished | ✅ Native                  | $0.15 / $0.60 per 1M tokens   | 2/30      |
| Cerebras `gpt-oss-120b`         | ❌ 2025-08-05  | ❌ Unsupported                | ❌ 131K        | ⚠️ Strict-mode normalized | $0.35 / $0.75 per 1M tokens   | 3/30      |
