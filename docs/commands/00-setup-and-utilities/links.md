# links

Fetch curated or ad hoc documentation pages and write one combined markdown file into a timestamped run directory under `output/`.

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

## Usage

```bash
bun autoshow links
bun autoshow links <global-section>...
bun autoshow links --provider <name> [section...]
bun autoshow links <global-section>... --provider <name> [section...] [--provider <name> [section...]]
bun autoshow links https://example.com/docs
bun autoshow links urls.md
```

Add `--refresh` or `--refresh-only` to any of these invocations.

## Overview

Each run creates a timestamped directory under `output/` (or `--output-root`) and writes the combined markdown inside it. Pass `--output-dir <dir>` to pin that run directory instead of a timestamped path.

- Curated selections write `<run-dir>/<selection>-links.md`, for example `output/<timestamp>_all-all-links/all-all-links.md`
- Direct URL mode writes `<run-dir>/<host-and-path>-links.md`, for example `blog-railway-com-p-railway-for-agents-links.md` from `https://blog.railway.com/p/railway-for-agents`
- Input file mode writes `<run-dir>/<input-basename>-links.md`, for example `urls-links.md` from `urls.md`
- Duplicate URLs are fetched once, in first-seen order
- HTML pages are converted to markdown; markdown and text pages are appended as-is

## Selection syntax

`bun autoshow links --help-topic providers` lists the current local registry without fetching any pages.

`--provider openai` and `--openai` are equivalent. Mix `--provider` and `--<provider>` selectors freely. Each selector scopes following sections until the next selector. `--provider` takes a provider name only; `provider=model` values are not valid here.

- With no sections or provider selectors, `links` fetches every curated URL in the registry.
- Bare section names before the first provider selector are global selections. They fetch that section across every provider that has it.
- Bare tokens after a provider selector are section names for that provider until the next provider selector.
- A provider selector with no sections fetches every curated section for that provider.
- Provider selectors and section names are case-insensitive.
- Unknown providers or unknown sections exit with a usage error.
- If a valid selection resolves to no URLs, the command exits with `No documentation links matched the provided selections`.

## Direct URL mode

Pass one remote `http://` or `https://` URL to fetch only that page instead of the curated registry:

```bash
bun autoshow links https://example.com/docs
```

Direct URL mode is standalone. Do not combine it with provider selectors, section selectors, input file mode, or another direct URL.

## Input file mode

Pass one local `.md` or `.txt` file to fetch URLs from that file instead of the curated registry:

```bash
bun autoshow links urls.md
```

The file may contain bare `http://` or `https://` URLs and markdown links like `[docs](https://example.com/docs)`. Headings, comments, blank lines, bullets, local file paths, and other non-URL prose are ignored.

Input file mode is standalone. Do not combine it with provider selectors, section selectors, or direct URL mode.

## Supported providers

Accepted provider selectors are the lowercase names below. Fetch other documentation through direct URL or input file mode.

