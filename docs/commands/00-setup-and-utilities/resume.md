# resume

Backfill missing provider outputs or continue recorded comic stages in an existing run directory.

## Usage

```bash
bun autoshow resume <outputDirs...> [flags]
```

`resume` does not accept a new source input. Point it at one or more existing output directories that contain `manifest.json`.

## Behavior

- Supported targets: `extract` (STT, OCR, URL article), write LLM, TTS, image, video, music, and comic scene runs.
- Standalone and extract runs retry missing or failed providers and can add `--provider` / `--all-providers` selections. Extract also accepts `--all-local`. Successful targets are skipped. Write LLM resume runs only explicit `--provider` or `--all-providers` selections; omitting them is a no-op.
- Successful outputs are kept if some providers fail.
- A split STT provider keeps each finished segment in `split-attempts/`. A recovery pass or a later `resume` that plans the same segment from the same audio, model, and options reuses it, so only unfinished segments are sent again.
- Multiple directories are processed sequentially with the same flags. Per-directory failures do not stop later directories; all failures are reported at the end.
- Parent `extract` batch directories resume their media, document, or article children. X Space runs are not resumable.
- `--price` estimates the same missing or additive work without calling providers or writing files.
- `resume` updates the existing output directory in place.
- Failed or incomplete backfill attempts exit with code `2`. A successful no-op or completed explicit selection can leave other manifest targets incomplete, so inspect the manifest when checking the whole run.

