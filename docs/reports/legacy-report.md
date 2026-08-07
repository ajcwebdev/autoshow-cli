# Legacy and Backwards-Compatibility Audit — Open Items

Original audit: 2026-08-06, an 18-agent sweep of `src/`, `test/`, `scripts/`, `package.json`, `Dockerfile` and supporting config, with adversarial verification of every finding. All four implementation waves have since landed and are committed (`f3de3afe`, `7da8bbae`): Wave 1 (zero-risk deletions), Wave 2 (flag-surface break), Wave 3 (artifact-format break), and Wave 4 (OCR config-key migration, TTS multi-speaker break, collector cleanup). This document was refreshed on 2026-08-07: the full audit findings and per-wave implementation records were removed, and everything below — the only work still open — was re-verified against the committed tree with fresh line numbers.

**Wave 5 (2026-08-07, uncommitted) closed every remaining item that is provably behavior-neutral**, each verified by an independent skeptic pass before it was applied: §5.4 (three of four base-URL strippers), §5.5 (`buildLyricsCues`), §5.6 (`--grok` hint), the inert sketch/canonical reference chain, and the test-runner leftovers. Two skeptic passes forced corrections to the plan and are recorded inline below. What remains open is exclusively work that changes user-visible behavior or needs a product call — none of it is mechanical.

---

## 1. Audit items never scheduled into a wave (confirmed still present — open)

**§5.4 base-URL `/chat/completions` suffix stripping — RESOLVED in part; the rest is an owner call.** Three of the four copies are gone (`run-grok.ts`, `run-grok-image-gen.ts`, `deepinfra-ocr.ts`); each was inert, since no caller passes a baseUrl ending in `/chat/completions` and deepinfra's was statically false against a constant. `grok-ocr/grok-ocr.ts:8-13` **stays** — it is the one live stripper, hard-pinned by `ocr-contracts.test.ts:150,157`, which passes a full endpoint URL and asserts it is not doubled. The audit's claim that `runGrokModel`'s `baseUrl` parameter is structurally unreachable is **false**: the identical 4th parameter on `runAnthropicModel` and `runCerebrasModel` is exercised by direct-import contract tests (`anthropic-rest-contracts.test.ts:85`, `response-chat-contracts.test.ts:288`), and ADR-005 pass 4 created it deliberately as the in-process replacement for the deleted `*_BASE_URL` env vars. The parameters were therefore kept. Still open, as one decision: remove the typed `baseUrl` seam from all four write providers (grok, anthropic, cerebras, together) or keep it on all four — do not remove it from grok alone.

**§5.5 `buildLyricsCues` wrapper — RESOLVED.** Body-for-body identical to `buildTranscriptionCues(transcription, LYRICS_CUE_LIMITS)` (proved by diff, not inspection); the sole call site in `run-lyrics-video.ts` was swapped and the wrapper deleted in one change.

**§5.6 Stale `--grok` selector hint — RESOLVED, with different wording than proposed.** The report's suggested replacement (`--provider grok=…`) is wrong: `collectImageTargets` is reached from four surfaces with three different selector spellings — `--provider grok=<model>` on `image`/`resume`, `--image grok=<model>` on the `write` pipeline (which has no `--provider` flag at all), and `--image-model <model>` on `comic`. Any hardcoded selector is wrong on at least one. The message now names the model alone, matching the sibling precedent at `gemini-image-targets.ts:54`. The `['--image-input']` argument was deliberately left alone — that spelling is pinned by three e2e image suites.

**§5.8 `whisper-cpp` PATH probe in benchmarks — open, needs an owner call (not safe as a mechanical fix).** The real location is `setup-and-utilities/benchmark/benchmark-services.ts:31`, not `benchmark/`. The diagnosis holds: it gates on a binary that is never executed, while the benchmark runs `whisperBinaryPath` (`runtime/bin/whisper-cli`). The one-line fix (`commandExists(whisperBinaryPath)`, which accepts absolute paths) is correct but has a real consequence — on a correctly set-up machine the default `bun autoshow benchmark <audio>` currently skips whisper entirely, and afterwards would schedule all five whisper models, each routing through `ensureWhisperReady` and potentially downloading GBs of ggml weights plus a CoreML conversion. Fix the probe and trim the `models` array together, or accept the new default. `docs/commands/setup-and-utilities/benchmark/benchmark.md:428,432` needs the same correction.

