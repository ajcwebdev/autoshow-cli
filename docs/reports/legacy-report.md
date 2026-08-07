# Legacy and Backwards-Compatibility Audit — Closed

Two audits, twelve lenses, twelve waves. All of it has landed. This document is now a record of what was found and fixed, plus the short list in §4 of items that were deliberately left open because each needs a decision rather than a cleanup.

The first audit (2026-08-06) swept `src/`, `test/`, `scripts/`, `package.json` and `Dockerfile` for obvious dead code and closed out across Waves 1-5. The second audit (2026-08-07) was organized by *kind* of legacy rather than region of tree — twelve independent lenses — and found roughly 100 items the first never saw. Waves 6-12 closed it.

The interesting result was never the dead code. It was **drift**: two catalogs that were supposed to stay in sync and did not, a schema documenting a capability the merger never implemented, docs instructing users to set env vars the CLI stopped reading. Dead code is harmless until someone reads it; drift actively misleads. Every user-visible defect this audit found was drift, and §3 records the structural fixes that make each class of it self-detecting.

---

## 1. Waves 6-12 — outcomes

Every claim below was re-derived from the tree on 2026-08-07 rather than trusted from the wave plan. Where the original finding turned out to be wrong or overstated, that is called out — those corrections are the most useful part of this record.

### Wave 6 — drift defects, and the mechanism behind them

| Defect | Outcome |
|---|---|
| `config --stt together=<model>` wrote a config no command could load | `togetherStt` + `whisperfile` added to `ExtractSttDefaultsSchema`; `registry-derived-config-keys.test.ts` now asserts every registry `configPath` parses |
| `setup --step image`/`--step video` reported the wrong credentials | `IMAGE_PROVIDER_ENV_KEYS`/`VIDEO_PROVIDER_ENV_KEYS` derived from the registry via `getHostedProviderEnvKeysForConfigPrefix` |
| fal.ai had no documented credential; `REVE_API_KEY` was documented but unread | `FAL_API_KEY` added to `.env.example` and `HOSTED_PROVIDER_ENV_CHECKS`; `REVE_API_KEY` deleted. Reve was never dropped — ADR-019 re-hosted Reve 2.1 *under fal*, which is why the key looked orphaned |
| `whisperfile` priced as a network call | `stt-config/stt-whisperfile.json` added |
| `benchmark --text` documented `docs/benchmarks/text/` | Corrected to `docs/benchmarks/write/` in help, docs, and the assertion that pinned the wrong string |
| Docs prescribed `AGENT=1`, `YTDLP_COOKIES*`, and an OpenAI custom-voice flow the CLI does not read | All removed |
| Seven `config` flags accepted and silently discarded | `omitFlags` applied (5 image, 2 video) **and** `buildConfigPatchFromFlags` now warns on any explicit flag with no config destination — the silence was the real bug |

The last row is the one that generalized. That warning is why the `llamafile` item in §4 is now a loud no-op instead of a silent one.

### Waves 7-8 — mechanical deletions

All landed. Confirmed gone: the five per-provider `computeActual*OcrCost` functions (superseded by `computeActualTokenOcrCost`), `runOpenAICompatibleTextOnlyStt`, the ADR-002 re-export shims in `process-url.ts` and elsewhere, `metadata-target-utils.ts` entirely, the `ensureSttTargetSetup` forwarding stub, the `VIDEO_MODES` redeclaration, the local `toArray`, the comic character-catalog wrappers, `loadAndVerifyLocationReferenceSnapshots`, `budgetedTestIf`, `resetQpdfHealthCacheForTests`, the `getHostedOcrLimitSource` default arm, `nativeGeminiImage`, the `hfDownloadRepo` indirection, the `GenerationResourceGate` duplicate, the dead comic character types, `ComicGridChunk`, `hostedTtsChunkJob`, the music diffusion knobs, the `GeneratedImageResponse` echo fields, `ResolvedEngine`, `DownloadProfile.flags`, the empty `reve/` directory, and the zero-byte `x-spaces-types.ts`.

Three corrections to the plan:

