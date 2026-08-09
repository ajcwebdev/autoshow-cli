# ADR-002: URL Article Extraction as a First-Class Step 2 Subsystem and Step 0 Target Discovery

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-12
- **Date Updated:** 2026-08-09
- **Verification Status:** Passed

<!-- This record synthesizes four implemented decisions into one URL ingest and persisted-route record. Each Decision sub-part carries its own state tag. -->

## Context

URL article extraction sits inside the Step 2 extraction stack alongside OCR and STT, but historically it did not share their architecture. Four related problems were addressed as a series and are recorded together here because they tell one ingest/extraction-ownership story:

1. **Provider identity duplication.** OCR and STT use the shared Step 2 provider registry for provider identity, provider-spec collection, shortcut expansion, config-path metadata, and resume-selectable targets. URL article extraction needs the same identity surface — URL backends are selected through CLI flags, config defaults, route-aware generic provider selectors, price/preflight logic, manifests, and resume — yet it kept its own parallel backend lists and special-case resolution rules, making it the only Step 2 provider path that could drift from OCR/STT behavior.
2. **An overloaded URL runtime module.** `step-2-url/process-url.ts` concentrated target planning, provider-state parsing, manifest metadata, artifact writing, and multi-provider execution control in one file, even though URL article extraction has real domain-specific runtime behavior (local HTML handling, hosted HTTP adapters, retry enrichment, provider artifacts, Defuddle→Firecrawl fallback, article-specific manifest compatibility).
3. **Discovery owned by the wrong step.** The `metadata` command delegates to `step-1-download/targets/handle-process-target`, so command-neutral input discovery lives under the download step. `step-0-metadata` is only 2 files / 132 LOC, while `step-1-download` is 66 files / 9,669 LOC (the `targets`/`sources` area alone is 50 files / 7,285 LOC). `metadata`, `download`, `extract`, and `write` all depend on the same step-agnostic questions — what is the input (URL, file, directory, input list, YouTube collection, podcast RSS feed, unsupported), what source it represents, single-target vs batch, which input family/route applies, and which batch items are selected — yet that logic looks owned by download.
4. **Persisted-format fear left the article route overloaded and resume misleading.** Article runs identify themselves as `resolvedStep2.route: 'article'`, but `ExtractRoute` and extract-batch child keys have no `article` value, so resume overloads `'x-space'` for both articles and actual X Spaces. Producers place article children under `'document'`, parent resume looks for them under `'x-space'`, and actual X-Space runs are offered to an article handler that rejects them. Six version gates across run, batch, extract-batch, provider-result, provider-checkpoint, and transcript-video readers returned `undefined` for every unsupported version, so an existing old artifact was reported as missing or as the wrong kind of directory. The standing rule that every version bump required an upgrader froze the broken route rather than protecting a working compatibility contract.

Why now: parts 1 through 3 are implemented in the current tree. The structural legacy program made the remaining trade-off explicit: persisted artifacts are disposable execution state, not a compatibility API. Loud rejection with an actionable rerun remedy is more honest and substantially smaller than building upgrader machinery for runs the project has already accepted can become non-resumable.

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
| **Adopt clean breaks for persisted formats and split article from `x-space` with a version bump** | Lets persisted shapes evolve; fixes parent article resume; gives actual X Spaces an honest route and error; requires only one loud version boundary | Existing artifacts from before a bump cannot resume and must be regenerated | Accepted/implemented 2026-08-09 with schemaVersion 3 |
| Require an upgrader for every persisted-format bump | Preserves resumability of old artifacts | Freezes shapes when no upgrader exists; adds permanent migration machinery for disposable execution state | Rejected; superseded by the clean-break policy |
| Keep the route overload and inference shims indefinitely | Avoids a format bump | Preserves three known resume failures and two vocabularies | Rejected |

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

### 4. Persisted formats use clean breaks; URL articles get their own route *(Accepted — implemented 2026-08-09)*

Persisted run artifacts are execution state, not a durable interchange format. When their shape must change, writers and readers bump the relevant version together and readers reject older artifacts with a `CLIUsageError` that names the file, found version, supported version, and remedy: old runs are not resumable with this build, so re-run the pipeline. The project will not build upgrader chains for these formats. Silent fallback, silent pruning, and errors that misclassify an existing artifact as missing are prohibited.

`manifest-utils.ts` owns the current-version table and the single `readVersionedManifest` gate for the run, batch, extract-batch, provider-result, and provider-checkpoint envelope kinds. It returns `missing`, `unsupported-version`, `invalid`, or `ok`. Malformed JSON deliberately keeps the pre-existing thrown parse error. A current-version envelope whose embedded `kind` does not match the caller's expected kind is `invalid`, not `unsupported-version`. Resume dispatch, generation resume, and transcript-video map unsupported versions to the actionable usage error. The canonical provider-result parser supports explicit metadata leniency for transcript-video, replacing its drifted parser copy without weakening normal provider-artifact reads.

