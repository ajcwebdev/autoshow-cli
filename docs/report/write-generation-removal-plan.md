# Write Command Generation Removal

Status: implementation plan ready; no code changes in this pass (paths, symbols, and line references verified against the working tree on 2026-08-17, including the uncommitted help-audit edits currently in flight)

Date: 2026-08-17

## Decision

The `write` command currently does too much: beyond its core job (steps 0–3: metadata, download, extract via STT/OCR/URL, LLM writing), it also orchestrates step 4 TTS, step 5 image, step 6 video, and step 7 music generation, and it exposes the entire generation flag wall (Text to Speech, MiniMax/Speechify/Hume/ElevenLabs TTS, Multi-Speaker / Dialogue, Image Options, Video Options, Hosted Music) plus the `--tts`/`--image`/`--video`/`--music` step selectors and the `tts|image|video|music` values of `--all-providers`.

This plan removes all TTS, image, video, and music flags and functionality from `write`. Generation becomes a follow-on invocation of the standalone `tts`, `image`, `video`, and `music` commands against `write`'s output. Everything extract/OCR/STT/URL/LLM/prompt/batch on `write` stays exactly as is. The standalone generation commands, `voice`, `comic`, `resume`, and `config` keep their current capabilities.

Behavioral footguns this removal also eliminates:

- Saved config defaults auto-trigger paid generation on every write run today. `config --tts elevenlabs` persists `defaults.post.tts.elevenlabsTts`, and `mergeConfigIntoRawFlags` injects the whole TTS provider group into every `write` invocation unless a TTS flag is passed explicitly (`src/cli/commands/setup-and-utilities/config/config-merge.ts:45-54`, `99-105`; write runs the merge at `handle-process-target.ts:159`). A user who saved a TTS default for the `tts` command gets speech synthesized (and billed) on every subsequent `write`.
- Generation on `write` is already unreliable by construction: steps 4–7 silently skip whenever write produces more than one LLM output or structured validation fails (`src/cli/commands/process-steps/step-3-write/generation-stage-runner.ts:52-66`), so the combined pipeline only works in the single-LLM happy path anyway.
- `write --price` on document routes over-estimates: the `command === 'write'` pricing branch adds TTS/image/video/music estimates for every input family, but `document-write.ts` never runs generation stages, so a PDF/EPUB/article estimate with `--tts` or `--image` prices work that cannot happen.
- Write resume quietly diverges from the original run: `write-resume.ts` rebuilds cost/timing from steps 1–3 only and calls `writeShowNoteArtifacts` without step 4–7 metadata, so resuming a write run that had generation output erases the generation cost/timing rows and drops the `## Assets` section from regenerated show notes.

## Target Surface After Removal

`write` help retains these groups only: Pipeline Selection (with `--stt`, `--ocr`, `--llm`, `--all-providers stt|ocr|url|llm`, `--all-local stt|ocr|url`, concurrency and `--reasoning-effort`), Batch / Download, Transcription / STT, OCR / Document Extraction, Article Extraction, EPUB Inspect, Writing, and Pricing.

The follow-on workflow replaces the removed one-shot pipeline:

```
# before (removed): one command runs write + TTS
bun autoshow write video.mp4 --llm openai --prompt shortSummary --tts elevenlabs

# after: write produces text, then the generation command consumes it
bun autoshow write video.mp4 --llm openai --prompt shortSummary --rendered-text
bun autoshow tts output/<run-dir>/rendered.md --provider elevenlabs
```

Follow-on parity by command:

- `tts` takes a `.md`/`.txt` file or directory (`define-tts-command.ts:1177-1178`), so `--rendered-text` / `--rendered-out-dir` output feeds it directly. `--tts-allow-ambiguous-redispatch` and all slot-recovery behavior live on `tts` and `resume` and are unaffected.
- `music` takes a prompt or a local `.md`/`.txt` lyrics file (`define-music-command.ts:166`), which pairs with write's lyric-project mode output.
- `image` and `video` take a literal prompt string, not a file (`define-image-command.ts:127-128`, `define-video-command.ts:126-127`). Follow-on usage is `bun autoshow image "$(cat output/<run-dir>/rendered.md)"` or an intentionally authored prompt. See Decision Points for whether to add file-path prompt support later; this plan does not include it.
- `--price` on `write` shrinks to steps 0–3. Generation cost estimation moves to `tts --price`, `image --price`, `video --price`, `music --price`, which already exist.

