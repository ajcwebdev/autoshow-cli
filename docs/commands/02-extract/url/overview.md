# extract URL and X

Remote article URLs default to local `defuddle` extraction and can run hosted article backends instead. X/Twitter Space inputs use the X API for metadata extraction.

## Outline

- [Local URL](#local-url)
- [URL and X Environment](#url-and-x-environment)
- [Shared URL Options](#shared-url-options)
- [URL Output](#url-output)
- [Provider Capabilities](#provider-capabilities)
- [X Space Path](#x-space-path)
- [X Space Output](#x-space-output)

See the [`extract` overview](../overview.md) for input routing and default article extraction.

## Local URL

Default for remote articles and local HTML, or select with `--provider defuddle`. Local HTML always uses `defuddle`.

```bash
bun autoshow extract https://ajcwebdev.com
bun autoshow extract input/article.html
```

When `defuddle` is the selected single backend for a remote article, it falls back to `firecrawl` if extraction fails. `--all-providers` and `--all-local` disable that fallback.

## URL and X Environment

| Provider        | Required env        |
| --------------- | ------------------- |
| Firecrawl       | `FIRECRAWL_API_KEY` |
| GLM Reader      | `GLM_API_KEY`       |
| Spider          | `SPIDER_API_KEY`    |
| Supadata        | `SUPADATA_API_KEY`  |
| Zyte            | `ZYTE_API_KEY`      |
| X/Twitter Space | `X_BEARER_TOKEN`    |

## Shared URL Options

Do not combine `--provider` with `--all-providers` or `--all-local`.

| Flag                             | Description                                                                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `--provider <backend>`           | Article extraction backend for remote article URLs: `defuddle` (default), `firecrawl`, `glm-reader`, `spider`, `supadata`, or `zyte` |
| `--all-providers`                | Run all hosted URL article backends: `firecrawl`, `glm-reader`, `spider`, `supadata`, and `zyte`. Each backend runs independently.   |
| `--provider-concurrency <n>`     | Hosted URL backends to run concurrently per item; default `7`                                                                        |
| `--url-request-timeout-ms <n>`   | Per-provider article request timeout in milliseconds; default `60000`                                                                |
| `--url-request-attempts <n>`     | Total article request attempts including retries; default `3`                                                                        |
| `--format <format>`              | Output format for single-backend runs: `text` or `json`                                                                              |
| `--price`                        | Show the aggregated URL extraction estimate and exit                                                                                 |
| `--max-model-cents <n>`          | Exclude each backend whose estimated total across the invocation exceeds the per-model ceiling in cents                              |

```bash
bun autoshow extract https://example.com/article --provider firecrawl
bun autoshow extract https://example.com/article --all-providers --price
bun autoshow extract https://example.com/article --all-providers --provider-concurrency 2
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

## Provider Capabilities

Hosted backends return markdown except Zyte, which returns a structured article extract.

| Provider                | Pricing                                           |
| ----------------------- | ------------------------------------------------- |
| Firecrawl `firecrawl`   | $0.83/1k pages                                    |
| Spider `spider`         | $1.20/1k pages                                    |
| Zyte `zyte`             | $1.60/1k pages                                    |
| GLM Reader `glm-reader` | $10.00/1k pages                                   |
| Supadata `supadata`     | $10.00/1k pages (1 credit/page at $10/1k credits) |

## X Space Path

X/Twitter Space URLs, post URLs, and raw Space IDs are auto-detected and processed via the X API using `X_BEARER_TOKEN`.

```bash
bun autoshow extract "https://x.com/i/spaces/1DXxyRYNejbKM"
bun autoshow extract "https://x.com/user/status/1234567890"
bun autoshow extract 1DXxyRYNejbKM
```

| Pattern           | Example                              |
| ----------------- | ------------------------------------ |
| Space URL         | `https://x.com/i/spaces/<id>`        |
| Twitter Space URL | `https://twitter.com/i/spaces/<id>`  |
| Post URL (handle) | `https://x.com/<handle>/status/<id>` |
| Post URL (web)    | `https://x.com/i/web/status/<id>`    |
| Raw Space ID      | `1DXxyRYNejbKM`                      |

Mobile (`mobile.x.com`, `mobile.twitter.com`) and www variants are also supported.

`metadata` looks up X sources, `download` fetches Space audio, and `extract` writes the Space report. Pass that report to `write` for LLM generation. `tts`, `image`, `video`, and `music` do not take X links as source inputs. A post URL that does not link to a Space still extracts; the Space section of the report is empty.

## X Space Output

X Space extraction writes:

- `result.json` - Space metadata, user profiles, post references, sources, and errors
- `extraction.md` - Markdown report with summary and post tables
- `manifest.json` - run status
