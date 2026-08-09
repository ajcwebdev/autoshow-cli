# Duplication Extraction Report

Date: 2026-08-08. Scope: entire repository (`src/`, `test/`, `scripts/` — ~129k lines of TypeScript in `src/` plus the test suite). Thirty-five extraction waves are complete at **4,645 actual net lines removed**: waves 1–9 took the nine strictly low-risk entries in the top 15 (2,020), waves 10–14 the five largest remaining findings regardless of risk (1,254), waves 15–27 every remaining low-risk finding at 50+ net lines (838 actual vs 868 planned), waves 28–33 the six top backlog entries (454 actual vs 396 planned), and waves 34–35 the last two pre-planned entries (79 actual vs 87 planned). The completed-waves table below is the historical record; the rest of the report is the reference backlog (~1,130 estimated net lines across 34 findings) for later passes. No wave is currently planned — pick the next one off the backlog table and re-verify its anchors first.

## Method and accounting rules

The analysis combined a token-based clone scan (jscpd: 375 exact clones, ~5,200 duplicated lines) with 17 area/lens analysis agents, and every candidate finding was then re-verified by an independent adversarial agent that read the cited code and re-did the line accounting. All numbers below are **verified net savings**: `lines removed − new helper lines (including signature, types, blanks, braces) − lines added at call sites (imports, calls, adapters)`. Import lines that merge into an existing import from the same module are counted as 0. A finding was only kept if extraction strictly reduces total line count; anything that broke even or required a sprawling config object was rejected (the rejected candidates are listed at the end so a later pass does not re-litigate them).

The original scan identified ~5,800 removable net lines (~4.5% of the codebase) across 85 deduplicated recommendations; 4,645 have landed. Verification bar after each change: `bun run check`, plus the targeted local tests named per finding.

## Completed waves 1–35 (all landed 2026-08-08)

One finding per wave, self-contained. Every wave landed `bun run check` clean plus its area's named local test suites, and none called a paid provider. Landed IDs are retired from the per-area sections below — this table plus the two note blocks under it are the whole record.

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