## Scope Boundaries: What Stays Untouched

The shared machinery is used by the standalone commands, `resume`, `config`, and `comic`, and must not be removed:

- `buildOptsFromFlags` and all its sub-builders (`buildTtsOptions`, `buildImageOptions`, `buildVideoOptions`, `buildMusicOptions`, `download-model-options.ts`, `model-flag-selection.ts`): shared by `tts`/`image`/`video`/`music`/`comic`/`resume` (`define-tts-command.ts:1245`, `define-video-command.ts:175`, `define-image-command.ts:45`, `define-music-command.ts:82`, `generate-audio-command.ts:302`, `resume-dispatch.ts:192`). Write keeps calling it; the write path simply stops consuming the generation fields (type-level narrowing happens in Phase 3).
- Provider target registries (`STANDALONE_TTS/IMAGE/VIDEO/MUSIC_PROVIDER_TARGETS`, the `*_GENERATION_SELECTION` descriptors) in `service-selector-normalization/provider-targets.ts`.
- Pricing engines: `compute-estimated-costs.ts`, `compute-actual-costs.ts`, `compute-processing-time.ts`, `run-step-walk.ts`, `cost-helpers.ts`, `aggregate-pricing/generation-estimates.ts`, `buildTtsEstimates`/`buildTtsTargetEstimates`, and the `command === 'tts'|'image'|'video'|'music'` branches of `buildAggregatedPriceEstimate`. All are exercised by the standalone commands and generation resume.
- `pipeline-manifest.ts`: zero changes. It has no write-generation code — step 4–7 metadata is stored as opaque `JsonObject`, and all TTS-aware manifest machinery is gated on `manifest.command === 'tts'` (or `'comic'`). Old on-disk write manifests containing `step4`–`step7` keys remain readable.
- `resume`: needs no structural change. Resume dispatch is keyed on `manifest.command` (`resume-dispatch.ts:88-109`), write-manifest resume is already step-3-only (`write/write-resume.ts:457-571` runs LLM targets only and rebuilds cost/timing from steps 1–3), and the tts/image/video/music resume paths hard-require their own standalone manifests (`generation-resume.ts:173` throws when `manifest.command !== config.kind`). Resume's prefixed generation flags (`--image-size`, `--elevenlabs-tts-stability`, ...) serve those standalone-kind resumes and stay.
- `config`: keeps the `--tts`/`--image`/`--video`/`--music` default selectors and the prefixed generation option flags. They persist `defaults.post.*`, which the standalone commands consume via their own `mergeConfigIntoRawFlags` calls (`define-tts-command.ts:1195`). Only descriptions reword (Phase 2).
- `comic`: fully independent of write's generation plumbing. It never imports `generation-stage-runner`/`generation-resource-gate` and builds its own resource gate (`generate-audio-command.ts:144,205,445`), calling `step-4-tts`/`step-5-image` services directly.
- `voice` and every `step-4-tts`/`step-5-image`/`step-6-video`/`step-7-music` service implementation, target collector, and artifact-map builder (`collectTtsTargets`, `buildTtsArtifactMap`, `getExpectedImageCount`, ...): shared with standalone commands and resume.
- Step directory numbering (`step-4-tts` ... `step-7-music` under `src/`, `docs/`, `test/`) stays. Renumbering is out of scope; docs reframe the narrative as "write covers steps 0–3, steps 4–7 are follow-on generation commands".

## Phase Overview

| Phase | Scope | Risk |
| --- | --- | --- |
| **Phase 1** | Sever generation execution and pricing from the write runtime (write executes and prices steps 0–3 only) | Medium |
| **Phase 2** | Remove write's generation flag surface, step selectors, and TTS-specific normalization/validation | Medium |
| **Phase 3** | Type-surface narrowing and dead-code sweep | Low |
| **Phase 4** | Test catalog reconciliation and replacement coverage | Low |
| **Phase 5** | Documentation, diagrams, and decision record | Low |

### Sequencing Notes