`'article'` is now a first-class `ExtractRoute` and extract-batch `childBatches` key; article producers persist `'article'`, and `'x-space'` is exclusive to the `x_space` input family. Run, batch, and extract-batch envelopes moved from schemaVersion 2 to 3 atomically. Version 2 artifacts are rejected by the shared reader and are not upgraded. Parent resume dispatches article children through the `'article'` key, real X-Space targets receive an honest not-resumable error, and the overload constant plus the input-family and `resolvedStep2` inference heuristics are gone. Before any in-place resume rewrite, parsed item counts are compared with raw on-disk counts so a build that cannot parse an entry refuses rather than pruning it.

### Shared compatibility and deferrals (all parts)

- `providers`, `requestedProviders`, `providerStates`, and `missingProviders` remain the standardized provider identity/state fields. The legacy `resolvedStep2.backend`/`backends` compatibility clause was retired on 2026-08-07 because the two keys were write-only; `providers` is the sole persisted backend record.
- X Spaces remain a separate input family and extraction route. `'x-space'` no longer carries the article meaning, and X-Space resume fails with an explicit not-resumable usage error.
- CLI commands, flags, and output layouts did not change under the clean-break decision; only persisted route vocabulary and resume behavior changed.
- The step-0 type migration window closed on 2026-08-07: the old-path re-export block in `types/download-workflow/step-1-download-download-types.ts` was deleted, and the types now reach consumers through `types/index.ts`'s star export of `pipeline-core/metadata-types`.

### Article-vs-`x-space` compatibility audit (2026-07-16)

The deferred audit of persisted URL/article manifest compatibility is complete. Findings (paths relative to `src/cli/commands/`):

1. **Route literals are persisted, not just in-memory.** `extract-batch.json` stores `childBatches['x-space']` and per-item `extractRoute`/`childBatchEntry.route` values, and X-Space runs store `extractRoute: 'x-space'` in `run.json` (`process-steps/step-1-download/download-targets/single/x-space-runner.ts`, `processXSpace`). Parsing gates on the literal route set in `process-steps/manifest-utils.ts` (`isExtractRoute`, `parseExtractBatchManifest`), so the accepted rename ships with schemaVersion 3 and rejects version 2 rather than migrating it.
2. **Two identity keys were stitched together at resume time.** URL-article runs identified themselves via `resolvedStep2.route === 'article'`, while resume mapped that to the `ExtractRoute` value `'x-space'` and keyed the URL handler off it. Resolved 2026-08-09: URL manifests now stamp and gate on `extractRoute: 'article'`; `URL_ARTICLE_ROUTE`, the `resolvedStep2` inference arm, and the URL reader's `resolvedStep2` identity check were deleted.
3. **Producer and resume grouped articles differently.** Target routing mapped article inputs to `extractRoute: 'document'`, while resume reclassified all-`html_article` child batches as `'x-space'`. Resolved 2026-08-09: routing and batch planning produce `article/` children, parent resume reads `childBatches.article`, and the input-family inference arm was deleted.
4. **Legacy-fields gap.** `parseStoredUrlBackends` (`process-steps/step-2-extract/step-2-url/url-run-state.ts`) reconstructs backends from `requestedProviders`, `providerStates`, and `step2[].extractionMethod` — not from the legacy `resolvedStep2.backend`/`backends` fields this ADR's compatibility contract preserves. A manifest carrying only the legacy fields would resume with an empty backend set. Resolved 2026-08-07 by deleting the legacy fields rather than teaching the parser to read them: reconstruction from `requestedProviders` is now the only mechanism, so the two views can no longer disagree.
5. **Actual X-Space runs are not resumable as articles.** Resolved 2026-08-09: the dedicated `'x-space'` route reaches a `CLIUsageError` stating that X-Space runs are not resumable instead of entering the article handler.
6. **There is no route-level version field.** The envelope `schemaVersion` is the version boundary. Historical correction (2026-08-07): the older named assertion helpers had become four inline `value['schemaVersion'] !== 2` checks. Resolution (2026-08-09): `readVersionedManifest` owns the version table, run/batch/extract-batch moved to schemaVersion 3, and version 2 is rejected with the actionable error and no upgrader.
7. **Test coverage gaps.** Resolved 2026-08-09: contracts pin version 2 rejection, direct and parent-batch X-Space usage errors, producer-shaped version 3 article parent/child synchronization, URL run route stamping, and refusal to prune unknown-family or unknown-route entries.

Conclusion (superseded 2026-08-09): the earlier recommendation to wait for an upgrader preserved a route model that was not self-consistent across production and resume. This ADR now records the implemented clean-break policy, shared version reader, refusal-before-rewrite guard, and schemaVersion 3 article route split. Findings 2 through 7 are closed.

This applies to:

- Shared Step 2 identity and URL-local extraction subsystem boundaries.
- Command-neutral discovery and source planning moved to `step-0-metadata`.
- The persisted-format clean-break policy, shared versioned-envelope reading, and the schemaVersion 3 article-vs-`x-space` route split.

## Rationale