**§6.5 Remaining regression-guard policy calls.** Most of this item is resolved: the waves applied the delete-if-subject-gone rule to every guard they touched, and the `tierSplit`/`overallTier` absence guards no longer exist anywhere in `test/`. Two decisions remain open. First, the retired `stt`/`ocr` command guard loop at `cli-usage-errors.test.ts:312` — its subject no longer exists anywhere, so the audit's rule says delete, but it is the owner's call. Second, the legacy-field guard loop at `combined-report-weighted-ranking-contracts.test.ts:224-236`: five of its seven names are pure legacy guards, but `thresholds` (:227) and `balancedComposite` (:231) are live fields of the current consensus library whose absence assertions pin a no-leak serialization contract — keep or re-home those two if the loop is pruned. The surviving removed-alias guards (e.g. `cli-usage-errors.test.ts:342`) are the cheap ones that enforce the completed cleanup; recommendation unchanged: keep them.

**§7.4 `CLIUsageError` name-only cleanup.** `src/utils/error-handler.ts:48` still sets `this.name = 'CLIUsageError'` on `AppUsageError`, and `isCLIUsageError` keeps a name-string arm (:147-149) that matches nothing in-process. If a full break is wanted, rename the error name and drop the arm (updating `app-error-contracts.test.ts` and any stderr matching). The `CLIUsageError(...)` factory (:98) is the canonical current constructor with ~582 call sites and stays.

**§7.5 `rolling-shingle-approximation` residue — CLOSED as not-residue; do not re-open.** Two factual errors in the original item. First, the string is still *live source*: `build_combined_report.ts:277` (and the spaced form at `:283`) matches it inside `declaresLongDistanceApproximation`, consumed at `:808` — a non-redundant back-compat arm for on-disk reports carrying `longSequenceDistance` without `longSequenceDistanceMethods`. Renaming the fixture would strand that literal with zero in-repo exercise. Second, there is no wording-only surface: the label at `url-combined-report-contracts.test.ts:287` is fixture *input* echoed by four expected literals at `:336,:340,:344,:347`, and the "mixed methods" note is generated by `build_comparison_report.ts:441`, not hand-written prose. Any rename rewrites assertions rather than wording.

---

## 2. Open follow-ups exposed by the waves

**Model-validator errors name untypeable flags** (Wave 2). `createModelValidator` (defined at `models/model-validation.ts:5`; the message template is `:14`) interpolates the internal flag key into `Invalid --${flag} model …`, so the nine video validators (`video-models.ts:10,23,33,40,46,53,66,72,79`) emit `Invalid --gemini-video model "x"` for a flag typeable on no surface, and the eight image validators (`image-models.ts:11,23,30,40,47,56,73,83`) have the identical wart. Two corrections to the original framing. The scope is not video+image: all 68 `createModelValidator` call sites share the wart — `cli-usage-errors.test.ts:435-439` proves it by asserting `--provider kimi=<model>` yields `Invalid --kimi-ocr model …` — so fixing only video and image makes them diverge from stt/tts/llm/ocr/music. And a single static label cannot be correct, because the typed selector differs per command (`--provider p=<model>` on `image`/`video`/`resume` vs `--image`/`--video` on `write`, plus `autoshow.config` paths like `defaults.post.video.geminiVideo`, where the user typed no flag at all); the message likely has to drop the `--flag` shape entirely. Two assertions must change with the code: `model-flags-and-ordering.test.ts:44-46` and `bfl-recraft-image-options.test.ts:41` (music has a third at `music-provider-contracts.test.ts:70,74,77` if it is included).

**Search-grounding errors are still command-inaccurate on the standalone `image` command** (Wave 2). The Wave 2 rewording to `--image-search-grounding` is correct on `write`/`config` but the image command renders the flag as `--search-grounding` via the rename map at `define-image-command.ts:30`. Error sites: `bfl-image-targets.ts:22`, `fal-image-targets.ts:17`, `gemini-image-targets.ts:54,63` and the sibling `*-image-targets.ts` services. A full fix threads the command-local rename map into the messages.

**`--tts-voice` is silently ignored in dialogue mode** (Wave 4). With the Gemini-specific conflict error removed, no provider errors on `--tts-speaker` plus `--tts-voice <provider>=X`; the voice is just dropped for the run (`run-gemini-tts` sets `voiceId` to `undefined` whenever a registry is present, and the docs now state this). A single generic guard in `createTtsTargetSelection` would cover every provider at once.