- Phase 1 lands before Phase 2 so the spend-risk path dies first: once the runtime is severed, neither CLI flags nor config-injected `defaults.post.*` values can start a paid generation stage from `write`, even while the flags still parse. Removing flags first would not close the config-injection path, which bypasses the CLI flag surface entirely.
- Between Phases 1 and 2 the write generation flags parse but do nothing. That window must not ship on its own; land Phases 1+2 in the same PR (separate commits are fine).
- The write-based price-registry entries and three write-based e2e pipeline files move in Phase 1, not Phase 4, because `bun t --price` is part of the default verification pass and would otherwise run `write --music ... --price` invocations whose assertions fail after Phase 1.
- `doc-command-flags-contract.test.ts` couples `docs/commands/process-steps/step-3-write/write-text.md` flag tables to `writeCommand` (`test/.../doc-command-flags-contract.test.ts:28,144`), so the write-text.md table rows (lines 79–80) must be edited in Phase 2 with the flag removal; the full prose rewrite waits for Phase 5.
- Phase 3 runs after 1+2 because the type narrowing is only truthful once no write code consumes the fields.
- This plan builds on top of the uncommitted help-audit working-tree edits (Deepgram TTS trio and `--tts-output-format` already removed from `tts-flags.ts`); do not rebase it onto the last commit without them.

---

### Phase 1: Sever Generation Execution and Pricing from the Write Runtime

#### Rationale

Both write entry points (`process-video.ts` for media, `run-text-write.ts` for text input; `document-write.ts` is already generation-free and is the precedent) call `runGenerationStagesForSingleWrite` and then thread step4–step7 metadata through cost, timing, manifest, show-note, console-summary, and artifact-map plumbing. This phase deletes the stage runner and all of that threading so a write run produces and reports steps 0–3 only.

#### Implementation Steps

1. **Delete the stage runner and its gate.** Remove `src/cli/commands/process-steps/step-3-write/generation-stage-runner.ts` (only callers: `process-video.ts:157`, `run-text-write.ts:192`) and `src/cli/commands/process-steps/step-3-write/generation-resource-gate.ts` (sole source consumer is the runner; the underlying `src/utils/resource-gate` stays for comic and the standalone commands).
2. **`single/process-video.ts`.** Drop the import (line 14), the stage invocation and destructure (157–174), the step4–7 args to `writeShowNoteArtifacts` (178–186), the generation params to `computeWriteCostAndTiming` (195–213), the manifest `step4`–`step7` spreads (233–236), and the generation params to `buildWriteStepSummaries`/`buildWriteArtifactFiles` (253–276).
3. **`step-3-write/run-text-write.ts`.** Drop the generation imports (21–25), the step4–7 blocks in `buildStepSummaries` (77–121), the stage invocation (192–209), show-note args (225–228), TTS/image estimate-target shaping (242–247), the generation inputs to `computeEstimatedCosts` (256–279), `computeActualCosts` spreads (283–287), fallback-timing generation inputs (293–320), `computeActualProcessingTimes` spreads (324–328), manifest spreads (341–344), and artifact-map merges (375–386).
4. **`step-3-write/show-note-artifacts.ts`.** Remove the step4–7 params from `writeShowNoteArtifacts` (269–277), `renderAssetSection` (222–251), the asset splice in `buildShowNoteContent` (253–267, 285–294), and the now-unreferenced `renderAudioAsset`/`renderVideoAsset`/`renderImageAsset` helpers (keep `renderDownloadLink` only if still referenced). `document-write.ts:392-396` and `resume/write/write-resume.ts:545` already call it without generation args.
5. **`single/write-cost-timing.ts`.** Strip `ttsCharacterCount`, `ttsInputText`, the four `attempted*Targets`, and `step4Metadata`–`step7Metadata` from the context plus every downstream use: estimate-target shaping (31–36), `computeEstimatedCosts` generation inputs (58–80), `computeActualCosts` spreads (95–98), fallback-timing inputs (107–133), `computeActualProcessingTimes` spreads (140–143). Companion type: `src/types/download-workflow/write-cost-timing-types.ts:11-20`.
6. **`single/write-step-summaries.ts`** (blocks at 41–83) and **`single/write-artifact-files.ts`** (imports 1–4, merges 40–47), plus their type files `write-step-summaries-types.ts:10-13` and `write-artifact-files-types.ts:10-13`.
7. **`single/media-runner.ts`.** Stop copying generation option fields into `ProcessingOptions` in `buildProcessingOptions`: the `TTS_MODEL_KEYS` pick (line 47), `IMAGE_PRICING_MODEL_KEYS` (91), `VIDEO_PRICING_MODEL_KEYS` (105), `MUSIC_PRICING_MODEL_KEYS` (130), and every per-provider voice/format field in between. Audit whether the key-list imports (12–15) have remaining consumers; keep the lists themselves (pricing/resume use them).
8. **`single/single-target-runner.ts:44`.** `assertWriteOptions` uses `'ttsProviderConcurrency' in opts` as its sentinel. Replace with retained write fields (e.g. `'llmProviderConcurrency' in opts && 'skipLLM' in opts`); note this assert is type-level only, since the shared options builder still materializes the field at runtime.
9. **`download-targets/expected-output.ts`.** Remove the generation collections from both write branches: text-input (136–153) and media (201–219), the `canRunPostGeneration` gates (125, 205), and the collector imports (5–8).
10. **`pricing-orchestration/aggregate-pricing.ts`.** In the `command === 'write'` branch (136–171), keep only `buildLlmEstimates`; delete the TTS/image/video/music blocks including the "TTS estimate omitted: step 4 only runs when write produces exactly one summary" notes; drop the `collectTtsTargets` import (line 5). Delete `estimateTtsCharacterCountFromPrompts` and `ESTIMATED_TTS_CHARACTERS_PER_TOKEN` from `aggregate-pricing/tts-estimates.ts` (write-only; sole caller is this branch). Keep `buildTtsEstimates`/`buildTtsTargetEstimates` and the standalone-command branches untouched. `aggregate-pricing/timing.ts` is step-array-driven and needs no change. Also drop `characterCount`/`ttsInputText` from the `'write'` overload signature (they remain for the `'tts'` overload).
11. **`write-manifest-log/`.** Remove the `isStep4Metadata`–`isStep7Metadata` guards (`manifest-log-metadata.ts:37-52`), the step4–7 summary rows (`manifest-log-run-summary.ts:60-69, 78-111`), and the step4–7 / `entry.step === 'tts'` rows in `manifest-log-prompt-usage.ts` (28–41, 136–175). Callers are write-pipeline-only (`process-video.ts:244`, `document-write.ts:301`, `run-text-write.ts:352`). Old on-disk write manifests keep their `step4`–`step7` JSON keys; resume preserves them verbatim (`generation-resume.ts:537-555`), they just no longer render in the console summary.

