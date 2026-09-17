# resume

Backfill missing provider outputs or continue recorded comic stages in an existing run directory.

## Usage

```bash
bun autoshow resume <outputDirs...> [flags]
```

`resume` does not accept a new source input. Point it at one or more existing output directories that contain `manifest.json`.

## Behavior

- Supported targets: `extract` (STT, OCR, URL article), write LLM, TTS, image, video, music, and comic scene runs.
- For standalone runs, `resume` retries missing or failed providers and adds any `--provider` / `--all-providers` / `--all-local` selections. Already-successful providers are skipped. Write LLM resume requires explicit `--provider` or `--all-providers`.
- Successful outputs are kept if some providers fail.
- Multiple directories are processed sequentially with the same flags. Per-directory failures do not stop later directories; all failures are reported at the end.
- Parent `extract` batch directories resume their media, document, or article children. X Space runs are not resumable.
- `--price` estimates the same missing or additive work without calling providers or writing files.
- `resume` updates the existing output directory in place.
- `resume` exits with code `2` when items are still incomplete or failed after the backfill attempt.

`--format`, `--aspect-ratio`, and `--duration` follow the stored run: OCR output or image encoding, image or video shape, and video or music length. `bun autoshow resume --help-topic run-specific` lists those meanings together; `--help-topic concurrency` lists the concurrency caps. Comic recovery restores recorded choices and rejects these overrides; see [Comic Recovery](#comic-recovery).

## Provider Selection

These selectors apply to standalone and extract runs. See [Comic Recovery](#comic-recovery) for comic directories.

| Flag                          | Description                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| `--provider provider[=model]` | Add one provider/model for this directory's command or extract route                 |
| `--all-providers`             | Add every hosted provider/model for this directory's command or extract route        |
| `--all-local`                 | Add every local extract engine; rejected for write LLM, TTS, image, video, and music |

`--provider` is repeatable. On extract directories, the same flag selects STT, OCR, or URL backends based on the original run. Article directories accept one `--provider` backend at a time; use `--all-providers` or `--all-local` for URL backend groups. Provider names match the original command; `bun autoshow resume --help` lists the current names.

See [`extract`](../02-extract/overview.md), [`write`](../03-write/overview.md), [`tts`](../04-audio/tts/overview.md), [`image`](../05-visuals/image/overview.md), [`video`](../05-visuals/video/overview.md), and [`music`](../04-audio/music/overview.md) for catalogs and option meanings.

Automatic OCR resume skips providers that failed with a non-retryable error such as quota, billing, account suspension, content policy, or auth. If only those providers remain, it reports `only blocked OCR providers remain` instead of rerunning them. Pass `--provider provider=model` to retry a blocked provider after the cause is fixed.

Resume rejects retired provider-named option flags such as `--elevenlabs-tts-stability` or `--replicate-video-seed`. Use the provider-general spellings (`--tts-stability elevenlabs=0.4`), set the value under `defaults` in `config/autoshow.json`, or rerun the original command.

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
  --provider together=kimi-k3 \
  --provider glm=glm-5.3-flash

# Retry or append extract, TTS, image, video, or music providers
bun autoshow resume ./output/2026-04-22_12-00-00-000_batch --provider glm=glm-5.3-flash
bun autoshow resume ./output/2026-04-22_12-00-00-000_run --provider elevenlabs=eleven_v3
```

## Shared Flags

Comic directories accept `--price`, `--allow-ambiguous-redispatch`, and global logging flags. Their recorded concurrency settings are restored. The controls below apply to standalone and extract runs.

| Flag                                   | Description                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `--price`                              | Estimate the providers resume would run and exit without provider calls or writes                       |
| `--batch-concurrency <n>`              | Number of batch items to process concurrently                                                           |
| `--provider-concurrency <n>`           | Max hosted providers/models running in parallel for one item                                            |
| `--local-concurrency <n>`              | Max local providers/models running in parallel for one item                                             |
| `--concurrency-mode <ramp\|immediate>` | Ramp hosted concurrency from one request (`ramp`, default) or start at the configured cap (`immediate`) |

## Comic Recovery

```bash
bun autoshow resume ./output/comic-run --price
bun autoshow resume ./output/comic-run --price --json
bun autoshow resume ./output/comic-run
```

Recovery continues requested image, audio, and presentation work, in that order, using the choices recorded in the original run. Current configuration defaults never select replacement providers. Completed compatible runs are no-ops, and unrequested stages remain unrequested.

`--price` inspects the run without provider calls or writes. Each stage is marked `reuse`, `resume`, `not-requested`, `blocked`, or `after-audio`. With `--json`, check `comicPlans` and `ready` before running the same directory. A blocked plan can be inspected (`ready: false`), but its total covers only work that could be priced. Execution refuses a blocked plan. Invalid manifests or missing source files fail inspection.

`generate-audio --slideshow` records the slideshow request with the audio request. Recovery reuses completed audio and then finishes the local slideshow. A presentation-only recovery never generates missing images, voices, or sound effects. Slideshow readiness still requires `panels/panel-NN.png` files; image variants are not selected or promoted automatically.

Recovery blocks when the original request is missing, inputs or casting changed, presentation dependencies are stale, or remaining provider work cannot be priced. Forced image regeneration, audits, and revision evaluation remain `comic generate-images` operations. Source preparation, references, voice approvals, provider additions, and rendering changes use their existing commands.

Comic recovery rejects provider, model, rendering, configuration, character catalog, output path, and concurrency overrides. `--allow-ambiguous-redispatch` can retry an admitted TTS slot that has no recoverable audio, which may purchase it again; completed slots remain reusable. It does not authorize blocked sound-effect work.

See the [comic overview](../05-visuals/comic/00-comic-overview.md), [image generation](../05-visuals/comic/03-generate-images.md), [audio generation](../05-visuals/comic/04-generate-audio.md), and [local slideshow](../05-visuals/comic/05-generate-slideshow.md) for preparation and explicit stage operations.

## Write Options

Write resumes reuse the stored `prompt.md` and run only the selected LLM providers that do not already have matching output. When a new provider would collide with an existing short-model filename, resume writes a provider-prefixed file instead, such as `text-together-glm-5.3-flash.json` beside `text-glm-5.3-flash.json`.

| Flag                 | Description                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| `--prompt <name...>` | Override the prompt used to validate new LLM outputs. If omitted, resume uses the original run's prompt. |
| `--prompt-md`        | Save a second prompt file (`prompt-md.md`) with Markdown examples alongside the JSON prompt              |

## Extract, TTS, Image, Video, And Music Options

These flags match the original commands. Meanings are the same unless noted. See [`extract`](../02-extract/overview.md), [`tts`](../04-audio/tts/overview.md), [`image`](../05-visuals/image/overview.md), [`video`](../05-visuals/video/overview.md), and [`music`](../04-audio/music/overview.md).

- Extract: `--ocr-provider-mode` must match the original run. Omit it to keep the stored mode; a different value is rejected.
- TTS: resume accepts only provider-neutral options. `--allow-ambiguous-redispatch` may repurchase a stored generation that has no recoverable audio.
- Image, video, and music: the stored target owns shared names such as `--duration` and `--aspect-ratio`.
