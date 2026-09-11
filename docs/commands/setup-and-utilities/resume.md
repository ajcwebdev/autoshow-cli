# resume

Backfill missing provider outputs or continue recorded comic stages in an existing run directory.

## Usage

```bash
bun autoshow resume <outputDirs...> [flags]
```

`resume` does not accept a new source input. Point it at one or more existing output directories that contain `manifest.json`.

## Behavior

- Supported targets: `extract` (STT, OCR, URL article), write LLM, TTS, image, video, music, and canonical single-scene comic runs.
- For standalone runs, `resume` retries missing or failed providers. Write LLM resume requires explicit `--provider` or `--all-providers`.
- Standalone provider flags are additive: selected provider/models are added to the retry set, and already-successful providers are skipped. Comic recovery restores recorded choices and rejects provider overrides.
- Successful outputs are kept if some providers fail.
- Multiple directories are processed sequentially with the same flags. Per-directory failures do not stop later directories; all failures are reported at the end.
- Parent `extract` batch directories resume their linked media, document, or article children. X Space runs are not resumable.
- `--price` estimates the same missing or additive work without calling providers or writing files.
- `resume` updates the existing output directory in place.
- `resume` exits with code `2` when items are still incomplete or failed after the backfill attempt.

Shared flags follow the existing manifest: `--format` controls OCR output or image encoding, `--aspect-ratio` controls image or video shape, and `--duration` controls video or music length. `bun autoshow resume --help-topic run-specific` lists those meanings together; `--help-topic concurrency` compares item, target, segment, page, and chunk limits. Comic recovery retains the recorded choices and rejects these rendering/provider overrides.

## Provider Selection

