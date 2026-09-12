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
bun autoshow links --<provider> [section...]
bun autoshow links <global-section>... --<provider> [section...] [--<provider> [section...]]
bun autoshow links https://example.com/docs
bun autoshow links urls.md
```

Add `--refresh` or `--refresh-only` to any of these invocations.

## Overview

`links` fetches matched pages from the curated documentation registry and concatenates them into a single local file. It can also fetch one remote documentation URL or read a local `.md` or `.txt` file of remote documentation URLs.

Each run creates a timestamped directory under `output/` (or `--output-root`) and writes the combined markdown inside it. Pass `--output-dir <dir>` to pin that run directory instead of a timestamped path.

- Curated selections write `<run-dir>/<normalized-selection>-links.md`, for example `output/<timestamp>_all-all-links/all-all-links.md` or `output/<timestamp>_grok-general-tts-links/grok-general-tts-links.md`
- Direct URL mode writes `<run-dir>/<normalized-host-and-path>-links.md`, for example `blog-railway-com-p-railway-for-agents-links.md` from `https://blog.railway.com/p/railway-for-agents`
- Input file mode writes `<run-dir>/<input-basename>-links.md`, for example `urls-links.md` from `urls.md`
- Duplicate URLs are fetched once
- Raw markdown and text docs are appended as-is; HTML pages are converted to markdown before they are appended

## Selection syntax

`bun autoshow links --help-topic providers` lists the current local registry without fetching any pages. The generic selector accepts a provider name, with section names following it; generation-style `provider=model` values do not apply to documentation links. Registry keys such as `claude` and `assembly` are retained.

```bash
bun autoshow links --provider openai models --provider gemini text
```

Legacy selectors such as `--openai` remain accepted and may be mixed with `--provider`. Each selector scopes subsequent sections until the next selector, preserving existing ordering.

- With no sections or provider selectors, `links` fetches every curated URL in the registry.
- Bare section names before the first provider selector are global selections. They fetch that section across every provider that has it.
- A provider selector such as `--provider openai` or `--openai` starts a provider-scoped selection. Bare tokens after it are treated as section names for that provider until the next provider selector.
- A provider selector with no sections fetches every curated section for that provider.
- Provider selectors and section names are case-insensitive.
- Unknown providers or unknown sections exit with a usage error.
- If a valid selection resolves to no URLs, the command exits with `No documentation links matched the provided selections`.

## Direct URL mode

Pass one remote `http://` or `https://` URL to fetch only that page instead of the curated registry:

```bash
bun autoshow links https://example.com/docs
```

`blob:http://` and `blob:https://` documentation URLs are also accepted.

Direct URL mode is standalone. Do not combine it with provider selectors, section selectors, input file mode, or another direct URL.

## Input file mode

Pass one local `.md` or `.txt` file to fetch URLs from that file instead of the curated registry:

```bash
bun autoshow links urls.md
```

The file may contain bare `http://` or `https://` URLs, markdown links like `[docs](https://example.com/docs)`, and `blob:http://` or `blob:https://` documentation URLs. Headings, comments, blank lines, bullets, local file paths, and other non-URL prose are ignored. Duplicate URLs are fetched once in first-seen order.

Input file mode is standalone. Do not combine it with provider selectors, section selectors, or direct URL mode.

## Supported providers

The curated registry covers services currently implemented in AutoShow. Accepted provider selectors are the lowercase names below. Fetch other documentation through direct URL or input file mode.

