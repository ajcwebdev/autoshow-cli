# Legacy and Backwards-Compatibility Audit — Second Sweep

Second audit: 2026-08-07. The first audit (2026-08-06) swept `src/`, `test/`, `scripts/`, `package.json` and `Dockerfile` hunting for obvious dead code, and its findings were closed out across five waves. This sweep was organized differently on purpose — twelve independent lenses, each looking for a *kind* of legacy rather than a region of the tree, so that residue invisible to a file-by-file read would surface. It found roughly 100 items the first audit never saw.

The interesting result is that most of what turned up is not dead code. It is **drift**: two catalogs that were supposed to stay in sync and did not, a schema that documents a capability the merger never implemented, docs that instruct users to set env vars the CLI stopped reading. Dead code is harmless until someone reads it; drift actively misleads. §2 collects the cases where drift has already produced a user-visible defect.

## Verification status — read this before acting

Findings carry one of three marks. Treat them differently.

- **[verified]** — an independent skeptic agent re-derived the finding from source and confirmed it. Six lenses got this treatment: duplicate implementations, back-compat arms, schema versioning, config/flag surface, type surface, and test residue. 34 confirmed, 14 downgraded (real but overstated — corrected below), 1 refuted.
- **[unverified]** — the finder's own claim, no second pass. Five lenses ended here because the run hit a monthly spend limit mid-flight: dead exports, model catalogs, docs drift, infra/tooling, and ADR drift. These are plausible and well-cited but **must be re-checked before you delete anything**.
- **[spot-checked]** — unverified by the workflow, but confirmed by hand with local greps while writing this report.

One lens never ran at all: **naming and vocabulary drift** (superseded error-type names, `epub` vs `chapter`, removed command names lingering in comments and log strings). That territory is unaudited. It is the obvious next sweep.

---

## 1. Real defects caused by drift (fix these first)

These are not cleanup. Each one is a thing that does not work, or works wrongly, today.

**`autoshow config --stt together=<model>` writes a config file no later command can load.** [verified — downgraded] `ExtractSttDefaultsSchema` / `ExtractOcrDefaultsSchema` (`types/cli-surface/config-types.ts:9,37`) are a hand-maintained list of provider keys, while `config-merge.ts:24-26` derives `STEP2_PROVIDER_CONFIG_PATHS` from the step-2 provider registry. The registry gained `together-stt` and `whisperfile-stt`; the hand-list never did. So the write path accepts the key and the strict read schema rejects it. The skeptic reproduced this end to end: `config --stt together=...` reports "Config saved", and the resulting file fails to load. Minimum fix is adding `togetherStt` and `whisperfile` to the schema; the real fix is building both shapes from `getStep2ProviderConfigPathEntries()` so the two lists cannot diverge again, plus a contract test asserting every registry `configPath` parses.

**`setup --step image` / `--step video` report the wrong credentials.** [unverified] `IMAGE_PROVIDER_ENV_KEYS` / `VIDEO_PROVIDER_ENV_KEYS` (`run-complete-setup.ts:385-402`) still list a GLM image provider that does not exist and omit Replicate, Luma and fal.ai — all first-class providers per `provider-targets.ts:15-36`. A user setting up image generation is told the wrong keys. Derive both lists from the provider registries.

**fal.ai has no documented credential.** [spot-checked] `FAL_API_KEY` is read by `fal-image-gen.ts:5` and `fal-video-gen.ts:5`, but appears in neither `.env.example` nor `HOSTED_PROVIDER_ENV_CHECKS`. Meanwhile `.env.example:73-74` still documents `REVE_API_KEY`, which nothing reads — ADR-019 did not delete Reve, it re-hosted Reve 2.1 *under fal* (`image-config.json:526`, `run-fal-image-gen.ts:112` builds endpoint `reve/2.1/...`). So the one key users need is missing and the key they don't need is prescribed.

**`whisperfile` price and time estimates are silently wrong.** [unverified] It has an 8-model selector table (`stt-models.ts:13-26`) but no `stt-config/*.json` registry row, so it falls through to hosted-API defaults — a local engine priced as if it were a network call. Both other local engines (`whisper`, `youtube-captions`) have registry rows. Either add `stt-whisperfile.json` with `"type": "local"` and zero cost rows, or retire the selector set.

**`benchmark --text` documents a path that has never existed.** [spot-checked] Help text (`define-benchmark-command.ts:106`) and docs point at `docs/benchmarks/text/<run>`; the real directory is `docs/benchmarks/write/`. `cli-help-contracts.test.ts:267` pins the wrong string, so it must be edited in the same change.

**Docs prescribe three things the CLI does not read.** [spot-checked] `AGENT=1 bun test/test-runner.ts` appears in five places including `AGENTS.md:8` — ADR-005 removed the `AGENT` env var and nothing reads it. `README.md:29-31` prescribes `YTDLP_COOKIES` / `YTDLP_COOKIES_FROM_BROWSER` and invents a precedence rule between them; ADR-005 deleted both in favor of the `--cookies` / `--cookies-from-browser` flags. `README.md:104-105` documents an OpenAI custom-voice flow (`--openai-tts-consent-id`, `--tts-ref-audio openai`) that no longer exists — `cli-help-contracts.test.ts:342-350` actively pins those flags *out* of help.

**Seven `config` flags are accepted and silently discarded.** [verified — downgraded] `config-types.ts:138-142,173-174` declares seven image/video keys that `FLAG_TO_CONFIG_PATH` has no entry for, so `config --image-mask x` succeeds and does nothing. Pick a direction: `omitFlags` them so the command errors, or wire them up. Independently, `buildConfigPatchFromFlags` should warn when an explicit flag has no config destination — that is what let this stay invisible.

---

## 2. Mechanical deletions — no behavior change on any reachable path

Waves 7 and 8 in the plan below. Each is dead by construction; the successor is named.

### Superseded duplicate implementations