**`isMultiSpeakerRequested` accepts zero speaker mappings** (Wave 4). The predicate (`dialogue-normalizer.ts:95`) is true whenever `--tts-dialogue-format` is set, even with no `--tts-speaker` mappings, producing the downstream `requires at least one --tts-speaker` error rather than a parse-time one. The two-arm predicate is now simple enough to tighten.

**The inert sketch/canonical reference chain — RESOLVED.** The two ignored parameters, the `sketchCharacterRefs`/`canonicalCharacterRefs` fields on `ResolvedReferenceImages` and `PrimaryCharacterReferenceState`, the filename-prefix filters that computed them, and the three producer call sites are gone. The filters were provably always empty (primary refs are `NN-<key>-identity-card.png` or `reference.<ext>`, never `sketch-sheet.png`/`source.*`), nothing serialized the fields, and the price path discards the return value entirely. The on-disk `sketch-sheet.png`/`source.<ext>` assets are untouched — they are still written and live.

Three adjacent items surfaced and were deliberately left alone: `priorPanelRefs` is a fourth write-only field with zero readers, but removing it cascades into `buildResolved`'s `prior` parameter; `missingPrimaryCharacterRefs` is structurally always `[]`, making three user-facing guard blocks unreachable (`generate-comic-pages.ts:101-108`, `generate-panel-images.ts:142-147`, `generate-scene-sketches.ts:439-447`) — deleting live-looking error messages is a judgement call; and `ResolveReferenceImagesOptions` (`panel-prompt-utils-types.ts:10`) is exported through `types/index.ts:213` with zero consumers.

**Test-runner leftovers — RESOLVED.** `parseResolveOptions` inlined, `normalizePathFilter` unexported, and the duplicate `comic generate-images rejects invalid page selection flags` test at `:744` deleted (sorted-diff identical to `:597`; zero coverage lost, file goes 64 → 63 tests, which makes the "passed all 64 contracts" note in `ADR-011:176` stale — that is a historical record, leave it). One small guardrail was traded away: the inline drops the `Required<ResolvePriceSelectionOptions>` return annotation, so adding a second field to that type no longer produces a compile error there.

**Stale image selectors in the report parser** (found during Wave 5, not in the original audit). `test/test-runner/reports/context.ts:84-91` still maps `--gemini`, `--openai`, `--minimax`, `--grok`, `--runway`, and `--bfl` under `COMMAND_PUBLIC_SERVICE_FLAGS.image`. None exist as image selectors today, and `--minimax`/`--runway` are not image providers at all per `STANDALONE_IMAGE_PROVIDER_TARGETS` (`provider-targets.ts:16-25`). No test drives these entries, so they are dead parser rows — but confirm nothing parses an older on-disk report through them before deleting.

**Forward-looking conventions.** `ManifestLogActualCostBreakdown` (`types/pipeline-core/write-manifest-log-types.ts:15`) is the only read-back-shaped cost type in `~/types`; if more manifest readers need one, share it rather than widening `ActualCostBreakdown`. And `src/types/ocr-workflow/ocr-types.ts` no longer declares a local OCR engine type; if a second local engine is ever added, reintroduce the union rather than re-threading a parameter.

---

## 3. Pre-existing failures, unrelated to the waves (re-verified by execution 2026-08-07)

Re-running the three affected local no-cost files gives 27 pass / 3 fail:

- `validation/providers/service-test-kit-contracts.test.ts` — `hasGeminiImageSignal` (`test/test-utils/provider-failure-classifiers.ts:73`) still requires a `-image-preview` suffix that commit `0d23c3dd` renamed to `-image`.
- `validation/reports-pricing/combined-report-weighted-ranking-contracts.test.ts` — `docs/benchmarks/ocr/combined-comparison-report.json` does not exist (ENOENT at :172).
- `validation/reports-pricing/url-combined-report-contracts.test.ts:466` — refinement of the Wave 3 record, which said the url artifact was also missing: `docs/benchmarks/url/combined-comparison-report.json` exists but disagrees with `summary.md` (artifact claims 7 runs / 37 provider rows; the summary's source inventory records 2 / 12). The fix is regenerating or reconciling the checked-in benchmark artifacts, not a code change.

---

## 4. Deferred verification (needs an owner-approved run)

Edits landed in Waves 1–4 whose argv or assertions are exercised only by billable or subprocess-spawning suites; each was verified by reading the flag surface or writer, never by execution:

- `validation/runtime/test-runner-contracts/budget-preflight.test.ts` (spawns real `--price` subprocesses) — carries the Wave 1 call-site rewrite to the object-form `resolvePriceSelection` options.
- The three rewritten TTS e2e service tests under `test/test-cases/e2e/service/step-4-tts-e2e/tts-services/`: `groq-canopylabs-orpheus-v1-english-hannah.test.ts` (`--tts-voice groq=hannah`), `gemini-3.1-flash-tts-preview-multispeaker.test.ts` and `mistral-dialogue-ref-audio.test.ts` (both migrated from the removed Gemini-specific and ref-audio flags to the generic `--tts-speaker` surface).
- Price-registry argv edits: `test/test-runner/price-commands/registry/stt.ts:18` (`--stt-reverb-verbatimicity`) and the `tts-mistral-dialogue-ref-audio` entry.
- `e2e/local/step-2-ocr-e2e/ocr-local/ocr-options.test.ts` (spawns real `extract` subprocesses, local-only): the seven `epubExport` → `chapterExport` assertion migrations.

---

## 5. Declined product decisions (owner-resolved 2026-08-07 — do not re-propose)

- **Full singular-field break (§7.2)**: the singular `<provider>ImageModel/VideoModel/MusicModel` fields stay — they are live API for the pricing/cheapest-selection flow (`cheapest-models.ts` builds singular-only option objects). Only the collectors' `?? [options.xModel]` fallbacks were removed.
- **Two-image character identity cards (§7.3)**: the distinct `image`/`outlineSheet` catalog layout stays — it is schema-valid and actively exercised (character-sketch promotes outline sheets into it; revise mode feeds both files).

---

## 6. Examined and kept (verified load-bearing — do not re-litigate)

- **`llama` vs `llama.cpp` naming** — a boundary translation between two live domains (`llama` the user-facing namespace, `llama.cpp` the internal service id), e.g. `aggregate-pricing/llm-estimates.ts:24`, `compute-actual-costs.ts:355`. Unifying is a coordinated rename project, not legacy removal. Optional cleanup: the special-case block at `write-utils/llm-pricing.ts:33-41` folds into a `SERVICE_ORDER` row `{ service: 'llama', modelKey: 'llamaModels' }` behavior-identically.
- **`tts-targets.ts`, `video-targets.ts`, `music-targets.ts`, `image-generation-targets.ts` barrels** — de facto public facades (sole import surface for their modules); converting to direct imports is an optional convention refactor.
- **`CLIUsageError` factory** — canonical current API; only the name-string cleanup in §1 (§7.4) is open.
- **`fromLegacyCheck`** (`run-doctor.ts:311`, used at :402) — bridges the one probe (`readDefuddleCliReadiness`) still returning the old `CheckResult` shape; removable only by first migrating the producer.
- **Bare model names in `setup --models`** — the first-documented accepted format and primary UX; the "legacy resolution" comment is misleading.
- **`--concurrency` runner rejection** (`test/test-runner/args.ts:8-11`) — a live guard against a plausible Bun-flag typo, never an accepted spelling.
- **`ttsSpeaker` key for `--kitten-voice`** (`config-merge.ts:129,324`) — the sole runtime/config representation of the kitten voice setting; only the name is stale, and fixing it is a rename with a stored-config migration.
- **`structured-output/compat-fallback.ts`** — not legacy despite its name: the live capability fallback for LLM providers without native structured-output APIs.

---

## 7. Verification bar

Per change: `bun run check`, then the no-cost smoke set (`cli-help-contracts`, `cli-usage-errors`, `option-resolution-contracts/`). When running the `reports-pricing` or `providers` validation suites, expect exactly the three pre-existing failures listed in §3 until those are fixed.

Wave 5 was verified with `bun run check` (clean) plus the smoke set at 176 pass / 0 fail — one fewer than the 177 baseline, accounted for entirely by the deleted duplicate test. Also run green, as the tightest local no-cost gates on the edited paths: `validation/providers/openai-rest-contracts/`, `validation/providers/anthropic-rest-contracts.test.ts`, `validation/comic/comic-page-anchor-contracts.test.ts`, `validation/extract-stt/transcript-cue-timing-contracts.test.ts` (48 pass), and `validation/runtime/test-runner-contracts/{price-selection,args-selection}.test.ts` (19 pass). The lyrics-video whisper branch has no runtime coverage; its proof is the body-level diff plus `tsc`.
