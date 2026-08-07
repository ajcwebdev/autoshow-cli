# ADR-002: URL Article Extraction as a First-Class Step 2 Subsystem and Step 0 Target Discovery

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-12
- **Date Updated:** 2026-08-07
- **Verification Status:** Passed

<!-- This record synthesizes three prior ADRs into one decision. All three parts are
     Accepted and implemented (Part 3, the Step 0 discovery move, landed 2026-06-13
     with the legacy step-1 re-export shims removed). Each Decision sub-part carries
     its own state tag. -->

## Context

URL article extraction sits inside the Step 2 extraction stack alongside OCR and STT, but historically it did not share their architecture. Three related problems were addressed as a series and are recorded together here because they tell one ingest/extraction-ownership story:

1. **Provider identity duplication.** OCR and STT use the shared Step 2 provider registry for provider identity, provider-spec collection, shortcut expansion, config-path metadata, and resume-selectable targets. URL article extraction needs the same identity surface — URL backends are selected through CLI flags, config defaults, route-aware generic provider selectors, price/preflight logic, manifests, and resume — yet it kept its own parallel backend lists and special-case resolution rules, making it the only Step 2 provider path that could drift from OCR/STT behavior.
2. **An overloaded URL runtime module.** `step-2-url/process-url.ts` concentrated target planning, provider-state parsing, manifest metadata, artifact writing, and multi-provider execution control in one file, even though URL article extraction has real domain-specific runtime behavior (local HTML handling, hosted HTTP adapters, retry enrichment, provider artifacts, Defuddle→Firecrawl fallback, article-specific manifest compatibility).
3. **Discovery owned by the wrong step.** The `metadata` command delegates to `step-1-download/targets/handle-process-target`, so command-neutral input discovery lives under the download step. `step-0-metadata` is only 2 files / 132 LOC, while `step-1-download` is 66 files / 9,669 LOC (the `targets`/`sources` area alone is 50 files / 7,285 LOC). `metadata`, `download`, `extract`, and `write` all depend on the same step-agnostic questions — what is the input (URL, file, directory, input list, YouTube collection, podcast RSS feed, unsupported), what source it represents, single-target vs batch, which input family/route applies, and which batch items are selected — yet that logic looks owned by download.

Why now: parts 1 and 2 are already implemented in the current tree (`step-2-shared/provider-registry/url-providers.ts` defines the canonical URL backend set; `process-url.ts` is now a coordinator over URL-local subsystem modules). Part 3 is the natural next ownership correction once URL provider identity is shared and the URL subsystem boundaries are clear — it removes the metadata command's dependency on download internals and gives all process commands one discovery boundary.

## Options Considered

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **Extend the shared Step 2 registry for URL identity only; keep URL runtime local** | One source of truth for Step 2 provider identity; aligns URL selectors with OCR/STT; supports resume + config metadata consistently; keeps URL runtime domain-local | Broadens shared registry types to include fixed article backends; compatibility fields remain | Accepted/implemented; 6 URL backends (5 hosted, 1 local); 0 new deps |
| Leave URL identity local to `step-2-url` | Smallest change | Keeps duplicated backend lists and special-case selector/config/resume logic; allows drift | Rejected |
| Move URL adapter execution into the shared registry | Centralizes identity + execution | Over-scopes identity; mixes retries, artifacts, adapter behavior, manifest compatibility into a selection registry | Rejected |
| **Make URL article extraction a first-class Step 2 subsystem** | Aligns URL local boundaries with OCR/STT; gives provider specs, targets, manifests, run state dedicated homes; keeps shared identity intact; keeps execution adapter-driven | More URL-local files; execution still differs from OCR/STT internally | Accepted/implemented; `process-url.ts` reduced to route coordination |
| Fully unify Step 2 runners (OCR/STT/URL) | Strongest structural symmetry | Forces article adapters into media/document abstractions; risks OCR/STT regressions | Rejected — larger blast radius, no runtime benefit |
| **Move command-neutral discovery/source planning to `step-0-metadata`** | Matches step semantics; removes metadata→download coupling; one discovery boundary for all process commands | Import churn + temporary compatibility re-exports | Proposed; ~16 files / ~1.5k LOC plus a split re-export |
| Move all of `targets/` and `sources/` to `step-0-metadata` | Simple mechanical rule; maximally shrinks download | Moves batch execution, manifests, summaries, single-target runners that are not metadata concerns | Rejected — too broad (50 files / 7,285 LOC) |
| Create a new neutral `ingest`/`process-target` step | Clean naming independent of "metadata" | Adds a new top-level process concept; does not match the requested step-0 boundary | Rejected — more churn than needed |
| Redesign article-vs-`x-space` routing first | Could settle route naming before migration | Blocks identity cleanup behind manifest-compatibility work; risks persisted-manifest churn | Deferred — separate audit |

