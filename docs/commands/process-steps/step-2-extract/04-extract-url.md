# extract URL and X

Remote article URLs default to local `defuddle` extraction and can run hosted article backends instead, while X/Twitter Space inputs use the X API for metadata extraction.

## Outline

- [URL and X Environment](#url-and-x-environment)
- [Shared URL Options](#shared-url-options)
- [All URL Backends](#all-url-backends)
- [URL Output](#url-output)
- [Provider Capabilities](#provider-capabilities)
- [X Space Path](#x-space-path)
- [Supported URL Patterns](#supported-url-patterns)
- [X Space Output](#x-space-output)
- [X Space Notes](#x-space-notes)

See the [`extract` overview](./01-extract.md) for input routing and default article extraction.

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

| Flag                                   | Description                                                                                                                                                                       |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--provider <backend>`                 | Article extraction backend for remote article URLs: `defuddle` (default), `firecrawl`, `glm-reader`, `spider`, `supadata`, or `zyte`                                              |
| `--all-providers`                      | For `extract`, run all hosted URL article backends: `firecrawl`, `glm-reader`, `spider`, `supadata`, and `zyte`                                                                   |
| `--provider-concurrency <n>`           | Hosted URL backends to run concurrently per item; default `7`                                                                                                                     |
| `--concurrency-mode <ramp\|immediate>` | Start each hosted provider/account lane at one request and add one slot every five seconds while demand is queued (`ramp`, default), or start at its configured cap (`immediate`) |
| `--format <format>`                    | Output format: `text` or `json`                                                                                                                                                   |
| `--price`                              | Show the aggregated URL extraction estimate and exit                                                                                                                              |
| `--batch-limit <n\|all>`               | Limit batch size or process all items (`all`)                                                                                                                                     |
| `--batch-order <newest\|oldest>`       | Choose batch ordering                                                                                                                                                             |
| `--batch-concurrency <n>`              | Process batch items concurrently                                                                                                                                                  |

```bash
bun autoshow extract input/examples/batch/2-urls.md --batch-limit all
bun autoshow extract https://example.com/article --provider firecrawl
bun autoshow extract https://example.com/article --all-providers --price
bun autoshow extract https://example.com/article --all-providers --provider-concurrency 2
```

## All URL Backends

`--all-providers` runs remote article URLs through hosted backends in this order:

```text
firecrawl, glm-reader, spider, supadata, zyte
```

Do not combine `--provider` with `--all-providers` or `--all-local`. Each hosted backend runs independently, with no automatic fallback.

## URL Output

Single-backend extraction writes top-level artifacts and `manifest.json`:

```text
output/YYYY-MM-DD_HH-MM-SS-mmm_title/
  extraction.txt      # default --format text
  result.json         # if --format json
  manifest.json
```

`--all-providers` writes the same extraction files per backend under `providers/`:

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

The root `manifest.json` records item status, cost, and errors.

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

## Supported URL Patterns

| Pattern           | Example                              |
| ----------------- | ------------------------------------ |
| Space URL         | `https://x.com/i/spaces/<id>`        |
| Twitter Space URL | `https://twitter.com/i/spaces/<id>`  |
| Post URL (handle) | `https://x.com/<handle>/status/<id>` |
| Post URL (web)    | `https://x.com/i/web/status/<id>`    |
| Raw Space ID      | `1DXxyRYNejbKM`                      |

Mobile (`mobile.x.com`, `mobile.twitter.com`) and www variants are also supported.

## X Space Output

X Space extraction writes:

- `result.json` - Space metadata, user profiles, post references, sources, and errors
- `extraction.md` - Markdown report with summary and post tables
- `manifest.json` - run status

## X Space Notes

- X inputs work in batch lists (`.md` / `.txt`) with `--batch-limit all`.
- `metadata` looks up X sources, `download` fetches Space audio, and `extract` writes the Space report. Pass that report to `write` for LLM generation. `tts`, `image`, `video`, and `music` reject X links.
- Posts without Spaces produce metadata reports with empty Spaces sections.
