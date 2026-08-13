# ADR-016: Distribute OCR Pages Across a Multi-Provider Work Pool

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-08-13
- **Date Updated:** 2026-08-13
- **Verification Status:** Passed

## Context

Multi-provider OCR historically meant full-document fan-out: every selected provider/model target received the complete document and wrote one independent result under its provider directory. That remains useful for provider comparison and redundancy, but it charges every target for every page and cannot let a faster healthy target absorb more work from a slower one.

Document OCR already provides page preparation, concurrency lanes, target admission, failure handling, manifest persistence, resume, pricing, and provider-attributed usage. Pooled execution must compose these capabilities without introducing a second checkpoint authority or altering existing fan-out contracts.

The difficult boundary is exactly-once accepted output rather than exactly-once remote execution. A provider request can fail ambiguously after remote work has started, so another request may be necessary; nevertheless, only one result may become canonical for a page. Claims, attempts, raw responses, and usage therefore need distinct identities and durable attribution.

Concrete hosted model identity, lifecycle eligibility, capabilities, normalized reasoning policy, and pricing provenance remain governed by [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md). Canonical persistence, resume selection, and price planning remain governed by [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md). This record chooses the pooled execution shape that ADR-008 and ADR-009 apply.

Why now: users need multiple independent OCR lanes to collaborate on one document without paying every selected target to process the full page set, while preserving the existing fan-out contract by default.

## Options Considered

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **Add an explicit shared page pool while retaining full-document fan-out as the default** | Backward compatible; faster targets naturally claim more work; one composite result; account lanes retain their existing caps; page-level resume and usage attribution are explicit | Adds a canonical page ledger, claim lifecycle, per-attempt artifacts, and scheduler telemetry | With three independent hosted lanes and `--ocr-concurrency 10`, up to 30 remote page requests may run; same-account targets still share one cap of 10 |
| Replace fan-out with pooled execution whenever multiple targets are selected | Simplest public surface; avoids duplicate document processing by default | Breaks provider-comparison artifacts, pricing, resume, and top-level primary-result behavior | Changes every existing multi-provider run |
| Divide pages into static target ranges | Simple deterministic planning and attribution | Slow or failed targets gate completion; cannot rebalance or hand off pages efficiently | Each target initially receives approximately `pages / targets` regardless of throughput |
| Race every page across every target and accept the first response | Lowest page latency and easy failover | Multiplies cost, remote load, and ambiguous executions; wastes healthy results | Up to `pages × targets` requests |
| Store a separate pool checkpoint beside `manifest.json` | Isolates scheduler code from the canonical manifest | Creates competing completion and resume authorities forbidden by ADR-002 | Two persistence authorities per run |

## Decision

Add `--ocr-provider-mode fanout|pool`, defaulting to `fanout`. In `pool` mode, every eligible selected OCR target draws independent pages from one shared queue and contributes to one top-level composite extraction; `--primary-ocr` is invalid because there is no complete per-provider result to promote.

This applies to:

- Supported PDF, CBZ, and image inputs that can be normalized locally into compatible independent page work units.
- Fresh `extract` and document `write` execution, canonical resume, and side-effect-free price planning.
- Hosted and local OCR targets admitted by their existing target-pool controls and provider/account lane identities.
- Page claims, accepted output, attempts, failures, usage, costs, timing, artifacts, telemetry, and diagnostics.
- Fan-out preservation: absent or explicit `fanout` keeps existing full-document provider paths, provider state, pricing, resume, and optional primary-result behavior unchanged.
- Scope explicitly excluded: changing source classification or normalization under ADR-001, changing the error taxonomy under ADR-006, changing model catalog entries under ADR-013, or making benchmark reports the authority for price or resume planning.

### Queue, admission, and claims

The pool creates one page ledger in source order. A pending page can have at most one active claim. Target workers claim dynamically, so a faster target can accept a larger page share without a static range assignment. Page preparation is promise-cached per page for the run; a retry or handoff reuses the provider-neutral prepared page when safe.

`--provider-concurrency` bounds admitted hosted targets and `--local-concurrency` bounds admitted local targets. Each admitted target may request page work up to its applicable OCR cap. Hosted targets with different provider/account lane identities can multiply concurrency; targets sharing a lane share that lane's cap. An explicit `--ocr-concurrency <n>` is a fixed hard lane ceiling, while omission retains adaptive `auto` sizing, pressure backoff, and qualified profile ceiling rules.