- **Five per-provider `computeActual*OcrCost` functions**, ~119 lines. [verified] `extract-pricing.ts:442-560`. Superseded by the generic `computeActualTokenOcrCost` (`provider-family-resolvers.ts:45`), which covers seven providers to their five and additionally handles `tokenPricingBands`/`higherContextPricing`. Zero references repo-wide. Found independently by two lenses.
- **`runOpenAICompatibleTextOnlyStt`**, 67 lines. [verified] `openai-compatible-single-speaker.ts:94-160`. Its superset `runOpenAICompatibleSingleSpeakerStt` sits at `:162` in the same file and makes text-only a `formFields` argument. Zero references. Also found by two lenses.
- **`ensureSttTargetSetup` forwarding stub.** [verified] `run-stt/dispatch.ts:4,25-28` forwards to the real one in `bootstrap.ts:39`; repoint `target-orchestration.ts:3`.
- **`VIDEO_MODES` redeclared** in `video-mode-validation.ts:4` instead of imported from its canonical home `types/video-workflow/video-types.ts:27`, which is the array the `VideoMode` union derives from. [verified]
- **Local `toArray`** in `ocr-costs.ts:20` shadowing the shared `~/utils/text-utils` helper its two consumers already import. [verified]
- **Dead comic character-catalog wrappers.** [verified] `character-utils.ts:143-151`, `character-reference-config.ts:222`, `character-detection.ts:9-15,26-27` — thin facades over the frozen `CharacterCatalogService` that callers now use directly.
- **`loadAndVerifyLocationReferenceSnapshots`** and friends (`location-reference.ts:245-262`) — a test-only duplicate of the production verifier `resolveLocationReferencesAcrossPanels`. [verified — downgraded] Move the tamper/missing-manifest assertions in `multi-location-contracts.test.ts` onto the production path rather than dropping them.

### Dead re-export shims (ADR-002 migration residue)

ADR-002 declared a "migration window" of compatibility re-exports. The window closed; the exports stayed.

- **`process-url.ts:27-44`** — a 14-name compatibility block. [spot-checked] Only `processUrlArticle` is ever imported from this module (2 importers); every other consumer imports straight from `url-run-state` / `url-targets`. Delete both blocks.
- **`step-1-download-download-types.ts:3-12`** — re-exports eight step-0 types that `types/index.ts:5` already star-exports from their real home. [unverified]
- **`metadata-target-utils.ts`** — 7 of 12 re-exports have no consumer. [unverified] Better to retire the barrel entirely by repointing its five remaining importers.
- **Four single-name shims** across `provider-registry.ts:12`, `run-llamafile.ts:13`, `batch-manifest.ts:5`, `pdf-chunk-fallback.ts:75`, plus a three-line block in `voice-quality-report-runner.ts:5-7`. [unverified]

### Dead exports and unreachable branches

- **Zero-importer helpers with a named live replacement** [unverified]: `getEbookConvertBinary`/`getQpdfBinary` (`runtime-paths.ts:119,121`), `readDependencyUrl`/`readDependencySha256` (`dependency-metadata.ts:110-118`), `DEFAULT_OCR_CONCURRENCY_FLAG_VALUE`, `TTS_DIALOGUE_FORMATS`, `resolveLocationReferenceAcrossPanels`, `preflightReferenceCounts`, `selectorArgToInternalArgs`, `getCharactersRootAbsolute`/`joinCharactersRoot`. The last two cases also delete a second divergent copy of validation logic, so prefer deleting to re-wiring.
- **`budgetedTestIf`** (`test-utils/budget.ts:76-88`) — zero call sites, superseded by preflight-driven budget key skipping. [verified]
- **`resetQpdfHealthCacheForTests`** and the already-dead reset it aliases (`qpdf-health.ts:67-71`). [unverified] The cache is now keyed by `${source}:${path}` and self-invalidates.
- **Unreachable `default:` arm in `getHostedOcrLimitSource`** (`hosted-ocr.ts:76-77`) returning a link no provider uses. [unverified] Deleting it makes the switch exhaustive-by-type, so a future provider becomes a compile error instead of a bogus source path.
- **Six shadowed `case '<provider>-tts'` arms** in `resolveCheapestModelForFlag` (`cheapest-models.ts:483-504`), shadowed by ADR-018's `DEFAULT_HOSTED_TTS_MODEL_BY_FLAG` table above them. [unverified] The pinning test name (`bare provider flags resolve to cheapest defaults`) is now a lie for these six — resolution is a pinned canonical default, not the cheapest.
- **`nativeGeminiImage` capability flag** [unverified] — always true since ADR-019 made the three GA models the whole Gemini image surface, so its guard at `gemini-image-targets.ts:32-34` is unreachable. Delete the schema field, three JSON flags, three accessors and the guard; keep the concrete per-model rules at `:36-38,:53-55`.
- **`hfDownloadRepo` llama-alias indirection** [unverified] — the accessor can only return `undefined` now that `SUPPORTED_LLAMA_MODELS` entries *are* full HF repo IDs. Replace five `resolveLlamaDownloadRepo(model)` calls with `model`.
- **Empty `reve/` directory** and **zero-byte `x-spaces-types.ts`**. [spot-checked] Both confirmed: the directory has 0 entries, the file is 0 bytes.

### Type surface

- **`GenerationResourceGate`/`GenerationResourceGateOptions`** are byte-identical to `ResourceGate`/`ResourceGateOptions`. [verified] Delete the duplicate, repoint 8 annotation sites. Keep `createGenerationResourceGate` — its distinct default capacity is the only genuinely generation-specific thing.
- **Comic character type subgraph is fully dead**: `CharacterAliasPattern`, `CharacterDetails`, `CharacterFilePath`, plus an `export {}` file — all still on the barrel. [verified]
- **`ComicGridChunk<T>`** is a bare rename of `ComicPageChunk<T>`, used once, in a file that also uses the original. [verified]
- **`hostedTtsChunkJob`** on `ProcessingOptions` and `TtsOptions` — zero producers, zero readers; job identity is threaded per-call instead. [verified — downgraded]
- **`Step7MusicMetadata.inferenceSteps`/`.guidanceScale`** — diffusion knobs no music provider writes or reads. [verified]
- **`GeneratedImageResponse`** still carries OpenAI image-client echo fields (`inputFidelity`, `providerSizeLabel`, `providerQualityLabel`) that no producer can fill since ADR-007 deleted the comic-local image client. [verified]
- **Three orphaned pricing dimensions and eight registry-schema fields** declared but neither set nor read. [unverified] `registry-provenance.test.ts` names some of them but only iterates fields actually present, so nothing breaks.
- **`Download` layer**: single-member `ResolvedEngine` union, always-empty `DownloadProfile.flags`, a `DownloadResult` no caller reads. [verified — downgraded] The first two are type-only; changing `downloadFile` to return `void` is a separate signature change.

