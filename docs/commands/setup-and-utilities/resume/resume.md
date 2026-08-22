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
- Multiple directories are processed sequentially with the same flags. Per-directory failures do not stop later directories; all failures are reported at the end.
- Parent `extract` batch directories resume their linked media, document, or article children. X Space runs are not resumable.
- `--price` estimates the same missing or additive work without calling providers or writing files.

## Provider Selection

Use the target-aware generic selector:

| Flag                          | Description                                                                                                                                                     |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--provider provider[=model]` | Add one provider/model for the resolved command or extract route                                                                                                |
| `--all-providers`             | Add every supported provider/model for the resolved command or extract route                                                                                    |
| `--all-local`                 | Add every local engine/backend for the resolved extract route; supported for `extract` targets and rejected for write LLM, TTS, image, video, and music targets |

`--provider` is repeatable. For `extract` resumes, the target route decides whether a provider name maps to STT, OCR, or URL article extraction.

Automatic OCR resume skips providers that failed with a non-retryable error such as quota, billing, account suspension, content policy, or auth. If only those providers remain, it reports `only blocked OCR providers remain` instead of rerunning them. Pass `--provider provider=model` to retry a blocked provider after the cause is fixed.

Examples of provider names:

| Target      | Provider names                                                                                                                                                                                           |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| STT extract | `whisper`, `whisperfile`, `deepinfra`, `deepgram`, `soniox`, `speechmatics`, `rev`, `groq`, `grok`, `mistral`, `assemblyai`, `gladia`, `happyscribe`, `supadata`, `scrapecreators`, `gemini`, `together` |
| OCR extract | `tesseract`, `mistral`, `glm`, `kimi`, `openai`, `grok`, `anthropic`, `gemini`, `deepinfra`, `replicate`, `fal`                                                                                          |
| URL extract | `defuddle`, `firecrawl`, `glm-reader`, `spider`, `supadata`, `zyte`                                                                                                                                      |
| Write LLM   | `openai`, `groq`, `gemini`, `anthropic`, `minimax`, `grok`, `glm`, `kimi`, `together`, `cerebras`                                                                                                        |
| TTS         | `elevenlabs`, `minimax`, `groq`, `grok`, `mistral`, `openai`, `gemini`, `deepgram`, `speechify`, `hume`, `cartesia`, `fish`, `inworld`, `deepinfra`, `replicate`, `fal`                                  |
| Image       | `gemini`, `openai`, `grok`, `bfl`, `replicate`, `lumalabs`, `fal`                                                                                                                                        |
| Video       | `gemini`, `grok`, `ltx`, `replicate`, `lumalabs`, `fal`                                                                                                                                                   |
| Music       | `elevenlabs`, `minimax`, `gemini`                                                                                                                                                                        |

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
bun autoshow resume ./output/2026-04-22_12-00-00-000_batch --provider deepinfra
bun autoshow resume ./output/2026-04-22_12-00-00-000_batch --url-provider supadata

# Retry or append TTS, image, video, and music providers
bun autoshow resume ./output/2026-04-22_12-00-00-000_run --provider elevenlabs=eleven_v3
bun autoshow resume ./output/2026-04-22_12-00-00-000_run --provider hume=octave-2 --tts-voice "Male English Actor"
bun autoshow resume ./output/2026-04-22_12-00-00-000_run --provider gemini=gemini-3.1-flash-lite-image
bun autoshow resume ./output/2026-04-22_12-00-00-000_run --provider ltx=ltx-2-3-fast
bun autoshow resume ./output/2026-04-22_12-00-00-000_run --provider minimax=music-3.0
```

## Shared Flags

