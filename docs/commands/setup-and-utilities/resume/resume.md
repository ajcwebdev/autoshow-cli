# resume

Backfill missing provider outputs in an existing run, child batch, or parent `extract` batch directory.

## Usage

```bash
bun autoshow resume <outputDirs...> [flags]
```

`resume` does not accept a new source input. It works against one or more existing output directories, each containing the one canonical file:

- `manifest.json` with `scope: "single"` or `scope: "batch"`; route-aware extract parents use ordinary item child links in this same shape

## Target Resolution

- `resume` supports `extract`, write LLM, TTS, image, video, and music manifests.
- With no provider flags, it reads each canonical item’s `providers` entries and reruns only entries whose status is `missing` or `failed`. Write LLM resume requires explicit provider selection by policy.
- Explicit provider flags are additive: selected provider/models are appended to the set derived from canonical provider entries and skipped if they already succeeded.
- When multiple directories are provided, `resume` processes them sequentially with the same flags, continues after per-directory failures, and reports any failures together at the end.
- Parent `extract` batch resumes follow containment-checked `{ route, index, manifestDir }` child links and route selections to the linked `media`, `document`, `article`, or `x-space` canonical child manifest.
- TTS/image/video/music resumes require a canonical item with an input and provider entries.
- Write resumes require a canonical single-run manifest with `command: "write"`, `prompt.md`, and item `metadata.step3`.
- `--price` resolves the same missing or additive providers and prints a dry-run cost estimate without calling providers or writing manifests/artifacts.

## Provider Selection

Use the target-aware generic selector:

| Flag | Description |
|------|-------------|
| `--provider provider[=model]` | Add one provider/model for the resolved command or extract route |
| `--all-providers` | Add every supported provider/model for the resolved command or extract route |
| `--all-local` | Add every local engine/backend for the resolved command or extract route; supported for `extract`, write LLM, and TTS targets, and rejected for image, video, and music targets |

`--provider` is repeatable. For `extract` resumes, the target route decides whether a provider name maps to STT, OCR, or URL article extraction.

For OCR resumes, automatic mode derives blocked providers from canonical provider `error` data (non-retryable failures such as quota, billing, account suspension, content policy, or auth). When only blocked providers remain, `resume` reports "only blocked OCR providers remain" instead of rerunning them. Explicit `--provider provider=model` opts back into a blocked provider after the underlying cause is fixed or the provider/model/policy context intentionally changes.

Examples of provider names:

| Target | Provider names |
|--------|----------------|
| STT extract | `whisper`, `whisperfile`, `reverb`, `deepinfra`, `deepgram`, `soniox`, `speechmatics`, `rev`, `groq`, `grok`, `mistral`, `assemblyai`, `gladia`, `happyscribe`, `supadata`, `scrapecreators`, `gemini`, `together` |
| OCR extract | `tesseract`, `mistral`, `glm`, `kimi`, `openai`, `grok`, `anthropic`, `gemini`, `deepinfra` |
| URL extract | `defuddle`, `firecrawl`, `glm-reader`, `spider`, `supadata`, `zyte` |
| Write LLM | `llama`, `llamafile`, `openai`, `groq`, `gemini`, `anthropic`, `minimax`, `grok`, `glm`, `kimi`, `together`, `cerebras` |
| TTS | `kitten`, `elevenlabs`, `minimax`, `groq`, `grok`, `mistral`, `openai`, `gemini`, `deepgram`, `speechify`, `hume`, `cartesia` |
| Image | `gemini`, `openai`, `grok`, `bfl`, `recraft`, `replicate`, `lumalabs`, `fal` |
| Video | `gemini`, `minimax`, `glm`, `grok`, `runway`, `ltx`, `replicate`, `lumalabs`, `fal` |
| Music | `elevenlabs`, `minimax`, `gemini` |

## Examples