Shared flag meanings depend on the recorded command: `--format` selects OCR output or image encoding, `--aspect-ratio` selects image or video shape, and `--duration` selects video or music length. Comic recovery restores recorded choices and rejects these overrides; see [Comic Recovery](#comic-recovery).

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

Resume rejects provider-named option flags such as `--elevenlabs-tts-stability`. Use the provider-general spelling where one exists (`--tts-stability elevenlabs=0.4`), set the value under `defaults` in `config/autoshow.json`, or rerun the original command.

## Create the runs used below

Run these commands from the repository root after local setup. The examples use a fresh `output/resume-example` workspace. The preparation command refuses an existing workspace; choose another name throughout if it already exists. It creates inputs and catalogs; the CLI commands below create the manifests.

```bash
bun --no-env-file - <<'JS'
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises'
import { constants } from 'node:fs'
const root = 'output/resume-example'
await mkdir('output', { recursive: true })
await mkdir(root)
await mkdir(root + '/batch-inputs')
const article = await readFile('input/examples/document/harborlight-article.html', 'utf8')
await writeFile(root + '/batch-inputs/01-morning.html', article, { flag: 'wx' })
await writeFile(root + '/batch-inputs/02-review.html', article.replaceAll('A day of observations at Harborlight', 'Harborlight: a second reading'), { flag: 'wx' })
await mkdir(root + '/comic-inputs')
await mkdir(root + '/comic-inputs/characters')
await mkdir(root + '/comic-inputs/locations')
await copyFile('input/examples/comic/harborlight-camp--style-seed.png', root + '/comic-inputs/characters/style-seed.png', constants.COPYFILE_EXCL)
await writeFile(root + '/comic-inputs/characters/characters-reference.json', JSON.stringify({ schemaVersion: 3, characters: [], groupAliases: [] }), { flag: 'wx' })
await writeFile(root + '/comic-inputs/locations/locations-reference.json', JSON.stringify({ schemaVersion: 1, styleImage: '../characters/style-seed.png', locations: [{ key: 'harbor', name: 'Harbor', aliases: [], specification: 'A quiet pier facing a stone lighthouse across calm water.', sourceScripts: [root + '/comic-inputs/scene.md'] }] }), { flag: 'wx' })
await writeFile(root + '/comic-inputs/scene.md', '# Episode 99: Harborlight recovery\n\n## Harbor watch\n\n**EXT. HARBOR – EVENING**\n\nA beacon sweeps across the empty pier. A folded map rests beside a teal mug. The water catches the light and settles again.\n', { flag: 'wx' })
await writeFile(root + '/empty-config.json', '{}\n', { flag: 'wx' })
JS
```

The comic scene has no characters or dialogue, so its cast catalog is empty. It uses the location catalog and style image to create a local structure-only run without requesting generated images or audio.

### Local item, batch, and document runs

These commands need the local extraction tools installed by `setup`. They make no hosted calls. Each destination must be unused before its creation command.

```bash
bun autoshow extract input/examples/document/harborlight-article.html --output-dir output/resume-example/article --config-path output/resume-example/empty-config.json
bun autoshow extract output/resume-example/batch-inputs --batch-limit all --output-dir output/resume-example/batch --config-path output/resume-example/empty-config.json
bun autoshow extract input/examples/document/harborlight-field-notes.pdf --provider tesseract --no-chapters --output-dir output/resume-example/document --config-path output/resume-example/empty-config.json
```

The item and document destinations contain `manifest.json` and `extraction.txt`. The batch manifest links to its article children. Pass the parent directory to resume and preserve its child directories.

All paths below are artifacts of the preceding commands. Completed extraction is reused. A shared selector must fit every directory: `defuddle` applies to the article item and batch, while `tesseract` applies to the document.

```bash
bun autoshow resume output/resume-example/article --price
bun autoshow resume output/resume-example/article
bun autoshow resume output/resume-example/article --provider defuddle --price
bun autoshow resume output/resume-example/batch --price
bun autoshow resume output/resume-example/batch
bun autoshow resume output/resume-example/article output/resume-example/batch --provider defuddle --price
bun autoshow resume output/resume-example/document --provider tesseract --price
bun autoshow resume output/resume-example/document --all-local --price
```

For documents, `--all-local` selects Tesseract without installing tools or downloading models. Local HTML uses Defuddle and skips hosted article backends. The following plans add hosted OCR and can cost money when executed; inspect them first:

```bash
bun autoshow resume output/resume-example/document --provider openai=gpt-6-luna --price
bun autoshow resume output/resume-example/document --all-providers --price
```

For your own runs, use explicit compatible manifest directories; a wildcard may also match input folders or incompatible commands.

### Write output and a real incomplete provider

Write uses hosted LLMs. Configure Grok and OpenAI credentials and review the upstream estimate before running it. The price command does not create the subsequent write manifest.

```bash
bun autoshow write input/examples/document/harborlight-field-notes.md --provider grok=grok-4.7 --provider openai=gpt-6-luna --prompt shortSummary --price --config-path output/resume-example/empty-config.json
bun autoshow write input/examples/document/harborlight-field-notes.md --provider grok=grok-4.7 --provider openai=gpt-6-luna --prompt shortSummary --output-dir output/resume-example/write --config-path output/resume-example/empty-config.json
```

The upstream run creates `output/resume-example/write/manifest.json`, a source snapshot, `prompt.md`, and successful provider JSON outputs. If one provider actually fails after another succeeds, the run retains the successful output and records the incomplete target. Initial write can exit successfully with a partial-failure warning, so inspect the manifest's item and provider statuses instead of relying on its exit code. Fix the reported provider cause, preserve the source snapshot and prompt, then inspect and retry that existing run:

```bash
bun autoshow resume output/resume-example/write --provider grok=grok-4.7 --provider openai=gpt-6-luna --price
bun autoshow resume output/resume-example/write --provider grok=grok-4.7 --provider openai=gpt-6-luna
```

Only missing selected outputs are requested; successful outputs are preserved. If both selected targets succeeded, this is a no-op. Preserve the run directory and its manifest rather than deleting outputs or editing statuses to force a backfill.

When every provider fails, the manifest, prompt, and source snapshot are retained and can support a named-preset retry. Custom prompt-file-only runs and JSON leaf prompt-file runs cannot restore their validation schema for missing targets; preserve them and start a new write with the original prompt file. Named presets combined with a recorded plaintext prompt file remain resumable.

The retry quote covers additional work. A failed request without a valid output may already have been charged. Keep historical receipts and successful outputs, and include possible charges for both the original request and its retry in cumulative spending.

## Recovery Controls

These concurrency controls apply to standalone and extract runs. Comic recovery restores recorded concurrency; its accepted flags are listed under [Comic Recovery](#comic-recovery).

| Flag                                   | Description                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `--price`                              | Estimate the providers resume would run and exit without provider calls or writes                       |
| `--batch-concurrency <n>`              | Number of batch items to process concurrently                                                           |
| `--provider-concurrency <n>`           | Max hosted providers/models running in parallel for one item                                            |
| `--local-concurrency <n>`              | Max local providers/models running in parallel for one item                                             |
| `--concurrency-mode <ramp\|immediate>` | Ramp hosted concurrency from one request (`ramp`, default) or start at the configured cap (`immediate`) |
| `--step-concurrency <scope>=N`         | Intra-step parallelism (`stt-segment`, `stt-preflight`, `ocr-page`, `tts-chunk`); repeatable            |

## Comic Recovery

Create a comic scene manifest from the local character-free scene prepared above. Omit `--provider` so structure parsing stays local. Keep its source script and catalog workspace available.

```bash
bun autoshow comic draft-scenes output/resume-example/comic-inputs/scene.md --only structure --characters-root output/resume-example/comic-inputs/characters --output-dir output/resume-example/comic --config-path output/resume-example/empty-config.json
bun autoshow resume output/resume-example/comic --price
bun autoshow resume output/resume-example/comic --price --json
bun autoshow resume output/resume-example/comic
```

The command creates `metadata/structured-script.json` and `manifest.json`. Its price plan is ready with zero provider cost and image, audio, and presentation marked `not-requested`; resume is a no-op. To recover generated stages, first run the relevant [comic stage commands](../05-visuals/comic/00-comic-overview.md) so their requested choices are recorded.

Recovery continues requested image, audio, and presentation work in that order using recorded choices. Current configuration defaults never select replacement providers. A `--max-generation-slots` limit is not restored; resume finishes the remaining audio slots. Completed compatible runs are no-ops, and unrequested stages remain unrequested.

`--price` inspects the run without provider calls or writes. Each stage is marked `reuse`, `resume`, `not-requested`, `blocked`, or `after-audio`. With `--json`, check `comicPlans` and `ready` before running the same directory. A blocked plan can be inspected (`ready: false`), but its total covers only work that could be priced. Execution refuses a blocked plan. Invalid manifests or missing source files fail inspection.

A `generate-audio --slideshow` run reuses completed audio and then finishes the local slideshow. A presentation-only recovery never generates missing images, voices, or sound effects. Slideshow readiness still requires `panels/panel-NN.png`; resume does not choose or promote image variants.

Recovery blocks when the original request is missing, inputs or casting changed, presentation dependencies are stale, or remaining provider work cannot be priced. Forced image regeneration, audits, and revision evaluation remain `comic generate-images` operations. Source preparation, references, voice approvals, provider additions, and rendering changes use their existing commands.

Comic directories accept `--price`, `--allow-ambiguous-redispatch`, `--bin-dir`, and logging flags (`--json`, `--quiet`, `--verbose`, `--color` / `--no-color`, `--log-level`). Provider, rendering, configuration, catalog, output-path, and concurrency overrides are rejected. `--allow-ambiguous-redispatch` can repurchase a TTS request that has no recoverable audio; completed audio stays reusable. It does not authorize blocked sound-effect work.

See the [comic overview](../05-visuals/comic/00-comic-overview.md), [image generation](../05-visuals/comic/03-generate-images.md), [audio generation](../05-visuals/comic/04-generate-audio.md), and [local slideshow](../05-visuals/comic/05-generate-slideshow.md) for preparation and explicit stage operations.

## Write Options

Write resumes send the stored `prompt.md` and run only selected LLM targets without matching output. New filenames avoid overwriting existing outputs by adding a provider name or numeric suffix when needed.

| Flag                 | Description                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `--prompt <name...>` | Choose the preset used to validate new outputs; the saved prompt text is still sent. Omit to retain the original preset. |

## Extract And TTS Options

These flags match the original commands. Meanings are the same unless noted.

- Extract: `--ocr-provider-mode` must match the original run. Omit it to keep the stored mode; a different value is rejected.
- TTS uses provider-general options and rejects `--tts-book`. Saved chunking, mastering, export, and pronunciation settings preserve compatible completed audio. Older compatible runs retain their original chunk boundaries. Explicit changes to voice, casting, synthesis controls, or the output plan must match retained work or stop before dispatch. `--allow-ambiguous-redispatch` can repurchase a stored request with no recoverable audio; preserve its cached files and inspect `--price` first.

## Gemini remote TTS jobs

For a recorded Gemini Batch run, `--provider-job-action status|wait|cancel` defaults to `wait`. `status` retrieves provider status and available results without assembling final outputs. `wait` also submits prepared remaining jobs, waits, and assembles audio. `cancel` requests remote cancellation and reconciles completed work. Local interruption leaves remote execution active; known job IDs and successful slots are never resubmitted.

`resume <output-dir> --price` is local and reports possible additional spending for unsubmitted or ambiguous slots. An ambiguous submission blocks until reconciled; `--allow-ambiguous-redispatch` can purchase that work again. See [Gemini TTS](../04-audio/tts/overview.md#gemini).

Recorded Gemini Batch jobs preserve their original synthesis and delivery settings; resume rejects TTS overrides. Pending jobs and validated audio are reused, and custom voices are rechecked for expiry before any unsubmitted work is dispatched.