Every claim creates a unique attempt with page, provider, concrete model, lane, requested and effective reasoning policy, start time, and isolated artifact directory. A successful attempt commits only if its claim is still current and the page has no accepted result. This compare-before-commit rule prevents duplicate canonical page results even when remote execution was ambiguous or a stale worker finishes late.

### Failure and completion

A transient page failure releases the claim and makes the page eligible for another target; a target cannot immediately reclaim a page it already failed while another eligible target remains. Target-specific blockers retire only that target. Provider/account blockers retire the lane and every dependent target. Already accepted pages remain valid after either retirement, and unfinished pages are requeued to healthy eligible targets.

One target attempt per page bounds ordinary execution. Explicit resume re-enablement can authorize another attempt for a repaired target or lane. Interrupted in-flight attempts become `interrupted` evidence and return to unfinished work without consuming the target's ordinary eligibility. A page becomes exhausted when no eligible target remains after terminal attempts. The composite is full when every required page has one accepted result and incomplete when any page is exhausted, regardless of whether some workers retired or failed.

### Artifacts, cache identity, and evidence

Top-level extraction artifacts are assembled from accepted pages in original page order. Provider directories contain only isolated page-attempt results, raw responses, errors, and usage records; they never represent a second complete extraction or determine resume eligibility.

Hosted page response-cache identity includes provider mode, provider, concrete model, requested and effective reasoning policy, input SHA-256, normalized input format, original page number, and DPI. Provider-neutral page preparation remains reusable independently. Pool timing and token evidence is qualified as pool mode; existing fan-out throughput profiles are not used as trusted pool timing evidence, and failed, partial, retry-heavy, or incomplete pool samples cannot become healthy profiles.

### Pricing and telemetry

Price mode assigns the page set once across eligible lane capacity rather than charging every selected target for the whole document. The deterministic heuristic gives equal weight to independent lanes and divides a shared lane's weight among its targets, then scales page units, tokens, time, and cost per target. `resume --price` applies the same allocator only to unfinished pages and performs no provider call or mutation.

Actual cost includes every attempt with available usage, including failed or ambiguous paid work, without treating that work as accepted output. Scheduler telemetry records queue metrics, claim lifecycle events, retried or ambiguous attempts, retired lanes, per-target throughput, and page distribution.

## Rationale

- Dynamic claims use healthy capacity without making a slow target the owner of a fixed page range.
- Lane sharing preserves provider/account safety while allowing independent accounts or providers to multiply useful concurrency.
- The claim-and-commit distinction gives exactly-once canonical output under at-least-once remote execution.
- Keeping the page ledger inside the canonical manifest preserves ADR-002's one-authority contract and makes crash recovery deterministic.
- Per-attempt directories preserve raw evidence and paid failure usage without letting provider artifacts control completion.
- An explicit mode retains full backward compatibility for comparison-oriented fan-out runs.
- Registry and reasoning validation before dispatch prevents resume or cache identity from silently changing a stored target's behavior.

## Consequences

Positive outcomes:

- Selected targets collaborate on one extraction, and faster healthy targets naturally process more pages.
- Independent lanes can use their full page caps while same-account models cannot multiply the account cap.
- Provider or lane failures do not discard pages already accepted from those workers.
- Resume preserves accepted pages and recovers interrupted claims from one canonical ledger.
- Pricing represents one pooled page allocation, and actual cost retains paid failed or ambiguous attempts.
- Existing fan-out commands and artifacts remain the default and retain their established behavior.

Negative outcomes:

- Pool manifests and diagnostics carry substantially more page- and attempt-level state.
- A network ambiguity can still cause more than one remote execution for a page even though only one result is accepted.
- Heuristic price allocation cannot predict the final page share of targets whose real throughput or failure rate differs from the estimate.
- Pool mode is rejected for formats or target combinations that cannot be normalized into compatible page units.
- Provider attempt directories are useful evidence but are intentionally not resumable complete outputs.

## Trade-offs

