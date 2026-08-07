# Legacy and Backwards-Compatibility Audit

Date: 2026-08-06. Scope: all of `src/`, `test/`, `scripts/`, `package.json`, `Dockerfile`, and supporting config. Method: an 18-agent audit — eight parallel area sweeps, an adversarial verification pass per area that attempted to refute each finding as load-bearing, and a completeness critic that swept for missed patterns, followed by a second verification pass on the critic's finds. Every item below was independently confirmed against the code, not just pattern-matched. Raw counts: 124 findings, of which 97 were confirmed compat-only, 14 partially legacy (a compat part wrapped around live code), and 13 refuted as load-bearing or misdescribed. Overlapping findings from different sweeps are merged below.

The audit's working definition: a construct is legacy if it exists solely to keep superseded behavior working — old flag spellings, old artifact formats written by earlier versions of this CLI, retired model ids, pre-rename identifiers, or scaffolding left behind by completed migrations. Handling of third-party API shapes, retry/error-recovery design, and generic validation were excluded as current external necessity. Notably, `src/cli/commands/process-steps/step-3-write/structured-output/compat-fallback.ts` is **not** legacy despite its name: it is the live capability fallback for LLM providers without native structured-output APIs (schema embedded in the prompt, validated on response) and must stay.

A recurring pattern throughout is the **tombstone**: code that recognizes a superseded flag/artifact only to throw a tailored migration error. A total break removes these too — old inputs then fail with generic "Unexpected flag" / schema errors instead of guided messages. Each tombstone is marked below; the only cost of removing them is a worse error message for users holding pre-break artifacts.

---

## 1. Renamed and superseded CLI flag surfaces (confirmed — remove)

**1.1 `--url-backend` fallback read** — `src/cli/commands/process-steps/step-1-download/download-targets/build-opts-from-flags/url-options.ts:59`. `resolveUrlOptions` reads the old `url-backend` key as a fallback (`legacyUrlBackendFlag`/`legacySelected`, plus the error-message ternary at line 87). The flag is registered nowhere — the parser already rejects it (`cli-usage-errors.test.ts:348`) — so the branch only fires for programmatically built flags records. Superseded by `--url-provider` (`shared-flags.ts:237`). Remove the fallback and the ternary; `parseUrlBackend` in `options/flag-readers.ts:132` drops its legacy default. Companions: the stale `--url-backend` text in the live pricing note at `src/utils/pricing/aggregate-pricing/article-estimates.ts:76` (reword to `--url-provider`; the surrounding check is current behavior), the historical-report parsing branch at `test/test-runner/reports/context.ts:322` (only attributes old recorded metrics; add `--url-provider` handling when touching it, since the current spelling has no entry at all), and the docs table row in `docs/diagrams/06-end-to-end-reference.md:166`.

**1.2 Hidden un-prefixed STT flag aliases** — `src/cli/flags/shared-flags.ts:163-184`. Four hidden duplicates (`reverb-verbatimicity`, `happyscribe-organization-id`, `supadata-lang`, `scrapecreators-lang`) of the visible `--stt-*` flags, read as `??` fallbacks in `stt-options.ts:78,87,88,94`. ADR-012 itself calls them "their 4 hidden legacy aliases". Verification found two are already non-functional: the `stt-*` counterparts of `scrapecreators-lang` and `reverb-verbatimicity` carry defaults that the parser always materializes, so the fallback never fires for them — typing the old spelling is silently ignored today. Remove the four definitions, the four fallbacks, and `reverb-verbatimicity` from the numeric list at `config-merge.ts:506`. Callers to migrate: `test/test-runner/price-commands/registry/stt.ts:18` (uses `--reverb-verbatimicity`) and the raw-flags fixture in `option-resolution-contracts/download-extract-url-options.test.ts:38,99`. Docs touch-ups: ADR-012:96 and `config.md:76`.

**1.3 Hidden `--gemini-search-grounding` alias** — `src/cli/flags/image-flags.ts:96-102`. Hidden duplicate of `--image-search-grounding` (line 86; rendered `--search-grounding` on the image command), read via the OR at `image-options.ts:60`. No config or internal path sets it; only write/config users typing the old spelling reach it. Remove the definition and the OR arm. Follow-up the audit flagged: `image-target-validation.ts:77` and all eight `*-image-targets.ts` services print `--gemini-search-grounding` in user-facing errors — reword to the current spelling or those errors name a flag that no longer exists. The internal `geminiSearchGrounding` runtime option key is live current code and stays.

**1.4 Per-provider video selector flags** — `src/cli/flags/video-flags.ts:194-229`. Nine user-facing model-selector flags (`--gemini-video` … `--fal-video`) still declared on the standalone video command. These are the pre-generic-selector spellings; the sibling image and music commands already reject their equivalents at parse (`cli-usage-errors.test.ts:342-365` documents the asymmetry: video accepts `--gemini-video` with exit 0). Verification confirmed every current selection path (generic `--provider`, cheapest-default, config injection) writes the internal keys post-parse and needs no declarations — the image command proves it. Delete the nine declarations (keep `provider`/`all-providers`/`provider-concurrency`), update the asymmetry test to expect rejection, and keep everything that names the internal keys (`define-video-command.ts` `VIDEO_PROVIDER_FLAGS`, config-merge injection, test-runner report tables).

**1.5 `--epub-calibre` alias surface** — `src/cli/commands/process-steps/step-2-extract/step-2-ocr/run-ocr.ts:217-231`. Self-described "compatibility alias": it runs the exact same Bun ZIP/XML inspector as `--epub-bun`, only stamping `extractionMethod: 'epub-calibre'`. The flag is not publicly registered; it survives only via programmatic flags records. Remove: the run-ocr branch and dual-engine usage error (169-171), `readBooleanFlag('epub-calibre')` at `ocr-options.ts:100`, the 5-line shim module `ebook/epub/run-epub-calibre-inspect.ts`, the `'calibre'` member of `EpubInspectEngine` (`src/types/ocr-workflow/ocr-types.ts:2`), the `'epub-calibre'` extraction-method enum value (`process-extraction-types.ts:75,124`), and the propagation sites (`document-write.ts:144-145`, `expected-output.ts:96,167`, `resolved-step2.ts:132`, `ocr-artifacts.ts:8`, `ocr-extraction-options.ts:51`, `ocr-resume.ts:200`, `metadata-input-routing.ts:83`, plus type fields). Delete the pinning test `toc-inspection.test.ts:92-99` and the `shared.ts:10,211` re-export. Do not touch the unrelated `'calibre'` conversionChain assertions in `normalizable-ebooks.test.ts` — Calibre is live for mobi/azw normalization and ACSM fulfillment; only EPUB inspection never used it.

**1.6 `--groq-voice` command-surface exposure** — `src/cli/flags/tts-flags.ts:456-458,492`. The lone per-provider option on the TTS command surface that is fully covered by a generic flag (`--tts-voice` / `--tts-voice groq=…`); every other per-provider group exposes only options with no generic equivalent. It appears nowhere in docs (the Groq docs teach `--tts-voice troy`). Remove the exposure; the internal `groq-voice` flag slot, `groqVoice` config key, and the `target-validation.ts` error strings all survive unchanged (the errors fire from the internal slot and trigger via `--tts-voice` too — though rewording them to name `--tts-voice groq=…` is recommended since users cannot type `--groq-voice` afterward). Update `cli-help-contracts.test.ts:293` and switch the Groq e2e/price tests (`groq-canopylabs-orpheus-v1-english-hannah.test.ts`, `cases.ts:64`) to `--tts-voice`.