---

## 3. Back-compat arms — retire the old shape

Each accepts a shape no current writer produces. Removing them is a behavior change only for inputs that cannot occur.

- **`CLIUsageError`'s `normalizeHints` accepts three hint shapes; only the string arm has a producer.** [verified] The skeptic wrote a paren-balancing scanner over `src/`, `test/` and `scripts/`: exactly four call sites pass a second argument and all four are strings. Narrow to `hint?: string`, delete `CliUsageHintOptions`. This is the natural companion to the `CLIUsageError` name cleanup carried over from the first audit.
- **`runOpenAIOcr` / `runMistralOcr` still accept the pre-options-object positional string signature**, reachable only from tests. [verified] Sibling runners (`run-anthropic-ocr.ts:333`, `run-glm-ocr.ts:47`) have no string arm. Seven test call sites migrate with it.
- **Benchmark `run.json` readers accept four cost/timing/quality spellings no writer emits.** [verified — corrected 2026-08-07] The dead spellings were real and are gone. The rest of this finding was **wrong**: the claim that the alias list omits the key estimated steps use, so image/video benchmarks cannot resolve estimated cost, does not survive checking. Every writer (`compute-costs.ts`, `cost-steps-shared.ts`, `compute-actual-costs.ts`) emits `cost`, `cost` was already the first alias, and a scan of all 39 committed `docs/benchmarks/**/run.json` artifacts finds no step-level `totalCost` anywhere — `totalCost` is the breakdown-level run total (`pricing-types.ts:321`). Adding it would have created a new dead alias whose only possible match is a whole-run sum landing in a per-provider slot. It was deleted from `run-text-benchmark.ts` rather than added.
- **Panel-bundle `designReferences` fallback arm** is unreachable and self-contradictory. [verified — downgraded] The unreachability holds; the follow-up (removing `designReferences` from `PanelBundlePanelSchema`) is a larger change than the finder implied — it stays required in `ScenePromptData`/`PanelSchema` where it is the authored input.
- **URL manifests still write ADR-002's legacy `resolvedStep2.backend`/`backends`**, which no reader consumes — `parseStoredUrlBackends` reconstructs from `requestedProviders`. [verified — corrected 2026-08-07] Two corrections. The citation is wrong: the compatibility contract is ADR-002's shared-compatibility bullet, not the audit findings at :95-98, and that warning is about a **route rename** (changing a value readers gate on), not about deleting write-only keys. And the prescribed mitigation is backwards — a `schemaVersion` bump would have been the dangerous act, because four hard `schemaVersion !== 2` rejects exist with no migration code anywhere, so bumping without an upgrader silently makes every manifest already on disk non-resumable. There were also four writers, not one. Landed with no bump.
- **`llama-server` state file persists nine fields; only `pid` is read back.** [verified — downgraded] Live server introspection via `/props` and `/v1/models` superseded the rest.
- **`Step2Metadata.billing.source`** carries both hyphenated and snake_case spellings; `'response_header'` has no producer. [verified]
- **Hosted-OCR throughput profile store still accepts schema v1; its sibling token store does not.** [verified — corrected 2026-08-07] The framing misleads. The token store is not refusing v1 — its current version *is* 1, so it accepts v1 and nothing else, and it has never been bumped. These are not two policies; one store carries a back-compat arm for a version predating the repo squash, and the sibling has no equivalent case. "Either direction fixes it" is therefore false: the tolerant direction is not expressible, since there is no version 0 to tolerate. Resolved strictly — each store accepts exactly its current version and treats anything else as a cold cache.
- **The `!RUNTIME_ONLY_FLAGS.has('prompt')` conjunct is a constant true.** [verified — corrected 2026-08-07] That much holds, but "fully redundant guard" is stale and the "delete it" option is a **regression**, not a cleanup: a later wave added the discarded-flag warning immediately below the `RUNTIME_ONLY_FLAGS.has(flagName)` skip, so the set now suppresses a spurious "no config destination" warning for the nine of its twelve members that reach that line. Kept, with the disjointness invariant pinned. Note the disjointness test alone does not protect the `prompt` conjunct — `prompt` is deliberately absent from `FLAG_TO_CONFIG_PATH` because it is multi-destination, so it needs its own assertion.
- **Seven `FLAG_TO_CONFIG_PATH` entries** point at deleted flags (`--refresh-cache`, `--no-cache`, five `--minimax-tts-*` clone flags) and at config keys the strict schema rejects. [verified]

---

## 4. Test-suite residue

- **Report service attribution is keyed entirely on the removed per-provider selector flags.** [verified] `test/test-runner/reports/context.ts` has four flag tables (58 + 27 + … keys) and no handler for `--provider`, `--llm`, `--stt`, `--ocr`, `--tts`, `--image`, `--video` or `--music` — the spellings every test actually uses. Attribution now comes from `run.json` metadata instead, so the tables may be entirely redundant. This supersedes the smaller "stale image selectors" item from the first audit, which was one symptom of it.
- **Adaptive-concurrency provider-group extraction** dispatches on the same removed flags, and two contract tests pin argv the CLI now rejects. [verified — downgraded]
- **`price-selection.test.ts` builds fixture argv from the removed `--openai <model>` selector** that the same suite asserts is rejected. [verified]
- **`--cleanup` is an accepted no-op** documented as retained for compatibility; superseded by cleanup-by-default plus `--no-cleanup`. [verified]
- **`validation-next`** — a directory that no longer exists — survives as synthetic path fixtures and tmpdir prefixes across five files. [verified — downgraded]
- **Cloudflare-STT absence guards** outlive a provider that exists nowhere, and duplicate each other across two files. [verified — downgraded] At minimum delete the duplicate; the STT list is registry-generated now, so the guards earn less than they used to.
- **Orphaned, non-compiling STT artifact-repair script** for deleted providers (`.codex/skills/consensus/scripts/stt/repair_saved_stt_artifacts.ts`), superseded by repair-at-write-time in the live pipeline. [verified] Its sibling `build_reference_report.ts` still has quality-warning branches for deAPI, GLM-STT and OpenAI-STT, all dropped by ADR-016.