- **`selectorArgToInternalArgs` was not dead.** The plan said to prefer deleting it as "a second, divergent copy of validation logic". It is live at `flag-helpers.ts:138`, called from the same file. It stayed.
- **The six shadowed `case '<provider>-tts'` arms were five, and the survivors are not shadowed.** `DEFAULT_HOSTED_TTS_MODEL_BY_FLAG` covers elevenlabs, groq, openai, deepgram, speechify and cartesia. The `minimax-tts`/`grok-tts`/`mistral-tts`/`gemini-tts`/`hume-tts` arms still in `resolveCheapestModelForFlag` are reachable and correct — those five providers really do resolve to their cheapest model.
- **`downloadFile` still returns `DownloadResult`, and no caller reads it.** Deliberate: the plan scoped the return-type change out as a signature change, and that call stands. It is the one piece of §2 residue still in the tree.

### Wave 9 — test residue

`test/test-runner/reports/context.ts` was the lead item and it collapsed the way the plan hoped: rather than porting 85 dead per-provider selector keys to a new spelling, `buildPairsFromMetricArgs` was rewritten to the spellings tests actually use — `--provider`, `--url-provider`, and the step-selector table — alongside the `run.json` metadata path. `adaptive-provider-groups.ts` was rewritten from flag-name maps to provider-name sets. `price-selection.test.ts` now builds fixtures from public selectors and asserts the *internal* ones stay out. The `--cleanup` no-op, the `validation-next` fixtures, and the orphaned `repair_saved_stt_artifacts.ts` are gone, and `build_reference_report.ts` lost its deAPI / GLM-STT / OpenAI-STT branches.

### Wave 10 — back-compat arms

Landed 2026-08-07, one item per commit. Every item was re-derived before being touched, which is what caught four corrections — three of them cases where following the plan literally would have made things worse:

- Adding `'totalCost'` to the benchmark alias readers would have introduced a **new** dead alias. Every writer already emits `cost`, `cost` was already the first alias, and no committed `run.json` carries a step-level `totalCost`. It was deleted from `run-text-benchmark.ts` instead of added.
- Deleting `RUNTIME_ONLY_FLAGS` would have **regressed** a live warning suppression. The `!RUNTIME_ONLY_FLAGS.has('prompt')` conjunct is indeed constant-true, but the set itself now suppresses a spurious "no config destination" warning for nine of its twelve members. Kept, with disjointness and the `prompt` premise pinned as separate assertions — the first cannot see the second.
- Bumping `schemaVersion` alongside the URL-manifest `resolvedStep2.backend`/`backends` removal would have made **every manifest on disk non-resumable**, because four hard `schemaVersion !== 2` rejects exist with no migration code anywhere. Landed with no bump. Deleting the fields and letting `tsc` enumerate the writers also found a fourth writer (`url-resume.ts`) hand-inspection had missed.
- The hosted-OCR throughput store's "v1 tolerance" had no expressible tolerant counterpart — the sibling token store's current version *is* 1. Resolved strictly: each store accepts exactly its current version.

The lesson generalizes past this wave: a `[verified]` mark recorded that a finding's *observation* was confirmed, never that its *prescription* was.

### Wave 11 — documentation, ADRs, infrastructure