**1.7 Comic `--page-qa` / `--page-qa-model` aliases and dead `pageQa` fields** — `src/cli/flags/comic-flags.ts:115-126` ("Deprecated alias for --qa") plus case fall-throughs at `cli-args.ts:337,346`. The aliases write directly into `parsed.qa`/`parsed.qaModel`; the `pageQa`/`pageQaModel` option fields (`comic-command-types.ts:43-46,132-133`, `comic-types.ts:74-75`) are never assigned anywhere in src or test, making every `?? options.pageQa` fallback chain (`price-estimate.ts:483,521-522,583,633-635`, `generate-comic-pages.ts:169-170`, `generate-images-command.ts:134-135,149-150`) unreachable dead code. Remove all of it, plus the pure alias constant `DEFAULT_PAGE_QA_MODEL = DEFAULT_QA_MODEL` (`comic-page-qa.ts:9`; consumers in `generate-panel-images.ts`, `generate-comic-pages.ts`, `price-estimate.ts` switch to `DEFAULT_QA_MODEL`). Tests: `comic-options.test.ts:69-72`, `cli-help-contracts.test.ts:725-726`. Docs: `comic.md:264`.

**1.8 `comic character-sketch` compatibility-alias subcommand** — registration at `define-comic-command.ts:104-117`, help at `subcommand-help.ts:93-114` (self-described "Compatibility alias for bun autoshow comic reference-sketch --character"), flags at `comic-flags.ts:158-165,205-208`, parser shim `parseCharacterSketchArgs`/`compatibilityCharacterAlias` at `cli-args.ts:170,193,320-321`. The alias adds nothing over `reference-sketch --character`, which delegates to the identical `characterSketchCommand`. Critical boundary: the `comic-commands/character-sketch/` implementation directory and `CHARACTER_SKETCH_VIEWS` are the core implementation that reference-sketch delegates to — remove only the alias surface. Repoint the error hints that still recommend the alias (`character-utils.ts:122`, `cli-args.ts:185`). Tests: `cli-help-contracts.test.ts:49,750-767`, `comic-options.test.ts:30,549,562-564`. Docs: `comic.md` quickstart/usage and the whole `## character-sketch` section, `docs/commands.md:271`, `docs/diagrams/01-system-overview-cli.md:91`.

**1.9 Comic removed-flag migration stubs (tombstones)** — `cli-args.ts`: eleven superseded spellings recognized only to throw "was removed" errors: `--episode`/`-e` and `--script` (138-142), `--image` (184-185), `--target prompts` via `PANEL_PROMPTS_TARGET_MIGRATION` (35-36, 368-371), `--skip-panel-prompts` (383-384), `--draft-scenes` (385-386), `--episode`/`--scene` in generate-images (403-408), `--panel` (418-419), `--panel-limit` (429-430), `--chunk` (454-455), `--sketch-group-size` (456-457), `--sketch-panels` (458-459). Deleting the case labels drops the inputs into the generic "Unknown argument" error. Tests pinning the messages: `comic-options.test.ts:119-125`, `cli-usage-errors.test.ts:617-618,633-636,760-761,771-772`. Docs: the `comic.md` "Deprecated Options" table (~429-441).

**1.10 Selector-spelling catalogs + resume rejection shim (tombstone, CLI-unreachable)** — `IMAGE_COMMAND_SELECTOR_FLAGS` (`image-flags.ts:32-41`), `VIDEO_COMMAND_SELECTOR_FLAGS` (`video-flags.ts:46-56`), `MUSIC_COMMAND_SELECTOR_FLAGS` (`music-flags.ts:10-14`), and `TTS_COMMAND_SELECTOR_FLAGS` (`tts-flags.ts:39-52`) exist only to feed `assertSelectorFlagsApplyToTarget` in `resume-dispatch.ts` (lines 24-101, 141-158), which throws "--X is no longer supported for resume" for pre-unification selector spellings. Verification proved the shim is unreachable from the real CLI: resume registers none of these flags, so the parser rejects them generically first (verified live — `resume ./dir --openai gpt-5.5` fails with "Unexpected flag: openai" before dispatch), and config merge runs after the assert. Remove the four catalogs, the `INTERNAL/PUBLIC_SELECTOR_FLAGS_BY_KIND` machinery, and the shim; CLI-observable behavior is unchanged. Delete the direct-call unit tests at `resume-provider-surface-contracts.test.ts:413-445`. Keep `STANDALONE_*_PROVIDER_TARGETS`, `config-merge`'s own provider-flag lists, and the test-runner report tables (independent copies that parse historical recorded args).

---

## 2. Old artifact formats: manifests and metadata (confirmed — remove)

**2.1 Legacy `stt`/`ocr` run-manifest tombstone** — `src/cli/commands/process-steps/manifest-utils.ts:10-23`, called from `readRunManifest` (244) and `readBatchManifest` (273). Recognizes run.json/batch.json with kind `stt`/`ocr` (pre-unification of extraction under kind `extract`) and throws "legacy … manifests are no longer supported. Re-run extract". The current kind union cannot produce these values. Removal makes old manifests parse to undefined (treated as absent) instead of the guided error.

**2.2 Extract-batch schema v1 tombstone** — `manifest-utils.ts:25-38`, called from `readExtractBatchManifest` (301). Same pattern for `schemaVersion: 1` extract-batch.json; current writers emit only v2. The shared `UnsupportedArtifactSchemaError` class can only be deleted together with 2.1. Tests pinning both: `manifest-schema-contracts.test.ts:38,55,70` (delete with the guards). Doc touch-up: ADR-006:23.

**2.3 `epubExport` dual-key write and reads** — the writer at `ocr-result.ts:96-97` duplicates the chapter export summary under both the current `chapterExport` key and the legacy EPUB-only `epubExport` key; readers fall back `chapterExport ?? epubExport` at `manifest-log-prompt-usage.ts:52` and `document-write.ts:302`. On current output the fallback can never select a value the primary lacks. Stop the dual write, drop the fallback arms, remove `epubExport` from `ExtractionMetadataSchema` (`process-extraction-types.ts:153`) and `ocr-e2e-metadata-types.ts:39`. Tests to migrate: `ocr-options.test.ts` (7 assertions) and `normalizable-ebooks.test.ts:69,88`. Note `metadata.json` is a user-facing artifact, so external consumers of the old key also see the break.

**2.4 OCR fallback-cache migration from the old output layout** — `process-ocr.ts:20-58`, single call at line 95. Copies `fallback-state.json`/`page-results/`/`page-inputs/`/`partial-extraction.txt` from the pre-download resolved directory (where older runs wrote them) into the current download-derived outputDir. Current runs write fallback state directly to the final outputDir. Self-contained deletion; only consequence is that old-layout caches are ignored (full hosted-OCR re-run instead of page-level resume). No tests cover it.

**2.5 `whisper.cpp` → `whisper` match normalization** — `manifest-log-formatting.ts:46-48`. No current writer emits `whisper.cpp` into any joined manifest field (`transcriptionService` is typed `'whisper'`; all pricing/timing writers use `whisper`); the branch serves only manifests from older versions re-logged via resume. Delete it. Keep the adjacent `llama.cpp` → `llama` branch (43-45): that one reconciles two live current naming domains (see §6.1).

**2.6 Throughput recomputation fallback** — `manifest-log-run-summary.ts:162-173` plus `formatWriteManifestThroughput` (`manifest-log-formatting.ts:74-108`, no other caller). Every current timing writer routes through `withNormalizedTiming`, which persists `throughputValue`/`throughputUnit` for a strict superset of the metrics the recompute handles; the fallback only serves manifests written before throughput persistence. Remove both arms and the helper; throughput-less old manifests render empty speed columns.

