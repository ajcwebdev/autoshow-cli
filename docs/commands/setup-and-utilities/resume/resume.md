# resume

Backfill missing provider outputs in an existing run or batch directory.

## Usage

```bash
bun autoshow resume <outputDirs...> [flags]
```

`resume` does not accept a new source input. Point it at one or more existing output directories that contain `manifest.json`.

## Behavior

- Supported targets: `extract` (STT, OCR, URL article), write LLM, TTS, image, video, and music.
- With no provider flags, `resume` retries providers that are still missing or failed. Write LLM resume requires explicit `--provider` or `--all-providers`.
- Provider flags are additive: selected provider/models are added to the retry set, and already-successful providers are skipped.
- Successful outputs are kept if some providers fail.
- Multiple directories are processed sequentially with the same flags. Per-directory failures do not stop later directories; all failures are reported at the end.
- Parent `extract` batch directories resume their linked media, document, or article children. X Space runs are not resumable.
- `--price` estimates the same missing or additive work without calling providers or writing files.
- `resume` updates the existing output directory in place.
- `resume` exits with code `2` when items are still incomplete or failed after the backfill attempt.

## Provider Selection

| Flag                          | Description                                                                                              |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| `--provider provider[=model]` | Add one provider/model for this directory's command or extract route                                     |
| `--all-providers`             | Add every supported provider/model for this directory's command or extract route                         |
| `--all-local`                 | Add every local extract engine; rejected for write LLM, TTS, image, video, and music                     |

`--provider` is repeatable. On extract directories, the same flag selects STT, OCR, or URL backends based on the original run. Provider names match the original command; `bun autoshow resume --help` lists the current names.

See [`extract`](../../process-steps/step-2-extract/01-extract.md), [`write`](../../process-steps/step-3-write/write-text.md), [`tts`](../../process-steps/step-4-tts/text-to-speech-and-voice.md), [`image`](../../process-steps/step-5-image/text-to-image.md), [`video`](../../process-steps/step-6-video/text-to-video-services.md), and [`music`](../../process-steps/step-7-music/text-to-music-services.md) for catalogs and option meanings.

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
  --provider cerebras=gpt-oss-120b

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

| Flag                                   | Description                                                                              |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| `--price`                              | Estimate the providers resume would run and exit without provider calls or writes        |
| `--batch-concurrency <n>`              | Number of batch items to process concurrently                                            |
| `--provider-concurrency <n>`           | Max hosted providers/models running in parallel for one item                             |
| `--local-concurrency <n>`              | Max local providers/models running in parallel for one item                              |
| `--concurrency-mode <ramp\|immediate>` | Ramp hosted concurrency from one request (`ramp`, default) or start at the configured cap (`immediate`) |

## Write Options

Write resumes reuse the stored `prompt.md` and run only the selected LLM providers that do not already have matching output. When a new provider would collide with an existing short-model filename, resume writes a provider-prefixed file instead, such as `text-together-glm-5.1.json` beside `text-glm-5.1.json`.

| Flag                 | Description                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| `--prompt <name...>` | Override the prompt used to validate new LLM outputs. If omitted, resume uses the original run's prompt. |
| `--prompt-md`        | Save a second prompt file (`prompt-md.md`) with Markdown examples alongside the JSON prompt          |

## Extract Options

These flags match [`extract`](../../process-steps/step-2-extract/01-extract.md). Meanings are the same unless noted.

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

Resume accepts only provider-neutral TTS options. See [`tts`](../../process-steps/step-4-tts/text-to-speech-and-voice.md) for option meanings.

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

Image, video, and music resume use the prefixed option names (`--image-size`, `--video-duration`, `--music-duration`) rather than the short names on the standalone commands. See [`image`](../../process-steps/step-5-image/text-to-image.md), [`video`](../../process-steps/step-6-video/text-to-video-services.md), and [`music`](../../process-steps/step-7-music/text-to-music-services.md) for option meanings.

| Target | Option flags                                                                                                                                                                                                                    |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Image  | `--image-aspect-ratio`, `--image-size`, `--image-quality`, `--image-format`, `--image-background`, `--image-count`, `--image-input`, `--image-mask`, `--image-response-mode`, `--image-search-grounding`, `--image-compression` |
| Video  | `--video-mode`, `--video-duration`, `--video-aspect-ratio`, `--video-resolution`, `--video-generate-audio`, `--video-input-image`, `--video-last-frame`, `--video-reference-image`, `--video-input-video`, `--video-reference-video`, `--video-reference-audio` |
| Music  | `--music-duration`, `--music-lyrics-file`, `--music-instrumental`                                                                                                                                                               |
