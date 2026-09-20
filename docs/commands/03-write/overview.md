# write

Generate structured LLM output from local markdown or plaintext. With no `--provider`, AutoShow selects the cheapest hosted LLM (currently `glm` / `glm-5.3-flash`). Transcribe URLs, media, documents, or X Spaces with `extract` first, then pass the extracted `.txt` / `.md` to `write`.

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
bun autoshow setup

bun autoshow setup --doctor
```
Write has no local LLM; it always uses a hosted provider.

### Environment

```bash
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GEMINI_API_KEY=...
XAI_API_KEY=...
GLM_API_KEY=...
KIMI_API_KEY=...
TOGETHER_API_KEY=...
```
## Usage

```bash
bun autoshow write <input> [flags]
```
`write` accepts only local `.md` / `.txt` files or directories of those files. A `.md` or `.txt` file is always treated as source text, not as a URL or file-path list. Use `bun autoshow write --help-topic providers` for selector details.

```bash
bun autoshow extract video.mp4 --provider deepgram
bun autoshow write output/<extract-run>/transcription.txt --provider openai --prompt shortSummary --rendered-text
```
Project lyric draft mode engages when the input is `./output/<name>/text` or a `.md` / `.txt` file under that directory and `./output/<name>/prompt.md` exists (or `--prompt-file` is supplied). In that mode, `write` reads `./output/<name>/prompt.md` by default, uses `./output/<name>/tracks.md` when present, and writes rendered markdown drafts to `./output/<name>/lyrics`.

## Shared Write Options

| Flag                                   | Description                                                                                                                                     |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `--provider <provider[=model]>`        | Select an LLM provider as `provider[=model]`; repeat to run multiple providers/models                                                           |
| `--llm <provider[=model]>`             | Compatibility alias for `--provider`; same repeatable values; do not combine the two spellings                                                  |
| `--all-providers`                      | Run every hosted LLM provider/model                                                                                                             |
| `--reasoning-effort <policy>`          | Set reasoning effort / thinking policy: `default`, `disabled`, `minimal`, `low`, `medium`, `high`, `xhigh`, or `max`                            |
| `--batch-limit <n\|all>`               | Limit batch size or process all items (`all`); default `5`                                                                                      |
| `--batch-order <newest\|oldest>`       | Choose batch item order; default `newest`                                                                                                       |
| `--batch-concurrency <n>`              | Batch items to process concurrently; default `7`                                                                                                |
| `--provider-concurrency <n>`           | Hosted providers/models to run concurrently per write item; default `7`                                                                         |
| `--concurrency-mode <ramp\|immediate>` | Ramp from one request (`ramp`, default) or start at the configured cap (`immediate`)                                                            |
| `--prompt <name...>`                   | Select prompt presets                                                                                                                           |
| `--prompt-file <file>`                 | Prepend instructions from a local text file before named prompt presets                                                                         |
| `--rendered-text`                      | Save rendered markdown output inside the run directory                                                                                          |
| `--rendered-out-dir <dir>`             | Also write rendered markdown files to this directory                                                                                            |
| `--track-list <file>`                  | Optional `tracks.md` file used to prepend track-number headers on saved rendered text                                                           |
| `--prompt-md`                          | Save a second prompt file (`prompt-md.md`) with markdown examples alongside the JSON prompt                                                     |
| `--price`                              | Show the aggregated estimate and exit                                                                                                           |
| `--max-model-cents <n>`                | Exclude each provider/model whose estimated total across the invocation exceeds the per-model ceiling in cents; works with or without `--price` |

See [Provider Capabilities](#provider-capabilities) for the per-model reasoning, context, structured-output, web-search, and input/output price matrix.

```bash
bun autoshow write output/<extract-run>/transcription.txt --provider openai=gpt-5.6-sol --prompt shortSummary longSummary
bun autoshow write notes.md --provider openai=gpt-5.6-sol --prompt blog
bun autoshow write ./output/demo/text --prompt rockSong
bun autoshow write ./output/demo/text --price
bun autoshow write ./output/demo/text --all-providers --max-model-cents 50 --price
```
Write `--price` estimates use the selected prompt and source text. Use `--json` for structured token estimates and rates.

`--max-model-cents` is a selection filter, not a total command budget. For directory and batch inputs, AutoShow sums each provider/model's estimates across the selected inputs before applying the ceiling. Without `--price`, only retained targets execute. Use the configured `maxCents` budget from `setup --max-cents` when the combined cost of all retained targets must stay below a command-wide limit.

## Write Services

`--provider` accepts `provider[=model]`. Omitting the model uses the cheapest supported model for that provider.

### OpenAI

| Option   | Value                                           |
| -------- | ----------------------------------------------- |
| Selector | `--provider openai[=<model>]`                   |
| Default  | Passing `--provider openai` uses `gpt-5.6-luna` |

```bash
bun autoshow write output/<extract-run>/transcription.txt --provider openai=gpt-5.6-sol
```
GPT-6 Astra uses `$10.00 / $50.00` per 1M tokens, then `$20.00 / $75.00` for the entire request above 272K input tokens. Reasoning is required; `low`, `medium`, `high`, `xhigh`, and `max` are accepted, while disabled and minimal are rejected.

### Anthropic

| Option   | Value                                                 |
| -------- | ----------------------------------------------------- |
| Selector | `--provider anthropic[=<model>]`                      |
| Default  | Passing `--provider anthropic` uses `claude-sonnet-5` |

```bash
bun autoshow write output/<extract-run>/transcription.txt --provider anthropic=claude-fable-5-1
```
Claude Fable 5.1 uses always-on adaptive thinking; disabled and minimal reasoning are rejected.

Claude Sonnet 5 `--price` estimates still use the introductory `$2.00 / $10.00` rates, so they understate cost after the 2026-09-01 standard `$3.00 / $15.00` transition.

### Gemini

| Option   | Value                                               |
| -------- | --------------------------------------------------- |
| Selector | `--provider gemini[=<model>]`                       |
| Default  | Passing `--provider gemini` uses `gemini-3.7-flash` |

```bash
bun autoshow write output/<extract-run>/transcription.txt --provider gemini=gemini-3.8-flash
```
Gemini 3.7 Flash and Gemini 3.8 Flash accept `--reasoning-effort low`, `medium`, or `high`; `minimal` and `disabled` are rejected. `--price` estimates for those models use the standard `$1.50 / $7.50` rates that take effect 2027-01-01, so they overstate cost during the introductory `$0.75 / $3.75` window through 2026-12-31.

### Grok

| Option   | Value                                     |
| -------- | ----------------------------------------- |
| Selector | `--provider grok[=<model>]`               |
| Default  | Passing `--provider grok` uses `grok-4.6` |

```bash
bun autoshow write output/<extract-run>/transcription.txt --provider grok=grok-4.6
```
Grok 4.6 price estimates use `$2 / 1M input` and `$6 / 1M output` through 200K input tokens, then `$4 / 1M input` and `$12 / 1M output` above 200K.

### Z.AI GLM

| Option   | Value                                             |
| -------- | ------------------------------------------------- |
| Selector | `--provider glm[=<model>]`                        |
| Default  | Passing `--provider glm` uses `glm-5.3-flash`     |

```bash
bun autoshow write output/<extract-run>/transcription.txt --provider glm=glm-5.3-flash
```
GLM 5.3 and GLM 5.3 Flash require reasoning and accept `--reasoning-effort low`, `high`, or `max`; omitted effort uses `default` (delegates to the provider). `disabled`, `minimal`, `medium`, and `xhigh` are rejected.

### Kimi

| Option   | Value                                    |
| -------- | ---------------------------------------- |
| Selector | `--provider kimi[=<model>]`              |
| Default  | Passing `--provider kimi` uses `kimi-k3` |

```bash
bun autoshow write output/<extract-run>/transcription.txt --provider kimi=kimi-k3
```
Kimi K3 requires reasoning and accepts `--reasoning-effort low`, `medium`, `high`, or `max`; omitted effort defaults to `low`. `disabled`, `minimal`, and `xhigh` are rejected.

### Together

| Option   | Value                                                  |
| -------- | ------------------------------------------------------ |
| Selector | `--provider together[=<model>]`                        |
| Default  | Passing `--provider together` uses `glm-5.3-flash`     |

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
- Single-target runs write `text.json` and `show-note.md`.
- Multi-target runs write `text-<model>.json` and `show-note-<model>.md` for each selected LLM target. When two providers share a model id, the filename includes the provider.
- `--rendered-text` writes rendered markdown inside the run directory: `text.md` for a single target, or `text-<model>.md` per model when multiple targets are selected.
- Runs also write `prompt.md` and `manifest.json`. `--prompt-md` adds `prompt-md.md` with markdown examples alongside the JSON prompt.
- Each successful LLM target has a provider entry in `manifest.json` whose `settings.request` is the request body sent, without the prompt text and with any JSON schema stored as a hash, and whose `settings.local` records prompt names, the prompt file path and hash, and structured mode.

## Notes

- Resume of a write run uses the top-level [`resume`](../00-setup-and-utilities/resume.md) command, not a `write` flag.
- Shorthands such as `write demo` or `write ./output/demo` do not enable project lyric draft mode; the input must be `./output/<name>/text` or a file under that directory.
- Project lyric draft mode requires `./output/<name>/prompt.md` unless `--prompt-file` is supplied. Explicit `--prompt-file`, `--track-list`, and `--rendered-out-dir` values override the project defaults.

## Generate Media from Write Output

`write` stops after text generation. Generate speech, images, video, or music from rendered markdown:

```bash
bun autoshow tts output/<write-run>/text.md --provider elevenlabs
bun autoshow music output/<write-run>/text.md --provider elevenlabs
bun autoshow image "$(cat output/<write-run>/text.md)" --provider openai
bun autoshow video "$(cat output/<write-run>/text.md)" --provider grok
```
Lyric drafts pair with `music --lyrics-file`.

## Provider Capabilities

Marks: ✅ supported, ⚠️ partial or qualified, ❌ not exposed. Released dates are provider announcement or model-origin dates. Recency marks: ✅ 2026-04-01 or later, ⚠️ 2026-01-01 through 2026-03-31, ❌ before 2026-01-01. Rows are newest first.

Reasoning: ✅ required or optional effort control, ⚠️ optional thinking without a full effort ladder. Context: ✅ 1M+, ⚠️ 500K, ❌ under 500K. Structured: ✅ native JSON schema, ⚠️ JSON object without schema constraint, ❌ not exposed. Web search: ✅ native hosted search tool, ⚠️ qualified or updating, ❌ not exposed. `write` already uses structured outputs and does not currently send web-search tools. Pricing is per 1M tokens. Input pricing: ✅ cheapest third, ⚠️ middle third, ❌ most expensive third. Cost rank is cheapest first on input $/1M (1 = cheapest); ties share a rank.

| Provider                     | Released   | Reasoning                     | Context  | Structured     | Web search       | Inputs           | Outputs       | Cost rank |
| ---------------------------- | ---------- | ----------------------------- | -------- | -------------- | ---------------- | ---------------- | ------------- | --------- |
| GLM `glm-5.3-flash`          | ✅ 2026-09 | ✅ Required                   | ✅ 1M    | ⚠️ JSON object | ✅ web_search    | ✅ $0.15 per 1M  | $0.50 per 1M  | 1/16      |
| Together `glm-5.3-flash`     | ✅ 2026-09 | ✅ Optional through max       | ✅ 1M    | ✅ JSON schema | ❌ Not exposed   | ✅ $0.15 per 1M  | $0.50 per 1M  | 1/16      |
| Gemini `gemini-3.8-flash`    | ✅ 2026-09 | ✅ Optional through high      | ✅ 1M    | ✅ JSON schema | ✅ Google Search | ⚠️ $1.50 per 1M  | $7.50 per 1M  | 6/16      |
| OpenAI `gpt-6-astra`         | ✅ 2026-09 | ✅ Required                   | ✅ 1.05M | ✅ JSON schema | ✅ web_search    | ❌ $10.00 per 1M | $50.00 per 1M | 15/16     |
| Anthropic `claude-fable-5-1` | ✅ 2026-09 | ✅ Required adaptive thinking | ✅ 1M    | ✅ JSON schema | ✅ web_search    | ❌ $10.00 per 1M | $50.00 per 1M | 15/16     |
| GLM `glm-5.3`                | ✅ 2026-09 | ✅ Required                   | ✅ 1M    | ⚠️ JSON object | ✅ web_search    | ✅ $1.40 per 1M  | $4.40 per 1M  | 4/16      |
| Together `glm-5.3`           | ✅ 2026-09 | ✅ Required                   | ✅ 1M    | ✅ JSON schema | ❌ Not exposed   | ✅ $1.40 per 1M  | $4.40 per 1M  | 4/16      |
| Together `kimi-k3`           | ✅ 2026-09 | ⚠️ Optional thinking          | ✅ 1M    | ✅ JSON schema | ❌ Not exposed   | ❌ $3.00 per 1M  | $15.00 per 1M | 11/16     |
| Grok `grok-4.6`              | ✅ 2026-08 | ✅ Required                   | ⚠️ 500K  | ✅ JSON schema | ✅ web_search    | ⚠️ $2.00 per 1M  | $6.00 per 1M  | 8/16      |
| Gemini `gemini-3.7-flash`    | ✅ 2026-08 | ✅ Optional through high      | ✅ 1M    | ✅ JSON schema | ✅ Google Search | ⚠️ $1.50 per 1M  | $7.50 per 1M  | 6/16      |
| OpenAI `gpt-5.6-terra`       | ✅ 2026-08 | ✅ Optional through max       | ✅ 1.05M | ✅ JSON schema | ✅ web_search    | ⚠️ $2.00 per 1M  | $12.00 per 1M | 8/16      |
| OpenAI `gpt-5.6-luna`        | ✅ 2026-08 | ✅ Optional through max       | ✅ 1.05M | ✅ JSON schema | ✅ web_search    | ✅ $0.20 per 1M  | $1.20 per 1M  | 3/16      |
| OpenAI `gpt-5.6-sol`         | ✅ 2026-07 | ✅ Optional through max       | ✅ 1.05M | ✅ JSON schema | ✅ web_search    | ❌ $5.00 per 1M  | $30.00 per 1M | 13/16     |
| Anthropic `claude-sonnet-5`  | ✅ 2026-07 | ✅ Optional through max       | ✅ 1M    | ✅ JSON schema | ✅ web_search    | ⚠️ $2.00 per 1M  | $10.00 per 1M | 8/16      |
| Anthropic `claude-opus-5`    | ✅ 2026-07 | ✅ Optional through max       | ✅ 1M    | ✅ JSON schema | ✅ web_search    | ❌ $5.00 per 1M  | $25.00 per 1M | 13/16     |
| Kimi `kimi-k3`               | ✅ 2026-07 | ✅ Required effort            | ✅ 1M    | ⚠️ JSON object | ⚠️ Updating      | ❌ $3.00 per 1M  | $15.00 per 1M | 11/16     |