- **Help flag-group catalog.** `CONFIG_COMMAND_HELP_FLAG_GROUPS` was never config-specific — it is the section ordering for *every* command's grouped help, which is exactly why nobody noticed it had drifted. Renamed to `HELP_FLAG_GROUPS` and moved to `root-definition.ts` beside `HELP_COMMAND_GROUPS`. Dropped three keys no flag claims (`output`, `step-1-download`, `tts-openai` — OpenAI's TTS options reach users through the generic `--tts-*` selectors, not the `tts` command). Added `fal-video`, which was missing, so fal.ai's three video flags had been rendering in the unlabeled trailing block. `help-flag-groups.test.ts` now pins declared and claimed as equal in both directions — and immediately caught a **fourth** stale key the audit had missed, `transcript-video`, which turned out to be claimed from a command file rather than a flags module. That is the finding the audit's own regex sweep was structurally unable to see.
- **Infrastructure.** `tsconfig.json` reduced to `"exclude": ["node_modules"]` — `src/runtime/build` never existed and `runtime`/`output` are already outside the `src/**` + `test/**` include globs. `Dockerfile` lost `ENV AUTOSHOW_DOCKER_IMAGE`, the last piece of the Docker-detection mechanism ADR-005 removed; `AUTOSHOW_SYSTEM_TESSDATA_PREFIX` on the next line is load-bearing and stays.
- **Comic schema versions.** Docs said structured scripts were v2 and scenes/panel bundles v3. Code pins v3 and v4. Also corrected the claim that older artifacts are "readable migration inputs" — there is no migration reader anywhere; each schema pins its version with `v.literal` and rejects everything else.
- **Consensus skill references** pointed at a nonexistent ADR-021; corrected to ADR-014.
- **`docs/cookies.md`** told users to leave the CLI for user-agent overrides, extractor args and PO tokens. `download -- <argv>` forwards arbitrary yt-dlp arguments and a no-input `download --` runs yt-dlp raw. Added a *Passing yt-dlp arguments* section and pointed both escape hatches at it. The "these env vars are not read" list was accurate and stayed.
- **ADR annotations**, following the ADR-005 convention of annotating as history rather than rewriting:
  - **ADR-003** — its phase-1 implementation note was wrong twice over: `RunTargetsOptionsBase` was never removed (it is live with both extenders, exactly as the decision predicted), and all four types it certifies as gone are live. Its phase-3 layout is also stale — `src/types` was later regrouped by workflow, so none of the `src/types/cli/...` paths exist. What survived is the part that mattered: one barrel, no deep-path shims.
  - **ADR-004** — OCRmyPDF is gone (ADR-009 chose Tesseract as the only local engine) and `AUTOSHOW_BIN_DIR` is no longer a resolver input. The precedence *shape* is unchanged; its first tier is fed by `--bin-dir` alone.
  - **ADR-005** — two of its verification steps are unrunnable as written, for the same two reasons. Annotated rather than repaired, since the decisions they verified are unaffected.
  - **ADR-001** — the two convertible-ebook registries it describes were consolidated into one, and it is the metadata-side copy that survived.
  - **ADR-002** — its module boundaries all hold, but six cited paths were renamed afterwards (`cli.ts` → `url-cli.ts`, `manifest.ts` → `url-manifest.ts`, and so on). Added the mapping table, plus the reason the prefixes exist: `unique-source-name-check.ts` forbids three `manifest.ts` files under `src/`.
  - **ADR-018** — this one was a real defect, not an annotation. Phase 2's "preserve `music-2.6` only in historical benchmark and result readers" clause was never implemented, so `getMusicModelMeta` returned `undefined` and all four committed `docs/benchmarks/music/2026-05-21_*` runs repriced to **$0** — a wrong number that reads exactly like a free provider. Closed with `RETIRED_MUSIC_MODEL_RATES` in `compute-actual-costs.ts` carrying the rates the model held at retirement (15¢/track, +1¢ for generated lyrics), pinned by contract test, with a recorded `providerCostCents` still taking precedence. Same shape ADR-019 used for Replicate `alibaba/happyhorse-1.0`.

### Wave 12 — the naming and vocabulary lens

The one lens that never executed. Run 2026-08-07 across all five of its declared territories:

| Territory | Result |
|---|---|
| Superseded error-type names (ADR-006) | **Clean.** `AppInfrastructureError`/`AppInternalError`/`AppValidationError`/`AppUsageError` are canonical; `LEGACY_ERROR_HINTS` and `UnsupportedArtifactSchemaError` are gone; `validateCliValue` routes through `rethrowAsUsage` as decided |
| Removed command names (`stt`, `ocr`) | **Clean.** One doc sentence, which correctly says they do not exist |
| Renamed or removed providers | **Clean.** `reve/2.1` is the live fal-hosted model; `deapi` is a live `links` section independent of the retired STT provider; PaddleOCR, GLM-STT and `glmStt` survive only inside negative assertions |
| Pre-ADR-010 artifact filenames | **Clean.** Only ADR-010's own historical text and one `not.toContain` assertion |
| `epub` where the concept is `chapter` | **One finding, fixed** — below |

