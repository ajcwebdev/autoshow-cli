# Duplication Extraction Report

Date: 2026-08-08 (wave plan refreshed 2026-08-09). Scope: entire repository (`src/`, `test/`, `scripts/` — ~129k lines of TypeScript in `src/` plus the test suite). Thirty-five extraction waves are complete at **4,645 actual net lines removed**: waves 1–9 took the nine strictly low-risk entries in the top 15 (2,020), waves 10–14 the five largest remaining findings regardless of risk (1,254), waves 15–27 every remaining low-risk finding at 50+ net lines (838 actual vs 868 planned), waves 28–33 the six top backlog entries (454 actual vs 396 planned), and waves 34–35 the last two pre-planned entries (79 actual vs 87 planned).

Everything that survives the current filters — strictly low risk, 36+ estimated net lines — is planned below as **waves 36–48**, ~512 estimated net lines across 13 findings. That is the final set: when those land the report is closed out, and anything left is either recorded as a divergence for a human to rule on or listed as rejected. Anchors in the wave plans were re-verified against the working tree on 2026-08-09.

## Method and accounting rules

The analysis combined a token-based clone scan (jscpd: 375 exact clones, ~5,200 duplicated lines) with 17 area/lens analysis agents, and every candidate finding was then re-verified by an independent adversarial agent that read the cited code and re-did the line accounting. All numbers below are **verified net savings**: `lines removed − new helper lines (including signature, types, blanks, braces) − lines added at call sites (imports, calls, adapters)`. Import lines that merge into an existing import from the same module are counted as 0. A finding was only kept if extraction strictly reduces total line count; anything that broke even or required a sprawling config object was rejected (the rejected candidates are listed at the end so a later pass does not re-litigate them).

The original scan identified ~5,800 removable net lines (~4.5% of the codebase) across 85 deduplicated recommendations; 4,645 have landed. Verification bar after each change: `bun run check`, plus the targeted local tests named per wave.

## Completed waves 1–35 (all landed 2026-08-08)

One finding per wave, self-contained. Every wave landed `bun run check` clean plus its area's named local test suites, and none called a paid provider. Landed IDs are retired from the wave plans below — this table plus the two note blocks under it are the whole record.

