# links

Fetch curated or ad hoc documentation pages and write one combined markdown file under `project/links/`.

`bun autoshow` is the canonical command used throughout this guide. `bun as` is an equivalent shorthand, so `bun as links --help` and `bun autoshow links --help` invoke the same command.

## Outline

- [Usage](#usage)
- [Overview](#overview)
- [Selection syntax](#selection-syntax)
- [Direct URL mode](#direct-url-mode)
- [Input file mode](#input-file-mode)
- [Supported providers](#supported-providers)
- [Global sections](#global-sections)
- [Examples](#examples)
- [Output format](#output-format)
- [Refresh metadata](#refresh-metadata)
- [Flags](#flags)
- [Notes](#notes)

## Usage

```bash
bun autoshow links
bun autoshow links https://example.com/docs
bun autoshow links urls.md
bun autoshow links --refresh
bun autoshow links --refresh https://example.com/docs
bun autoshow links --refresh urls.md
bun autoshow links <global-section>...
bun autoshow links --<provider> [section...]
bun autoshow links <global-section>... --<provider> [section...] [--<provider> [section...]]
```

## Overview

`links` reads the curated URL registry from `src/cli/commands/setup-and-utilities/links/model-links/`, fetches every matched page, and concatenates the results into a single local file. It can also fetch one standalone remote documentation URL or read a standalone local `.md` or `.txt` file containing remote documentation URLs.

- Output path: `project/links/<normalized-selection>-links.md`
- Examples: `project/links/all-all-links.md`, `project/links/all-models-links.md`, `project/links/all-stt-links.md`, `project/links/gemini-all-links.md`, `project/links/gemini-general-tts-links.md`, `project/links/spider-all-links.md`, `project/links/spider-url-links.md`
- Existing output is overwritten on each run
- Duplicate URLs are removed before fetching, so overlapping selections only fetch once
- Raw markdown/text docs are appended as-is; HTML docs pages are converted to markdown locally before they are appended
- `--refresh` also writes a JSON sidecar with per-link freshness, token-count, and content-change metadata

Direct URL mode uses `project/links/<normalized-host-and-path>-links.md`; for example, `bun autoshow links https://blog.railway.com/p/railway-for-agents` writes `project/links/blog-railway-com-p-railway-for-agents-links.md`.

Input file mode uses `project/links/<input-basename>-links.md`; for example, `bun autoshow links urls.md` writes `project/links/urls-links.md`.

## Selection syntax

- With no sections or provider selectors, `links` fetches every curated URL in the registry.
- Bare section names before the first provider selector are global selections. They fetch that section across every provider that has it.
- A provider selector such as `--openai` starts a provider-scoped selection. Bare tokens after it are treated as section names for that provider until the next provider selector.
- A provider selector with no sections fetches every curated section for that provider.
- Provider selectors and section names are case-insensitive.
- Unknown providers or unknown sections exit with a usage error.
- If a valid selection resolves to no URLs, the command exits with `No documentation links matched the provided selections`.

## Direct URL mode

Pass one remote `http://` or `https://` URL to fetch only that page instead of the curated registry:

```bash
bun autoshow links https://example.com/docs
```

`blob:http://` and `blob:https://` documentation URLs are also accepted. They are fetched through the underlying HTTP URL while preserving the original source marker in the output.

Direct URL mode is standalone. Do not combine it with provider selectors, section selectors, input file mode, or another direct URL.

## Input file mode

Pass one local `.md` or `.txt` file to fetch URLs from that file instead of the curated registry:

```bash
bun autoshow links urls.md
```

The file may contain bare `http://` or `https://` URLs, markdown links like `[docs](https://example.com/docs)`, and `blob:http://` or `blob:https://` documentation URLs. Headings, comments, blank lines, bullets, and non-URL prose are ignored. Duplicate URLs are fetched once in first-seen order.

Input file mode is standalone. Do not combine it with provider selectors, section selectors, or direct URL mode.

## Supported providers

Accepted provider selectors are the lowercase names below.

| Provider selector | Sections |
|-------------------|----------|
| `--assembly` | `models`, `stt` |
| `--better-auth` | `general` |
| `--bfl` | `image`, `models` |
| `--cartesia` | `general`, `models`, `tts` |
| `--cerebras` | `general`, `models`, `text` |
| `--claude` | `general`, `models`, `ocr`, `text` |
| `--deapi` | `models`, `stt` |
| `--deepgram` | `models`, `stt`, `tts` |
| `--deepinfra` | `general`, `models`, `ocr`, `stt` |
| `--drive` | `general` |
| `--elevenlabs` | `models`, `music`, `tts` |
| `--firecrawl` | `general`, `url` |
| `--fal` | `general`, `image`, `video` |
| `--gemini` | `general`, `image`, `models`, `music`, `ocr`, `stt`, `text`, `tts`, `video` |
| `--gladia` | `general`, `stt` |
| `--glm` | `general`, `models`, `ocr`, `text`, `url` |
| `--grok` | `general`, `image`, `models`, `stt`, `text`, `tts`, `video` |
| `--groq` | `general`, `models`, `stt`, `text`, `tts` |
| `--happyscribe` | `stt` |
| `--hume` | `general`, `tts` |
| `--kimi` | `general`, `models`, `ocr`, `text` |
| `--llamafile` | `general`, `stt`, `text` |
| `--ltx` | `models`, `video` |
| `--lumalabs` | `general`, `image`, `models`, `video` |
| `--minimax` | `general`, `music`, `text`, `tts`, `video` |
| `--mistral` | `general`, `models`, `ocr`, `stt`, `tts` |
| `--openai` | `general`, `image`, `models`, `ocr`, `text`, `tts` |
| `--recraft` | `image` |
| `--replicate` | `general`, `models` |
| `--resend` | `general` |
| `--rev` | `general`, `stt` |
| `--runway` | `general`, `models` |
| `--scrapecreators` | `general`, `stt`, `url` |
| `--solidbase` | `general` |
| `--soniox` | `stt` |
| `--speechify` | `models`, `tts` |
| `--speechmatics` | `general`, `stt` |
| `--spider` | `general`, `url` |
| `--supadata` | `general`, `stt`, `url` |
| `--together` | `general`, `models`, `stt`, `text` |
| `--x` | `general`, `url` |
| `--zyte` | `general`, `url` |

## Global sections

Accepted section tokens outside provider selectors:

- `general`
- `image`
- `models`
- `music`
- `ocr`
- `stt`
- `text`
- `tts`
- `url`
- `video`

Section availability depends on the provider.

## Examples

```bash
# Fetch every curated documentation page
bun autoshow links

# Fetch every curated documentation page and write refresh metadata
bun autoshow links --refresh

# Fetch all TTS docs across every provider
bun autoshow links tts

# Fetch all model docs across every provider
bun autoshow links models

# Fetch one remote docs page
bun autoshow links https://example.com/docs

# Fetch one remote docs page and write refresh metadata
bun autoshow links --refresh https://example.com/docs

# Fetch remote docs listed in urls.md
bun autoshow links urls.md

# Fetch remote docs listed in urls.md and write refresh metadata
bun autoshow links --refresh urls.md

# Fetch every curated OpenAI doc
bun autoshow links --openai

# Fetch Better Auth documentation
bun autoshow links --better-auth

# Fetch Solidbase documentation
bun autoshow links --solidbase

# Fetch DeepInfra OCR docs, including normal HTML doc pages
bun autoshow links --deepinfra ocr

# Fetch DeAPI STT docs
bun autoshow links --deapi stt

# Fetch Kimi model, text, and OCR docs
bun autoshow links --kimi models text ocr

# Fetch Cerebras model and text docs
bun autoshow links --cerebras models text

# Fetch Together text and STT docs
bun autoshow links --together text stt

# Fetch Mistral STT, OCR, and TTS docs
bun autoshow links --mistral stt ocr tts

# Fetch Hume and Cartesia TTS docs
bun autoshow links --hume tts --cartesia tts

# Fetch only OpenAI general and text docs
bun autoshow links --openai general text

# Fetch Spider URL scraping and crawling docs
bun autoshow links --spider url

# Fetch llamafile general, STT (whisperfile), and text docs
bun autoshow links --llamafile general stt text

# Fetch LTX video API docs
bun autoshow links --ltx video

# Fetch Luma Labs image and video docs
bun autoshow links --lumalabs image video
bun autoshow links --fal image video

# Fetch Recraft image API docs
bun autoshow links --recraft image

# Fetch Replicate general and model docs
bun autoshow links --replicate general models

# Mix a global section with provider-specific sections
bun autoshow links tts --openai general text --minimax video
```

## Output format

Each fetched page is appended to the combined file with a source marker:

```md
<!-- Source: https://developers.openai.com/api/docs/pricing.md -->
```

If a fetch fails, the command keeps going and writes:

```md
<!-- Failed to fetch https://example.com/page.md -->
```

Fetches are retried for transient network failures, timeouts, `408`, `425`, `429`, and `5xx` responses before this placeholder is written. Each attempt has a fixed 60 second timeout.

If a response is empty, it writes:

```md
<!-- Empty response from https://example.com/page.md -->
```

`--refresh` does not change the combined markdown format. It adds the metadata sidecar described below.

## Refresh metadata

Pass `--refresh` to write a JSON sidecar next to the generated markdown:

```bash
bun autoshow links --refresh --openai models
```

The sidecar path is derived from the markdown path by replacing `.md` with `.refresh.json`; for example, `project/links/openai-models-links.md` gets `project/links/openai-models-links.refresh.json`. Direct URL and input file modes use the same rule after deriving their normal markdown output filenames.

The sidecar includes:

- `schemaVersion`, `command`, `selectionMode`, selected URLs, output path, sidecar path, and `refreshedAt`
- aggregate counts for successful, empty, failed, new, unchanged, changed, and failed links
- aggregate token, byte, and character totals
- tokenizer metadata for the reference tokenizer
- per-link `sourceUrl`, `fetchUrl`, `finalUrl` when available, fetch status, change status, token count, content hash, byte count, character count, refresh timestamps, previous hash/token count when available, and failure reason when applicable

Change status is one of:

- `new`: no prior successful metadata exists for the source URL
- `unchanged`: the current normalized markdown body has the same SHA-256 hash and token count as the previous successful refresh
- `changed`: either the SHA-256 hash or token count changed
- `failed`: the current fetch failed; previous successful hash/token/timestamp metadata is preserved when available

Token counts are reference-tokenizer estimates using `tiktoken` with `o200k_base`. They are intended for stable local comparison and rough context sizing, not as exact billable token counts for every provider or model.

## Flags

| Flag | Type | Description |
|------|------|-------------|
| `--refresh` | Boolean | Write a refresh metadata sidecar with per-link SHA-256 hashes, reference token counts, and change status. |

Global flags like `--config-path` and `--allow-over-budget` may still appear in help output, but they do not change link selection or the output file path for this command.

## Notes

- Provider and section coverage comes entirely from `src/cli/commands/setup-and-utilities/links/model-links/`.
- The generated file is always a single combined markdown file. There is no CLI flag to choose a different output path.
- `--refresh` always rewrites the combined markdown and metadata sidecar. There is no `--refresh-only` mode.
- Curated `.md` / `.txt` endpoints and normal HTML docs pages can be mixed in the same provider/section selection. HTML pages are converted locally first; if that extraction fails, the command falls back to Firecrawl article extraction before marking the URL failed.
- Direct URL mode uses the same fetch and HTML-to-markdown conversion path as curated registry links.
- Input file entries must be remote documentation/page URLs; local file entries inside the input file are ignored.
- Documentation links with a `blob:https://` or `blob:http://` wrapper are fetched through the underlying HTTP URL while preserving the original source marker in the output.
- Selection filenames are derived from normalized provider and section selections, lowercased, deduped, and sorted into a stable order. Input-file filenames use the sanitized input basename. Direct URL filenames use the sanitized URL host and path.
- Provider selectors are parsed manually from argv, so they are documented here even though they do not appear in the standard help flag list. `--refresh` is a real command flag and appears in `bun autoshow links --help`.
