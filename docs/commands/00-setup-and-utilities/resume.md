# resume

Recover missing outputs or recorded comic stages in existing canonical run directories; it never accepts a new source.

## Usage

```bash
bun autoshow resume <outputDirs...> [flags]
```

## Behavior

- Supports extract STT/OCR/article, write, TTS, image, video, music, and single-scene comic manifests. X Spaces cannot resume.
- Standalone/extract runs preserve successes, retry eligible missing/failed targets, and permit additive selections. Write runs only explicitly selected providers; no selection is a no-op.
- Parent extract batches recover their children. Multiple directories run sequentially with the same flags; failures are collected without stopping later directories.
- `--price` plans the same remaining/additive work without provider calls or writes. Execution updates the existing run; incomplete/failed backfills exit 2. A successful no-op can leave unselected targets incomplete, so inspect manifest status.
- Split STT reuses completed `split-attempts/` segments only when source audio, model, segment, and options match.

## Provider Selection

`--provider provider[=model]` is repeatable and resolves against the recorded command/extract route. `--all-providers` selects its hosted inventory; extract-only `--all-local` selects local engines. Article runs accept one explicit backend or a backend group through the all flags. Local HTML remains Defuddle-only.

Use `resume --help` and the original command guide for current catalogs/options. Provider-named option flags are rejected; use generic controls such as `--tts-stability elevenlabs=0.4`. Shared `--format`, `--duration`, and `--aspect-ratio` retain their original command meanings.