**2.7 `costSource` coercion to `registry_fallback`** — `manifest-log-metadata.ts:70-84,117-121`. Any value outside the current 8-member vocabulary is silently rewritten; current writers set `costSource` explicitly on every branch, so the coercion is an identity for fresh manifests. Borderline (doubles as parse robustness since `isCostEntry` does not validate the field): a strict replacement must decide how to render absent/unknown values (`manifest-log-run-summary.ts:159` consumer) rather than just deleting the fallback.

**2.8 Whisper CoreML leftovers** — two small items: the `.pt` checkpoint reclamation line inside the early-return branch of `coremlConvert` (`whisper.ts:~234-239`, commented as reclaiming checkpoints "left behind by installs that predate the cleanup below") — remove the cleanup line only, the early-return itself is load-bearing idempotence; and the two `coreml-encoder-*` legacy filename candidates in `detectCoreMLEncoder` (`run-whisper.ts:26-32`) — verification showed these only affect the `coreml:` descriptor label recorded in metadata (whisper.cpp locates encoders by its own `ggml-*` convention), so removal is label-only.

---

## 3. Retired models and registry aliases (confirmed — remove)

**3.1 `HISTORICAL_TTS_MODEL_REPLACEMENTS`** — `models/model-loader/tts.ts:5-13`. Remaps retired ids (cartesia/sonic-3, sonic-3.5, openai/gpt-4o-mini-tts, speechify/simba-english) to current dated registry ids so old stored metadata still prices. No current path can produce the old ids. Delete the map and `resolveTtsRegistryModel` (inline direct lookup at the four call sites). Tests: `tts-pricing.test.ts:442-446` (pins the aliases — delete), plus fixtures in `grouped-tier-report-contracts/tts-report.test.ts`, `voice-quality-report-contracts/full-mode-audio-judge.test.ts`, `show-note-contracts.test.ts:216` whose priced output degrades to defaults.

**3.2 `HISTORICAL_MUSIC_MODEL_REPLACEMENTS`** — `models/model-loader/music.ts:5-10`. Same pattern for minimax/music-2.6 → music-3.0. Delete with `resolveMusicRegistryModel`; update `image-video-music-pricing.test.ts:340-360` (explicitly titled a historical-artifact contract).

**3.3 `RETIRED_TTS_MODEL_REPLACEMENTS` resume guard (tombstone)** — `resume/generation/tts-resume.ts:12-29`. Matches only the four hardcoded retired ids in stored manifests to emit tailored replacement errors; does nothing for current manifests. Remove with its `assertStoredMissingProvidersAreActive` wiring. Test: `resume-setup-contracts.test.ts:269-307` only — verification corrected the finder here: the adjacent `resume --price` test at line 245 uses the current model id and must stay.

**3.4 `RETIRED_STT_MODEL_REPLACEMENTS` (map only)** — `resume/extract/stt-resume.ts:29-49` plus the `replacementHint` branch (61-63). Boundary drawn by verification: the enclosing `assertStoredMissingSttTargetsAreActive` with its generic active-registry check is live functionality that protects against every future retirement and must stay; only the hint map is legacy. Test split at `resume-additive-provider-contracts.test.ts:345-409`: keep the incomplete-blocks assertions, drop the replacement-string assertions.

**3.5 `RETIRED_GEMINI_IMAGE_MODEL_REPLACEMENTS` / `RETIRED_REVE_IMAGE_MODELS` (tombstone)** — `resume/generation/image-resume.ts:12-33`. Fires only for stored manifests referencing the retired Gemini preview image model or the sunset Reve provider. One governance note: ADR-019 explicitly records the Reve-sunset rejection behavior as accepted design, so removing it should update that ADR. Test: `resume-setup-contracts.test.ts:309-358`. Companion Reve leftovers to sweep together: the `'reve-image'` entry in `test/test-runner/reports/context.ts:58` (comment admits it exists for historical reports), `'reve'` in `adaptive-provider-groups.ts:72`, the `reve-image` config-key mappings at `config-merge.ts:19,396`, and the `ImageProvider | 'reve'` type widening at `process-generation-types.ts:29`.

**3.6 `gemini-3.1-flash-lite-preview` registry aliases** — duplicate registry entries self-described as "Compatibility alias for Gemini 3.1 Flash-Lite" in `models/llm-config.json:228-243` and `models/ocr-config/ocr-gemini.json:100-123`, listed in `SUPPORTED_GEMINI_MODELS` (`llm-models.ts:23`) and `SUPPORTED_GEMINI_OCR_MODELS` (`ocr-models.ts:57`). Because `--all-gemini` expands the full supported list, the same model currently runs twice under two names. Remove the JSON entries and list items; update `provider-expansion-concurrency.test.ts:434,499`, `token-pricing.test.ts:456-463`, and docs (`04-providers-and-setup.md:52`, `write-text.md:189`, `config.md:126,137`, `03-extract-ocr.md:348`). Caveat: checked-in `docs/benchmarks` artifacts recorded the preview id and would misprice on re-report.

---

## 4. Comic pipeline: pre-v4 artifact support (confirmed — remove as one coordinated break)

This is the largest cluster. The current comic pipeline writes only schemaVersion-4 scene/panel artifacts, plural v2 location manifests, and the panel-first workspace layout; everything below exists to read or tolerate what older releases wrote. These items interlock — the schema removals gate the branch removals, and two test suites are built on legacy fixtures — so they should land as one change.

**4.1 Dead legacy scene schemas** [done — Wave 1] — `schemas/schemas.ts`: `LegacyPanelSchema` (107-110), `LegacyScenePromptDataSchema` (195-197), `ReadableScenePromptDataSchema` (198) have zero importers; every scene.json reader parses `ScenePromptDataSchema` (v4) directly. Pure dead code; delete.

**4.2 v2/v3 panel-bundle schemas and branches** — `ReadablePanelBundleDataSchema` (`schemas.ts:202`) unions v4 with `LegacyV3PanelBundleDataSchema` (187-194) and `LegacyPanelBundleDataSchema` (199-201, v2, parsed only to emit a friendlier "not generation-safe" rejection). The v3 compat path flows all the way through generation: the all-v3 merge branch in `buildComicPagePromptData` (`comic-page-utils.ts:268-280`), its exact twin in `buildSketchPromptData` (`generate-scene-sketches.ts:191-203`), and the v3 snapshot-id resolution in `panel-prompt-utils.ts:125-126`. Collapse the readable union to v4 and delete the branches; old bundles then fail the generic schema error and need a `draft-scenes` rebuild. Biggest test blast radius in the audit: `comic-page-anchor-contracts.test.ts` builds its entire page-generation/QA suite on v3 fixtures (line 26) and must migrate to v4, as do `comic-options.test.ts` prompt fixtures and parts of `multi-location-contracts.test.ts`.

**4.3 Widened union types** — `comic-types.ts:54-57` (`ScenePromptData`) and 99-110 (`PanelBundleData`) widen schemaVersion to `2 | 3 | 4` with optional `shotPlan`/`locationKey`/etc. The ScenePromptData widening is fully vestigial (no non-v4 value can inhabit it; it only forces the `schemaVersion === 4` guard at `source-coverage-utils.ts:68`); the PanelBundleData widening carries the v3 compat path. Replace both with the plain v4 inferences after 4.2; the guard and every optional-field fallback simplify away.

**4.4 "legacy single location" / missing-shotPlan prompt fallbacks** — `comic-page-utils.ts:312,334-335,375-376,380`, `generate-scene-sketches.ts:231,243`, `comic-page-qa.ts:235`. The shotPlan fallback text is already dead (shotPlan is required by both v3 and v4; only the widened type forces it); the locationKey fallbacks serve v3 bundles. All become unreachable and deletable once 4.3 lands.

