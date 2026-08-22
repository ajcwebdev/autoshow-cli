# extract URL and X

Remote article URLs default to local `defuddle` extraction and can run hosted article backends instead, while X/Twitter Space inputs use the X API for metadata extraction.

## Outline

- [URL and X Environment](#url-and-x-environment)
- [Shared URL Options](#shared-url-options)
- [All URL Backends](#all-url-backends)
- [Article Services](#article-services)
  - [Firecrawl](#firecrawl)
  - [GLM Reader](#glm-reader)
  - [Spider](#spider)
  - [Supadata](#supadata)
  - [Zyte](#zyte)
- [URL Output](#url-output)
- [Provider Capabilities](#provider-capabilities)
- [X Space Path](#x-space-path)
- [Supported URL Patterns](#supported-url-patterns)
- [X Space Output](#x-space-output)
- [X Space Notes](#x-space-notes)

See the [`extract` overview](./01-extract.md) for input routing and default article extraction.

## URL and X Environment

```bash
# hosted article backends
GLM_API_KEY=...
FIRECRAWL_API_KEY=...
SPIDER_API_KEY=...
SUPADATA_API_KEY=...
ZYTE_API_KEY=...

# X/Twitter Space extraction
X_BEARER_TOKEN=...
```

Select a hosted article backend using `--url-provider <backend>` or run all hosted backends with `--all-providers`. Do not combine `--url-provider` with `--all-providers`.

## Shared URL Options

| Flag                                   | Description                                                                                                                                                                       |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--url-provider <backend>`             | Article extraction backend for remote article URLs: `defuddle` (default), `firecrawl`, `glm-reader`, `spider`, `supadata`, or `zyte`                                              |
| `--provider <backend>`                 | Route-aware shorthand for a URL backend on article inputs                                                                                                                         |
| `--all-providers`                      | For `extract`, run all hosted URL article backends: `firecrawl`, `glm-reader`, `spider`, `supadata`, and `zyte`                                                                   |
| `--provider-concurrency <n>`           | Hosted URL backends to run concurrently per item; default `7`                                                                                                                     |
| `--concurrency-mode <ramp\|immediate>` | Start each hosted provider/account lane at one request and add one slot every five seconds while demand is queued (`ramp`, default), or start at its configured cap (`immediate`) |
| `--url-request-timeout-ms <ms>`        | Per-provider URL request timeout; default `60000`                                                                                                                                 |
| `--url-request-attempts <n>`           | Total provider request attempts, including the first try; default `3`                                                                                                             |
| `--format <format>`                    | Output format: `text` or `json`                                                                                                                                                   |
| `--price`                              | Show the aggregated URL extraction estimate and exit                                                                                                                              |
| `--batch-limit <n\|all>`               | Limit batch size or process all items (`all`)                                                                                                                                     |
| `--batch-order <newest\|oldest>`       | Choose batch ordering                                                                                                                                                             |
| `--batch-concurrency <n>`              | Process batch items concurrently                                                                                                                                                  |

```bash
bun autoshow extract input/examples/batch/2-urls.md --batch-limit all
bun autoshow extract https://example.com/article --all-providers --price
bun autoshow extract https://example.com/article --all-providers --provider-concurrency 2
bun autoshow extract https://example.com/article --all-providers --url-request-timeout-ms 90000 --url-request-attempts 2
```

## All URL Backends

`--all-providers` runs remote article URLs through hosted backends in this order:

```text
firecrawl, glm-reader, spider, supadata, zyte
```

Hosted backends run concurrently up to `--provider-concurrency`, using `--concurrency-mode`.

- `--all-providers` and `--all-local` conflict with `--url-provider`.
- Each hosted backend runs independently, with no automatic fallback.

## Article Services

### Firecrawl

| Option       | Value                                                |
| ------------ | ---------------------------------------------------- |
| Selector     | `--url-provider firecrawl` or `--provider firecrawl` |
| Required env | `FIRECRAWL_API_KEY`                                  |

```bash
bun autoshow extract https://ajcwebdev.com --url-provider firecrawl
```

### GLM Reader

| Option       | Value                                                  |
| ------------ | ------------------------------------------------------ |
| Selector     | `--url-provider glm-reader` or `--provider glm-reader` |
| Required env | `GLM_API_KEY`                                          |

```bash
bun autoshow extract https://ajcwebdev.com --provider glm-reader
```

### Spider

| Option       | Value                                          |
| ------------ | ---------------------------------------------- |
| Selector     | `--url-provider spider` or `--provider spider` |
| Required env | `SPIDER_API_KEY`                               |

```bash
bun autoshow extract https://ajcwebdev.com --url-provider spider
```

### Supadata

| Option       | Value                                              |
| ------------ | -------------------------------------------------- |
| Selector     | `--url-provider supadata` or `--provider supadata` |
| Required env | `SUPADATA_API_KEY`                                 |

```bash
bun autoshow extract https://ajcwebdev.com --url-provider supadata
```

### Zyte

| Option       | Value                                      |
| ------------ | ------------------------------------------ |
| Selector     | `--url-provider zyte` or `--provider zyte` |
| Required env | `ZYTE_API_KEY`                             |

```bash
bun autoshow extract https://ajcwebdev.com --url-provider zyte
```

## URL Output

Single-backend extraction writes top-level artifacts and `manifest.json`:

```text
output/YYYY-MM-DD_HH-MM-SS-mmm_title/
  extraction.txt      # default --format text
  result.json         # if --format json
  manifest.json
```

`--all-providers` writes per-provider artifacts under `providers/`:

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

Each provider directory contains that backend's extraction output. The root `manifest.json` records item status, cost, and errors.

## Provider Capabilities

Markdown uses ✅ for scrape markdown and ⚠️ when the backend returns a structured article extract. Pricing is the AutoShow registry scrape rate. Cost rank orders providers cheapest-first (1 = cheapest) and ties share a rank.

| Provider                | Markdown            | Pricing                                           | Cost rank |
| ----------------------- | ------------------- | ------------------------------------------------- | --------- |
| GLM Reader `glm-reader` | ✅ Default markdown | $10.00/1k pages                                   | 4/5       |
| Supadata `supadata`     | ✅ Scrape markdown  | $10.00/1k pages (1 credit/page at $10/1k credits) | 4/5       |
| Firecrawl `firecrawl`   | ✅ Scrape markdown  | $0.83/1k pages                                    | 1/5       |
| Spider `spider`         | ✅ Scrape markdown  | $1.20/1k pages                                    | 2/5       |
| Zyte `zyte`             | ⚠️ Article extract  | $1.60/1k pages                                    | 3/5       |

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
- Supported by `metadata` (lookup), `download` (audio), and `write` (LLM processing). Standalone generation commands reject X links.
- Posts without Spaces produce metadata reports with empty Spaces sections.
