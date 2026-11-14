# links

Fetch curated documentation, one URL, or a local URL list into one Markdown bundle. URLs are deduplicated in first-seen order; HTML converts to Markdown, while text/Markdown sources remain text.

## Usage

```bash
bun autoshow links
bun autoshow links models
bun autoshow links --provider openai models --provider gemini text
bun autoshow links https://example.com/docs
bun autoshow links input/examples/batch/provider-docs.md
```

## Selection syntax

- No selection fetches every curated URL.
- Sections before the first `--provider` apply globally. Following sections belong to that provider until the next selector.
- A provider without sections selects all its sections. `--provider` takes a name, never `provider=model`.
- Names are case-insensitive. Unknown names or selections with no matching URLs fail locally.
- Direct URL and input-file modes are standalone: do not mix them with curated selectors or each other.

```bash
bun autoshow links tts --provider openai general text --provider grok video
bun autoshow links --provider openai llmstxt
```

## Supported providers

Use `bun autoshow links --help-topic providers` for the current local provider registry without fetching pages. Link-provider names can differ from generation selectors, such as `assembly` and `claude`. Use direct URLs or file mode for other sites.

## Global sections

Current sections are `general`, `image`, `llmstxt`, `models`, `music`, `ocr`, `stt`, `text`, `tts`, `url`, and `video`; each provider exposes a subset. `--help` lists the registered sections. Model references belong in `models`; `llmstxt` selects root `llms.txt` indexes.

## Direct URL mode

One `http://` or `https://` URL fetches only that page.

## Input file mode

One local `.md` or `.txt` file supplies bare URLs or Markdown links, including bullet lists. Headings, comments, blank lines, local paths, and other prose are ignored.

## Output format

Plain runs write `<selection>-links.md` under `output/<timestamp>_<selection>-links/`, or `--output-root`. `--output-dir` pins the run directory. URL names derive from host/path; file names derive from the input basename.

Each page has a `<!-- Source: URL -->` marker. Failed or empty captures leave a failure/empty marker and processing continues.

## Refresh

```bash
bun autoshow links --refresh --provider openai models
bun autoshow links --refresh --provider openai models --output-dir output/<earlier-run>
```

Without `--output-dir`, refresh reuses `docs/links/<selection>-links/`; `--output-root` does not change that location. The default selection uses `all-all-links/`.

Refresh fetches the selection again, rewrites the bundle, and writes a `.refresh.json` sidecar. Each URL is `new`, `unchanged`, `changed`, or `failed`; failures preserve earlier successful comparison metadata. Comparison ignores line order and ISO timestamps. Token counts are local estimates.

When the previous bundle and sidecar exist, `.changes.md` records changed-line diffs and added/removed links, including an empty comparison when nothing changed. Long diffs are truncated.

Whole-provider refreshes also fetch model-registry pricing/catalog pages, excluding `api.` hosts. Section-scoped, URL, and file selections fetch only requested pages. Refresh never updates registry check dates or creates resumable pipeline state.

### Findings

Warnings also appear in the sidecar and do not change exit status, even for failed fetches:

- `http-error`, `fetch-failed`, `empty`: unsuccessful or empty capture.
- `login-redirect`, `redirect`, `duplicate-target`: unexpected destination; scheme, trailing-slash, and leading-`www.` changes are ignored.
- `duplicate-content`: a body matches an earlier capture.
- `shrunk`: token count is at most 60% of the previous successful capture.
- `conversion-loss`: identifiers remain on the page but disappeared during conversion.
- `model-undocumented`: a configured model appears on no fetched page of its documentation site; whole-provider checks only, with registered exemptions.

A successful exit means collection completed; review findings before treating the bundle as complete evidence.

## Flags

Use `--provider` for repeatable scoped selection and `--refresh` for comparison metadata. Shared output and logging flags appear in `links --help` and the [usage guide](usage.md).
