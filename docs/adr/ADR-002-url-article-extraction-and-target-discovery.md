# ADR-002: URL article extraction, target discovery, and canonical pipeline persistence

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-12
- **Date Updated:** 2026-08-13
- **Verification Status:** Passed

## Context

URL article extraction originally maintained provider identity, target selection, persistence, and resume rules separately from OCR and STT. Command-neutral source discovery also lived under the download step even though metadata, download, extract, and write all depend on it. A later article-route correction exposed a deeper persistence problem: pipeline state was split across several filenames, envelopes, summaries, and provider checkpoints, so readers needed format versions, artifact kinds, probing order, aliases, and inference to reconstruct one run.

Pipeline outputs are disposable execution state, not a durable interchange format. Rerunning is the supported recovery path after a persistence contract changes. Maintaining recognition or migration machinery for superseded pipeline state therefore adds ambiguity without providing a supported compatibility promise.

## Decision

### URL identity and execution ownership

The shared Step 2 provider registry owns URL backend identity, hosted/local grouping, configuration paths, shortcut expansion, provider-spec collection, and resume-selectable targets. URL execution remains domain-owned under `step-2-url`: adapters, retry behavior, article normalization, artifact writing, and provider response handling do not move into the identity registry.

`article` is a first-class extraction route. It is never inferred from `x-space`, input family, or provider metadata. X Spaces retain their own route and explicit not-resumable behavior.

### Command-neutral discovery

Input classification, source expansion, format hints, route selection, and batch planning belong to `step-0-metadata`. Download-specific acquisition, normalization, raw downloader options, and output writing remain in `step-1-download`.

### One pipeline persistence contract

Every pipeline output root contains exactly one unversioned `manifest.json`. The top-level shape is always `{ command, scope, createdAt, updatedAt, source?, items }`; `command` and `scope` are ordinary business fields rather than format selectors. Every item uses the same input, route, output, child-link, status, metadata, and provider-state fields.

Provider identity, artifact location, attempts, running/succeeded/missing/failed/skipped status, resumable remote-job metadata, result summary, and error are stored once in the item's provider entries. Requested, missing, blocked, completion, and batch-summary views are derived. Provider directories may contain raw domain payloads, but those payloads do not carry pipeline format metadata and never control resume eligibility.

Mixed-route batches use containment-checked child-directory links. Each linked child directory owns its own canonical manifest. Resume validates parent route, child route, index, command, scope, and path containment before reading or rewriting child state.

The canonical reader validates only the current shape, timestamps, statuses, and contained relative paths. It distinguishes a missing canonical file from malformed or invalid current data. It does not recognize, detect, reject by version, migrate, or probe for superseded formats. Corrupt current state fails before provider execution or rewrite.

This clean break supersedes this ADR's former version-bump policy. Existing output directories created under any earlier persistence layout must be rerun.

## Rationale

Sharing provider identity without centralizing execution keeps selection consistent while respecting the runtime differences between article, OCR, and STT providers. Moving discovery to Step 0 aligns ownership with the pipeline. A single persistence shape removes the need for multiple codecs, compatibility readers, source/completion aliases, and route inference while preserving the safety checks that protect current-state rewrites.

## Consequences

Positive outcomes:

- URL, OCR, and STT provider selection share one registry-backed identity model.
- Article and X-Space routes are explicit and cannot be conflated during resume.
- Metadata, download, extract, and write consume one command-neutral discovery plan.
- Every producer, benchmark reader, artifact reporter, and resume path uses the same canonical persistence boundary.
- Provider progress and completion cannot drift between root summaries, checkpoint files, and result envelopes.
- Path traversal and malformed current state fail locally before filesystem escape or provider work.

Negative outcomes:

- Existing pipeline outputs from before this cutover are intentionally not resumable and must be regenerated.
- The atomic cutover touches producers, resume, benchmarks, tests, help text, examples, and committed output fixtures together.
- URL execution remains structurally different from OCR and STT execution even though identity and persistence are shared.

## Rejected alternatives

- A universal Step 2 runner was rejected because provider execution, retry, cleanup, and response policy remain domain-specific.
- Per-artifact or per-command codecs were rejected because they would recreate format ownership and dispatch under a new abstraction.
- A compatibility reader, upgrader chain, tombstone reader, or old-format detector was rejected because it would preserve the legacy concept the cutover removes.
- Route inference was rejected because explicit route data is required for safe one-item batches and mixed-route parent/child resume.

## Verification

- Canonical contracts cover every process command, single and batch scope, one-item batches, mixed-route child links, all provider statuses, atomic progress updates, missing files, malformed JSON, invalid shape, corrupt rewrites, and path containment.
- URL contracts cover registry ordering, local/hosted grouping, additive selection, and article-vs-X-Space routing.
- Resume contracts use only individually reviewed local or mocked cases and never require a paid provider call.
- A source guard ensures no superseded pipeline filename, format version helper, old manifest type, route adapter, checkpoint, or derived summary artifact remains in production, test fixtures, current documentation, or committed pipeline outputs.

## References

- Canonical persistence boundary: `src/cli/commands/process-steps/pipeline-manifest.ts`
- URL provider identity: `src/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry/url-providers.ts`
- URL runtime: `src/cli/commands/process-steps/step-2-extract/step-2-url/`
- Command-neutral discovery: `src/cli/commands/process-steps/step-0-metadata/`
- Resume routing: `src/cli/commands/setup-and-utilities/resume/`