| Provider selector  | Sections                                                                        |
| ------------------ | ------------------------------------------------------------------------------- |
| `--assembly`       | `llmstxt`, `models`, `stt`                                                      |
| `--cartesia`       | `general`, `llmstxt`, `models`, `tts`                                           |
| `--claude`         | `general`, `llmstxt`, `models`, `ocr`, `text`                                   |
| `--deepgram`       | `llmstxt`, `stt`                                                                |
| `--deepinfra`      | `general`, `llmstxt`, `models`, `ocr`, `stt`                                    |
| `--elevenlabs`     | `general`, `llmstxt`, `models`, `music`, `tts`                                  |
| `--fal`            | `general`, `image`, `llmstxt`, `video`                                          |
| `--firecrawl`      | `general`, `llmstxt`, `url`                                                     |
| `--gemini`         | `general`, `image`, `llmstxt`, `models`, `music`, `ocr`, `stt`, `text`, `video` |
| `--gladia`         | `general`, `llmstxt`, `stt`                                                     |
| `--glm`            | `general`, `llmstxt`, `models`, `ocr`, `text`, `url`                            |
| `--grok`           | `general`, `image`, `llmstxt`, `models`, `stt`, `text`, `tts`, `video`          |
| `--happyscribe`    | `llmstxt`, `stt`                                                                |
| `--hume`           | `general`, `llmstxt`, `tts`                                                     |
| `--inworld`        | `general`, `llmstxt`, `models`, `tts`                                           |
| `--kimi`           | `general`, `llmstxt`, `models`, `ocr`, `text`                                   |
| `--ltx`            | `llmstxt`, `models`, `video`                                                    |
| `--lumalabs`       | `general`, `image`, `llmstxt`, `models`, `video`                                |
| `--minimax`        | `general`, `llmstxt`, `music`                                                   |
| `--mistral`        | `general`, `llmstxt`, `models`, `ocr`, `stt`, `tts`                             |
| `--openai`         | `general`, `image`, `llmstxt`, `models`, `ocr`, `text`, `tts`                   |
| `--replicate`      | `general`, `llmstxt`, `models`                                                  |
| `--scrapecreators` | `general`, `llmstxt`, `stt`                                                     |
| `--soniox`         | `llmstxt`, `stt`                                                                |
| `--speechify`      | `llmstxt`, `models`, `tts`                                                      |
| `--speechmatics`   | `general`, `llmstxt`, `stt`                                                     |
| `--spider`         | `general`, `llmstxt`, `url`                                                     |
| `--supadata`       | `general`, `llmstxt`, `stt`, `url`                                              |
| `--together`       | `general`, `llmstxt`, `models`, `stt`, `text`                                   |
| `--whisperfile`    | `llmstxt`, `stt`                                                                |
| `--x`              | `general`, `llmstxt`, `url`                                                     |
| `--zyte`           | `general`, `llmstxt`, `url`                                                     |

## Global sections

Accepted section tokens outside provider selectors:

- `general`
- `image`
- `llmstxt`
- `models`
- `music`
- `ocr`
- `stt`
- `text`
- `tts`
- `url`
- `video`

Not every provider has every section.

The `llmstxt` section is the provider's root `llms.txt` index. `bun autoshow links llmstxt` fetches all root indexes; `bun autoshow links --openai llmstxt` fetches only OpenAI's.

## Examples

```bash
# Fetch all TTS docs across every provider
bun autoshow links tts

# Fetch every curated OpenAI doc
bun autoshow links --openai

# Fetch only OpenAI general and text docs
bun autoshow links --openai general text

# Fetch distinct sections from two providers
bun autoshow links --provider openai models --provider gemini text

# Fetch Hume and Cartesia TTS docs
bun autoshow links --hume tts --cartesia tts

# Mix a global section with provider-specific sections
bun autoshow links tts --openai general text --fal video

# Fetch every curated documentation page and write refresh metadata
bun autoshow links --refresh

# Update refresh metadata without rewriting the markdown bundle
bun autoshow links --refresh-only --openai models
```

## Output format

Each fetched page is appended to the combined file with a source marker. Failed or empty fetches keep going and write a marker instead of a body:

```md
<!-- Source: https://developers.openai.com/api/docs/pricing.md -->
<!-- Failed to fetch https://example.com/page.md -->
<!-- Empty response from https://example.com/page.md -->
```

## Refresh metadata

Pass `--refresh` to write a JSON sidecar next to the generated markdown. The sidecar path replaces `.md` with `.refresh.json` in the same run directory; for example, `openai-models-links.md` gets `openai-models-links.refresh.json`.

`--refresh-only` updates that sidecar without overwriting an existing markdown bundle. A default timestamped run is a new directory, so `--refresh` and `--refresh-only` only compare against a previous bundle when `--output-dir` pins that earlier run.

Change status is one of:

- `new`: no prior successful metadata exists for the source URL
- `unchanged`: the current markdown body matches the previous successful refresh
- `changed`: the markdown body differs from the previous successful refresh
- `failed`: the current fetch failed; previous successful metadata is preserved when available

Token counts are local estimates for comparison and rough context sizing, not exact billable token counts for any provider or model.

## Flags

| Flag             | Description                                                                               |
| ---------------- | ----------------------------------------------------------------------------------------- |
| `--provider`     | Scope following sections to one provider; repeatable.                                     |
| `--refresh`      | Write a refresh metadata sidecar with per-link hashes, token counts, and change status.   |
| `--refresh-only` | Update the refresh metadata sidecar without overwriting an existing markdown bundle file. |
