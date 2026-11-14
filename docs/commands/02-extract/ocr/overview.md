# extract OCR

Extract documents and images with native text parsing, local Tesseract, or hosted OCR. `extract` and `resume` select OCR with `--provider provider[=model]`; `setup --ocr provider[=model]` saves defaults. See [input routing](../overview.md) and [URL extraction](../url/overview.md) for other routes.

## Local OCR

Without saved provider selections, PDFs, images, and CBZ use Tesseract. EPUB uses cleaned native text; `--provider tesseract` forces OCR. Tesseract alone consumes `--ocr-language`, default `eng`; combine installed packs with `+`. Render DPI defaults to 300 and local page concurrency to ten.

```bash
bun autoshow extract input/examples/document/harborlight-field-notes.pdf --provider tesseract --ocr-language eng --ocr-dpi 300
```

## OCR Setup

[`setup`](../../00-setup-and-utilities/setup.md) installs the local toolchain. `bun autoshow setup --step calibre` provisions the PDF and ebook tools; `bun autoshow setup --step ocr` provisions Tesseract, image codecs, and English trained data. Hosted OCR additionally needs the provider's API key.

## OCR Routing

| Input                           | Default                                      | Explicit hosted OCR              |
| ------------------------------- | -------------------------------------------- | -------------------------------- |
| PDF, CBZ, supported images      | Tesseract                                    | Supported                        |
| EPUB                            | Cleaned native text                          | Supported                        |
| MOBI, AZW/AZW3, PRC, FB2, LIT   | Calibre conversion to EPUB, then native text | Follows EPUB                     |
| DOCX, PPTX, XLSX, ODF, RTF, CSV | Native text                                  | OCR flags ignored with a warning |

Images include PNG, JPEG, TIFF, WebP, BMP, and GIF. Unsupported provider image formats convert to PNG. TIFF normalization requires ImageMagick unless sent directly to a compatible provider such as Mistral. `--docx-markdown` preserves local DOCX formatting in `extraction.md` without a provider.

## Shared OCR Options

| Flag                              | Behavior                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------ |
| `--format text` / `--format json` | Choose the extraction artifact format; default `text`                          |
| `--password`                      | PDF password for supported local rendering/decryption                          |
| `--ocr-language`, `--ocr-dpi`     | Tesseract languages and page-render resolution                                 |
| `--ocr-provider-mode fanout`      | Give every target the full document; default mode                              |
| `--ocr-provider-mode pool`        | Share discrete pages between targets                                           |
| `--primary-ocr service[/model]`   | Promote a requested complete fan-out result to top-level artifacts             |
| `--provider-concurrency`          | Hosted targets per item; default ten                                           |
| `--step-concurrency ocr-page=N`   | Explicit page cap; local default ten, hosted default adaptive `auto`           |
| `--concurrency-mode`              | Hosted admission `ramp` (default) or `immediate`                               |
| `--chapters`, `--no-chapters`     | Enable chapter exports or select one extracted file                            |
| `--length N`                      | Split EPUB/PDF chapter exports at N thousand characters; no default hard limit |
| `--pdf-chapter-mode`              | `local` (default), `auto`, or `llm`                                            |
| `--price`, `--max-model-cents N`  | Estimate locally; optionally filter targets by their invocation-wide estimate  |

```bash
bun autoshow extract input/examples/document/harborlight-field-notes.pdf --all-providers --max-model-cents 10 --price
```

A cost filter is an estimate filter, not a provider-enforced spending cap. Page/token estimates vary by format and effective reasoning policy; measured image profiles apply only to their qualified context. Provider rates and estimated usage are separate.

## Multi-Provider Execution Modes

In `fanout`, one target writes top-level `extraction.txt` or `result.json`. Multiple targets each write a complete result under `providers/<service>-<model>/`; top-level extraction requires `--primary-ocr` selecting a complete requested target.

In `pool`, targets claim different pages and produce one top-level composite in source order. Provider directories hold attempts rather than complete documents. Pooling supports PDFs, CBZ, and images; unsplittable inputs and `--primary-ocr` are rejected before dispatch.

```bash
bun autoshow extract input/examples/document/harborlight-field-notes.pdf \
  --provider grok=grok-4.7 --provider mistral=mistral-ocr-4-1 \
  --ocr-provider-mode pool --step-concurrency ocr-page=10 --price
```

Pool pricing allocates the page set once across targets; `resume --price` counts only unfinished pages. Live failures and redistribution can change actual cost. See [pooling policy](../../../adr/ADR-008-ocr-execution-pooling-and-artifacts.md).

## EPUB Options

Native EPUB extraction writes kept sections to `chapters/`; `--length` splits oversized sections and `--no-chapters` selects a single file. Convertible ebooks retain original-format/conversion metadata.