## Decision

### 1. URL article backend identity lives in the shared Step 2 provider registry *(Accepted — implemented 2026-06-12)*

The shared registry is the canonical identity source for URL article backends while URL execution stays in URL-local modules. The registry now includes:

- `Step2Command` value `url` and `Step2Modality` value `article`.
- Fixed URL targets as `{ service: HtmlArticleBackend, model: HtmlArticleBackend }` (URL backends are fixed targets, so `service === model`).
- Backend entries `defuddle`, `firecrawl`, `glm-reader`, `spider`, `supadata`, `zyte`; hosted group `firecrawl`/`glm-reader`/`spider`/`supadata`/`zyte`; local group `defuddle`.
- Config path `defaults.extract.url.provider`; shortcuts `--all-url` (hosted) and `--all-local-url` (Defuddle).

The registry owns identity, config-path metadata, shortcut expansion, provider-spec collection, and resume-selectable targets. URL adapters, retry behavior, artifact writing, provider result parsing, fallback behavior, and manifest compatibility stay under `step-2-url`. Existing public behavior is unchanged: `--url-provider <backend>`, route-aware `--provider <url-backend>` for article inputs, model syntax rejected for fixed URL targets, and generic all-provider handling combining hosted and local URL groups on the article route.

### 2. URL article extraction is a first-class Step 2 subsystem *(Accepted — implemented 2026-06-12)*

URL-local module boundaries mirror OCR/STT while preserving the shared identity model:

- `step-2-url/cli.ts` — `collectUrlProviderSpecs`, backed by the shared registry.
- `step-2-url/manifest.ts` — `writeUrlRunManifest`, `readUrlRunManifestEntry`, `writeUrlBatchManifest`.
- `step-2-url/url-targets.ts` — URL target identity, backend validation, provider directory names, target collection, article backend planning.
- `step-2-url/url-run-state.ts` — fallback Step 1 metadata, output-dir reservation, extraction + provider artifacts, provider states, completion status, manifest metadata, stored-metadata parsing, multi-provider execution coordination.
- `step-2-url/process-url.ts` — the public route coordinator delegating to the URL-local modules. The compatibility re-exports this line originally described were removed on 2026-08-07; `processUrlArticle` is the module's only export, and every other consumer imports from `url-run-state.ts` / `url-targets.ts` directly.
- `resume/extract/url-resume.ts` — reads/writes via `manifest.ts`, derives targets via `url-targets.ts`, reuses the run-state helpers.

Execution stays adapter-driven: provider adapters in `url-services/*/run-*-url.ts`, local Defuddle in `url-local/defuddle`, dispatch + retry in `url-provider-registry.ts`.

### 3. Move command-neutral target discovery and source planning to `step-0-metadata` *(Accepted — implemented 2026-06-13)*

Move the discovery/planning slice into `step-0-metadata`; keep download-specific acquisition, normalization, raw `yt-dlp`, media/document processing, and output writing in `step-1-download`. First migration slice:

| Current Area | New Home | Scope |
|---|---|---|
| `targets/input-classifier.ts`, `input-collection.ts`, `input-routing.ts`, `process-target-plan.ts` | `step-0-metadata/targets/` | Input kind/family, top-level classification, routing, single/batch plan resolution |
| `sources/*` | `step-0-metadata/sources/` | URL lists, podcast RSS, YouTube channel/playlist/collection expansion; the six `targets/*` re-export shims are repointed to step-0 and serve as the legacy compatibility surface |
| `targets/batch/batch-planner.ts`, `batch-router.ts`, `batch-select.ts` | `step-0-metadata/batch/` | Batch source expansion, selection, planned batch inputs |
| `media-extensions.ts`, `document/detect-format.ts`, `document/convertible-ebooks.ts` | `step-0-metadata/formats/` | Format/extension hints for classification + routing |
| `targets/target-utils.ts` | Split export surface | Discovery exports → step-0; execution exports stay in step-1 |

Staying in `step-1-download`: `audio/*` (incl. `yt-dlp` options, media download, metadata extraction, normalization); document download/prep/conversion except format detection + convertible-ebook constants; `targets/single/*`; `batch-executor.ts`/`batch-manifest.ts`/`batch-summary.ts`/`process-batch.ts`; `expected-output.ts`, preflight, validation, option resolution, raw `yt-dlp` passthrough.