**4.5 Singular location-reference snapshot support** — `location-reference.ts`: legacy singular `assets/location-reference.json` fallback in `loadAndVerifyLocationReferenceSnapshots` (316-318), `LegacyLocationReferenceSnapshot` (231-239), `AnyLocationReferenceSnapshot` (251), `getLocationReferenceSnapshotPath` (252), schemaVersion-1 tolerance in `verifySnapshot` (297), plus the dead singular writer/reader `createLocationReferenceSnapshot` (274-278) and `loadAndVerifyLocationReferenceSnapshot` (321-326) — both zero-caller exports, and the writer is the last producer of the singular format. The duplicate plural-then-singular read in `panel-prompt-utils.ts:108-118` (with v1 tolerance at 131) removes in lockstep. Test: the `legacyRun` block at `multi-location-contracts.test.ts:121-127`. Docs: `comic.md` ~329, ~360.

**4.6 Location sketch manifest v1 migration** — `parseSketchManifest` accepts schemaVersion-1 single-sheet registrations and migrates them in-memory to v2 views (`location-reference.ts:148-171`, `LegacyLocationSketchRegistration` at 49-58). Tighten to v2-only. Blast radius correction from verification: besides the dedicated test (`location-reference-contracts.test.ts:171-179`), the `multi-location-contracts.test.ts:100-111` fixture also writes a v1 manifest and must be rewritten.

**4.7 Legacy sheet-path helpers and filenames** [partially done — Wave 1 removed the dead helpers; the filename tolerance moves to Wave 3, see §11] — the `@deprecated` zero-caller exports `getLocationSheetPath`/`resolveRegisteredLocationSheetPath` (`location-reference.ts:200-204`); and the `--reference-sheet.png` acceptance in `validateReferenceFilename`'s regex (line 84) plus the `.replace()` in `establishingFilename` (190). Boundary: the current snapshot writer still names run-directory sheets `<key>--reference-sheet.png` (line 258, pinned by `multi-location-contracts.test.ts:161`) — that is live naming sharing the same suffix string; do not touch it. Catalogs authoring the old referenceFilename need a one-time rename.

**4.8 `input/episode-scripts` root fallbacks** — `project-paths.ts:9,78-88` (`LEGACY_EPISODE_SCRIPTS_ROOT`, "retaining compatibility with legacy projects") and the independent reimplementation in `location-reference-command.ts:75-88`. Undocumented and untested; collapse both to `input/scripts`.

**4.9 Flat-workspace tombstone** — `scene-run-context.ts:20-35` (`LEGACY_FLAT_ARTIFACTS`, `assertPanelFirstSceneWorkspace`) probes 12 pre-panel-first artifact names to throw tailored migration guidance; it never reads flat workspaces. Delete with its two call sites (85, 107) and the test `comic-workspace-path-contracts.test.ts:62-67`. Boundary: the matching "Flat legacy" sentence inside the `project-paths.ts:28-31` error decorates a load-bearing structural check — remove the sentence only.

**4.10 `'legacy-import'` origin value** — `process-scenes/character-utils.ts:16`. Schema picklist value only ever produced by the removed `--image` import flow. Drop it; switch the fixture at `character-handling-contracts.test.ts:286` to `'generated'`.

**4.11 Page-QA undefined-field tolerance** — `comic-page-qa.ts`: optional fields on `PageQaResult` (18-29) and the `=== undefined` branches in `applyPageQaTolerancePolicy`/`hasHardPageQaFailure`/`getPageQaHardFailureKeys` (149-150, 157, 190, 197) are reachable only through `readReusablePageQaEntry` (279-286), which re-reads persisted page-qa-report.json files from before those fields existed. Make the seven fields required, drop the branches, and validate or version-bump reuse so old-shape entries are discarded. Test fixtures at `comic-page-anchor-contracts.test.ts:282,290,319` need the fields added.

**4.12 `DEFAULT_PANELS_PER_IMAGE` alias** [done — Wave 1] — `comic-page-utils.ts:11-13`, a pure alias of `DEFAULT_SKETCH_PANELS_PER_IMAGE` kept "for compatibility" per its own comment. Rename at all sites (verification found more than the finder: `cli-args.ts:20,438,457`, `comic-flags.ts:15,99`, `generate-scene-sketches.ts:38,43`, `generate-sketches-command.ts:9,27`, `price-estimate.ts:9,679`, and direct imports in `comic-options.test.ts`).

**4.13 `preferSketchRefsOverCanonicalRefs` identity no-op** [done — Wave 1] — `generate-scene-sketches.ts:216-224`. Voids two parameters and returns the third unchanged; name records extinct behavior. Inline at the single call site (281).

---

## 5. Dead scaffolding and re-export shims (confirmed — remove)

**5.1 `canonicalizeProcessCommand` identity** [done — Wave 1] — `process-command-kinds.ts:38-39`. Pure identity with two callers computing an always-equal `displayCommand` (vestige of the retired `stt`/`ocr` command canonicalization). Inline `command` at `handle-process-target.ts:38` and `single-target-runner.ts:38`.

**5.2 `normalizeProviderAliases` identity** [done — Wave 1] — `service-selector-normalization/flag-helpers.ts:66`. `(provider) => provider`; the alias table it implies is empty. Verification found four call sites, not two: `flag-helpers.ts:76,97`, `extract-selectors.ts:42`, `generic-tts-option-selectors.ts:109`. Inline and delete; provably behavior-identical.

**5.3 `resolveExtractEngine` constant selector** [done — Wave 1] — `ocr-engine-selection.ts:2`. Ignores its argument and always returns `'tesseract'`; `LocalExtractOcrEngine` is a single-member union and `engineSuffix` a one-case switch, with the engine parameter threaded inertly through `runPdfOcr`/`runLocalPdfOcr`/`ocrSingleImage`. Inline `'tesseract'` at the four `run-ocr.ts` sites (297, 376, 424, 453) and drop the parameters. Note the type deletion also touches `src/utils/pricing/aggregate-pricing/extract-estimates.ts` (lines 5-7, 44, 51) and `image/image-ocr.ts:3`.

**5.4 Grok base-URL `/chat/completions` suffix stripping** — `write-grok/run-grok.ts:18-20`. Unreachable in every current path: `runGrokModel`'s only binding is via `LLMTarget['run']`, which cannot pass a baseUrl, so the default root URL always flows in. Delete the branch and the unused `baseUrl` parameter. Coordination note: the twin in `grok-ocr.ts` (`resolveGrokOcrBaseUrl`) is pinned by `ocr-contracts.test.ts:~150` and a third copy lives in `run-grok-image-gen.ts:57` — clean those in the same pass or update their tests deliberately, not mechanically.

**5.5 `buildLyricsCues` wrapper** — `step-7-music/lyrics-video/cue-builder.ts:218-231`, token-for-token identical to `buildTranscriptionCues(transcription, LYRICS_CUE_LIMITS)` defined directly above. It is on the live lyrics-video path (sole caller `run-lyrics-video.ts:185`), so the swap must be atomic with the deletion.

**5.6 Stale `--grok` selector hint** — `image-grok/grok-image-targets.ts:44`. Error text tells users to "use --grok grok-imagine-image-quality"; no such flag exists on the image command. Reword to `--provider grok=grok-imagine-image-quality`. No tests pin the message.

**5.7 Old-import-path re-export shims** [done — Wave 1] — four one-line `export * from` files kept so pre-refactor import paths resolve: `step-1-download/audio/audio-yt-dlp-options.ts` and `audio-yt-dlp-binary.ts` (each with exactly one test importer left: `yt-dlp-options-contracts.test.ts:2`, `yt-dlp-passthrough-contracts.test.ts:9`), `download-targets/download-llm-defaults.ts` (two src stragglers: `aggregate-pricing/llm-estimates.ts:2`, `run-text-write.ts:12`), and `download-targets/download-single-target.ts` (one straggler: `stt-batch.ts:10`). Repoint the importers and delete. (The superficially similar `tts/video/music/image` target barrels are **not** in this category — see §8.)