| Provider selector | Sections | Root index |
| --- | --- | --- |
| `--assembly` | `llmstxt`, `models`, `stt` | [llms.txt](https://www.assemblyai.com/docs/llms.txt) |
| `--bfl` | `image`, `llmstxt`, `models` | [llms.txt](https://docs.bfl.ml/llms.txt) |
| `--cartesia` | `general`, `llmstxt`, `models`, `tts` | [llms.txt](https://docs.cartesia.ai/llms.txt) |
| `--claude` | `general`, `llmstxt`, `models`, `ocr`, `text` | [llms.txt](https://platform.claude.com/llms.txt) |
| `--deepgram` | `llmstxt`, `stt` | [llms.txt](https://developers.deepgram.com/llms.txt) |
| `--deepinfra` | `general`, `llmstxt`, `models`, `ocr`, `stt` | [llms.txt](https://docs.deepinfra.com/llms.txt) |
| `--elevenlabs` | `general`, `llmstxt`, `models`, `music`, `tts` | [llms.txt](https://elevenlabs.io/docs/llms.txt) |
| `--fal` | `general`, `image`, `llmstxt`, `video` | [llms.txt](https://fal.ai/docs/llms.txt) |
| `--firecrawl` | `general`, `llmstxt`, `url` | [llms.txt](https://docs.firecrawl.dev/llms.txt) |
| `--gemini` | `general`, `image`, `llmstxt`, `models`, `music`, `ocr`, `stt`, `text`, `video` | [llms.txt](https://ai.google.dev/gemini-api/docs/llms.txt) |
| `--gladia` | `general`, `llmstxt`, `stt` | [llms.txt](https://docs.gladia.io/llms.txt) |
| `--glm` | `general`, `llmstxt`, `models`, `ocr`, `text`, `url` | [llms.txt](https://docs.z.ai/llms.txt) |
| `--grok` | `general`, `image`, `llmstxt`, `models`, `stt`, `text`, `tts`, `video` | [llms.txt](https://docs.x.ai/llms.txt) |
| `--happyscribe` | `llmstxt`, `stt` | [llms.txt](https://www.happyscribe.com/llms.txt) |
| `--hume` | `general`, `llmstxt`, `tts` | [llms.txt](https://dev.hume.ai/llms.txt) |
| `--inworld` | `general`, `llmstxt`, `models`, `tts` | [llms.txt](https://docs.inworld.ai/llms.txt) |
| `--kimi` | `general`, `llmstxt`, `models`, `ocr`, `text` | [llms.txt](https://platform.kimi.ai/docs/llms.txt) |
| `--ltx` | `llmstxt`, `models`, `video` | [llms.txt](https://docs.ltx.io/llms.txt) |
| `--lumalabs` | `general`, `image`, `llmstxt`, `models`, `video` | [llms.txt](https://lumalabs.ai/llms.txt) |
| `--minimax` | `general`, `llmstxt`, `music`, `text` | [llms.txt](https://platform.minimax.io/docs/llms.txt) |
| `--mistral` | `general`, `llmstxt`, `models`, `ocr`, `stt`, `tts` | [llms.txt](https://docs.mistral.ai/llms.txt) |
| `--openai` | `general`, `image`, `llmstxt`, `models`, `ocr`, `text`, `tts` | [llms.txt](https://developers.openai.com/llms.txt) |
| `--replicate` | `general`, `llmstxt`, `models` | [llms.txt](https://replicate.com/docs/llms.txt) |
| `--scrapecreators` | `general`, `llmstxt`, `stt` | [llms.txt](https://docs.scrapecreators.com/llms.txt) |
| `--soniox` | `llmstxt`, `stt` | [llms.txt](https://soniox.com/docs/llms.txt) |
| `--speechify` | `llmstxt`, `models`, `tts` | [llms.txt](https://docs.speechify.ai/llms.txt) |
| `--speechmatics` | `general`, `llmstxt`, `stt` | [llms.txt](https://docs.speechmatics.com/llms.txt) |
| `--spider` | `general`, `llmstxt`, `url` | [llms.txt](https://spider.cloud/llms.txt) |
| `--supadata` | `general`, `llmstxt`, `stt`, `url` | [llms.txt](https://docs.supadata.ai/llms.txt) |
| `--together` | `general`, `llmstxt`, `models`, `stt`, `text` | [llms.txt](https://docs.together.ai/llms.txt) |
| `--whisperfile` | `llmstxt`, `stt` | [llms.txt](https://docs.mozilla.ai/llms.txt) |
| `--x` | `general`, `llmstxt`, `url` | [llms.txt](https://docs.x.com/llms.txt) |
| `--zyte` | `general`, `llmstxt`, `url` | [llms.txt](https://docs.zyte.com/llms.txt) |

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

Section availability depends on the provider.

The `llmstxt` section contains exactly one root `llms.txt` URL per provider. `bun autoshow links llmstxt` fetches all root indexes; `bun autoshow links --openai llmstxt` fetches only OpenAI's index. Root indexes are listed in the provider table above and were checked on 2026-09-11.

Indexes use the documentation root where available, which may live under a path such as `/docs/`. HappyScribe and Luma use their main website roots because their current API documentation hosts did not expose a root index. Whisperfile uses the shared Mozilla.ai documentation root, which includes Whisperfile. Replicate's model-specific `llms.txt` files remain in `models`; only its documentation root index belongs to `llmstxt`.

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

# Fetch only the root llms.txt indexes across every provider
bun autoshow links llmstxt

# Fetch one provider's root llms.txt index
bun autoshow links --openai llmstxt

# Fetch one remote docs page
bun autoshow links https://example.com/docs

# Fetch remote docs listed in urls.md
bun autoshow links urls.md

# Fetch every curated OpenAI doc
bun autoshow links --openai

# Fetch only OpenAI general and text docs
bun autoshow links --openai general text

# Fetch Hume and Cartesia TTS docs
bun autoshow links --hume tts --cartesia tts

# Mix a global section with provider-specific sections
bun autoshow links tts --openai general text --fal video

# Update refresh metadata without rewriting the markdown bundle
bun autoshow links --refresh-only --openai models
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

If a response is empty, it writes:

```md
<!-- Empty response from https://example.com/page.md -->
```

## Refresh metadata

Pass `--refresh` to write a JSON sidecar next to the generated markdown:

```bash
bun autoshow links --refresh --openai models
```

The sidecar path replaces `.md` with `.refresh.json` next to the markdown in the same run directory; for example, `openai-models-links.md` gets `openai-models-links.refresh.json`. Direct URL and input file modes use the same rule after their normal markdown filenames.

`--refresh-only` updates that sidecar without overwriting an existing markdown bundle. A default timestamped run is a new directory, so `--refresh` and `--refresh-only` only compare against a previous bundle when `--output-dir` pins that earlier run.

Change status is one of:

- `new`: no prior successful metadata exists for the source URL
- `unchanged`: the current markdown body matches the previous successful refresh
- `changed`: the markdown body differs from the previous successful refresh
- `failed`: the current fetch failed; previous successful metadata is preserved when available

Token counts are local estimates for comparison and rough context sizing, not exact billable token counts for any provider or model.

## Flags

| Flag             | Type    | Description                                                                               |
| ---------------- | ------- | ----------------------------------------------------------------------------------------- |
| `--refresh`      | Boolean | Write a refresh metadata sidecar with per-link hashes, token counts, and change status.   |
| `--refresh-only` | Boolean | Update the refresh metadata sidecar without overwriting an existing markdown bundle file. |