| Wave | ID | What landed | Net (actual) |
|---|---|---|---|
| 1 | CLI-1 | `strFlag`/`strListFlag`/`boolFlag` in `flag-utils.ts`; 14 flag tables + `global-flags.ts` collapsed | 551 |
| 2 | G-1 | `logGenStatus`/`logGenCompleted` in `generation-command-utils.ts`; 47 blocks across 18 runners | 293 |
| 3 | TE-1 | `setupTtsContractLifecycle()` in tts-contracts `shared.ts`; 6 test files | 275 |
| 4 | R-1 | Table-driven clear/collect/price helpers in `generation-resume.ts`; 4 resume files keep only `X_MODEL_FIELDS` | 180 |
| 5 | S-2 | Polling-deadline + resume-probe error builders in `async-lifecycle.ts`; 7 providers | 183 |
| 6 | S-3 | `stt-local/run-whispercpp-core.ts`; run-whisper → 48 lines, run-whisperfile → 27 | 135 |
| 7 | O-1 | `estimateTokenPricedOcrCost`; 7 estimators → 6-line wrappers | 143 |
| 8 | T-2 | `TtsOptions`/`ImageGenOptions`/`VideoGenOptions` Pick from `*RuntimeOptionKey` (type-only) | 134 |
| 9 | X-2 | `src/utils/run-with-concurrency.ts` canonical `mapWithConcurrency`; 5 copies deleted | 126 |
| 10 | X-1 | `requireApiKey`/`ensureApiKeySetup` in `env-utils.ts`; 90 guard sites across 93 files | 441 |
| 11 | T-1 | Domain `*-options-types.ts` hold literal types, key unions become `keyof`; `RuntimeOptions` = their intersection + 56 domain-less fields (type-only) | 230 |
| 12 | S-1 | `stt-services/stt-stage-request.ts` (retry + fetch + error + classify + attach + validate); 10 sites; `soniox-utils.ts` deleted; subsumed S-6 outright | 289 |
| 13 | TT-1 | `tts-utils/hosted-tts-chunk-pipeline.ts`; 8 hosted runners pass only a `fetchChunkAudio` closure | 145 |
| 14 | B-1 | 156-entry config-merge ladder → two loops over `PROVIDER_SELECTION_GROUPS` + `FLAG_TO_CONFIG_PATH` | 149 |
| 15 | O-2 | `ocr-utils/hosted-ocr-json.ts` (envelope + JSON schema + `createHostedOcrResponseParser`); gemini/openai adopt fully, anthropic keeps its pageLabel parser on the shared schemas | 97 |
| 16 | D-1 | Generic `pick()` in `cli-utils.ts`; six `build-opts-from-flags/*.ts` builders spread packed `*_MODEL_KEYS` arrays | 160 |
| 17 | TE-2 | `load-config-schema.test.ts`'s twice-written 85-line config literal bound once, plus the sibling `image-tts-defaults` clone | 110 |
| 18 | G-3 | One `ReplicateVideoGenOptions` type replacing 7 inline literals in `run-replicate-video-gen.ts` (type-only) | 75 |
| 19 | U-1 | `fetchUrlProviderJson` + `requireHostedUrlProviderApiKey` in `url-utils.ts`; firecrawl/spider/zyte adopt both, supadata keeps its own key guard | 68 |
| 20 | TE-3 | `setupTempRoots()` in the grouped-tier `shared.ts` (built on `createTempDirTracker`); 5 report tests adopt | 65 |
| 21 | S-5 | `deleteSttRemoteResource` in `async-lifecycle.ts`; rev/speechmatics/soniox cleanup functions became ~11-line wrappers | 60 |
| 22 | CLI-2 | `rewriteLongFlagArgs` in `flag-helpers.ts`; the three selector-normalization rewriters pass their rewrite as a callback | 37 |
| 23 | C-1 | `resolveGroupedReferenceImages` in `panel-prompt-utils.ts`; pages + sketches resolvers adopt, `resolveSketchChunkReferences` deleted | 49 |
| 24 | B-3 | `cheapest-models.ts` 58-arm flag switch → module-level `FLAG_SELECTORS` thunk map (evaluation stays lazy) | 58 |
| 25 | B-5 | Generic `loadMediaRunJson<TEntry>` in `benchmark-utils.ts`; image/video loaders became typed wrappers | 31 |
| 26 | B-4 | `runOpenAIJudge` in `benchmark-utils.ts`; image + video benchmark judges keep only their content-array construction | 16 |
| 27 | R-2 | `prepareGenerationResume` + `resolveGenerationTargetsToRunOrThrow` in `generation-resume.ts`, replacing the triplicated manifest preamble | 12 |
| 28 | S-4 | `sttStageRequest` gains `failureLabel` + `attachError`; assemblyai/gladia's six retry blocks collapse onto it, `sttRetryMetricsToCallbacks` added | 152 |
| 29 | B-2 | `baseMediaComparisonRow` + `writeMediaComparisonReports` in `media-provider-comparison.ts`; image/video comparison writers become 10-line calls | 47 |
| 30 | TT-2 | MiniMax TTS drops its private `concatAndConvertToWav` for `audio-utils`' shared one, plus the imports and merged-mp3 cleanup that died with it | 57 |
| 31 | G-4 | `image-utils/polled-image-http.ts` (5 transport helpers); BFL + Lumalabs adopt all of it, `image-output.ts` the error builder. Polling schemas stay per-provider | 49 |
| 32 | TE-4 | `installMockFetch` replaces all 7 plain inline fetch recorders in `openai-grok-groq.test.ts` and `mistral-elevenlabs.test.ts` | 95 |
| 33 | R-3 | `runCapture` from `run-complete-setup.ts` replaces the private spawn+capture wrappers in `dmg.ts`, `download.ts`, and `dl-document/acsm.ts` | 54 |
| 34 | T-3 | `pricing-types.ts`: new `TokenProfileEstimateFields` ×4, existing `OcrModelOverrideOptions` adopted ×2, `ComputeActualCostsInput` off `ActualPipelineInputsBase`, STT overrides via `Partial<Pick<SttRuntimeOptions, …>>` (type-only) | 46 |
| 35 | C-2 | Five module-local flag helpers in comic `cli-args.ts` (llm-model, size, quality, concurrency, trailing script path) across its three parsers | 33 |

### Behavior deltas accepted while landing

Everything not listed here was behavior-preserving. None of these are known to have broken anything; they are recorded so a later bisect has the history.

- **16** — property insertion order changed in the built opts objects (cosmetic). **23** — sketch refs now carry an unused `characterReferences` field. **26** — the OpenAI config lookup moved after the media files are read (same errors either way).
- **28** — metadata only: AssemblyAI `Retry-After` now uses `~/utils/retries` semantics (no fractional rounding; an already-past date yields `null`, not `0` — a poll backoff hint only); AssemblyAI poll-validation errors gained `stage`/`retryClass`/`rawResponse`; both attach helpers widened `stage` to `string`; Gladia validation errors always set `rawResponse` where the local copy set it only when defined. Every user-facing message stayed byte-identical via `failureLabel`.
- **30** — MiniMax's multi-chunk path is now one ffmpeg pass instead of two: `speech-minimax-merged.mp3` no longer exists (its cleanup entry went too), the error stage moved `tts:minimax` → `tts:audio-utils`, and `'Failed to convert concatenated MiniMax audio to WAV'` is subsumed by the shared concat-failure message.
- **33** — the InfraError stage is `'setup:run'` at all 9 call sites (was `setup:dmg`/`setup:download`/`setup:acsm`) and the message is `formatCommandFailure`'s plus a stderr/stdout tail, replacing each site's trimmed `detail`; no test asserted the old strings. Added a `download.ts` → `run-complete-setup.ts` import cycle — benign, since `runCapture` is referenced only inside function bodies.
- **31, 32, 34, 35** — none observable. 32 also deleted a dead `input instanceof Request` branch and moved its assertions to `headers.get(...)`/`bodyJson`.

### Standing guidance from the landed waves