**5.8 `whisper-cpp` PATH probe in benchmarks** — `benchmark/benchmark-services.ts:31`. Gates the local whisper benchmark on `commandExists('whisper-cpp')`, a Homebrew-era binary name referenced nowhere else; the benchmark actually runs the setup-managed `runtime/bin/whisper-cli`. This is dead-legacy verging on a live bug: it skips whisper on correctly set-up machines and wrongly enables it when a stray Homebrew binary exists. Replace with an existence check on `whisperBinaryPath`.

---

## 6. Test-runner and test-side legacy (confirmed — remove)

**6.1 Retired runner flag spellings (tombstones)** — `test/test-runner/args.ts:55-60`: `--test-price` and `--testprice` cases exist only to throw redirects to `--price`. Delete with the pinning test `args-selection.test.ts:41-53`. (The `--concurrency` case at 57 is **not** legacy — see §8.)

**6.2 `rejectLegacyPriceSelectors`** — `test/test-runner/price-commands/resolve.ts:10,28-41,61`. Detects the removed `test/test-price/` path convention (directory no longer exists) to emit migration guidance. Delete with `TEST_PRICE_PREFIX` and the pinning test `price-selection.test.ts:155-163`.

**6.3 `resolvePriceSelection` boolean overload** [done — Wave 1] — `resolve.ts:12-26`. `boolean | ResolvePriceSelectionOptions` parameter kept for the old bare-boolean call signature; production uses only the object form. Narrow the parameter; update the seven `, true)` call sites in `budget-preflight.test.ts` and the `= false` default.

**6.4 Tests that exist only to pin src legacy** — delete each together with its src counterpart (all mapped in sections above): `manifest-schema-contracts.test.ts:38,55,70` (§2.1-2.2), `multi-location-contracts.test.ts:121-127` and `location-reference-contracts.test.ts:171-179` (§4.5-4.6), `character-handling-contracts.test.ts:286` (§4.10), `comic-workspace-path-contracts.test.ts:62-67` (§4.9), `cli-help-contracts.test.ts:750-767` and `comic-options.test.ts:549,562-564` (§1.8), `comic-options.test.ts:69-72,119-125` (§1.7, §1.9), `tts-pricing.test.ts:442-446`, `image-video-music-pricing.test.ts:340-360`, `token-pricing.test.ts:456-463`, `resume-setup-contracts.test.ts:269-307,309-358` (§3), `resume-provider-surface-contracts.test.ts:413-445` (§1.10), `toc-inspection.test.ts:92-99` (§1.5).

**6.5 Pure regression guards (owner's policy call, no src backing)** — these assert that removed things stay removed, over generic error handling: `cli-usage-errors.test.ts:311` (retired `stt`/`ocr` commands), `:342/:550/:557` (removed selector/option aliases, `--out`, pipeline-prefixed aliases), `cli-help-contracts.test.ts:667`, the `tierSplit`/`overallTier` absence guards (`stt-normalization-contracts.test.ts:29-30,215-218` — local constants — and the independent copies in `grouped-tier-report-contracts/shared.ts:42-44` with their three consumers). Deleting them changes no behavior; keeping them enforces the break. Recommendation: keep the cheap ones that enforce this very cleanup (removed-alias guards), delete the ones whose subject no longer exists anywhere. One precision from verification on the combined-report guard loop (`combined-report-weighted-ranking-contracts.test.ts:224-233`): five of its seven names are pure legacy guards, but `balancedComposite` and `thresholds` are live fields of the current consensus library — their absence assertions pin a current no-leak serialization contract and should be kept or re-homed.

---

## 7. Partially legacy — remove the compat part, keep the live part

**7.1 OCR bare `lang`/`out`/`dpi` keys (coordinated migration required)** — `ocr-options.ts:37,74,75` falls back from `format`/`ocr-dpi`/`ocr-language` to the bare pre-rename keys, and `config-merge.ts` both accepts the old spellings in its flag map (~450-452) and — the load-bearing part — injects config-file OCR defaults under exactly those bare keys (255-258), for which the `??` fallbacks are the only conduit into RuntimeOptions. Dropping the fallbacks alone silently breaks `defaults.extract.ocr.*` for current config users. Correct sequence: switch config injection to the prefixed spellings, delete the duplicate map rows and the `dpi` numeric entry (507), then drop the fallbacks. The config file's storage keys (`defaults.extract.ocr.{lang,out,dpi}`) and the internal RuntimeOptions property names can stay or be renamed separately (stored-config migration if renamed).

**7.2 Singular `<provider>ImageModel/VideoModel/MusicModel` fallbacks** — the `options.xModels ?? (options.xModel ? [options.xModel] : [])` pattern in all 20 target collectors (e.g. `gemini-image-targets.ts:29`). The collectors' singular-only branch is unreachable on current paths (every caller populates the plural). But the singular fields themselves are live API for the pricing/cheapest-selection flow (`cheapest-models.ts` builds singular-only options; `video-pricing.ts:281-289` resolves them). Narrow removal: drop the fallback in collectors only. Full break: also migrate pricing callers to single-element arrays and delete the singular fields — a much larger, optional refactor.

**7.3 Two-image character identity cards** — `character-identity-card.ts:97` composes a derived identity card for characters whose catalog declares distinct `image` and `outlineSheet` files; docs call this "the legacy source-plus-sheet layout". Verification refuted "solely compat": the two-file layout is a schema-valid, actively exercised catalog configuration (character-sketch generates and promotes outline sheets into it; revise mode feeds both files). Removing it is a breaking catalog-schema decision (force `image === outlineSheet`), i.e. a feature removal requiring catalog migration — flagging for an explicit product decision rather than including it in the mechanical break.

**7.4 `CLIUsageError` naming** — `src/utils/error-handler.ts`. The compat parts: `AppUsageError` sets `this.name = 'CLIUsageError'` (line 48) and `isCLIUsageError` keeps a name-string arm (147-149) that matches nothing in-process. The live part: the `CLIUsageError(...)` factory (98-101) is the canonical current constructor with ~582 call sites — not removable as legacy. If a full break is wanted, rename the error name and drop the name-string arm (updating `app-error-contracts.test.ts:47` and any stderr matching); leave the factory alone or schedule a separate mass rename.

**7.5 URL combined-report fallback rows** — the finder flagged the old-method distance-row retention test (`url-combined-report-contracts.test.ts:268`); verification showed the underlying retention logic (`build_comparison_report.ts:213-284`) is method-agnostic and serves current artifact-less rebuilds too. Keep the mechanism; the only legacy residue is the superseded `rolling-shingle-approximation` fixture label and mixed-methods note wording.

---

## 8. The TTS multi-speaker cluster (compat-only in design, but gated on prerequisite work)

The audit's most interlocked cluster. The generic dialogue mechanism (`--tts-speaker SPEAKER=VOICE|path` + `--tts-dialogue-format`, SpeakerVoiceRegistry) supersedes an older Gemini-specific surface, but a clean break is currently **blocked by a real gap**: `media-runner.ts` (the write-for-media pipeline) passes `geminiSpeaker*` (113-116) and `ttsSpeakerRefAudios` (104) but never `ttsSpeakers` — so on that pipeline the "superseded" mechanisms are the only ones that work, and `--tts-speaker` is silently dropped today.

The pieces: `legacy-multi-speaker.ts` (`normalizeLegacyMultiSpeakerFlags`, invoked only by `define-tts-command.ts:31,870-873`; confirmed compat-only as a module, with the caveat that its ref-audio folding also papers over a combine-both-flags edge on the tts command); the four `--gemini-speaker-1/2-name/-voice` flags (`tts-flags.ts:250-265,460-465,493` — still the *documented* Gemini multispeaker interface in `text-to-speech.md:232-249`, with live validation errors from `resolveGeminiMultiSpeakerConfig` firing on every gemini tts run); the parallel `GeminiMultiSpeakerConfig` path (`gemini-tts-config.ts:24-72`, shadowed by the registry wherever both exist); the `--tts-speaker-ref-audio` flag (`tts-flags.ts:300-303`) and its four fallback branches (`dialogue-normalizer.ts:106-118,342-344`, `run-multi-speaker-tts.ts:27-29`, `tts-target-selection.ts:39-43`, `input-validation.ts:21-25`) — load-bearing on write-for-media and resume today, and carrying a real semantic difference (forced ref-audio classification vs `detectVoiceKind` heuristics, which misclassify extension-less values like `HOST=clip.opus`).

Recommended sequence for the total break: (1) plumb `ttsSpeakers` through `media-runner.ts` so the generic mechanism works on every pipeline; (2) extend `detectVoiceKind` (or accept the reclassification edge) so `--tts-speaker SPEAKER=path` fully covers forced ref-audio; (3) rewrite the docs section and the Gemini multispeaker e2e test (`gemini-3.1-flash-tts-preview-multispeaker.test.ts`) to the generic flags; (4) then remove the four gemini-speaker flags, `legacy-multi-speaker.ts`, the `GeminiMultiSpeakerConfig` path, `--tts-speaker-ref-audio` and its fallback branches, the config keys (`config-merge.ts:138,149-152,338,349-352`, `config-types.ts:84,96-99`), and the type fields, updating `tts-dialogue-contracts.test.ts:131-167`, `tts-request-controls.test.ts`, `cli-help-contracts.test.ts:294`, `cli-usage-errors.test.ts:582-583`, `resume-provider-surface-contracts.test.ts:68-71`, the price registry, and `resume.md`/`config.md`.

---

## 9. Examined and kept (verified load-bearing — do not remove)

These were flagged as legacy candidates and refuted by the adversarial pass; listed so future sweeps don't re-litigate them.

- **`llama` vs `llama.cpp` naming** (`text-input-utils.ts:89`, `llm-pricing.ts:33-41`, five inline ternaries in pricing/timing/resume). `llama` is the live user-facing namespace (`--llm llama`, `defaults.llm.llama`, registry key) and `llama.cpp` the live internal service id; the coercions are a boundary translation between two current domains, exercised on every local-llama run and pinned by passing tests. Unifying the names is a coordinated rename project, not legacy removal. (The `llm-pricing.ts` special-case block is a foldable simplification — a `SERVICE_ORDER` row `{ service: 'llama', modelKey: 'llamaModels' }` is behavior-identical — but that is cleanup, not compat.)
- **`tts-targets.ts`, `video-targets.ts`, `music-targets.ts`, `image-generation-targets.ts` barrels.** Not stragglers' shims: each is the sole import surface for its module (16, 10, 10, and 13 importers respectively, including each command's own entry points), with essentially no direct-submodule imports anywhere. They are de facto public facades; converting to direct imports is an optional convention refactor.
- **`CLIUsageError` factory** — canonical current API, ~582 call sites (see §7.4 for the narrow name-only cleanup).
- **`fromLegacyCheck`** (`run-doctor.ts:311-321`) — bridges the one probe (`readDefuddleCliReadiness`) still returning the old `CheckResult` shape; runs on every `setup --doctor`. Removable only by first migrating the producer — a refactor, not a deletion.
- **Bare model names in `setup --models`** (`run-model-downloads.ts:48-61`) — the "legacy resolution" comment is misleading; bare names are the first-documented accepted format and the primary UX. Keep.
- **`--concurrency` runner rejection** (`test/test-runner/args.ts:8-11,57-58,78-80`) — never an accepted spelling in this repo's history; it is a live guard against a plausible Bun-flag typo. Keep.
- **`ttsSpeaker` key for `--kitten-voice`** (`tts-options.ts:41`, `config-merge.ts:129,329`) — the sole runtime/config representation of the kitten voice setting, not an alias beside a newer key. Only the name is stale; fixing it is a rename with a stored-config migration.
- **`structured-output/compat-fallback.ts`** — provider-capability fallback for LLMs without native structured output; current external necessity.

