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

`--format`, `--aspect-ratio`, and `--duration` follow the stored run: OCR output or image encoding, image or video shape, and video or music length. Comic recovery restores recorded choices and rejects these overrides; see [Comic Recovery](#comic-recovery).

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

Resume rejects provider-named option flags such as `--elevenlabs-tts-stability` or `--replicate-video-seed`. Use the provider-general spelling where one exists (`--tts-stability elevenlabs=0.4`), set the value under `defaults` in `config/autoshow.json`, or rerun the original command.

## Examples

```bash
bun autoshow resume ./output/2026-04-22_12-00-00-000_item

bun autoshow resume ./output/2026-04-22_12-00-00-000_batch

bun autoshow resume ./output/run-a ./output/run-b ./output/run-c --provider gemini=gemini-3.5-flash-lite

bun autoshow resume ./output/run-a ./output/run-b --provider deepinfra --price

bun autoshow resume ./output/2026-04-22_*_run --all-providers

bun autoshow resume ./output/2026-04-22_12-00-00-000_run --all-local

bun autoshow resume ./output/2026-06-10_16-33-20-777_write \
  --provider together=kimi-k3 \
  --provider glm=glm-5.3-flash
```
Comic directories accept `--price`, `--allow-ambiguous-redispatch`, `--bin-dir`, and the global logging and JSON flags (`--json`, `--quiet`, `--verbose`, `--color` / `--no-color`, `--log-level`). Recorded concurrency is restored. The controls below apply to standalone and extract runs.

| Flag                                   | Description                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `--price`                              | Estimate the providers resume would run and exit without provider calls or writes                       |
| `--batch-concurrency <n>`              | Number of batch items to process concurrently                                                           |
| `--provider-concurrency <n>`           | Max hosted providers/models running in parallel for one item                                            |
| `--local-concurrency <n>`              | Max local providers/models running in parallel for one item                                             |
| `--concurrency-mode <ramp\|immediate>` | Ramp hosted concurrency from one request (`ramp`, default) or start at the configured cap (`immediate`) |
| `--step-concurrency <scope>=N`         | Intra-step parallelism (`stt-segment`, `stt-preflight`, `ocr-page`, `tts-chunk`); repeatable            |

## Comic Recovery

```bash
bun autoshow resume ./output/comic-run --price
bun autoshow resume ./output/comic-run --price --json
bun autoshow resume ./output/comic-run
```
Recovery continues requested image, audio, and presentation work, in that order, using the choices recorded in the original run. Current configuration defaults never select replacement providers. A `--max-generation-slots` limit is not restored; resume finishes the remaining audio slots. Completed compatible runs are no-ops, and unrequested stages remain unrequested.

`--price` inspects the run without provider calls or writes. Each stage is marked `reuse`, `resume`, `not-requested`, `blocked`, or `after-audio`. With `--json`, check `comicPlans` and `ready` before running the same directory. A blocked plan can be inspected (`ready: false`), but its total covers only work that could be priced. Execution refuses a blocked plan. Invalid manifests or missing source files fail inspection.

A `generate-audio --slideshow` run reuses completed audio and then finishes the local slideshow. A presentation-only recovery never generates missing images, voices, or sound effects. Slideshow readiness still requires `panels/panel-NN.png`; resume does not choose or promote image variants.

Recovery blocks when the original request is missing, inputs or casting changed, presentation dependencies are stale, or remaining provider work cannot be priced. Forced image regeneration, audits, and revision evaluation remain `comic generate-images` operations. Source preparation, references, voice approvals, provider additions, and rendering changes use their existing commands.

Comic recovery rejects provider, model, rendering, configuration, character catalog, output path, and concurrency overrides. `--allow-ambiguous-redispatch` can retry a TTS request that has no recoverable audio, which may purchase it again; completed audio stays reusable. It does not authorize blocked sound-effect work.

See the [comic overview](../05-visuals/comic/00-comic-overview.md), [image generation](../05-visuals/comic/03-generate-images.md), [audio generation](../05-visuals/comic/04-generate-audio.md), and [local slideshow](../05-visuals/comic/05-generate-slideshow.md) for preparation and explicit stage operations.

## Write Options

Write resumes reuse the stored `prompt.md` and run only the selected LLM providers that do not already have matching output. When the new file would reuse an existing output name, resume adds the provider name, such as `text-together-glm-5.3-flash.json` beside `text-glm-5.3-flash.json`.

| Flag                 | Description                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| `--prompt <name...>` | Override the prompt used to validate new LLM outputs. If omitted, resume uses the original run's prompt. |
| `--prompt-md`        | Save a second prompt file (`prompt-md.md`) with Markdown examples alongside the JSON prompt              |

## Extract And TTS Options

These flags match the original commands. Meanings are the same unless noted.

- Extract: `--ocr-provider-mode` must match the original run. Omit it to keep the stored mode; a different value is rejected.
- TTS: resume accepts only provider-neutral options, and it does not accept `--tts-book`. `--allow-ambiguous-redispatch` may repurchase a stored generation that has no recoverable audio. When no chunking or mastering flag is passed, resume keeps the stored render so completed audio is not purchased again. Saved shared chunking, mastering, export, and pronunciation settings are restored automatically. Older legacy and smart plans replay their original chunk algorithm; new runs always use the current smart planner. Explicit overrides must remain compatible with the retained plan. A different voice, cast, synthesis control, or output plan stops before any repurchase.

## Gemini remote TTS jobs

For a recorded Gemini Batch run, `--provider-job-action status|wait|cancel` defaults to `wait`. Status retrieves current provider results; wait also assembles retained audio; cancel requests remote cancellation and reconciles completed work. Local interruption preserves remote execution. Known job IDs and successful slots are never resubmitted. `resume <output-dir> --price` is local and reports possible additional spending for unsubmitted or ambiguous slots. These controls reject incompatible runs. See [Gemini TTS](../04-audio/tts/overview.md#gemini).

Recorded Gemini Batch jobs preserve their original synthesis and delivery settings; resume rejects TTS overrides. Pending jobs and validated audio are reused, and custom voices are rechecked for expiry before any unsubmitted work is dispatched.