### Shared compatibility and deferrals (all parts)

- Persisted metadata stays compatible: keep `resolvedStep2.route: "article"`, legacy `resolvedStep2.backend`/`backends`; add standardized `providers`, `requestedProviders`, `providerStates`, `missingProviders`; keep fixed `{ service, model, artifactDir, status, attempts }` run records and the existing artifact layout. The legacy `resolvedStep2.backend`/`backends` compatibility clause was retired on 2026-08-07: the two keys were write-only — no reader ever consumed them (see finding 4 below) — so they were dropped from `ResolvedStep2Execution` and from all four writers (`resolved-step2.ts`, `url-run-state.ts`, `url-resume.ts`, and the batch/document paths that persist the same object). `providers` is now the sole persisted backend record. No `schemaVersion` bump shipped with this and none was warranted: removing a write-only key is compatible in both directions under parsers that pass `metadata` through opaquely, whereas a bump to `3` would have made every manifest already on disk fail the `schemaVersion !== 2` gates and silently become non-resumable.
- X Spaces remain a separate input family and extraction route; do **not** add an `article` value to `ExtractRoute` yet — the article-vs-`x-space` route/manifest compatibility audit is complete (see the audit section below); the route rename itself remains deferred.
- CLI commands/flags, manifests, and output layouts do not change. `InputKind`, `ResolvedInputRouting`, and `ResolvedProcessTargetPlan` move from `src/types/.../step-1-download/download-types.ts` to a step-0 types path (old path re-exports during the migration window); `BatchSource`, `ResolvedBatch`, and `InputFamily` stay in the neutral `src/types/cli-dir-types.ts`. The migration window closed on 2026-08-07: the old-path re-export block in `types/download-workflow/step-1-download-download-types.ts` was deleted, and these types now reach consumers only through `types/index.ts`'s star export of `pipeline-core/metadata-types`.
- Open dependency-direction questions to settle in the first step-0 slice: the YouTube `yt-dlp` list helpers (`getYtDlpBinary`/`buildYtDlpListArgs`/ `buildYtDlpFailureMessage`) imported from `step-1-download/audio`; `batch-planner`'s use of `buildBatchManifestEntryForItem`; and `input-routing.ts`/`process-target-plan.ts` importing step-2/step-3 helpers (accepted short-term; candidates for a shared surface).

### Article-vs-`x-space` compatibility audit (2026-07-16)

The deferred audit of persisted URL/article manifest compatibility is complete. Findings (paths relative to `src/cli/commands/`):

1. **Route literals are persisted, not just in-memory.** `extract-batch.json` stores `childBatches['x-space']` and per-item `extractRoute`/`childBatchEntry.route` values, and X-Space runs store `extractRoute: 'x-space'` in `run.json` (`process-steps/step-1-download/download-targets/single/x-space-runner.ts`, `processXSpace`). Parsing gates on the literal route set in `process-steps/manifest-utils.ts` (`isExtractRoute`, `parseExtractBatchManifest`), so renaming a route value breaks manifests already on disk unless a migration ships with it.
2. **Two identity keys are stitched together at resume time.** URL-article runs identify themselves via `resolvedStep2.route === 'article'` (`process-steps/step-2-extract/step-2-url/url-manifest.ts`, `isUrlArticleManifestEntry`), but resume maps that to the `ExtractRoute` value `'x-space'` (`setup-and-utilities/resume/resume-dispatch.ts`, `inferExtractRouteFromRunManifest`) and keys the URL-article handler off `'x-space'` (`setup-and-utilities/resume/resume-registry.ts`, `getExtractRouteResumeHandler`). The `'x-space'` route value is therefore overloaded to mean "URL article" throughout resume.
3. **Producer and resume group articles differently.** Target routing maps `step2Route === 'article'` to `extractRoute: 'document'` and reserves `'x-space'` for the `x_space` input family (`process-steps/step-0-metadata/metadata-targets/metadata-input-routing.ts`), and the batch executor partitions children by that planned route (`process-steps/step-1-download/download-targets/download-batch/batch-executor.ts`, `partitionExtractBatchPlan`), so article batch children land in the `document` child batch. Resume re-classifies by input family instead: a child batch whose items are all `html_article` infers `'x-space'` and the URL-article handler (`resume-dispatch.ts`, `inferExtractRouteFromBatchManifest`). Any route rename must reconcile these two views.
4. **Legacy-fields gap.** `parseStoredUrlBackends` (`process-steps/step-2-extract/step-2-url/url-run-state.ts`) reconstructs backends from `requestedProviders`, `providerStates`, and `step2[].extractionMethod` — not from the legacy `resolvedStep2.backend`/`backends` fields this ADR's compatibility contract preserves. A manifest carrying only the legacy fields would resume with an empty backend set. Resolved 2026-08-07 by deleting the legacy fields rather than teaching the parser to read them: reconstruction from `requestedProviders` is now the only mechanism, so the two views can no longer disagree.
5. **Actual X-Space runs are not resumable as articles.** `processXSpace` writes no `resolvedStep2`/`providerStates`, so `readUrlRunManifestEntry` rejects those manifests and resume treats them as "not a URL article extract run". A rename must not silently start treating X-Space runs as article runs.
6. **There is no route-level version field.** The only discriminant is `schemaVersion: 2`; the existing gates for retired shapes (`assertSupportedRunOrBatchSchema`, `assertSupportedExtractBatchSchema` in `manifest-utils.ts`) are the pattern a route rename would need to extend, together with a `schemaVersion` bump. Correction (2026-08-07): those two named helpers no longer exist; the gates are now four inline `value['schemaVersion'] !== 2` checks in `manifest-utils.ts`. There is still no migration or upgrade code anywhere in the repo, which is precisely why a bump must ship with an upgrader — a bare bump rejects every manifest already on disk.
7. **Test coverage gaps.** Nothing pins X-Space `run.json` being skipped by URL-article resume, purely-legacy article manifests (finding 4), or the producer-vs-resume grouping split (finding 3).