---

## 10. Suggested sequencing

Wave 1 (zero-risk deletions, no behavior change) — **implemented 2026-08-06, see §11**: §5.1-5.3 identity no-ops and inert scaffolding, §4.1 dead schemas, §4.7 dead helpers, §4.12-4.13, §5.7 import shims, §6.3.

Wave 2 (flag-surface break) — **implemented 2026-08-07, see §12**: §1 items, §6.1-6.2, plus the §3 retired-model maps and registry aliases. Mostly definition deletions plus test/doc updates; the tombstone removals degrade only old-input error messages.

Wave 3 (artifact-format break): §2 manifest/metadata items and the §4 comic cluster as one change (schemas → branches → types → fallbacks → tombstones, with the v3-fixture test migrations), plus the deferred §4.7 filename tolerance.

Wave 4 (gated work): §7.1 OCR config-key migration, §8 TTS multi-speaker cluster after the media-runner plumbing, and the two explicit product decisions — §7.3 two-image characters and the §7.2 full singular-field break.

Verification bar per wave: `bun run check`, then the no-cost smoke set (`cli-help-contracts`, `cli-usage-errors`, `option-resolution-contracts/`).

---

## 11. Wave 1 implementation record (2026-08-06)

Wave 1 landed in full except for one deliberately deferred half of §4.7 (below). No runtime behavior changed: every removal was an identity function, a zero-caller export, a dead schema, a pure alias, a re-export shim, or a type-level narrowing. No public flag, artifact format, or error message moved.

### Totals

| | Files | Added | Removed | Net |
| --- | --- | --- | --- | --- |
| `src/` | 27 (4 deleted) | 59 | 144 | **−85** |
| `test/` | 5 | 25 | 34 | **−9** |
| **Total** | **32** | **84** | **178** | **−94** |

### Per-item

| Item | Added | Removed | Net | What landed |
| --- | ---: | ---: | ---: | --- |
| §5.1 `canonicalizeProcessCommand` | 5 | 11 | −6 | Deleted the identity; dropped the `displayCommand` local entirely at both callers rather than aliasing `command` to it. |
| §5.2 `normalizeProviderAliases` | 10 | 15 | −5 | Deleted the identity and inlined all four call sites. `selectExtractGenericTargets`'s `rawProviderName` parameter became `providerName` (the two were provably equal), which touched four error strings. |
| §5.3 `resolveExtractEngine` | 29 | 68 | −39 | Largest item. Deleted `resolveExtractEngine` and `engineSuffix`, dropped the inert `engine` parameter from `runPdfOcr`/`runLocalPdfOcr`/`ocrSingleImage` and collapsed their one-case switches, deleted the `LocalExtractOcrEngine` type and the now-unused `assertNever` imports, and inlined `'cbz+tesseract'`/`'image+tesseract'`. |
| §4.1 Dead legacy scene schemas | 0 | 8 | −8 | Deleted `LegacyPanelSchema`, `LegacyScenePromptDataSchema`, `ReadableScenePromptDataSchema`. |
| §4.7 Dead sheet-path helpers | 0 | 4 | −4 | Deleted the two `@deprecated` zero-caller exports only. Filename tolerance deferred — see below. |
| §4.12 `DEFAULT_PANELS_PER_IMAGE` | 20 | 23 | −3 | Renamed to `DEFAULT_SKETCH_PANELS_PER_IMAGE` at all 7 files including the test's direct imports. |
| §4.13 `preferSketchRefsOverCanonicalRefs` | 1 | 17 | −16 | Deleted and inlined to `primaryCharacterReferenceState.primaryCharacterRefs`. |
| §5.7 Re-export shims | 5 | 9 | −4 | Deleted all four one-line files; repointed the five importers (two tests, three src). |
| §6.3 `resolvePriceSelection` overload | 14 | 23 | −9 | Narrowed to `ResolvePriceSelectionOptions` with a `{}` default and collapsed `parseResolveOptions` to an expression body. |

