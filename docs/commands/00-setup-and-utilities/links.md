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
- [Refresh metadata](#refresh-metadata)
- [Flags](#flags)
- [Maintaining provider links](#maintaining-provider-links)

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

Each run creates a timestamped directory under `output/` (or `--output-root`) and writes the combined markdown inside it. Pass `--output-dir <dir>` to pin that run directory instead. A `--refresh` run without `--output-dir` reuses `docs/links/<selection>-links/`; see [Refresh metadata](#refresh-metadata).

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

| Provider selector           | Sections                                                                        |
| --------------------------- | ------------------------------------------------------------------------------- |
| `--provider assembly`       | `llmstxt`, `models`, `stt`                                                      |
| `--provider cartesia`       | `general`, `llmstxt`, `models`, `tts`                                           |
| `--provider claude`         | `general`, `llmstxt`, `models`, `ocr`, `text`                                   |
| `--provider deepgram`       | `llmstxt`, `stt`                                                                |
| `--provider deepinfra`      | `general`, `llmstxt`, `models`, `ocr`, `stt`                                    |
| `--provider elevenlabs`     | `general`, `llmstxt`, `models`, `music`, `tts`                                  |
| `--provider fal`            | `general`, `image`, `llmstxt`, `video`                                          |
| `--provider firecrawl`      | `general`, `llmstxt`, `url`                                                     |
| `--provider gemini`         | `general`, `image`, `llmstxt`, `models`, `music`, `ocr`, `stt`, `text`, `video` |
| `--provider gladia`         | `general`, `llmstxt`, `stt`                                                     |
| `--provider glm`            | `general`, `llmstxt`, `models`, `ocr`, `text`, `url`                            |
| `--provider grok`           | `general`, `image`, `llmstxt`, `models`, `ocr`, `stt`, `text`, `tts`, `video`   |
| `--provider happyscribe`    | `llmstxt`, `stt`                                                                |
| `--provider hume`           | `general`, `llmstxt`, `tts`                                                     |
| `--provider inworld`        | `general`, `llmstxt`, `models`, `tts`                                           |
| `--provider kimi`           | `general`, `llmstxt`, `models`, `ocr`, `text`                                   |
| `--provider ltx`            | `llmstxt`, `models`, `video`                                                    |
| `--provider lumalabs`       | `general`, `image`, `llmstxt`, `models`, `video`                                |
| `--provider minimax`        | `general`, `llmstxt`, `music`                                                   |
| `--provider mistral`        | `general`, `llmstxt`, `models`, `ocr`, `stt`, `tts`                             |
| `--provider openai`         | `general`, `image`, `llmstxt`, `models`, `ocr`, `text`, `tts`                   |
| `--provider replicate`      | `general`, `llmstxt`, `models`                                                  |
| `--provider scrapecreators` | `general`, `llmstxt`, `stt`                                                     |
| `--provider soniox`         | `llmstxt`, `stt`                                                                |
| `--provider speechify`      | `llmstxt`, `models`, `tts`                                                      |
| `--provider speechmatics`   | `general`, `llmstxt`, `stt`                                                     |
| `--provider spider`         | `general`, `llmstxt`, `url`                                                     |
| `--provider supadata`       | `general`, `llmstxt`, `stt`, `url`                                              |
| `--provider together`       | `general`, `llmstxt`, `models`, `stt`, `text`                                   |
| `--provider whisperfile`    | `llmstxt`, `stt`                                                                |
| `--provider x`              | `general`, `llmstxt`, `url`                                                     |
| `--provider zyte`           | `general`, `llmstxt`, `url`                                                     |

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

bun autoshow links --provider hume tts --provider cartesia tts

bun autoshow links tts --provider openai general text --provider fal video

bun autoshow links --refresh

bun autoshow links --refresh --provider openai models --output-dir output/<earlier-run>
```
## Output format

Each fetched page is appended to the combined file with a source marker. Failed or empty fetches keep going and write a marker instead of a body:

```md
<!-- Source: https://developers.openai.com/api/docs/pricing.md -->
<!-- Failed to fetch https://example.com/page.md -->
<!-- Empty response from https://example.com/page.md -->
```

## Refresh metadata

Pass `--refresh` to compare a selection with its previous refresh. It writes up to three files side by side: the markdown bundle, a JSON sidecar whose path replaces `.md` with `.refresh.json`, and, from the second run on, a changes file whose path replaces `.md` with `.changes.md`.

Without `--output-dir`, a refresh reuses one directory per selection under `docs/links/`, which is git-ignored: `bun autoshow links --refresh` always writes `docs/links/all-all-links/`, and `--provider cartesia --provider inworld` always writes `docs/links/cartesia-all--inworld-all-links/`. `--output-dir` pins any other directory. The bundle is rewritten on every run.

Change status is one of:

- `new`: no prior successful metadata exists for the source URL
- `unchanged`: the current markdown body matches the previous successful refresh
- `changed`: the markdown body differs from the previous successful refresh
- `failed`: the current fetch failed; previous successful metadata is preserved when available

The comparison ignores line order and ISO 8601 timestamps, because some hosts serve the same document differently on every request: `docs.x.ai` shuffles its table rows, and Gladia's OpenAPI spec stamps the request time into its `example` fields. A page whose only edit is a reorder or a new timestamp therefore reads as `unchanged`. In the sidecar, `contentHash` describes the exact markdown in the bundle and `changeHash` is the one compared between runs.

The sidecar also lists links that need attention; see [Checking that links still resolve](#checking-that-links-still-resolve).

Token counts are local estimates for comparison and rough context sizing, not exact billable token counts for any provider or model.

### Changes file

From the second refresh on, `<selection>-links.changes.md` holds a line diff of every `changed` link, plus the links that are new and the links that are no longer selected. It is rewritten on every comparison, including a run with nothing changed, so it never describes an older run. The sidecar records `linesAdded` and `linesRemoved` on each changed link and the file's location in `changesPath`.

A diff is cut off after 300 lines, a line longer than 300 characters is clipped to the window around its first difference, and two versions too far apart to diff are summarised by line counts.

Read the diff before acting on a `changed` link. Most are trivial. `https://www.happyscribe.com/pricing` reports `changed` on every run because its `Customer Reviews` section serves a different random set of testimonials per request; the plans, feature comparison, and FAQ above it are stable.

### Sidecar fields

Beside the hashes, token count, and change status, each link in the sidecar carries:

- `startLine` and `lineCount`: the 1-based line range of the link's section in the bundle, from its marker line to its last line. A full bundle runs to hundreds of thousands of lines, so read one page with that offset and limit instead of searching the file.
- `conversion`, on pages converted from HTML; see [Conversion check](#conversion-check).
- `modelSource`, on a page the model registry names: `pricing`, `catalog`, or both; see [Model sources](#model-sources).

### Model sources

The model registry under `src/cli/commands/setup-and-utilities/models/` names the page each price came from in `pricingSourceUrl` and the page each TTS catalog came from in `catalogSourceUrl`. A refresh that selects whole providers, meaning every provider or each `--provider` named without sections, fetches those pages as well, about 45 more on a full run. They come from the registry on each run, so they need no entry in a link config. A page that a configured link already covers is fetched once, and a source on an `api.` host is skipped because a links run talks to documentation hosts only. A section-scoped, direct-URL, or input-file run fetches exactly what it was asked for.

The sidecar lists the added pages in `selection.modelSourceUrls`. A dead or redirected source is reported like any other link, labelled `Model registry/SOURCES`; fix it in the model config, not in a link config.

The same run reports `model-undocumented` when a configured API model ID appears on no fetched page of the site its sources are on. The whole site is searched because pricing pages often use a marketing name. A model whose ID no page spells out is recorded with its reason in `UNDOCUMENTED_MODEL_IDS` in `src/cli/commands/setup-and-utilities/links/links-model-sources.ts`.

A refresh does not update `pricingCheckedAt` or `catalogCheckedAt`. Those dates record that someone compared the registry's numbers with the page.

### Conversion check

HTML to markdown conversion is the only lossy step in a run, and no hash or token count can tell a provider's edit from the converter dropping content. For each HTML page the run collects the identifiers in the page's text (snake_case and camelCase names, hyphenated IDs that carry a digit such as `voxtral-mini-2602`, and dollar prices) and records in `conversion` the converter used, `identifierCount`, `identifierRecall`, and the `missingIdentifiers` that the markdown lacks.

`identifierRecall` on its own is noisy, since a converter is right to drop a related-models carousel. A `conversion-loss` finding therefore needs the previous capture to have held the identifier: it is reported when at least two identifiers, and at least 10% of the page's identifiers, are ones the previous capture held, the page still has, and this run's markdown lost. They are listed in `conversion.lostIdentifiers` and named in the finding. The loss is reported on the run where it happens; later runs compare with the lossy capture. Run a refresh before and after changing the HTML converter or upgrading Defuddle.

Two kinds of content are absent from a capture without any finding:

- Text a page renders in the browser from a script payload, such as a tab that is not selected in the served HTML or the API model name on Mistral's model cards. Where a provider also serves the page as markdown, link that instead; see [Pages that fetch without their content](#pages-that-fetch-without-their-content).
- On Mistral's `api/endpoint/audio/voices`, the request field list for `POST /v1/audio/voices`, which Defuddle's content scoring drops. Those fields appear only in the code samples.

## Flags

| Flag         | Description                                                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `--provider` | Scope following sections to one provider; repeatable.                                                                        |
| `--refresh`  | Compare with the previous refresh in `docs/links/<selection>`: write the sidecar, a diff of each changed link, and findings. |

## Maintaining provider links

The link configs live in `src/cli/commands/setup-and-utilities/links/model-links/`, one JSON file per provider.

### What belongs in a config

A link belongs in a config only if it documents something this repository calls today: an endpoint, request field, model, error format, rate limit, or price that an existing service depends on. Do not add links for provider capabilities the repository does not implement, including other modalities, other endpoints on the same API, SDKs in other languages, agent or MCP tooling, and realtime or webhook variants of a batch call. Audits do not need to catalogue them. When a capability is implemented, add its links in the same change; when one is removed, remove its links.

### Checking that links still resolve

`--refresh` fetches the pages, records hashes, and reports every link that needs attention.

```bash
bun autoshow links --refresh
bun autoshow links --refresh --provider cartesia --provider inworld
```

Findings are printed as a warning after the sidecar is written and stored in the sidecar's `findings` array, with the count in `totals.attentionCount`. Each finding names the source URL, its provider and section when the URL is configured, a status, and a detail. The command still exits 0, the same as it does for failed fetches. It makes requests to documentation hosts only, never to provider APIs.

| Status               | Meaning                                                                                                                  | Usual fix                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `http-error`         | The final response was not 2xx.                                                                                          | Replace the link from the provider index, or remove it.                                          |
| `fetch-failed`       | The request errored or timed out after retries.                                                                          | Rerun; if it persists, treat as `http-error`.                                                    |
| `empty`              | The response body was empty.                                                                                             | Replace the link, or remove it.                                                                  |
| `login-redirect`     | The page redirects to a sign-in URL, so the bundle holds a login page.                                                   | Replace with the public successor, or remove it.                                                 |
| `duplicate-target`   | The page redirects to a URL that is already configured.                                                                  | Remove the link.                                                                                 |
| `redirect`           | The page redirects to a URL that is not configured.                                                                      | Replace the link with its target.                                                                |
| `duplicate-content`  | The body is identical to an earlier link in the run; the detail names it. A fallback page answers 200 too.               | Read both bodies; fix the path or remove the redundant one.                                      |
| `shrunk`             | The page has at most 60% of the tokens of its previous successful refresh.                                               | Read the body; the provider may have emptied the page.                                           |
| `conversion-loss`    | Identifiers the previous capture held are still on the page but missing from this run's markdown; the detail names them. | Read the page and the capture; fix the converter or link a markdown source.                      |
| `model-undocumented` | A configured API model ID appears on no fetched page of its sources' site. Whole-provider runs only.                     | Check the ID against the provider; if no page spells it, record why in `UNDOCUMENTED_MODEL_IDS`. |

A redirect that only adds or removes a trailing slash or a leading `www.` is not reported. A clean run shows that pages exist and are distinct, not that their content still matches what the repository sends.

### Where each provider's real index lives

`bun as links --provider <name> llmstxt` fetches every entry in a provider's `LLMSTXT` section. For most providers the root `llms.txt` is a complete page list. The providers below are the exceptions; compare against the source named here when auditing them.

| Provider     | Root `llms.txt`                                                                      | Use instead                                                                                     |
| ------------ | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| OpenAI       | Routing index only.                                                                  | `api/llms.txt`, `api/docs/llms.txt`, and `api/reference/llms.txt`, all in `LLMSTXT`.            |
| X            | Routing index only.                                                                  | `x-api/llms.txt`, in `LLMSTXT`.                                                                 |
| Cartesia     | Omits the API reference pages.                                                       | `_llms/en/api.md`, in `LLMSTXT`.                                                                |
| Speechify    | Product stub.                                                                        | `build/llms.txt` and `build/changelog/llms.txt`, in `LLMSTXT`.                                  |
| Firecrawl    | Lists v1 pages only; the repository calls `/v2/scrape`.                              | `_llms/en/v2.md`, in `LLMSTXT`.                                                                 |
| Spider       | Summary only.                                                                        | `llms-full.txt`, in `LLMSTXT`, for every route and parameter.                                   |
| Mistral      | Stale: lists legacy `docs.mistral.ai/docs/...` paths that return 404.                | `https://docs.mistral.ai/sitemap.xml`.                                                          |
| Soniox       | Omits the per-endpoint API reference.                                                | Pages under `/docs/api-reference/stt/`, found by following redirects from the old paths.        |
| HappyScribe  | Marketing pages only.                                                                | `https://dev.happyscribe.com` for the API.                                                      |
| Luma         | Marketing pages only, with product names such as UNI-1.1 that are not API model ids. | `https://docs.agents.lumalabs.ai` for the API; its root has no `llms.txt`.                      |
| fal          | Omits the newest model pages.                                                        | `https://fal.ai/models/<owner>/<model>/api` for configured targets missing from the index.      |
| Replicate    | Lists pages without the `.md` suffix and has no per-model entries.                   | The `.md` forms resolve; model indexes are at `https://replicate.com/<owner>/<model>/llms.txt`. |
| Zyte         | Uses relative paths, and lists at least one page that returns 404.                   | Resolve paths against `https://docs.zyte.com/` and fetch before adding.                         |
| Speechmatics | Uses relative paths.                                                                 | Resolve paths against `https://docs.speechmatics.com/`.                                         |

### Pages that fetch without their content

A 200 and a nonzero token count do not show that a page carries its reference detail. These sources return a page whose request or response schema is missing, so the configured link points elsewhere. A markdown form of a page is not better by default: read both bodies before switching a link either way.

| Provider       | Source that looks right                                 | What it returns                                                                               | Configured instead                                                               |
| -------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Inworld        | `api-reference/.../<endpoint>.md`                       | Title and notes only; no parameters or response schema.                                       | The same URL without `.md`; the HTML page converts with the full schema.         |
| Speechmatics   | `api-ref/batch/<operation>.md` and its HTML form        | Method, path, and status codes; the request section is empty.                                 | `https://raw.githubusercontent.com/speechmatics/docs/main/spec/batch.yaml`.      |
| ScrapeCreators | `/v1/credit-balance`                                    | The introduction page; unknown paths fall back to it.                                         | `/v1/account/credit-balance.md`, the path the OpenAPI document uses.             |
| DeepInfra      | `<model>/api?example=openai-speech-http`                | The same body as `<model>/api`; the query string is ignored.                                  | `<model>/api` only.                                                              |
| X              | `https://docs.x.com/openapi.json`                       | The whole API, about 184k tokens.                                                             | The per-endpoint `.md` pages, each of which embeds its own OpenAPI document.     |
| Speechify      | `build/api-reference/v1/voices/...md`                   | Each page repeats every error schema, 9k to 18k tokens each.                                  | `https://docs.speechify.ai/openapi.json`, which covers the same voice endpoints. |
| ScrapeCreators | An endpoint page as HTML                                | The endpoint inside the whole site navigation: 13k characters for one endpoint.               | The same path with `.md`, which serves that endpoint's OpenAPI document alone.   |
| Mistral        | `resources/sdks` and `resources/error-glossary` as HTML | Entries rendered in the browser are absent: all ten status codes, and the TypeScript SDK tab. | The same URLs with `.md`, which serve the MDX source with every entry.           |
| Speechmatics   | `https://www.speechmatics.com/pricing.md`               | The plans without the per-model `$/hr` price tables.                                          | The HTML page, whose capture keeps those tables.                                 |