| Gains | Sacrifices |
|---|---|
| One composite extraction using multiple lanes | No complete independent result per provider in pool mode |
| Dynamic throughput-sensitive page share | More scheduler, ledger, and telemetry state |
| Exactly-once canonical page acceptance | Remote requests remain at-least-once under ambiguity |
| Canonical crash recovery | More frequent atomic manifest checkpoints |
| Backward-compatible explicit mode | Two execution policies must remain separately tested |

## Implementation Note

`src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-provider-pool.ts` implements the shared queue, claims, lane caps, retirement, handoff, exhaustion, and telemetry. `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-pooled-batch.ts` owns compatible page preparation, isolated attempt execution, composite assembly, and canonical checkpoints. `src/cli/commands/process-steps/pipeline-manifest.ts` retains the composite Step 2 record and `ocrPool` ledger when provider states are present.

Option resolution exposes the mode to `extract`, `write`, `resume`, and config. Resume preserves the stored mode, admits additive or explicitly re-enabled current targets after registry validation, converts interrupted claims to unfinished work, and prices only unfinished pages. Hosted fallback cache identity includes pool mode and the behavior-affecting input and reasoning fields.

Pooled estimates and actual costs are implemented in the extraction and command pricing orchestration. Pool estimates carry heuristic allocation fields and a pool-qualified OCR mode; actual target usage includes failed and ambiguous attempts where providers report usage.

## API / Type Impact

- New public flag: `--ocr-provider-mode fanout|pool`, default `fanout`.
- `--primary-ocr` is a structured usage error with pool mode before credential lookup or provider dispatch.
- Extraction options carry `ocrProviderMode`, explicit-mode provenance, and the original pooled page number for provider attribution and cache identity.
- The canonical item metadata can carry `ocrProviderMode: "pool"` and one `ocrPool` ledger containing page, attempt, target, lane, and telemetry state.
- Composite extraction metadata uses `extractionMethod: "ocr-pool"`, `ocrProviderMode: "pool"`, and per-target usage attribution.
- Pool attempt paths follow `providers/<target>/attempts/page-<six digits>/attempt-<three digits>/`.

## Test Plan

- Verify option defaults, help, invalid values, incompatible inputs, and pool/primary rejection before dispatch.
- Unit-test shared claims, one-active-claim enforcement, hosted/local target admission, same-lane cap sharing, fixed and adaptive OCR caps, dynamic page share, and reverse completion.
- Unit-test transient and ambiguous failure handoff, target and lane retirement, exhausted pages, duplicate-commit prevention, interrupted-claim recovery, additive targets, and explicit re-enablement.
- Verify canonical item round trips retain the composite Step 2 record and page ledger, accepted pages survive resume, attempt paths stay contained, and provider artifacts are not completion authority.
- Verify pooled estimates allocate the page set once, pooled actual cost includes failed-attempt usage, pool cache identity rejects behavior-affecting changes, and fan-out estimates remain unchanged.
- Run `bun run check`, `bun t --price`, the targeted CLI contract suites, and local/mock OCR, pricing, manifest, resume, scheduler, cache, and artifact tests. Do not run paid or quota-limited provider commands.

Verification passed on 2026-08-13 with the repository default no-cost pass and targeted pool scheduler, pricing, cache, manifest, resume, and CLI contracts.

## References

- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) — sole canonical page ledger, atomic progress, mode-preserving resume, and unfinished-page price planning
- Related ADR: [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md) — shared queue, work selection, target admission, concurrency multiplication, and lane policy
- Related ADR: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md) — OCR execution, attribution, artifacts, failures, cache identity, profiles, and diagnostics
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) — concrete model identity, lifecycle eligibility, capabilities, reasoning, pricing provenance, resume identity, and hosted cache identity
- Pool scheduler: `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-provider-pool.ts`
- Pool orchestration: `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-pooled-batch.ts`
- Canonical manifest: `src/cli/commands/process-steps/pipeline-manifest.ts`
- Resume: `src/cli/commands/setup-and-utilities/resume/extract/ocr-resume.ts`
- Pricing: `src/cli/commands/process-steps/step-2-extract/extract-pricing/build-extract-estimates.ts`
- Deterministic contracts: `test/test-cases/validation/extract-ocr/ocr-page-pool-contracts.test.ts`
