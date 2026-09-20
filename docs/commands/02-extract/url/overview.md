# extract URL and X

Remote article URLs default to local `defuddle` extraction and can run hosted article backends instead. Public media URLs can retrieve a transcript from the original page without downloading audio. X/Twitter Space inputs use the X API for metadata extraction.

## Outline

- [Local URL](#local-url)
- [URL and X Environment](#url-and-x-environment)
- [Shared URL Options](#shared-url-options)
- [Public media URL transcripts](#public-media-url-transcripts)
- [YouTube Caption Fallback](#youtube-caption-fallback)
- [URL Output](#url-output)
- [Provider Capabilities](#provider-capabilities)
  - [Article backends](#article-backends)
  - [Transcript backends](#transcript-backends)
- [X Space Path](#x-space-path)
- [X Space Output](#x-space-output)

See the [`extract` overview](../overview.md) for input routing and default article extraction. Audio transcription engines remain under [STT](../stt/overview.md).

## Local URL

Default for remote articles and local HTML, or select with `--provider defuddle`. Local HTML always uses `defuddle`.

```bash
bun autoshow extract https://ajcwebdev.com
bun autoshow extract input/article.html
```

If `defuddle` fails on a remote article, extraction falls back to `firecrawl`. `--all-providers` and `--all-local` disable that fallback.

## URL and X Environment

| Provider        | Required env             |
| --------------- | ------------------------ |
| Firecrawl       | `FIRECRAWL_API_KEY`      |
| GLM Reader      | `GLM_API_KEY`            |
| Spider          | `SPIDER_API_KEY`         |
| Supadata        | `SUPADATA_API_KEY`       |
| ScrapeCreators  | `SCRAPECREATORS_API_KEY` |
| Zyte            | `ZYTE_API_KEY`           |
| X/Twitter Space | `X_BEARER_TOKEN`         |

## Shared URL Options

Do not combine `--provider` with `--all-providers` or `--all-local`.

| Flag                           | Description                                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `--provider <backend>`         | Article extraction backend for remote article URLs: `defuddle` (default), `firecrawl`, `glm-reader`, `spider`, `supadata`, or `zyte` |
| `--all-providers`              | Run all hosted URL article backends: `firecrawl`, `glm-reader`, `spider`, `supadata`, and `zyte`                                     |
| `--provider-concurrency <n>`   | Hosted URL backends to run concurrently per item; default `7`                                                                        |
| `--url-request-timeout-ms <n>` | Per-provider article request timeout in milliseconds; default `60000`                                                                |
| `--url-request-attempts <n>`   | Total article request attempts including retries; default `3`                                                                        |
| `--format <format>`            | Output format for single-backend runs: `text` or `json`                                                                              |
| `--price`                      | Show the aggregated URL extraction estimate and exit                                                                                 |
| `--max-model-cents <n>`        | Exclude each backend whose estimated total across the invocation exceeds the per-model ceiling in cents                              |

```bash
bun autoshow extract https://example.com/article --provider firecrawl
bun autoshow extract https://example.com/article --all-providers --price
bun autoshow extract https://example.com/article --all-providers --provider-concurrency 2
```

## Public media URL transcripts

Supadata and ScrapeCreators retrieve a transcript from the original public source URL instead of downloading audio. YouTube, Twitch, TikTok, and other media URLs still route through extract; select these backends with `--provider`.

### Supadata

| Option        | Value                                                                        |
| ------------- | ---------------------------------------------------------------------------- |
| Selector      | `--provider supadata=auto`                                                   |
| Language      | `--stt-language supadata=<code>` when a native transcript is available       |
| Input support | Public YouTube, TikTok, Instagram, X/Twitter, Facebook, or direct media URLs |

```bash
bun autoshow extract https://www.youtube.com/watch?v=MORMZXEaONk --provider supadata=auto --stt-language supadata=en
bun autoshow extract https://www.tiktok.com/@example/video/1234567890 --provider supadata=auto
```

`auto` mode uses a native transcript when one exists and generates one when needed. Bare `--provider supadata` on a remote article still selects the article scrape backend.

### ScrapeCreators

| Option        | Value                                                |
| ------------- | ---------------------------------------------------- |
| Selector      | `--provider scrapecreators=youtube-transcript`       |
| Language      | `--stt-language scrapecreators=<code>`, default `en` |
| Input support | Public `youtube.com` and `youtu.be` URLs only        |

```bash
bun autoshow extract "https://www.youtube.com/watch?v=MORMZXEaONk" --provider scrapecreators=youtube-transcript
bun autoshow extract https://youtu.be/dQw4w9WgXcQ --provider scrapecreators=youtube-transcript --stt-language scrapecreators=es
```

Retrieves existing YouTube transcripts; it does not generate new ones.

## YouTube Caption Fallback

`--youtube-captions` looks for English captions on YouTube inputs first. When captions are available, selected STT providers are skipped; otherwise extraction falls back to those providers.

```bash
bun autoshow extract "https://www.youtube.com/watch?v=MORMZXEaONk" --youtube-captions --provider deepgram=nova-3
```

## URL Output

Single-backend extraction writes top-level artifacts and `manifest.json`:

```text
output/YYYY-MM-DD_HH-MM-SS-mmm_title/
  extraction.txt      # default --format text
  result.json         # if --format json
  manifest.json
```

`--all-providers` writes `extraction.txt` and `result.json` per backend under `providers/`:

```text
output/YYYY-MM-DD_HH-MM-SS-mmm_title/
  providers/
    firecrawl/
    glm-reader/
    spider/
    supadata/
    zyte/
  manifest.json
```

Each provider entry in `manifest.json` carries `settings.request` with the backend's request timeout and attempt limit.

## Provider Capabilities

Marks: ✅ supported, ⚠️ partial or qualified, ❌ not exposed. Released dates are provider announcement or model-origin dates. Recency marks: ✅ 2026-04-01 or later, ⚠️ 2026-01-01 through 2026-03-31, ❌ before 2026-01-01. Rows are newest first.

Pricing is the AutoShow estimate. Pricing: ✅ cheapest third, ⚠️ middle third, ❌ most expensive third. Cost rank is cheapest first within each table (1 = cheapest); ties share a rank.

### Article backends

Hosted article backends return markdown except Zyte, which returns a structured article extract. Pricing is per 1,000 pages. File size uses ❌ under 100 MiB, ⚠️ 100 MiB to under 1 GiB, and ✅ 1 GiB or no cap.

| Provider                | Released  | Output                        | File size           | Pricing                                             | Cost rank |
| ----------------------- | --------- | ----------------------------- | ------------------- | --------------------------------------------------- | --------- |
| GLM Reader `glm-reader` | ❌ 2025-11 | ✅ Markdown                    | ✅ No documented cap | ❌ $10.00/1k pages                                   | 4/5       |
| Firecrawl `firecrawl`   | ❌ 2025-08 | ✅ Markdown                    | ✅ No documented cap | ✅ $0.83/1k pages                                    | 1/5       |
| Supadata `supadata`     | ❌ 2024-08 | ✅ Markdown                    | ✅ No documented cap | ❌ $10.00/1k pages (1 credit/page at $10/1k credits) | 4/5       |
| Spider `spider`         | ❌ 2024-01 | ✅ Markdown                    | ✅ No documented cap | ✅ $1.20/1k pages                                    | 2/5       |
| Zyte `zyte`             | ❌ 2023-12 | ⚠️ Structured article extract | ✅ No documented cap | ⚠️ $1.60/1k pages                                   | 3/5       |

### Transcript backends

Duration uses the same marks: under 2 hours is ❌, 2–4 hours is ⚠️, 5+ hours or no documented cap is ✅. File size uses ❌ under 100 MiB, ⚠️ 100 MiB to under 1 GiB, and ✅ 1 GiB or no cap. Cost rank is per-request retrieval cost.

| Provider                            | Released  | YouTube | Other page URLs                                     | Word timestamps      | Transcript cleanup                | Duration            | File size            | Pricing                                     | Cost rank |
| ----------------------------------- | --------- | ------- | --------------------------------------------------- | -------------------- | --------------------------------- | ------------------- | -------------------- | ------------------------------------------- | --------- |
| Supadata `auto`                     | ❌ 2024-08 | ✅ Yes   | ✅ TikTok, Instagram, X/Twitter, Facebook, media URL | ❌ Chunk offsets only | ⚠️ Native transcript or generated | ✅ 12 hours          | ⚠️ 750 MB remote URL | ❌ $0.01/request native; $0.02/min generated | 2/2       |
| ScrapeCreators `youtube-transcript` | ❌ 2024-06 | ✅ Yes   | ❌ YouTube only                                      | ❌ Cue times only     | ⚠️ Retrieves existing captions    | ✅ No documented cap | ✅ No upload          | ✅ $0.00188/request                          | 1/2       |

## X Space Path

X/Twitter Space URLs, post URLs, and raw Space IDs are auto-detected.

```bash
bun autoshow extract "https://x.com/i/spaces/1DXxyRYNejbKM"
bun autoshow extract "https://x.com/user/status/1234567890"
bun autoshow extract 1DXxyRYNejbKM
```

`twitter.com`, `mobile.`, `www.`, and `/i/web/status/` variants are also supported. A post URL that does not link to a Space still extracts; the Space section of the report is empty.

## X Space Output

X Space extraction writes:

- `result.json` - Space metadata, user profiles, post references, sources, and errors
- `extraction.md` - Markdown report with summary and post tables
- `manifest.json`
