# links

Fetch curated or ad hoc documentation pages and write one combined markdown file.

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
- [Refresh](#refresh)
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
Add `--refresh` to any of these invocations.

## Overview

Each run creates a timestamped directory under `output/` (or `--output-root`) and writes the combined markdown inside it. Pass `--output-dir <dir>` to pin that run directory instead. A `--refresh` run without `--output-dir` reuses `docs/links/<selection>-links/`; see [Refresh](#refresh).

- Curated selections write `<run-dir>/<selection>-links.md`, for example `output/<timestamp>_all-all-links/all-all-links.md`
- Direct URL mode writes `<run-dir>/<host-and-path>-links.md`, for example `blog-railway-com-p-railway-for-agents-links.md` from `https://blog.railway.com/p/railway-for-agents`
- Input file mode writes `<run-dir>/<input-basename>-links.md`, for example `urls-links.md` from `urls.md`
- Duplicate URLs are fetched once, in first-seen order
- HTML pages are converted to markdown; markdown and text pages are appended as-is

## Selection syntax

`bun autoshow links --help-topic providers` lists the current local registry without fetching any pages.

Each selector scopes following sections until the next selector. `--provider` takes a provider name only; `provider=model` values are not valid here.

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

| Provider selector           | Sections                                                                               |
| --------------------------- | -------------------------------------------------------------------------------------- |
| `--provider assembly`       | `general`, `llmstxt`, `models`, `stt`                                                  |
| `--provider claude`         | `general`, `llmstxt`, `models`, `ocr`, `text`                                          |
| `--provider deepgram`       | `general`, `llmstxt`, `stt`                                                            |
| `--provider deepinfra`      | `general`, `llmstxt`, `models`, `ocr`, `stt`                                           |
| `--provider elevenlabs`     | `general`, `llmstxt`, `models`, `music`, `tts`                                         |
| `--provider fal`            | `general`, `image`, `llmstxt`, `video`                                                 |
| `--provider firecrawl`      | `general`, `llmstxt`, `url`                                                            |
| `--provider gemini`         | `general`, `image`, `llmstxt`, `models`, `music`, `ocr`, `stt`, `text`, `tts`, `video` |
| `--provider gladia`         | `general`, `llmstxt`, `models`, `stt`                                                  |
| `--provider glm`            | `general`, `llmstxt`, `models`, `ocr`, `text`, `url`                                   |
| `--provider grok`           | `general`, `image`, `llmstxt`, `models`, `ocr`, `stt`, `text`, `tts`, `video`          |
| `--provider happyscribe`    | `llmstxt`, `stt`                                                                       |
| `--provider inworld`        | `general`, `llmstxt`, `models`, `tts`                                                  |
| `--provider kimi`           | `general`, `llmstxt`, `models`, `ocr`, `text`                                          |
| `--provider ltx`            | `llmstxt`, `models`, `video`                                                           |
| `--provider lumalabs`       | `general`, `image`, `llmstxt`, `models`, `video`                                       |
| `--provider minimax`        | `general`, `llmstxt`, `models`, `music`                                                |
| `--provider mistral`        | `general`, `llmstxt`, `models`, `ocr`, `stt`                                           |
| `--provider openai`         | `general`, `image`, `llmstxt`, `models`, `ocr`, `stt`, `text`, `tts`                   |
| `--provider replicate`      | `general`, `llmstxt`, `models`                                                         |
| `--provider scrapecreators` | `general`, `llmstxt`, `stt`                                                            |
| `--provider soniox`         | `general`, `llmstxt`, `stt`                                                            |
| `--provider speechmatics`   | `general`, `llmstxt`, `stt`                                                            |
| `--provider spider`         | `general`, `llmstxt`, `url`                                                            |
| `--provider supadata`       | `general`, `llmstxt`, `stt`, `url`                                                     |
| `--provider together`       | `general`, `llmstxt`, `models`, `stt`, `text`                                          |
| `--provider whisperfile`    | `llmstxt`, `stt`                                                                       |
| `--provider x`              | `general`, `llmstxt`, `url`                                                            |
| `--provider zyte`           | `general`, `llmstxt`, `url`                                                            |

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

The `llmstxt` section is the provider's root `llms.txt` index. `bun autoshow links llmstxt` fetches all root indexes; `bun autoshow links --provider openai llmstxt` fetches only OpenAI's.

## Examples

```bash
bun autoshow links tts

bun autoshow links --provider openai

bun autoshow links --provider openai general text

bun autoshow links --provider openai models --provider gemini text

bun autoshow links --provider elevenlabs tts --provider inworld tts

bun autoshow links --provider gemini tts

bun autoshow links --provider gemini general models tts

bun autoshow links tts --provider openai general text --provider fal video

bun autoshow links --refresh

bun autoshow links --refresh --provider openai models --output-dir output/<earlier-run>
```

Gemini's `tts` section includes its current and preview TTS model cards, speech generation and control guides, voice design and replication, and the legacy Generate Content equivalents. Include `general models` to also capture shared pricing, release notes, API references, limits, and deprecations.

## Output format

Each fetched page is appended to the combined file with a source marker. Failed or empty fetches keep going and write a marker instead of a body:

```md
<!-- Source: https://developers.openai.com/api/docs/pricing.md -->
<!-- Failed to fetch https://example.com/page.md -->
<!-- Empty response from https://example.com/page.md -->
```

## Refresh

Pass `--refresh` to compare a selection with its previous refresh. The run rewrites the markdown bundle and writes a JSON sidecar beside it, replacing `.md` with `.refresh.json`. From the second run on it also writes a changes file, replacing `.md` with `.changes.md`.

Without `--output-dir`, a refresh reuses one git-ignored directory per selection under `docs/links/`. `bun autoshow links --refresh` writes `docs/links/all-all-links/`. `--provider elevenlabs --provider inworld` writes `docs/links/elevenlabs-all--inworld-all-links/`. `--output-dir` pins another directory. `--output-root` does not move a refresh that omits `--output-dir`.

Change status on each link is one of:

- `new`: no prior successful metadata exists for the source URL
- `unchanged`: the current markdown body matches the previous successful refresh
- `changed`: the markdown body differs from the previous successful refresh
- `failed`: the current fetch failed; previous successful metadata is preserved when available

Comparison ignores line order and ISO 8601 timestamps, so a reorder or a regenerated timestamp reads as `unchanged`. Token counts in the sidecar are local estimates for comparison and rough context sizing.

The changes file lists every `changed` link as a line diff, plus links that are new and links that are no longer selected. It is rewritten on every comparison, including a run with nothing changed. A long diff is truncated.

A refresh that selects every provider, or each `--provider` named without sections, also fetches the pricing and catalog pages named by the model registry. Sources on an `api.` host are skipped. A section-scoped, direct-URL, or input-file run fetches only what it was asked for.

### Findings

Findings are printed as a warning after the sidecar is written and stored in the sidecar. The command still exits 0, including when a fetch fails. A redirect that only adds or removes a trailing slash, or a leading `www.`, is not reported.

| Status               | Meaning                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| `http-error`         | The final response was not 2xx.                                                                       |
| `fetch-failed`       | The request errored or timed out after retries.                                                       |
| `empty`              | The response body was empty.                                                                          |
| `login-redirect`     | The page redirects to a sign-in URL, so the bundle holds a login page.                                |
| `duplicate-target`   | The page redirects to a URL already fetched in this run.                                              |
| `redirect`           | The page redirects to a URL that was not requested.                                                   |
| `duplicate-content`  | The body matches an earlier link in the run. The detail names that link.                              |
| `shrunk`             | The page has at most 60% of the tokens of its previous successful refresh.                            |
| `conversion-loss`    | Identifiers the previous capture held are still on the page and missing from this run's markdown.     |
| `model-undocumented` | A configured model id appears on no fetched page of its documentation site. Whole-provider runs only. |

## Flags

| Flag         | Description                                                                          |
| ------------ | ------------------------------------------------------------------------------------ |
| `--provider` | Scope following sections to one provider. Repeatable.                                |
| `--refresh`  | Compare with the previous refresh and write the sidecar, changes file, and findings. |