- **Anchors drift.** Line numbers below are as of `1938efc2`; waves 28–35 have since moved the STT, benchmark, TTS, image, setup-download, tts-contract-test, pricing-type, and comic-cli-args files. Re-read every site before extracting, and if two copies differ where this report calls them identical, surface it as a divergence rather than unifying.
- **STT error plumbing (waves 12, 28).** `sttStageRequest` takes a per-site `attachError`; the shared unwrapping variant was deliberately not adopted. Do NOT fold in the happyscribe/supadata attach variants or the payload-parsing `toXHttpError` variants. S-6 is fully subsumed — skip it.
- **Deliberately left alone.** The `run-supadata-url.ts` / `x-space-runner.ts` key guards (different user-facing messages); Wave 9's excluded pools (`runTtsChunks`, split-execution, `runPool`, stt-batch-coordinator, OCR ordered); G-3's aleph one-line literal; tts-options' 8 destructured validation names (Wave 16 — kitten maps to differently-named return keys); `image-output.ts`'s `downloadImageUrl` (Wave 31 — message, accept header, and extension derivation genuinely differ).
- **Divergence status.** 6 and 7 resolved by Wave 10. 3 (firecrawl's `'extract:firecrawl'` stage) preserved via Wave 19's stage parameter and 12 (Deepgram's `InfraError` empty-text guard) preserved per-runner by Wave 13 — both still want a maintainer decision.
- **Follow-ups spawned but not taken.** The other five `image-tts-defaults` tests have the same input-vs-expectation clone (TE-2); the tempdir idiom exists in ~25 more test files at ~5–12 lines each (TE-3); fal image/video options types (~12 combined, G-3); `readJsonOrText` has 3 more copies in STT services that would join `polled-image-http.ts`'s if a `src/utils` home is ever chosen (G-4); glm-reader as a fifth U-1/U-2 site (behavior change — ask first, see divergence 4); the three control-flow fetch mocks in `openai-grok-groq.test.ts` could adopt `installMockFetch`'s `(call, input, init)` handler for ~6 lines each (TE-4).
- **Proof techniques worth reusing.** A throwaway guard file asserting old-vs-new type equality for type migrations (waves 8, 11, 34 — include a negative control, since `exactOptionalPropertyTypes` equalities are easy to get subtly wrong), and a differential harness against the pre-change implementation for behavior-preserving rewrites (wave 14 at 420 cases, wave 29 over image/video fixtures, wave 35 at 86 argv cases — all byte-identical).
- **Estimates are ceilings, not forecasts.** Two systematic biases, both now well attested. Extract-a-new-helper findings *miss* their estimate, because each helper pays a signature and each call site pays a call (B-4 16 vs 53, B-5 31 vs 54, R-2 12 vs 50, B-2 47 vs 74, G-4 49 vs 55, C-2 33 vs 40) — below ~30 estimated lines the honest win is single-point-of-maintenance, not line count. Adopt-an-existing-export findings *beat* it, because there is no helper to pay for and the estimate misses both the sites stale anchors hid and the private helpers/imports that die with the copies (TE-4 95 vs 45, R-3 54 vs 49, TT-2 57 vs 53). The one other overshoot, S-4 at 152 vs 120, is the same shape from a different angle: collapsing a `try/withRetry/catch` deletes its scaffolding too, which an estimate counting only the duplicated body will miss.
- **Do not double-count.** X-3 overlaps ~8 of O-3's `isRecord` sites; X-5 consolidates three lens findings.

## Remaining backlog (ranked)

Findings estimated under 20 net lines (TT-4, C-5, U-3, X-8, D-5, D-6, M-3, U-4, X-7, C-6, UT-5, UT-6, W-5, O-6 — ~234 lines combined) were dropped from the backlog as not worth a dedicated pass; pick one up only as a ride-along when already touching its files, and re-derive the details from the code rather than this report.

| ID | Recommendation | Net LOC | Risk |
|---|---|---|---|
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

---

The sections below detail the open findings above, one per ID, grouped by area.

## Cross-cutting (X)

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

---

## CLI flags and native parser (CLI)

### CLI-3: Root-mode parse-result builder — net 33 lines

`native-parser.ts` builds the same 7–9-line result object seven times (lines 261-267, 272-278, 281-287, 292-300, 302-309, 314-321, 328-335) for pre-command help/version paths. Add a private `rootModeResult(mode, argv, globalFlags, explicit, extra = {})`; each site becomes a one-line return. `CliParseResult` is a plain type (verified), so this types cleanly. The two mid-loop returns at 366-374 and 379-387 use live parse state and are deliberately excluded.

---

## Types (T)

### T-4: LLM model key triplication — net 40 lines

The 24 LLM model keys exist three times: `RuntimeOptions` (cli-types.ts:19-42), `ResolvedLLMConfig` (cli-dir-types.ts:51-78), and the `LLMOptions` Pick list (write-types.ts:8-31). Rewrite `ResolvedLLMConfig` as `Pick<RuntimeOptions, ...24 keys packed> & { llmService: string | undefined, llmModel: string | undefined }` (tsc-proven equal); `LLMModelOptionKey` (keyof-based) survives unchanged, so `LLMOptions` replaces its 24 key lines with a single `| LLMModelOptionKey` member.

### T-5: `Estimate*CostOptions` longhand shapes — net 39 lines

`EstimateVideoCostOptions` (video-types.ts:47-76), `EstimateImageCostOptions` (image-types.ts:51-71), `EstimateMusicCostOptions` (music-pricing-types.ts:1-11) re-declare ProcessingOptions field shapes longhand — tsc-proven identical to `Pick<ProcessingOptions, ...>` (valibot `v.optional(schema, undefined)` infers `?: T | undefined`). Video keeps a 4-field literal intersection for its non-PO estimate inputs (`grokInputImageCount`, `grokInputVideoDurationSeconds`, `replicateVideoReferenceVideoCount`, `replicateInputVideoDurationSeconds`). music-pricing-types needs +1 import line.

---

## OCR — step-2-extract/step-2-ocr (O)

### O-3: Type-guard copies — net 36 lines

8 local 2-line `isRecord` copies (coordinate with X-3), `isPageResult` ×3, `isHostedOcrRun` ×2, `getUsageNumber` ×2 across `ocr-partial-step2.ts`, `hosted-ocr-utils.ts`, `pdf-chunk-fallback-state.ts`, `ocr-costs.ts`, and friends. Make `hosted-ocr-utils.ts` the canonical home (export `isPageResult`, move `isHostedOcrRun`/`getUsageNumber` there); `pdf-chunk-fallback-shared.ts` becomes a re-export of rest-client's `isRecord`. **Behavior flag:** `ocr-partial-step2`'s `isPageResult` lacks the `confidence === undefined || typeof confidence === 'number'` clause the other copies have — unifying makes partial-metadata parsing stricter for malformed confidence fields; looks like an accidental omission but call it out in the change. Cycle-checked safe.

### O-4: hosted-ocr document branches — net 33 lines

`hosted-ocr.ts` kimi (540-558), grok (586-604), deepinfra (663-681) branches are token-identical (same assert, same 7-key opts object, same `withHostedUsageDetail` payload). File-local `runDocumentHostedOcr(filePath, step1Metadata, opts, ocrService, ocrModel, runner)`; each branch collapses to `ensure*Setup(); return await runDocumentHostedOcr(...)`. Grok's runner's trailing optional `baseUrl` param is compatible with the narrower function type (verified).

### O-5: detection.ts anchor-page skeleton — net 29 lines

`pdf/ocr-chapters/detection.ts:175-218` vs `228-269`: byte-identical best-match skeleton (normalize, pageLookup Map, candidate loop, identical 3-way tie-break, distance computation); only per-page scoring differs. File-local `findBestAnchorPage(title, predictedPage, pages, options, scorePage)` where `scorePage(page) <= 0` means skip; the two exports keep signatures and pass 3–7-line closures (heading variant returns `headingScore + 4`).

---

## STT — step-2-extract/step-2-stt (S)

### S-7: happyscribe.ts reimports — net 44 lines

`happyscribe.ts:11-76` privately redefines `isRecord`, `normalizeId`, `readJsonOrText`, `extractErrorMessage` — byte-for-byte copies of `happyscribe-utils.ts` exports (verified, including the same key-preference list). One import line, export `extractHappyScribeErrorMessage` (keyword only), rename 5 call sites in place. No cycle (verified).

---

## URL extract — step-2-url, step-2-shared, transcript-video (U)

### U-2: `runXUrl` finalization wrapper — net 36 lines

The exported entry functions in the four scrape-runner files are byte-identical 23-line wrappers (log → scrape → `tryFetchRemoteHtml` → `ensureMeaningfulMarkdown` → backfill → 6-field return). Add `finalizeUrlArticleResult(source, sourceUrl, backend, scraped)` to `url-utils.ts`; each becomes ~9 lines. **Flag:** glm-reader's wrapper omits the `finalUrl` backfill and author spread — possibly accidental; adding it as a fifth site saves ~12 more but changes glm behavior, so ask first.

---

## Download — step-1-download (D)

### D-3: `readModelFamily` tuple helper — net 31 lines

`download-model-options.ts:144-179` has 36 consecutive `const xModel = first(xModels)` lines pairing 1:1 with the `readValidatedMany` declarations. A 5-line helper (must live inside `readRuntimeModelOptions` — `readValidatedMany` is a closure) returning `[models, first(models)] as const`; each family becomes one tuple-destructure line. `whisperModel` (default fallback) stays special; TTS/image/video/music families already inline `first()` and gain nothing.

### D-4: batch-executor identical child runners — net 28 lines

`batch-executor.ts:92-119` vs `121-148` are identical except the document variant forwards `commandName` while x-space hardcodes `'extract'` — verified dead difference (both only ever receive `'extract'` through the call chain). Delete the x-space variant, rename the survivor `runExtractChildBatch`, point both call sites (193, 196) at it. Keep the forwarding body.

(The download-area worker-pool finding is subsumed by X-2 / Wave 9.)

---

## Write — step-3-write (W)

### W-1: llama stderr watch + startup-failure error — net 43 lines

The ~26-line stderr-watch block (tail slice, line buffering, stripAnsi, download-progress watch) is duplicated in `llama-model-download.ts:65-94` and `llama-server-runtime.ts:42-77`; the ~19-line two-branch InfraError construction appears in both plus `llamafile-server.ts:233-251` (labels/stage differ only). Add `watchLlamaServerStderr(stderr): { getTail, stop }` and `throwIfServerStartupFailed(healthResult, tail, timeoutMs, {server, stderr, stage})` to `llama-download-progress.ts` (all three already import it). Budget the helpers honestly at ~62-65 lines (exported HealthResult union, closures, imports) — the verifier corrected the original estimate down.

### W-2: llama vs llamafile health machinery — net 41 lines

Five function pairs duplicated between `llama-server-process.ts` and `llamafile-server.ts` (~88 lines each side): `getErrorCode`, `isPidRunning`, `checkXHealthQuiet` (base URL differs), `waitForXHealthState` (operationName differs), `waitForXHealth` (constants/labels differ). New `write-local/shared/local-server-health.ts`; llama keeps thin wrappers for its exported names (consumed by two files). **Do NOT merge** `stopRecordedDefaultLlamaServer` vs `stopRecordedLlamafileServer` — they genuinely diverge (llama waits for pid exit and throws on failure; llamafile unconditionally clears state after SIGKILL) and that may be intentional.

### W-3: llama/llamafile completion clients — net 40 lines

`llama-client.ts` (60 lines) and `llamafile-client.ts` (64 lines) are line-for-line identical (same request body, retry loop, schema validation, token fallback) modulo base URL, kwargs const, retry constants, and label — and the label appears consistently in all four message positions, so one `apiLabel` field reproduces every string. New `write-local/shared/local-completion-client.ts` with `requestLocalChatCompletion(profile, prompt, model, signal?)`; each provider defines an ~8-line profile const from its existing constants module. Sole callers verified: `run-llama.ts`, `run-llamafile.ts`.

(The write API-key finding was consolidated into X-1 / Wave 10, including the redundant `run-anthropic.ts:13-17` block deletion.)

---

## TTS — step-4-tts (TT)

### TT-5: Custom-voice memoization + MIME map — net 26 lines

`speechify-custom-voices.ts` and `elevenlabs-ivc.ts` share an identical 12-entry extension→MIME Map (14 lines each) and a structurally identical 24-line memoize-with-rollback `ensure*` function (both context types are exactly `{ voicePromise?: Promise<X> | undefined }` — verified). New `tts-utils/tts-custom-voice-utils.ts` with the shared Map and generic `ensureCachedVoice<T>(context, create)`. **Do NOT merge** the adjacent `validate*Audio` functions — Speechify hard-fails (10–30s, 5 MiB cap) where ElevenLabs only warns.

(The TTS API-key finding was consolidated into X-1 / Wave 10.)

---

## Image / Video / Music — steps 5-7 (G)

### G-5: captions parseVtt/parseSrt — net 38 lines

`step-7-music/lyrics-video/captions.ts:69-109` vs `111-144`: byte-identical except the WEBVTT/NOTE block skip and 'VTT'/'SRT' in messages. Single `parseCaptionCues(raw, format)` with a format-guarded skip; the four `loadCaptionFile` call sites pass the format in place.

(The genmedia API-key finding was consolidated into X-1 / Wave 10.)

---

## Comic — step-8-comic (C)

### C-3: Lenient JSON extraction — net 30 lines

`generate-scene-json.ts:21-46` and `llm-review.ts:10-35` are byte-identical (fenced-JSON regex, brace-slice fallback) except the stage string; both call sites always pass `{ lenient: true }` so that branch is dead. Add `parseLenientJsonResponse(content, stage)` to `comic-utils/json-prompt-utils.ts`; llm-review's now-unused ValidationError import offsets its new import line.

### C-4: Panel prompt-bundle reader — net 26 lines

`readComicPagePanelSource` (pages, 57-87) and `readSketchPanelSource` (sketches, 285-309) are the same function; pages adds normalization + a stage difference. Add `readPanelPromptSource(sceneDirectory, panelEntry, stage)` to `panel-prompt-utils.ts`; pages keeps a wrapper for normalization + became-empty error. A third inline copy in `generate-panel-images.ts:123-136` could adopt it later (~8 more lines; verify surrounding validation first).

---

## Metadata / process-steps root (M)

### M-1: frontmatter renderEntry — net 38 lines

`format-metadata-frontmatter.ts` `renderObject` (31-70) and `renderArray` (72-107) share the same four-way branch tree; every emitted line is `${prefix} <suffix>` with prefix `${indent}${key}:` vs `${indent}-`. Private `renderEntry(entry, prefix, indentLevel): string[]`. **Preserve the asymmetry:** renderObject skips undefined values per-key; renderArray lets undefined elements hit the quoted-'undefined' fallback — keep the skip in renderObject's loop.

### M-2: `parseUrl` predicate — net 22 lines

The `try { new URL(x) } catch { return false }` scaffolding is repeated in 7 functions in `metadata-input-classifier.ts` plus `isYoutubeUrl` and `isYoutubeChannelUrl` in metadata-sources. Add `export const parseUrl = (value: string): URL | null` in the classifier; each predicate collapses to a null-check plus its verbatim field test. Do not simplify `isLikelyUrl` to a bare null-check (it requires non-empty host — `mailto:` must still fail).

---

## Setup: benchmark / models / config / links (B)

### B-6: Entrypoint report/ranking logs — net 23 lines

`run-image-benchmark.ts:576-610` and `run-video-benchmark.ts:48-82` end with two identical 34-line `l.write` blocks differing only in the title word. Add `logMediaBenchmarkReports(label, quality, comparison, providers)` to `media-provider-comparison.ts` (+2 imports there; video's `formatScore` import becomes deletable). Both report types derive from `QualityProviderReportBase`, so a structural param type accepts both. Wave 29 rewrote the rest of that file but deliberately left these two blocks alone.

---

## Setup: setup / resume (R)

### R-4: `logResumeFull` idiom — net 34 lines

The 10-line success block (logResumeItem 'full' + logResumeSummary + return totals) appears 6× across `generation-resume.ts` (177-189, 255-263, 280-288) and `write-resume.ts` (520-528, 533-541, 644-652). Add `logResumeFull(logger, item, outputDir, providers, detail): ResumeResult` to `resume-logging.ts` (both files already import it). The failed/incomplete+throw variants stay per-site (their error construction differs — see divergence list).

### R-5: stt-resume / ocr-resume plumbing — net 30 lines

Four block pairs duplicated between `extract/stt-resume.ts` and `extract/ocr-resume.ts`: `resolveStoredOutputDir` (byte-identical), `toResumeResult` (byte-identical), `xSourceInput` (STT/OCR word), `selectedXTargetsComplete` (module-specific parse/build functions injected; OCR wraps with `{ includeBlocked: true }`). Move into `provider-batch-resume.ts` with the divergent parse/build functions injected. Moderate divergence risk acknowledged — the extracted blocks are the generic plumbing, not the divergent logic.

---

## Tests (TE)

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

---

## Suspected accidental divergences (surface to a human, do not silently unify)

These were found while verifying merges — each is a place where two copies differ in a way that looks unintentional. Worth a quick review independent of the dedup work:

1. `ocr-partial-step2.ts` `isPageResult` lacks the confidence-type check its two siblings have (O-3).
2. `ocr-multi-provider-batch.ts` checkpoint metadataErrors map drops `stage`/`status`/`retryAfterMs`/`rawResponseFile` that finalize includes, and does not sanitize `message` where other copies do (verified accidental — the source `buildMetadataErrorEntries` already emits all 14 fields; the O-6 unification that would have fixed this was dropped from the backlog).
3. Firecrawl's error stage is `'extract:firecrawl'` while spider/zyte use `'url:<id>'` (U-1). **Preserved verbatim by Wave 19** — still wants a maintainer decision.
4. `run-glm-reader-url.ts` omits the `finalUrl` backfill and author spread the other four URL providers have (U-2).
5. `batch-executor.ts` x-space variant hardcodes `'extract'` where the document variant forwards `commandName` (dead difference today) (D-4).
6. `run-anthropic.ts:13-17` duplicated the API-key check `getAnthropicClientConfig()` performs two lines later (X-1). **Resolved by Wave 10** — the duplicate check was deleted.
7. `run-gemini-image-gen.ts` and `run-grok-image-gen.ts` re-checked the env var despite their own package's `ensure*Setup` having run (X-1). **Resolved by Wave 10** — the re-reads now route through the canonical `requireApiKey` and double as the runners' key reads.
8. `elevenlabs-ivc.ts:129-131` attaches only `.status` (no `.headers`) where its five siblings attach both (found while verifying the since-dropped TT-4).
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
- ~~parseRetryAfterMs variants (semantics differ)~~ — moot after Wave 28 deleted AssemblyAI's copy; `~/utils/retries`' export is now the only definition in `src/`.
- Numerous sub-threshold items (each < 15 net): `createCombinedSignal` ×3 (~7 net), llama/llamafile state files (schemas differ), url `pickCleanString` (~13), metadata batch-planner/router helpers, `ensureAbsoluteYoutubeUrl` ×2 (~4), `formatVersion` ×2, dispatcher string-flag reads, small write-resume preamble (~11), gemini/anthropic OCR adapter callbacks, spider/zyte import headers, LumalabsGenerationSchema ×2 (~6), replicate-video reject-flag lists (~6), render.ts ASS headers (~8), timing-shared profile spreads (~5-8), aggregate-pricing note pushes, compute-costs switch heads (~14, fights union narrowing), per-domain build*TimingSteps (config-object trap), grouped-tier writer loops (shape callback trap), e2e STT metadata assertion clones (divergence risk across engines), test-runner header boilerplate.

## Provenance

Every finding in this report was double-checked: an analysis agent proposed it with line-level citations, and an independent verifier agent then re-read the cited code and reproduced the claim (line counts, byte-identity comparisons, type equality via throwaway tsc assertions, import-cycle checks, greps for test assertions on changed error strings) and re-did the net-LOC arithmetic before it was accepted. Line numbers reference the tree as of commit `1938efc2` on `staging` and will drift as files change — treat them as anchors, not gospel.