### Deviations from the audit, and why

**§4.7 is half-deferred.** The audit's §4.7 bundles two things: the zero-caller `getLocationSheetPath`/`resolveRegisteredLocationSheetPath` exports, and the `--reference-sheet.png` acceptance in `validateReferenceFilename`'s regex plus the matching `.replace()` in `establishingFilename`. Only the first is a dead-code deletion. Tightening the regex makes catalogs authoring the old `referenceFilename` fail validation — the audit's own "catalogs need a one-time rename" note — which is a behavior change and therefore out of scope for a wave defined as having none. Wave 1's sequencing line also names only "§4.7 dead helpers". The filename tolerance, the `.replace()`, and the `comic.md:61` sentence documenting it now move to Wave 3 with the rest of the §4 comic cluster, where the other old-catalog migrations (§4.5, §4.6) already live.

**§6.3 call sites use the full object, not the bare flag.** The seven `budget-preflight.test.ts` sites became `{ mode: 'budget', budgetSkippableOnly: true }` rather than `{ budgetSkippableOnly: true }`. The deleted boolean form mapped `true` to *both* `mode: 'budget'` and `budgetSkippableOnly: true`; the bare object would have defaulted `mode` to `'price'` and started running `rejectLegacyPriceSelectors` on those paths. Harmless for the current fixtures, but it would not have been a no-op.

**§5.3 keeps the local-OCR exhaustiveness guard.** Deleting `LocalExtractOcrEngine` removed the constraint on `LOCAL_OCR_NOTES` in `aggregate-pricing/extract-estimates.ts`. Replaced with a locally derived `type LocalOcrService = keyof typeof LOCAL_OCR_NOTES`, so `isLocalOcrService` and `buildLocalExtractEstimate` keep the same narrowing without a cross-module single-member union.

### Follow-ups this wave exposed

- `resolvePrimaryCharacterReferencesAcrossPanels` still returns `sketchCharacterRefs` and `canonicalCharacterRefs`, which had only one consumer — the §4.13 no-op that just deleted. Worth checking during the Wave 3 comic pass whether either field has a live reader left, or whether the producer can stop computing them.
- `src/types/ocr-workflow/ocr-types.ts` no longer declares any local OCR engine type. If a second local engine is ever added, reintroduce the union rather than re-threading a parameter.

### Verification

`bun run check` clean. No-cost test set, all passing, no third-party API calls: `cli-help-contracts` + `cli-usage-errors` + `option-resolution-contracts/` (179 tests / 13 files), and the suites covering the touched areas — `validation/comic/`, `validation/ingest/`, `price-selection` (139 tests / 17 files). `budget-preflight.test.ts` was **not** run: it spawns real `--price` CLI subprocesses, so it is left for a run the owner approves.

---

## 12. Wave 2 implementation record (2026-08-07)

Wave 2 landed in full: all ten §1 flag-surface items, §6.1-6.2, and all six §3 retired-model items. Unlike Wave 1, this wave changes observable CLI behavior by design — twelve flag spellings and one subcommand now fail at parse instead of being accepted, eleven comic tombstones degrade to the generic unknown-argument error, and five retired model ids no longer price from the registry. No currently-documented invocation lost capability.

### Totals