| Flag                                   | Description                                                                                                                                                                       |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--price`                              | Estimate the providers resume would run and exit without provider calls or writes                                                                                                 |
| `--batch-concurrency <n>`              | Number of batch items to process concurrently                                                                                                                                     |
| `--provider-concurrency <n>`           | Max hosted providers/models running in parallel for one item                                                                                                                      |
| `--local-concurrency <n>`              | Max local providers/models running in parallel for one item                                                                                                                       |
| `--concurrency-mode <ramp\|immediate>` | Start each hosted provider/account lane at one request and add one slot every five seconds while demand is queued (`ramp`, default), or start at its configured cap (`immediate`) |

Resume keeps completed artifacts. Hosted concurrency always starts a new ramp from the current `--concurrency-mode` or configured default.

## Write Options

Write resumes reuse the stored `prompt.md` and run only the selected LLM providers that do not already have matching output. If a provider fails, successful outputs are kept and the command exits incomplete for the missing targets.

| Flag                 | Description                                                                                                           |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `--prompt <name...>` | Override the structured schema used to validate new LLM outputs. If omitted, resume uses the schema from the original run. |
| `--prompt-md`        | Save a second prompt file (`prompt-md.md`) with Markdown examples alongside the JSON prompt                           |

## Extract Options

| Flag                                | Description                                                                                                                       |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `--youtube-captions`                | Prefer English YouTube captions before STT when available                                                                         |
| `--speaker-count <n>`               | Diarization speaker-count hint                                                                                                    |
| `--split`                           | Split audio into 30-minute segments before transcription                                                                          |
| `--stt-segment-concurrency <n>`     | Max split STT segments in flight per provider                                                                                     |
| `--stt-preflight-concurrency <n>`   | Max STT duration probes running in parallel during preflight                                                                      |
| `--format <format>`                 | OCR output format: `text` or `json`                                                                                               |
| `--password <value>`                | Password for encrypted PDFs                                                                                                       |
| `--ocr-language <codes>`            | Tesseract language codes such as `eng` or `eng+fra`                                                                               |
| `--ocr-dpi <n>`                     | Render DPI for OCR pages                                                                                                          |
| `--ocr-concurrency <n>`             | Page-level OCR concurrency cap; local OCR defaults to `10`, hosted OCR defaults to auto, and explicit values are hosted hard caps |
| `--ocr-provider-mode <fanout|pool>` | Require this OCR execution mode. If omitted, resume keeps the mode from the original run. A different value is rejected.          |
| `--reasoning-effort <policy>`       | Reasoning effort policy: `default`, `disabled`, `minimal`, `low`, `medium`, `high`, or `max` (default delegates to the provider)  |
| `--chapters`, `--no-chapters`       | Write or suppress EPUB/PDF chapter files when rebuilding extraction artifacts                                                     |
| `--length <thousands>`              | Hard export limit in thousands of characters for EPUB/PDF chunking                                                                |
| `--pdf-chapter-mode <mode>`         | PDF chapter detection mode: `local`, `auto`, or `llm`                                                                             |
| `--url-provider <backend>`          | Article/HTML backend: `defuddle`, `firecrawl`, `glm-reader`, `spider`, `supadata`, or `zyte`                                      |
| `--url-provider-concurrency <n>`    | Max hosted URL providers running in parallel for one item                                                                         |
| `--url-request-timeout-ms <ms>`     | Per-provider URL request timeout                                                                                                  |
| `--url-request-attempts <n>`        | Per-provider URL retry attempts                                                                                                   |

## TTS Options

Resume accepts only provider-neutral TTS options. Provider-named tuning flags such as `--elevenlabs-tts-stability` are rejected.

| Flag                                              | Description                                                                                                                     |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `--allow-ambiguous-redispatch`                    | Authorize repurchasing a provider-admitted TTS slot that has no recoverable audio                                               |
| `--tts-voice <provider=value|value>`              | Generic TTS voice selector                                                                                                      |
| `--tts-speed <provider=value|value>`              | Generic TTS speed                                                                                                               |
| `--tts-language <provider=value|value>`           | Generic TTS language                                                                                                            |
| `--tts-text-normalization <provider=value|value>` | Generic text normalization                                                                                                      |
| `--tts-instructions <provider=value|value>`       | Generic voice/style instructions                                                                                                |
| `--tts-chunk-concurrency <n>`                     | Hosted TTS chunk starts allowed in parallel per provider across the current run; default `30`, or `50` for Grok-only hosted TTS |
| `--tts-dialogue-format <screenplay\|labeled>`     | Dialogue input format for multi-speaker TTS                                                                                     |
| `--tts-speaker <SPEAKER=VOICE\|path>`             | Multi-speaker TTS voice mapping; repeatable                                                                                     |

Use `--tts-speaker SPEAKER=VOICE` for multi-speaker resumes. To change provider-specific tuning, set it under `defaults` in `autoshow.config` or rerun the original `tts` command.

Voice create, import, approve, and delete operations belong to `bun autoshow voice`, not `resume`.

## Image, Video, And Music Options

Image, video, and music resume use the prefixed option names (`--image-size`, `--video-duration`, `--music-duration`) rather than the short names on the standalone commands. Provider-named options such as `--replicate-video-seed` are rejected.

| Target | Option flags                                                                                                                                                                                                                    |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Image  | `--image-aspect-ratio`, `--image-size`, `--image-quality`, `--image-format`, `--image-background`, `--image-count`, `--image-input`, `--image-mask`, `--image-response-mode`, `--image-search-grounding`, `--image-compression` |
| Video  | `--video-mode`, `--video-duration`, `--video-aspect-ratio`, `--video-resolution`, `--video-generate-audio`, `--video-input-image`, `--video-last-frame`, `--video-reference-image`, `--video-input-video`, `--video-reference-video`, `--video-reference-audio` |
| Music  | `--music-duration`, `--music-lyrics-file`, `--music-instrumental`                                                                                                                                                               |

## Notes

- `resume` updates the existing output directory in place.
- `resume --price` does not write manifests or artifacts.
- Write LLM resume is additive. When a new provider would collide with an existing short-model filename, it writes a service-qualified file instead, such as `text-together-glm-5.1.json` beside `text-glm-5.1.json`.
- Provider-named option flags such as `--elevenlabs-tts-stability` or `--replicate-video-seed` are rejected as `Unexpected flag: <name>`. Set those knobs under `defaults` in `autoshow.config`, or rerun the original command.
- `resume` exits with code `2` when items are still incomplete or failed after the backfill attempt.