**The finding.** The `--chapters` and `--length` flags are format-neutral, and so is the `chapters` config key. But the option they threaded into was named `epubChapterFiles`, and it governs PDF chapter autodetection too — `shouldExportEpubChapters` and `shouldAttemptPdfChapterExport` read the same value. Same for `epubChunkLimitChars`, whose flag description already says "EPUB **or PDF**". Renamed to `chapterFiles` and `chapterChunkLimitChars` across 37 sites. Verified first that this is a pure rename: `ExtractionOptionsSchema` is validated in memory and never persisted, no committed artifact carries either key, and the config schema already used the neutral spelling.

**Deliberately not fixed.** The `ExtractRoute` value `'x-space'` is overloaded to mean "URL article" throughout resume — ADR-002 records this as its finding 2. It is genuinely misleading, but it is a *persisted* value: it appears as `extractRoute` in run manifests and as a `childBatches['x-space']` key. Renaming it is an artifact migration needing a `schemaVersion` bump plus the upgrader that, per Wave 10, must ship in the same change. That puts it in §4, not here.

---

## 2. Verification bar

Per change: `bun run check`, then the no-cost smoke set (`cli-help-contracts`, `cli-usage-errors`, `option-resolution-contracts/`).

`bun test test/test-cases/validation/` is green. Treat any failure as real — the old standing allowance for "expect exactly the three pre-existing failures" was withdrawn on 2026-08-07 after ten unrelated failures were cleared alongside Wave 10 (all drift left by the model-refresh commits: a `hasGeminiImageSignal` suffix ADR-019 retired, six URLs duplicated across `links` registry sections, hand-mirrored `links` fixture constants, a stale `links --grok stt` rejection, an uncommitted OCR combined report, a stale `docs/benchmarks/summary.md`, and a setup summary label ADR-015 had deliberately renamed).

Never run paid-provider commands to verify anything in this document. Several items cite paid e2e suites as pins — those are read-only citations, not instructions to execute.

---

## 3. What actually prevents recurrence

Four of this audit's defects were the same bug wearing different clothes: a hand-maintained list that mirrors a registry and silently stopped. Patching the list leaves the next occurrence waiting. What shipped instead, and what each now guarantees:

- `registry-derived-config-keys.test.ts` — every step-2 registry `configPath` parses under the strict config schema.
- `getHostedProviderEnvKeysForConfigPrefix` — setup's credential catalogs are derived, not typed.
- `help-flag-groups.test.ts` — declared help groups and claimed help groups are equal in both directions. This one earned its keep on the first run.
- `buildConfigPatchFromFlags`'s discarded-flag warning — a flag with no config destination says so instead of succeeding silently.
- `explicit-runtime-exclusions.test.ts` — `RUNTIME_ONLY_FLAGS` stays disjoint from `FLAG_TO_CONFIG_PATH`, with `prompt`'s premise pinned separately because the disjointness check structurally cannot see it.
- `RETIRED_MUSIC_MODEL_RATES` — retiring a priced model now means moving its rate to a historical table, not deleting it.

**Still unguarded, and known to be.** The `links` fixture constants in `test/test-cases/validation/content-output/metadata-links-lyrics-contracts/` are hand-maintained mirrors of the `model-links/*.json` registries. They drifted badly before and were regenerated from production output; they will drift again at the next model refresh. They want a generator or a refresh-workflow step. This is the same duplicate-a-registry-by-hand mechanism above, still live.

---

## 4. Open — decisions, not cleanups

Each of these was verified as still present on 2026-08-07. None is a defect you can fix by deleting something; each needs someone to choose.

**Provider and model catalog**

- **`mistral-ocr-latest` is a moving alias** duplicating the concrete `mistral-ocr-4-0` row, against a no-moving-aliases policy stated in ADR-011, ADR-018 and ADR-019. Drop the alias (8 test files reference it) or amend the policy to record the exception.
- **OpenAI `tts-1`/`tts-1-hd`** are the previous TTS generation and the only hosted TTS rows ADR-018 did not touch. Provider-side retirement is **unverified** — no API was called. Re-check at the next refresh.
- **Speechify's voice catalog is duplicated** in `tts-speechify.json` and `tts-models.ts`. The registry copy is never read and cannot express the per-model compatibility split the TS constants encode. Pick one home.