---

## 5. Documentation and ADR drift

Beyond the user-facing defects in §1, the ADRs have drifted from the code they describe. These matter because an ADR is the only record that something was meant to be temporary.

- **ADR-003's implementation notes describe a `src/types` that does not exist** [verified]: four types it lists as "removed" are live, `RunTargetsOptionsBase` was never removed, and the phase-3 layout paths are all wrong — the tree is workflow-grouped now.
- **ADR-004 describes OCRmyPDF as a shipped tool and `AUTOSHOW_BIN_DIR` as a production resolver input**; neither exists. [unverified] ADR-009 chose Tesseract as the only local OCR engine, and `--bin-dir` replaced the env var. ADR-005 has the same PaddleOCR residue, which makes its own verification steps unrunnable.
- **ADR-001 points at a deleted convertible-ebook registry** and describes a two-registry design consolidated to one. [unverified]
- **ADR-002 cites two manifest schema-gate functions that no longer exist** and documents module paths (`step-2-url/cli.ts`, `manifest.ts`) that are really `url-cli.ts`/`url-manifest.ts`. [verified / unverified]
- **ADR-018 promises a historical `music-2.6` reader that does not exist**, so committed music benchmarks reprice to $0. [unverified] Either add the historical arm (ADR-019 did exactly this for `alibaba/happyhorse-1.0`), or amend ADR-018 to record the drop.
- **Comic docs state schema versions two bumps behind the code** (3 and 4, not 1 and 2). [verified]
- **Consensus skill references point at a nonexistent ADR-021**; the real one is ADR-014. [verified]
- **`docs/cookies.md` tells users to leave the CLI** for extractor-args and PO tokens, but `download -- <argv>` now forwards arbitrary yt-dlp arguments. [unverified]

The convention for ADR edits, established at ADR-005:130 and worth keeping: annotate as history rather than rewriting. ADRs are records.

---

## 6. Infrastructure

- **`.gitignore`'s entire `input/` allow-list (lines 8-33) is inert.** [unverified] Line 7's bare `input` pattern means git re-includes nothing; which fixtures ship is decided purely by what was force-added to the index. `input/examples/comic/` is silently untracked as a result, and `docs/tests` calls `anthony-voice.mp3` a "committed" fixture when it is not tracked either. Needs a decision about the intended fixture set before it can be expressed correctly.
- **`tsconfig.json:48` excludes `src/runtime/build`**, a path that has never existed. [spot-checked] The real transient tree is root-level `runtime/build`, already outside the include globs.
- **`Dockerfile:21` sets `AUTOSHOW_DOCKER_IMAGE`**, the last surviving piece of the Docker-detection mechanism ADR-005 removed. [spot-checked] Nothing reads it. Keep line 22 (`AUTOSHOW_SYSTEM_TESSDATA_PREFIX`), which is load-bearing.
- **Help flag-group catalogs** carry three group keys no flag claims and omit `fal-video`, so fal.ai video flags render ungrouped. [verified] Also worth renaming `CONFIG_COMMAND_HELP_FLAG_GROUPS` — it is the global ordering for every command, which is why the drift went unnoticed.

---

## 7. Needs a decision, not a cleanup

- **`mistral-ocr-latest` is a moving alias** duplicating the concrete `mistral-ocr-4-0` row. [unverified] ADR-011:83/148, ADR-018:18 and ADR-019:18 all state a no-moving-aliases policy. Either drop the alias (8 test files reference it) or amend the policy to record the exception.
- **OpenAI `tts-1`/`tts-1-hd`** are the previous TTS generation and the only hosted TTS rows ADR-018 did not touch. [unverified] Provider-side retirement is *unverified* — no API was called. Re-check at the next refresh.
- **`llamafile` is advertised by `config --help --llm` but has no config destination.** [verified] It is a live write provider; the three config-side catalogs were never extended past their original 11 providers. Add it, or drop it from the config command's provider list.
- **URL article provider capability negotiation is unreachable from every production caller** [unverified] — it was never wired to a CLI or config surface. Either wire it or shrink it to what ships.
- **`isLocalUrlBackend` hardcodes `'defuddle'`** where a registry-derived group exists. [unverified] Behavior is identical today; the point is that a second local backend cannot silently diverge.
- **Speechify voice catalog is duplicated** in `tts-speechify.json` and `tts-models.ts`; the registry copy is never read and cannot express the per-model compatibility split the TS constants encode. [unverified]

---

## 8. Cleared — do not re-litigate

- **`schemaVersion` optional on `run.json` shapes** — REFUTED. [verified] The finder wanted it required; the skeptic showed the type is fine as-is.
- Everything in the first audit's kept list stays kept: `llama` vs `llama.cpp` naming, the `*-targets.ts` barrels, `fromLegacyCheck`, bare model names in `setup --models`, `--concurrency` runner rejection, `ttsSpeaker` for `--kitten-voice`, `structured-output/compat-fallback.ts`.
- Owner-declined and not re-proposed: the singular `<provider>ImageModel/VideoModel/MusicModel` fields, and the two-image character identity cards.
- `rolling-shingle-approximation` is live source, not residue (`build_combined_report.ts:277,283`).

---

## 9. Carry-over from the first audit

Still open, unchanged: the `whisper-cpp` PATH probe in `benchmark-services.ts:31` (a real bug, but fixing it schedules five whisper models and GBs of downloads — decide the `models` array in the same change); `createModelValidator` interpolating internal flag keys into `Invalid --<flag> model` across all 68 call sites; search-grounding flag naming on the standalone `image` command; `--tts-voice` silently ignored in dialogue mode; `isMultiSpeakerRequested` accepting zero speaker mappings; the two regression-guard policy calls in `cli-usage-errors.test.ts:312` and `combined-report-weighted-ranking-contracts.test.ts:224-236`; and the ADR-005 question of whether the typed `baseUrl` seam stays on all four write providers or none.

