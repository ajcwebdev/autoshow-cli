# Legacy and Backwards-Compatibility Audit

Three audits, twelve lenses, seventeen waves of cleanup — all landed as of 2026-08-07. The first audit (2026-08-06) swept the tree for obvious dead code (Waves 1-5). The second (2026-08-07) reorganized by *kind* of legacy rather than region of tree — twelve independent lenses — and found roughly 100 items the first never saw (Waves 6-12). The third (2026-08-07) re-ran the lenses with per-finding adversarial verification: 96 findings, 93 confirmed, 2 refuted, 1 routed to a decision, collapsing after cross-lens dedup to 64 mechanical removals (Waves 13-17, net −742 lines). Everything mechanical is done. What remains actionable is one unguarded drift mechanism (end of §2) and the items in §3, each of which needs a decision rather than a deletion.

The durable finding was never the dead code — it was **drift**: hand-maintained lists that silently stopped mirroring their registries, docs prescribing env vars the CLI no longer reads, schemas documenting capabilities never implemented. Dead code is harmless until someone reads it; drift actively misleads. Every user-visible defect these audits found was drift, and §2 lists the guards that now make each class of it self-detecting.

## 1. Completed — Waves 1-17, the short record

- **Waves 1-5** (first audit): obvious dead code across `src/`, `test/`, `scripts/`, `package.json`, `Dockerfile`.
- **Waves 6-12** (second audit): seven user-visible drift defects, each fixed by deriving the drifted list from its registry instead of patching it (§2); ~40 mechanical deletions; test-runner report plumbing rewritten to the selector spellings tests actually use; back-compat arms removed one commit per item; the help flag-group catalog renamed to `HELP_FLAG_GROUPS`, derived, and pinned by a test that caught a fourth stale key on its first run; ADRs 001-005 annotated as history rather than rewritten; ADR-018's unimplemented retired-pricing clause closed with `RETIRED_MUSIC_MODEL_RATES`; the naming lens closed with the format-neutral `chapterFiles`/`chapterChunkLimitChars` rename across 37 sites.
- **Waves 13-17** (third audit, 64 items): dead exports, files, and directories (13); options no caller passes and the unreachable branches they feed (15); registry schema fields, dead type surface, and prompt plumbing nothing reads (12); the CLI surface — the `ttsFlags` sweep from 72 definitions to the 21 the parser actually registers, plus two unreachable parser/benchmark arms (3); test residue, docs drift, and infra (21). Every wave passed the §2 bar, and the batch closed with a per-item adversarial re-verification of the applied diff: every removal complete, zero residue in any spelling, zero collateral edits.

Three lessons that outlived their waves:

- A `[verified]` mark records that a finding's *observation* was confirmed, never that its *prescription* was — four Wave 10 items would have made things worse applied as written (a new dead alias, a regressed warning suppression, a fleet of non-resumable manifests).
- Never bump an artifact `schemaVersion` without shipping the upgrader in the same change: four hard `schemaVersion !== 2` rejects exist with no migration code anywhere, so a bump alone makes every manifest on disk non-resumable.
- Dead *symbols* and dead *reachability behind live symbols* are different classes: optional parameters no caller passes survive symbol-level sweeps and need per-option call-site enumeration to find (all of Wave 14 was this class, which is why it survived two audits).

## 2. Verification bar and guards

Per change: `bun run check`, then the no-cost smoke set (`cli-help-contracts`, `cli-usage-errors`, `option-resolution-contracts/`). `bun test test/test-cases/validation/` is green (1248 tests across 182 files); treat any failure as real — the old standing allowance for pre-existing failures was withdrawn 2026-08-07. Never run paid-provider commands to verify anything in this document; paid e2e suites cited as pins are read-only citations, not instructions to execute.

Shipped guards, each replacing a hand-maintained mirror with a derived source or a two-direction pin:

- `registry-derived-config-keys.test.ts` — every step-2 registry `configPath` parses under the strict config schema.
- `getHostedProviderEnvKeysForConfigPrefix` — setup's credential catalogs are derived, not typed.
- `help-flag-groups.test.ts` — declared help groups and claimed help groups are equal in both directions.
- `buildConfigPatchFromFlags`'s discarded-flag warning — a flag with no config destination says so instead of succeeding silently.
- `explicit-runtime-exclusions.test.ts` — `RUNTIME_ONLY_FLAGS` stays disjoint from `FLAG_TO_CONFIG_PATH`, with `prompt`'s premise pinned separately.
- `RETIRED_MUSIC_MODEL_RATES` — retiring a priced model means moving its rate to a historical table, not deleting it.

**Still unguarded, and known to be.** The `links` fixture constants in `test/test-cases/validation/content-output/metadata-links-lyrics-contracts/` are hand-maintained mirrors of the `model-links/*.json` registries. They drifted badly before and were regenerated from production output; they will drift again at the next model refresh. They want a generator or a refresh-workflow step. Wave 17 deleted their 15 dead exports, which shrinks the mirror but does not fix the mechanism.

## 3. Open — decisions, not cleanups

Each of these was verified as still present on 2026-08-07. None is a defect you can fix by deleting something; each needs someone to choose.

**Provider and model catalog**

- **`mistral-ocr-latest` is a moving alias** duplicating the concrete `mistral-ocr-4-0` row, against a no-moving-aliases policy stated in ADR-011, ADR-018 and ADR-019. Drop the alias (8 test files reference it) or amend the policy to record the exception.
- **OpenAI `tts-1`/`tts-1-hd`** are the previous TTS generation and the only hosted TTS rows ADR-018 did not touch. Provider-side retirement is **unverified** — no API was called. Re-check at the next refresh.
- **Speechify's voice catalog is duplicated** in `tts-speechify.json` and `tts-models.ts`. The registry copy is never read and cannot express the per-model compatibility split the TS constants encode. Pick one home.
- **`costPer1kOutputCharsUSD`/`costPer1kOutputCharsCents` looks dead but is not.** No extract registry JSON populates either spelling, so the field never flows in practice — but the third audit's attempt to delete the chain was refuted: `buildRatesUsed` (`ocr-costs.ts:349-352`) does typed reads of the Cents field and `formatRatesSummary` (`manifest-log-formatting.ts:160`) does a dynamic string-key read that renders it as a `/1k chars` rate in OCR cost diagnostics on the persisted `run.json` surface. Removing the chain means also stripping a formatter arm on persisted-manifest rendering; populating it means adding a rate no current model uses. Either way it is a decision. Do not re-flag it as mechanically dead — the readers are live.

**CLI surface**

- **`llamafile` is advertised by `config --help --llm` but has no config destination.** No longer silent — the §2 discarded-flag warning makes `config --llm llamafile=X` print "These flags have no config destination and were not saved: --llamafile" and write nothing. So the choice is now cosmetic-but-real: give it a destination in `LLM_PROVIDER_FLAGS`/`LlmDefaultsSchema`, or drop it from `WRITE_LLM_PROVIDER_TARGETS`' config-command view.
- **`createModelValidator` interpolates internal flag keys** into `Invalid --<flag> model` across 68 call sites, so `--provider deepinfra=…` fails with `Invalid --deepinfra-ocr model`, naming a flag the user never typed.
- **Search-grounding flag naming** on the standalone `image` command: `image-search-grounding` is renamed to `search-grounding` there and nowhere else.
- **`--tts-voice` is silently ignored in dialogue mode.**
- **`isMultiSpeakerRequested` returns true on `ttsDialogueFormat` alone**, with zero speaker mappings.

**Architecture**