#### Tests Updated in This Phase

- `test/test-cases/validation/content-output/structured-output-failure-contracts.test.ts` — imports `runGenerationStagesForSingleWrite` (line 7) and invokes it (line 104) to assert validation failure gates TTS; delete that block with the runner, keeping any LLM-only assertions in the file.
- `test/test-cases/validation/runtime/target-scheduler-contracts.test.ts:5,108` — imports `createGenerationResourceGate` from the deleted gate module; switch to `createResourceGate` from `~/utils/resource-gate`.
- `test/test-cases/price-flag/tts-price/providers.test.ts:29-50` — delete the `write --price omits TTS estimates when multiple LLM providers are selected` test (its subject no longer exists).
- `test/test-cases/price-flag/music-price.test.ts:17-29` — delete the `write --price includes MiniMax music estimate` test; the standalone `music` test stays.
- `test/test-cases/validation/reports-pricing/price-mode-contracts/cli-price-mode.test.ts:103-125` — the `price JSON result omits estimate note fields` test drops its `--tts` args (or is removed if the note fields it guards are gone).
- `test/test-cases/validation/runtime/logging-contracts/reporter-pricing-manifests.test.ts:28` — replace the "TTS estimate omitted" fixture string fed through the reporter.
- `test/test-cases/validation/content-output/show-note-contracts.test.ts:235-302` — delete the `show notes render generated media assets` test along with `renderAssetSection`; re-check the `buildExpectedFilesList('write', ...)` expectations (304–326) after the expected-output trim.
- `test/test-cases/validation/cli/option-resolution-contracts/processing-options-boundary.test.ts` — the matrix rows (60–115) feed generation flags through `buildProcessingOptions` parity and the key-survival assertions (133–141); prune them alongside the `media-runner.ts` trim in step 7 (full fixture narrowing lands in Phase 3).
- Price registries — the write-based image pipeline test is registered in **both** `test/test-runner/price-commands/registry/write.ts:47-49` and `test/test-runner/price-commands/registry/image.ts:8-10`; remove both `exact()` entries. `test/test-runner/price-commands/registry/music.ts:14-22` — delete the two `write ... --music ... --price` price-command entries.
- Delete the three write-based paid e2e files (never run them to verify; deletion only): `test/test-cases/e2e/service/step-5-image-gen-e2e/openai-gpt-image-2-pipeline.test.ts`, `test/test-cases/e2e/service/step-7-music-gen-e2e/elevenlabs-music-v2-pipeline.test.ts`, `test/test-cases/e2e/service/step-7-music-gen-e2e/minimax-music-3.0-pipeline.test.ts`. Replacement standalone coverage is decided in Phase 4. Re-check `test/test-cases/validation/runtime/test-runner-contracts/budget-preflight.test.ts` afterward: the deleted files supplied budget keys (`write-groq-openai/gpt-oss-20b`, `image-openai-gpt-image-2`) whose coverage expectations may shift.
- Unaffected by design (shared engines keep their fixtures): `run-step-walk-contracts.test.ts`, `tts-pricing.test.ts`, `image-video-music-pricing.test.ts`, video provider contract tests, `write-price.test.ts`.

