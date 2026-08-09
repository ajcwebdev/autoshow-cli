# Duplication Extraction Report

Date: 2026-08-08. Scope: entire repository (`src/`, `test/`, `scripts/` — ~129k lines of TypeScript in `src/` plus the test suite). Twenty-seven extraction waves are complete at **4,112 actual net lines removed**: waves 1–9 took the nine strictly low-risk entries in the top 15 (2,020), waves 10–14 the five largest remaining findings regardless of risk (1,254), and waves 15–27 every remaining low-risk finding at 50+ net lines (838 actual vs 868 planned). The completed-waves table below is the historical record; the rest of the report is the reference backlog (~1,630 estimated net lines across 42 findings) for later passes. The eight highest-ranked backlog entries (S-4, B-2, TT-2, G-4, TE-4, R-3, T-3, C-2 — ~470 net lines) have per-wave implementation plans in "Planned waves 28–35", immediately after the backlog table; the per-area sections further down remain the underlying findings.

## Method and accounting rules

The analysis combined a token-based clone scan (jscpd: 375 exact clones, ~5,200 duplicated lines) with 17 area/lens analysis agents, and every candidate finding was then re-verified by an independent adversarial agent that read the cited code and re-did the line accounting. All numbers below are **verified net savings**: `lines removed − new helper lines (including signature, types, blanks, braces) − lines added at call sites (imports, calls, adapters)`. Import lines that merge into an existing import from the same module are counted as 0. A finding was only kept if extraction strictly reduces total line count; anything that broke even or required a sprawling config object was rejected (the rejected candidates are listed at the end so a later pass does not re-litigate them).

The original scan identified ~5,800 removable net lines (~4.5% of the codebase) across 85 deduplicated recommendations; 4,112 have landed. Verification bar after each change: `bun run check`, plus the targeted local tests named per finding.

## Completed waves 1–27 (all landed 2026-08-08)

One finding per wave, self-contained. Every wave landed `bun run check` clean plus its area's named local test suites, and none called a paid provider.

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
| 15 | O-2 | `ocr-utils/hosted-ocr-json.ts`: envelope schema + JSON schema + `createHostedOcrResponseParser`; gemini/openai adopt fully, anthropic keeps its pageLabel parser on the shared schemas | 97 |
| 16 | D-1 | Generic `pick()` in `cli-utils.ts`; six `build-opts-from-flags/*.ts` builders spread packed `*_MODEL_KEYS` arrays (`as const satisfies readonly *RuntimeOptionKey[]`) | 160 |
| 17 | TE-2 | `load-config-schema.test.ts` twice-written 85-line config literal bound once (plus the sibling `image-tts-defaults` 28-entry clone) | 110 |
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

Notes that still matter for later passes:

- Line numbers in the backlog anchor to `1938efc2` and drift — re-read sites before extracting, and if two copies differ where this report calls them identical, surface it as a divergence instead of unifying.
- S-4 is unblocked at zero new helper lines (Wave 12's `sttStageRequest`), but the assemblyai/gladia attach helpers don't unwrap `error.cause` — pass the attach function per site. Standing guidance from Wave 12: do NOT fold in the assemblyai/gladia/happyscribe/supadata attach variants or the payload-parsing `toXHttpError` variants. S-6 is fully subsumed; skip it.
- Divergence 12 is still open (Wave 13 deliberately left the empty-text guard per-runner); divergences 6 and 7 were resolved by Wave 10; divergence 3 (firecrawl's `'extract:firecrawl'` stage) was deliberately preserved by Wave 19 via the stage parameter and still wants a maintainer decision.
- Proof techniques worth reusing: throwaway `AssertEqual<old, new>` guard file for type migrations (waves 8, 11), and a differential harness against the pre-change implementation for behavior-preserving rewrites (wave 14, 420 cases, identical output).
- Left alone deliberately: the `run-supadata-url.ts` / `x-space-runner.ts` key guards (different user-facing messages), Wave 9's excluded pools (`runTtsChunks`, split-execution, `runPool`, stt-batch-coordinator, OCR ordered), G-3's aleph one-line literal, and Wave 16 kept tts-options' 8 destructured validation names (kitten maps to differently-named return keys and stays explicit).
- Behavior deltas knowingly accepted while landing: Wave 16 changed property insertion order in the built opts objects (cosmetic); Wave 23's sketch refs now carry an unused `characterReferences` field; Wave 26 moved the OpenAI config lookup after the media files are read (same errors either way).
- Follow-ups spawned but not taken: the other five `image-tts-defaults` tests have the same input-vs-expectation clone (TE-2); the tempdir idiom exists in ~25 more test files at ~5–12 lines each (TE-3); fal image/video options types (~12 combined, G-3); glm-reader as a fifth U-1/U-2 site (behavior change — ask first, see divergence 4).
- Estimation lesson from the small waves: sub-50-line estimates under-budget helper and call-site overhead (B-4 landed 16 vs 53 estimated, B-5 31 vs 54, R-2 12 vs 50) — treat small estimates as ceilings, and expect single-point-of-maintenance rather than line count to be the real win there.
- Excluded from waves 15–27 despite clearing 50 lines, because risk is not `low`: S-4 (120, med), B-2 (74), TT-2 (56), G-4 (55), TE-4 (54, all low-med). R-3 (49, low) missed the threshold by one line and is a natural ride-along for whoever is next in the setup area. B-2 touches the same files waves 25–26 edited but is unaffected by the landed judge/loader helpers. These eight (through C-2) now have per-wave implementation plans — see "Planned waves 28–35" below.
- X-3 overlaps ~8 of O-3's `isRecord` sites (don't double-count); X-5 consolidates three lens findings.

## Remaining backlog (ranked)

Findings estimated under 20 net lines (TT-4, C-5, U-3, X-8, D-5, D-6, M-3, U-4, X-7, C-6, UT-5, UT-6, W-5, O-6 — ~234 lines combined) were dropped from the backlog as not worth a dedicated pass; pick one up only as a ride-along when already touching its files, and re-derive the details from the code rather than this report.

| ID | Recommendation | Net LOC | Risk |
|---|---|---|---|
| S-4 | AssemblyAI + Gladia retry blocks onto the S-1 helper (unblocked) | 120 | med |
| B-2 | Image/video provider-comparison report writers parameterized | 74 | low-med |
| TT-2 | MiniMax TTS reimplements `concatAndConvertToWav` | 56 | low-med |
| G-4 | BFL/Lumalabs image runners: HTTP plumbing quartet | 55 | low-med |
| TE-4 | Replace inline fetch recorders with existing `installMockFetch` (4 sites) | 54 | low-med |
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

---

## Planned waves 28–35

One finding per wave, self-contained and independent of the others (order below is the backlog order, not a dependency order). Every anchor in this section was re-read against the working tree after wave 27 rather than inherited from the `1938efc2` numbers used elsewhere in the report, but re-read before editing anyway. Each plan ends with its verification set; none of them requires a paid provider call, and `bun run check` is the bar for all eight.

### Wave 28 — S-4: AssemblyAI + Gladia retry blocks onto `sttStageRequest` (~120 net, med)

Six blocks: `run-assemblyai-stt.ts` upload (168-209), create (222-262), poll (300-341); `run-gladia-stt.ts` upload (226-274), create (281-331), poll (365-415). Each is `try { const startedAt = Date.now(); x = await withRetry({...}, async (signal) => { requestCount += 1; fetch; if (!ok) throw Object.assign(new Error(...), {status, headers, stage, retryClass}); return json }, classifySttFetchRetryWithMetrics(retryMetrics, ...)); xMs += Date.now() - startedAt } catch (error) { attachXErrorContext(error, stage, retryClass) }` — the exact shape `sttStageRequest` already implements.

1. Extend `SttStageRequestOptions` (`src/types/stt-workflow/stt-stage-request-types.ts`) with two optional fields, +2 type lines and +2 helper lines total:
   - `failureLabel?: string | undefined` — the helper message becomes `${errorPrefix} ${failureLabel ?? stage} failed (${status}): ${text}`. Required because these runners say "transcript creation"/"polling"/"transcription creation" in the message while the attached `stage` metadata must stay `'create'`/`'poll'`; without it, adoption silently rewrites both.
   - `attachError?: ((error: unknown, stage: string, retryClass: RetryClass) => never) | undefined`, defaulting to `attachAsyncSttErrorContext`. **This is the load-bearing one:** `withRetry` throws an `AppError` carrying `cause: toErrorCause(lastError)` (`retries.ts:333`), so the shared attach unwraps and rethrows the inner HTTP error while `attachAssemblyAiErrorContext`/`attachGladiaErrorContext` rethrow the retry-exhausted wrapper. Pass each runner's local attach per site; do not adopt the unwrapping variant as a drive-by.
2. Add `sttRetryMetricsToCallbacks(metrics: SttRetryMetrics, onRequest: () => void): SttRequestMetrics` to `stt-retry-metrics.ts` (~7 lines) — these runners count requests in a local `requestCount` and retries in `createSttRetryMetrics()`, not in an `AsyncSttLifecycleMetrics`, so `lifecycleMetricsToCallbacks` does not fit. `getSttErrorStatus` and `getAsyncSttErrorStatus` are byte-identical, so the 429 → `rateLimitCount` branch survives unchanged.
3. Rewrite the six blocks. Timing accumulation (`uploadMs`/`createMs`/`pollMs`) and `createCount`/`pollCount` stay at the call site wrapping the helper call; the two poll sites use `sttStageRequestWithRetryAfter`.
4. AssemblyAI's upload and create responses have no valibot schema — they are hand-checked afterwards (`'AssemblyAI upload response missing upload_url'`, `'…creation response missing id'`). Pass a passthrough schema (`v.unknown()`) and keep those checks verbatim after the call. Writing real schemas would change those two error messages and is out of scope. Gladia already validates with `GladiaUploadResponseSchema`/`GladiaCreateResponseSchema`/`GladiaStatusResponseSchema` and maps onto `schema`/`schemaLabel` directly.
5. AssemblyAI's private `parseRetryAfterMs` (37-54) becomes dead — delete it and accept `~/utils/retries`' semantics: fractional seconds are no longer rounded, and an already-past `Retry-After` date yields `undefined` → `null` instead of `0`. That value is only a poll backoff hint. If the maintainer would rather not move it, keep the poll site hand-rolled and take upload+create only (~-40 net).

Verified: no test asserts these runners' message text — the one `'AssemblyAI upload failed'` assertion (`reports-pricing/voice-quality-report-contracts/paid-stt-mode-safety.test.ts:18`) targets `benchmark/tts-voice-quality-report/roundtrip-stt.ts`, a different module with its own copy of the string. Verify with `bun test test/test-cases/validation/providers/assemblyai-rest-contracts.test.ts test/test-cases/validation/providers/gladia-rest-contracts.test.ts` and `bun test test/test-cases/validation/extract-stt/`.

### Wave 29 — B-2: parameterized media provider-comparison writers (~74 net, low-med)

`run-image-benchmark.ts:326-432` and `run-video-benchmark/video-benchmark-reporting.ts:43-164`. Both add to the existing `media-provider-comparison.ts` (both files already import from it).

1. `baseMediaComparisonRow(provider)` returning the 29 shared keys (`rank` through `duplicateGroupId`), typed on a structural param `{ rank, providerKey, group, processingTimeMs?, costCents?, qualityScore, qualityMetric }` — satisfied by both `ImageQualityProviderReport` and `VideoQualityProviderReport`. Each site becomes `.map((provider) => ({ ...baseMediaComparisonRow(provider), imageQuality: {...} }))`; spreading first keeps `imageQuality`/`videoQuality` last, so serialized key order in `provider-comparison-report.json` is unchanged.
2. `writeMediaComparisonReports(runDir, { category, categoryLabel, proxyNoun, report, rows, summaryMetrics?, ... })` holding the JSON literal and the markdown call. Every remaining difference is a word substitution on `category` (`'image'`/`'video'`): `kind`, `category`, `metric`, `scoreFormula`, the three `notes` strings (pluralization works — "images"/"videos"), the markdown `title`, and `qualityReportFileName`. Two things are **not** substitutions and need their own params: `proxyNoun` (`'dimensions'` vs `'duration'`, appearing in `qualityProxyMethodText` and in the second markdown note) and video's `summaryMetrics` array (image passes none).

`provider-comparison-report.json` is consumed downstream by the consensus tooling, so the templates must reproduce current text byte-for-byte. Prove it: capture both reports from an existing run dir before the change, re-run the writers after, `diff` the four files. Then `bun test test/test-cases/validation/reports-pricing/media-benchmark-contracts.test.ts test/test-cases/validation/reports-pricing/benchmark-contracts.test.ts` and the `grouped-tier-report-contracts/` dir.

### Wave 30 — TT-2: MiniMax adopts the shared `concatAndConvertToWav` (~53 net, low-med)

Delete `run-minimax-tts.ts:93-145`; add `concatAndConvertToWav` to the existing `audio-utils` import (line 4, so zero added lines); call `concatAndConvertToWav(orderedChunkPaths, outputDir, 'MiniMax')` at line 291. `providerLabel.toLowerCase()` reproduces the current `speech-minimax-chunks.txt` name exactly. Then drop `resolve`, `exec`, and `getFfmpegBinary` from the imports **after** confirming no other use in the file, and drop `speech-minimax-merged.mp3` from the `finally` cleanup (line 309) — keep `speech-minimax-chunks.txt` there, since the shared helper only unlinks it on the success path.

Behavior deltas to state in the commit: the multi-chunk path goes from two ffmpeg passes (concat-copy to mp3, then convert) to one (concat demuxer resampling straight to WAV), so the intermediate mp3 no longer exists; the error stage moves from `tts:minimax` to `tts:audio-utils`; and `'Failed to convert concatenated MiniMax audio to WAV'` disappears, subsumed by the shared concat-failure message. The single-chunk path is byte-identical apart from the stage. Verify with `bun test test/test-cases/validation/providers/tts-provider-contracts/deepgram-minimax.test.ts test/test-cases/validation/providers/tts-provider-contracts/chunking-audio-helpers.test.ts`.

### Wave 31 — G-4: BFL/Lumalabs HTTP plumbing quartet (~55 net, low-med)

`run-bfl-image-gen.ts:72-143` and `run-lumalabs-image-gen.ts:69-140` define the same four private helpers. New `step-5-image/image-utils/polled-image-http.ts` (~60 lines) with:

- `readJsonOrText(response)` — byte-identical in both, lift as-is.
- `extractImageErrorMessage(payload, extraKeys: readonly string[] = [])` scanning `['message', 'error', 'detail', 'details', ...extraKeys]`; Lumalabs passes `['failure_reason']`, preserving its extra key in its current last position.
- `fetchImageProviderJson(url, init, authHeaders: Record<string, string>)` — sets `accept: application/json` then spreads the caller's auth header (`{ 'x-key': apiKey }` vs `{ authorization: \`Bearer ${apiKey}\` }`), returning `{ response, payload }`.
- `downloadGeneratedImage({ url, outputPath, outputFormat, providerLabel, stage, signal })` carrying the `accept: image/${outputFormat},image/*;q=0.9,*/*;q=0.8` header and the hand-rolled retryable `Error & { status, headers, stage: 'result-download', retryClass: 'runtime_http_read', retryable: isRetryableStatus(status) }`. Take `outputFormat: string` — `BflOutputFormat`/`LumalabsOutputFormat` are literal unions that widen cleanly for a header.

Only transport merges; the divergent polling schemas and result-shape parsing stay per-provider. `image-output.ts` has the same retryable-Error construction and is an optional third adopter — check its stage/label first, and leave it out if it costs more than it saves. Verify with `bun test test/test-cases/validation/providers/image-provider-rest-contracts.test.ts`.

### Wave 32 — TE-4: inline fetch recorders → `installMockFetch` (~45 net, low-med)

Four ~16-line inline recorders in `tts-provider-contracts/openai-grok-groq.test.ts` (the two OpenAI tests and the Grok controls test) and `mistral-elevenlabs.test.ts` (the ElevenLabs controls test) duplicate `installMockFetch` from `test/test-utils/rest-contract-helpers.ts:41-61`. Restoration is already handled — `setupTtsContractLifecycle()`'s `afterEach` restores `globalThis.fetch`, and `installMockFetch` only assigns it.

Each site becomes `const calls = installMockFetch(() => new Response(audioBytes, { status: 200, headers: {...} }))`. Assertions adapt: `call.authorization` → `call.headers.get('authorization')` (`'xi-api-key'` for ElevenLabs), `call.body` → `call.bodyJson`. Budget ~4 lines back at the Grok controls test, whose `expect(calls).toEqual([{ url, method, authorization, body }])` cannot survive a whole-array `toEqual` against the richer `MockFetchCall` shape — split it into `toHaveLength` plus field-wise expects. Hence ~45 realistic rather than the backlog's 54.

**Excluded (verified):** the Mistral saved-voice test's recorder is part of a routing mock that returns media bytes for `SHORT_AUDIO_URL` *without* pushing a call; swapping it in would shift `calls` indexing and break the assertions. Re-confirm which recorders carry that branch before editing — line anchors here have drifted twice. Verify with `bun test test/test-cases/validation/providers/tts-provider-contracts/`.

### Wave 33 — R-3: reuse exported `runCapture` (~49 net, low)

Delete `setup-download/dmg.ts:8-19` (`runCommand`), `download.ts:252-263` (`runArchiveCommand`), and `dl-document/acsm.ts:40-64` (`runSetupCapture`); import `runCapture` from `run-complete-setup.ts:180-195`. All 9 call sites are pure renames: dmg 35 and 44, download 286 and 293, acsm 109, 124, 125, 171, 194. dmg/download discard the returned stdout; acsm's options object already matches `RunOptions` field-for-field, and `mergeEnv` (`{ ...process.env, ...env }`) matches acsm's conditional spread exactly, while dmg/download pass no env at all and `runCapture`'s explicit `process.env` pass-through equals Bun's default.

**Accepted behavior change:** the InfraError stage becomes `'setup:run'` for all three (was `setup:dmg` / `setup:download` / `setup:acsm`) and the message becomes `formatCommandFailure`'s format instead of each site's hand-rolled `${command} failed with exit code ${n}: ${detail}`. Re-grep `native-setup-download-contracts.test.ts` and `setup-command-contracts.test.ts` for the old strings before committing — the previously-checked `'failed with exit code'` assertion targets a different module. The acsm ↔ run-complete-setup import cycle mirrors the existing calibre/audio pattern and is safe because `runCapture` is only referenced inside function bodies. Verify with `bun test test/test-cases/validation/setup/`.

### Wave 34 — T-3: pricing-types shared fragments (~47 net, low, type-only)

Four independent edits in `src/types/costing/pricing-types.ts`. Land each behind a throwaway `AssertEqual<Old, New>` guard file (the wave 8/11 technique) and delete the guard before committing — under `exactOptionalPropertyTypes` these equalities are easy to get subtly wrong.

- **(a)** The 5-field token-profile cluster (`tokenEstimateSource`, `tokenEstimateConfidence`, `tokenProfileSampleCount`, `tokenProfilePromptTokensPerPage`, `tokenProfileCompletionTokensPerPage`) appears verbatim at 69-73, 168-172, and inside `StepCostEntry` (~311-315) and `EstimatedStepEntry` (~347-351). All four sites use bare optionals with no `| undefined` suffix, so declare `TokenProfileEstimateFields` the same way and intersect.
- **(b)** The 8 `*OcrModel?: string | undefined` fields at 151-158 and ~239-246 → one `OcrModelOverrides`. `Partial<Pick<RuntimeOptions, …>>` is only equal if `RuntimeOptions` declares those keys as `string | undefined`; if the guard file disagrees, fall back to an explicit 8-field type and still save one copy.
- **(c)** `ComputeActualCostsInput` (117-128) = `ActualPipelineInputsBase<Step1Metadata> & { audioDurationSeconds?: number | undefined }`. Confirmed: the base (`compute-processing-time-types.ts:3-13`) holds exactly `step1`–`step7` plus `ttsCharacterCount`, the other nine fields of the input. Costs one cross-file import.
- **(d)** The `*SttModel` fields at 135-150 → `Partial<Pick<RuntimeOptions, …>>` for 15 of them, keeping `whisperModel` as a literal (it is plain `string` in `RuntimeOptions`, not `string | undefined`).

**Exclusion:** `extract-estimates-types.ts`'s `OcrCostEstimate` cluster carries explicit `| undefined` suffixes and is a genuinely different type here — do not fold it in. Type-only change, so `bun run check` is the real gate; run `bun test test/test-cases/validation/reports-pricing/price-mode-contracts/` as a sanity pass.

### Wave 35 — C-2: comic `cli-args.ts` per-flag parse helpers (~40 net, low)

Five module-local helpers in the existing `(existing, args, index, flag)` shape, each returning the parsed value so the call site keeps `parsed.x = helper(...); index++; break`. Verified byte-identical pairs at the re-read anchors:

| Helper | Sites | Net |
|---|---|---|
| `parseLlmModelFlag` | draft 103-118, generate-images 363-378 | ~13 |
| `parseImageQualityFlag` | reference-sketch 244-257, generate-images 448-461 | ~9 |
| `parseConcurrencyFlag` | draft 135-143, reference-sketch 276-284, generate-images 379-387 | ~7 |
| `readTrailingScriptPath` | draft default 144-155, generate-images default 471-482 | ~7 |
| `parseImageSizeFlag` | reference-sketch 234-243, generate-images 438-447 | ~4 |

That is ~40 rather than the backlog's 45 — the size and concurrency helpers barely clear their own overhead, and the honest win there is single-point-of-maintenance, not lines (the wave 24–27 estimation lesson). **Exclusions (verified load-bearing):** reference-sketch's combined `--llm-model`/`--qa-model` case (196-205) throws a per-flag "can only be specified once" message and writes a computed field, its `--qa-model` variant carries an openai-only check, and its `--image-model` case carries an exactly-one check — all three stay as-is. Verify with `bun test test/test-cases/validation/cli/cli-usage-errors.test.ts test/test-cases/validation/cli/cli-help-contracts.test.ts` and `bun test test/test-cases/validation/comic/`.

---

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

### T-3: pricing-types shared fragments — net 47 lines

In `src/types/costing/pricing-types.ts`: (a) the 5-field token-profile cluster appears verbatim at 4 sites (69-73, 168-172, 311-315, 347-351) → one `TokenProfileEstimateFields` type intersected at each; (b) the 8 `*OcrModel?: string | undefined` fields appear twice (151-158, 239-246) → `OcrModelOverrides = Partial<Pick<RuntimeOptions, ...8 keys>>` (tsc-proven exactly equal); (c) `ComputeActualCostsInput` (117-128) = `ActualPipelineInputsBase<Step1Metadata> & { audioDurationSeconds?: number | undefined }` (tsc-proven); (d) the 16 `*SttModel` fields (135-150) = `Partial<Pick<RuntimeOptions, ...>>` — keep `whisperModel` literal (it is plain `string` in RuntimeOptions). **Exclusion:** `extract-estimates-types.ts`'s `OcrCostEstimate` cluster has explicit `| undefined` suffixes — a genuinely different type under `exactOptionalPropertyTypes`, do not fold in.

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

### S-4: AssemblyAI + Gladia onto the S-1 helper — net 120 lines (unblocked; S-1 landed as Wave 12)

Six inline ~40-line blocks (`run-assemblyai-stt.ts:201-243, 256-296, 333-375`; `run-gladia-stt.ts:259-300, 315-357, 401-442`) with the same skeleton. Reuse `sttStageRequest` (0 new helper lines). **Verified constraint:** assemblyai/gladia attach-context helpers do NOT unwrap `error.cause` (unlike rev/speechmatics/soniox) — the helper must take the attach function per site rather than hardcoding the unwrapping variant. `classifySttFetchRetryWithMetrics` semantics verified identical to the helper's classify+onRetry path. AssemblyAI's private `parseRetryAfterMs` (37-54) becomes deletable (uncounted upside; note its semantics differ from `~/utils/retries`' version — rounding/clamping — so it must not silently swap to that one).

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

### TT-2: MiniMax reimplements `concatAndConvertToWav` — net 56 lines

`run-minimax-tts.ts:93-145` duplicates `tts-utils/audio-utils.ts:129-174` (single-chunk path byte-identical; multi-chunk differs only in two-pass vs one-pass concat with equivalent output — verified same ffmpeg args and filenames derived from providerLabel 'MiniMax'). Delete the local function, call the shared one, drop now-unused resolve/exec/getFfmpegBinary imports, simplify the finally-cleanup (line 312 becomes dead). Note: error stage metadata changes from `tts:minimax` to `tts:audio-utils` — acceptable, but know it.

### TT-5: Custom-voice memoization + MIME map — net 26 lines

`speechify-custom-voices.ts` and `elevenlabs-ivc.ts` share an identical 12-entry extension→MIME Map (14 lines each) and a structurally identical 24-line memoize-with-rollback `ensure*` function (both context types are exactly `{ voicePromise?: Promise<X> | undefined }` — verified). New `tts-utils/tts-custom-voice-utils.ts` with the shared Map and generic `ensureCachedVoice<T>(context, create)`. **Do NOT merge** the adjacent `validate*Audio` functions — Speechify hard-fails (10–30s, 5 MiB cap) where ElevenLabs only warns.

(The TTS API-key finding was consolidated into X-1 / Wave 10.)

---

## Image / Video / Music — steps 5-7 (G)

### G-4: BFL/Lumalabs HTTP plumbing quartet — net 55 lines

`run-bfl-image-gen.ts:73-144` and `run-lumalabs-image-gen.ts:70-141` privately define the same four helpers: `readJsonOrText` (byte-identical), `extractErrorMessage` (lumalabs adds `'failure_reason'` — preserve via keys param), `fetchXJson` (auth header differs: `x-key` vs Bearer), `downloadXImage` (label/stage differ; includes the same hand-rolled retryable Error-with-status also present in `image-output.ts`). New `image-utils/polled-image-http.ts` with the four parameterized. Only transport merges; the divergent polling schemas above stay per-provider. Cross-note: `readJsonOrText` has 3 more copies in STT services — if a `src/utils` home is ever chosen, these five sites should share it.

### G-5: captions parseVtt/parseSrt — net 38 lines

`step-7-music/lyrics-video/captions.ts:69-109` vs `111-144`: byte-identical except the WEBVTT/NOTE block skip and 'VTT'/'SRT' in messages. Single `parseCaptionCues(raw, format)` with a format-guarded skip; the four `loadCaptionFile` call sites pass the format in place.

(The genmedia API-key finding was consolidated into X-1 / Wave 10.)

---

## Comic — step-8-comic (C)

### C-2: cli-args per-flag parse helpers — net 45 lines

`comic-utils/cli-args.ts` repeats identical switch-case bodies across its three parsers: `--llm-model` ×2 (16 lines each), `--quality` ×2, `--size` ×2, `--concurrency` ×3, default scriptPath ×2 — 131 lines, error strings byte-identical. Five module-local helpers following the existing `(existing, args, index, flag)` shape. **Exclusions (verified load-bearing):** reference-sketch's combined `--llm-model/--qa-model` case (different once-error), `--qa-model` (openai-only check), reference-sketch `--image-model` (exactly-one check) stay as-is.

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

### B-2: Provider-comparison report writers — net 74 lines

`run-image-benchmark.ts:393-499` and `video-benchmark-reporting.ts:43-164` are clones (30-key row skeleton token-identical; report objects differ only in image/video word substitution; video adds summaryMetrics). Add `baseMediaComparisonRow(...)` and `writeMediaComparisonReports(runDir, {category, proxyNoun, ...})` to the existing `media-provider-comparison.ts` (both sites already import it). Templates must reproduce current report text byte-for-byte — `provider-comparison-report.json` is consumed downstream by consensus tooling.

### B-6: Entrypoint report/ranking logs — net 23 lines

`run-image-benchmark.ts:576-610` and `run-video-benchmark.ts:48-82` end with two identical 34-line `l.write` blocks differing only in the title word. Add `logMediaBenchmarkReports(label, quality, comparison, providers)` to `media-provider-comparison.ts` (+2 imports there; video's `formatScore` import becomes deletable). Both report types derive from `QualityProviderReportBase`, so a structural param type accepts both.

---

## Setup: setup / resume (R)

### R-3: Reuse exported `runCapture` — net 49 lines

`setup-download/dmg.ts:8-19`, `download.ts:252-263`, `dl-document/acsm.ts:37-65` each define private spawn+capture wrappers duplicating `runCapture` from `run-complete-setup.ts` (acsm's options object exactly matches `RunOptions`; dmg/download's returned stdout is unused at all call sites — verified). Delete all three, import `runCapture` (all 9 call sites are pure renames). **Verified acceptable behavior change:** InfraError stage becomes `'setup:run'` and the message format changes to `formatCommandFailure`'s — no test asserts the old stages/formats (checked; the one 'failed with exit code' assertion targets a different module). The acsm↔run-complete-setup import cycle mirrors the existing calibre/audio pattern and `runCapture` is only called inside functions.

### R-4: `logResumeFull` idiom — net 34 lines

The 10-line success block (logResumeItem 'full' + logResumeSummary + return totals) appears 6× across `generation-resume.ts` (177-189, 255-263, 280-288) and `write-resume.ts` (520-528, 533-541, 644-652). Add `logResumeFull(logger, item, outputDir, providers, detail): ResumeResult` to `resume-logging.ts` (both files already import it). The failed/incomplete+throw variants stay per-site (their error construction differs — see divergence list).

### R-5: stt-resume / ocr-resume plumbing — net 30 lines

Four block pairs duplicated between `extract/stt-resume.ts` and `extract/ocr-resume.ts`: `resolveStoredOutputDir` (byte-identical), `toResumeResult` (byte-identical), `xSourceInput` (STT/OCR word), `selectedXTargetsComplete` (module-specific parse/build functions injected; OCR wraps with `{ includeBlocked: true }`). Move into `provider-batch-resume.ts` with the divergent parse/build functions injected. Moderate divergence risk acknowledged — the extracted blocks are the generic plumbing, not the divergent logic.

---

## Tests (TE)

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
- Numerous sub-threshold items (each < 15 net): parseRetryAfterMs variants (semantics differ), `createCombinedSignal` ×3 (~7 net), llama/llamafile state files (schemas differ), url `pickCleanString` (~13), metadata batch-planner/router helpers, `ensureAbsoluteYoutubeUrl` ×2 (~4), `formatVersion` ×2, dispatcher string-flag reads, small write-resume preamble (~11), gemini/anthropic OCR adapter callbacks, spider/zyte import headers, LumalabsGenerationSchema ×2 (~6), replicate-video reject-flag lists (~6), render.ts ASS headers (~8), timing-shared profile spreads (~5-8), aggregate-pricing note pushes, compute-costs switch heads (~14, fights union narrowing), per-domain build*TimingSteps (config-object trap), grouped-tier writer loops (shape callback trap), e2e STT metadata assertion clones (divergence risk across engines), test-runner header boilerplate.

## Provenance

Every finding in this report was double-checked: an analysis agent proposed it with line-level citations, and an independent verifier agent then re-read the cited code and reproduced the claim (line counts, byte-identity comparisons, type equality via throwaway tsc assertions, import-cycle checks, greps for test assertions on changed error strings) and re-did the net-LOC arithmetic before it was accepted. Line numbers reference the tree as of commit `1938efc2` on `staging` and will drift as files change — treat them as anchors, not gospel.