Closed 2026-08-07 with Wave 10: the `CLIUsageError` name-string arm. `isCLIUsageError` is now `instanceof`-only and returns a type predicate; the last opt-in-by-name client (`UnsupportedArtifactSchemaError`) was deleted with the legacy-manifest tombstones, and there is no realm boundary in the codebase to justify the cross-realm rationale ADR-006 recorded. The removal is pinned by a negative assertion, so an impostor error carrying `name = 'CLIUsageError'` is now asserted to exit 1 rather than silently exit 2. The class's own `name = 'CLIUsageError'` stays — after this it is a diagnostics label, not a control-flow key, and renaming it would change every serialized diagnostic payload.

---

## 10. Sequencing — six waves

Numbering continues from the first audit, which closed Waves 1-5. Each wave below is independently shippable and independently revertable; the ordering is by risk and by what unblocks what, not by size. Waves 6, 9 and 10 change behavior and want their own commits. Waves 7, 8 and 11 are bulk work that can land as single commits.

One rule applies to every wave: an item marked **[unverified]** in §1-§7 must be re-derived from source before it is deleted. The workflow that produced it never got its skeptic pass. Re-verification is cheap — find the successor, grep for consumers, check for pinning tests — and it is the difference between this document being a work list and being a liability.

---

### Wave 6 — Fix the drift defects, and fix the pattern that caused them

**Goal.** Close every user-visible defect in §1. More importantly, kill the *mechanism* behind three of them: a hand-maintained list that was supposed to mirror a registry and silently stopped.

**The structural piece, first.** Three separate findings — the config schema, the setup env catalogs, and the fal.ai credential gap — are the same bug wearing different clothes. Each is a literal list that duplicates a registry and drifted when the registry grew. Patching the three lists leaves the fourth occurrence waiting to happen. Instead:

1. Derive `ExtractSttDefaultsSchema` / `ExtractOcrDefaultsSchema` (`types/cli-surface/config-types.ts:9,37`) from `getStep2ProviderConfigPathEntries()` — map each registry `configKey` to `ModelArraySchema` for model providers and `v.optional(v.boolean())` for boolean providers, leaving only the genuinely non-provider tuning keys hand-written.
2. Derive `IMAGE_PROVIDER_ENV_KEYS` / `VIDEO_PROVIDER_ENV_KEYS` (`run-complete-setup.ts:385-402`) from `STANDALONE_IMAGE_PROVIDER_TARGETS` / `STANDALONE_VIDEO_PROVIDER_TARGETS` (`provider-targets.ts:15-36`), the same source the `--image` / `--video` help text already renders from.
3. Add one contract test per derivation asserting the generated set matches the registry. This is the piece that makes the wave permanent rather than a one-time correction.

If deriving proves larger than expected, the interim patch is `togetherStt: ModelArraySchema` + `whisperfile: ModelArraySchema` in the schema, and dropping `GLM_API_KEY` / adding `REPLICATE_API_TOKEN`, `LUMA_AGENTS_API_KEY`, `FAL_API_KEY` to the env key lists — but file the derivation as the follow-up, don't lose it.

**Then the standalone defects.**

- **fal.ai credential.** Add `FAL_API_KEY` to `.env.example` in the multimodal block and a `{ envVar: 'FAL_API_KEY', label: 'fal.ai image/video', configPaths: ['defaults.post.image.falImage', 'defaults.post.video.falVideo'] }` entry to `HOSTED_PROVIDER_ENV_CHECKS`. Delete `.env.example:73-74` (`REVE_API_KEY`). `setup-command-contracts.test.ts:917-930` uses `arrayContaining`, so the addition is safe. While here, fix the `MISTRAL_API_KEY` comment to say STT + OCR + TTS.
- **`whisperfile` pricing.** Add `stt-config/stt-whisperfile.json` with `"type": "local"`, zero cost-per-hour rows and per-model `msPerSecond` estimates mirroring `stt-whisper.json`; add `whisperfile` to `LOCAL_ZERO_PROVIDERS` and `whisperfileModel` to `STT_FIELD_MAP`. If instead the 8-model whisperfile surface is judged vestigial beside whisper.cpp's 5-model catalog, retiring the selector set is the alternative — but that is a product decision, so default to adding the registry row.
- **`benchmark --text` path.** Change `docs/benchmarks/text/<run>` to `docs/benchmarks/write/<run>` at `define-benchmark-command.ts:106` and `benchmark.md:140,203,204`, and edit the assertion at `cli-help-contracts.test.ts:267` **in the same commit** — it pins the wrong string today and will fail otherwise.
- **Documentation defects.** `AGENT=1` → plain `bun test/test-runner.ts` in all five locations including `AGENTS.md:8`. `README.md:29-31,174` → `--cookies-from-browser` / `--cookies` with the real precedence from `docs/cookies.md:130-136`. Delete `README.md:104-105` (the OpenAI consent-id example); if an OpenAI example is still wanted, `--provider openai=gpt-4o-mini-tts-2025-12-15 --tts-instructions "..."` is the surviving surface. Zero code risk, and these are the items a new user hits first.
- **Seven silently-discarded `config` flags.** Recommended direction: treat them as per-run inputs — delete the seven keys from `ImageDefaultsSchema`/`VideoDefaultsSchema` and `omitFlags` the matching flags out of the config command, so `config --image-mask x` errors instead of doing nothing. Independently, make `buildConfigPatchFromFlags` warn when an explicit flag has no config destination; that silence is what hid this.

**Verification.** `bun run check`; the no-cost smoke set; `bun test test/test-cases/validation/configuration/config-contracts/` and `test/test-cases/validation/setup/setup-command-contracts.test.ts`. The new derivation tests are the real gate.

**Exit criteria.** No hand-maintained provider list remains that duplicates a registry without a test asserting they match.

---

### Wave 7 — Mechanical deletions, batch A (highest confidence)

**Goal.** Remove ~250 lines that are dead by construction, with no reachable behavior change. This is the safest wave in the document; run it as a warm-up and to bank a clean diff.

**Scope — everything here is `[verified]` or `[spot-checked]`, so no re-derivation is needed.**