---

### Phase 2: Remove Write's Generation Flag Surface and Selector Normalization

#### Rationale

With the runtime severed, the flags are dead weight: the four step selectors, the `tts|image|video|music` values of `--all-providers`, and the composed generation option groups. The selector normalizer is shared with `config`, which must keep the full seven-step selector set, so the normalizer splits rather than shrinks.

#### Implementation Steps

1. **`src/cli/flags/write-flags.ts`.** Remove the `imageGenFlags`/`musicGenFlags`/`ttsCommandFlags`/`videoGenFlags` imports (20–23), the `writeTtsOptionFlags` derivation (53–61), and the generation spreads in `writeFlags` (83–89: TTS options, image-options, video-options, hosted-music). Rebuild `writePipelineFlags` on a write-only selector subset (`stt`, `ocr`, `llm`). Drop the `batch-concurrency` re-grouping workaround (84–86), which existed only because `ttsCommandFlags` re-declared that flag under its own group.
2. **`src/cli/flags/shared-flags.ts`.** Split `stepProviderSelectorFlags` (35–43): write consumes only `stt`/`ocr`/`llm`; the `tts`/`image`/`video`/`music` selector definitions remain for `config-flags.ts` (which picks them individually at 74–80) with descriptions reworded from "Write pipeline TTS provider[=model]" to config-default phrasing, e.g. "Default TTS provider[=model] persisted for the tts command". Reword `writeAllProvidersFlag` (45–47) to "repeatable for stt|ocr|url|llm".
3. **`src/cli/flags/service-selector-normalization/write-step-selectors.ts`.** Split into a shared implementation with two entry points: the write normalizer keeps `stt`/`ocr`/`llm` in its selector map, drops `tts`/`image`/`video`/`music` from `writeAllProvidersTargets` (17–26), and narrows `writeAllSelectorSteps` to "stt, ocr, url, or llm" (34); a config normalizer keeps all seven selector targets. `define-config-command.ts:40` switches to the config entry point. Note the error-shape change: `--all-providers image` becomes "Invalid --all-providers step" instead of valid, and `--all-local image` shifts from the "does not support step" message to the "Invalid --all-local step" message.
4. **`handle-process-target.ts`.** In the `command === 'write'` block, drop the `normalizeGenericTtsOptionFlags` call (193) and the `assertNoVoiceIdentityWithDialogue` call (210–212) plus their imports (13). Both remain in use for the standalone `tts` command and `config`.
5. **Removed-spelling policy.** Follow the repo's established pattern (benchmark removal, Phase 7 flag removals): removed flags become plain unknown flags (`Unexpected flag: --tts`), pinned by contract tests. No new hint machinery; see Decision Points.

#### Tests Updated in This Phase

