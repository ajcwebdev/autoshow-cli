# write

Generate structured LLM output from local markdown or plaintext. With no `--provider`, AutoShow selects the cheapest hosted LLM (currently `anthropic` / `claude-haiku-5-5`). Transcribe URLs, media, documents, or X Spaces with `extract` first, then pass the extracted `.txt` / `.md` to `write`.

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
- [Prompts](#prompts)
  - [Summary and Overview](#summary-and-overview)
  - [Chapters](#chapters)
  - [Marketing Content](#marketing-content)
  - [Social Media](#social-media)
  - [Song Lyrics](#song-lyrics)
  - [Creative Writing](#creative-writing)
- [Output](#output)
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
```
## Usage

```bash
bun autoshow write <input> [flags]
```
`write` accepts only local `.md` / `.txt` files or directories of those files. Empty files are rejected, as are files where at least half of the non-blank, non-comment lines are URLs, X Space ids, or existing paths. Every other `.md` / `.txt` file is read as source text. Use `bun autoshow write --help-topic providers` for selector details. Resume an existing write run with [`resume`](../00-setup-and-utilities/resume.md).

```bash
bun autoshow extract input/examples/video/01-two-speaker-speech.mp4 --provider deepgram --output-dir output/write-transcript
bun autoshow write output/write-transcript/transcription.txt --provider openai --prompt shortSummary --rendered-text
```
The second command depends on the first command's `output/write-transcript/transcription.txt`. The video fixture and [its license and excerpt provenance](../../../input/examples/video/README.md) are separate from that generated transcript. Both commands above use hosted services; configure their credentials and review `--price` before execution.

Project lyric draft mode requires your own prepared project: a directory named `text` (for example `./output/<name>/text`) or a `.md` / `.txt` file under it, plus `prompt.md` in the parent directory (or an explicit `--prompt-file`). Paths such as `write demo` or `write ./output/demo` do not enter this mode. In this mode, `write` reads that `prompt.md` by default, uses `tracks.md` in the same parent when present, and writes rendered markdown drafts to the sibling `lyrics` directory. Explicit `--prompt-file`, `--track-list`, and `--rendered-out-dir` override those defaults. The ordinary Harborlight directory examples below do not need a lyric project.

## Shared Write Options

| Flag                                   | Description                                                                                                                                     |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `--provider <provider[=model]>`        | Select an LLM provider as `provider[=model]`; repeat to run multiple providers/models                                                           |
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

The hidden `--llm` compatibility alias still accepts the same selectors as `--provider`; use one spelling per invocation. List current prompt presets with `bun autoshow write --help-topic prompts`.

See [Provider Capabilities](#provider-capabilities) for the per-model reasoning, context, structured-output, and input/output price matrix.

```bash
bun autoshow write output/write-transcript/transcription.txt --provider openai=gpt-6.1-sol --prompt shortSummary longSummary
bun autoshow write input/examples/document/harborlight-field-notes.md --provider openai=gpt-6.1-sol --prompt blog
bun autoshow write input/examples/tts/harborlight-chapters --prompt rockSong
bun autoshow write input/examples/tts/harborlight-chapters --prompt rockSong --price
bun autoshow write input/examples/tts/harborlight-chapters --prompt rockSong --all-providers --max-model-cents 50 --price
```
The original Harborlight field notes support a camping-story blog adaptation. The two chapter files are a standalone text batch; `rockSong` adapts each chapter's story into lyrics. These examples use maintained source files, while `output/write-transcript/transcription.txt` comes from the extraction command above.

Write `--price` estimates use the selected prompt and source text. Use `--json` for structured token estimates and rates.

`--max-model-cents` is a selection filter, not a total command budget. For directory and batch inputs, AutoShow sums each provider/model's estimates across the selected inputs before applying the ceiling. Without `--price`, only retained targets execute. Use the configured `maxCents` budget from `setup --max-cents` when the combined cost of all retained targets must stay below a command-wide limit.

## Write Services

`--provider` accepts `provider[=model]`. Omitting the model uses the cheapest supported model for that provider. Headline per-1M rates are in [Provider Capabilities](#provider-capabilities).

All 11 active write models remain selectable through `--all-providers`. Explicit retired model names fail locally with their replacement; finished runs retain their original identities and rates. Claude Haiku 5.5 and GPT-6 Luna tie at the lowest headline rates; the provider-name tie break selects Anthropic when the provider is omitted.

| Provider  | Selector                         | Default model      |
| --------- | -------------------------------- | ------------------ |
| OpenAI    | `--provider openai[=<model>]`    | `gpt-6-luna`       |
| Anthropic | `--provider anthropic[=<model>]` | `claude-haiku-5-5` |
| Gemini    | `--provider gemini[=<model>]`    | `gemini-3.8-flash` |
| Grok      | `--provider grok[=<model>]`      | `grok-4.7`         |

### OpenAI

```bash
bun autoshow write input/examples/document/harborlight-field-notes.md --provider openai=gpt-6.1-sol --prompt shortSummary --reasoning-effort high
bun autoshow write input/examples/document/harborlight-field-notes.md --provider openai=gpt-6-luna --prompt shortSummary --reasoning-effort disabled
```
GPT-6.1 Sol and GPT-6 Luna use Responses with native JSON schema output, a 1,050,000-token context and 128,000-token maximum output. Both accept `low`, `medium`, `high`, `xhigh`, and `max`; omitted effort or `default` delegates to the native `medium` default. Sol requires reasoning; Luna also accepts `disabled` (native `none`). Both reject `minimal`. [Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol), [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna).

Above 272,000 input tokens, the entire request reprices: GPT-6.1 Sol `$4.00 / $15.00` and GPT-6 Luna `$0.20 / $0.75` per 1M input/output tokens. Astra retains `$20.00 / $75.00` and GPT-5.6 Terra `$4.00 / $18.00`. Astra requires reasoning and accepts `low`, `medium`, `high`, `xhigh`, and `max`. Terra accepts `disabled`, `low`, `medium`, `high`, and `max`; `minimal` and `xhigh` are rejected.

### Anthropic

Claude Fable 5.1 uses always-on adaptive thinking and accepts `--reasoning-effort low`, `medium`, `high`, `xhigh`, or `max`. `disabled` and `minimal` are rejected.

```bash
bun autoshow write input/examples/document/harborlight-field-notes.md --provider anthropic=claude-opus-5-5 --prompt shortSummary --reasoning-effort medium
bun autoshow write input/examples/document/harborlight-field-notes.md --provider anthropic=claude-sonnet-5-5 --prompt shortSummary --reasoning-effort high
bun autoshow write input/examples/document/harborlight-field-notes.md --provider anthropic=claude-haiku-5-5 --prompt shortSummary --reasoning-effort disabled
```
Claude Opus, Sonnet and Haiku 5.5 accept `low`, `medium`, `high`, `xhigh`, and `max`; all reject `minimal`. Opus requires adaptive thinking. Sonnet's `between_tools` mode is distinct from disabled and is not exposed by this CLI; `disabled` is rejected. Haiku accepts `disabled`. Omitted effort or `default` delegates to native effort: `medium` for Opus/Haiku, `high` for Sonnet. Their ordinary provider limits are 1M context and 128K output; AutoShow write requests cap thinking plus text at 16,000 tokens. The Batch-only 300K output beta is outside this command. [Opus](https://platform.claude.com/docs/en/models/opus-5-5/overview), [Sonnet](https://platform.claude.com/docs/en/models/sonnet-5-5/overview), [Haiku](https://platform.claude.com/docs/en/models/haiku-5-5/overview).

Haiku 5.5 uses `$0.10 / $0.50` per 1M input/output tokens through 100,000 prompt tokens. Above that threshold, its entire request, including output, uses `$0.50 / $2.50`. Opus 5.5 uses `$4.00 / $20.00`; Sonnet 5.5 uses `$2.00 / $10.00`. [Pricing](https://platform.claude.com/docs/en/about-claude/pricing).

### Gemini

Gemini 3.8 Flash accepts `--reasoning-effort low`, `medium`, or `high`; `minimal` and `disabled` are rejected. Its `--price` estimates use the standard `$1.50 / $7.50` rates that take effect 2027-01-01, so they overstate cost during the introductory `$0.75 / $3.75` window through 2026-12-31.

```bash
bun autoshow write input/examples/document/harborlight-field-notes.md --provider gemini=gemini-4-argon --prompt shortSummary --reasoning-effort medium
```
Gemini 4 Argon uses synchronous GenerateContent with native JSON schema. It accepts `low`, `medium`, and `high`; omitted effort or `default` delegates to native `medium`. `minimal` and `disabled` are rejected. Its 1,048,576-token window is shared by input, thinking and output; AutoShow caps synchronous thinking/output at 65,536 tokens. Long decode, background execution and continuation are outside this implementation. Estimates conservatively use `$4 / $20` per 1M input/output tokens, overstating the introductory `$2 / $10` rates through 2026-11-30; standard rates begin 2026-12-01. Explicit caching is unsupported. [Model](https://ai.google.dev/gemini-api/docs/models/gemini-4-argon), [pricing](https://ai.google.dev/gemini-api/docs/pricing).

### Grok

```bash
bun autoshow write input/examples/document/harborlight-field-notes.md --provider grok=grok-4.7 --prompt shortSummary --reasoning-effort high
```
Grok 4.7 uses Chat Completions with native JSON schema and a 500,000-token context. It accepts `low`, `medium`, `high`, and `xhigh`; omitted effort or `default` delegates to native `high`. Reasoning cannot be disabled; `minimal` and `max` are rejected. The provider publishes no model text-output ceiling; the retained Chat Completions route defaults to 128,000 visible output tokens when no request cap is set, separately from reasoning. Batch is unsupported. [Model](https://docs.x.ai/developers/models/grok-4.7), [Chat Completions](https://docs.x.ai/developers/model-capabilities/legacy/chat-completions).

Grok 4.7 costs `$2 / $6` per 1M input/output tokens below 200,000 input tokens. At 200,000 or more, its entire request uses `$4 / $12`. [Pricing](https://docs.x.ai/developers/pricing).

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
- `--rendered-text` writes rendered markdown inside the run directory: `text.md` for a single target, or `text-<model>.md` per model when multiple targets are selected. A shared model id uses the same provider-prefixed stem as the JSON file.
- Runs also write `prompt.md` and `manifest.json`. `--prompt-md` adds `prompt-md.md` with markdown examples alongside the JSON prompt.

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

Marks: ✅ supported, ⚠️ partial or qualified, ❌ not exposed. Released dates are provider announcement or model-origin dates. Recency marks: ✅ 2026-04-01 or later, ⚠️ 2026-01-01 through 2026-03-31, ❌ before 2026-01-01. Rows are newest first. All 11 active write models are listed.

Reasoning: ✅ required or optional effort control, ⚠️ optional thinking without a full effort ladder. Context: ✅ 1M+, ⚠️ 500K, ❌ under 500K. Structured: ✅ native JSON schema, ⚠️ JSON object without schema constraint, ❌ not exposed. `write` uses structured outputs and does not send web-search tools. Pricing is per 1M tokens. Input pricing: ✅ cheapest third, ⚠️ middle third, ❌ most expensive third. Cost rank is cheapest first on input $/1M (1 = cheapest); ties share a rank.

| Provider                      | Released   | Reasoning                     | Context  | Structured     | Inputs           | Outputs       | Cost rank |
| ----------------------------- | ---------- | ----------------------------- | -------- | -------------- | ---------------- | ------------- | --------- |
| Gemini `gemini-4-argon`       | ✅ 2026-10 | ✅ Required through high      | ✅ 1.05M | ✅ JSON schema | ❌ $4.00 per 1M  | $20.00 per 1M | 8/11      |
| Anthropic `claude-haiku-5-5`  | ✅ 2026-10 | ✅ Optional through max       | ✅ 1M    | ✅ JSON schema | ✅ $0.10 per 1M  | $0.50 per 1M  | 1/11      |
| OpenAI `gpt-6.1-sol`          | ✅ 2026-09 | ✅ Required through max       | ✅ 1.05M | ✅ JSON schema | ⚠️ $2.00 per 1M  | $10.00 per 1M | 4/11      |
| Anthropic `claude-sonnet-5-5` | ✅ 2026-09 | ✅ Optional through max       | ✅ 1M    | ✅ JSON schema | ⚠️ $2.00 per 1M  | $10.00 per 1M | 4/11      |
| OpenAI `gpt-6-luna`           | ✅ 2026-09 | ✅ Optional through max       | ✅ 1.05M | ✅ JSON schema | ✅ $0.10 per 1M  | $0.50 per 1M  | 1/11      |
| Anthropic `claude-opus-5-5`   | ✅ 2026-09 | ✅ Required through max       | ✅ 1M    | ✅ JSON schema | ❌ $4.00 per 1M  | $20.00 per 1M | 8/11      |
| Grok `grok-4.7`               | ✅ 2026-09 | ✅ Required through xhigh     | ⚠️ 500K  | ✅ JSON schema | ⚠️ $2.00 per 1M  | $6.00 per 1M  | 4/11      |
| Gemini `gemini-3.8-flash`     | ✅ 2026-09 | ✅ Optional through high      | ✅ 1M    | ✅ JSON schema | ✅ $1.50 per 1M  | $7.50 per 1M  | 3/11      |
| OpenAI `gpt-6-astra`          | ✅ 2026-09 | ✅ Required                   | ✅ 1.05M | ✅ JSON schema | ❌ $10.00 per 1M | $50.00 per 1M | 10/11     |
| Anthropic `claude-fable-5-1`  | ✅ 2026-09 | ✅ Required adaptive thinking | ✅ 1M    | ✅ JSON schema | ❌ $10.00 per 1M | $50.00 per 1M | 10/11     |
| OpenAI `gpt-5.6-terra`        | ✅ 2026-08 | ✅ Optional through max       | ✅ 1.05M | ✅ JSON schema | ⚠️ $2.00 per 1M  | $12.00 per 1M | 4/11      |