- **Five `computeActual*OcrCost` functions**, `extract-pricing.ts:442-560`. Superseded by `computeActualTokenOcrCost` (`provider-family-resolvers.ts:45`), which covers seven providers to their five plus `tokenPricingBands`/`higherContextPricing`. The `validate*OcrModel` imports at `:7` stay — the surviving estimators still call them. Zero references repo-wide.
- **`runOpenAICompatibleTextOnlyStt`**, `openai-compatible-single-speaker.ts:94-160`. Superseded by the superset at `:162`. All shared private helpers stay live for the survivor; `noUnusedLocals` will catch it if not.
- **ADR-002 re-export shims.** `process-url.ts:27-44` (keep `getUrlProviderArtifactDir` in the *import* list at `:20-23` — it is used locally); `step-1-download-download-types.ts:3-12`; the seven dead names in `metadata-target-utils.ts` — or better, retire that barrel by repointing its five importers; the four single-name shims in `provider-registry.ts:12`, `run-llamafile.ts:13`, `batch-manifest.ts:5`, `pdf-chunk-fallback.ts:75`; and the three-line block in `voice-quality-report-runner.ts:5-7` (keep its `import` at `:3`).

Both leading items were found independently by two lenses that could not see each other's work, which is the strongest confidence signal in this document.

**Order.** Deletions only — no call-site rewrites — so order does not matter. Land as one commit.

**Verification.** `bun run check` catches everything here (`noUnusedLocals` is on). Then the smoke set. Then update ADR-002 to close its "compatibility re-exports" and "migration window" clauses, which this wave makes true.

**Exit criteria.** ADR-002's declared migration window is actually closed, in code and in the ADR.

---

### Wave 8 — Mechanical deletions, batch B (the long tail)

**Goal.** The rest of §2. Larger and more scattered than Wave 7, and mostly `[unverified]`.

**Prerequisite.** Re-derive every `[unverified]` item before deleting. Batch this: for each symbol, confirm the named successor exists, grep `src/ test/ scripts/` for consumers including barrels and string references, and check for pinning tests. Items that fail re-derivation move to §7 rather than being forced through.

**Scope, grouped so each group is one reviewable commit.**

1. **Duplicate implementations** [verified]: `ensureSttTargetSetup` stub (`dispatch.ts:4,25-28`, repoint `target-orchestration.ts:3`); `VIDEO_MODES` redeclaration (`video-mode-validation.ts:4`); local `toArray` (`ocr-costs.ts:20`); comic character-catalog wrappers (`character-utils.ts:143-151`, `character-reference-config.ts:222`, `character-detection.ts:9-15,26-27`); `loadAndVerifyLocationReferenceSnapshots` — and move its tamper/missing-manifest assertions onto `resolveLocationReferencesAcrossPanels` so coverage lands on the path production runs.
2. **Dead exports** [mixed]: the zero-importer helper set (`runtime-paths.ts:119,121`, `dependency-metadata.ts:110-118`, `DEFAULT_OCR_CONCURRENCY_FLAG_VALUE`, `TTS_DIALOGUE_FORMATS`, `resolveLocationReferenceAcrossPanels`, `preflightReferenceCounts`, `selectorArgToInternalArgs`, `getCharactersRootAbsolute`/`joinCharactersRoot`); `budgetedTestIf`; `resetQpdfHealthCacheForTests`. Prefer deleting `selectorArgToInternalArgs` and `preflightReferenceCounts` over re-wiring — each is a second, divergent copy of validation logic.
3. **Unreachable branches** [unverified]: `getHostedOcrLimitSource` default arm (deleting it makes the switch exhaustive-by-type, so future providers become compile errors); six shadowed `case '<provider>-tts'` arms in `cheapest-models.ts:483-504` — and rename the pinning test, whose name is now false for those six; `nativeGeminiImage` and its guard; `hfDownloadRepo` indirection (replace five `resolveLlamaDownloadRepo(model)` calls with `model`).
4. **Type surface** [verified]: `GenerationResourceGate` duplicate (delete, repoint 8 sites, keep `createGenerationResourceGate`); dead comic character types + the `export {}` file; `ComicGridChunk`; `hostedTtsChunkJob`; `Step7MusicMetadata.inferenceSteps`/`.guidanceScale`; `GeneratedImageResponse` echo fields; orphaned pricing dimensions and registry-schema fields; the `Download` layer's type-only residue (leave the `downloadFile` return-type change out — that is a signature change, not this wave).
5. **Filesystem** [spot-checked]: `rmdir` the empty `reve/` directory; delete the zero-byte `x-spaces-types.ts`. Optionally rename `x-spaces-types-types.ts` → `x-spaces-api-types.ts`, but check `src/tools/unique-source-name-check.ts` first — it enforces unique basenames under `src/`.

**Verification.** `bun run check` after each group; smoke set at the end; `bun test test/test-cases/validation/comic/` for group 1 and 4.

---

### Wave 9 — Test residue

**Goal.** Make the test tooling trustworthy. Until the report tooling attributes services correctly, every conclusion drawn from a generated report is suspect — which is why this sits ahead of the back-compat work despite being lower-risk.

**Lead item, and it may collapse the rest.** `test/test-runner/reports/context.ts` keys service attribution entirely on removed per-provider selector flags — four tables, 85+ keys, and no handler for `--provider`, `--llm`, `--stt`, `--ocr`, `--tts`, `--image`, `--video`, `--music`, the spellings every test actually uses. Before rewriting the tables, answer the prior question: attribution now also comes from `run.json` metadata via `extractPairsFromMetadata` (`context.ts:345+`). **If metadata attribution is sufficient, delete `buildPairsFromMetricArgs` entirely** rather than porting 85 dead keys to a new spelling. Only if arg-derived attribution is still needed should you write the single `--provider p=m` / `--url-provider p` / write-step-selector handler that replaces all four tables. This finding supersedes the first audit's smaller "stale image selectors" item, which was one symptom of it.

**Remaining scope.**