- `test/test-cases/validation/cli/cli-help-contracts.test.ts` — in `write and config help expose shared selectors and concurrency flags` (line 396): delete the write-side generation group assertions (424–428), rework the `Hosted Music` anchor arithmetic (437–445 — the flag-ordering check anchors on `'\n  Hosted Music\n'` inside write help and needs a new last-group anchor, not just a deleted line, or `indexOf` returns -1), and the `--tts`/`--image`/`--video`/`--music` selector assertions (452–456); add negative assertions that write help no longer contains those groups. The config-side assertions (429–435) stay. The derived `every help page advertises exactly the flags registered` test (1090–1101) self-adjusts.
- `test/test-cases/validation/cli/option-resolution-contracts/selector-occurrence-differential.test.ts` — drop the four write generation `addCases` lines (60–63) and lower the `>= 400` case-count threshold (70); removing the four groups eliminates 132 of the current 414 cases, so pin around 270.
- `test/test-cases/validation/providers/provider-selection-contracts/generic-selector-normalization.test.ts` — rework the two tests asserting the old `--all-local does not support step "tts"|"image"` messages (164–181, 211–214) to the new invalid-step rejections.
- `test/test-cases/validation/cli/option-resolution-contracts/native-global-args.test.ts:28-31` — same message rework for `all-local: ['image']`.
- `test/test-cases/validation/cli/cli-usage-errors/tts-usage.test.ts:71-77` — delete the `write rejects explicit TTS voice identity combined with dialogue flags` test (write no longer accepts `--mistral-tts*` at all). Verify `option-resolution-contracts/tts-custom-voices/mistral-saved-voices.test.ts:10`, which asserts the same "authorized edge input only for the standalone `tts` command" message, still exercises it through a live non-write caller (standalone tts or resume).
- `test/test-cases/validation/cli/option-resolution-contracts/removed-cli-spellings.test.ts` — add pins that `write` rejects representative removed spellings, e.g. `--tts`, `--image`, `--video`, `--music`, `--tts-voice`, `--image-size`, `--video-mode`, `--music-duration`, `--tts-speaker`, `--elevenlabs-tts-stability`.
- `test/test-runner/adaptive-provider-groups.ts` — remove the write `all-providers` generation groups (325–336) and the `command === 'write'` generation flags (379–386); update the corresponding expectation in `test/test-cases/validation/runtime/adaptive-concurrency-contracts.test.ts:206-236` to the reduced group list, and re-check the `coreValueFlags` enumeration (139–150) against the runner's flag list.
- `test/test-runner/reports/context.ts` — the `FLAG_TO_COMMAND_KIND` entries for `--tts`/`--image`/`--video`/`--music` (16–19) exist to classify write invocations; remove them, and audit the step4–7 metadata readers (279–291, 315–354) for write-sourced usage before touching (standalone manifests may share readers).
- `docs/commands/process-steps/step-3-write/write-text.md:79-80` — remove `--tts`/`--image`/`--video`/`--music` from the selector row and the `tts|image|video|music` values from the `--all-providers` row, so `doc-command-flags-contract.test.ts` stays green.
- `test/test-cases/validation/cli/help-flag-groups.test.ts` — expected to pass unchanged (the generation group keys are still claimed by `tts`/`image`/`video`/`music`/`config`/`resume`); verify no group key was claimed solely by write.

---

### Phase 3: Type-Surface Narrowing and Dead-Code Sweep

#### Rationale

Per the ADR-003 mirroring policy, the type surface should reflect the new boundary: write option types stop admitting generation fields, and write-only generation glue types disappear. Shared types stay because standalone commands and resume still use them.

#### Implementation Steps

1. **`src/types/cli-surface/cli-types.ts`.** Narrow `WriteRuntimeOptions` (110–124): drop `TtsRuntimeOptions`, `ImageRuntimeOptions`, `MusicRuntimeOptions`, `VideoRuntimeOptions`, and `GenerationSchedulingOptions` (write keeps the ramp coordinator for STT/OCR/LLM through `LlmRuntimeOptions`, which already includes `HostedConcurrencyRuntimeOptions` at `cli-types.ts:27`; what it loses is `ttsProviderConcurrency`/`ttsChunkConcurrency`/`generationResourceGate`/`hostedTtsChunkScheduler`). Narrow `ExpectedOutputOptions` (96–108), which only intersected the four generation option types to feed the now-deleted expected-output branches. Leave `CommandPricingOptions` (82–94) intact — it describes the shared pricing inputs used by the standalone command branches. The per-workflow `generationResourceGate` fields in `tts-types.ts`/`image-types.ts`/`video-types.ts`/`music-types.ts` stay — the standalone runners own them.
2. **`src/types/pipeline-core/process-options-types.ts`.** Drop `ProcessingTtsOptions` (26–30) and the `Partial<ImageRuntimeOptions>`/`Partial<VideoRuntimeOptions>`/`Partial<MusicRuntimeOptions>` members of `ProcessingOptions` (51–54).
3. **Delete `src/types/generation-core/generation-stage-runner-types.ts`** (`GenerationStageOptions`, `GenerationStageRunResult`) and its re-export in `src/types/index.ts:26`. The rest of `generation-core/` (hosted-concurrency, provider-lane, scheduler types) is shared and stays.
4. **Verify the Phase 1 type-file edits** landed: `write-cost-timing-types.ts`, `write-step-summaries-types.ts`, `write-artifact-files-types.ts` carry no step4–7 fields.
5. **Sweep for orphans.** After 1–2, grep for now-unreferenced exports and delete write-only leftovers, at minimum: `buildEstimatedTtsTargets` (audit — resume/tts standalone may still use it), asset renderers in `show-note-artifacts.ts`, any `runWithLogContext({ step: 'step-4-tts' })`-style write-context constants. `bun run check` (unique-source-name check + `tsc --noEmit`) is the backstop.
6. **Manifest typing.** Write manifests no longer emit `step4`–`step7`; standalone manifests keep `Step4Metadata`–`Step7MusicMetadata` (shared types, untouched). Audit any write-manifest record type that names those keys; historical manifests with the keys remain readable because resume treats metadata as an opaque spread.
7. **Test alignment.** `test/test-cases/validation/cli/option-resolution-contracts/processing-options-boundary.test.ts:152-153` compares `buildAggregatedPriceEstimate('write', ...)` across option shapes and needs its option fixtures narrowed with `ProcessingOptions` (the matrix-row pruning already landed in Phase 1).