Provider identity has to be consistent across selection, config, resume, preflight, and manifests; keeping URL identity out of the shared registry made it the only duplicated Step 2 path. Sharing identity without centralizing execution respects the domain-specific runtime URL article extraction genuinely has. Splitting `process-url.ts` into subsystem modules gives URL the same clarity as OCR/STT while preserving the adapter-driven model that fits article extraction. Step 0 should answer metadata questions about the input before any step decides how to process content; the chosen discovery slice is deliberately narrower than moving every `targets` module because batch execution, manifests, summaries, single-target runners, and raw `yt-dlp` passthrough are operational concerns that merely consume a resolved plan. Persisted run artifacts need a different compatibility posture from user-authored inputs: because no upgrader has ever existed and rerunning is the supported recovery path, a loud clean break is safer than either silent fallback or permanent inference shims. The article route split applies that rule to fix a demonstrably broken resume path instead of preserving its bytes at the expense of its behavior.

## Consequences

Positive outcomes:

- STT, OCR, and URL article extraction share one canonical provider identity model; ordering, hosted/local grouping, shortcut expansion, and config paths are registry-backed and reusable by route-aware generic selectors and resume.
- URL article extraction has dedicated modules for CLI specs, manifests, targets, and run state; `process-url.ts` coordinates rather than owning the full stack; resume reuses the same helpers; future backend additions have clear touch points.
- `metadata` stops depending on download-owned target planning; input classification, source expansion, and batch planning get a single owner; `step-1-download` becomes easier to reason about as content acquisition; extract/write can depend on a discovery surface instead of download internals; ingest tests target step-0 paths.
- Unsupported persisted envelopes are distinguishable from missing and invalid files at one version table; user-facing resume and transcript-video errors name the exact incompatibility and remedy.
- The implemented article route split makes parent article batches resumable and reserves `'x-space'` for actual X Spaces.

Negative outcomes:

- Shared registry types now include fixed `service === model` targets consumers must understand, and URL execution stays structurally different from OCR/STT internals. The legacy compatibility fields and re-exports originally accepted here were retired on 2026-08-07.
- The step-0 move changes imports across download, extract, write, tts/image/video/music command definitions, pricing, resume, config merge, flag normalization, and tests; needs temporary re-exports; broadens `step-0-metadata` beyond frontmatter; URL header probing / source enumeration still do network reads (metadata discovery, not paid execution); format-detection import direction needs care to avoid cycles.
- A persisted-format bump intentionally makes older runs non-resumable. Users must rerun the pipeline; there is no upgrader escape hatch.
- SchemaVersion 2 run, batch, and extract-batch artifacts are intentionally non-resumable and must be regenerated.

## Trade-offs

| Gains | Sacrifices |
|---|---|
| One source of truth for URL backend identity; consistent config/selection/preflight/resume | Broader shared registry type surface; `service === model` handling |
| Clear URL-local ownership for targets/manifests/run state/artifacts; better resume reuse | More URL-local modules; temporary compatibility re-exports |
| Clearer process-step ownership; smaller, more focused download boundary | Short-term migration churn; more files under step-0 |
| Lower drift risk between metadata/download and across URL/OCR/STT selectors | Full runner unification remains out of scope |
| One loud version boundary and an honest article route | Old persisted runs are intentionally discarded at version bumps; no upgrader is provided |

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
| Audit article-vs-`x-space` route compatibility before changing persisted manifest shapes | Extraction maintainer | Done (2026-07-16 — see "Article-vs-`x-space` compatibility audit") |
| Replace the six inline version gates with one discriminated versioned-envelope reader and actionable unsupported-version errors | CLI maintainer | Done (2026-08-09; malformed JSON still throws and kind mismatch remains invalid rather than unsupported) |
| Split article from `'x-space'` and bump run/batch/extract-batch envelopes from schemaVersion 2 to 3 without an upgrader | Extraction maintainer | Done (2026-08-09; article routes are first-class, version 2 rejects loudly, and X-Space resume is explicit) |

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

> Correction (2026-08-07): the module boundaries this ADR established are all intact, but several were renamed or relocated afterwards, so the paths cited above and in §"URL-local module boundaries" no longer resolve. The mapping, none of which changed any behavior:
>
> | Cited here | Actual |
> |---|---|
> | `step-2-url/cli.ts` | `step-2-url/url-cli.ts` |
> | `step-2-url/manifest.ts` | `step-2-url/url-manifest.ts` |
> | `.../step-2-ocr/manifest.ts` | `.../step-2-ocr/ocr-manifest.ts` |
> | `.../step-2-stt/manifest.ts` | `.../step-2-stt/stt-manifest.ts` |
> | `.../provider-registry/selection.ts` | `.../provider-registry/provider-registry-selection.ts` |
> | `.../step-1-download/targets/`, `.../step-1-download/sources/` | `.../step-1-download/download-targets/` |
> | `src/types/cli/commands/process-steps/step-2-extract/step-2-shared/step-2-shared-types.ts` | `src/types` is workflow-grouped now; the URL contracts live under `src/types/url-workflow/` and the shared pipeline contracts under `src/types/pipeline-core/`, all re-exported from the `~/types` barrel |
>
> The `url-` and `ocr-`/`stt-` prefixes exist because `src/tools/unique-source-name-check.ts` enforces unique basenames across `src/`, which a per-step `manifest.ts` in three step directories would violate.