- `adaptive-provider-groups.ts` — delete the six selector maps naming non-existent flags and their branches; rewrite `adaptive-concurrency-contracts.test.ts:158-172` to real argv (`--provider openai=gpt-4o-mini-tts-2025-12-15`, `--provider gemini=gemini-3.1-flash-lite-image`).
- `price-selection.test.ts:20,30,44,54` — fixtures built from the removed `--openai <model>` selector the same suite asserts is rejected. Rewrite to `--llm openai=gpt-5.5` and `--provider openai=...`; assertions are unaffected.
- `--cleanup` no-op arm (`args.ts:51`), its docs sentence (`local-tests.md:59`), and `args-selection.test.ts:54-65` — which passes `--cleanup` but asserts nothing about it, so it silently changes code paths unless updated with the change.
- `validation-next` synthetic paths across five files; two expectations encode the literal and change with the fixtures.
- Cloudflare-STT absence guards — at minimum delete the duplicate across `setup-command-contracts.test.ts:123-132` and `cli-help-contracts.test.ts:231-236`, saving a CLI subprocess spawn; then decide whether registry-generated provider lists make the remaining guards redundant.
- `.codex/skills/consensus/scripts/stt/repair_saved_stt_artifacts.ts` — orphaned and non-compiling, superseded by repair-at-write-time. Delete. In its sibling `build_reference_report.ts`, drop the deAPI / GLM-STT / OpenAI-STT quality-warning branches (ADR-016 removed those providers) plus the now-unused `DEAPI_TIMESTAMP_MARKER_RE`; check `unknownToSearchText` for other callers first.

**Verification.** `bun test test/test-cases/validation/runtime/test-runner-contracts/` plus the smoke set. `budget-preflight.test.ts` in that directory spawns real `--price` subprocesses — preflight-only and cost-free, but slow; run it deliberately, not by reflex.

---

### Wave 10 — Back-compat arms, one at a time — LANDED 2026-08-07

**Goal.** Retire acceptance of shapes no current writer produces. Unlike Waves 7-8 these are behavior changes — for inputs that cannot occur today, but behavior changes nonetheless. **One item per commit**, each with its pinning tests migrated in the same commit. Do not batch this wave.

**Outcome.** All ten items landed. Every item was re-derived from source before being touched, which is what caught the four corrections recorded in §3 — three of them cases where following this document literally would have made things worse: adding `'totalCost'` (item 5) would have introduced a new dead alias, deleting `RUNTIME_ONLY_FLAGS` (item 7) would have regressed a live warning suppression, and bumping `schemaVersion` (item 10) would have made every manifest on disk non-resumable. The lesson generalizes past this wave: a `[verified]` mark records that a finding's *observation* was confirmed, not that its *prescription* was.

**Suggested order — lowest coupling first.**

1. **`normalizeHints`** (`error-handler.ts:80-100`) → narrow to `hint?: string`, delete `CliUsageHintOptions`. The skeptic proved by paren-balancing scan that all four call sites pass strings. Pair this with the carried-over `CLIUsageError` name-string cleanup from §9 — same file, same concern, one review.
2. **`Step2Metadata.billing.source`** — delete the producerless `'response_header'` member (pure type narrowing, no runtime change). The larger question of retiring the two hyphenated spellings at their source is a separate commit.
3. **`llama-server` state file** → reduce to `{ pid }`; live `/props` introspection superseded the other eight fields.
4. **OCR positional string signatures** (`run-openai-ocr.ts`, `run-mistral-ocr.ts`) → drop the `string |` union member and the four `typeof options === 'string'` branches; migrate the seven test call sites to `{ baseUrl: ... }`.
5. **Benchmark `run.json` alias readers** → ~~the same commit should add `'totalCost'` to `benchmark-utils.ts:84`~~. **Do not.** See the corrected §3 entry: estimated steps already write `cost`, it was already the first alias, and image/video estimated cost was never broken. `'totalCost'` was deleted from `run-text-benchmark.ts:111`, along with `costCents`/`actualCostCents`/`estimatedCostCents`, the dead timing-step `processingTime` arm, the legacy `textQualityScore` arm, and the then-unused `numberFromKeys` helper. The live output fields of the same names on `TextProviderRow`/`ImageRunEntry`/`VideoRunEntry` are untouched — the consensus scripts read those.
6. **`designReferences` fallback arm** → drop the `?? panel.designReferences?.map(...)` arms. Stop at that. Removing `designReferences` from `PanelBundlePanelSchema` is a bigger change than it looks — it stays required in `ScenePromptData`/`PanelSchema` where it is the authored input.
7. **`RUNTIME_ONLY_FLAGS`** → ~~delete, *or*~~ keep it as documented intent and add a test asserting it stays disjoint from `FLAG_TO_CONFIG_PATH`. The delete option is struck: the set is load-bearing today (see the corrected §3 entry). Kept, with two assertions — disjointness, and `has('prompt') === false` separately, since the first cannot see the second. The behavioral pin was also widened from nine of the twelve members to all twelve.
8. **Seven dead `FLAG_TO_CONFIG_PATH` entries** (`config-merge.ts:297-298,359-363`) → delete; the usage-error tests that pin the flags as rejected are unaffected.
9. **Hosted-OCR throughput v1 tolerance** → ~~either direction fixes it~~. Only the strict direction is expressible (see the corrected §3 entry). The throughput store's `!== 1` arm is gone; both stores now accept exactly their current version. The one fixture that pinned v1 tolerance moved to v2 in the same change, deliberately keeping its records field-sparse so it still proves the field-level derivation works.
10. **URL manifest legacy `resolvedStep2.backend`/`backends`** → ~~treat it as its own project~~; materially smaller than described. **Do not bump `schemaVersion`** — see the corrected §3 entry. Landed in the order given: derive `article-estimates.ts` from `providers` first (that is the only reader in the tree, and it reads an in-memory object, never a manifest), then delete the two fields from `ResolvedStep2Execution` and let `tsc` enumerate the writers. That last step matters — it found a fourth writer (`url-resume.ts`) that hand-inspection had missed, on top of the batch-manifest and document-`run.json` paths this document never mentioned. `providers` is now the sole persisted backend record; ADR-002 amended accordingly.

**Verification.** Per commit: `bun run check`, the smoke set, plus the specific suites named in each finding's pin list.

---

### Wave 11 — Documentation, ADRs and infrastructure

**Goal.** No code risk, high reader value. Can be interleaved with any other wave or done in idle time.

**ADR annotations.** Follow the convention already set at ADR-005:130 — annotate as history, never rewrite. ADRs are records of decisions made, not descriptions of current code.