```bash
# Resume a single run directory in place
bun autoshow resume ./output/2026-04-22_12-00-00-000_item

# Resume a batch directory or extract parent batch in place
bun autoshow resume ./output/2026-04-22_12-00-00-000_batch

# Resume multiple explicit output directories sequentially with the current Gemini Flash-Lite target
bun autoshow resume ./output/run-a ./output/run-b ./output/run-c --provider gemini=gemini-3.5-flash-lite

# Estimate missing or additive providers without changing output directories
bun autoshow resume ./output/run-a ./output/run-b --provider deepinfra --price

# Resume shell-expanded output directory globs
bun autoshow resume ./output/2026-04-22_*_run --all-providers

# Add every local provider for the resolved target
bun autoshow resume ./output/2026-04-22_12-00-00-000_run --all-local

# Append write LLM providers to an existing write run
bun autoshow resume ./docs/benchmarks/write/2026-06-10_16-33-20-777_1-audio \
  --provider together=kimi-k2.6 \
  --provider together=glm-5.1 \
  --provider cerebras=gpt-oss-120b \
  --provider cerebras=zai-glm-4.7

# Retry or append route-aware extract providers
bun autoshow resume ./output/2026-04-22_12-00-00-000_batch --provider glm=glm-ocr
bun autoshow resume ./output/2026-04-22_12-00-00-000_batch --provider kimi=kimi-k2.6
bun autoshow resume ./output/2026-04-22_12-00-00-000_batch --provider deepgram=nova-3
bun autoshow resume ./output/2026-04-22_12-00-00-000_batch --provider deepinfra
bun autoshow resume ./output/2026-04-22_12-00-00-000_batch --provider happyscribe=auto
bun autoshow resume ./output/2026-04-22_12-00-00-000_batch --url-provider supadata

# Retry or append TTS providers
bun autoshow resume ./output/2026-04-22_12-00-00-000_run --provider elevenlabs=eleven_v3
bun autoshow resume ./output/2026-04-22_12-00-00-000_run --provider hume=octave-2 --tts-voice "Male English Actor"
bun autoshow resume ./output/2026-04-22_12-00-00-000_run --provider cartesia=sonic-3.5-2026-05-04 --tts-voice f786b574-daa5-4673-aa0c-cbe3e8534c02

# Retry or append image, video, and music providers
bun autoshow resume ./output/2026-04-22_12-00-00-000_run --provider gemini=gemini-3.1-flash-lite-image
bun autoshow resume ./output/2026-04-22_12-00-00-000_run --provider runway=gen4.5
bun autoshow resume ./output/2026-04-22_12-00-00-000_run --provider ltx=ltx-2-3-fast
bun autoshow resume ./output/2026-04-22_12-00-00-000_run --provider minimax=music-3.0
bun autoshow resume ./output/2026-04-22_12-00-00-000_run --provider gemini=lyria-3-clip-preview

# Add every supported provider for the resolved target
bun autoshow resume ./output/2026-04-22_12-00-00-000_run --all-providers
```

## Shared Flags

| Flag | Description |
|------|-------------|
| `--prompt <name...>` | Named prompt presets discovered under `src/prompts/entries/` |
| `--prompt-md` | Save a second prompt file with Markdown examples when a resumed path rebuilds prompt output |
| `--price` | Estimate the providers resume would run and exit without provider calls or writes |
| `--batch-concurrency <n>` | Number of batch items to process concurrently |
| `--provider-concurrency <n>` | Max hosted providers/models running in parallel for one item |
| `--local-concurrency <n>` | Max local providers/models running in parallel for one item |
| `--concurrency-mode <ramp\|immediate>` | Start each hosted provider/account lane at one request and add one slot every five seconds while demand is queued (`ramp`, default), or start at its configured cap (`immediate`) |
| `--stt-segment-concurrency <n>` | Max split STT segments in flight per provider |
| `--stt-preflight-concurrency <n>` | Max STT duration probes running in parallel during preflight |

Resume preserves accepted artifacts and other canonical work state, but it creates a fresh run-scoped hosted coordinator. The new process therefore starts a fresh ramp using the current explicit or configured mode; concurrency policy is not part of cache or content identity.

## Write Options

Write resumes reuse the stored `prompt.md` and run only selected LLM providers that do not already have matching `step3` metadata. They preserve short model selectors in metadata, so `--provider together=kimi-k2.6` records `llmService: "together"` and `llmModel: "kimi-k2.6"`, while `--provider cerebras=gpt-oss-120b` records `llmService: "cerebras"` and `llmModel: "gpt-oss-120b"`. If a provider call fails, resume records any successful providers and exits incomplete for the missing targets.

| Flag | Description |
|------|-------------|
| `--prompt <name...>` | Override the structured schema used to validate new LLM outputs. If omitted, resume uses the `structuredPresetNames` from existing `step3` metadata. |

## Extract Options