```bash
bun autoshow extract input/examples/document/1-epub.epub --length 50
bun autoshow extract input/examples/document/1-epub.epub --no-chapters
```

## PDF Chapter Detection

PDFs with at least 40 extracted pages attempt local chapter detection automatically. `--chapters` enables it at any page count; `--no-chapters` disables chapter exports. Detection uses bookmarks, TOC pages, and headings.

Without explicit `--chapters`, detection stays local. With it, `--pdf-chapter-mode auto` may use a configured LLM when local evidence is weak; `llm` always attempts model assistance. These modes can add writing charges.

```bash
bun autoshow extract input/examples/document/harborlight-field-notes.pdf --chapters --pdf-chapter-mode local
```

Chapter names are `chapters/<ordinal>-<source-locator>-<slug>.txt`, using PDF start pages or EPUB spine/section indices. Oversized parts append `-part-NN`; collisions add `-02`, `-03`, etc. before that suffix.

## OCR Services

Bare-provider defaults below come from the current resolver. Use `bun autoshow extract --help` for accepted model IDs; [registry policy](../../../adr/ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) owns lifecycle, prices, and capabilities.

| Provider  | Bare-provider default | API key             |
| --------- | --------------------- | ------------------- |
| Mistral   | `mistral-ocr-4-1`     | `MISTRAL_API_KEY`   |
| OpenAI    | `gpt-6-luna`          | `OPENAI_API_KEY`    |
| Grok      | `grok-4.7`            | `XAI_API_KEY`       |
| Anthropic | `claude-haiku-5-5`    | `ANTHROPIC_API_KEY` |
| Gemini    | `gemini-3.8-flash`    | `GEMINI_API_KEY`    |

```bash
bun autoshow extract input/examples/document/harborlight-field-notes.pdf --provider openai=gpt-6-luna --reasoning-effort disabled --price
bun autoshow extract input/examples/document/harborlight-field-notes.pdf --provider gemini=gemini-3.8-flash --reasoning-effort medium --price
```

## Provider Capabilities

These are CLI input/request constraints, not promises of provider access or OCR quality. Inspect the dated `ocr-config/` registry entries for numeric tariffs and complete limits rather than assuming a copied price table is current.

- **Mistral:** native PDF and PNG/JPEG/TIFF inputs; page-based pricing and Markdown output. No reasoning control.
- **OpenAI:** native PDF, capped at 50 MiB per request, and supported images. `gpt-6.1-sol` requires reasoning; `gpt-6-luna` also accepts `disabled`. Both accept `low|medium|high|xhigh|max`, reject `minimal`, and delegate omitted/reset effort to native `medium`.
- **Grok:** PDF pages render to PNG; direct PNG/JPEG inputs are capped at 20 MiB. Visible OCR output is capped at 4,096 tokens per page. Efforts are `low|medium|high|xhigh`, with native `high`; disabling is unsupported.
- **Anthropic:** unencrypted PDF uploads and PNG/JPEG/GIF/WebP images, with a conservative 5 MiB direct-image cap and 500 MiB upload ceiling. Opus, Sonnet, Haiku 5.5 and Fable 5 accept `low|medium|high|xhigh|max`; only Haiku accepts `disabled`. Omitted/reset effort delegates to the provider. Fable 5 retains its registry-noted data-retention restriction.
- **Gemini:** native PDF and supported images, with inline input followed by Files API upload for larger files; upload ceiling 2 GiB and PDF limit 1,000 pages. Accepts `low|medium|high`; omission selects `low`, while explicit `default` delegates to the provider.

Single-page OpenAI requests return text; its multi-page requests and Anthropic/Gemini requests use structured pages. Provider response structure is independent of `--format`.

Tesseract and rendered-page paths apply `--password` locally. Anthropic rejects encrypted/password-protected PDFs. Native Mistral/OpenAI/Gemini uploads pass the original PDF; a rendered fallback applies the local password. Decrypt unsupported encrypted inputs first.

## Incomplete Runs and Blocked Providers

Every run keeps `manifest.json` with effective settings; passwords are not recorded. Failures preserve successful outputs and redacted errors. Fan-out remains incomplete if a requested target fails; pool mode retains accepted pages.

Automatic [`resume`](../../00-setup-and-utilities/resume.md) skips deterministic billing, quota, account, authentication, and policy blockers. After fixing the cause, explicitly select that target to retry it. Transient failures remain eligible, but ambiguous paid admissions do not authorize automatic repurchase. Retired unfinished targets require an explicit active replacement; resume never substitutes silently.

See [OCR tests](tests.md) for local checks and price-first live coverage.