These selectors apply to standalone and extract runs. See [Comic Recovery](#comic-recovery) for comic directories.

| Flag                          | Description                                                                                              |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| `--provider provider[=model]` | Add one provider/model for this directory's command or extract route                                     |
| `--all-providers`             | Add every supported provider/model for this directory's command or extract route                         |
| `--all-local`                 | Add every local extract engine; rejected for write LLM, TTS, image, video, and music                     |

`--provider` is repeatable. On extract directories, the same flag selects STT, OCR, or URL backends based on the original run. Provider names match the original command; `bun autoshow resume --help` lists the current names.

See [`extract`](../extract.md), [`write`](../text/write/overview.md), [`tts`](../audio/tts/overview.md), [`image`](../visuals/image/overview.md), [`video`](../visuals/video/overview.md), and [`music`](../audio/music/overview.md) for catalogs and option meanings.

Automatic OCR resume skips providers that failed with a non-retryable error such as quota, billing, account suspension, content policy, or auth. If only those providers remain, it reports `only blocked OCR providers remain` instead of rerunning them. Pass `--provider provider=model` to retry a blocked provider after the cause is fixed.

Resume rejects provider-named option flags such as `--elevenlabs-tts-stability` or `--replicate-video-seed`. Set those under `defaults` in `autoshow.config`, or rerun the original command.

## Examples

```bash
# Resume a single run directory in place
bun autoshow resume ./output/2026-04-22_12-00-00-000_item

# Resume a batch directory or extract parent batch in place
bun autoshow resume ./output/2026-04-22_12-00-00-000_batch

# Resume multiple output directories sequentially
bun autoshow resume ./output/run-a ./output/run-b ./output/run-c --provider gemini=gemini-3.5-flash-lite

# Estimate missing or additive providers without changing output directories
bun autoshow resume ./output/run-a ./output/run-b --provider deepinfra --price

# Resume shell-expanded output directory globs
bun autoshow resume ./output/2026-04-22_*_run --all-providers

# Add every local provider for an extract target
bun autoshow resume ./output/2026-04-22_12-00-00-000_run --all-local

# Append write LLM providers to an existing write run
bun autoshow resume ./output/2026-06-10_16-33-20-777_write \
  --provider together=kimi-k2.6 \
  --provider glm=glm-5.1

# Retry or append extract providers
bun autoshow resume ./output/2026-04-22_12-00-00-000_batch --provider glm=glm-ocr
bun autoshow resume ./output/2026-04-22_12-00-00-000_batch --provider supadata

# Retry or append TTS, image, video, and music providers
bun autoshow resume ./output/2026-04-22_12-00-00-000_run --provider elevenlabs=eleven_v3
bun autoshow resume ./output/2026-04-22_12-00-00-000_run --provider gemini=gemini-3.1-flash-lite-image
bun autoshow resume ./output/2026-04-22_12-00-00-000_run --provider ltx=ltx-2-3-fast
bun autoshow resume ./output/2026-04-22_12-00-00-000_run --provider minimax=music-3.0
```

## Shared Flags

Comic directories accept `--price`, `--allow-ambiguous-redispatch`, and global logging and binary-path controls. Their recorded concurrency settings are restored; the other controls below apply to standalone and extract runs.

| Flag                                   | Description                                                                              |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| `--price`                              | Estimate the providers resume would run and exit without provider calls or writes        |
| `--batch-concurrency <n>`              | Number of batch items to process concurrently                                            |
| `--provider-concurrency <n>`           | Max hosted providers/models running in parallel for one item                             |
| `--local-concurrency <n>`              | Max local providers/models running in parallel for one item                              |
| `--concurrency-mode <ramp\|immediate>` | Ramp hosted concurrency from one request (`ramp`, default) or start at the configured cap (`immediate`) |

## Comic Recovery

```bash
bun autoshow resume ./output/comic-run --price
bun autoshow resume ./output/comic-run --price --json
bun autoshow resume ./output/comic-run
```

Recovery continues only requested image, audio, and presentation work, in that order. New generation requests store their resolved options and input identities in `manifest.json`. Images retain the original output run ID, panel selection, models, variations, grouping, and QA settings. Audio retains explicit provider/model targets, casting and delivery choices, and render identities. Current configuration defaults never select replacement providers. Completed compatible runs are no-ops, and unrequested stages remain unrequested.

Price planning verifies the source and retained artifacts without provider calls or writes. Each stage reports `reuse`, `resume`, `not-requested`, `blocked`, or `after-audio`. With `--json`, the normal result includes `data.comicPlans`, with a directory, `ready` boolean, and stage details for each comic run. A valid but blocked plan returns a successful inspection result with `ready: false`; its total includes only work that could be priced and is not a complete budget. Execution refuses a blocked plan. Invalid manifests or unavailable source evidence fail inspection.

`generate-audio --slideshow` saves the pending presentation request with the audio intent before synthesis. Recovery reuses completed audio slots and finishes the local slideshow after audio completes. Its timeline is checked again after audio publication. A presentation-only recovery never generates missing images, voices, or sound effects. Slideshow readiness still requires canonical `panels/panel-NN.png` inputs; image output variants are not automatically selected or promoted.

Older incomplete runs without exact recovery intent, changed inputs or casting, stale presentation dependencies, and unpriced provider work are blockers. Image estimates include modeled QA and repair costs rather than a billing cap. Forced image regeneration, audits, and revision evaluation remain explicit `comic generate-images` operations. Source preparation, reference creation, voice approvals, provider additions, and rendering changes also use their existing commands.

Comic recovery rejects provider, model, rendering, configuration-path, character-root, output-path, and concurrency overrides. Keep those invocations separate from additive standalone resumes. The existing `--allow-ambiguous-redispatch` control can authorize another attempt for an admitted TTS slot with no recoverable audio, which may purchase it again; completed slots remain reusable. Sound-effect admission blockers retain their own reconciliation rules.

See the [comic overview](../visuals/comic/00-comic-overview.md), [image generation](../visuals/comic/03-generate-images.md), [audio generation](../visuals/comic/04-generate-audio.md), and [local slideshow](../visuals/comic/05-generate-slideshow.md) for preparation and explicit stage operations.

## Write Options

Write resumes reuse the stored `prompt.md` and run only the selected LLM providers that do not already have matching output. When a new provider would collide with an existing short-model filename, resume writes a provider-prefixed file instead, such as `text-together-glm-5.1.json` beside `text-glm-5.1.json`.

| Flag                 | Description                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| `--prompt <name...>` | Override the prompt used to validate new LLM outputs. If omitted, resume uses the original run's prompt. |
| `--prompt-md`        | Save a second prompt file (`prompt-md.md`) with Markdown examples alongside the JSON prompt          |

## Extract Options

These flags match [`extract`](../extract.md). Meanings are the same unless noted.

| Flag                                | Description                                                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `--youtube-captions`                | Prefer English YouTube captions before STT when available                                                                |
| `--speaker-count <n>`               | Diarization speaker-count hint                                                                                           |
| `--split`                           | Split audio into 30-minute segments before transcription                                                                 |
| `--stt-segment-concurrency <n>`     | Max split STT segments in flight per provider                                                                            |
| `--stt-preflight-concurrency <n>`   | STT preflight concurrency                                                                                                |
| `--format <format>`                 | OCR output format: `text` or `json`                                                                                      |
| `--password <value>`                | Password for encrypted PDFs                                                                                              |
| `--ocr-language <codes>`            | Tesseract language codes such as `eng` or `eng+fra`                                                                      |
| `--ocr-dpi <n>`                     | Render DPI for OCR pages                                                                                                 |
| `--ocr-concurrency <n>`             | Page-level OCR concurrency cap                                                                                           |
| `--ocr-provider-mode <fanout|pool>` | Require this OCR execution mode. If omitted, resume keeps the mode from the original run. A different value is rejected. |
| `--reasoning-effort <policy>`       | Reasoning effort policy: `default`, `disabled`, `minimal`, `low`, `medium`, `high`, or `max`                             |
| `--chapters`, `--no-chapters`       | Write or suppress EPUB/PDF chapter files when rebuilding extraction artifacts                                            |
| `--length <thousands>`              | Hard export limit in thousands of characters for EPUB/PDF chunking                                                       |
| `--pdf-chapter-mode <mode>`         | PDF chapter detection mode: `local`, `auto`, or `llm`                                                                    |
| `--provider <backend>`              | Article/HTML backend: `defuddle`, `firecrawl`, `glm-reader`, `spider`, `supadata`, or `zyte`                             |

## TTS Options

Resume accepts only provider-neutral TTS options. See [`tts`](../audio/tts/overview.md) for option meanings.

| Flag                                              | Description                                                          |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| `--allow-ambiguous-redispatch`                    | Resume a stored TTS generation that has no recoverable audio; may repurchase it |
| `--tts-voice <provider=value|value>`              | Generic TTS voice selector                                           |
| `--tts-speed <provider=value|value>`              | Generic TTS speed                                                    |
| `--tts-language <provider=value|value>`           | Generic TTS language                                                 |
| `--tts-text-normalization <provider=value|value>` | Generic text normalization                                           |
| `--tts-instructions <provider=value|value>`       | Generic voice/style instructions                                     |
| `--tts-chunk-concurrency <n>`                     | Hosted TTS chunk concurrency per provider                            |
| `--tts-dialogue-format <screenplay\|labeled>`     | Dialogue input format for multi-speaker TTS                          |
| `--tts-speaker <SPEAKER=VOICE\|path>`             | Multi-speaker TTS voice mapping; repeatable                          |

## Image, Video, And Music Options

Image, video, and music resume use the same short option names as the standalone commands. The stored target determines which domain owns shared names such as `--duration` and `--aspect-ratio`. See [`image`](../visuals/image/overview.md), [`video`](../visuals/video/overview.md), and [`music`](../audio/music/overview.md) for option meanings.

| Target | Option flags                                                                                                                                                                                                                    |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Image  | `--aspect-ratio`, `--size`, `--quality`, `--format`, `--background`, `--count`, `--input`, `--mask`, `--response-mode`, `--search-grounding`, `--compression` |
| Video  | `--mode`, `--duration`, `--aspect-ratio`, `--resolution`, `--generate-audio`, `--input-image`, `--last-frame`, `--reference-image`, `--input-video`, `--reference-video`, `--reference-audio` |
| Music  | `--duration`, `--lyrics-file`, `--instrumental` |