| Flag | Description |
|------|-------------|
| `--youtube-captions` | Prefer English YouTube captions before STT when available |
| `--speaker-count <n>` | Diarization speaker-count hint |
| `--split` | Split audio into 30-minute segments before transcription |
| `--format <format>` | OCR output format: `text`, `json`, `tsv`, or `hocr` |
| `--password <value>` | Password for encrypted PDFs |
| `--ocr-language <codes>` | Tesseract language codes such as `eng` or `eng+fra` |
| `--ocr-dpi <n>` | Render DPI for OCR pages |
| `--ocr-concurrency <n>` | Page-level OCR concurrency cap; local OCR defaults to `10`, hosted OCR defaults to auto, and explicit values are hosted hard caps |
| `--ocr-provider-mode <fanout|pool>` | Optional stored-mode assertion for OCR resume; omission preserves the mode in `manifest.json`, and a mismatch is rejected |
| `--reasoning-effort <policy>` | Reasoning effort policy: `low`, `medium`, `high`, `minimal`, or `extended` (default delegates to the provider) |
| `--chapters`, `--no-chapters` | Write or suppress EPUB/PDF chapter files when rebuilding extraction artifacts |
| `--length <thousands>` | Hard export limit in thousands of characters for EPUB/PDF chunking |
| `--pdf-chapter-mode <mode>` | PDF chapter detection mode: `local`, `auto`, or `llm` |
| `--url-provider <backend>` | Article/HTML backend: `defuddle`, `firecrawl`, `glm-reader`, `spider`, `supadata`, or `zyte` |
| `--url-provider-concurrency <n>` | Max hosted URL providers running in parallel for one item |
| `--url-request-timeout-ms <ms>` | Per-provider URL request timeout |
| `--url-request-attempts <n>` | Per-provider URL retry attempts |
| `--epub-bun` | Inspect EPUB structure with the Bun parser |

## TTS Options

Resume accepts only provider-neutral TTS options. Provider-named tuning flags such as `--elevenlabs-tts-stability`, `--minimax-tts-emotion`, `--deepgram-tts-container`, `--speechify-tts-voice-gender`, `--hume-tts-voice-provider`, and `--minimax-tts-pitch` are not part of the resume surface.

| Flag | Description |
|------|-------------|
| `--tts-voice <provider=value|value>` | Generic TTS voice selector |
| `--tts-speed <provider=value|value>` | Generic TTS speed |
| `--tts-language <provider=value|value>` | Generic TTS language |
| `--tts-ref-audio <provider=path|path>` | Explicit authorized one-off reference input where the synthesis adapter supports it |
| `--tts-voice-name`, `--tts-consent-name`, `--tts-consent-email` | Retired creation inputs; rejected with guidance to run voice management separately |
| `--tts-text-normalization <provider=value|value>` | Generic text normalization |
| `--tts-instructions <provider=value|value>` | Generic voice/style instructions |
| `--tts-output-format <provider=value|value>` | Generic output format |
| `--tts-chunk-concurrency <n>` | Hosted TTS chunk starts allowed in parallel per provider across the current run; default `30`, or `50` for Grok-only hosted TTS |
| `--tts-dialogue-format <screenplay\|labeled>` | Dialogue input format for multi-speaker TTS |
| `--tts-speaker <SPEAKER=VOICE\|path>` | Multi-speaker TTS voice mapping; repeatable |

Use `--tts-speaker SPEAKER=VOICE` for multi-speaker resumes instead of provider-specific speaker flags. To change provider tuning on a resumed run, set it under `defaults` in `autoshow.config` or rerun the original `tts` command.

Resume never creates, imports, saves, verifies, approves, reconciles, or deletes provider voices. Complete those operations through `bun autoshow voice ...` before starting or resuming synthesis.

## Image, Video, And Music Options

Resume keeps the pipeline/config option names for media generation options, because one flag set serves image, video, music, and OCR at once and the short `image`/`video`/`music` command names would collide. Provider-named options such as `--replicate-video-seed` and `--grok-video-storage-filename` are not part of the resume surface.

| Target | Option flags |
|--------|--------------|
| Image | `--image-aspect-ratio`, `--image-size`, `--image-quality`, `--image-format`, `--image-background`, `--image-count`, `--image-input`, `--image-mask`, `--image-response-mode`, `--image-search-grounding`, `--image-compression` |
| Video | `--video-mode`, `--video-duration`, `--video-size`, `--video-aspect-ratio`, `--video-resolution`, `--video-input-image`, `--video-last-frame`, `--video-reference-image`, `--video-input-video` |
| Music | `--music-duration`, `--music-lyrics-file`, `--music-instrumental` |

## Notes

- `resume` updates the existing output directory in place.
- `resume --price` leaves `manifest.json`, raw provider artifacts, and generated media/text files unchanged.
- Write LLM resume is additive and writes service-qualified files when needed to avoid overwriting existing short-model outputs, such as `text-together-glm-5.1.json` beside an existing `text-glm-5.1.json`.
- No `resume` flag is named after a provider. Provider-named option flags such as `--elevenlabs-tts-stability`, `--replicate-video-seed`, `--grok-video-storage-filename`, and `--stt-happyscribe-organization-id` exit with their exact typed spelling, for example `Unexpected flag: --elevenlabs-tts-stability`. A provider entry's `options` object is the only persisted option slot; when a domain cannot reconstruct a tuning value from canonical state, its option slice resolves that value from `autoshow.config` or the provider default.
- `resume` exits with code `2` when items are still incomplete or failed after the backfill attempt.