- **The `'x-space'` `ExtractRoute` value means "URL article".** ADR-002 records the overload as its finding 2. It is genuinely misleading, but it is a *persisted* value — it appears as `extractRoute` in run manifests and as a `childBatches['x-space']` key — so renaming needs a `schemaVersion` bump *and* an upgrader in the same change (§1's second lesson: the bump alone is the dangerous half).
- **URL article provider capability negotiation is unreachable from every production caller** — `assertUrlArticleCapability` and the per-provider `capabilities` arrays were never wired to a CLI or config surface. Wire it or shrink it to what ships.
- **`isLocalUrlBackend` hardcodes `'defuddle'`** where a registry-derived group exists. Behavior is identical today; the point is that a second local backend cannot silently diverge.
- **The typed `baseUrl` seam** is on some write providers and not others — ADR-005's open question of whether it stays on all four or none.

**Benchmarks and fixtures**

- **The `whisper-cpp` PATH probe** at `benchmark-services.ts:29` is a real bug, but fixing it schedules five whisper models and gigabytes of downloads. Decide the `models` array in the same change.
- **`.gitignore`'s `input/` allow-list is inert.** The bare `input` pattern on line 7 means the negations below it re-include nothing, so which fixtures ship is decided entirely by what was force-added to the index. `input/examples/comic/` is silently untracked as a result, and `docs/tests` calls `anthony-voice.mp3` a "committed" fixture when it is not tracked either. Decide the intended fixture set first, then express it — either working negation chains (`input/*` + `!input/examples/` + per-subdir `!…/**`) or drop the negations and rely on explicit force-adds.
- **Two regression-guard policy calls** in `cli-usage-errors.test.ts:312` and `combined-report-weighted-ranking-contracts.test.ts:224-236`.
- **`resolvePresetNames` (`src/prompts/prompt-loader.ts:315`) is production-dead but guards live coverage.** The export has zero production callers — the live preset-resolution path is the private `resolveLeafPresetName` in `schema-resolver.ts`. But its song-lyric test (`prompt-loader-contracts.test.ts:99-110`) is the *only* validation-suite guard on the `structuredPreset` values of countrySong, folkSong, jazzSong and popSong; if one of those lost its mapping, production would silently degrade the prompt to the freeform `{content}` schema and no remaining test would notice. Deleting the export as-is loses that coverage. Either port the four mappings to production-path assertions (`resolveStructuredSchema(['countrySong']).presetNames`) in the same change, or accept the loss. The sibling creative-writing test at lines 112-117 is genuinely redundant and can go with the export either way.

## 4. Cleared — do not re-litigate

- **`schemaVersion` optional on `run.json` shapes** — refuted. The finder wanted it required; the skeptic showed the type is correct as-is.
- Everything in the first audit's kept list stays kept: `llama` vs `llama.cpp` naming, the `*-targets.ts` barrels, `fromLegacyCheck`, bare model names in `setup --models`, `--concurrency` runner rejection, `ttsSpeaker` for `--kitten-voice`, `structured-output/compat-fallback.ts`.
- Owner-declined and not re-proposed: the singular `<provider>ImageModel`/`VideoModel`/`MusicModel` fields, and the two-image character identity cards.
- `rolling-shingle-approximation` is live source, not residue.
- The `CLIUsageError` name-string arm: `isCLIUsageError` is `instanceof`-only and returns a type predicate. The class's own `name = 'CLIUsageError'` stays — it is a diagnostics label, not a control-flow key, and renaming it would change every serialized diagnostic payload.
- The five per-provider `-tts` arms in `resolveCheapestModelForFlag`, the local `selectorArgToInternalArgs`, and `decodeLegacyPuaText` and friends: all checked, all live.
- **`downloadFile` still returns a `DownloadResult` no caller reads** — deliberate. The return-type change was scoped out as a signature change, and that call stands.
- ADR-002's module inventory still names the deleted `writeUrlBatchManifest` — kept per the annotate-as-history convention.
- **`.gitignore`'s `runtime/auth/` line** — refuted in the third audit. It looks shadowed by the bare `runtime/` rule, but `docs/cookies.md` documents `runtime/auth/` as the home for browser session credentials (nine references, including `mkdir -p runtime/auth`), and the file already contains negations that pierce `runtime/` for test fixtures. The explicit child rule is defense-in-depth for a documented secrets path, not seed residue.