---

### Phase 4: Test Catalog Reconciliation and Replacement Coverage

#### Rationale

Phases 1–2 delete or rework every failing test in place. This phase closes the catalog-level gaps: coverage that existed only through the write pipeline, and ledgers that enumerate the suite.

#### Implementation Steps

1. **Replacement e2e coverage decision.** The deleted write-based pipeline tests exercised OpenAI `gpt-image-2`, ElevenLabs `music_v2`, and MiniMax `music-3.0` end to end. Confirm equivalent standalone `image`/`music` e2e coverage exists in `step-5-image-gen-e2e/` and `step-7-music-gen-e2e/`; where it does not, add standalone-command e2e cases (paid — author them, register them in the price-command registries, but do not execute them as part of this work).
2. **Price-registry balance.** After the Phase 1 registry edits, run `bun t --price` and confirm the write-based price commands are gone and every remaining registry entry maps to an existing test file (`resolvePriceSelection` must not emit orphans).
3. **Ledger updates.** Update `docs/report/test-audit-report.md` if its inventory enumerates the deleted files, and re-run the doc flag contract (`bun test test/test-cases/validation/cli/doc-command-flags-contract.test.ts`).
4. **Full local verification pass** (see Verification Guardrails) across the union of files touched in Phases 1–3.

---

### Phase 5: Documentation, Diagrams, and Decision Record

#### Rationale

The docs currently teach "write optionally continues into steps 4–7" across the diagram files, the command guide, the README, and the write command doc. They must teach the follow-on workflow instead. No doc example anywhere invokes `write` with generation flags, so this phase is prose/table work only.

#### Implementation Steps

1. **`docs/commands/process-steps/step-3-write/write-text.md`.** Beyond the Phase 2 table rows (79–80): delete the Notes entries claiming write accepts post-generation flags and the single-summary generation gate (353–355), and add a short "Generate media from write output" section with the follow-on `tts`/`image`/`video`/`music` examples above.
2. **`docs/commands.md:286`.** Reword the selection-guide sentence ("Use `write` for full summary pipeline with optional TTS/image/video generation...") to the steps-0–3 framing plus follow-on commands.
3. **Diagrams.** `01-system-overview-cli.md` (27, 105, 134–143, 146, 172), `02-input-routing-batch.md` (28, 107–111), `03-processing-pipelines.md` (15, 199), `04-providers-and-setup.md` (68 selector table splits write from config, 129–145 env-var table phrasing like "OpenAI write/OCR/TTS/image", 181), `05-types-and-output.md` (234–245 slice claims), `06-end-to-end-reference.md` (146–157 env-var phrasing), `diagrams.md` (13). Reframe steps 4–7 as standalone follow-on commands; update the write flag-surface listings to STT/OCR/URL/LLM only.
4. **`README.md`.** Reword the `write` orchestration sentence (155), the intro framing (3–5), and the artifact list ("generated speech, image, video, or music files", 248); the command-map table (149–150) already separates write from the Generate group and the examples already use standalone commands.
5. **Prefix-convention references.** `step-5-image/text-to-image.md:55`, `step-6-video/text-to-video-services.md:76`, `step-7-music/text-to-music-services.md:68` say the prefixed spellings live "on `write`, `config`, and `resume`" — drop `write`. `step-5-image/image-tests.md:28` and `step-7-music/music-tests.md:3,37` describe the deleted write-integration e2e cases — rewrite per the Phase 4 replacement decision. `step-9-voice/00-voice-overview.md:87` lists `write` among the synthesis price paths — drop it.
6. **`docs/commands/setup-and-utilities/resume/resume.md`** (17, 34, 47, 121–123, 188) and **`config.md:409`** — adjust the write-plus-generation family framing; behavior is unchanged, wording only.
7. **`docs/release-v0.1.md:393`** — update the composed-`ProcessingOptions` slice claim to the narrowed shape; leave the step-numbering sections as historical record. Other dated artifacts (`docs/report/*.md`, ADRs 002/007/008/013/014/018) stay as historical record.
8. **Decision record.** Add `docs/adr/ADR-021-end-the-write-pipeline-at-step-3.md` recording this decision, its motivation (surface overload, config-default auto-spend, single-summary gating), and its relationship to ADR-002: the six resume domains are unchanged because generation resume was already keyed to standalone manifests, and write's execution surface shrinking to LLM keeps the "every model selectable by an execution command is resume-selectable" rule satisfied with less surface.
9. **Reconcile `docs/report/help-output-audit-report.md`.** Its pending Phases 8, 12, 13, 17, and 18 were written against `write --tts`/`write --video` surfaces existing (e.g. lines 65, 139, 157, 175, 181, 238). Annotate the affected items: portions covering the write surface become moot once this plan lands; the `tts`/`config`/`resume` portions stand.