Conclusion: the persisted shapes are self-consistent as read today, so no new compatibility ADR is needed now. Any future route rename or manifest reshape must ship a `schemaVersion` migration and reconcile findings 2–4; findings 4 and 7 are the residual risks worth closing first if this area is touched again.

This applies to:

- Shared Step 2 identity and URL-local extraction subsystem boundaries.
- Command-neutral discovery and source planning moved to `step-0-metadata`; runtime unification and route renaming remain out of scope.

## Rationale

Provider identity has to be consistent across selection, config, resume, preflight, and manifests; keeping URL identity out of the shared registry made it the only duplicated Step 2 path. Sharing identity without centralizing execution respects the domain-specific runtime URL article extraction genuinely has. Splitting `process-url.ts` into subsystem modules gives URL the same clarity as OCR/STT while preserving the adapter-driven model that fits article extraction. Finally, Step 0 should answer metadata questions about the input before any step decides how to process content; the chosen discovery slice is deliberately narrower than moving every `targets` module, because batch execution, manifests, summaries, single-target runners, and raw `yt-dlp` passthrough are operational concerns that merely consume a resolved plan. Compatibility re-exports follow the established `targets/` → `sources/` consolidation pattern (commit `0bb13b98`), lowering migration risk by letting internal code move first.

## Consequences

Positive outcomes:

- STT, OCR, and URL article extraction share one canonical provider identity model; ordering, hosted/local grouping, shortcut expansion, and config paths are registry-backed and reusable by route-aware generic selectors and resume.
- URL article extraction has dedicated modules for CLI specs, manifests, targets, and run state; `process-url.ts` coordinates rather than owning the full stack; resume reuses the same helpers; future backend additions have clear touch points.
- `metadata` stops depending on download-owned target planning; input classification, source expansion, and batch planning get a single owner; `step-1-download` becomes easier to reason about as content acquisition; extract/write can depend on a discovery surface instead of download internals; ingest tests target step-0 paths.

Negative outcomes:

- Shared registry types now include fixed `service === model` targets consumers must understand; legacy `resolvedStep2.backend`/`backends` and compatibility re-exports persist; URL execution stays structurally different from OCR/STT internals. Both of those compatibility surfaces have since been retired — the re-exports on 2026-08-07 (see the migration-window note in the Decision) and the legacy backend fields the same day.
- The step-0 move changes imports across download, extract, write, tts/image/video/music command definitions, pricing, resume, config merge, flag normalization, and tests; needs temporary re-exports; broadens `step-0-metadata` beyond frontmatter; URL header probing / source enumeration still do network reads (metadata discovery, not paid execution); format-detection import direction needs care to avoid cycles.
- Article-vs-`x-space` route cleanup remains deferred across all parts (the compatibility audit itself completed 2026-07-16 — see the audit section in the Decision).

## Trade-offs