- **Anchors drift.** The wave plans below carry anchors re-verified on 2026-08-09, but they will drift again. Re-read every site before extracting, and if two copies differ where this report calls them identical, surface it as a divergence rather than unifying.
- **STT error plumbing (waves 12, 28).** `sttStageRequest` takes a per-site `attachError`; the shared unwrapping variant was deliberately not adopted. Do NOT fold in the happyscribe/supadata attach variants or the payload-parsing `toXHttpError` variants. S-6 is fully subsumed — skip it.
- **Deliberately left alone.** The `run-supadata-url.ts` / `x-space-runner.ts` key guards (different user-facing messages); Wave 9's excluded pools (`runTtsChunks`, split-execution, `runPool`, stt-batch-coordinator, OCR ordered); G-3's aleph one-line literal; tts-options' 8 destructured validation names (Wave 16 — kitten maps to differently-named return keys); `image-output.ts`'s `downloadImageUrl` (Wave 31 — message, accept header, and extension derivation genuinely differ).
- **Divergence status.** 6 and 7 resolved by Wave 10. 3 (firecrawl's `'extract:firecrawl'` stage) preserved via Wave 19's stage parameter and 12 (Deepgram's `InfraError` empty-text guard) preserved per-runner by Wave 13 — both still want a maintainer decision.
- **Follow-ups spawned but not taken.** The other five `image-tts-defaults` tests have the same input-vs-expectation clone (TE-2); the tempdir idiom exists in ~25 more test files at ~5–12 lines each (TE-3); fal image/video options types (~12 combined, G-3); `readJsonOrText` has 3 more copies in STT services that would join `polled-image-http.ts`'s if a `src/utils` home is ever chosen (G-4); glm-reader as a fifth U-1/U-2 site (behavior change — ask first, see divergence 4); the three control-flow fetch mocks in `openai-grok-groq.test.ts` could adopt `installMockFetch`'s `(call, input, init)` handler for ~6 lines each (TE-4).
- **Proof techniques worth reusing.** A throwaway guard file asserting old-vs-new type equality for type migrations (waves 8, 11, 34 — include a negative control, since `exactOptionalPropertyTypes` equalities are easy to get subtly wrong), and a differential harness against the pre-change implementation for behavior-preserving rewrites (wave 14 at 420 cases, wave 29 over image/video fixtures, wave 35 at 86 argv cases — all byte-identical).
- **Estimates are ceilings, not forecasts.** Two systematic biases, both now well attested. Extract-a-new-helper findings *miss* their estimate, because each helper pays a signature and each call site pays a call (B-4 16 vs 53, B-5 31 vs 54, R-2 12 vs 50, B-2 47 vs 74, G-4 49 vs 55, C-2 33 vs 40). Adopt-an-existing-export findings *beat* it, because there is no helper to pay for and the estimate misses both the sites stale anchors hid and the private helpers/imports that die with the copies (TE-4 95 vs 45, R-3 54 vs 49, TT-2 57 vs 53). The one other overshoot, S-4 at 152 vs 120, is the same shape from a different angle: collapsing a `try/withRetry/catch` deletes its scaffolding too, which an estimate counting only the duplicated body will miss. Waves 36, 42, 43, 46 are adopt-an-export shape and should beat their numbers; 37, 39, 41, 44, 45, 47 are new-helper shape and should miss them.

## The final backlog

Three filters have been applied, so everything below is **low risk**, **36+ estimated net lines**, and planned as a concrete wave:

- **Risk.** Only findings the verifier rated strictly low risk remain. Dropped: W-3 (llama/llamafile completion clients, low-mod), X-6 (`minimaxFetch` glue, med-low — changes InfraError metadata), TE-7 (shared write run.json fixture, mod — couples a benchmark test to a consensus test), R-5 (stt-resume/ocr-resume plumbing, mod — divergent parse/build logic). These are still real duplication; they need a design call rather than a mechanical extraction, so re-derive them from the code if one is ever picked up.
- **Size.** Findings estimated at 35 net lines or fewer were dropped as not worth a dedicated pass — at that size an extract-a-new-helper change routinely lands near break-even (see the estimate-bias note above), so the win is single-point-of-maintenance rather than line count. Dropped: R-4, UT-1, O-4, CLI-3, X-4, D-3, C-3, UT-2, O-5, D-4, TE-8, C-4, TT-5, B-6, UT-3, M-2, UT-4, plus the earlier sub-20 batch (TT-4, C-5, U-3, X-8, D-5, D-6, M-3, U-4, X-7, C-6, UT-5, UT-6, W-5, O-6). Pick one up only as a ride-along when already touching its files.
- **Planned.** Each survivor has a wave below. There is no unplanned backlog left.

| Wave | ID | Recommendation | Est. net | Shape |
|---|---|---|---|---|
| 36 | S-7 | happyscribe.ts reimports 4 happyscribe-utils helpers | 44 | adopt export |
| 37 | W-1 | llama stderr download-watch + startup-failure error builder | 43 | new helper |
| 38 | TE-5 | voice-quality judge fixture + tool-call response builders | 42 | new helper (test-only) |
| 39 | W-2 | llama vs llamafile health-check/poll machinery | 41 | new module |
| 40 | T-4 | LLM model key list triplication (`ResolvedLLMConfig`/`LLMOptions`) | 40 | type-only |
| 41 | X-5 | transcript-video / lyrics-video path + timestamp helpers | ~40 | new helper |
| 42 | X-3 | `isRecord`: 42 local copies of `rest-client.isRecord` | 39+ | adopt export |
| 43 | T-5 | `Estimate*CostOptions` re-declare ProcessingOptions shapes longhand | 39 | type-only |
| 44 | G-5 | `captions.ts` parseVtt/parseSrt merge | 38 | new helper |
| 45 | M-1 | frontmatter renderObject/renderArray shared branch tree | 38 | new helper |
| 46 | O-3 | OCR type-guard copies (isPageResult/isHostedOcrRun/getUsageNumber) | 36 − overlap | adopt export |
| 47 | U-2 | `runXUrl` result-finalization wrapper (4 providers) | 36 | new helper |
| 48 | TE-6 | links-fetching-retry: 3 near-identical scenario tests | 36 | new helper (test-only) |

**Ordering constraints.** Only three exist; the rest are independent and can land in any order.

1. **42 before 46.** Both touch `isRecord` in OCR files. Wave 42 sweeps every exact copy including the OCR ones, so wave 46 is left with `isPageResult`/`isHostedOcrRun`/`getUsageNumber` only and will take ~8 lines less than its table estimate. Do not count those 8 lines twice.
2. **41 before 44.** Both edit `captions.ts`; 41 exports `formatCaptionTimestamp` and adds `hmsPartsToSeconds`, 44 merges `parseVtt`/`parseSrt`. Either order works but 41 first avoids re-reading a file mid-merge.
3. **37 before 39** if both are taken in one sitting — they touch overlapping regions of `llamafile-server.ts` and the llama server files.

---

## Wave plans 36–48

Same convention as waves 1–35: one finding per wave, self-contained, `bun run check` clean before it is called done. Named test suites are local contract suites; none of them call a paid provider, and no wave below needs a provider run to verify. Anchors are as of 2026-08-09.

### Wave 36 — S-7: happyscribe.ts reimports its own utils — est. net 44

**Duplication.** `stt-services/happyscribe/happyscribe.ts` privately redefines four helpers that `happyscribe-utils.ts` in the same directory already has: `isRecord` (happyscribe.ts:11 vs utils:3), `normalizeId` (14 vs utils' `normalizeHappyScribeId`:6), `readJsonOrText` (45 vs utils' `readHappyScribeJsonOrText`:26), and `extractErrorMessage` (58 vs utils' *private* `extractHappyScribeErrorMessage`:39). Bodies are byte-for-byte, including the same key-preference list in the error-message extractor.

**Implementation.**

1. In `happyscribe-utils.ts`, add the `export` keyword to `extractHappyScribeErrorMessage` (line 39). Nothing else in that file changes; its own use at line 85 is unaffected.
2. In `happyscribe.ts`, delete lines 11–13, 14–22, 45–57, and 58–76 (the four private definitions) and add one import from `'./happyscribe-utils'` for `isRecord`, `normalizeHappyScribeId`, `readHappyScribeJsonOrText`, `extractHappyScribeErrorMessage`.
3. Rename the three call sites whose names change: `normalizeId(` at line 29, `readJsonOrText(` at 127, `extractErrorMessage(` at 131. The three `isRecord(` sites (25, 64, 147) need no edit.
4. Confirm no cycle: `happyscribe-utils.ts` must not import `happyscribe.ts` (it does not today).

**Note for sequencing.** Importing `isRecord` from `happyscribe-utils` stays correct after wave 42, which converts that file's definition into a re-export of `rest-client`'s.

**Verify.** `bun run check`; `bun test test/test-cases/validation/extract-stt/`.

### Wave 37 — W-1: llama stderr watch + startup-failure error builder — est. net 43

**Duplication.** The stderr-watch block (tail slice, line buffering, `stripAnsi` per line, download-progress watch) is duplicated between `write-local/llama/llama-model-download.ts:65-95` and `write-local/llama/llama-server-runtime.ts:42-78`. Separately, the two-branch startup-failure `InfraError` construction appears in both (`llama-model-download.ts:99-115`, `llama-server-runtime.ts:79-98`) and a third time in `write-local/llamafile/llamafile-server.ts:234-252`.

**Implementation.** Both helpers go in `write-local/llama/llama-download-progress.ts` — all three files already import it (llamafile-server.ts:8 pulls `collectStreamTail`/`stripAnsi` from it).

1. `watchLlamaServerStderr(stream, tailLimit): { getTail(): string, stop(): void }` — wraps `collectStreamTail` with the tail slice, line buffer, per-line `stripAnsi`, and the `parseDownloadInfo`/`startDownloadProgressWatch` hookup. Adopted by the two llama sites only.
2. `throwIfServerStartupFailed(health, tail, timeoutMs, { serverLabel, stderrLabel, stage })` — reproduces all four existing messages from two labels: `` `${serverLabel} exited before becoming healthy (exit code ${exitLabel}).\n${stderrLabel} stderr:\n${details}` `` and `` `${serverLabel} failed to become healthy within ${timeoutSeconds} seconds.\n${stderrLabel} stderr (tail):\n${details}` ``, with the no-detail fallback per branch. llama passes `serverLabel: 'llama-server'`, `stderrLabel: 'llama-server'`, stage `'write:llama'` or `'write:llama-download'`; llamafile passes `'llamafile server'`, `'llamafile'`, and its own stage. Verified: those two label fields reproduce every string byte-identically.

**Exclusions.** llamafile's stderr watcher (`llamafile-server.ts:225-231`) is genuinely different — it strips ANSI over the whole chunk rather than per line, has no line buffering and no download watch, and uses its own tail limit. It keeps its 3-line inline watcher and adopts only helper 2.

**Budget honestly.** ~62–65 helper lines including the exported health-result union, the closures, and imports — the verifier corrected the original estimate down to 43 on that basis.

**Before landing.** Grep the test tree for the four message prefixes; the plan assumes no suite asserts them.

**Verify.** `bun run check`; `bun test test/test-cases/validation/cli/cli-help-contracts.test.ts`.

### Wave 38 — TE-5: voice-quality judge fixtures — est. net 42

**Duplication.** `test/test-cases/validation/reports-pricing/voice-quality-report-contracts/full-mode-audio-judge.test.ts` repeats a 13-line fixture-run setup three times and a 20-line tool-call `Response` literal twice (the `new Response` sites are at 30, 83, 103, 156, 177, 212; the two tool-call literals differ only in the arguments JSON).

**Implementation.** Add to that directory's existing `shared.ts`:

1. `makeAudioJudgeFixtureRun()` — the run-directory + run.json fixture setup, returning whatever the three call sites destructure today.
2. `voiceQualityToolCallResponse(argumentsJson)` — the tool-call envelope with the arguments JSON injected.

Env mutation stays governed by the suite's existing hooks — verified; do not move `process.env` handling into the builders.

**Follow-up not in scope.** A `chatCompletionsResponse(message)` builder would shave ~30 more lines from this file's remaining literals; leave it unless it falls out naturally.

**Verify.** `bun run check`; `bun test test/test-cases/validation/reports-pricing/voice-quality-report-contracts/`.

### Wave 39 — W-2: llama vs llamafile health machinery — est. net 41

**Duplication.** Five function pairs across `write-local/llama/llama-server-process.ts` (222 lines) and `write-local/llamafile/llamafile-server.ts` (283 lines): `getErrorCode` (13 vs 21), `isPidRunning` (47 vs 59), the quiet health check (`checkLlamaHealthQuiet`:16 vs `checkLlamafileHealthQuiet`:68 — base URL differs), the health-state waiter (`waitForLlamaHealthState`:32 vs `waitForHealthState`:103 — operation name differs), and the health waiter (`waitForLlamaHealth`:145 vs `waitForLlamafileHealth`:118 — constants and labels differ).

**Implementation.**

1. New `write-local/shared/local-server-health.ts` holding the five, parameterized by base URL, operation name, timing constants, and label.
2. `llama-server-process.ts` keeps thin wrappers under its existing exported names (`checkLlamaHealthQuiet`, `waitForLlamaHealth`) — both are consumed by other files, so the export surface must not change.
3. `llamafile-server.ts` calls the shared functions directly where its versions were private.

**Do NOT merge.** `stopRecordedDefaultLlamaServer` (llama-server-process.ts:71) vs `stopRecordedLlamafileServer` (llamafile-server.ts:168): llama waits for pid exit and throws on failure, llamafile unconditionally clears state after SIGKILL. That divergence may be intentional — leave both. Likewise leave llamafile's state file helpers (`getStatePath`/`readState`/`writeState`/`clearState`, 24-58) alone; the two state schemas differ.

**Verify.** `bun run check`; `bun test test/test-cases/validation/cli/cli-help-contracts.test.ts`.

### Wave 40 — T-4: LLM model key triplication — est. net 40, type-only

**Duplication.** The 24 LLM model keys are written out four times: the valibot schema in `types/pipeline-core/process-options-types.ts` (the source of truth for `ProcessingOptions`), the `RuntimeOptions` block at `types/cli-surface/cli-types.ts:19-42`, `ResolvedLLMConfig` at `types/cli-surface/cli-dir-types.ts:51-78`, and the `LLMOptions` Pick list at `types/write-workflow/write-types.ts:3-33`.

**Implementation.**

1. Rewrite `ResolvedLLMConfig` as `Pick<RuntimeOptions, …24 keys packed onto few lines> & { llmService: string | undefined, llmModel: string | undefined }`. `LLMModelOptionKey` (`types/download-workflow/model-option-llm-defaults-types.ts:3`) is `Exclude<keyof ResolvedLLMConfig, 'llmService' | 'llmModel'>` and survives the rewrite unchanged, as does `ResolvedLLMModelOptions` built on it.
2. In `write-types.ts`, replace the 24 model-key lines of the `LLMOptions` Pick with a single `| LLMModelOptionKey` member, keeping `outputDir`/`prompts`/`promptFile`/`promptMd`/`llmProviderConcurrency`/`llmLocalConcurrency`.

**Correction to the original finding.** `LLMOptions` picks from `ProcessingOptions`, not `RuntimeOptions`, so step 2 requires `LLMModelOptionKey ⊆ keyof ProcessingOptions`. Verified: all 24 keys exist in the valibot schema (12 provider families × `xModel`/`xModels`).

**Proof.** Throwaway tsc file asserting mutual assignability of the old and new `ResolvedLLMConfig` and `LLMOptions`, with a negative control — `exactOptionalPropertyTypes` equalities are easy to get subtly wrong (waves 8, 11, 34).

**Verify.** `bun run check`; `bun test test/test-cases/validation/cli/option-resolution-contracts/`.

### Wave 41 — X-5: shared path + timestamp helpers — est. net ~40

**Duplication, two independent halves.**

*Paths.* `step-2-extract/transcript-video/run-transcript-video.ts` (PROJECT_ROOT:18, `toPosixPath`:27, `toProjectDisplayPath`:30, `resolveUserPath`:39, `baseStem`:64) and `step-7-music/lyrics-video/run-lyrics-video.ts` (PROJECT_ROOT:27, `resolveUserPath`:47, `toPosixPath`:50, `toProjectDisplayPath`:53, `baseStem`:79) define the same five with identical bodies. Both local `PROJECT_ROOT`s are `resolve(import.meta.dir, '../../../../../../')`, which resolves to the same repo root as the existing export at `utils/runtime-paths.ts:5` — verified by counting directory levels from each file.

*Timestamps.* `run-transcript-video.ts`'s `formatCueTimestamp` (316) is exactly `captions.ts`'s unexported `formatCaptionTimestamp(seconds, '.')` (`step-7-music/lyrics-video/captions.ts:41`), and its `parseTimestampToSeconds` (151) shares an identical validation/arithmetic body with `parseCaptionTimestamp` (captions.ts:16) — only the regexes differ (optional 1–3-digit ms vs required 3-digit).

**Implementation.**

1. Move `toPosixPath`, `toProjectDisplayPath`, `resolveUserPath`, `baseStem` into `utils/runtime-paths.ts` beside `PROJECT_ROOT`; both renderers import them and drop their local `PROJECT_ROOT`.
2. In `captions.ts`, export `formatCaptionTimestamp` and add `hmsPartsToSeconds(h, m, s, ms)` holding the shared validation/arithmetic. Both parse functions keep their own regexes and shrink to match-then-call. Delete `formatCueTimestamp`; its two call sites (306, 307) become `formatCaptionTimestamp(x, '.')` — `run-transcript-video.ts` already imports from `captions.ts`.

**Exclusions.** `text-input-utils.ts`'s `toProjectDisplayPath` returns `./${rel}` — a different display convention; keep it local and flag it if that looks accidental. `run-lyrics-video.ts`'s `DEFAULT_INPUT_ROOT` and its `isWithinDir` guard stay local. The two timestamp grammars stay distinct on purpose.

**Verify.** `bun run check`; `bun test test/test-cases/validation/content-output/metadata-links-lyrics-contracts/ test/test-cases/validation/music/`.

### Wave 42 — X-3: `isRecord` copies — est. net 39+

**Duplication.** `const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)` — the exact-signature grep now returns **44** definitions in `src/`: the canonical export at `utils/rest-client.ts:8`, the excluded copy at `utils/error-handler.ts:223`, and **42 sweepable copies** (the finding was written at 39; it has grown). Six of the copies are themselves exported: `download-batch/batch-manifest.ts:13`, `stt-supadata/supadata-response-parsers.ts:3`, `happyscribe/happyscribe-utils.ts:3`, `ocr-utils/pdf-chunk-fallback-shared.ts:15`, `write-manifest-log/manifest-log-metadata.ts:4`, `step-2-url/url-utils.ts:15`.

**Implementation.**

1. Re-run the grep and reconcile against the exclusion list before counting — the number moves.
2. Non-exported copies: delete the definition, import `isRecord` from `~/utils/rest-client` (free when the file already imports from that module).
3. The six exported copies: replace with `export { isRecord } from '~/utils/rest-client'` so their importers are untouched.

**Exclusions (load-bearing).** `utils/error-handler.ts:223` stays — `rest-client` imports `error-handler`, so importing back would cycle. The loose variants without `!Array.isArray` (e.g. `gemini-rest.ts`) behave differently on arrays and stay. `benchmark/benchmark-utils.ts`'s `JsonObject`-typed variant stays.

**Accounting.** Two lines removed per file, one import/re-export line added: ~42 net at the current count.

**Verify.** `bun run check` is the real gate here (it type-checks every touched file); plus `bun test test/test-cases/validation/cli/option-resolution-contracts/`.

### Wave 43 — T-5: `Estimate*CostOptions` longhand shapes — est. net 39, type-only

**Duplication.** Three types re-declare `ProcessingOptions` field shapes longhand: `EstimateVideoCostOptions` (`types/video-workflow/video-types.ts:26-55`), `EstimateImageCostOptions` (`types/image-workflow/image-types.ts:20-40`), `EstimateMusicCostOptions` (`types/music-workflow/music-pricing-types.ts:1-11`). They are tsc-provably identical to the corresponding `Pick<ProcessingOptions, …>` — valibot's `v.optional(schema, undefined)` infers `?: T | undefined`, which is what each hand-written field says.

**Implementation.** Rewrite each as a `Pick<ProcessingOptions, …>`. Video keeps a 4-field literal intersection for its non-`ProcessingOptions` estimate inputs — verified against the schema, exactly `grokInputImageCount`, `grokInputVideoDurationSeconds`, `replicateVideoReferenceVideoCount`, `replicateInputVideoDurationSeconds`; note `replicateVideoGenerateAudio` *is* in `ProcessingOptions` and belongs in the Pick, not the literal. `music-pricing-types.ts` needs one new import line.

**Proof.** Same throwaway type-equality guard as wave 40, with a negative control.

**Verify.** `bun run check`; `bun test test/test-cases/validation/reports-pricing/price-mode-contracts/`.

### Wave 44 — G-5: captions parseVtt/parseSrt — est. net 38

**Duplication.** `step-7-music/lyrics-video/captions.ts:69-110` (`parseVtt`) and `111-145` (`parseSrt`) are byte-identical except for the WEBVTT/NOTE block skip and the `'VTT'`/`'SRT'` word in messages.

**Implementation.** Single `parseCaptionCues(raw, format: 'vtt' | 'srt')` with a format-guarded header/NOTE skip and the format word interpolated into messages. `loadCaptionFile` (146) passes the format at each of its call sites.

**Sequencing.** Land after wave 41, which also edits this file.

**Verify.** `bun run check`; `bun test test/test-cases/validation/music/ test/test-cases/validation/content-output/metadata-links-lyrics-contracts/`.

### Wave 45 — M-1: frontmatter renderEntry — est. net 38

**Duplication.** `step-0-metadata/format-metadata-frontmatter.ts` `renderObject` (31-71) and `renderArray` (72-108) share the same four-way branch tree over scalar / plain-object / array / fallback. Every emitted line is `${prefix} <suffix>`, where the prefix is `${indent}${key}:` in the object case and `${indent}-` in the array case.

**Implementation.** Private `renderEntry(entry: unknown, prefix: string, indentLevel: number): string[]`; both functions become a loop that computes its prefix and concatenates `renderEntry`'s output.

**Preserve the asymmetry.** `renderObject` skips undefined values per key; `renderArray` lets undefined elements fall through to the quoted-`'undefined'` fallback. Keep the skip in `renderObject`'s loop, not inside `renderEntry` — moving it changes array output.

**Verify.** `bun run check`; `bun test test/test-cases/validation/content-output/`.

### Wave 46 — O-3: OCR type-guard copies — est. net 36 minus wave-42 overlap

**Duplication.** In `step-2-extract/step-2-ocr/`: `isPageResult` ×3 (`ocr-partial-step2.ts:15`, `ocr-utils/hosted-ocr-utils.ts:114`, `ocr-utils/pdf-chunk-fallback-state.ts:27`), `isHostedOcrRun` ×2 (`ocr-partial-step2.ts:21`, `pdf-chunk-fallback-state.ts:34`), `getUsageNumber` ×2 (`ocr-partial-step2.ts:29`, `ocr-costs.ts:366`), plus nine files carrying local `isRecord` copies.

**Implementation.**

1. Make `ocr-utils/hosted-ocr-utils.ts` the canonical home: export its `isPageResult`, and move `isHostedOcrRun` and `getUsageNumber` there. The other files import from it. Cycle-checked safe.
2. The `isRecord` copies in this directory are wave 42's; if 42 has landed, this wave touches none of them and takes ~8 lines less than the table estimate. Do not count them twice.

**Behavior flag (must be called out in the change).** `ocr-partial-step2.ts`'s `isPageResult` lacks the `confidence === undefined || typeof confidence === 'number'` clause its two siblings have. Unifying makes partial-metadata parsing stricter for malformed confidence fields. It looks like an accidental omission, but it is a real behavior change — state it explicitly rather than burying it.

**Verify.** `bun run check`; `bun test test/test-cases/validation/extract-ocr/ocr-resilience-contracts/`.

### Wave 47 — U-2: `runXUrl` finalization wrapper — est. net 36

**Duplication.** Four exported entry wrappers are byte-identical modulo the scrape call, the backend word, and the local result variable name: `firecrawl/run-firecrawl-url.ts:107-129`, `spider/run-spider-url.ts:116-138`, `zyte/run-zyte-url.ts:124-146`, `url-supadata/run-supadata-url.ts:74-96`. Each does: log line → provider scrape → `tryFetchRemoteHtml` → `ensureMeaningfulMarkdown` → `sourceUrl`/`finalUrl` backfill → the same 5-key return with a conditional `author` spread.

**Implementation.** Add `finalizeUrlArticleResult(source, sourceUrl, backend, scraped)` to `step-2-url/url-utils.ts` covering everything from `tryFetchRemoteHtml` through the return. Each wrapper keeps its log line and scrape call and ends in a single `return finalizeUrlArticleResult(...)` — roughly 23 lines down to 9.

**Flag, do not fix here (divergence 4).** `glm-reader/run-glm-reader-url.ts:83-103` is the same wrapper minus the `finalUrl` backfill and the `author` spread, and it reads `glmResult.preparedMarkdown` where the others read `.markdown`. Adopting it as a fifth site saves ~12 more lines but changes GLM's output — ask a maintainer first.

**Verify.** `bun run check`; `bun test test/test-cases/validation/ingest/html-url-backends-contracts/`.

### Wave 48 — TE-6: links-retry scenarios — est. net 36

**Duplication.** Three tests in `test/test-cases/validation/content-output/metadata-links-lyrics-contracts/links-fetching-retry.test.ts` (35, 67, 99) share a ~28-line skeleton, differing only in failure kind (thrown error / 503 / 404), expected attempt count (2 / 2 / 1), and whether the run is expected to succeed.

**Implementation.** File-local `expectLinksRetryScenario({ outputSlug, failure, alwaysFail?, expectedAttempts, expectSuccess })`. Keep three separate `test()` calls with their current names so failures still name the scenario. The two later tests in the file (130, 158) exercise different behavior and stay as they are.

**Verify.** `bun run check`; `bun test test/test-cases/validation/content-output/metadata-links-lyrics-contracts/links-fetching-retry.test.ts`.

---

## Suspected accidental divergences (surface to a human, do not silently unify)

These were found while verifying merges — each is a place where two copies differ in a way that looks unintentional. Worth a quick review independent of the dedup work, including the ones whose dedup finding has since been dropped from the backlog.

1. `ocr-partial-step2.ts` `isPageResult` lacks the confidence-type check its two siblings have (wave 46 forces the call).
2. `ocr-multi-provider-batch.ts` checkpoint metadataErrors map drops `stage`/`status`/`retryAfterMs`/`rawResponseFile` that finalize includes, and does not sanitize `message` where other copies do (verified accidental — the source `buildMetadataErrorEntries` already emits all 14 fields; the O-6 unification that would have fixed this was dropped from the backlog).
3. Firecrawl's error stage is `'extract:firecrawl'` while spider/zyte use `'url:<id>'` (U-1). **Preserved verbatim by Wave 19** — still wants a maintainer decision.
4. `run-glm-reader-url.ts` omits the `finalUrl` backfill and author spread the other four URL providers have, and reads `preparedMarkdown` rather than `markdown` (wave 47).
5. `batch-executor.ts` x-space variant hardcodes `'extract'` where the document variant forwards `commandName` — a dead difference today; the D-4 merge that would have deleted the variant was dropped from the backlog.
6. `run-anthropic.ts:13-17` duplicated the API-key check `getAnthropicClientConfig()` performs two lines later (X-1). **Resolved by Wave 10** — the duplicate check was deleted.
7. `run-gemini-image-gen.ts` and `run-grok-image-gen.ts` re-checked the env var despite their own package's `ensure*Setup` having run (X-1). **Resolved by Wave 10** — the re-reads now route through the canonical `requireApiKey` and double as the runners' key reads.
8. `elevenlabs-ivc.ts:129-131` attaches only `.status` (no `.headers`) where its five siblings attach both (found while verifying the since-dropped TT-4).
9. `write-resume.ts` throws hand-built `Error` with `exitCode=2` (591-595, 637-641) where `generation-resume.ts` uses `InfraError(..., { exitCode: 2 })` (the R-4 dedup was dropped for size).
10. `SttStep2ResolutionOptions` is missing the gemini/together STT keys the CLI accepts (the X-4 dedup was dropped for size; the type gap is real regardless).
11. `ocr-costs.ts` `rowsByKey` does not normalize provider/model before joining match keys, while `manifest-log-metadata.ts` `indexRows` does (lens notes — not a merge candidate, but a grouping-behavior inconsistency).
12. Deepgram's empty-text guard uses `InfraError` where all other TTS runners use `ValidationError` (TT-1 notes). **Still open after Wave 13** — the guard was deliberately left in each runner ahead of the shared pipeline helper, so the difference is preserved verbatim and still wants a human call.
13. `text-input-utils.ts`'s `toProjectDisplayPath` returns `./${rel}` where both video renderers return a bare relative path (wave 41 keeps it local rather than unifying).

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
- ~~parseRetryAfterMs variants (semantics differ)~~ — moot after Wave 28 deleted AssemblyAI's copy; `~/utils/retries`' export is now the only definition in `src/`.
- Numerous sub-threshold items (each < 15 net): `createCombinedSignal` ×3 (~7 net), llama/llamafile state files (schemas differ), url `pickCleanString` (~13), metadata batch-planner/router helpers, `ensureAbsoluteYoutubeUrl` ×2 (~4), `formatVersion` ×2, dispatcher string-flag reads, small write-resume preamble (~11), gemini/anthropic OCR adapter callbacks, spider/zyte import headers, LumalabsGenerationSchema ×2 (~6), replicate-video reject-flag lists (~6), render.ts ASS headers (~8), timing-shared profile spreads (~5-8), aggregate-pricing note pushes, compute-costs switch heads (~14, fights union narrowing), per-domain build*TimingSteps (config-object trap), grouped-tier writer loops (shape callback trap), e2e STT metadata assertion clones (divergence risk across engines), test-runner header boilerplate.

## Provenance

Every finding in this report was double-checked: an analysis agent proposed it with line-level citations, and an independent verifier agent then re-read the cited code and reproduced the claim (line counts, byte-identity comparisons, type equality via throwaway tsc assertions, import-cycle checks, greps for test assertions on changed error strings) and re-did the net-LOC arithmetic before it was accepted. The wave plans above were re-anchored against the working tree on 2026-08-09; five estimates were corrected in the process (X-3's copy count 39 → 42, T-4's `LLMOptions` base type, T-5's video literal-field set, W-1's llamafile watcher exclusion, U-2's `preparedMarkdown` difference). Anchors will drift again — treat them as starting points, not gospel.