**CLI surface**

- **`llamafile` is advertised by `config --help --llm` but has no config destination.** No longer silent — Wave 6's warning makes `config --llm llamafile=X` print "These flags have no config destination and were not saved: --llamafile" and write nothing. So the choice is now cosmetic-but-real: give it a destination in `LLM_PROVIDER_FLAGS`/`LlmDefaultsSchema`, or drop it from `WRITE_LLM_PROVIDER_TARGETS`' config-command view.
- **`createModelValidator` interpolates internal flag keys** into `Invalid --<flag> model` across 68 call sites, so `--provider deepinfra=…` fails with `Invalid --deepinfra-ocr model`, naming a flag the user never typed.
- **Search-grounding flag naming** on the standalone `image` command: `image-search-grounding` is renamed to `search-grounding` there and nowhere else.
- **`--tts-voice` is silently ignored in dialogue mode.**
- **`isMultiSpeakerRequested` returns true on `ttsDialogueFormat` alone**, with zero speaker mappings.

**Architecture**

- **The `'x-space'` `ExtractRoute` value means "URL article".** Persisted in manifests, so renaming needs a `schemaVersion` bump *and* an upgrader in the same change — see Wave 10's third correction for why the bump alone is the dangerous half.
- **URL article provider capability negotiation is unreachable from every production caller** — `assertUrlArticleCapability` and the per-provider `capabilities` arrays were never wired to a CLI or config surface. Wire it or shrink it to what ships.
- **`isLocalUrlBackend` hardcodes `'defuddle'`** where a registry-derived group exists. Behavior is identical today; the point is that a second local backend cannot silently diverge.
- **The typed `baseUrl` seam** is on some write providers and not others — ADR-005's open question of whether it stays on all four or none.

**Benchmarks and fixtures**

- **The `whisper-cpp` PATH probe** at `benchmark-services.ts:31` is a real bug, but fixing it schedules five whisper models and gigabytes of downloads. Decide the `models` array in the same change.
- **`.gitignore`'s `input/` allow-list is inert.** The bare `input` pattern on line 7 means the negations below it re-include nothing, so which fixtures ship is decided entirely by what was force-added to the index. `input/examples/comic/` is silently untracked as a result, and `docs/tests` calls `anthony-voice.mp3` a "committed" fixture when it is not tracked either. Decide the intended fixture set first, then express it — either working negation chains (`input/*` + `!input/examples/` + per-subdir `!…/**`) or drop the negations and rely on explicit force-adds.
- **Two regression-guard policy calls** in `cli-usage-errors.test.ts:312` and `combined-report-weighted-ranking-contracts.test.ts:224-236`.

---

## 5. Cleared — do not re-litigate

- **`schemaVersion` optional on `run.json` shapes** — refuted. The finder wanted it required; the skeptic showed the type is correct as-is.
- Everything in the first audit's kept list stays kept: `llama` vs `llama.cpp` naming, the `*-targets.ts` barrels, `fromLegacyCheck`, bare model names in `setup --models`, `--concurrency` runner rejection, `ttsSpeaker` for `--kitten-voice`, `structured-output/compat-fallback.ts`.
- Owner-declined and not re-proposed: the singular `<provider>ImageModel`/`VideoModel`/`MusicModel` fields, and the two-image character identity cards.
- `rolling-shingle-approximation` is live source, not residue.
- The `CLIUsageError` name-string arm, closed with Wave 10: `isCLIUsageError` is `instanceof`-only and returns a type predicate. The class's own `name = 'CLIUsageError'` stays — after this it is a diagnostics label, not a control-flow key, and renaming it would change every serialized diagnostic payload.
- The five per-provider `-tts` arms in `resolveCheapestModelForFlag`, the local `selectorArgToInternalArgs`, and `decodeLegacyPuaText` and friends: all checked, all live.
