# Test Suite Optimization Report

**Diagnosis (unchanged since the first audit):** the dominant cost is CLI subprocess spawns — tests that launch `bun src/cli/create-cli.ts` to verify things that are pure in-process parse/validation/estimator logic, often in serial per-model loops inside single files that parallelism can't help. Measured baselines on the current suite: ~90ms spawn floor with the prebuilt bundle, ~125–145ms for a typical local `--price` command, and a remote-URL price spawn costs ~0.33s more than the identical local-file spawn. `bun test` runs a file's tests serially within one worker, so spawn counts translate roughly 1:1 into wall clock.

## Completed (archival)

Tiers 1.1–3.1 landed as items 1–13. Combined effect: ~210 fewer subprocess tests, split serial price/usage files, cached help assertions, a once-per-run CLI bundle, and slow e2e files scheduled first.

Phase 1 landed as items 14–16. Combined effect: ~13s from local-file `--price` inputs, an arity-scan prefilter, and memoized/scoped tree walks.

Phase 2 landed as items 17–20. Combined effect: ~29–32s from collapsing per-model `--price` factories into in-process estimator tables plus 1–2 CLI smokes per command.

Phase 3 landed as items 21–23. Combined effect: ~18–22s from moving usage/help/incidental argv assertions onto the parser, option resolvers, and help renderer.

Phase 4 landed as items 24–25. Combined effect: one retired-surfaces contract instead of scattered tombstones, plus three fewer billable Deepgram live-e2e voices.

Phase 5 landed as items 26–28. Combined effect: a FileSink runner log plus 64KB-bounded output parsing, parallel head/tail I/O, and ~2–3s from converting budget-preflight self-spawns to in-process checks.

Phase 6 landed as items 29–31. Combined effect: longest-processing-time-first scheduling from a surviving file-timings cache, CPU-count validation workers with `--parallel=32` on e2e-only runs, and tiered timeouts plus e2e-only `--retry=1`.

Phase 7 landed as items 32–33. Combined effect: AsyncLocalStorage console isolation plus `AUTOSHOW_TEST_CONCURRENT=1` (set by the runner on e2e-only selections) so `budgetedTest` can use `test.concurrent`, plus ~2–4s from halved lock/lease holds. Comic-audio fixture trims were skipped: the 5.5s/4.1s cost is ffmpeg mix, not wav payload.

