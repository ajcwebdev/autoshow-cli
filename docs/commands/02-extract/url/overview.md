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
bun autoshow extract input/examples/document/harborlight-article.html
```

The local Harborlight page is self-contained and needs no network or provider credentials; install Defuddle with `setup` first. A failed `defuddle` request reports its error. Select `spider` or `zyte` explicitly to use a hosted article backend.

## URL and X Environment

| Provider        | Required env             |
| --------------- | ------------------------ |
| Spider          | `SPIDER_API_KEY`         |
| ScrapeCreators  | `SCRAPECREATORS_API_KEY` |
| Zyte            | `ZYTE_API_KEY`           |
| X/Twitter Space | `X_BEARER_TOKEN`         |

## Shared URL Options

Do not combine `--provider` with `--all-providers` or `--all-local`.

| Flag                           | Description                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `--provider <backend>`         | Article extraction backend for remote article URLs: `defuddle` (default), `spider`, or `zyte`           |
| `--all-providers`              | Run all hosted URL article backends: `spider` and `zyte`                                                |
| `--provider-concurrency <n>`   | Hosted URL backends to run concurrently per item; default `7`                                           |
| `--url-request-timeout-ms <n>` | Per-provider article request timeout in milliseconds; default `60000`                                   |
| `--url-request-attempts <n>`   | Total article request attempts including retries; default `3`                                           |
| `--format <format>`            | Output format for single-backend runs: `text` or `json`                                                 |
| `--price`                      | Show the aggregated URL extraction estimate and exit                                                    |
| `--max-model-cents <n>`        | Exclude each backend whose estimated total across the invocation exceeds the per-model ceiling in cents |

```bash
bun autoshow extract https://example.com/article --provider spider
bun autoshow extract https://example.com/article --all-providers --price
bun autoshow extract https://example.com/article --all-providers --provider-concurrency 2
```

## Public media URL transcripts

ScrapeCreators retrieves an existing transcript from the original public YouTube URL instead of downloading audio. Select it with `--provider`. Other supported media URLs use the selected audio STT engine.

### ScrapeCreators

| Option        | Value                                                |
| ------------- | ---------------------------------------------------- |
| Selector      | `--provider scrapecreators=youtube-transcript`       |
| Language      | `--stt-language scrapecreators=<code>`, default `en` |
| Input support | Public `youtube.com` and `youtu.be` URLs only        |

Supply a public YouTube watch URL with an existing transcript in the requested language. Replace the template value below, set `SCRAPECREATORS_API_KEY`, and confirm that you can open the selected video and its transcript. `metadata` checks source metadata through `yt-dlp`; it does not confirm that ScrapeCreators can retrieve captions.

```bash
YOUTUBE_URL='<your-public-youtube-watch-url>'
bun autoshow metadata "$YOUTUBE_URL"
bun autoshow extract "$YOUTUBE_URL" --provider scrapecreators=youtube-transcript --stt-language scrapecreators=en --price
```

After reviewing the estimate, remove `--price` to retrieve the transcript. Choose a different language code only when that transcript exists. This route retrieves existing YouTube transcripts; it does not generate new ones. A price quote does not validate the URL, captions, API key, or account access.

## YouTube Caption Fallback

`--youtube-captions` looks for English captions on YouTube inputs first. When captions are available, selected STT providers are skipped; otherwise extraction falls back to those providers.

Use the accessible `YOUTUBE_URL` selected above and set `DEEPGRAM_API_KEY` for the fallback. Budget for the STT request even when you expect captions to be present.

```bash
bun autoshow extract "$YOUTUBE_URL" --youtube-captions --provider deepgram=nova-3 --price
```

Remove `--price` after reviewing the estimate. Caption availability can change; a successful metadata check does not prove that the selected STT provider will be skipped.

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
    spider/
    zyte/
  manifest.json
```

## Provider Capabilities

Prices are AutoShow estimates per 1,000 pages. Spider bills actual bandwidth and compute; Zyte bills successful responses by site tier and requested features. These estimates do not establish observed charges. [Spider pricing](https://spider.cloud/pricing/), [Zyte pricing](https://docs.zyte.com/zyte-api/pricing.html).

### Article backends

| Provider        | Output                                     | Pricing        |
| --------------- | ------------------------------------------ | -------------- |
| Spider `spider` | Markdown                                   | $1.20/1k pages |
| Zyte `zyte`     | Markdown from a structured article extract | $1.60/1k pages |

### Transcript backends

| Provider                            | Pages        | Timestamps | Limits            | Pricing          |
| ----------------------------------- | ------------ | ---------- | ----------------- | ---------------- |
| ScrapeCreators `youtube-transcript` | YouTube only | Cue times  | Existing captions | $0.00188/request |

## X Space Path

X/Twitter Space URLs, post URLs, and raw Space IDs are auto-detected. This is an account-dependent template, not a bundled sample source. Set `X_BEARER_TOKEN` for an X API project that can read your selected input, then replace the value with one accessible Space URL, post URL, or actual Space ID. Metadata checks also use the X API and are subject to its access and billing terms.

```bash
X_INPUT='<your-accessible-x-space-url-post-url-or-space-id>'
bun autoshow metadata "$X_INPUT"
bun autoshow extract "$X_INPUT"
```

Review account access and X API billing terms before making the metadata request. AutoShow does not estimate X API read charges, so `--price` does not establish that these requests are free. Inspect the returned metadata and stop on access errors before extraction. The post and raw-ID forms are alternatives to the Space URL; each choice needs its own metadata check.

`twitter.com`, `mobile.`, `www.`, and `/i/web/status/` variants are also supported. A post URL that does not link to a Space still extracts; the Space section of the report is empty.

## X Space Output

X Space extraction writes:

- `result.json` - Space metadata, user profiles, post references, sources, and errors
- `extraction.md` - Markdown report with summary and post tables
- `manifest.json`