---

## Decision Points

- **Config selectors (recommended: keep).** `config --tts elevenlabs` and friends persist `defaults.post.*` consumed by the standalone commands, so they survive with reworded descriptions. The alternative — removing generation defaults from `config` too — would orphan the `defaults.post` config section and is not what this decision targets.
- **Migration messaging (recommended: plain rejection).** Repo precedent for removed surfaces is an ordinary unknown-flag error pinned by `removed-cli-spellings.test.ts`; no hint mechanism exists on `NativeUnknownFlagError` today. If a gentler landing is wanted, a follow-up could attach a one-line hint ("generation moved to the tts/image/video/music commands") for removed `--tts*`/`--image*`/`--video*`/`--music*` spellings on `write`, but that is new machinery and deferred by default.
- **File-input prompts for `image`/`video` (recommended: defer).** Write→TTS and write→music have clean file-based follow-ons; write→image/video requires shell substitution because those commands take literal prompt strings. If that friction matters in practice, a later change could let `image`/`video` accept a `.md`/`.txt` path (or `--prompt-file`) the way `tts` does. Out of scope here.
- **Single-command budgeting.** Today `write --price` could estimate an entire write+generation run in one number. After removal, budgeting a combined workflow means two `--price` invocations. Accepted consequence of the decoupling.

## Verification Guardrails

- **Immutable policy:** no paid or quota-limited provider invocations at any phase. All removed e2e/price cases are deleted or re-registered without being executed. Provider commands appearing in docs examples are illustrative only.
- Per-phase pass: `bun run check` plus `bun t --price`, plus the targeted local suites:
  1. `bun test test/test-cases/validation/cli/cli-help-contracts.test.ts`
  2. `bun test test/test-cases/validation/cli/help-flag-groups.test.ts`
  3. `bun test test/test-cases/validation/cli/cli-usage-errors/`
  4. `bun test test/test-cases/validation/cli/option-resolution-contracts/`
  5. `bun test test/test-cases/validation/cli/doc-command-flags-contract.test.ts`
  6. `bun test test/test-cases/validation/providers/provider-selection-contracts/generic-selector-normalization.test.ts`
  7. `bun test test/test-cases/validation/runtime/adaptive-concurrency-contracts.test.ts`
  8. `bun test test/test-cases/validation/content-output/show-note-contracts.test.ts`
  9. `bun test test/test-cases/validation/reports-pricing/price-mode-contracts/`
- Manual spot checks (all free): `bun autoshow help write` shows no generation groups; `bun autoshow write video.mp4 --tts elevenlabs` fails with an unknown-flag usage error; `bun autoshow write <local .md> --text-input --price` prints an LLM-only estimate and an expected-output list without `speech-*`/`generated-*` entries; `bun autoshow config --tts elevenlabs --show`-roundtrip still persists the default; `bun autoshow help tts|image|video|music|resume|config` surfaces are unchanged.
- Full suite (`bun run t`) is explicitly not part of this plan's verification, per repo policy.
