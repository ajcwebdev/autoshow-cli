# Duplication Extraction Report

Date: 2026-08-08. Scope: entire repository (`src/`, `test/`, `scripts/` — ~129k lines of TypeScript in `src/` plus the test suite). The wave plan section below holds the implementation plan — one wave per finding, in the style of the legacy audit's decision series. The first series, waves 1–9 (the nine strictly low-risk entries in the top 15: CLI-1, G-1, TE-1, R-1, S-2, S-3, O-1, T-2, X-2), is fully implemented at an actual 2,020 net lines. A second series, waves 10–14, covers the five largest remaining findings by net lines regardless of risk — X-1 (441 actual, done), T-1 (230 actual, done), S-1 (289 actual, done), TT-1 (145 actual, done), and B-1 (149 actual, done); both series are now fully implemented, bringing the running total to 3,274 actual net lines. The rest of the report is the reference backlog for later passes.

## Method and accounting rules

The analysis combined a token-based clone scan (jscpd: 375 exact clones, ~5,200 duplicated lines) with 17 area/lens analysis agents, and every candidate finding was then re-verified by an independent adversarial agent that read the cited code and re-did the line accounting. All numbers below are **verified net savings**: `lines removed − new helper lines (including signature, types, blanks, braces) − lines added at call sites (imports, calls, adapters)`. Import lines that merge into an existing import from the same module are counted as 0. A finding was only kept if extraction strictly reduces total line count; anything that broke even or required a sprawling config object was rejected (the rejected candidates are listed at the end so a later pass does not re-litigate them).

**Total: ~5,800 net lines removable** (~4.5% of the codebase), across 85 deduplicated recommendations. Verification bar after each change: `bun run check`, plus the targeted local tests named per finding.

## Ranked summary