| Gains | Sacrifices |
|---|---|
| One source of truth for URL backend identity; consistent config/selection/preflight/resume | Broader shared registry type surface; `service === model` handling |
| Clear URL-local ownership for targets/manifests/run state/artifacts; better resume reuse | More URL-local modules; temporary compatibility re-exports |
| Clearer process-step ownership; smaller, more focused download boundary | Short-term migration churn; more files under step-0 |
| Lower drift risk between metadata/download and across URL/OCR/STT selectors | Runner unification and persisted-manifest cleanup intentionally deferred |

## Follow-up Actions

| Action | Owner | Current State |
|---|---|---|
| Extend Step 2 registry types + entries for all URL article backends | Extraction maintainer | Implemented in `step-2-shared/provider-registry/url-providers.ts` |
| Move URL backend lists / hosted-local groups to the shared registry | Extraction maintainer | Implemented; option resolution + tests consume shared exports |
| Record standardized provider identities in URL manifests (keep legacy `backend`/`backends`) | Extraction maintainer | Implemented |
| Add URL provider-spec, manifest, target, and run-state helpers; reduce `process-url.ts` to route coordination | Extraction maintainer | Implemented in `cli.ts`/`manifest.ts`/`url-targets.ts`/`url-run-state.ts` |
| Update URL resume to use URL-local helpers; keep adapters + Defuddle runtime adapter-driven | Extraction maintainer | Implemented |
| Consider renaming/reducing `url-provider-registry.ts` after adapter-only usage settles | Extraction maintainer | Deferred |
| Create `step-0-metadata/metadata-targets`,`metadata-sources`,`metadata-batch`,`formats` surfaces; move the discovery slice + repoint internal imports | CLI maintainer | Done |
| Split `target-utils.ts` (discovery → step-0, execution stays step-1) | CLI maintainer | Done |
| Settle the `yt-dlp` list-helper and batch-manifest-entry dependency direction | CLI maintainer | Done |
| Move `InputKind`/`ResolvedInputRouting`/`ResolvedProcessTargetPlan` to a step-0 types path | CLI maintainer | Done |
| Update/extend ingest tests to step-0 paths; verify with `bun run check` + no-cost tests | CLI maintainer | Done |
| Remove legacy step-1 discovery re-exports after callers settle on step-0 imports | CLI maintainer | Done (2026-06-13; 19 dead shims deleted, 3 importers repointed to step-0) |
| Close the compatibility-re-export migration window for the remaining ADR-002 shims | CLI maintainer | Done (2026-08-07; deleted the 14-name block in `step-2-url/process-url.ts`, the 8-name block in `types/download-workflow/step-1-download-download-types.ts`, and the `metadata-targets/metadata-target-utils.ts` barrel — its four importers now import from `metadata-input-classifier.ts` / `metadata-input-routing.ts`) |
| Audit article-vs-`x-space` route compatibility before changing persisted manifest shapes | Extraction maintainer | Done (2026-07-16 — see "Article-vs-`x-space` compatibility audit"; the route rename itself remains deferred) |

## References

- Related ADR: [ADR-001](ADR-001-book-like-document-ingestion.md)
- Shared Step 2 provider registry: `src/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry/`
- URL registry entries: `.../step-2-shared/provider-registry/url-providers.ts`; selection helpers: `.../provider-registry/selection.ts`
- Registry types: `src/types/cli/commands/process-steps/step-2-extract/step-2-shared/step-2-shared-types.ts`
- URL subsystem: `step-2-url/process-url.ts`, `cli.ts`, `manifest.ts`, `url-targets.ts`, `url-run-state.ts`, `url-provider-registry.ts`, `url-services/`, `url-local/defuddle/`
- URL option resolution: `.../step-1-download/targets/build-opts-from-flags/url-options.ts`; generic normalization: `.../service-selector-normalization/extract-selectors.ts`
- URL resume: `src/cli/commands/setup-and-utilities/resume/extract/url-resume.ts`
- Current metadata command: `.../step-0-metadata/define-metadata-command.ts`; current target planning/source expansion: `.../step-1-download/targets/`, `.../step-1-download/sources/`
- OCR/STT manifest patterns: `.../step-2-ocr/manifest.ts`, `.../step-2-stt/manifest.ts`
- Tests: `test/test-cases/validation/ingest/html-url-backends-contracts/`, `.../resume-manifests/resume-provider-surface-contracts.test.ts`, `.../cli/option-resolution-contracts/download-extract-url-options.test.ts`, `.../validation/ingest/`