1–2. Deleted 211 duplicate per-voice/per-model TTS price spawns (91 Deepgram voice duplicates, 91 Deepgram per-model, 26 Grok + 6 Groq per-voice), keeping one valid-voice smoke per provider and the invalid-voice rejections.
3. Collapsed Deepgram per-model `--price` coverage to two CLI smokes + one rejection; every model now priced in-process in `tts-pricing.test.ts`.
4. Moved invalid-model rejection out of the service-test factories into one in-process loop in `model-selector-messages.test.ts`.
5. Combined legacy filename/token lists in `no-legacy-persistence-contracts.test.ts` into precompiled alternation regexes (one pass per file).
6. Stubbed `Bun.sleep` in TTS/video/OpenAI-REST/image/links retry suites (no more 0.5–2s per retry).
7. Oversized REST diagnostic tests inject a 64-byte capture cap instead of streaming 16 MiB five times.
8. Budget preflight caches successful cents at `.test-cache/budget-preflight.json`, fingerprinted on pricing/config/registry inputs.
9. Shrank long-distance URL consensus fixtures to just over the 10_001-token approximate-path floor.
10. Moved the removed-command/flag matrix to in-process `option-resolution-contracts/removed-cli-spellings.test.ts`.
11. Split `tts-price.test.ts` and `cli-usage-errors.test.ts` into per-topic files; help stays one file behind the `loadHelp` cache with `test.concurrent` post-cache assertions.
12. Runner prebuilds the CLI to `.test-cache/cli.js` (`AUTOSHOW_TEST_CLI_BUNDLE`); `cli-source-entry-smoke.test.ts` keeps source-mode coverage.
13. `orderTestFiles` hoists the known-slow e2e files to the front of the `bun test` argv.
14. Swapped `STABLE_EXAMPLE_AUDIO_URL` for `LOCAL_EXAMPLE_AUDIO_PATH` (`input/examples/audio/1-audio.mp3`) in every `--price` spawn: `defineSTTServicePriceTests` plus `stt-price`, `cli-price-mode`, `music-price`, `tts-price/providers`, `input-contracts`, and the listed usage-error singles. Live e2e and hosted-service factories still use the remote URL.
15. `build-opts-arity-contract.test.ts` string-prefilters with `source.includes('buildOptsFromFlags')` before `ts.createSourceFile`.
16. Memoized `walkFiles` in `no-legacy-persistence-contracts.test.ts`; scoped `historical-model-rate-contracts.test.ts` to `docs/benchmarks/*/*/manifest.json`; shared the 125-file e2e source read via `test-runner-contracts/e2e-test-sources.ts`.
17. Collapsed `price-flag/video-price.test.ts` to an `estimateVideoCosts` rate table plus 2 CLI smokes (multi-provider filenames, positional I2V). Rejections, cheapest-default, and artifact names moved in-process.
18. Collapsed `price-flag/stt-price.test.ts` to 2 local-file CLI smokes (`whisper=tiny`, `deepgram=nova-3`); rates stay in `stt-pricing.test.ts`.
19. Trimmed `cli-price-mode.test.ts` `priceCases` from 27 to 7 command-family reps (metadata, write, extract, tts, image, video, music). Dropped the live `ajcwebdev.com` GLM Reader case.
20. Converted remaining price-flag factories in-process: `tts-price/**` keeps multi-provider + write-omit + Mistral voice contracts; `image-price` keeps multi-provider + `--out`; `music-price` keeps multi-provider + write music; `ocr-price` is one `example.com --url-provider firecrawl` smoke with Firecrawl/glm-reader rates in `ocr-pricing.test.ts`. Deleted unused `define*PriceTests` helpers.
21. Converted `cli-usage-errors/**` to `parseNativeCli` / `parseCommandInvocation` / `buildOptsFromFlags` / command-handler checks. Kept one CLI spawn (`tts` missing-file) plus the existing redaction/fatal smokes. Dropped the extract `--price` accept loops and comic price-success cases that were not usage errors.
22. Moved `cli-help-contracts.test.ts` onto `renderRootHelp` / `renderCommandHelp`. Kept 3 spawn smokes for root/extract exit 0 and `benchmark --help` exit 2.
23. Deduped incidental spawns: resume help + missing `outputDirs` are in-process; removed `cache` unknown-command duplicate; collapsed three `setup --step not-real` spawns into one in-process handler assertion.
24. Folded retired-surface tombstones into `option-resolution-contracts/retired-surfaces.test.ts` (`benchmark`, `gemini-3.1-flash-lite`, `kimi-k2.7-code`, `tts-1`, `orpheus-arabic-saudi`, `MiniMax-M2.5`, `music-2.6-free`, comic `--panel`, `prebuiltUrl`/`prebuiltSha256`, `tierSplit`/`overallTier`). Deleted the five extract-write retired-model guards. Historical-*pricing* and resume fixtures stay.
25. Deleted duplicate live Deepgram e2e files `deepgram-aura-2-{arcas,aries,helena}-en.test.ts`. Kept `deepgram-aura-2-thalia-en` (`DEEPGRAM_DEFAULT_VOICE`) and removed the extra price-registry mappings.
26. Opened one `Bun.file(...).writer()` FileSink in `createRunArtifacts` and made `appendRunnerLog` a sync enqueue with interval/size flush. `forwardSpawnOutput` no longer awaits per-line I/O. Bound `parseOutputDirFromText` / `parseCommandEstimatedTotal` to the last 64KB behind one `stripAnsi` pass in `parseCommandOutputText`.
27. `Promise.all`'d `cleanupTestOutputRoot`, `prebuildTestCliBundle`, and budget preflight. Parallelized `buildModelCalibrationReport` and `hashBudgetPreflightInputs` reads. `writeLatestRunLog` now `Promise.all`s its reads, stops double-reading `report.json`, and tail-truncates `commands.log` at 256KB.
28. Converted `budget-preflight.test.ts` self-spawns in-process: 0.10¢ Replicate skip uses `toObservation`; handshake cases call `findUnevaluatedBudgetKeys`; the 125-file registry walk inverts `BUDGET_PRICE_SELECTION_REGISTRY` via `selectorMatchesFile` instead of 125 `resolvePriceSelection` calls.
29. Persist `{file → p50 durationMs}` plus last-passed per-test durations to `project/test-output/.test-cache/file-timings.json`. `orderTestFiles` sorts longest p50 first (seed fragments remain the cold-cache fallback). `readHistoricalLookups` reads that cache so `estimatedDurationMs` survives run-dir cleanup.
30. `DEFAULT_TEST_RUNNER_CONCURRENCY` is `os.availableParallelism()` for validation `--max-concurrency` / `--parallel`. E2E-only selections get `--parallel=32`.
31. Tiered timeouts: bun `--timeout` is 10 minutes, `budgetedTest` / hosted factories default to 20 minutes, and whisper-local / video / lyrics-video / transcript-video keep 2 hours. E2E-only selections also get `--retry=1`. Adaptive concurrency retries stay.
32. Rewrote `test-console-harness.ts` onto `AsyncLocalStorage` (wraps `test` / `it` / `test.concurrent` callbacks). Download e2e helpers now resolve dirs from `result.outputRoot` instead of a global before/after snapshot. `budgetedTest` registers `test.concurrent` when `AUTOSHOW_TEST_CONCURRENT=1`; the runner sets that for e2e-only selections. Skip and unevaluated-key handshakes stay serial.
33. Halved real lock/lease holds: process-lock 120/300/30 plus fixture 50/80/100, adaptive lease hold 100, links per-fetch skew `* 2` → `* 1`, TTS provisioning 20/15, setup-performance 15/15. Race semantics kept.

## Carried forward

- Old item 15 (comic-audio phase-2 mocked tests at 5.5s/4.1s) was inspected in Phase 7 and skipped: the cost is ffmpeg mix + the mocked pipeline, not the 100ms wav payload, and shrinking cues would break the dual-barrier / mix-duration contracts across seven comic-audio files.
- Old item 14 (legacy-guard retirement policy) landed as completed item 24, old item 16 (arity-scan narrowing) landed as completed item 15, and old item 17 (other price-flag loops) landed as completed items 17–20.

## Candidates

None remaining. Phases 1–7 are complete.

## Expected impact

Phases 1–7 removed the remote-URL premium from offline `--price` spawns, collapsed per-model price factories, moved usage/help/budget-preflight assertions in-process, folded retired-surface tombstones, unblocked runner log I/O, restructured full-e2e throughput (LPT scheduling, CPU/e2e worker caps, tiered timeouts), unlocked intra-file `test.concurrent` for e2e-only `budgetedTest` loops, and halved the last real lock/lease sleeps.