| ID | Recommendation | Net LOC | Risk |
|---|---|---|---|
| CLI-1 | Flag-definition builders (`strFlag`/`strListFlag`/`boolFlag`) across all flag tables | 551 (actual) | low — **Wave 1 — done** |
| X-1 | One `requireApiKey` env-guard helper for 90 sites across steps 2–7 | 441 (actual) | low-med — **Wave 10 — done** |
| G-1 | Media-generation status-log helpers across all 18 image/video/music runners | 293 (actual) | low — **Wave 2 — done** |
| TE-1 | Shared TTS-contract test lifecycle block (6 test files) | 275 (actual) | low — **Wave 3 — done** |
| T-1 | Invert `RuntimeOptions` vs per-domain `*RuntimeOptionKey` duplication | 230 (actual) | med (mechanical) — **Wave 11 — done** |
| S-1 | Shared STT stage-request helper (retry + fetch + error + metrics) | 289 (actual) | med — **Wave 12 — done** |
| R-1 | Table-driven provider-model-field helpers for the 4 generation resume configs | 180 (actual) | low — **Wave 4 — done** |
| S-2 | Shared STT polling-deadline / resume-probe error builders (7 providers) | 183 (actual) | low — **Wave 5 — done** |
| S-3 | Merge `run-whisper.ts` / `run-whisperfile.ts` into one whisper.cpp core | 135 (actual) | low — **Wave 6 — done** |
| TT-1 | Hosted TTS chunk-pipeline skeleton (8 provider runners) | 145 (actual) | med-low — **Wave 13 — done** |
| O-1 | Seven near-identical `estimate*OcrCost` functions | 143 (actual) | low — **Wave 7 — done** |
| B-1 | Derive config-merge injection ladder from `FLAG_TO_CONFIG_PATH` | 149 (actual) | med — **Wave 14 — done** |
| T-2 | `TtsOptions`/`ImageGenOptions`/`VideoGenOptions` Pick lists → existing key unions | 134 (actual) | low — **Wave 8 — done** |
| S-4 | AssemblyAI + Gladia retry blocks onto the S-1 helper (unblocked — S-1 landed as Wave 12) | 120 | med |
| X-2 | One shared bounded worker pool (6 copies today) | 126 (actual) | low — **Wave 9 — done** |
| O-2 | OCR runner envelope schema + JSON schema + response parser (3 runners) | 95 | low |
| D-1 | `pick()` passthrough for build-opts-from-flags model options | 85 (~165 compact) | low |
| TE-2 | `load-config-schema.test.ts` 85-line literal bound once | 84 | low |
| G-3 | Replicate video runner: shared 18-field options type | 75 | none (type-only) |
| B-2 | Image/video provider-comparison report writers parameterized | 74 | low-med |
| U-1 | url-service scrape-runner skeleton (4 providers) | 70 | low |
| TE-3 | grouped-tier-report tempdir lifecycle (5 test files) | 68 | low |
| S-5 | Shared STT delete-remote-resource cleanup helper | 62 | low |
| CLI-2 | Shared long-flag argv rewriter in service-selector-normalization | 58 | low |
| C-1 | Unify comic grouped panel reference resolution | 57 | low |
| B-3 | cheapest-models: 120-line flag switch → selector map | 57 | low |
| TT-2 | MiniMax TTS reimplements `concatAndConvertToWav` | 56 | low-med |
| S-6 | STT HTTP-error builders + soniox attach/status trio | 56 (folded into Wave 12's 289) | low — **subsumed by Wave 12 — done** |
| G-4 | BFL/Lumalabs image runners: HTTP plumbing quartet | 55 | low-med |
| B-5 | `loadImageRunJson` / `loadVideoRunJson` → generic `loadMediaRunJson` | 54 | low |
| TE-4 | Replace inline fetch recorders with existing `installMockFetch` (4 sites) | 54 | low-med |
| B-4 | OpenAI judge transport shared between image/video benchmarks | 53 | low |
| R-2 | Triplicated manifest preamble in `generation-resume.ts` | 50 | low |
| R-3 | Reuse exported `runCapture` in 3 setup-download files | 49 | low |
| T-3 | pricing-types shared fragments (token-profile cluster, OCR/STT overrides) | 47 | low |
| C-2 | comic `cli-args.ts` per-flag parse helpers | 45 | low |
| S-7 | happyscribe.ts reimports 4 happyscribe-utils helpers | 44 | low |
| W-1 | llama/llamafile stderr download-watch + startup-failure error builder | 43 | low |
| TE-5 | voice-quality judge fixture + tool-call response builders | 42 | low |
| W-2 | llama vs llamafile health-check/poll machinery | 41 | low |
| T-4 | LLM model key list triplication (`ResolvedLLMConfig`/`LLMOptions`) | 40 | low |
| W-3 | `llama-client.ts` / `llamafile-client.ts` are the same file | 40 | low-mod |
| X-5 | transcript-video / lyrics-video path + timestamp helpers | ~40 | low |
| X-3 | `isRecord`: 39 local copies of `src/utils/rest-client.isRecord` | 39 | low |
| T-5 | `Estimate*CostOptions` re-declare ProcessingOptions shapes longhand | 39 | low |
| G-5 | `captions.ts` parseVtt/parseSrt merge | 38 | low |
| M-1 | frontmatter renderObject/renderArray shared branch tree | 38 | low |
| O-3 | OCR type-guard copies (isPageResult/isHostedOcrRun/getUsageNumber) | 36 | low (one flag) |
| U-2 | `runXUrl` result-finalization wrapper (4 providers) | 36 | low |
| TE-6 | links-fetching-retry: 3 near-identical scenario tests | 36 | low |
| TE-7 | Duplicated `write` run.json fixture between two test files | 35 | mod |
| R-4 | `logResumeFull` idiom (6 sites) | 34 | low |
| UT-1 | Single-vs-array step2 handling in `computeActualProcessingTimes` | 34 | low |
| O-4 | hosted-ocr kimi/grok/deepinfra document branches | 33 | low |
| X-6 | `minimaxFetch` glue across TTS/video/music MiniMax runners | 33 | med-low |
| CLI-3 | Root-mode parse-result builder in native-parser | 33 | low |
| X-4 | stt-cli inline Pick duplicates `SttStep2ResolutionOptions` | 32 | low (type-only) |
| D-3 | 36 repeated `first(xModels)` lines in `readRuntimeModelOptions` | 31 | low |
| C-3 | Shared lenient JSON extraction for comic LLM responses | 30 | low |
| R-5 | stt-resume/ocr-resume shared manifest plumbing | 30 | mod |
| UT-2 | extract-timing-steps fallback builders + profile spread | 30 | low |
| O-5 | detection.ts anchor-page best-match skeleton | 29 | low |
| D-4 | batch-executor: identical document/x-space child batch runners | 28 | low |
| TE-8 | grouped-tier cost/timing metadata from providerArtifacts | 27 | low |
| C-4 | Shared comic panel prompt-bundle reader | 26 | low |
| TT-5 | Custom-voice memoization + MIME map (Speechify/ElevenLabs) | 26 | low |
| B-6 | Benchmark entrypoint report/ranking log blocks | 23 | low |
| UT-3 | STT cost-entry block in `computeActualCosts` | 23 | low |
| M-2 | `parseUrl` try/catch predicate idiom (9 sites) | 22 | low |
| UT-4 | `compute*TotalProcessingTimeMs` byte-identical pair | 20 | low |
| C-5 | comic price-estimate single-call LLM printer | 19 | low |
| TT-4 | TTS error-text readers + status/headers error construction | 19 | low |
| U-3 | transcript-video duplicated transcript loading | 18 | low |
| X-8 | `formatBytes` (3 copies) + progress-bar renderer (2 copies) | 18 | low |
| D-5 | expected-output post-generation artifact block | 17 | low |
| D-6 | audio-normalize preserve-candidate predicates | 17 | low |
| M-3 | manifest kind-validation ladder | 17 | low |
| U-4 | provider-registry-selection repeated literal | 17 | low |
| X-7 | `waitForGeminiFile` duplicated in gemini OCR/STT | 17 | low |
| C-6 | comic image-run-stats init + cost formatting reimplementations | 16 | low |
| UT-5 | Anthropic/Mistral REST HTTP-error construction | 16 | low |
| W-5 | run-llama/run-llamafile runner scaffolding | 15 | low |
| UT-6 | `resolveTranscriptionModel` copy-pasted across pricing files | 15 | low |
| O-6 | OCR checkpoint/finalize manifest composition (marginal) | 13 | med |

## Wave plan — waves 1–14 (done)

The plan has two series, one finding per wave, following the convention from the legacy audit's decision series: each wave is a self-contained prescription and passes its verification set (always `bun run check`, plus the named local tests) before the next begins. No wave requires a paid-provider call to implement or verify. The first series — waves 1–9, the nine strictly low-risk entries in the top 15 — is fully implemented; the DONE records below are the authoritative accounting. The second series — waves 10–14 — takes the five largest remaining findings by net lines regardless of risk: X-1 (441 actual), T-1 (230 actual), S-1 (289 actual), TT-1 (145 actual), and B-1 (149 actual); it is now fully implemented as well. Unlike the first series these carried real risk, so each entry states where the risk concentrated and what was re-proven while landing it. The five were independent of each other, with one scheduling nuance that resolved as expected: Wave 12 (S-1) landed, so the backlog finding S-4 is unblocked at its cheaper price (120 lines at zero new helper cost) and S-6 is fully subsumed rather than merely shrunk. The only top-15 entry in neither series is S-4, which stays a finding below; everything ranked below the top 15 also stays a finding for later passes.

Two conventions carry over from the legacy waves. First, re-confirm the cited duplication by re-reading the sites immediately before extracting — line numbers are anchored to commit `1938efc2` and drift as waves land. Second, when a re-read shows two copies differ where this report says they are identical, stop and surface it as a suspected divergence (see the list near the end of this report) rather than silently unifying.

**Wave 1 — Flag-definition builders across all flag tables (CLI-1) — DONE (2026-08-08, actual net 551 lines).** Landed as prescribed: `strFlag(description, defaultValue?)`, `strListFlag(description)`, and `boolFlag(description)` added to `src/cli/flags/flag-utils.ts`, and every convertible entry across the 14 `src/cli/flags/*.ts` tables and `src/cli/global-flags.ts` collapsed to a one-line builder call (`ocr-flags.ts` gained its first flag-utils import). The load-bearing two-branch return in `strFlag` was implemented and commented — an omitted default omits the `default` key entirely, since `native-parser.ts:190` and `help-renderer.ts:65` test `'default' in definition`. Entries with `short:` (help/version/quiet/force/revise), `help:` (url-provider-concurrency), `negatable: true` (color/chapters/qa), `default: []` (prompt), and bare `type: Boolean` (the four replicate/fal video toggles) stayed literal as planned; multi-line template-literal descriptions (video-duration/aspect-ratio/resolution, image-count) kept their continuation lines, which is why actual savings came in at 551 rather than the estimated 578 (792 lines deleted, 241 added including the 20-line builder block). Pre-implementation re-verification confirmed no `typeof <table>` consumer relies on per-entry literal types and both concurrency default constants are strings. Verified: `bun run check` clean; `cli-help-contracts.test.ts` 25 pass; `cli-usage-errors.test.ts` 66 pass; `option-resolution-contracts/` 94 pass as an extra smoke.

**Wave 2 — Media-generation status-log helpers across all 18 runners (G-1) — DONE (2026-08-08, actual net 293 lines).** Landed as prescribed: `logGenStatus(mediaType, provider, model, status, detail?)` and `logGenCompleted(mediaType, provider, model, processingTimeMs, paths, detail?)` added to `generation-command-utils.ts`, and all 47 multi-line `logMediaGenerationStatus(l, {...})` blocks (18 started, 11 poll, 18 completed — re-confirmed against the report's brace-matching scan before extracting) across the 18 image/video/music runners collapsed to one-line calls. The fal image/video one-liners stayed on `logMediaGenerationStatus`, which remains exported and is also still used by the kitten TTS runner and `finalize-tts-run.ts`. The `paths.map((path, index) => ({ artifact: index === 0 ? mediaType : ...}))` derivation reproduces the exact current artifact labels including the single-`[outputPath]` sites, `detail` spreads only when passed, and the three completed blocks that carry a detail (ltx's estimate line, the gemini/replicate video billed-cost estimates) pass it as the trailing argument. Actual savings came in at 293 rather than the estimated 286 (397 lines deleted, 104 added including the 39-line helper block) because 16 of the 18 runners used `l` only for these calls and dropped their now-unused `import * as l` lines (the minimax/gemini music runners still log directly and keep theirs). Verified: `bun run check` clean; `image-provider-rest-contracts.test.ts` 10 pass; `video-provider-contracts/` 19 pass; `music-provider-contracts.test.ts` 6 pass; `media-generation/` 18 pass.

**Wave 3 — Shared TTS-contract test lifecycle block (TE-1) — DONE (2026-08-08, actual net 275 lines).** Landed as prescribed: `setupTtsContractLifecycle()` added to the directory's `shared.ts`, returning `{ makeTempDir }`, and the token-identical module-level block in all 6 test files collapsed to one call line with the identifier merged into each file's existing `./shared` import (`chunking-audio-helpers.test.ts` uses no tempdirs and calls the helper bare). Rather than moving the block verbatim, the helper is built on the `rest-contract-helpers.ts` utilities the block was reimplementing — `snapshotEnv`/`clearEnv`/`restoreEnv` over the same 10-key env list and `createTempDirTracker` for tempdir tracking — with the fetch/sleep capture+restore and hook registration kept in the helper. Actual savings came in at 275 rather than the estimated 265 (325 lines deleted, 50 added including the 37-line helper-plus-imports block in `shared.ts`) because three files dropped their now-fully-unused `node:fs/promises`/`node:os`/`node:path` import lines entirely and the other two narrowed theirs to the names still used (`join`, `writeFile`). Verified: `bun test test/test-cases/validation/providers/tts-provider-contracts/` 36 pass across all 6 files; `bun run check` clean.

**Wave 4 — Table-driven provider-model-field helpers for generation resume (R-1) — DONE (2026-08-08, actual net 180 lines).** Landed as prescribed: `clearProviderModelFields(opts, fields)`, `collectGenerationTargetsForProviders(providers, opts, fields, collect)`, and `buildGenerationPriceOptions(targets, opts, fields)` added to `generation-resume.ts` (with an exported `GenerationModelFieldTable` type for the service→`[modelsField, modelField]` tables), and the four hand-written function sets (`clearXProviderModels`, `collectXTargetsForProviders`, `xModelsForService`, `buildXPriceOptions`) deleted from `image-resume.ts`, `video-resume.ts`, `music-resume.ts`, and `tts-resume.ts` — each file keeps only its `X_MODEL_FIELDS` constant (pre-implementation re-read confirmed the report's key counts: image 16 keys/8 services, music 6/3, video 18/9, tts 24/12). Each file retains a 5-line typed `collectXTargetsForProviders` wrapper (the untyped-arrow alternative would lose parameter inference in the unannotated config literal), and the per-file `priceXTargets` bodies call `buildGenerationPriceOptions` directly. Behavior preserved exactly: the generic clear sets every table field to explicit `undefined` (matching the old spreads under `exactOptionalPropertyTypes`), and the price builder only assigns a `modelsField` when the service has matching targets, reproducing `xModelsForService`'s empty→`undefined` semantics via the already-cleared keys. Accepted trade-off noted in the plan stands: a typo in a FIELDS table is no longer caught by tsc. Actual savings came in at 180 rather than the estimated 184 (244 lines deleted, 64 added including the 52-line helper block) because the retained typed wrappers cost a few more lines than the estimate assumed. Verified: `bun run check` clean; `bun test test/test-cases/validation/resume-manifests/` 43 pass across 4 files.

**Wave 5 — STT polling-deadline / resume-probe error builders (S-2) — DONE (2026-08-08, actual net 183 lines).** Landed as prescribed: `buildAsyncSttPollingDeadlineError(provider, jobId, pollDeadlineMs)` and `buildAsyncSttResumeProbeError(provider, jobNoun, jobId, probeCount, totalWaitMs)` added to `async-lifecycle.ts`, and the 7 copy-pasted builder pairs deleted from rev, speechmatics, assemblyai, gladia, happyscribe, soniox-utils, and supadata-utils. Pre-implementation re-read confirmed all 14 copies identical modulo provider name and job noun (Rev/Speechmatics 'job', AssemblyAI 'transcript', Gladia/Soniox 'transcription', Happy Scribe 'order', Supadata 'transcript job'), and the pre-landing grep found no test depending on the message strings, which are preserved byte-identically. As predicted, the 5 arrow-wrapped call sites absorbed the provider/jobNoun literals at zero line cost and supadata's two point-free references became arrows on the same lines; happyscribe's divergent `buildExportDeadlineError` (stage `'result'`, export wording) stayed local as planned. `RetryClass` imports remain live in all edited files (each has other uses), and the deleted soniox/supadata exports had no other consumers. Actual savings came in at 183 rather than the estimated 170 (241 lines deleted, 58 added including the 34-line helper block) because the estimate undercounted the per-copy blank/separator lines across the 7 sites. Verified: `bun run check` clean; `bun test test/test-cases/validation/extract-stt/` 30 pass across 7 files.

**Wave 6 — Merge run-whisper / run-whisperfile into one whisper.cpp core (S-3) — DONE (2026-08-08, actual net 135 lines).** Landed as prescribed: `stt-local/run-whispercpp-core.ts` created exporting `runWhisperCppTranscribe(audioPath, outputDir, options, provider)` (210 lines), with the provider config extended one field beyond the sketched signature to `{ name, label, tempPrefix, resolveInvocation }` — `label` carries the 'Whisper'/'Whisperfile' message prefixes (retry operationName, both InfraError texts) explicitly rather than deriving them by capitalizing `name`, and `resolveInvocation(modelName, baseArgs)` returns `{ command, args, modelDescriptor }` so each provider owns its platform delta. Pre-implementation re-read confirmed the end-to-end clone and that the deltas were exactly as cited (CoreML lookup + ggml `-m` path vs the `sh` launcher, plus provider strings). run-whisper.ts shrank to 48 lines (`detectCoreMLEncoder` with its lookup cache plus the invocation builder that prepends `-m`/ggml path and assembles the `coreml:` descriptor) and run-whisperfile.ts to 27 (the `sh`-launcher invocation, with the APE-binary and embedded-weights comments preserved inside it). All provider-varying strings are preserved byte-identically: `whisper-json-output`/`whisperfile-json-output` poll names, `stt:whisper`/`stt:whisperfile` stages, segment-lifecycle provider names, and `transcriptionService` values (core `name` is typed to the `'whisper' | 'whisperfile'` union so `Step2Metadata` still typechecks). The cautioned whisper-probe pin needed no retargeting — `benchmark-contracts.test.ts` imports `whisperBinaryPath` directly from `setup/run-complete-setup`, which run-whisper.ts still imports for its invocation builder — and the exported runner signatures are unchanged (now typed via the exported `WhisperCppTranscribeOptions`), so the `dispatch.ts` and `run-lyrics-video.ts` consumers are untouched. Actual savings came in at 135 rather than the estimated 150 (the 420 lines across the two clones became 285) because the exported options/invocation/provider types and the retained comments cost slightly more than the ~195-205-line core sketch assumed. Verified: `bun run check` clean; `benchmark-contracts.test.ts` 4 pass; `extract-stt/` 30 pass across 7 files. Whisper itself was not run; transcription behavior stays covered by the out-of-scope e2e suites.

**Wave 7 — One token-priced OCR cost estimator (O-1) — DONE (2026-08-08, actual net 143 lines).** Landed as prescribed: `estimateTokenPricedOcrCost<TProvider>(provider, validateModel, fallbackInputCostPer1MCents, fallbackOutputCostPer1MCents, modelRaw, input, options, note?)` added same-file (returning `TokenOcrCostEstimate<TProvider> & { note?: string }`, with the note attached via a conditional spread so note-less results carry no `note` key under `exactOptionalPropertyTypes`), and the seven glm/openai/grok/anthropic/gemini/deepinfra/kimi exports collapsed to 6-line wrappers preserving exact signatures with their fallback cents pairs (3/3, 20/125, 125/250, 100/500, 25/150, 9/19, 95/400). Pre-implementation re-read confirmed the seven copies identical modulo validator, provider literal, fallbacks, and note — glm's only textual delta (a multi-line `estimateOcrTokenUsage` options literal where the other six are single-line) is formatting, not a divergence. The five note-bearing wrappers (openai/grok/anthropic/deepinfra/kimi) use the predicted `as Promise<... & { note: string }>` cast; glm/gemini return the helper's promise directly. The wrappers dropped their now-pointless `async` keyword — they are pure call-throughs into the async helper, so rejection behavior (including validator throws surfacing as rejections) is unchanged. `estimateMistralOcrCost` and `estimateFirecrawlScrapeCost` stayed page-priced and untouched, as did all callers. Actual savings came in at 143 rather than the estimated 140 (182 lines deleted, 39 added including the 35-line helper) because the estimate slightly undercounted the wrappers' shrinkage from single-line return-type intersections. Verified: `bun run check` clean; `ocr-pricing.test.ts` 18 pass.

**Wave 8 — GenOptions Pick lists onto existing key unions (T-2) — DONE (2026-08-08, actual net 134 lines, type-only).** Landed as prescribed: `TtsOptions` now picks `TtsRuntimeOptionKey | 'ttsProviderConcurrency' | 'ttsLocalConcurrency' | 'ttsChunkConcurrency'` from `ProcessingOptions`, and `ImageGenOptions`/`VideoGenOptions` pick `ImageRuntimeOptionKey`/`VideoRuntimeOptionKey` directly — pre-implementation re-read confirmed those two unions already carry their domain's concurrency keys, so no extra union members were needed. All three key unions are re-exported through the `~/types` barrel, so each file's existing import line absorbed the union name at zero line cost. Full type equality was re-proven during the migration per the sequencing-notes convention: a temporary guard file held the three old Pick lists verbatim and asserted `AssertEqual<old, new>` in both directions under `exactOptionalPropertyTypes`; `bun run check` passed with the guards in place, then the guard file was deleted and check re-run clean. The intersected `generationResourceGate`/`hostedTtsChunkScheduler` members are untouched and no runtime surface changed. Actual savings came in at 134 rather than the estimated 137 (140 lines deleted, 6 added, all within the three files) because `VideoGenOptions` packed several keys per line rather than the one-key-per-line accounting the estimate assumed. Subsumed the separately-found VideoGenOptions finding as planned. Verified: `bun run check` clean; the no-cost smoke set as a formality — `cli-help-contracts.test.ts` 25 pass, `cli-usage-errors.test.ts` 66 pass, `option-resolution-contracts/` 94 pass.

**Wave 9 — One shared bounded worker pool (X-2) — DONE (2026-08-08, actual net 126 lines).** Landed as prescribed: `comic-utils/run-with-concurrency.ts` moved unchanged to `src/utils/run-with-concurrency.ts` with a plain `mv` (line-neutral, as was updating the 6 comic import paths to `~/utils/run-with-concurrency`), and the five other copies of the 25-line bounded pool deleted in favor of imports — the byte-identical `runWithConcurrency` clones in `process-target-preflight.ts` and `define-tts-command.ts`, the indices-specialized `runTargetPool` in `write-transcription.ts` and `stt-provider-pool.ts`, and the `mapWithConcurrency` variant in `define-links-command.ts`. Pre-implementation re-read confirmed the six copies matched the report's characterization (identical pool skeleton; deltas confined to signature shape and the links copy's redundant `Math.floor`/empty-array guards, both behavior-neutral for the integer concurrency values and canonical early-return). All five replaced call-site groups now use the canonical `mapWithConcurrency(limit, items, mapItem)` — its `(item, index)` mapper subsumes every deleted signature, with the void workers' undefined results discarded: the preflight and TTS sites are same-line arg reorders, the two `runTargetPool` sites pass their index arrays as items so the existing `(index) => ...` workers are unchanged, and the links site reorders its three arguments in place. `stt-provider-pool`'s two `runTargetPool` consumers changed import source (`stt-batch-recovery.ts` line-neutral; `multi-provider-batch.ts` +1 line for the new import, as predicted), and the excluded pools (`audio-utils.runTtsChunks`, split-execution's segment pool, provider-target-scheduler's `runPool`, stt-batch-coordinator, the OCR ordered variant) were left untouched. Actual savings came in at 126 rather than the estimated ~120 (141 clone/call-site lines deleted, 15 added across the seven edited files; the file move itself nets zero) because the estimate slightly undercounted the deleted copies' surrounding blank lines. Consolidated the lens-cross (98), lens-providers (86), and download-area (49) findings as one change. Verified: `bun run check` clean; `bun test test/test-cases/validation/comic/` 73 pass; `links-fetching-retry.test.ts` 5 pass.

**Wave 10 — One `requireApiKey` env-guard helper (X-1) — DONE (2026-08-08, actual net 441 lines).** Landed as prescribed: `requireApiKey(envVar, stage, description?)` and `ensureApiKeySetup(envVar, stage, description?)` added to `src/utils/validate/env-utils.ts` (which now imports `InternalError`/`hintsForMissingEnv` from error-handler — the pre-verified acyclic direction), with the factory explicitly typed `() => Promise<void>` over a key-discarding body per the typing caveat, so the 35 converted `ensure*Setup` wrappers stay assignable to `bootstrap-broker`'s `ensure` entries. The pre-implementation re-read found more sites than the estimate's 77 exact-idiom matches: **90 guard sites** landed across STT/OCR/URL/write/TTS/image/video/music — 75 exact-idiom sites collapsed mechanically (wrapper files and functions to one-line `ensureApiKeySetup` consts, inline preambles to `const apiKey = requireApiKey(...)`), plus 15 variant sites handled individually: the four write runners with `l.error` preambles (`run-groq`/`run-grok`/`run-minimax`/`run-gemini` — the log line dropped as prescribed with no flag added, since the thrown error carries the same info; run-groq/run-grok also shed their now-unused `import * as l` lines), the getter-backed wrappers (glm, kimi, happyscribe ×2 plus run-happyscribe-stt, bfl, lumalabs, recraft, replicate, fal-video) whose single-purpose `getXApiKey` one-liners were deleted wherever the ensure function was their only consumer (happyscribe's exported getter stays — it still feeds the `options.apiKey ?? ...` path), and `run-anthropic.ts`'s fully redundant duplicate check deleted outright with its 3 dead import lines. Message text is preserved byte-identically everywhere, including the three suffix-less sites (`run-gemini-image-gen`, `run-gemini-video-gen`, `run-minimax-video-gen` call with no description) and the dynamic-description sites (glm/kimi `serviceName`, replicate `label`). The six key-returning wrappers (`ensureFalVideoGenSetup`, `ensureFalImageGenSetup`, `ensureBflImageGenSetup`, `ensureLumalabsImageGenSetup`, `ensureRecraftImageGenSetup`, `ensureReplicateSetup`) became one-line `async (): Promise<string> => requireApiKey(...)` consts as sketched. Suspected divergences 6 and 7 are resolved: run-anthropic's duplicate check is gone, and the gemini/grok image runners' env re-reads now route through the canonical helper (the call stays because it is also their key read). Two message-divergent guards were deliberately left alone: `run-supadata-url.ts` ("SUPADATA_API_KEY is required for --url-provider supadata. Set ... or use a different URL backend.") and `x-space-runner.ts` (a `CLIUsageError` with a developer-portal hint) — neither carries the idiom's message, and unifying them would change user-facing text. Actual savings came in at 441 rather than the estimated ~330 (673 lines deleted, 232 added including the 13-line net helper block, across 93 files) because the estimate counted only the 77 exact-idiom matches — not the 13 additional variant sites, their deleted single-purpose getters, the `l.error` lines, or the surrounding blank lines. Verified: `bun run check` clean; `cli-usage-errors.test.ts` 66 pass; `cli-help-contracts.test.ts` 25 pass; `option-resolution-contracts/` 94 pass; as extra smoke over the touched runners, `tts-provider-contracts/` 36 pass, `extract-stt/` 30 pass, `media-generation/` 18 pass.

**Wave 11 — Invert `RuntimeOptions` vs per-domain key unions (T-1) — DONE (2026-08-08, actual net 230 lines, type-only).** Landed as prescribed: each of the seven `src/types/download-workflow/*-options-types.ts` files now holds its domain's field definitions as a literal object type (`export type SttRuntimeOptions = {...}` etc., keys in the same order the old union listed them) with the key union inverted to `export type XRuntimeOptionKey = keyof XRuntimeOptions`, and `RuntimeOptions` in `src/types/cli-surface/cli-types.ts` became `SttRuntimeOptions & TtsRuntimeOptions & OcrRuntimeOptions & ImageRuntimeOptions & MusicRuntimeOptions & VideoRuntimeOptions & BatchRuntimeOptions & {...}` over the fields belonging to no domain union — 56 of them (LLM write models, llm/tts concurrency, the two optional scheduler/gate fields, price/budget, URL backend, yt-dlp passthrough, prompt/render, markdown/save), not the estimated ~75. Pre-implementation re-verification re-ran the partition script: 246 union keys (stt 44, tts 80, ocr 31, image 29, music 11, video 44, batch 7), zero overlap, every key present in `RuntimeOptions`, exactly as cited. The transcription risk the entry flagged was eliminated rather than managed: the seven literal types were generated by script directly from `RuntimeOptions`'s field lines (modifier and type text copied verbatim, so no hand-transcription), and the temporary guard file (`wave-11-guard.ts`, per the Wave 8 precedent) held the old 302-field `RuntimeOptions` verbatim and asserted keyof equality, mutual assignability, and per-field `Equal<Old[K], New[K]>` under `exactOptionalPropertyTypes` — check passed with the guards in place, then the guard was deleted and check re-run clean. `OcrConcurrencyMode`/`OutputFormat` imports moved to `ocr-options-types.ts` and `BatchOrder` to `batch-options-types.ts` as planned (both import from `~/types`; the type-only circularity through the barrel is the same shape tts's old `RuntimeOptions` import already exercised), `tts-options-types.ts`'s `TtsRuntimeOptions = Pick<...>` line and its import are gone (the literal type keeps the name), and cli-types.ts's import line swapped `BatchOrder`/`OcrConcurrencyMode` out for the seven domain types. No consumer changed — the keyof-based unions remain valid `Pick` keys for the Wave 8 types, as pre-verified. Actual savings came in at exactly the estimated 230 (509 lines deleted, 279 added, all within the eight type files). Verified: `bun run check` clean with guards and again after removing them; `cli-help-contracts.test.ts` 25 pass; `cli-usage-errors.test.ts` 66 pass; `option-resolution-contracts/` 94 pass.

**Wave 12 — Shared STT stage-request helper (S-1) — DONE (2026-08-08, actual net 289 lines).** Landed with one deliberate extension of the prescribed signature: the helper owns validation as well as the request, which is what pushed actual savings well past the 190 estimate. `stt-services/stt-stage-request.ts` (81 lines) exports `sttStageRequestWithRetryAfter(options)` — the full skeleton of `withRetry` → `metrics?.onRequest?.()` → `doFetch` → the inline error build (message `<errorPrefix> <stage> failed (<status>): <body text>` carrying `status`, `headers`, `stage`, `retryClass`) → `classifyFetchRetry` with the onRetry/429 bump → `attachAsyncSttErrorContext` → `validateData` → `attachAsyncSttValidationContext`, returning `{ value, retryAfterMs }` — plus a two-line `sttStageRequest` wrapper returning just `value` for the seven sites that ignore `Retry-After`, and the `lifecycleMetricsToCallbacks(metrics)` adapter the entry predicted. Folding `schema`/`schemaLabel` into the options (typed in the new `src/types/stt-workflow/stt-stage-request-types.ts`, 17 lines, barrel-exported) meant each of the ten sites shed its validate-plus-attach tail as well as its fetch/retry body: rev and speechmatics `create`/`poll` keep only their post-validation shaping (`{ jobId: createResponse.id, status: createResponse }`, speechmatics' `'job' in createResponse` branch, `{ status: value.job, retryAfterMs }`) and the four `getTranscript`/`getTranscriptionTranscript` sites became single expression-bodied calls. Pre-implementation re-read confirmed all ten sites matched the cited skeleton. All provider-varying strings are preserved byte-identically — the three error prefixes, all ten `operationName`s, the four stage tags, both retry classes, the maxAttempts/timeout pairs (4/`REQUEST_TIMEOUT_MS` for create-class, 6/`POLL_REQUEST_TIMEOUT_MS` for read-class), and all ten `validateData` context labels — and metric timing is unchanged (`onRequest` fires inside the attempt before the fetch; `onRetry` only under `decision.shouldRetry`). `lifecycleMetricsToCallbacks` reproduces the four direct-mutation sites exactly (`requestCount += 1`; `retryCount += 1` plus `rateLimitCount += 1` on 429) and also replaced the two 10-line inline callback literals at the `runAsyncSttJobLifecycle` `getTranscript` call sites. The two attach helpers' `stage` parameter widened from `'create'|'poll'|'transcript'` to `string` as prescribed, which is what lets soniox's `'upload'` route through them; the `failure.stage === 'upload'` comparisons in `stt-provider-failures.ts` still typecheck. Beyond the prescribed deletion of `toRevHttpError`/`toSpeechmaticsHttpError`, the wave **subsumed S-6 entirely**: soniox's `toSonioxHttpError` and its verbatim `getSonioxErrorStatus`/`attachSonioxErrorContext`/`attachSonioxValidationContext` trio were dead once `soniox-api.ts` routed through the shared helper, so `soniox-utils.ts` (50 lines) and `src/types/stt-workflow/soniox-utils-types.ts` were deleted along with their barrel line, and the now-unreferenced `SttAsyncJobHttpError`/`SonioxHttpError` types collapsed into one `SttStageHttpError = RequiredSttHttpErrorWithRawResponse<string>`. Accounting: rev 453→340, speechmatics 504→391, soniox-api 325→219, soniox-utils 50→0, soniox-utils-types 3→0, stt-types −2, against 81+17 new helper/type lines — 289 net. Only intentional behavior delta: the helper calls `parseRetryAfterMs(response.headers)` on every response rather than only on polls, and the value is discarded by `sttStageRequest` (a pure header read, no observable effect). The backlog finding S-4 is now unblocked at zero new helper lines, though its verified constraint still stands — assemblyai/gladia attach helpers do not unwrap `error.cause`, so that wave must pass the attach function per site rather than reuse the helper's built-in one. Verified: `bun run check` clean; `bun test test/test-cases/validation/extract-stt/` 30 pass across 7 files; `cli-help-contracts.test.ts` + `cli-usage-errors.test.ts` 91 pass as barrel smoke. No provider was called; rev/speechmatics/soniox request behavior stays covered by the out-of-scope e2e suites.

**Wave 13 — Hosted TTS chunk-pipeline skeleton (TT-1) — DONE (2026-08-08, actual net 145 lines).** Landed as prescribed: `tts-utils/hosted-tts-chunk-pipeline.ts` (57 lines) exports `runHostedTtsChunkPipeline(options)` holding the whole skeleton — `runTtsChunks` over the chunk list, the chunk path, the `withHostedTtsRetry` envelope, the empty-audio `InfraError`, `Bun.write`, chunk-path tracking, `concatAndConvertToWav`, `finalizeTtsRun`, and the finally-cleanup loop — with each of the eight runners (cartesia, hume, deepgram, grok, groq, openai, elevenlabs, speechify) passing only a `fetchChunkAudio({ chunk, chunkIndex, signal })` closure plus its config. The options type lives in the new `src/types/tts-workflow/hosted-tts-chunk-pipeline-types.ts` (22 lines, barrel-exported): `provider`, `providerLabel`, `model`, `speaker`, `chunks`, `outputDir`, `chunkExtension`, `startTime`, `chunkConcurrency`, `chunkScheduler`, `extraMetadata`, `fetchChunkAudio`. Pre-implementation re-read confirmed every provider-varying string is derivable from those two identifiers with zero text change: the chunk path segment equals the `TtsProvider` literal in all eight runners (`speech-<provider>-chunk-NNN.<ext>`), `operationName` is `<provider>-tts-chunk-<n>` in all eight (openai's `index + 1` is the same value as its siblings' `chunkIndex`), the error stage is `tts:<provider>`, and the empty-audio message prefix is exactly the label already passed to `concatAndConvertToWav` — so the concat-list filename `speech-<label.toLowerCase()>-chunks.txt` is unchanged too. `chunkExtension` carries the only remaining per-site literal: `wav` (cartesia/grok/groq/openai), `mp3` (hume/deepgram/elevenlabs), and speechify's dynamic `audioFormat`. The flagged constraints held: elevenlabs/speechify/openai keep an explicit `const startTime = Date.now()` at its original position ahead of voice-clone creation and pass it in, while the other five pass `Date.now()` inline at the same point they captured it before; the clone metadata is passed as `extraMetadata` under a conditional spread, so a non-clone run adds no key at all (matching the old `...(cloneResult ? {...} : {})` on the returned metadata under `exactOptionalPropertyTypes`). Deepgram's URLSearchParams and openai's requestBody moved inside the fetch closure as planned — both are pure constructions over unchanging inputs, so the only delta is a rebuild per retry attempt rather than per chunk. **Suspected divergence 12 is preserved, not unified:** the empty-text guard stays in each runner ahead of the helper call, so deepgram still throws `InfraError` and the other seven `ValidationError`; the helper never sees that guard, and deepgram is consequently the only one of the eight still importing `InfraError`. Excluded as prescribed: gemini, minimax, mistral (multi-part audio / async polling / JSON payload flows) and the local kitten runner. TT-4 remains additive and untouched — the three `readXError` readers and four `trimTrailingSlash` copies now live beside the surviving fetch closures (cites drift to cartesia:15, hume:13, speechify:18, deepgram:12). Accounting: the eight runners went 128→101, 136→109, 120→94, 99→72, 87→60, 95→69, 161→129, 150→117 — 225 lines deleted against 80 added (57 helper + 22 types + 1 barrel line), 145 net rather than the estimated 150, because the eight option literals cost a few lines more than a bare call would. Verified: `bun run check` clean; `bun test test/test-cases/validation/providers/tts-provider-contracts/` 36 pass across 6 files (these exercise all eight runners through mocked fetch, including the chunk-count/metadata assertions, the non-OK error-text contracts, and the ElevenLabs/Speechify clone-metadata paths); `cli-help-contracts.test.ts` + `cli-usage-errors.test.ts` 91 pass as barrel smoke. No provider was called.

**Wave 14 — Derive the config-merge injection ladder from `FLAG_TO_CONFIG_PATH` (B-1) — DONE (2026-08-08, actual net 149 lines).** The mechanical pre-switch diff was re-run first, as the entry required, by parsing both encodings out of the file and comparing them in both directions: 156 ladder entries (`inject('flag', d.a.b.c)` plus the `['flag', d.a.b.c]` pairs inside `injectProviderGroup`) against 157 table entries, zero path mismatches, zero duplicate ladder flags, zero ladder-only flags, and `max-cents` (`['pricing','maxCents']`) the single table-only entry — so **no latent mismatch surfaced**; the previously-flagged renames (`tts-speaker→ttsSpeakers`, `ocr-concurrency→pageConcurrency`, `format→out`, `ocr-language→lang`, `kitten-voice→ttsSpeaker`) all matched. `prompt` turned out never to have had a table entry at all (it is a `MULTI_DESTINATION_FLAGS` member handled by its own trailing block), so the loop excludes it for free; `max-cents` is excluded structurally by `path[0] !== 'defaults'` rather than by name, since the ladder reads exclusively from `d = config.defaults`. The ladder collapsed to the prescribed two loops: a group pass over the new `PROVIDER_SELECTION_GROUPS` table (eight `{ gate, flags }` rows) and a flag-by-flag pass over `Object.entries(FLAG_TO_CONFIG_PATH)`, both resolving values through the existing `readNestedValue`; `inject` now takes a path instead of a value and does the read itself, and `resolveStep2ProviderDefaults`, `injectProviderGroup`, and `hasExplicitFlagInGroup` are gone along with the `Step2Command` type import. Two asymmetries the ladder encoded implicitly are now explicit in the group table rather than lost: `gate` and `flags` are the same list for seven groups but differ for URL, whose explicit-flag guard also covers the `all-url`/`all-local-url`/`all-providers`/`all-local` bundles that have no config destination of their own; and the skip-set for the second pass is the union of group flags **and** all `STEP2_PROVIDER_CONFIG_PATHS` keys, not just group membership — today those two sets are identical (verified at runtime: 28 registry config-path entries, 28 selection flags across stt/ocr/url, all `defaults`-rooted), but a future registry entry with `resumeSelectable: false` would land in the table through the spread while being absent from the groups, and the ladder never injected such a flag. Section gating (`if (d.extract?.stt)` etc.) was dropped as redundant exactly as prescribed. Beyond the pinned suites, correctness was established by a differential harness that ran the pre-change implementation (`git show HEAD:` copy) and the new one side by side over 420 cases — 15 configs (including one populating every table destination with a distinctive string, a numeric twin exercising the number→`String` coercion, and cases for absent `defaults`, empty sections, and falsy/empty values) × 14 explicit-flag sets (none, all, one per provider group, each `all-*` bundle, scalar-only) × 2 raw-flag baselines — comparing full key sets and every value: **identical in all 420**. One non-behavioral delta: the array order of `__autoshowConfigInjectedFlags` changed (provider groups now precede scalars), which is inert because its only consumer, `readInjectedConfigFlags`, converts it to a `Set`, and the tests that mention the key only pass it in as input. Accounting: 623→474 lines, 45 insertions against 194 deletions, 149 net rather than the estimated 138. Verified: `bun run check` clean; `bun test test/test-cases/validation/cli/option-resolution-contracts/` 94 pass across 13 files; `test/test-cases/validation/configuration/config-contracts/` 24 pass across 6 files; `cli-help-contracts.test.ts` + `cli-usage-errors.test.ts` 91 pass. No provider was called.

## Sequencing notes

- **X-1 (Wave 10) first** (done 2026-08-08): `requireApiKey` landed in `src/utils/validate/env-utils.ts` with the write (W), TTS (TT), and genmedia (G) API-key findings consolidated into it.
- **S-1 (Wave 12) before S-4 and S-6** (done 2026-08-08): S-4 is now a zero-new-helper-line change against the landed `sttStageRequest`; S-6 needs no separate pass at all — Wave 12 deleted all three `toXHttpError` builders and the whole soniox attach/status trio.
- **T-1 (Wave 11) after T-2 (Wave 8)** — both done: T-1's inversion turned the key unions into `keyof` aliases, which remain valid `Pick` keys for the landed Wave 8 types, so the Wave 8 Pick lists were untouched. The temporary `AssertEqual<old, new>` guard convention held for both type migrations.
- **X-2 (Wave 9, done) and X-3** interact slightly with O-3 and D findings: X-2 subsumed the download-area pool finding; X-3 overlaps ~8 of O-3's isRecord sites (implement either order, just don't double-count).
- **X-5** consolidates three overlapping lens findings (path helpers, timestamp helpers, formatCueTimestamp) into one change.

---

## Cross-cutting (X)

### X-1: `requireApiKey` env-guard helper — net 441 lines (done)

Promoted to **Wave 10** in the wave plan and implemented there (2026-08-08); the completion record and verification results live in the wave entry. The write (W), TTS (TT), and genmedia (G) API-key findings were consolidated into it.

### X-2: One shared bounded worker pool — net 126 lines (done)

Promoted to **Wave 9** in the wave plan and implemented there (2026-08-08); prescription, exclusions, and verification live in the wave entry.

### X-3: `isRecord` — 39 exact local copies — net 39 lines

`const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)` is defined locally, byte-identical to the export at `src/utils/rest-client.ts:8-9`, in 39 files across steps 1/2/3/4, transcript-video, write-manifest-log, resume, and links. Six copies are themselves exported (`url-utils.ts`, `batch-manifest.ts`, `manifest-log-metadata.ts`, `happyscribe-utils.ts`, `pdf-chunk-fallback-shared.ts`, `supadata-response-parsers.ts`) — replace those with `export { isRecord } from '~/utils/rest-client'` so their importers are untouched.

**Exclusions (load-bearing):** `src/utils/error-handler.ts`'s copy stays (rest-client imports error-handler — importing back would cycle); the loose variants without `!Array.isArray` (e.g. `gemini-rest.ts`) behave differently on arrays and stay; `benchmark-utils.ts`'s JsonObject-typed variant stays. Each of the 39 files pays one import/re-export line: 78 removed − 39 added = 39 net.

### X-4: stt-cli inline Pick duplicates `SttStep2ResolutionOptions` — net 32 lines

`collectSttProviderSpecs` in `step-2-stt/stt-cli.ts:54-90` declares a 37-line inline `Pick<RuntimeOptions, ...>` that duplicates the exported `SttStep2ResolutionOptions` (`src/types/pipeline-core/step-2-shared-types.ts:132-164`) key-for-key plus exactly four extra keys (`geminiSttModel/Models`, `togetherSttModel/Models`) that the shared type is missing — apparent drift from when those providers were added.

**Fix (preferred):** add the 4 keys to `SttStep2ResolutionOptions`, then the parameter becomes `options: SttStep2ResolutionOptions`. Verified safe for every consumer: `resolveSttStep2Execution` is called with full `RuntimeOptions` or via an explicit cast (`metadata-input-routing.ts:90`); `stt-targets.ts:73` already satisfies the 36-key shape. Alternative if widening is unwanted: `SttStep2ResolutionOptions & Pick<RuntimeOptions, ...4 keys>`. Type-only either way; runtime cast at line 93 unchanged.

### X-5: transcript-video / lyrics-video shared path + timestamp helpers — net ~40 lines

`run-transcript-video.ts:18-65` and `run-lyrics-video.ts:27-80` both locally define `PROJECT_ROOT` (already exported from `src/utils/runtime-paths.ts`), `toPosixPath`, `toProjectDisplayPath`, `resolveUserPath`, `baseStem` with identical bodies; `text-input-utils.ts:13,29-30` and `defuddle-cli.ts:11` also recompute PROJECT_ROOT. Separately, transcript-video's `formatCueTimestamp` (316-325) is exactly `captions.ts`'s unexported `formatCaptionTimestamp(seconds, '.')`, and its `parseTimestampToSeconds` (151-174) shares an identical 13-line validation/arithmetic body with `parseCaptionTimestamp` (only the regexes differ: optional 1–3-digit ms vs required 3-digit).

**Fix:** (1) move `toPosixPath`/`toProjectDisplayPath`/`resolveUserPath`/`baseStem` into `runtime-paths.ts` next to `PROJECT_ROOT`; both renderers, text-input-utils (partially), and defuddle-cli import from it. (2) In `captions.ts`, export `formatCaptionTimestamp` and add `hmsPartsToSeconds(h, m, s, ms)` holding the shared validation/arithmetic; both parse functions keep their own regexes and shrink to match + call; delete `formatCueTimestamp` (2 call sites become `formatCaptionTimestamp(x, '.')`; transcript-video already imports from captions.ts).

**Exclusions:** `text-input-utils.ts`'s `toProjectDisplayPath` returns `./${rel}` — behaviorally different display convention, keep local (flag if accidental). `parseTimestampToSeconds` vs `parseCaptionTimestamp` grammars deliberately stay distinct.

Consolidates three overlapping lens findings (29 + 25 + 17 raw; ~40 unique).

### X-6: `minimaxFetch` glue — net 33 lines

Five hand-rolled `fetch` + bearer/JSON headers + `if (!response.ok) { read text; throw InfraError(\`<ctx> (${status}): ${body || 'No response body'}\`) }` blocks (12–16 lines each): `run-minimax-tts.ts:72-83`, `run-minimax-video-gen.ts:118-130, 146-157, 193-204`, `run-minimax-music-gen.ts:94-109`. Add `minimaxFetch({ baseURL, apiKey, path, method, body?, context, stage })` to the already-shared `tts-minimax/minimax-utils.ts` (imported by all three steps).

**Exclusions (load-bearing):** TTS create/query calls need `createMinimaxHttpError` attaching `.status`/`.headers` for `withHostedTtsRetry` rate-limit classification; `music_generation` uses `AbortSignal.timeout` — leave both out. Unifying adds `status` to the video copies' InfraError metadata (they currently omit it) — metadata-only change, note in review.

### X-7: `waitForGeminiFile` duplicated — net 17 lines

Token-identical 18-line polling loop in `run-gemini-ocr.ts:285-302` and `run-gemini-stt.ts:160-177`, differing only in the stage string. Move into `src/utils/gemini/gemini-rest.ts` (both files already import from it; it already imports `InfraError`) with `stage` as a third parameter.

### X-8: `formatBytes` + progress-bar renderer — net 18 lines

`formatBytes` (B/KB/MB/GB) copied in `llama-download-progress.ts:53-58`, `hosted-ocr.ts:30-36`, `stt-logging.ts:4-10` (undefined-guard variant → keep a 2-line wrapper, alias the shared import since the local name collides); progress bar copied in `llama-download-progress.ts:60-70` and `whisper-progress.ts:9-19`. Add both to `src/utils/text-utils.ts`. **Exclusion:** `run-complete-setup.ts:435`'s `formatBytes` deliberately uses GiB/MiB du-style units (documented in a comment) — leave it. `whisper-progress`'s `clampPercent` stays (used elsewhere in the file). Marginal — implement last.

---

## CLI flags and native parser (CLI)

### CLI-1: Flag-definition builders — net 551 lines (done)

Implemented as **Wave 1**; the completion record and verification results live in the wave plan.

### CLI-2: Shared long-flag argv rewriter — net 58 lines

One idiom repeated three times (128 lines): `flag-helpers.ts:104-142` (`normalizeProviderSelectorArgs`), `extract-selectors.ts:135-163` (`stripExtractGenericSelectorArgs`), `extract-selectors.ts:216-275` (`normalizeExtractGenericSelectorArgs`) — identical `--` passthrough, `parseLongFlagArg` dispatch, and separate-value boundary checks. Add `rewriteLongFlagArgs(argv, matches, consumesValue, rewrite)` to `flag-helpers.ts`. The `consumesValue` predicate preserves the one semantic knob exactly: only `provider` ever consumes a separate token; `all-providers`/`all-local` never do. The rewrite callbacks keep the `false|0|no` inline-value suppression and per-target emission verbatim.

### CLI-3: Root-mode parse-result builder — net 33 lines

`native-parser.ts` builds the same 7–9-line result object seven times (lines 261-267, 272-278, 281-287, 292-300, 302-309, 314-321, 328-335) for pre-command help/version paths. Add a private `rootModeResult(mode, argv, globalFlags, explicit, extra = {})`; each site becomes a one-line return. `CliParseResult` is a plain type (verified), so this types cleanly. The two mid-loop returns at 366-374 and 379-387 use live parse state and are deliberately excluded.

---

## Types (T)

### T-1: Invert `RuntimeOptions` vs per-domain key unions — net 230 lines (actual)

Promoted to **Wave 11** in the wave plan and implemented there (2026-08-08); the completion record and verification results live in the wave entry.

### T-2: GenOptions Pick lists → existing key unions — net 134 lines (actual)

Implemented as **Wave 8**; the completion record and verification results live in the wave plan.

### T-3: pricing-types shared fragments — net 47 lines

In `src/types/costing/pricing-types.ts`: (a) the 5-field token-profile cluster appears verbatim at 4 sites (69-73, 168-172, 311-315, 347-351) → one `TokenProfileEstimateFields` type intersected at each; (b) the 8 `*OcrModel?: string | undefined` fields appear twice (151-158, 239-246) → `OcrModelOverrides = Partial<Pick<RuntimeOptions, ...8 keys>>` (tsc-proven exactly equal); (c) `ComputeActualCostsInput` (117-128) = `ActualPipelineInputsBase<Step1Metadata> & { audioDurationSeconds?: number | undefined }` (tsc-proven); (d) the 16 `*SttModel` fields (135-150) = `Partial<Pick<RuntimeOptions, ...>>` — keep `whisperModel` literal (it is plain `string` in RuntimeOptions). **Exclusion:** `extract-estimates-types.ts`'s `OcrCostEstimate` cluster has explicit `| undefined` suffixes — a genuinely different type under `exactOptionalPropertyTypes`, do not fold in.

### T-4: LLM model key triplication — net 40 lines

The 24 LLM model keys exist three times: `RuntimeOptions` (cli-types.ts:19-42), `ResolvedLLMConfig` (cli-dir-types.ts:51-78), and the `LLMOptions` Pick list (write-types.ts:8-31). Rewrite `ResolvedLLMConfig` as `Pick<RuntimeOptions, ...24 keys packed> & { llmService: string | undefined, llmModel: string | undefined }` (tsc-proven equal); `LLMModelOptionKey` (keyof-based) survives unchanged, so `LLMOptions` replaces its 24 key lines with a single `| LLMModelOptionKey` member.

### T-5: `Estimate*CostOptions` longhand shapes — net 39 lines

`EstimateVideoCostOptions` (video-types.ts:47-76), `EstimateImageCostOptions` (image-types.ts:51-71), `EstimateMusicCostOptions` (music-pricing-types.ts:1-11) re-declare ProcessingOptions field shapes longhand — tsc-proven identical to `Pick<ProcessingOptions, ...>` (valibot `v.optional(schema, undefined)` infers `?: T | undefined`). Video keeps a 4-field literal intersection for its non-PO estimate inputs (`grokInputImageCount`, `grokInputVideoDurationSeconds`, `replicateVideoReferenceVideoCount`, `replicateInputVideoDurationSeconds`). music-pricing-types needs +1 import line.

---

## OCR — step-2-extract/step-2-ocr (O)

### O-1: Seven `estimate*OcrCost` functions — net 143 lines (actual)

Implemented as **Wave 7**; the completion record and verification results live in the wave plan.

### O-2: Envelope schema + JSON schema + parser triplicated — net 95 lines

`run-anthropic-ocr.ts:27-57`, `run-gemini-ocr.ts:21-51, 57-88`, `run-openai-ocr.ts:20-50, 85-116`: identical 6-line valibot envelope schemas, identical 24-line `*_OCR_JSON_SCHEMA` constants, and (gemini/openai) identical `normalizePages`+`parseOcrResponse` pairs differing only in provider label and stage. Extend `ocr-utils/hosted-ocr-json.ts` (all three already import from it) with `HostedOcrEnvelopeSchema`, `HOSTED_OCR_PAGES_JSON_SCHEMA`, and `createHostedOcrResponseParser(providerLabel, stage)`; gemini/openai replace their pairs with one factory call each. Anthropic keeps its own parser (pageLabel-bearing messages) but drops its two constants. Cycle-checked: `ocr-structured-response-error` and the validator never reach `hosted-ocr-json.ts`.

### O-3: Type-guard copies — net 36 lines

8 local 2-line `isRecord` copies (coordinate with X-3), `isPageResult` ×3, `isHostedOcrRun` ×2, `getUsageNumber` ×2 across `ocr-partial-step2.ts`, `hosted-ocr-utils.ts`, `pdf-chunk-fallback-state.ts`, `ocr-costs.ts`, and friends. Make `hosted-ocr-utils.ts` the canonical home (export `isPageResult`, move `isHostedOcrRun`/`getUsageNumber` there); `pdf-chunk-fallback-shared.ts` becomes a re-export of rest-client's `isRecord`. **Behavior flag:** `ocr-partial-step2`'s `isPageResult` lacks the `confidence === undefined || typeof confidence === 'number'` clause the other copies have — unifying makes partial-metadata parsing stricter for malformed confidence fields; looks like an accidental omission but call it out in the change. Cycle-checked safe.

### O-4: hosted-ocr document branches — net 33 lines

`hosted-ocr.ts` kimi (540-558), grok (586-604), deepinfra (663-681) branches are token-identical (same assert, same 7-key opts object, same `withHostedUsageDetail` payload). File-local `runDocumentHostedOcr(filePath, step1Metadata, opts, ocrService, ocrModel, runner)`; each branch collapses to `ensure*Setup(); return await runDocumentHostedOcr(...)`. Grok's runner's trailing optional `baseUrl` param is compatible with the narrower function type (verified).

### O-5: detection.ts anchor-page skeleton — net 29 lines

`pdf/ocr-chapters/detection.ts:175-218` vs `228-269`: byte-identical best-match skeleton (normalize, pageLookup Map, candidate loop, identical 3-way tie-break, distance computation); only per-page scoring differs. File-local `findBestAnchorPage(title, predictedPage, pages, options, scorePage)` where `scorePage(page) <= 0` means skip; the two exports keep signatures and pass 3–7-line closures (heading variant returns `headingScore + 4`).

### O-6: checkpoint/finalize manifest composition — net ~13 lines (marginal)

`ocr-multi-provider-batch.ts:71-114` vs `239-292` duplicate the missing/blocked/completionStatus/metadataErrors/payload/write sequence. File-local `composeAndWriteOcrManifest(ctx, params)` returning `{ completionStatus, writtenMetadata, missingProviders, blockedProviders, partialStep2 }` (finalize's return type needs the extra three). **Behavior flag:** the checkpoint copy's metadataErrors map omits `stage`/`status`/`retryAfterMs`/`rawResponseFile` — verified accidental (the source `buildMetadataErrorEntries` already emits all 14 fields), so unifying enriches mid-run checkpoint manifests toward what finalize writes anyway. Optional larger follow-up: type `buildMetadataErrorEntries`' return as `NonNullable<OcrMetadataOptions['failures']>` and delete both re-mapping blocks entirely. Only do this one if touching the file anyway.

---

## STT — step-2-extract/step-2-stt (S)

### S-1: Shared STT stage-request helper — net 289 lines (done)

Implemented as **Wave 12**; the completion record and verification results live in the wave plan. The landed helper also owns schema validation, which is why it subsumed S-6 outright and why the actual came in above the 190 estimate.

### S-2: Polling-deadline / resume-probe error builders — net 183 lines (done)

Implemented as **Wave 5**; the completion record and verification results live in the wave plan.

### S-3: Merge whisper/whisperfile runners — net 135 lines (done)

Implemented as **Wave 6**; the completion record and verification results live in the wave plan.

### S-4: AssemblyAI + Gladia onto the S-1 helper — net 120 lines (unblocked; S-1 landed as Wave 12)

Six inline ~40-line blocks (`run-assemblyai-stt.ts:201-243, 256-296, 333-375`; `run-gladia-stt.ts:259-300, 315-357, 401-442`) with the same skeleton. Reuse `sttStageRequest` (0 new helper lines). **Verified constraint:** assemblyai/gladia attach-context helpers do NOT unwrap `error.cause` (unlike rev/speechmatics/soniox) — the helper must take the attach function per site rather than hardcoding the unwrapping variant. `classifySttFetchRetryWithMetrics` semantics verified identical to the helper's classify+onRetry path. AssemblyAI's private `parseRetryAfterMs` (37-54) becomes deletable (uncounted upside; note its semantics differ from `~/utils/retries`' version — rounding/clamping — so it must not silently swap to that one).

### S-5: Delete-remote-resource cleanup — net 62 lines

Four identical ~33-line DELETE-with-404-tolerance functions: `rev:161-194`, `speechmatics:172-205`, `soniox-api:259-291, 293-325`. All four use `Authorization: Bearer` (the finder thought headers varied; verified they don't). Export `deleteSttRemoteResource({url, headers, provider, artifact, id})` from `async-lifecycle.ts`; each site becomes a ~9–10-line typed wrapper (soniox's two are exported — keep the export keyword).

### S-6: HTTP-error builders + soniox trio — net 56 lines (done, subsumed by Wave 12)

Fully absorbed by **Wave 12**: routing `soniox-api.ts` through the shared `sttStageRequest` left `toSonioxHttpError` and the `getSonioxErrorStatus`/`attachSonioxErrorContext`/`attachSonioxValidationContext` trio dead, so `soniox-utils.ts` and its types file were deleted outright alongside `toRevHttpError`/`toSpeechmaticsHttpError`, and the async-lifecycle stage param was widened to `string`. The one piece of guidance that survives for later passes: do NOT fold in the assemblyai/gladia/happyscribe/supadata attach variants (they skip the cause-unwrap) or the payload-parsing `toXHttpError` variants.

### S-7: happyscribe.ts reimports — net 44 lines

`happyscribe.ts:11-76` privately redefines `isRecord`, `normalizeId`, `readJsonOrText`, `extractErrorMessage` — byte-for-byte copies of `happyscribe-utils.ts` exports (verified, including the same key-preference list). One import line, export `extractHappyScribeErrorMessage` (keyword only), rename 5 call sites in place. No cycle (verified).

---

## URL extract — step-2-url, step-2-shared, transcript-video (U)

### U-1: Scrape-runner skeleton — net 70 lines

`runFirecrawlScrape` (70-117), `runSpiderScrape` (96-143), `runZyteExtract` (108-158), `runSupadataScrape` (50-96) share the key-guard + timed fetch + JSON payload + HTTP-error skeleton (~48 lines each). Two helpers in `url-utils.ts` (all sites already import it): `fetchUrlProviderJson(providerLabel, action, endpoint, init, options, errorKeys)` — the ordered `errorKeys` loop is exactly equivalent to each site's `cleanString(a) ?? cleanString(b)` chain (verified `cleanString` returns undefined for empty) — and `requireHostedUrlProviderApiKey(envVar, providerId, stage, usingHostedApi)` for firecrawl/spider/zyte. Supadata keeps its own differently-worded always-required guard; glm-reader is excluded (uses `response.text()` with rawText fallback). **Flag:** firecrawl's stage is `'extract:firecrawl'` while spider/zyte use `'url:<id>'` — looks accidental; preserve via the stage parameter, surface to maintainer.

### U-2: `runXUrl` finalization wrapper — net 36 lines

The exported entry functions in the same four files are byte-identical 23-line wrappers (log → scrape → `tryFetchRemoteHtml` → `ensureMeaningfulMarkdown` → backfill → 6-field return). Add `finalizeUrlArticleResult(source, sourceUrl, backend, scraped)` to `url-utils.ts`; each becomes ~9 lines. **Flag:** glm-reader's wrapper omits the `finalUrl` backfill and author spread — possibly accidental; adding it as a fifth site saves ~12 more but changes glm behavior, so ask first.

### U-3: transcript-video source loading — net 18 lines

`run-transcript-video.ts:530-561` vs `582-611`: same two-branch `--transcript-text`/`--transcript-result` loading (identical errors, check order, labels). Same-file `loadTranscriptionSelection(audioPath, textFlag, resolveResultPath)` with the differing result-path resolution passed as a lazy closure (preserves that manifest-based resolution only runs when no text flag is given).

### U-4: provider-registry-selection literal — net 17 lines

`provider-registry-selection.ts` builds the identical 10-field `appendProviderSelection` literal three times (131-142, 156-167, 185-196). Same-file `buildResolvedSelection(entry, model, origin)` — typechecks on the unnarrowed union without casts (verified against `Step2ProviderRegistryEntryBase` and the `selectionKind` union).

---

## Download — step-1-download (D)

### D-1: `pick()` model-option passthrough — net 85 (one-key-per-line) to ~165 (packed arrays)

Each `build-opts-from-flags/*.ts` builder destructures N model keys from `ctx.modelOptions` and re-emits every one verbatim: stt 34 keys (14-49, 52-86), ocr 16, image 16, video 18, music 6, tts 22 pure-passthrough keys. Add a generic `pick<T, K>(obj, keys)` (~7 lines) to `src/utils/cli-utils.ts`; each builder deletes the passthrough destructure + return lines and starts the return with `...pick(modelOptions, XXX_MODEL_KEYS)` (spread FIRST so explicit keys still win). **Verified constraints:** in tts-options, 8 destructured names are used in validation logic and stay (grok/groq/deepgram/speechify/hume/cartesia lists, kitten pair — kitten maps to differently-named return keys and must stay explicit). Property insertion order changes (visible only if these objects are ever stringified — cosmetic). Writing key arrays ~4/line roughly doubles the savings; music alone is ~+4 and can be skipped.

### D-3: `readModelFamily` tuple helper — net 31 lines

`download-model-options.ts:144-179` has 36 consecutive `const xModel = first(xModels)` lines pairing 1:1 with the `readValidatedMany` declarations. A 5-line helper (must live inside `readRuntimeModelOptions` — `readValidatedMany` is a closure) returning `[models, first(models)] as const`; each family becomes one tuple-destructure line. `whisperModel` (default fallback) stays special; TTS/image/video/music families already inline `first()` and gain nothing.

### D-4: batch-executor identical child runners — net 28 lines

`batch-executor.ts:92-119` vs `121-148` are identical except the document variant forwards `commandName` while x-space hardcodes `'extract'` — verified dead difference (both only ever receive `'extract'` through the call chain). Delete the x-space variant, rename the survivor `runExtractChildBatch`, point both call sites (193, 196) at it. Keep the forwarding body.

### D-5: expected-output artifact block — net 17 lines

`expected-output.ts:129-146` vs `192-210`: identical 18-line collect-and-push block (the four collected-targets locals are used nowhere else — verified). File-local `pushPostGenerationFiles(files, opts, canRunPostGeneration)`; the differing `canRunPostGeneration` computation stays at each site.

### D-6: audio-normalize predicates — net 17 lines

`audio-normalize.ts:128-146` vs `148-165`: identical except the mp3 variant drops the aac/.m4a disjunct. Merge into `isHostedPreserveCandidate(inputPath, probe, allowAac)`; callers at 185 (`true`) and 226 (`false`). Divergence is intentional and preserved by the flag.

(The download-area worker-pool finding is subsumed by X-2 / Wave 9.)

---

## Write — step-3-write (W)

### W-1: llama stderr watch + startup-failure error — net 43 lines

The ~26-line stderr-watch block (tail slice, line buffering, stripAnsi, download-progress watch) is duplicated in `llama-model-download.ts:65-94` and `llama-server-runtime.ts:42-77`; the ~19-line two-branch InfraError construction appears in both plus `llamafile-server.ts:233-251` (labels/stage differ only). Add `watchLlamaServerStderr(stderr): { getTail, stop }` and `throwIfServerStartupFailed(healthResult, tail, timeoutMs, {server, stderr, stage})` to `llama-download-progress.ts` (all three already import it). Budget the helpers honestly at ~62-65 lines (exported HealthResult union, closures, imports) — the verifier corrected the original estimate down.

### W-2: llama vs llamafile health machinery — net 41 lines

Five function pairs duplicated between `llama-server-process.ts` and `llamafile-server.ts` (~88 lines each side): `getErrorCode`, `isPidRunning`, `checkXHealthQuiet` (base URL differs), `waitForXHealthState` (operationName differs), `waitForXHealth` (constants/labels differ). New `write-local/shared/local-server-health.ts`; llama keeps thin wrappers for its exported names (consumed by two files). **Do NOT merge** `stopRecordedDefaultLlamaServer` vs `stopRecordedLlamafileServer` — they genuinely diverge (llama waits for pid exit and throws on failure; llamafile unconditionally clears state after SIGKILL) and that may be intentional.

### W-3: llama/llamafile completion clients — net 40 lines

`llama-client.ts` (60 lines) and `llamafile-client.ts` (64 lines) are line-for-line identical (same request body, retry loop, schema validation, token fallback) modulo base URL, kwargs const, retry constants, and label — and the label appears consistently in all four message positions, so one `apiLabel` field reproduces every string. New `write-local/shared/local-completion-client.ts` with `requestLocalChatCompletion(profile, prompt, model, signal?)`; each provider defines an ~8-line profile const from its existing constants module. Sole callers verified: `run-llama.ts`, `run-llamafile.ts`.

### W-5: run-llama/run-llamafile scaffolding — net ~15 lines

The two runner bodies share the countTokens/withProcessLock/retry/metadata/catch structure (~45 lines each). A shared `runLocalLlmModel({..., prepare, request})` nets only ~15 after honest helper accounting (~60 lines, per the verifier) — worth doing primarily for single-point-of-maintenance; each runner also sheds 4 dead import lines. Lowest priority in this area.

(The write API-key finding is consolidated into X-1, including the redundant `run-anthropic.ts:13-17` block deletion.)

---

## TTS — step-4-tts (TT)

### TT-1: Hosted chunk-pipeline skeleton — net 145 lines (done)

Promoted to **Wave 13** in the wave plan and implemented there (2026-08-08); the completion record, preserved-divergence note, and verification results live in the wave entry.

### TT-2: MiniMax reimplements `concatAndConvertToWav` — net 56 lines

`run-minimax-tts.ts:93-145` duplicates `tts-utils/audio-utils.ts:129-174` (single-chunk path byte-identical; multi-chunk differs only in two-pass vs one-pass concat with equivalent output — verified same ffmpeg args and filenames derived from providerLabel 'MiniMax'). Delete the local function, call the shared one, drop now-unused resolve/exec/getFfmpegBinary imports, simplify the finally-cleanup (line 312 becomes dead). Note: error stage metadata changes from `tts:minimax` to `tts:audio-utils` — acceptable, but know it.

### TT-4: Error-text readers + status/headers error — net 19 lines

Three identical 4-line `readXError` readers (cartesia/hume/speechify), four local `trimTrailingSlash` copies (cartesia:15, hume:13, run-speechify:18, run-deepgram:12 after Wave 13 — the finder's speechify-custom-voices cite was wrong, verified), and five identical 7-line `Error & { status, headers }` throw blocks. Add `readTtsErrorText(response)` and `httpResponseError(message, response)` to `tts-http-utils.ts`; import the already-exported `trimTrailingSlash`. **Exclusions:** minimax's `createMinimaxHttpError` and the ivc/custom-voice variants (different fallback text; `elevenlabs-ivc.ts:129-131` attaches only `.status` — possibly accidental, flag it). A ride-along copy exists in `stt-grok/run-grok-stt.ts:36`.

### TT-5: Custom-voice memoization + MIME map — net 26 lines

`speechify-custom-voices.ts` and `elevenlabs-ivc.ts` share an identical 12-entry extension→MIME Map (14 lines each) and a structurally identical 24-line memoize-with-rollback `ensure*` function (both context types are exactly `{ voicePromise?: Promise<X> | undefined }` — verified). New `tts-utils/tts-custom-voice-utils.ts` with the shared Map and generic `ensureCachedVoice<T>(context, create)`. **Do NOT merge** the adjacent `validate*Audio` functions — Speechify hard-fails (10–30s, 5 MiB cap) where ElevenLabs only warns.

(The TTS API-key finding is consolidated into X-1.)

---

## Image / Video / Music — steps 5-7 (G)

### G-1: Status-log helpers across 18 runners — net 293 lines (done)

Implemented as **Wave 2**; the completion record and verification results live in the wave plan.

### G-3: Replicate video options type — net 75 lines

`run-replicate-video-gen.ts` repeats essentially the same inline options type 7 times: the full 18-field literal twice (396-415, 442-461) plus five strict-subset builder literals. Declare `type ReplicateVideoGenOptions` once at the top (~21 lines); builders needing `mode` use `& { mode: VideoMode }`. Type-level only — builders already receive the full spread at runtime (verified). Optional add-ons: the same pattern smaller in `run-fal-video-gen.ts` (~7) and `run-fal-image-gen.ts` (~5).

### G-4: BFL/Lumalabs HTTP plumbing quartet — net 55 lines

`run-bfl-image-gen.ts:73-144` and `run-lumalabs-image-gen.ts:70-141` privately define the same four helpers: `readJsonOrText` (byte-identical), `extractErrorMessage` (lumalabs adds `'failure_reason'` — preserve via keys param), `fetchXJson` (auth header differs: `x-key` vs Bearer), `downloadXImage` (label/stage differ; includes the same hand-rolled retryable Error-with-status also present in `image-output.ts`). New `image-utils/polled-image-http.ts` with the four parameterized. Only transport merges; the divergent polling schemas above stay per-provider. Cross-note: `readJsonOrText` has 3 more copies in STT services — if a `src/utils` home is ever chosen, these five sites should share it.

### G-5: captions parseVtt/parseSrt — net 38 lines

`step-7-music/lyrics-video/captions.ts:69-109` vs `111-144`: byte-identical except the WEBVTT/NOTE block skip and 'VTT'/'SRT' in messages. Single `parseCaptionCues(raw, format)` with a format-guarded skip; the four `loadCaptionFile` call sites pass the format in place.

(The genmedia API-key finding is consolidated into X-1.)

---

## Comic — step-8-comic (C)

### C-1: Grouped panel reference resolution — net 57 lines

`generate-comic-pages.ts` `resolvePageReferences` (89-144) and `generate-scene-sketches.ts` `resolveSketchChunkReferences` (242-283) are near-identical. Add `resolveGroupedReferenceImages(panels, model, priorRefs = [])` to `comic-utils/panel-prompt-utils.ts`. Both flagged behavior notes verified inert: `applyReferenceImageLimits` ignores its first arg, and the pages InfraError is currently unreachable (`resolvePrimaryCharacterReferencesAcrossPanels` always returns `missingPrimaryCharacterRefs: []` on success) — keep the pages wrapper throwing it anyway.

### C-2: cli-args per-flag parse helpers — net 45 lines

`comic-utils/cli-args.ts` repeats identical switch-case bodies across its three parsers: `--llm-model` ×2 (16 lines each), `--quality` ×2, `--size` ×2, `--concurrency` ×3, default scriptPath ×2 — 131 lines, error strings byte-identical. Five module-local helpers following the existing `(existing, args, index, flag)` shape. **Exclusions (verified load-bearing):** reference-sketch's combined `--llm-model/--qa-model` case (different once-error), `--qa-model` (openai-only check), reference-sketch `--image-model` (exactly-one check) stay as-is.

### C-3: Lenient JSON extraction — net 30 lines

`generate-scene-json.ts:21-46` and `llm-review.ts:10-35` are byte-identical (fenced-JSON regex, brace-slice fallback) except the stage string; both call sites always pass `{ lenient: true }` so that branch is dead. Add `parseLenientJsonResponse(content, stage)` to `comic-utils/json-prompt-utils.ts`; llm-review's now-unused ValidationError import offsets its new import line.

### C-4: Panel prompt-bundle reader — net 26 lines

`readComicPagePanelSource` (pages, 57-87) and `readSketchPanelSource` (sketches, 285-309) are the same function; pages adds normalization + a stage difference. Add `readPanelPromptSource(sceneDirectory, panelEntry, stage)` to `panel-prompt-utils.ts`; pages keeps a wrapper for normalization + became-empty error. A third inline copy in `generate-panel-images.ts:123-136` could adopt it later (~8 more lines; verify surrounding validation first).

### C-5: price-estimate printer — net 19 lines

`price-estimate.ts:89-111` vs `226-248`: byte-identical 23-line token/cost summaries (both hardcode `totalCalls = 1`). Module-local `printSingleCallLlmEstimate(model, filesHeader, fileLabel, tokens)`.

### C-6: image-run-stats + formatCost — net 16 lines

`generate-images-command.ts:36-49` `createEmptyImageStats` is a field-for-field copy of `image-costs.ts` `createImageRunStats` (single call site) — delete and import. `image-costs.ts` `formatCost` and `comic-logger.ts` `formatCompactCost` have identical bodies. **Verified pitfall:** a bare `export { x as y } from` re-export binds nothing locally and `image-costs.ts:65` calls `formatCost` internally — use `import { formatCompactCost } ...` + `export const formatCost = formatCompactCost` instead.

---

## Metadata / process-steps root (M)

### M-1: frontmatter renderEntry — net 38 lines

`format-metadata-frontmatter.ts` `renderObject` (31-70) and `renderArray` (72-107) share the same four-way branch tree; every emitted line is `${prefix} <suffix>` with prefix `${indent}${key}:` vs `${indent}-`. Private `renderEntry(entry, prefix, indentLevel): string[]`. **Preserve the asymmetry:** renderObject skips undefined values per-key; renderArray lets undefined elements hit the quoted-'undefined' fallback — keep the skip in renderObject's loop.

### M-2: `parseUrl` predicate — net 22 lines

The `try { new URL(x) } catch { return false }` scaffolding is repeated in 7 functions in `metadata-input-classifier.ts` plus `isYoutubeUrl` and `isYoutubeChannelUrl` in metadata-sources. Add `export const parseUrl = (value: string): URL | null` in the classifier; each predicate collapses to a null-check plus its verbatim field test. Do not simplify `isLikelyUrl` to a bare null-check (it requires non-empty host — `mailto:` must still fail).

### M-3: manifest kind ladder — net 17 lines

`manifest-utils.ts` parseRunManifest/parseBatchManifest each contain the identical 18-line 8-literal kind ladder + expectedKind check. Add `MANIFEST_KINDS` array + `parseManifestKind(value, expectedKind?)`; both types are the same union (`BatchManifest.kind` is declared as `RunManifest['kind']` — verified).

---

## Setup: benchmark / models / config / links (B)

### B-1: Table-driven config-merge — net 149 lines

Promoted to **Wave 14** in the wave plan and implemented there (2026-08-08); the completion record, the mechanical-diff result (no mismatch found), the differential-harness verification, and the preserved group/skip-set asymmetries live in the wave entry.

### B-2: Provider-comparison report writers — net 74 lines

`run-image-benchmark.ts:393-499` and `video-benchmark-reporting.ts:43-164` are clones (30-key row skeleton token-identical; report objects differ only in image/video word substitution; video adds summaryMetrics). Add `baseMediaComparisonRow(...)` and `writeMediaComparisonReports(runDir, {category, proxyNoun, ...})` to the existing `media-provider-comparison.ts` (both sites already import it). Templates must reproduce current report text byte-for-byte — `provider-comparison-report.json` is consumed downstream by consensus tooling.

### B-3: cheapest-models selector map — net 57 lines

`models/cheapest-models.ts:412-532`: 58 repeated 2-line case arms (the finder undercounted; verified 15 STT + 8 OCR + 10 LLM + 5 hosted TTS + 8 image + 3 music + 9 video) plus six literal-return exceptions. Replace with `FLAG_SELECTORS: Record<string, () => string | undefined>` (thunks preserve lazy evaluation; `?.()` preserves the undefined fallback). Avoid the suffix-parsing variant (behavior change for unknown flags).

### B-4: OpenAI judge transport — net 53 lines

`run-image-benchmark.ts:250-303` and `video-benchmark-judge.ts:85-141` share the whole responses-endpoint plumbing (identical request shape, empty-text check, usage attachment). Add `runOpenAIJudge(model, content, schemaName, schema, emptyMessage, stage)` to `benchmark-utils.ts` (+2 imports there). Content arrays, schemas, and prompt builders stay per-site.

### B-5: `loadMediaRunJson` — net 54 lines

`loadImageRunJson` (96-148) and `loadVideoRunJson` (32-84) are 53-line near-identical functions; every error message differs only in the Image/Video word and array key. Generic `loadMediaRunJson<TEntry>(runDir, kind, label, parseEntry)` in `benchmark-utils.ts` — the parse callbacks already share the exact `(JsonObject, JsonObject, number)` signature (verified).

### B-6: Entrypoint report/ranking logs — net 23 lines

`run-image-benchmark.ts:576-610` and `run-video-benchmark.ts:48-82` end with two identical 34-line `l.write` blocks differing only in the title word. Add `logMediaBenchmarkReports(label, quality, comparison, providers)` to `media-provider-comparison.ts` (+2 imports there; video's `formatScore` import becomes deletable). Both report types derive from `QualityProviderReportBase`, so a structural param type accepts both.

---

## Setup: setup / resume (R)

### R-1: Generation-resume provider-model-field helpers — net 180 lines (done)

Implemented as **Wave 4**; the completion record and verification results live in the wave plan.

### R-2: generation-resume manifest preamble — net 50 lines

`hasResumableGenerationWork` (98-128), `resumeGenerationTarget` (139-171), `priceGenerationTarget` (297-328) repeat the same ~32-line manifest-load/parse/select sequence (the two throwing variants byte-identical, the first returns false instead); the targetsToRun + reconstruct-failure throw is duplicated verbatim at 192-203/334-345. Same-file `prepareGenerationResume(target, config, opts, explicitFlags, throwOnInvalid)` + `resolveGenerationTargetsToRunOrThrow(...)`. `hasExplicitSelectedProviders` derives as `selectedProviders !== undefined` (verified).

### R-3: Reuse exported `runCapture` — net 49 lines

`setup-download/dmg.ts:8-19`, `download.ts:252-263`, `dl-document/acsm.ts:37-65` each define private spawn+capture wrappers duplicating `runCapture` from `run-complete-setup.ts` (acsm's options object exactly matches `RunOptions`; dmg/download's returned stdout is unused at all call sites — verified). Delete all three, import `runCapture` (all 9 call sites are pure renames). **Verified acceptable behavior change:** InfraError stage becomes `'setup:run'` and the message format changes to `formatCommandFailure`'s — no test asserts the old stages/formats (checked; the one 'failed with exit code' assertion targets a different module). The acsm↔run-complete-setup import cycle mirrors the existing calibre/audio pattern and `runCapture` is only called inside functions.

### R-4: `logResumeFull` idiom — net 34 lines

The 10-line success block (logResumeItem 'full' + logResumeSummary + return totals) appears 6× across `generation-resume.ts` (177-189, 255-263, 280-288) and `write-resume.ts` (520-528, 533-541, 644-652). Add `logResumeFull(logger, item, outputDir, providers, detail): ResumeResult` to `resume-logging.ts` (both files already import it). The failed/incomplete+throw variants stay per-site (their error construction differs — see divergence list).

### R-5: stt-resume / ocr-resume plumbing — net 30 lines

Four block pairs duplicated between `extract/stt-resume.ts` and `extract/ocr-resume.ts`: `resolveStoredOutputDir` (byte-identical), `toResumeResult` (byte-identical), `xSourceInput` (STT/OCR word), `selectedXTargetsComplete` (module-specific parse/build functions injected; OCR wraps with `{ includeBlocked: true }`). Move into `provider-batch-resume.ts` with the divergent parse/build functions injected. Moderate divergence risk acknowledged — the extracted blocks are the generic plumbing, not the divergent logic.

---

## Tests (TE)

### TE-1: TTS-contract lifecycle — net 275 lines (done)

Implemented as **Wave 3**; the completion record and verification results live in the wave plan.

### TE-2: load-config round-trip literal — net 84 lines

`config-contracts/load-config-schema.test.ts` contains the same 85-line config literal twice (7-91 as input, 93-177 as toMatchObject expectation — diffed byte-identical). Bind once as `const fullConfig` and use for both. No aliasing hazard (writeTempConfig serializes to a file). The sibling `image-tts-defaults.test.ts` has an analogous 29-line internal clone (195-223 vs 289-317) worth folding into the same change after verifying the surrounding assertions.

### TE-3: grouped-tier tempdir lifecycle — net 68 lines

ocr/stt/url/text/tts report tests each declare the identical 11-line tempDirs+makeTempRoot+afterEach block plus supporting imports. Add `setupTempRoots()` to the dir's `shared.ts` built on the existing `createTempDirTracker`. The same idiom exists in ~25 more test files (media-benchmark, voice-quality, ingest, runtime contracts, setup contracts) — a follow-up sweep at ~5-12 lines per file each, not counted here.

### TE-4: `installMockFetch` reuse — net 54 lines

Four token-identical 16-line inline fetch recorders (`openai-grok-groq.test.ts:77-92, 125-140`; `mistral-elevenlabs.test.ts:82-97, 217-232`) duplicate the existing `installMockFetch`. **Verified safe:** both runners under test call `fetch(url, init)` with string URL and stringified body, so installMockFetch's init-only body reading is correct here. **Excluded (verified):** `mistral-elevenlabs.test.ts:139-154` is part of a 30-line routing mock whose media-download branch deliberately doesn't record — a plain swap would break `calls` indexing. Assertions adapt: authorization moves to a `headers.get` expect, `body` renames to `bodyJson`.

### TE-5: voice-quality fixtures — net 42 lines

`full-mode-audio-judge.test.ts`: 13-line fixture-run setup ×3 (8-21, 62-75, 134-147) and a 20-line tool-call Response literal ×2 (103-122, 177-196, differing only in the arguments JSON). Add `makeAudioJudgeFixtureRun()` and `voiceQualityToolCallResponse(argumentsJson)` to the dir's `shared.ts` (env mutation stays governed by the existing hooks — verified). A `chatCompletionsResponse(message)` builder could shave ~30 more lines from this file's remaining literals.

### TE-6: links-retry scenarios — net 36 lines

Three tests in `links-fetching-retry.test.ts` (35-65, 67-97, 99-128) share a 28-line skeleton, differing in failure kind (thrown error / 503 / 404), expected attempts (2/2/1), and success-vs-failure comment. File-local `expectLinksRetryScenario({outputSlug, failure, alwaysFail?, expectedAttempts, expectSuccess})`; keep three separate `test()` names.

### TE-7: write run.json fixture — net 35 lines

The llama.cpp/groq/minimax step3 fixture is duplicated between `text-report.test.ts:28-87` and `media-benchmark-contracts.test.ts` `writeTextRun` (234-283); timing arrays differ and stay parameters. New `test/test-utils/fixtures/write-run-fixture.ts` `writeTextConsensusRun(runDir, timingSteps)` with its own writeJson. **Note:** the written file contents differ trivially ('text output' vs 'write output') — no assertion reads them (verified), but standardizing is a deliberate fixture change, state it in the commit. Moderate coupling risk between a benchmark test and a consensus test — acceptable today.

### TE-8: cost/timing metadata builder — net 27 lines

ocr/stt/url grouped-tier tests build identical `cost.actual.steps`/`timing.actual.steps` from providerArtifacts (~16-18 lines each; url adds a processingTime filter that is a verified no-op for the other two). Add `costTimingMetadata(artifacts)` to the dir's `shared.ts`; each run.json literal spreads it. tts/text use hand-written steps and stay.

---

## Utils (UT)

### UT-1: step2 single-vs-array in compute-processing-time — net 34 lines

`compute-processing-time.ts:172-239` handles step2 four ways; the extract block and 17-line STT block are each verbatim-duplicated. Replace with one `for (const step2Entry of toArray(input.step2))` loop branching per entry. Mixed-array concern is moot — the union type makes mixed arrays unrepresentable (verified).

### UT-2: extract-timing-steps builders — net 30 lines

`buildSinglePagePdfFallbackStep` (23-64) and `buildRasterizedFallbackStep` (66-107) are 42-line twins; all three builders repeat the 9-line profile-field spread. Merge the fallbacks into `buildFallbackExtractStep(baseParams, {pages, msPerPage, timingNote, adjustment})` + a shared `buildProfileAdjustmentFields(...)`. Preserve that line 47 records `estimation.singlePagePdfFallbackMsPerPage` (not the param). Key-order changes can't break the tests (toMatchObject — verified).

### UT-3: computeActualCosts step2 branching — net 23 lines

`compute-actual-costs.ts:314-365`: the 13-line STT push block is verbatim-duplicated. Same loop rewrite as UT-1; `resolveSttBillingDurationSeconds` is pure (verified) so hoisting is safe. **Known ordering shift:** array-STT entries currently push after partialStep2 entries; the unified loop pushes before — the current ordering is already inconsistent between single/array shapes and the combination can't realistically co-occur.

### UT-4: total-processing-time twins — net 20 lines

`compute-processing-time.ts:77-95` vs `97-116` are token-identical; only the input TS type differs, and both touch only `ocrProviderConcurrency`/`ocrLocalConcurrency`. Keep one with a narrowed two-field structural parameter.

### UT-5: Anthropic/Mistral REST error construction — net 16 lines

`createAnthropicHttpError` (36-58) and `createMistralHttpError` (34-54) share an identical 18-line core. Add `createRestHttpError(response, errorMessagePrefix, buildExtras?)` to `rest-client.ts`. **Do NOT fold in openai-client** without sign-off — it constructs a named `OpenAIRestError` class (error identity change; would add ~35 more if accepted). Gemini/Replicate use distinct class-based errors — leave them.

### UT-6: `resolveTranscriptionModel` copies — net 15 lines

The whisper-path regex + 13-line function exist verbatim in `compute-actual-costs.ts:32-46` and `compute-processing-time.ts:23, 61-75`. Move as an export into `step-2-stt/stt-model-labels.ts` (existing home of `resolveReverbModelLabel`; both files already import from exactly that module — name swap, 0 lines). The third regex copy in `manifest-log-formatting.ts:5` feeds a semantically different resolver and stays.

---

## Suspected accidental divergences (surface to a human, do not silently unify)

These were found while verifying merges — each is a place where two copies differ in a way that looks unintentional. Worth a quick review independent of the dedup work:

1. `ocr-partial-step2.ts` `isPageResult` lacks the confidence-type check its two siblings have (O-3).
2. `ocr-multi-provider-batch.ts` checkpoint metadataErrors map drops `stage`/`status`/`retryAfterMs`/`rawResponseFile` that finalize includes, and does not sanitize `message` where other copies do (O-6 / OCR notes).
3. Firecrawl's error stage is `'extract:firecrawl'` while spider/zyte use `'url:<id>'` (U-1).
4. `run-glm-reader-url.ts` omits the `finalUrl` backfill and author spread the other four URL providers have (U-2).
5. `batch-executor.ts` x-space variant hardcodes `'extract'` where the document variant forwards `commandName` (dead difference today) (D-4).
6. `run-anthropic.ts:13-17` duplicates the API-key check `getAnthropicClientConfig()` performs two lines later (X-1). **Resolved by Wave 10** — the duplicate check was deleted.
7. `run-gemini-image-gen.ts` and `run-grok-image-gen.ts` re-check the env var despite their own package's `ensure*Setup` having run (X-1). **Resolved by Wave 10** — the re-reads now route through the canonical `requireApiKey` and double as the runners' key reads.
8. `elevenlabs-ivc.ts:129-131` attaches only `.status` (no `.headers`) where its five siblings attach both (TT-4).
9. `write-resume.ts` throws hand-built `Error` with `exitCode=2` (591-595, 637-641) where `generation-resume.ts` uses `InfraError(..., { exitCode: 2 })` (R-4).
10. `SttStep2ResolutionOptions` is missing the gemini/together STT keys the CLI accepts (X-4).
11. `ocr-costs.ts` `rowsByKey` does not normalize provider/model before joining match keys, while `manifest-log-metadata.ts` `indexRows` does (lens notes — not a merge candidate, but a grouping-behavior inconsistency).
12. Deepgram's empty-text guard uses `InfraError` where all other TTS runners use `ValidationError` (TT-1 notes). **Still open after Wave 13** — the guard was deliberately left in each runner ahead of the shared pipeline helper, so the difference is preserved verbatim and still wants a human call.

## Reviewed and rejected (do not re-litigate)

Candidates examined and rejected because honest accounting nets under ~15 lines, requires a config-object mega-helper, or merges genuinely divergent behavior:

- **Comic QA repair loop** (`generate-panel-images.ts:201-281` vs `generate-comic-pages.ts:290-371`, ~140 dup lines): a shared helper needs ~18 inputs and per-site repair-prompt callbacks; net ~15-20 at best via a sprawling config object; repair-prompt texts look intentionally different. A full unification of the two generators would be a redesign, not an extraction.
- **STT async-runner whole-file scaffolding** (assemblyai/gladia/happyscribe/soniox ~110 lines each): a generalized `runAsyncSttJobLifecycle` with upload stage could pay off big but per-provider field variance and happyscribe's two-phase export make it a high-risk redesign — flagged for a design pass instead.
- **image-inputs vs video-media-inputs** (~150 parallel lines): behavior differs (silent PNG fallback vs `CLIUsageError` throw), MIME tables and error contracts differ.
- **run-video-gen vs run-music-gen**: already thin wrappers over `runSingleFileTargets`; further merging needs field-key-mapping generics that destroy type safety.
- **define-image/video/music command finalization tails** (~42 lines each): needs a ~14-field config object.
- **models/*.json catalog clones** (llm-config vs ocr-*.json): data, not code; entries can legitimately diverge; a TS generator adds code.
- **config-types vs process-options-types valibot schemas**: the config schema intentionally adds constraints (minValue/picklist); coupling the two validation surfaces is wrong.
- **hosted-ocr throughput vs token profile stores** (~50 dup lines/file): a generic store factory nets ~13 with real divergence risk (different merge semantics/versions/bands; the band boundaries genuinely differ).
- **ocr-run-state vs stt-run-state scaffolding**: OCR re-classifies stored errors, STT tracks local/skipped — parameterizing needs a config-object mega-helper.
- **run-text-benchmark helper variants**: null-vs-undefined semantics and `'llama.cpp'`-vs-`'local'` detection genuinely differ.
- **defuddle-cli vs run-complete-setup spawn capture**: error formatting genuinely differs; net ~13.
- **cheapest-models candidate comparisons** (3 near-copies): the sites intentionally rank on different tuples.
- **WebArticleMetadata assignment ladders** (5 URL providers): field sets/ordering/value sources differ per provider; a shared builder would reorder serialized keys in run.json.
- **collect*TtsTargets for-loop idiom** (12 files, ~45 lines): simplification (map rewrite), not shared-code extraction; each body is provider-specific wiring. Candidate for a `/simplify` pass instead.
- Numerous sub-threshold items (each < 15 net): parseRetryAfterMs variants (semantics differ), `createCombinedSignal` ×3 (~7 net), llama/llamafile state files (schemas differ), url `pickCleanString` (~13), metadata batch-planner/router helpers, `ensureAbsoluteYoutubeUrl` ×2 (~4), `formatVersion` ×2, dispatcher string-flag reads, small write-resume preamble (~11), gemini/anthropic OCR adapter callbacks, spider/zyte import headers, LumalabsGenerationSchema ×2 (~6), replicate-video reject-flag lists (~6), render.ts ASS headers (~8), timing-shared profile spreads (~5-8), aggregate-pricing note pushes, compute-costs switch heads (~14, fights union narrowing), per-domain build*TimingSteps (config-object trap), grouped-tier writer loops (shape callback trap), e2e STT metadata assertion clones (divergence risk across engines), test-runner header boilerplate.

## Provenance

Every finding in this report was double-checked: an analysis agent proposed it with line-level citations, and an independent verifier agent then re-read the cited code and reproduced the claim (line counts, byte-identity comparisons, type equality via throwaway tsc assertions, import-cycle checks, greps for test assertions on changed error strings) and re-did the net-LOC arithmetic before it was accepted. Line numbers reference the tree as of commit `1938efc2` on `staging` and will drift as files change — treat them as anchors, not gospel.