- **ADR-003** — four types listed as "removed" are live, `RunTargetsOptionsBase` was never removed, and the phase-3 layout paths are wrong (the tree is workflow-grouped now).
- **ADR-004 / ADR-005** — OCRmyPDF and PaddleOCR no longer exist (ADR-009 chose Tesseract as the only local engine); `AUTOSHOW_BIN_DIR` was replaced by the `--bin-dir` global flag. ADR-005's verification steps are currently unrunnable because they configure a deleted engine — worth fixing so the ADR stays executable.
- **ADR-002** — cites two manifest schema-gate functions that no longer exist; the real mechanism is the inline `schemaVersion !== 2` guards in `manifest-utils.ts`. Also correct `step-2-url/cli.ts` → `url-cli.ts` and `manifest.ts` → `url-manifest.ts`.
- **ADR-001** — points at a deleted convertible-ebook registry; the design consolidated to one registry.
- **ADR-018** — promises a historical `music-2.6` reader that does not exist, so committed music benchmarks reprice to $0. Either add the arm (ADR-019 did exactly this for `alibaba/happyhorse-1.0`) or amend the ADR to record the drop. This one is a real decision, not an annotation.

**Docs.** Comic schema versions are two bumps behind (3 and 4, not 1 and 2) in `comic.md:195` and `05-types-and-output.md:198-199`. Consensus skill references point at a nonexistent ADR-021; the real one is ADR-014. `docs/cookies.md:161,168` sends users out of the CLI for extractor-args and PO tokens, but `download -- <argv>` now forwards arbitrary yt-dlp arguments — replace the escape hatch with a cross-link, and keep the "these env vars are not read" list, which is accurate.

**Infrastructure.** `tsconfig.json:48` excludes `src/runtime/build`, a path that has never existed — reduce to `["node_modules"]`. Delete `Dockerfile:21` (`AUTOSHOW_DOCKER_IMAGE`), keeping `:22` which is load-bearing. Fix the help flag-group catalogs: drop three group keys no flag claims, add `fal-video` so fal.ai video flags stop rendering ungrouped, and rename `CONFIG_COMMAND_HELP_FLAG_GROUPS` — it is the global ordering for every command, which is exactly why nobody noticed the drift.

**Deferred within this wave.** The `.gitignore` `input/` allow-list needs a decision before it can be fixed: lines 8-33 are inert, so which fixtures ship is decided entirely by what was force-added to the index, and `input/examples/comic/` is silently untracked. Decide the intended committed-fixture set first, then express it — either working negation chains (`input/*` + `!input/examples/` + per-subdir `!…/**`) or drop the negations and rely on explicit force-adds. The `anthony-voice.mp3` "committed fixture" doc claim resolves the same way.

---

### Wave 12 — Close the audit

**Goal.** This document is not finished, and shipping Waves 6-11 does not finish it. Two gaps remain.

1. **Run the naming and vocabulary lens.** It never executed — the agent died on a spend limit before returning. Territory: superseded error-type names from ADR-006's vocabulary unification, `epub` where the concept is now `chapter`, removed command names (standalone `stt`/`ocr`) lingering in comments and log strings, old artifact filename conventions from before ADR-010's ordinal-first move, and renamed providers. Classify each hit as live domain term or residue, and separate pure renames from those needing a stored-config or artifact migration.
2. **Run skeptic passes over the five unverified lenses** — dead exports, model catalogs, docs drift, infra/tooling, ADR drift. Roughly 50 findings currently rest on a single agent's unchallenged word. In the six lenses that *did* get a skeptic, 15 of 49 findings were downgraded or refuted — call it a 30% error rate on unreviewed findings. Expect a similar correction rate here, and expect the corrections to be in scope and severity rather than outright refutation.

Do both before treating this document as a complete picture. Then re-triage: some §7 decisions will have answered themselves once the earlier waves land, and Wave 9's lead item may well shrink from a rewrite to a deletion.

**Exit criteria.** Every finding carries a `[verified]` mark, or has been explicitly retired.

---

## 11. Verification bar

Per change: `bun run check`, then the no-cost smoke set (`cli-help-contracts`, `cli-usage-errors`, `option-resolution-contracts/`).

`bun test test/test-cases/validation/` is now fully green — 1240 pass, 0 fail. The standing allowance for "expect exactly the three pre-existing failures" is withdrawn; treat any failure as real. Ten failures were cleared on 2026-08-07 alongside Wave 10 (they were unrelated to it — all were drift left behind by the model-refresh commits):

- `hasGeminiImageSignal` still required the `-image-preview` suffix ADR-019 retired, so the classifier was blind to availability failures from every currently selectable Gemini image model.
- Six URLs were duplicated across categories in `assembly.json`, `gemini.json` and `together.json`, breaking the one-URL-one-section partition that makes `links --provider <section>` meaningful. Fixed in the registry, not the assertion — the STT copies were deleted, keeping each URL's pre-existing canonical owner.
- The `links` fixture constants are hand-maintained mirrors of those registries and had drifted badly (Gemini's Models section, Grok's capability split, Kimi's k3 pages, OpenAI/Claude additions). Regenerated from production output. **These will drift again on the next model refresh** — they want a generator, or a refresh-workflow step. That is the same duplicate-a-registry-by-hand mechanism §1 identifies as the root cause of the Wave 6 defects, and it is still live here.
- Fixing `GROK_ALL_LINKS` unmasked a stale assertion that `links --grok stt` is rejected. Grok STT is a real provider, so the assertion would have failed *and* performed a live network fetch; it is now a positive assertion plus a rejection on `ocr`, a section Grok genuinely lacks.
- `docs/benchmarks/ocr/combined-comparison-report.{json,md,html}` had never been committed. Regenerated with the local-only aggregator (`.codex/skills/consensus/scripts/ocr/build_combined_report.ts`) — it reads only committed per-run reports and makes no provider calls.
- `docs/benchmarks/summary.md` was stale for `tts` (60 → 84 rows) and `url` (2/12 → 7/37), plus the whole URL ranking section, which still reported two-run averages. The test's hard-coded grand total was also wrong — 36/568 matched no state that ever existed; the true total is 38/610.
- The setup summary table pinned `configured`/`all env vars set`, but ADR-015 deliberately renamed it to `present` with a `(presence only, not validated)` qualifier. Test updated; production is right.

Never run paid-provider commands to verify a finding in this document. Several items cite paid e2e suites as pins — those are read-only citations, not instructions to execute. The model-catalog findings in particular were produced without calling any provider API, so any claim about provider-side model retirement is a catalog-consistency observation, not a confirmed fact.
