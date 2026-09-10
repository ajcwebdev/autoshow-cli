# Direct URL

Supadata and ScrapeCreators use the original public source URL. The YouTube caption-first path also belongs here and is enabled with `--youtube-captions`; it is not a selectable provider.

See the [STT overview](../overview.md) for shared options, environment variables, pricing, and workflows.

## Providers

### Supadata

| Option        | Value                                                                        |
| ------------- | ---------------------------------------------------------------------------- |
| Selector      | `--provider supadata=auto`                                                   |
| Language      | `--stt-supadata-lang <code>` when a native transcript is available           |
| Input support | Public YouTube, TikTok, Instagram, X/Twitter, Facebook, or direct media URLs |

```bash
bun autoshow extract https://www.youtube.com/watch?v=MORMZXEaONk --provider supadata=auto --stt-supadata-lang en
bun autoshow extract https://www.tiktok.com/@example/video/1234567890 --provider supadata=auto
```

Supadata requires a public source URL. It tries provider-native transcripts first (`auto` mode) and generates a transcript when needed.

### ScrapeCreators

| Option        | Value                                            |
| ------------- | ------------------------------------------------ |
| Selector      | `--provider scrapecreators=youtube-transcript`   |
| Language      | `--stt-scrapecreators-lang <code>`, default `en` |
| Input support | Public `youtube.com` and `youtu.be` URLs only    |

```bash
bun autoshow extract "https://www.youtube.com/watch?v=MORMZXEaONk" --provider scrapecreators=youtube-transcript
bun autoshow extract https://youtu.be/dQw4w9WgXcQ --provider scrapecreators=youtube-transcript --stt-scrapecreators-lang es
```

Retrieves existing YouTube transcripts.

## Provider Capabilities

Marks: ✅ supported, ⚠️ partial or qualified, ❌ not exposed. Released dates are provider announcement or model-origin dates. Recency marks: current-year GA is ✅, older still-current snapshots are ⚠️, and pre-2026 engines are ❌. Rows are newest first.

Duration uses the same marks: under 2 hours is ❌, 2–4 hours is ⚠️, 5+ hours or no documented cap is ✅. File size uses ❌ under 100 MiB, ⚠️ 100 MiB to under 1 GiB, and ✅ 1 GiB or no cap.

Pricing is the AutoShow estimate rate. Cost rank orders models cheapest-first within each table (1 = cheapest) and ties share a rank. Hosted tables rank on the per-hour rate; the Direct URL table ranks on per-request retrieval cost.

Supadata and ScrapeCreators transcribe from the original public source URL.

| Provider                            | Released   | YouTube | Other page URLs                                      | Word timestamps       | Transcript cleanup                | Duration             | File size           | Pricing                                   | Cost rank |
| ----------------------------------- | ---------- | ------- | ---------------------------------------------------- | --------------------- | --------------------------------- | -------------------- | ------------------- | ----------------------------------------- | --------- |
| Supadata `auto`                     | ❌ 2024-08 | ✅ Yes  | ✅ TikTok, Instagram, X/Twitter, Facebook, media URL | ❌ Chunk offsets only | ⚠️ Native transcript or generated | ✅ No documented cap | ✅ 1 GiB remote URL | $0.01/request native; $0.02/min generated | 2/2       |
| ScrapeCreators `youtube-transcript` | ❌ 2024-06 | ✅ Yes  | ❌ YouTube only                                      | ❌ Cue times only     | ⚠️ Retrieves existing captions    | ✅ No documented cap | ✅ No upload        | $0.00188/request                          | 1/2       |

Use `--split` for long files. AutoShow also splits automatically when a provider duration or size cap would be exceeded.

## YouTube Caption Fallback

`--youtube-captions` first looks for English captions on YouTube inputs. Available captions skip the selected STT providers; otherwise extraction falls back to those providers. This flag does not add a provider selector.

```bash
bun autoshow extract "https://www.youtube.com/watch?v=MORMZXEaONk" --youtube-captions --provider deepgram=nova-3
```