Automatic OCR recovery skips deterministic quota, billing, account, policy, and auth blockers. After fixing the cause, explicitly reselect `--provider provider=model` to include that target. Preserve successful outputs and receipts; a failed request may already be charged, so preflight additional work and cumulative retry spending under [project rules](../../../AGENTS.md#paid-providers).

## Create the runs used below

From the repository root after local setup, create an unused example workspace. Preparation refuses an existing destination; choose another root consistently if needed. It creates inputs, catalogs, and empty config; subsequent CLI calls create genuine manifests.

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

### Local item, batch, and document runs

These use installed local tools without hosted requests:

```bash
bun autoshow extract input/examples/document/harborlight-article.html --output-dir output/resume-example/article --config-path output/resume-example/empty-config.json
bun autoshow extract output/resume-example/batch-inputs --batch-limit all --output-dir output/resume-example/batch --config-path output/resume-example/empty-config.json
bun autoshow extract input/examples/document/harborlight-field-notes.pdf --provider tesseract --no-chapters --output-dir output/resume-example/document --config-path output/resume-example/empty-config.json
bun autoshow resume output/resume-example/article output/resume-example/batch --provider defuddle --price
bun autoshow resume output/resume-example/article output/resume-example/batch --provider defuddle
bun autoshow resume output/resume-example/document --all-local --price
```

The item/document roots contain `manifest.json` and extraction; the batch manifest links its preserved children. Selectors must fit every supplied directory. Completed compatible extraction is reused. `--all-local` does not install tools/models.

Plan additional hosted OCR separately before execution:

```bash
bun autoshow resume output/resume-example/document --provider openai=gpt-6-luna --price
```

### Write output and a real incomplete provider

Configure Grok/OpenAI credentials and inspect cost before creating this hosted run:

```bash
bun autoshow write input/examples/document/harborlight-field-notes.md --provider grok=grok-4.7 --provider openai=gpt-6-luna --prompt shortSummary --price --config-path output/resume-example/empty-config.json
bun autoshow write input/examples/document/harborlight-field-notes.md --provider grok=grok-4.7 --provider openai=gpt-6-luna --prompt shortSummary --output-dir output/resume-example/write --config-path output/resume-example/empty-config.json
bun autoshow resume output/resume-example/write --provider grok=grok-4.7 --provider openai=gpt-6-luna --price
bun autoshow resume output/resume-example/write --provider grok=grok-4.7 --provider openai=gpt-6-luna
```

Initial write can succeed with partial-failure warnings; inspect item/provider states. Fix the provider cause before retrying. Resume sends only missing selected outputs, retaining the source snapshot, `prompt.md`, and successes; all-complete selections are no-ops. Never delete outputs or edit statuses to force requests.

Named-preset runs can recover even when every initial provider failed. Named presets plus plaintext prompt files are resumable; prompt-file-only and JSON leaf prompt-file runs cannot restore custom validation schemas for missing targets and require a new write with the original prompt file.

## Recovery Controls

Standalone/extract recovery accepts `--batch-concurrency`, `--provider-concurrency`, `--local-concurrency`, `--concurrency-mode ramp|immediate` (default ramp), and repeatable `--step-concurrency scope=N` for `stt-segment`, `stt-preflight`, `ocr-page`, and `tts-chunk`. Comic restores recorded concurrency instead.

## Comic Recovery

Create a local structure-only run from the character-free scene above; omit providers to avoid generation:

```bash
bun autoshow comic draft-scenes output/resume-example/comic-inputs/scene.md --only structure --characters-root output/resume-example/comic-inputs/characters --output-dir output/resume-example/comic --config-path output/resume-example/empty-config.json
bun autoshow resume output/resume-example/comic --price --json
bun autoshow resume output/resume-example/comic
```

This creates structured script/manifest with unrequested image/audio/presentation stages; recovery is a ready, zero-cost no-op. Use the [comic stages](../05-visuals/comic/00-comic-overview.md) to record actual generation requests first, retaining source/catalog files.

Recovery continues requested image, audio, then presentation using recorded choices. Compatible completed stages are reused; unrequested stages stay unrequested. Configuration never supplies replacement providers. The original `--max-generation-slots` limit is not restored; audio recovery finishes remaining slots.

Price JSON exposes `data.comicPlans`, readiness, and stage actions `reuse`, `resume`, `not-requested`, `blocked`, or `after-audio`. Blocked totals include only priceable work; execution refuses blockers. Invalid manifests and missing sources fail inspection. Changed inputs/casting, missing original intent, stale presentation dependencies, or unpriceable remaining work block recovery.

Interrupted `generate-audio --slideshow` finishes locally after audio recovery. Presentation-only recovery requires complete upstream media and canonical `panels/panel-NN.png`; it never prepares sources, generates missing assets, promotes variants, changes approvals/providers, or runs forced regeneration/audits/revisions.

Accept `--price`, `--allow-ambiguous-redispatch`, `--bin-dir`, logging controls, and `--json --result-file`. `--require-shared-budget` allows configured price inspection, but budgeted resume execution remains unsupported and fails before dispatch. Reject provider, rendering, configuration, catalog, output-path, and concurrency overrides. Explicit ambiguous redispatch may repurchase unresolved TTS slots while reusing completed audio; it does not authorize blocked sound effects.

## Write Options

Resume sends retained `prompt.md` and avoids overwrites with provider/numeric filename suffixes. `--prompt` selects validation presets for new outputs while saved text is still sent; omit it to retain the original preset. Custom-schema restrictions above still apply.

## Extract And TTS Options

OCR `--ocr-provider-mode` defaults to the stored mode; an explicit mismatch fails. TTS rejects `--tts-book` and restores compatible chunking, mastering, export, and pronunciation settings. Canonical pre-mastering runs retain legacy chunk plans/delivery when no override is explicit. Voice, casting, synthesis, and output-plan changes must remain compatible or fail before dispatch. Preserve cached audio and inspect `--price` before ambiguous redispatch.

## Gemini remote TTS jobs

Recorded Batch jobs use `--provider-job-action status|wait|cancel`, default `wait`. `status` retrieves state/available results without final assembly; `wait` also submits prepared remaining jobs, waits, and assembles; `cancel` requests remote cancellation and reconciles completed work. Local interruption does not cancel remote jobs.

Price inspection stays local and includes possible unsubmitted/ambiguous work. Known jobs and validated audio are reused; unresolved submission blocks recreation unless later explicitly authorized through `--allow-ambiguous-redispatch`. Original synthesis/delivery settings are pinned and reject overrides; expiring custom voices are rechecked before unsubmitted dispatch. See [Gemini TTS](../04-audio/tts/overview.md#gemini).
