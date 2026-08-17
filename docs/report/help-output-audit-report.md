# CLI Help Output and Flag Cleanup Report

Status: Phases 1–18 and default values unification fully implemented (all paths, symbols, and behavior claims re-verified against source on 2026-08-17)

Date: 2026-08-17

## Compact Historical Summary

AutoShow CLI help accuracy, global flag applicability, default value formatting, and leftover/bakeable flag cleanup were audited across all 55 help surfaces (745 total flag instances across 288 unique flag definitions). All historical recommendations across Phases 1–14 and the Default Values Unification have been implemented and locked under regression test contracts. There is no remaining work in Phases 1–14.

### Summary of Completed Phases (Phases 1–14 & Defaults Unification)

| Phase / Milestone | Status | Key Actions & Architecture Changes |
| --- | --- | --- |
| **Phase 1: Low-Risk Wording & Metadata** | Done | Dropped ineffective `config --price`; removed conflicting `--prompt` `[default: []]`; standardized examples on `bun autoshow`; hid legacy `--panel-video` alias. |
| **Phase 2: Benchmark Removal** | Done | Deleted `benchmark` command tree, voice scoring utilities, types, dedicated tests, and command docs; retained run data and shared pipelines. |
| **Phase 3: Renderer & Dispatch Alignment** | Done | Added `<subcommand>` placeholder in usage; stacked long examples; restricted `--output-dir` to commands creating run directories. |
| **Phase 4: Voice Subcommands & Grouping** | Done | Derived `comic reference-voice` actions from `VOICE_SUBCOMMAND_DEFINITIONS`; reused unified family group headers across commands. |
| **Phase 5: Command Tree Registry** | Done | Registered `COMMAND_DEFINITIONS` in `src/cli/command-definitions.ts`; pinned all surfaces to automated tree-walking help tests. |
| **Phase 6: Global Flag Applicability & Noise Elimination** | Done | Established unified global flag allowlist in `src/cli/native/global-flag-support.ts`; removed `--model-path`; scoped `--characters-root` to `voice`/`comic`; moved cookies to `config` auth properties; scoped `--allow-over-budget` to priced pipeline and generation commands while rejecting on unbudgeted commands; suppressed off-by-default boolean `[default: false]` noise across all 55 surfaces; locked help and rejection contracts. |
| **Defaults Unification: Phase 1–3** | Done | Rephrased `--tts-chunk-concurrency` to `(Grok-only uses 50)` alongside `[default: "30"]` to eliminate double defaults; standardized prose defaults `(default: ...)`; added dynamic ANSI `springgreen` highlighting for prose default values in `src/cli/help-colors.ts`; added a `help-flag-groups` contract that rejects any prose `(default: ...)` annotation on a flag that also carries a parser metadata default. |
| **Phase 7: Leftover & Bakeable Flags** | Done | Removed `setup --repeat`, `--elevenlabs-tts-optimize-streaming-latency`, `--keep-ocr-page-inputs`, and comic mastering flags (`--sample-rate`, `--channels`, `--codec` baked to `48000/2/pcm_s24le`); kept `--prompt-md`. |
| **Phase 8: Intermediate Hosted TTS Audio/Encoding Knobs** | Done | Removed `--deepgram-tts-container`, `--deepgram-tts-bit-rate`, `--deepgram-tts-sample-rate`, and generic `--tts-output-format`, plus the `Deepgram TTS` help group and the now-unreachable `deepgram-tts-encoding` / `speechify-tts-audio-format` / `elevenlabs-tts-output-format` normalization targets, their `TtsRuntimeOptions` / `TtsTargetSelection` fields, per-turn invocation controls, config schema keys, and `FLAG_TO_CONFIG_PATH` destinations. Baked the pre-remaster intermediates: Deepgram `encoding=linear16` + `container=wav`, Speechify `audio_format=wav`, ElevenLabs `mp3_44100_128`. |
| **Phase 9: Synthetic OCR Format Pruning** | Done | Narrowed `OUTPUT_FORMATS` to `['text', 'json']` so `--format` advertises `text\|json` on `extract`, `write`, `resume`, and `config`; deleted the synthetic TSV and pseudo-hOCR writers from `ocr-artifacts.ts` and `url-run-state.ts`; simplified expected-artifact routing in `expected-output.ts`, `document-runner.ts`, and `process-url.ts`; decoupled `OcrOutputFormat` from `OutputFormat`; narrowed the `ExtractionOptionsSchema` and `ExtractOcrDefaultsSchema` picklists; added a `tsv`/`hocr` migration usage error; aligned the option-resolution fallback with the documented `text` default. |
| **Phase 10: Grok Video Server-Side Storage Knobs** | Done | Removed `--grok-video-storage-filename` and `--grok-video-storage-expires-after` from `videoGenFlags` (and therefore from `video`, `write`, and `config`), along with `grokStorageOptionNames`, the `grok-storage` help group in `help-groups.ts` / `help-colors.ts`, the `grokVideoStorageFilename` / `grokVideoStorageExpiresAfter` fields on `VideoRuntimeOptions` and `VideoDefaultsSchema`, their `FLAG_TO_CONFIG_PATH` destinations, and the `media-runner.ts` pass-through. Dropped the `storage_options` payload and the "storage flags require a Grok target" usage guard; Grok now always relies on the temporary `video.url` that AutoShow already downloads to the run directory. |
| **Phase 11: Developer Debug Knobs** | Done | Deleted `--epub-bun` (and all of EPUB inspect mode: the `epub-inspect` help group, `OcrSourceKind`'s `epub-inspect` member, `epubPayload`/`ExtractionMetadata.epub`, the `epub-bun` `extractionMethod`, `isEpubInspectMode`, `validateEpubInspectCommandFlags`, and both `EPUB_INSPECT_*` messages) and `music --keep-tmp`. `.lyrics-tmp` now deletes on success and is retained only on failure. |
| **Phase 12: Provider-Specific TTS Voice Filters** | Done | Removed `--speechify-tts-voice-locale`, `--speechify-tts-voice-gender`, and `--hume-tts-voice-provider`, plus the now-empty `Speechify TTS` and `Hume TTS` help groups. Hume voice resolution is delegated to `--tts-voice`: a UUID is sent as `{id}`, anything else as a `HUME_AI` library name lookup. |
| **Phase 13: Retired-Provider Residue** | Done | Removed the `minimax` video provider target end to end (selection descriptor, `SUPPORTED_MINIMAX_VIDEO_MODELS`/`validateMinimaxVideoModel`, `estimateMinimaxCost`, the five `normalizeMinimax*` helpers, `VideoProvider`/`MinimaxVideoModel`/`MinimaxResolution`/`MinimaxApiResolution`/`MinimaxDurationSeconds` types, `minimaxVideo` config key, and the empty `video-config.json` block), deleted the four orphaned `FLAG_TO_CONFIG_PATH` entries, dropped the stale MiniMax aspect-ratio clause, and made the unknown-provider usage error name the supported providers. |
| **Phase 14: Dead Voice-Creation Flags** | Done | Removed dead creation flags blocked unconditionally by synthesis guard (`--tts-voice-name`, `--tts-consent-name`, `--tts-consent-email`, `--elevenlabs-tts-clone-remove-background-noise`); scoped `--tts-ref-audio` to standalone `tts` for Mistral one-off reference audio; pruned synthesis creation guard and diagnostic types; cleaned up config `RUNTIME_ONLY_FLAGS`, redaction tables, and docs. |

#### Phase 8 Implementation Notes

- **Legacy config keys are schema-rejected, not ignored.** `TtsDefaultsSchema` is a `v.strictObject`, so an `autoshow.config` that still carries `deepgramTtsEncoding`, `deepgramTtsContainer`, `deepgramTtsBitRate`, `deepgramTtsSampleRate`, `elevenlabsTtsOutputFormat`, or `speechifyTtsAudioFormat` now fails validation with an invalid-key error instead of being silently dropped. Users must delete those keys.
- **ElevenLabs kept its lossy intermediate, against the plan's "prefer lossless" note.** Deepgram (`encoding=linear16` + `container=wav`) and Speechify (`audio_format=wav`) both bake to lossless containers. ElevenLabs bakes to `mp3_44100_128` (`ELEVENLABS_TTS_OUTPUT_FORMAT` in `tts-services/tts-elevenlabs/elevenlabs-utils.ts`): its only lossless format at the model's native 44.1 kHz, `pcm_44100`, is gated behind the Pro tier, and the untiered PCM formats are headerless raw streams that the shared chunk pipeline would need custom WAV wrapping to concatenate. Since the final master is 16 kHz mono `pcm_s16le`, the audible gain did not justify an untestable change to a paid provider path. Revisit if the master profile ever widens.
- **Per-turn invocation controls were removed too.** `outputFormat` / `audioFormat` / `encoding` / `container` / `bitRate` / `sampleRate` are gone from `CONTROL_SPECS`, so voice registrations or comic voice snapshots that persisted them in `synthesisSettings.values` will now be rejected as unsupported controls.

#### Phase 9 Implementation Notes

- **`OcrOutputFormat` is no longer an alias of `OutputFormat`.** Tesseract's native stdout modes and the user-facing artifact format were the same type, so narrowing `OUTPUT_FORMATS` would have broken the local OCR path: `buildTesseractOcrFn` in `ocr-utils/page-processor.ts` still requests `tsv` from `ocrImage` on every page to read per-word confidence out of column 11 (`parseTsvConfidence`), and falls back to reconstructing page text from those TSV rows when the plain-text pass returns nothing. `src/types/ocr-workflow/tesseract-utils-types.ts` now declares `OcrOutputFormat = 'text' | 'tsv'` independently. The `hocr` branch in `ocrImage` was dropped because no caller ever requested it; `tessdataHocrConfigPath` is unrelated (a tessdata install probe used by `setup` doctor checks) and stays.
- **`extract.ocr.out: "tsv" | "hocr"` in `autoshow.config` is schema-rejected, not ignored.** `ExtractOcrDefaultsSchema` narrowed to `v.picklist(['text', 'json'])`, so a config carrying either value now fails validation with an invalid-value error. Users must change it to `text` or `json`.
- **The `--format` default fallback was corrected, with no live behavior change.** `buildOcrOptions` previously resolved an absent or unrecognized value to `json` while the flag advertised `[default: "text"]`. Because `native-parser.ts` injects parser metadata defaults into the flag record, `text` was already what every surface that registers `ocrInputFlags` resolved; the `json` fallback was reachable only on commands that never read `out`. The fallback now reads `text` on both sides.
- **`tsv` and `hocr` fail as a usage error, not a silent downgrade.** `buildOcrOptions` throws `CLIUsageError` naming `text` and `json`, so existing scripts get an exit code 2 and a migration hint instead of an unexpected artifact. Unrecognized values other than those two still normalize to `text` rather than erroring, matching the pre-existing lenient behavior.

#### Phase 10 Implementation Notes

- **Legacy config keys are schema-rejected, not ignored**, same as Phase 8. `VideoDefaultsSchema` is a `v.strictObject`, so an `autoshow.config` still carrying `defaults.post.video.grokVideoStorageFilename` or `grokVideoStorageExpiresAfter` now fails validation with an invalid-key error. Users must delete those keys.
- **The poll-response capture went with the request payload.** `video.file_output` and `video.storage_error` are only populated by xAI when `storage_options` is sent, so their `GrokPollVideoResponseSchema` fields and the `providerFileOutput` / `providerStorageError` metadata writes in `run-grok-video-gen.ts` became unreachable and were deleted. `providerStorageError` had no other producer and was dropped from `Step6VideoMetadata`; `providerFileOutput` stays on the type because Gemini, LTX, and Replicate still write it.
- **Doc examples moved off the removed spellings.** `resume.md` used `--grok-video-storage-filename` twice as its stock example of a provider-named flag that `resume` rejects; both now name `--fal-video-generate-audio`, which is still live on `video`/`write`/`config`. The same substitution was made in the `resume-provider-surface-contracts` video test, and `removed-cli-spellings.test.ts` now pins rejection on `video`, `write`, and `config` in addition to `resume`.

### Current Surface Matrix Overview

| Surface Category | Surfaces | Advertised Globals | Notes |
| --- | --- | --- | --- |
| **Root Help** | `bun autoshow --help` | All `GLOBAL_FLAG_DEFINITIONS` | Full capabilities listing; off-by-default boolean `[default: false]` noise suppressed. |
| **Utility / Config** | `config`, `setup`, `links`, `version`, `help` | Universal globals (`--config-path`, `--output-root`, `--bin-dir`, `--color`, logger flags) | `--output-dir`, `--model-path`, `--characters-root`, `--allow-over-budget` hidden and rejected. |
| **Priced Pipelines** | `download`, `extract`, `write`, `resume`, `metadata` | Universal globals + `--output-dir` + `--allow-over-budget` | Scoped run directory and budget management active. |
| **Media Generation** | `tts`, `image`, `video`, `music` | Universal globals + `--output-dir` + `--allow-over-budget` | Scoped run directory and budget management active. |
| **Character & Voice** | `voice` (16 subcommands), `comic reference-voice` (16 subcommands) | Universal globals + `--characters-root` | `--output-dir` and `--allow-over-budget` hidden and rejected. |
| **Comic Generation** | `comic draft-scenes`, `generate-images`, `generate-audio`, `generate-slideshow`, `reference-sketch` | Universal globals + `--characters-root` + `--output-dir` + `--allow-over-budget` | Full workflow capabilities active. |

---

## Multi-Phase Implementation Plan for New Recommendations

This plan stages the removal and consolidation of newly identified candidate flags to further streamline the CLI surface area, eliminate low-value tuning knobs, bake internal engineering defaults, and purge residue from retired providers.

| Phase | Scope | Risk |
| --- | --- | --- |
| ~~**Phase 11**~~ | ~~Remove developer debug knobs (`--epub-bun` and `music --keep-tmp`)~~ — **done** | Low |
| ~~**Phase 12**~~ | ~~Consolidate provider-specific TTS voice filtering flags~~ — **done** | Medium |
| ~~**Phase 13**~~ | ~~Purge retired-provider residue (MiniMax video target, stale config destinations, stale prose)~~ — **done** | Low |
| ~~**Phase 14**~~ | ~~Remove dead voice-creation flags blocked by the synthesis creation guard~~ — **done** | Low |
| ~~**Phase 15**~~ | ~~Merge redundant flags (`--video-size`, `--batch-all`, redispatch spelling, `music --input-dir`)~~ — **done** | Medium |
| ~~**Phase 16**~~ | ~~Config persistence and concurrency surface hygiene~~ — **done** | Low |
| ~~**Phase 17**~~ | ~~Generic media selector consolidation (video audio/reference flags, MiniMax language boost)~~ — **done** | Medium |
| ~~**Phase 18**~~ | ~~Help description and default-convention corrections~~ — **done** | Low |

### Sequencing and Consolidation Notes

- Phase 12 landed alone rather than combined with Phase 14. The overlap the plan anticipated did not materialize: Phase 12 never touched `generic-tts-option-selectors.ts` (see the Phase 12 notes), so the only shared file left for Phase 14 is `tts-flags.ts`. Phase 14 can still land on its own.
- Phase 15's `--batch-all` merge removes one of the six no-destination config flags Phase 16 addresses; land 15 before 16 or fold the overlap into one change.

### Phase 11–18 Implementation Notes

Implemented 2026-08-17. Verified with `bun run check`, `bun t --price` (142/142), and the full targeted local validation test suite.

- **ADR-021 Reconciliation Note**: Following ADR-021 (write generation removal), the `write` command no longer exposes TTS, image, video, or music generation flags/selectors. References throughout this report to `write` generation flags or `write --help` generation surfaces (e.g. `write --video`, `write --tts`, prefixed generation flags appearing on `write --help`) are now moot on `write`; the corresponding flags on `tts`, `image`, `video`, `music`, `config`, and `resume` stand as implemented.

- **Phase 15 Details**:
  - **`--video-size` removal**: Removed `--video-size` across CLI flags, types, runtime options, pricing, and normalization. Simplified `normalizeLtxVideoSize` to accept `(model, resolution, aspectRatio)` and derive resolution/aspect ratio directly.
  - **`--batch-all` removal & `--batch-limit all` support**: Replaced the boolean `--batch-all` flag with `batchLimit: number | 'all'`. Updated option parsing, runtime types, metadata batch routers, download batch processor, command help examples, and markdown documentation.
  - **Redispatch spelling standardization (`--allow-ambiguous-redispatch`)**: Promoted `--allow-ambiguous-redispatch` across all surfaces, retained `--tts-allow-ambiguous-redispatch` as a hidden alias in generic TTS options for backwards compatibility, and simplified error messages and removed ternary branch logic.
  - **`music --input-dir` removal (`music --batch <dir>`)**: Removed `--input-dir` flag and helper validation functions `resolveInputRoot` and `ensureRepoPath`. Updated `music --batch` to accept the directory path directly (`--batch <dir>`), allowing `--audio` and `--captions` to accept any valid path directly via `resolveUserPath`.
  - **Contract and Test Pinning**: Added removed flag spellings to `removed-cli-spellings.test.ts`. Updated CLI help contracts, usage error test cases, and doc flag table contracts.

- **Phase 16 Details**:
  - **Config persistence mappings**: Added real config destinations and schema fields for `--ocr-provider-mode` (`defaults.extract.ocr.providerMode`) and `--music-instrumental` (`defaults.post.music.musicInstrumental`). Omitted per-run inputs and slot-recovery switches (`--music-lyrics-file`, `--prompt-md`, `--allow-ambiguous-redispatch`, `--tts-allow-ambiguous-redispatch`) from `configCommandFlags`.
  - **`--local-concurrency` removed from `tts` and `comic generate-audio`**: Updated `ttsProviderSelectionFlags` and `comicAudioSelectionFlags` to pick only `concurrency-mode` and `provider-concurrency` from `sharedConcurrencyFlags`, aligning them with `image`, `video`, and `music`.
  - **Internal HTTP and preflight engineering knobs marked hidden**: Marked `--url-request-timeout-ms`, `--url-request-attempts`, and `--stt-preflight-concurrency` as `help: { hidden: true }` in `shared-flags.ts`, matching their existing hidden sibling `--url-provider-concurrency`.
  - **Verification and contracts updated**: Added removed config and local concurrency flags to `removed-cli-spellings.test.ts` and `unknown-command-and-flag.test.ts`. Updated `cli-help-contracts.test.ts`, `provider-concurrency-defaults.test.ts`, `config-doc-contract.test.ts`, `config.md`, and `text-to-speech-and-voice.md`.

- **Phase 17 Details**:
  - **Generic Video Flags Consolidation**: Replaced pairwise provider flags (`--replicate-video-generate-audio` / `--fal-video-generate-audio`, `--replicate-video-reference-video` / `--fal-video-reference-video`, `--replicate-video-reference-audio` / `--fal-video-reference-audio`) with generic `--video-generate-audio` (`--generate-audio` on `video`), `--video-reference-video` (`--reference-video` on `video`), and `--video-reference-audio` (`--reference-audio` on `video`).
  - **Help Groups Cleaned**: Removed empty `fal-video` help group and color mapping from `help-groups.ts` and `help-colors.ts`.
  - **MiniMax TTS Language Normalization**: Added `minimax: 'minimax-tts-language-boost'` target to `--tts-language` in `generic-tts-option-selectors.ts` and dropped the provider-specific `--minimax-tts-language-boost` CLI flag from `tts-flags.ts`.
  - **Config and Runtime Types Unified**: Updated `VideoRuntimeOptions`, `EstimateVideoCostOptions`, and `VideoDefaultsSchema` to generic properties `videoGenerateAudio`, `videoReferenceVideos`, and `videoReferenceAudios`, and updated `FLAG_TO_CONFIG_PATH` in `config-merge.ts`.
  - **Target Validation and Callers Updated**: Aligned `replicate-video-targets.ts`, `fal-video-targets.ts`, `run-replicate-video-gen.ts`, `run-fal-video-gen.ts`, `video-mode-validation.ts`, `video-pricing.ts`, `define-video-command.ts`, `generation-estimates.ts`, and `media-runner.ts`.
  - **Docs and Contracts Locked**: Updated `text-to-speech-and-voice.md`, `text-to-video-services.md`, `resume.md`, `removed-cli-spellings.test.ts`, `cli-help-contracts.test.ts`, `video-options.test.ts`, `tts-request-controls.test.ts`, `image-tts-defaults.test.ts`, and `resume-provider-surface-contracts.test.ts`.

- **Phase 18 Details**:
  - **`--replicate-video-multi-prompt` Description Alignment**: Updated flag definition in `video-flags.ts` to reference `--video-duration` and wrapped `replicateOptionNames` in `renameFlags(..., videoCommandOptionNames)` so `--duration` appears on `video --help` while `--video-duration` appears on the prefixed surfaces (originally `write --help`; since ADR-021, `config --help` and `resume --help`).
  - **`--image-count` Prose Default Formatting**: Standardized semicolon default `; default: 1` to standard prose default `(default: 1)` in `image-flags.ts`, matching `help-colors.ts` default colorization rules.
  - **Comic Flags Parser Metadata Defaults**: Migrated static prose defaults `(default: ...)` across `comic-flags.ts` (`concurrency`, `image-model`, `qa-model`, `max-repairs`, `llm-model`, `target`, `panels`, `sfx-concurrency`, `soundscape-timing-policy`, `profile`, `mode`, `delivery-policy`, `pacing-profile`, `untimed-panel-ms`, `fps`, `view`) to parser metadata defaults via `strFlag(desc, defaultVal)`, ensuring unified parser default rendering (`[default: ...]`) across comic help pages.
  - **`--music-duration` Description Cleaned**: Dropped the silent no-op clause `MiniMax currently ignores this flag` from `music-flags.ts`, relying on the existing runtime warning in `run-minimax-music-gen.ts`.
  - **Contracts & Help Suite Locked**: Updated `cli-help-contracts.test.ts` to assert dynamic `--replicate-video-multi-prompt` translation across `video` and `write`, test `--image-count` default notation, and assert omission of the dropped MiniMax music clause.

### Phase 17: Generic Media Selector Consolidation (Archived Specification)

#### Rationale
The Replicate and fal.ai video services expose pairwise-identical provider-prefixed flags for the same concepts, while the precedent for a generic spelling with per-provider validation already exists (`--video-reference-image` is generic and validated per model via `validateVideoMediaReferences`). This is the same consolidation motion as Phase 12, applied to video.

#### Targets
- `--replicate-video-generate-audio` + `--fal-video-generate-audio` → `--video-generate-audio`
- `--replicate-video-reference-video` + `--fal-video-reference-video` → `--video-reference-video`
- `--replicate-video-reference-audio` + `--fal-video-reference-audio` → `--video-reference-audio`
- `--minimax-tts-language-boost` → add a `minimax` entry to the `--tts-language` target table in `generic-tts-option-selectors.ts` (which today covers grok/speechify/cartesia/elevenlabs) and drop the provider-specific flag.

#### Implementation Steps
1. Introduce the generic flags in `video-flags.ts` with per-provider validation in the video target builders (`replicate-video-targets.ts`, `fal-video-targets.ts`), mirroring `--video-reference-image`.
2. Remove the four provider-prefixed flags and their option resolution.
3. Extend the `tts-language` selector table; remove `--minimax-tts-language-boost`.
4. Update video/TTS docs and contracts. Confirm before landing that the provider semantics genuinely align (they were verified concept-identical at audit time); if a divergence is found, keep the provider spelling per the immutable policy.

---

### Phase 18: Help Description and Default-Convention Corrections (Archived Specification)

Low-risk wording fixes in the spirit of Phase 1:

- **`--replicate-video-multi-prompt`** (`video-flags.ts:72`): its description references `--duration`, which exists only on the `video` command's renamed surface, so `write --help` and `config --help` advertised a flag those surfaces reject (the `write` surface is moot since ADR-021; the prefixed spelling now lives on `config` and `resume`). Write the source description against `--video-duration` and let `renameFlags` translate it for `video` (the `--video-size` description already does this correctly).
- **`--image-count`** (`image-flags.ts:40`): ends with `; default: 1` — the only semicolon-form prose default in the flag tree, which the `help-colors.ts` default highlighter does not match. Move it to a parser metadata default (preferred) or the `(default: 1)` form.
- **Comic prose defaults**: `comic-flags.ts` expresses static defaults in prose (`--concurrency (default: 8)`, `--profile (default: default)`, `--sfx-concurrency`, `--fps`, `--target`, `--panels`, `--mode`, and others) while their shared-flag equivalents use parser metadata defaults. Migrate static values to parser defaults for one consistent rendering across surfaces.
- **`--music-duration` MiniMax clause** (`music-flags.ts:11`): "MiniMax currently ignores this flag" documents a silent no-op in help prose; prefer a runtime warning when the flag is set with a MiniMax music target, and drop the clause.

---

## Deferred Candidates (Product Decision Required)

Live code where the case for change rests on a product judgment, not on dead-code evidence; listed so they are not re-discovered from scratch:

- **`voice clone --kind`** (`define-voice-command.ts:820`): self-described "Hidden leftover clone workflow: instant|professional". Hidden, so no help noise; delete only after confirming nothing depends on it.
- **`links runway`** selector for a retired provider (`model-links.ts`): possibly intentional documentation archive.
- **`setup --models` vs `setup --step whisper-model|whisperfile`** (`setup-flags.ts:7-8`): real overlap, but `--step` also covers non-model steps.
- **Generic `--tts-pronunciation`** merging `--minimax-tts-pronunciation` and `--elevenlabs-tts-pronunciation-dictionary-locator`: the value shapes genuinely differ (inline `"omg/oh my god"` rule vs server-side `dictionary_id[:version_id]`), so this likely falls under the "semantics differ — do not collapse" policy.
- **`--tts-dialogue-format`**: mandatory whenever `--tts-speaker` is present and inert otherwise; could become an auto-detected override if screenplay-vs-labeled detection proves reliable.
- **`--ocr-provider-mode fanout|pool`**: live and consumed; candidate for baking to an internal policy only.
- **`music lyric-video` subcommand split**: the `--input-dir/--audio/--captions/--batch/--model/--font` block is a second command wedged into `music`, mutually exclusive with the hosted generation flags (`define-music-command.ts:186-194`); a subcommand would delete the exclusion checks entirely.
- **`--max-cents` dual meaning**: persisted budget on `config` vs per-run audition spend cap on `voice audition`; rename one.

Provider-specific flags with no generic overlap were audited and confirmed keep-as-is: `--minimax-tts-volume/-pitch/-emotion`, `--elevenlabs-tts-stability/-similarity-boost/-style/-use-speaker-boost/-seed`, `--replicate-video-seed/-negative-prompt/-multi-prompt/-multi-clip`. Image and music surfaces expose no provider-named flags.

---

## Policy & Verification Guardrails

### Immutable Policy
- Do not invent generic flags or collapse provider-specific controls when semantics differ.
- Removals are allowed only when a flag is leftover, unused, or bakeable.
- Keep `--prompt-md`.
- Keep `--json` and `--verbose` as documented shortcuts.
- Keep `--bin-dir`, `--config-path`, `--color`, `--output-root`, and logger flags global.
- `--output-root` stays on every command page.
- A flag carries its default in exactly one place: parser metadata (rendered as `[default: ...]`) or prose `(default: ...)`, never both — enforced by the `help-flag-groups` contract.
- Off-by-default boolean flags must not render `[default: false]` — enforced by `cli-help-contracts`.

### Verification Pass Requirements
Every phase must satisfy:
1. `bun run check` (TypeScript typecheck & unique source name checks).
2. `bun t --price` (142 pricing and budget test cases).
3. Contract tests:
   - `bun test test/test-cases/validation/cli/cli-help-contracts.test.ts`
   - `bun test test/test-cases/validation/cli/cli-usage-errors/`
   - `bun test test/test-cases/validation/cli/option-resolution-contracts/`
   - `bun test test/test-cases/validation/cli/help-flag-groups.test.ts`
   - `bun test test/test-cases/validation/cli/doc-command-flags-contract.test.ts`