Wave 2 only (the working tree also carries Wave 1's uncommitted −94):

| | Files | Added | Removed | Net |
| --- | --- | --- | --- | --- |
| `src/` | 65 (1 deleted) | 80 | 622 | **−542** |
| `test/` | 28 | 48 | 333 | **−285** |
| `docs/` | 12 | 38 | 60 | **−22** |
| **Total** | **105** | **166** | **1015** | **−849** |

### Per-item

| Item | What landed |
| --- | --- |
| §1.1 `--url-backend` | Dropped `legacyUrlBackendFlag`/`legacySelected` and the nested ternary; `parseUrlBackend` lost its `flagName` parameter and hardcodes `--url-provider` in its error. Reworded the live pricing note; the historical-report parser at `test-runner/reports/context.ts` now matches **both** spellings (the current one had no entry at all). |
| §1.2 Hidden STT aliases | Deleted the four hidden definitions, the four `??` fallbacks, and the bare `reverb-verbatimicity` numeric entry. Migrated `test-runner/price-commands/registry/stt.ts` and the raw-flags fixture to the `stt-` spellings. |
| §1.3 `--gemini-search-grounding` | Deleted the hidden definition and the OR arm; reworded all ten user-facing error labels to `--image-search-grounding`. The `geminiSearchGrounding` runtime key stays. |
| §1.4 Video selector flags | Deleted the nine `--*-video` declarations; kept `provider`/`all-providers`/`provider-concurrency` and every internal-key consumer. Inverted the asymmetry test so `video --gemini-video` now expects `Unexpected flag: geminiVideo`. |
| §1.5 `--epub-calibre` | Deleted the shim module, the run-ocr branch and dual-engine error, the `RuntimeOptions`/`ExtractionOptions` fields and all three `Pick` key-unions, the `'epub-calibre'` enum member, and six propagation sites. `EpubInspectEngine` is now `'bun'`. Calibre-the-binary (mobi/azw, ACSM) untouched. |
| §1.6 `--groq-voice` | Removed the `tts-groq` exposure group and its help-color/label registrations. Verified `--tts-voice groq=…` reaches `groqVoiceId` on all three surfaces, so no config key was orphaned. Reworded four validation errors to `--tts-voice groq=…`. |
| §1.7 Comic `--page-qa` | Deleted both alias flags, their registration, the two parser fall-throughs, all three `pageQa`/`pageQaModel` type-field pairs, nine unreachable `?? options.pageQa` fallbacks, and the `DEFAULT_PAGE_QA_MODEL` alias (five consumers repointed to `DEFAULT_QA_MODEL`). |
| §1.8 `comic character-sketch` | Deleted the registration, help page, alias flag set, `parseCharacterSketchArgs`, the `compatibilityCharacterAlias` parameter, `CHARACTER_SKETCH_COMMAND`/`_DESCRIPTION`, and `ParsedCharacterSketchArgs`. The implementation directory, `CHARACTER_SKETCH_VIEWS`, `characterSketchCommand` and `character-sketches.json` all stay; `reference-sketch --character` is the sole entry point. |
| §1.9 Comic tombstones | Deleted 14 case labels plus the `--target prompts` check and `PANEL_PROMPTS_TARGET_MIGRATION`. Old spellings now hit `Unknown argument: <flag>`; `--target prompts` hits `Invalid target "prompts"`. |
| §1.10 Selector catalogs | Deleted the four catalogs, `INTERNAL`/`PUBLIC_SELECTOR_FLAGS_BY_KIND`, `assertSelectorFlagsApplyToTarget` and its helpers. Verified live that `resume --gemini-image …` already failed at parse with `Unexpected flag: geminiImage`, confirming the shim was unreachable. |
| §6.1 Runner flag spellings | Deleted the two tombstone arms; the live `--concurrency` typo guard between them stays. |
| §6.2 `rejectLegacyPriceSelectors` | Deleted with `TEST_PRICE_PREFIX` and the orphaned `normalizePathFilter` import — plus the now-inert `mode` option (see deviations). |
| §3.1/§3.2 Historical model maps | Deleted both maps and both resolver functions, inlining `models[model]` at the three TTS and two music call sites. |
| §3.3/§3.5 Resume retired guards | Deleted both map-only assertion functions, the optional `assertStoredMissingProvidersAreActive` hook on `GenerationResumeConfig`, and its three `?.()` call sites — TTS and Image were its only two implementations. Narrowed `Step5Metadata.imageService` to `ImageProvider` and swept the remaining Reve leftovers. |
| §3.4 Retired STT hints | Deleted the hint map and the `replacementHint` ternary only. The enclosing `assertStoredMissingSttTargetsAreActive` and its generic active-registry check stay, with a generic "start a new target with an active `<service>` model" hint. |
| §3.6 Flash-Lite preview alias | Deleted both duplicate registry entries and both `SUPPORTED_*` list members. `--all-llm` and `--all-ocr` now expand to five Gemini targets instead of running the same model twice. |

### Deviations from the audit, and why

**§6.2 also removed the now-dead `mode` option.** Deleting `rejectLegacyPriceSelectors` left `options.mode` with zero readers. Wave 1's §6.3 record explains that the seven `budget-preflight.test.ts` call sites were given `mode: 'budget'` precisely to avoid triggering `rejectLegacyPriceSelectors`; with that gone the reason evaporates. Removed `PriceSelectionMode`, the type field, the default, and all nine call-site arguments.

**§1.6 was implemented as a clean removal, not the re-add the cross-cutting review proposed.** `writeFlags` and `configCommandFlags` derive from `ttsCommandFlags`, so dropping the `tts-groq` group removes `--groq-voice` from write and config too. That is safe only because `--tts-voice` is exposed on all three surfaces and `normalizeGenericTtsOptionFlags` runs on all three before `FLAG_TO_CONFIG_PATH` is applied — verified in `define-config-command.ts:42` and `handle-process-target.ts:194` — so `bun as config --tts-voice groq=troy` still persists `defaults.post.tts.groqVoice`. Re-adding the group to write/config would have been redundant.

**§1.3/§1.2 regression guards naming now-nonexistent flags were deleted, not re-homed.** An initial attempt to re-home `cli-usage-errors.test.ts`'s `--gemini-search-grounding` assertion to `--image-search-grounding` failed immediately: resume legitimately *accepts* `--image-search-grounding`. Per §6.5's rule ("delete the ones whose subject no longer exists anywhere"), the guard and the four bare STT alias entries in `REMOVED_PROVIDER_NAMED_FLAGS` were removed instead.

**§3.5's cost is larger than "a worse error message" for mixed manifests.** Because `reve` is not a key in `IMAGE_MODEL_FIELDS`, `collectImageTargetsForProviders` returns `[]` for it rather than throwing. A Reve-only manifest still refuses up front with "Could not reconstruct targets for missing providers"; a manifest pairing Reve with another incomplete provider now runs that other provider first and exits 2 as still-incomplete. The no-substitution guarantee holds either way, but the up-front abort does not. ADR-019 was amended to state this explicitly rather than restoring a tombstone.

**§1.7's parser coverage was rewritten, not deleted.** `comic-options.test.ts:69-72` was the repo's only coverage of `--qa`/`--qa-model` parsing and the `parsed.qa ??= true` / `parsed.qaModel ??= DEFAULT_QA_MODEL` defaults. It was repointed to the canonical spellings instead of dropped.

**Two ADRs were amended in place**, as §3.5's governance note directs: ADR-019 (Reve sunset behavior) and ADR-016 (the AssemblyAI per-model replacement hint, which §3.4 invalidated and the audit did not flag).

**Doc examples teaching retired ids were corrected.** `config.md` documented `gpt-4o-mini-tts`, `simba-english`, `sonic-3.5`, `music-2.6` and `gemini-3.1-flash-lite-preview` as worked examples. All five are rejected by the current validators, so copying them produced a `CLIUsageError`; they were updated to the live dated ids.

### Defects found by the post-implementation adversarial review, and fixed

- The `--groq-voice` → `--tts-voice` migration of the Groq e2e test dropped the flag token and left `'hannah'` as a stray positional, which the CLI silently ignores — the test would have failed its speaker assertion *after* a billable Groq call. Restored as `'--tts-voice', 'groq=hannah'`.
- `resume.md:189` had `--gemini-search-grounding` mechanically swapped for `--image-search-grounding` in a list of flags resume *rejects*; resume actually registers that flag. Replaced with a genuinely rejected example.
- `comic.md`'s migration paragraph was mechanically rewritten to `reference-sketch --image`, a pairing that never existed. Reworded to name the removed flow.
- `character-sketch-command.ts` and `price-estimate.ts` still printed `comic character-sketch` run headers, price-estimate labels and `--image-model` errors for a subcommand the CLI now rejects. Repointed to `reference-sketch --character`.
- `text-to-music-services.md:137` claimed `music-2.6` "remains readable in historical benchmark results" — true only while `HISTORICAL_MUSIC_MODEL_REPLACEMENTS` existed. Corrected.

### Follow-ups this wave exposed

- **The nine video model validators still label errors with untypeable flags.** `validateGeminiVideoModel` et al. emit `Invalid --gemini-video model "x"`, but after §1.4 that flag is typeable on no surface. Fixing it properly means giving `createModelValidator` a user-facing label distinct from the internal flag key — and the image command has the identical pre-existing wart (`Invalid --gemini-image model …`), so both should move together rather than diverging.
- **The reworded §1.3 errors are still command-inaccurate on the standalone `image` command**, where the flag renders as `--search-grounding`. `--image-search-grounding` is an improvement over the deleted spelling but not yet correct for every surface; a full fix needs the command-local rename map threaded into the message.
- **`test/test-utils/provider-failure-classifiers.ts` has a pre-existing bug unrelated to this wave.** `hasGeminiImageSignal` still requires a `-image-preview` suffix, which commit `0d23c3dd` renamed to `-image`, so `service-test-kit-contracts.test.ts:47` fails. Neither file is touched by Wave 1 or Wave 2 and the classifier's only src import is `stripAnsi`.
- `test/test-runner/price-commands/resolve.ts`'s `parseResolveOptions` is now a one-field passthrough, and `normalizePathFilter` has no cross-module importer left.
- `cli-usage-errors.test.ts` has two identically-named `comic generate-images rejects invalid page selection flags` tests whose assertions are now fully redundant.

### Verification

`bun run check` clean. No-cost test set, all passing, no third-party API calls: the smoke set `cli-help-contracts` + `cli-usage-errors` + `option-resolution-contracts/` (177 tests / 13 files), plus every suite covering a touched area — `validation/cli/` + `validation/comic/` (262 / 23), `validation/comic/` + `validation/resume-manifests/` + `validation/extract-ocr/epub-contracts/` + `validation/reports-pricing/price-mode-contracts/` (288 / 30), and `validation/providers/` + `validation/configuration/` + `validation/ingest/` + the two test-runner contract files (285 pass / 1 fail — the pre-existing `provider-failure-classifiers` failure above).

Live CLI checks, all no-cost: `resume --gemini-image …` rejects at parse (proving §1.10's shim was unreachable); `comic character-sketch` reports `Unknown comic subcommand`; `tts --tts-voice groq=<bad>` reaches the Groq voice validator with the reworded message; `--groq-voice` is absent from `tts`, `write` and `config` help.

**Not run:** `budget-preflight.test.ts` (spawns real `--price` subprocesses) and every e2e service test. §1.2's edit to `test-runner/price-commands/registry/stt.ts` and §1.6's edit to the Groq e2e case both change argv that only those suites exercise, so they are unverified by execution — both were verified by reading the flag surface instead.
