# extract URL and X

Remote article URLs and local HTML files use article extraction, while X/Twitter Space inputs use the X API for metadata extraction.

## Outline

- [Article And HTML Path](#article-and-html-path)
- [URL Environment](#url-environment)
- [Shared URL Options](#shared-url-options)
- [All URL Backends](#all-url-backends)
- [Article Services](#article-services)
  - [Defuddle](#defuddle)
  - [Firecrawl](#firecrawl)
  - [GLM Reader](#glm-reader)
  - [Spider](#spider)
  - [Supadata](#supadata)
  - [Zyte](#zyte)
- [URL Output](#url-output)
- [URL Consensus](#url-consensus)
- [X Space Path](#x-space-path)
- [Supported URL Patterns](#supported-url-patterns)
- [X Space Output](#x-space-output)
- [X Space Notes](#x-space-notes)

See the [`extract` overview](./01-extract.md) for input routing across STT, OCR, article HTML, and X/Twitter inputs.

## Article And HTML Path

Article-style HTML inputs route through article extraction rather than OCR provider engines.

| Input family | Default path | Other available paths |
|--------------|--------------|-----------------------|
| Remote article URL | `html+defuddle` | `--url-provider <backend>`, `--provider <backend>`, `--all-providers`, `--all-local` |
| Local `.html` / `.htm` | `html+defuddle` | `--all-local` or `--all-providers` (runs `defuddle`, skips hosted backends) |

In single-backend mode, `defuddle` falls back to `firecrawl` if local extraction fails. In `--all-providers` mode, each backend is run independently without automatic fallback.

## URL Environment

Required API keys for hosted article backends:

```bash
GLM_API_KEY=...
FIRECRAWL_API_KEY=...
SPIDER_API_KEY=...
SUPADATA_API_KEY=...
ZYTE_API_KEY=...
```

Select a backend using `--url-provider <backend>` or run all backends with `--all-providers`. Do not combine `--url-provider` with `--all-providers` or `--all-local`.

## Shared URL Options

| Flag | Description |
|------|-------------|
| `--url-provider <backend>` | Article backend for remote article URLs: `defuddle`, `firecrawl`, `glm-reader`, `spider`, `supadata`, or `zyte` |
| `--provider <backend>` | Route-aware shorthand for a URL backend on article inputs |
| `--all-providers` | For `extract`, run all URL article backends: `defuddle`, `firecrawl`, `glm-reader`, `spider`, `supadata`, and `zyte` |
| `--all-local` | Run local URL article backend (`defuddle`) |
| `--provider-concurrency <n>` | Hosted URL backends to run concurrently per item; default `10` |
| `--url-request-timeout-ms <ms>` | Per-provider URL request timeout; default `60000` |
| `--url-request-attempts <n>` | Total provider request attempts, including the first try; default `3` |
| `--format <format>` | Output format: `text`, `json`, `tsv`, or `hocr` |
| `--price` | Show the aggregated URL extraction estimate and exit |
| `--batch-limit <n>` | Limit batch size |
| `--batch-all` | Process all batch items |
| `--batch-order <newest\|oldest>` | Choose batch ordering |
| `--batch-concurrency <n>` | Process batch items concurrently |

```bash
bun autoshow extract input/examples/batch/2-urls.md --batch-all
bun autoshow extract input/article.html --format json
bun autoshow extract https://example.com/article --all-providers --price
bun autoshow extract https://example.com/article --all-providers --provider-concurrency 2
bun autoshow extract https://example.com/article --all-providers --url-request-timeout-ms 90000 --url-request-attempts 2
```

## All URL Backends

`--all-providers` runs remote HTML/article inputs through all URL backends in canonical order:

```text
defuddle, firecrawl, glm-reader, spider, supadata, zyte
```

`defuddle` runs locally in a single-slot lane; hosted backends run in a pool governed by `--provider-concurrency`.

Rules:
- `--all-providers` conflicts with `--url-provider`.
- `write --all-providers url` runs URL extraction first, stores per-backend artifacts under `providers/<backend>/`, then passes extracted text to the LLM.
- Remote `--all-providers` runs disable the single-backend Defuddle-to-Firecrawl fallback.
- Local `.html` / `.htm` inputs skip hosted backends in all-provider mode (use `--all-local` to run `defuddle`).

## Article Services

### Defuddle

| Option | Value |
|--------|-------|
| Selector | default, or `--url-provider defuddle` |
| Inputs | Remote article URLs and local `.html` / `.htm` files |
| Runtime | Local HTML/article extraction via Defuddle CLI |

```bash
bun autoshow setup --step defuddle
bun autoshow extract https://ajcwebdev.com
bun autoshow extract input/article.html --format json
```

Use `--bin-dir <dir>` to supply a custom `defuddle` binary path. Local `.html` and `.htm` files always use `defuddle`.

### Firecrawl

| Option | Value |
|--------|-------|
| Selector | `--url-provider firecrawl` or `--provider firecrawl` |
| Inputs | Remote article URLs |
| Required env | `FIRECRAWL_API_KEY` |
| Endpoint | `POST /v2/scrape` |

```bash
bun autoshow extract https://ajcwebdev.com --url-provider firecrawl
```

### GLM Reader

| Option | Value |
|--------|-------|
| Selector | `--url-provider glm-reader` or `--provider glm-reader` |
| Inputs | Remote article URLs |
| Required env | `GLM_API_KEY` |
| Endpoint | `POST /reader` |

```bash
bun autoshow extract https://ajcwebdev.com --provider glm-reader
```

### Spider

| Option | Value |
|--------|-------|
| Selector | `--url-provider spider` or `--provider spider` |
| Inputs | Remote article URLs |
| Required env | `SPIDER_API_KEY` |
| Endpoint | `POST /scrape` with `return_format: "markdown"` |

```bash
bun autoshow extract https://ajcwebdev.com --url-provider spider
```

### Supadata

| Option | Value |
|--------|-------|
| Selector | `--url-provider supadata` or `--provider supadata` |
| Inputs | Remote article URLs |
| Required env | `SUPADATA_API_KEY` |
| Endpoint | `GET /web/scrape?url=<source>` |

```bash
bun autoshow extract https://ajcwebdev.com --url-provider supadata
```

### Zyte

| Option | Value |
|--------|-------|
| Selector | `--url-provider zyte` or `--provider zyte` |
| Inputs | Remote article URLs |
| Required env | `ZYTE_API_KEY` |
| Endpoint | `POST /v1/extract` with `article: true` |

```bash
bun autoshow extract https://ajcwebdev.com --url-provider zyte
```

## URL Output

Single-backend extraction writes top-level artifacts and `manifest.json`:

```text
output/YYYY-MM-DD_HH-MM-SS_article/
  extraction.txt      # default --format text
  result.json         # if --format json
  manifest.json
```

`--all-providers` writes per-provider artifacts under `providers/`:

```text
output/YYYY-MM-DD_HH-MM-SS_article/
  providers/
    defuddle/
    firecrawl/
    glm-reader/
    spider/
    supadata/
    zyte/
  manifest.json
```

Each provider `result.json` contains raw extraction metadata and output. Root `manifest.json` tracks item status and canonical provider entries (identity, attempts, cost, timing, and error state).

## URL Consensus

After `--all-providers` runs, use `consensus` to generate comparison reports from `providers/*/result.json`:

```text
.codex/skills/consensus/
  scripts/run.ts url build-packet <run_dir>
  scripts/run.ts url build-report <run_dir>
```

Outputs `consensus-extraction.txt`, `provider-comparison-report.md`, and `provider-comparison-report.json`.

## X Space Path

X/Twitter Space URLs, post URLs, and raw Space IDs are auto-detected and processed via the X v2 API using `X_BEARER_TOKEN`.

```bash
bun autoshow extract "https://x.com/i/spaces/1DXxyRYNejbKM"
bun autoshow extract "https://x.com/user/status/1234567890"
bun autoshow extract 1DXxyRYNejbKM
```

## Supported URL Patterns

| Pattern | Example |
|---------|---------|
| Space URL | `https://x.com/i/spaces/<id>` |
| Twitter Space URL | `https://twitter.com/i/spaces/<id>` |
| Post URL (handle) | `https://x.com/<handle>/status/<id>` |
| Post URL (web) | `https://x.com/i/web/status/<id>` |
| Raw Space ID | `1DXxyRYNejbKM` |

Mobile (`mobile.x.com`, `mobile.twitter.com`) and www variants are also supported.

## X Space Output

X Space extraction writes:
- `result.json` - Space metadata, user profiles, post references, sources, and errors
- `extraction.md` - Markdown report with summary and post tables
- `manifest.json` - Canonical single-run manifest

## X Space Notes

- X inputs work in batch lists (`.md` / `.txt`) with `--batch-all`.
- Supported by `metadata` (lookup), `download` (audio), and `write` (LLM processing). Standalone generation commands reject X links.
- Posts without Spaces produce metadata reports with empty Spaces sections.
