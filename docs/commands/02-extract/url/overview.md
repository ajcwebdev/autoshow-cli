# extract URL and X

Extract article text with local Defuddle or explicit hosted backends, retrieve existing YouTube transcripts, or collect X Space metadata. Audio transcription uses [STT](../stt/overview.md); [input routing](../overview.md) selects the path.

## Local URL

Remote articles and local HTML default to `defuddle`. Local `.html`/`.htm` always use it; group runs skip hosted backends. Install Defuddle through [`setup`](../../00-setup-and-utilities/setup.md). Local HTML then needs no network or credentials; remote articles still require a fetch. A Defuddle failure never silently purchases hosted fallback.

```bash
bun autoshow extract https://ajcwebdev.com
bun autoshow extract input/examples/document/harborlight-article.html
```

## Shared URL Options

Select one backend with `--provider defuddle|spider|zyte`, or use `--all-providers` for Spider and Zyte. `--all-local` adds Defuddle; it may combine with `--all-providers`, but neither shortcut may combine with an explicit provider.

| Flag                              | Behavior                                                         |
| --------------------------------- | ---------------------------------------------------------------- |
| `--provider-concurrency N`        | Hosted backends per item; default seven                          |
| `--url-request-timeout-ms N`      | Per-attempt timeout; default 60000 ms                            |
| `--url-request-attempts N`        | Total attempts including retries; default three                  |
| `--format text` / `--format json` | Single-backend artifact format; default `text`                   |
| `--price`                         | Estimate without extraction                                      |
| `--max-model-cents N`             | Filter each backend by its estimated total across the invocation |

```bash
bun autoshow extract https://example.com/article --provider spider --price
bun autoshow extract https://example.com/article --all-providers --provider-concurrency 2 --price
```

Set `SPIDER_API_KEY` or `ZYTE_API_KEY` for those backends. Estimates use registry reference rates, not invoices or guaranteed spending caps. Hosted ambiguous outcomes, including timeouts, do not automatically redispatch even when attempts remain.

## Public media URL transcripts

ScrapeCreators retrieves existing public YouTube captions without downloading audio. It requires `SCRAPECREATORS_API_KEY`, a `youtube.com`/`youtu.be` watch URL, and captions in the requested language. Language defaults to `en`.

```bash
YOUTUBE_URL='<your-public-youtube-watch-url>'
bun autoshow metadata "$YOUTUBE_URL"
bun autoshow extract "$YOUTUBE_URL" --provider scrapecreators=youtube-transcript --stt-language scrapecreators=en --price
```

Remove `--price` after reviewing the estimate. Metadata success and a quote establish neither caption availability nor API access. Other media URLs follow the selected STT engine.

## YouTube Caption Fallback

`--youtube-captions` first tries English YouTube captions. Available captions skip selected STT providers; otherwise those providers transcribe audio. Budget for the fallback:

```bash
bun autoshow extract "$YOUTUBE_URL" --youtube-captions --provider deepgram=nova-3 --price
```

The Deepgram fallback requires `DEEPGRAM_API_KEY`. Caption availability may change after preflight. For ajcwebdev episode publishing, follow the [required AssemblyAI workflow](../../../../AGENTS.md#episode-publishing) rather than caption substitution.

## URL Output

A single article backend writes `extraction.txt` or `result.json`, plus `manifest.json`. Provider-group runs write both extraction artifacts per successful backend under `providers/<backend>/`, retaining requested-target progress in the manifest. Recover incomplete article runs with [`resume`](../../00-setup-and-utilities/resume.md).

## X Space Path

Space URLs, post URLs, and raw Space IDs use the X API with `X_BEARER_TOKEN`; they produce metadata, not an audio transcript. Supported URL forms include `twitter.com`, mobile/www hosts, and `/i/web/status/`. A post without a linked Space can still produce a report with an empty Space section.

```bash
X_INPUT='<your-accessible-x-space-url-post-url-or-space-id>'
bun autoshow metadata "$X_INPUT"
bun autoshow extract "$X_INPUT"
```

Both commands require suitable X API access and may incur read charges. AutoShow does not estimate those charges; `--price` is not proof that X API requests are free. X Space runs are not resumable.

## X Space Output

- `result.json`: Space metadata, profiles, posts, sources, and errors.
- `extraction.md`: the readable report.
- `manifest.json`: canonical run metadata.

[URL tests](tests.md)
