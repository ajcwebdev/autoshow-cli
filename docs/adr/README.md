# Architecture Decision Records

Compact index for ADR-001 through ADR-019. Nineteen records are Accepted · Passed. The 2026-09-22 consolidation reorganized the previous twenty-seven records into these nineteen along command-family and cross-cutting seams; the [Consolidation Analysis](#consolidation-analysis) records what moved where. Hosted-model policy lives in [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) with live catalogs under `src/cli/commands/setup-and-utilities/models/` and command overviews under `docs/commands/`. ADR numbers are current-index identities: consolidations and moves renumber the sequence so it stays contiguous. The next new ADR is 020. Use [ADR_TEMPLATE.md](ADR_TEMPLATE.md) for new records and material updates.

## Authoring and Maintenance

- Copy `ADR_TEMPLATE.md` to `ADR-XXX-<kebab-case-title>.md`, assign the next zero-padded number, and replace every placeholder. Follow that template for record structure, required sections, status fields, Follow-up Actions, and Options Considered / Trade-offs labels.
- Create a new ADR for a new architectural decision. Update an existing ADR when implementation evidence, verification, or follow-up state changes without changing the decision's architectural scope.
- Do not use Markdown tables in ADRs or this index. Represent alternatives, trade-offs, overview entries, and other repeated structured information as named records with bold field labels.
- Update this index in the same change whenever an ADR is added, renamed, renumbered, consolidated, superseded, or materially changes status, scope, relationships, or next steps. Keep the sequence summary, next-number pointer, overview entries, consolidation analysis, and priorities mutually consistent.
- When records are consolidated or split and regrouped, reframe each surviving record around its resulting authority, carry every substantive claim to a clear owner, add a `Supersession` status field naming absorbed records by title, and delete the retired files. Then renumber later ADRs so the sequence stays contiguous, renaming each file and rewriting every cross-reference in the same change.
- Confirm every Markdown link resolves, every overview status matches its ADR, every Related ADR appears in the source record's References section, and no retired filename or number remains anywhere in the repository.
- Write prose and list items without hard wrapping. Preserve line-oriented Markdown for fenced code blocks.
- Run `bun run check` and `git diff --check` after ADR edits. Use only targeted local/no-cost tests; do not invoke paid or quota-limited providers for documentation verification.

## ADR Overview

Each Status field summarizes its ADR's `Decision Status` and `Verification Status`.

**ADR 1: [ADR-001](ADR-001-source-ingestion-and-normalization.md)**

- **Status:** Accepted · Passed
- **Decision:** Owns source identity, Step 0 classification and expansion, the explicit `article` and `x-space` URL routes and their execution artifacts, discovery caches, supported ebook normalization, unsupported ACSM policy, conversion metadata, and the normalized handoff to execution.
- **Related ADRs:** [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-004](ADR-004-setup-toolchain-and-runtime-configuration.md), [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md), [ADR-009](ADR-009-stt-timing-captions-and-alignment.md)

**ADR 2: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)**

- **Status:** Accepted · Passed
- **Decision:** Owns the command-neutral batch work plan, the canonical pipeline `manifest.json`, execution-to-resume selection parity, non-mutating `resume --price`, rejection of superseded manifest formats, and the optional versioned provider `settings` envelope that records effective request values outside every identity hash. Pooled OCR page state lives in the canonical item under [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md); recorded comic recovery is owned by [ADR-013](ADR-013-comic-scene-audio-and-presentation.md#recorded-comic-recovery-through-resume).
- **Related ADRs:** [ADR-001](ADR-001-source-ingestion-and-normalization.md), [ADR-005](ADR-005-cli-error-result-and-retry-contract.md), [ADR-006](ADR-006-top-level-command-boundaries-and-deprecations.md), [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md), [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md), [ADR-009](ADR-009-stt-timing-captions-and-alignment.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md), [ADR-013](ADR-013-comic-scene-audio-and-presentation.md), [ADR-015](ADR-015-govern-documentation-examples-and-verification-evidence.md)

**ADR 3: [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md)**

- **Status:** Accepted · Passed
- **Decision:** Removes strict single-use type indirection, keeps workflow-oriented type ownership, and preserves `src/types/index.ts` as the sole public `~/types` barrel. Archives removal of redundant Bun.Image declarations supplied by the native type packages.
- **Related ADRs:** [ADR-001](ADR-001-source-ingestion-and-normalization.md), [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md), [ADR-009](ADR-009-stt-timing-captions-and-alignment.md)

**ADR 4: [ADR-004](ADR-004-setup-toolchain-and-runtime-configuration.md)**

- **Status:** Accepted · Passed
- **Decision:** Owns the host setup lifecycle and the runtime configuration surface: managed macOS tools under `runtime/`, resumable integrity-checked downloads, bounded transfer concurrency, hermetic MuPDF and qpdf source builds, truthful setup reporting, `--bin-dir` resolver precedence, credentials as the only environment configuration, one missing-credential error with exit code 2, `setup --doctor --strict` as the fail-closed readiness gate, and allowlisted child environments. ADR-014 owns container credential delivery. Archives the 2026-08-31 Bun 1.3.14/1.4.0 dotenv compatibility result.
- **Related ADRs:** [ADR-001](ADR-001-source-ingestion-and-normalization.md), [ADR-005](ADR-005-cli-error-result-and-retry-contract.md), [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md), [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md), [ADR-019](ADR-019-read-successful-http-bodies-whole-under-a-payload-class-ceiling.md)

**ADR 5: [ADR-005](ADR-005-cli-error-result-and-retry-contract.md)**

- **Status:** Accepted · Passed
- **Decision:** Owns the `AppError` throw vocabulary, exit-code mapping, and the single CLI error funnel enforced by standing source scans; the two `bun autoshow` output modes, one-line text and versioned `--json`, with exactly one terminal result per invocation and no tables or `--log-format`; and provider retry ownership, where a paid create is retried only on explicit provider permission and an ambiguous admission stops until a later invocation passes `--allow-ambiguous-redispatch`.
- **Related ADRs:** [ADR-001](ADR-001-source-ingestion-and-normalization.md), [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md), [ADR-004](ADR-004-setup-toolchain-and-runtime-configuration.md), [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md), [ADR-013](ADR-013-comic-scene-audio-and-presentation.md), [ADR-015](ADR-015-govern-documentation-examples-and-verification-evidence.md), [ADR-016](ADR-016-quiet-passing-test-console-output.md)

**ADR 6: [ADR-006](ADR-006-top-level-command-boundaries-and-deprecations.md)**

- **Status:** Accepted · Passed
- **Decision:** Owns which top-level command owns which job: `write` is LLM text generation over `.md` / `.txt` input, `extract` is the only STT, OCR, URL, and X Space surface, TTS, image, video, and music are standalone follow-on commands, comic is a nested subcommand tree on the native parser with its deliberate grammar change, `voice` and `comic review` are the canonical commands with deprecated aliases for one compatibility release, and `resume` recovers recorded comic runs. Archives the [rejected 2026-09-10 consolidation alternatives](ADR-006-top-level-command-boundaries-and-deprecations.md#rejected-2026-09-10-consolidation-alternatives).
- **Related ADRs:** [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-005](ADR-005-cli-error-result-and-retry-contract.md), [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md), [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md), [ADR-009](ADR-009-stt-timing-captions-and-alignment.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), [ADR-011](ADR-011-links-selection-grammar-and-refresh-metadata.md), [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md), [ADR-013](ADR-013-comic-scene-audio-and-presentation.md), [ADR-015](ADR-015-govern-documentation-examples-and-verification-evidence.md), [ADR-017](ADR-017-comic-script-and-scene-authoring.md), [ADR-018](ADR-018-derive-cli-help-from-registries-and-generalize-provider-flags.md)

**ADR 7: [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md)**

- **Status:** Accepted · Passed
- **Decision:** Owns the cross-command work-unit inventory and run-scoped hosted admission policy: default five-second provider/account ramps, immediate mode, class and lane caps, exact-token 429 recovery, and separation of lane pressure from explicit TTS duplicate-spend authorization. Comic hosted work uses the same coordinator.
- **Related ADRs:** [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-005](ADR-005-cli-error-result-and-retry-contract.md), [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md), [ADR-013](ADR-013-comic-scene-audio-and-presentation.md), [ADR-018](ADR-018-derive-cli-help-from-registries-and-generalize-provider-flags.md)

**ADR 8: [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md)**

- **Status:** Accepted · Passed
- **Decision:** Owns Step 2 OCR execution and artifacts: Tesseract-only local OCR, retry-aware hosted failures, `auto|fixed` page ceilings, evidence-gated token pricing and batch diagnostics, ordinal-first chapter filenames, default full-document fan-out, and explicit `--ocr-provider-mode pool` with one dynamically claimed page queue, exactly-once acceptance, composite artifacts, in-manifest page-level resume, and attributed actual usage. Archives the Bun 1.4 TIFF/ImageMagick routing decision.
- **Related ADRs:** [ADR-001](ADR-001-source-ingestion-and-normalization.md), [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-004](ADR-004-setup-toolchain-and-runtime-configuration.md), [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md), [ADR-009](ADR-009-stt-timing-captions-and-alignment.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), [ADR-015](ADR-015-govern-documentation-examples-and-verification-evidence.md), [ADR-018](ADR-018-derive-cli-help-from-registries-and-generalize-provider-flags.md)

**ADR 9: [ADR-009](ADR-009-stt-timing-captions-and-alignment.md)**

- **Status:** Accepted · Passed
- **Decision:** Owns Step 2 STT execution and artifacts: word-level timing provenance labels, coverage-checked caption export in five local formats, export outside the transcription retry loop, per-model diarization capability labels, local forced alignment and comparison, channel merging, and reviewed speaker reconciliation. Archives the [September 2026 STT claim limits](ADR-009-stt-timing-captions-and-alignment.md#stt-caption-and-timing-archive), including automatic references that are not acoustic ground truth and one Parakeet sample that records live-tested endpoint compatibility only.
- **Related ADRs:** [ADR-001](ADR-001-source-ingestion-and-normalization.md), [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-004](ADR-004-setup-toolchain-and-runtime-configuration.md), [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md), [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), [ADR-018](ADR-018-derive-cli-help-from-registries-and-generalize-provider-flags.md)

**ADR 10: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)**

- **Status:** Accepted · Passed
- **Decision:** Owns durable cross-modality hosted-model policy: fixed selector identity, lifecycle/default/all eligibility, typed provider/model descriptors shared with resume, complete capability validation and routing, normalized reasoning, pricing provenance with published billing authoritative over estimates, calibration promotion, historical readability, and no silent substitution or coercion. Comic and every other command resolve models through these registries. Live catalogs and command docs: `src/cli/commands/setup-and-utilities/models/` and `docs/commands/`.
- **Related ADRs:** [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-006](ADR-006-top-level-command-boundaries-and-deprecations.md), [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md), [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md), [ADR-009](ADR-009-stt-timing-captions-and-alignment.md), [ADR-011](ADR-011-links-selection-grammar-and-refresh-metadata.md), [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md), [ADR-013](ADR-013-comic-scene-audio-and-presentation.md), [ADR-015](ADR-015-govern-documentation-examples-and-verification-evidence.md), [ADR-018](ADR-018-derive-cli-help-from-registries-and-generalize-provider-flags.md)

**ADR 11: [ADR-011](ADR-011-links-selection-grammar-and-refresh-metadata.md)**

- **Status:** Accepted · Passed
- **Decision:** Owns the `links` command: the order-sensitive provider-scoped selection grammar on the native parser, direct URL and input-file modes, model reference selections, optional `--refresh` metadata sidecars with token/hash change tracking and needs-attention findings, and standard `output/` run-directory writes via `--output-root` and `--output-dir`.
- **Related ADRs:** [ADR-006](ADR-006-top-level-command-boundaries-and-deprecations.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), [ADR-015](ADR-015-govern-documentation-examples-and-verification-evidence.md)

**ADR 12: [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md)**

- **Status:** Accepted · Passed
- **Decision:** Owns standalone `tts` and `voice`: the provider capability matrix, an explicit voice on every turn, voice provisioning and lifecycle with separate import, design, clone, approval, audition, retirement, and deletion actions, native and segmented rendering, retained slot reuse, compact lifetime classes, and delivery mastering that freezes purchased-slot identity on its historical output format while a separate delivery profile identifies the render, with smart chunk boundaries, seam mastering, optional loudness normalization, and derived exports.
- **Related ADRs:** [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md), [ADR-005](ADR-005-cli-error-result-and-retry-contract.md), [ADR-006](ADR-006-top-level-command-boundaries-and-deprecations.md), [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), [ADR-013](ADR-013-comic-scene-audio-and-presentation.md), [ADR-018](ADR-018-derive-cli-help-from-registries-and-generalize-provider-flags.md), [ADR-019](ADR-019-read-successful-http-bodies-whole-under-a-payload-class-ceiling.md)

**ADR 13: [ADR-013](ADR-013-comic-scene-audio-and-presentation.md)**

- **Status:** Accepted · Passed
- **Decision:** Owns comic scene audio and presentation: one canonical scene-run manifest, `comic generate-audio` over approved voice snapshots, provider-neutral sound intent in `structured-script.json` v5 with strict cue-to-dialogue timeline resolution, three dedicated SFX targets, the deterministic four-bus mixer, the local manifest-backed still-panel slideshow with same-size H.264/AAC hard cuts, and [recorded comic recovery through `resume`](ADR-013-comic-scene-audio-and-presentation.md#recorded-comic-recovery-through-resume).
- **Related ADRs:** [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md), [ADR-004](ADR-004-setup-toolchain-and-runtime-configuration.md), [ADR-005](ADR-005-cli-error-result-and-retry-contract.md), [ADR-006](ADR-006-top-level-command-boundaries-and-deprecations.md), [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md), [ADR-015](ADR-015-govern-documentation-examples-and-verification-evidence.md), [ADR-017](ADR-017-comic-script-and-scene-authoring.md)

**ADR 14: [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md)**

- **Status:** Accepted · Passed
- **Decision:** Owns the additive Debian slim local-lite Docker image, non-root runtime, tool and Tesseract contracts, direct image invocation and mount behavior, credential boundary, and multi-architecture GHCR publication. Archives the 2026-08-31 Bun 1.3.14/1.4.0 image comparison, the 2026-09-22 native AMD64 and ARM64 release review, and the rejection of a compiled production entrypoint.
- **Related ADRs:** [ADR-004](ADR-004-setup-toolchain-and-runtime-configuration.md), [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md), [ADR-019](ADR-019-read-successful-http-bodies-whole-under-a-payload-class-ceiling.md)

**ADR 15: [ADR-015](ADR-015-govern-documentation-examples-and-verification-evidence.md)**

- **Status:** Accepted · Passed
- **Decision:** Checks concrete CLI examples in the README and `docs/commands/` against registered commands, flags, and explicit provider/model selectors without executing them. The snapshot inventory and documentation cost-report workflow are retired. Owns the benchmark evidence lifecycle: primary-source refresh, local contracts, `--price` preflight, exact command-specific paid approval, artifact validation, and post-validation compaction. The combined-report architecture is documented in [docs/benchmarks/README.md](../benchmarks/README.md).
- **Related ADRs:** [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-004](ADR-004-setup-toolchain-and-runtime-configuration.md), [ADR-005](ADR-005-cli-error-result-and-retry-contract.md), [ADR-006](ADR-006-top-level-command-boundaries-and-deprecations.md), [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md), [ADR-009](ADR-009-stt-timing-captions-and-alignment.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), [ADR-011](ADR-011-links-selection-grammar-and-refresh-metadata.md), [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md), [ADR-013](ADR-013-comic-scene-audio-and-presentation.md), [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md)

**ADR 16: [ADR-016](ADR-016-quiet-passing-test-console-output.md)**

- **Status:** Accepted · Passed
- **Decision:** Passing tests print only the result line; failing tests keep that line plus the captured console output from that test. JUnit remains a post-run sidecar. `bun t` hides pass and skip result lines on the terminal, prints a failure-first digest with calibration recommendations, and keeps `latest-model-calibration.json` beside `latest.log`.
- **Related ADRs:** [ADR-005](ADR-005-cli-error-result-and-retry-contract.md)

**ADR 17: [ADR-017](ADR-017-comic-script-and-scene-authoring.md)**

- **Status:** Accepted · Passed
- **Decision:** Owns the comic authoring stages: `comic draft-treatment` adapting a prose treatment into the episode script shape and bootstrapping catalog entries, the `draft-scenes --panel-count` contract, the typed `metadata/blocking-plan.json` compiled into a per-panel ledger that is the single source of truth for the image prompt and page judge, the advisory blocking audit behind `--blocking-hard-keys`, the blocking-class restart lane, per-location geometry records, and the local `comic review` sheet and notes round trip.
- **Related ADRs:** [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md), [ADR-005](ADR-005-cli-error-result-and-retry-contract.md), [ADR-006](ADR-006-top-level-command-boundaries-and-deprecations.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), [ADR-013](ADR-013-comic-scene-audio-and-presentation.md), [ADR-015](ADR-015-govern-documentation-examples-and-verification-evidence.md), [ADR-018](ADR-018-derive-cli-help-from-registries-and-generalize-provider-flags.md)

**ADR 18: [ADR-018](ADR-018-derive-cli-help-from-registries-and-generalize-provider-flags.md)**

- **Status:** Accepted · Passed
- **Decision:** Derives every advertised default, enumeration, and per-provider range from one capability registry per domain, collapses the triplicated TTS control tables and the provider-prefixed TTS/STT option flags onto a shared `provider=value` selector, replaces the five intra-step concurrency knobs with `--step-concurrency <scope>=N` and `--url-provider-concurrency` with the shared `--provider-concurrency` lane, and moves comic model selection onto `--provider` plus per-role `--<role>-provider`; supersedes the flag surface of ADR-007 while leaving its lane architecture accepted.
- **Related ADRs:** [ADR-006](ADR-006-top-level-command-boundaries-and-deprecations.md), [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md)

**ADR 19: [ADR-019](ADR-019-read-successful-http-bodies-whole-under-a-payload-class-ceiling.md)**

- **Status:** Accepted · Passed
- **Decision:** Returns every successful HTTP body whole or rejects it whole, under a payload-class memory ceiling (`control` 16 MiB, `result` 512 MiB and the default, `download` 2 GiB, none when the download streams to disk). `AUTOSHOW_HTTP_PAYLOAD_MAX_BYTES` replaces every ceiling and is validated at startup. An oversize body is not retried, and the error names the observed size. Inlined TTS audio is estimated before dispatch when the request fixes the byte rate. Bounded capture remains for error bodies and subprocess output and does not fail a successful subprocess.
- **Related ADRs:** [ADR-004](ADR-004-setup-toolchain-and-runtime-configuration.md), [ADR-005](ADR-005-cli-error-result-and-retry-contract.md), [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md), [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md)

## Bun 1.4 Migration Archive

The 2026-08-31 migration evidence is retained by architectural owner. The archive records the results available on that date; it does not infer completion of unreviewed CI jobs.

- **State and price planning:** [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) owns manifest, resume, and price planning. No-cost CPU, heap, and tokenizer profiles are reproduced from the [profiling guide](../commands/testing.md#profiling).
- **Type ownership:** [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md#bun-14-image-declarations) retains the Bun.Image declaration cleanup.
- **Environment compatibility:** [ADR-004](ADR-004-setup-toolchain-and-runtime-configuration.md#bun-14-dotenv-compatibility) retains the 2026-08-31 dotenv compatibility result.
- **Image extraction:** [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md#bun-14-image-routing) retains TIFF and ImageMagick routing constraints.
- **Docker distribution:** [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md#bun-14-migration-evidence) retains the 2026-08-31 native ARM64 comparison, the discarded emulated AMD64 run, the open native release review, and the compiled-entrypoint rejection.

The completed Docker migration comparison utilities are retired. Current Docker acceptance is documented in the [Docker guide](../docker.md), and reusable runtime diagnostics remain in the [testing profiling guide](../commands/testing.md#profiling). Historical measurements remain in their owning ADRs; generated diagnostic artifacts remain ignored.

## Consolidation Analysis

The 2026-09-22 consolidation reduced twenty-seven records to nineteen. The earlier index kept every record separate along architectural layers; this pass cut along the seams maintainers navigate by, which are the `docs/commands/` command families and a small number of cross-cutting questions that were each answered in several records. Every surviving record names its absorbed sources by title in its `Supersession` field.

### What moved where

**Move 1: Pipeline core**

- **Result:** [ADR-001](ADR-001-source-ingestion-and-normalization.md) and [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md).
- **Change:** URL route execution joined source ingestion in ADR-001. The provider `settings` envelope record joined the manifest authority in ADR-002. The recorded comic recovery amendment left ADR-002 for ADR-013, and pooled OCR page-state detail left it for ADR-008, so ADR-002 no longer collects every command's resume quirks.

**Move 2: Setup and runtime configuration**

- **Result:** [ADR-004](ADR-004-setup-toolchain-and-runtime-configuration.md).
- **Change:** The toolchain lifecycle and the environment-variable surface both defined `--bin-dir` precedence and both described what doctor checks. One setup-command record now owns provisioning, downloads, diagnostics, credentials, and child environments.

**Move 3: CLI error, result, and retry contract**

- **Result:** [ADR-005](ADR-005-cli-error-result-and-retry-contract.md).
- **Change:** The `AppError` vocabulary and the table-free output and retry contract were two halves of one contract split by a supersession note. One record now answers what a failure prints, what it exits with, and whether a provider request may be sent again.

**Move 4: Command boundaries**

- **Result:** [ADR-006](ADR-006-top-level-command-boundaries-and-deprecations.md).
- **Change:** The write-only boundary, the comic subcommand tree and native grammar, the canonical `voice` and `comic review` commands, the deprecated aliases, and the rejected 2026-09-10 alternatives were spread across four records. The former comic-integration record dissolved: its registry resolution went to ADR-010, its hosted-admission note to ADR-007, its links grammar to ADR-011, and its flag spellings to ADR-018.

**Move 5: Extract by route**

- **Result:** [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md) and [ADR-009](ADR-009-stt-timing-captions-and-alignment.md).
- **Change:** The single extract record covered three routes with two archives, and pooled OCR was described in three places. OCR execution, the page pool, and the in-manifest page ledger now share one record; STT timing, captions, and alignment have their own; URL routes live in ADR-001.

**Move 6: Audio by command family**

- **Result:** [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md) and [ADR-013](ADR-013-comic-scene-audio-and-presentation.md).
- **Change:** The character-voice, soundscape, slideshow, and delivery-mastering records were split by layer. They are now split by operator seam: standalone `tts` and `voice` in ADR-012, and `comic generate-audio`, `comic generate-slideshow`, and comic `resume` in ADR-013. Soundscape ships only through comic generate-audio, so it is filed with comic.

**Move 7: Comic authoring**

- **Result:** [ADR-017](ADR-017-comic-script-and-scene-authoring.md).
- **Change:** Treatment drafting, the blocking plan and panel ledger, and the local review round trip are the text-to-validated-scene stages, so they share one record. Deprecated alias names stay with ADR-006.

**Move 8: Verification evidence**

- **Result:** [ADR-015](ADR-015-govern-documentation-examples-and-verification-evidence.md), [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), and [docs/benchmarks/README.md](../benchmarks/README.md).
- **Change:** The superseded benchmark-evidence record dissolved after the `benchmark` command was removed. Its paid-approval lifecycle joined the documentation-contract record, its calibration and billing-authority rules joined the registry policy, and its combined-report architecture is documented beside the reports.

### Remaining Boundaries

**ADR set 1: [ADR-001](ADR-001-source-ingestion-and-normalization.md) + [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)**

- **Recommendation:** Keep separate.
- **Current rationale:** Classification and normalization happen before a work plan exists, and ADR-002 is already the largest core record after absorbing the settings envelope. Revisit only if ADR-002 shrinks further.

**ADR set 2: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) + [ADR-018](ADR-018-derive-cli-help-from-registries-and-generalize-provider-flags.md)**

- **Recommendation:** Keep separate for now.
- **Current rationale:** ADR-018 extends the registry thesis to the help surface, but its rationale for a breaking flag rename is recent and worth keeping visible. Fold it into ADR-010 as an archived impact section once the rename has aged.

**ADR set 3: [ADR-005](ADR-005-cli-error-result-and-retry-contract.md) + [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md) + [ADR-019](ADR-019-read-successful-http-bodies-whole-under-a-payload-class-ceiling.md)**

- **Recommendation:** Keep separate.
- **Current rationale:** A single provider-request policy record covering admission, retry, redispatch, and payload ceilings was considered and deferred. It would separate ADR-007's admission coordinator from its lane inventory, and the retry question is now answered in one place by ADR-005.

**ADR set 4: [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md) + [ADR-016](ADR-016-quiet-passing-test-console-output.md)**

- **Recommendation:** Keep separate.
- **Current rationale:** Both are developer conventions rather than product architecture. Demoting them to the testing guide and repository rules is a candidate, not a merge.

**ADR set 5: [ADR-004](ADR-004-setup-toolchain-and-runtime-configuration.md) + [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md)**

- **Recommendation:** Keep separate.
- **Current rationale:** Host acquisition, managed source builds, and setup reporting have a different lifecycle from image contents, mount semantics, registry publication, and provenance.

**ADR set 6: [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md) + [ADR-013](ADR-013-comic-scene-audio-and-presentation.md)**

- **Recommendation:** Keep separate.
- **Current rationale:** ADR-012 owns voice identity, rendering, slots, and delivery for the standalone commands. ADR-013 consumes that subsystem read-only for scene runs, soundscape, presentation, and recovery, and must not change voice identity or provider execution evidence.

## Next Steps

Five ADRs have open follow-up work. Each item summarizes the source record's Follow-up Actions; that record remains the authority for scope and evidence. The [September 23 reasoning calibration and vocabulary review](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md#reasoning-calibration-and-provider-vocabulary-review-2026-09-23) is complete for the measured contexts; general write and unmeasured-context heuristics remain provisional. Routine hosted-model catalog maintenance, stays with ADR-010 and the live registries under `src/cli/commands/setup-and-utilities/models/`.

**Item 1: [ADR-017](ADR-017-comic-script-and-scene-authoring.md#follow-up-actions)**

- **Priority:** High
- **Next step:** Run the continuity baseline and the ten-panel prompt ablation as owner-run paid commands, then use their per-key precision to decide which blocking audit statuses `--blocking-hard-keys` promotes from advisory to hard. Reviewed location geometry, and the rendered blocking card and coverage keyframes, remain pending behind that measurement. Also decide how a first-try production should promote judge-retained originals when every hard failure is set-continuity, and whether a per-location style image should replace the catalog-wide `styleImage`.

**Item 2: [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md#follow-up-actions)**

- **Priority:** Medium
- **Next step:** Listen to the paid `eleven_v3` pilot before treating perceptual quality as established. Re-mastering from retained slots, wall-time estimates on the smart splitter, and re-export for single-file runs in an existing directory remain pending.

**Item 3: [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md#follow-up-actions)**

- **Priority:** Low
- **Next step:** Run the two deferred cleanup reviews: remaining multi-use exported declarations, and remaining multi-reference non-exported declarations.

**Item 4: [ADR-006](ADR-006-top-level-command-boundaries-and-deprecations.md#follow-up-actions)**

- **Priority:** Low
- **Next step:** After the compatibility release, remove deprecated `comic reference-voice`, `comic review-sheet`, and `comic review-notes` aliases in a later announced breaking CLI release.

**Item 5: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md#follow-up-actions)**

- **Priority:** Low
- **Next step:** Let resume rebuild generation and TTS options from `settings`, record provider entries for failed `write` targets, and hash lyrics files in music settings.

## Local reports workspace

Agent task reports under `docs/reports/` are gitignored. The documentation cost reports and local help/environment inventory generators were retired on September 23. Cleanup audits **00–06** (and the high-priority metareport / architecture-consolidation write-ups) were completed on `staging` around 2026-09-17 and removed. Ongoing truth is this ADR index, live model dirs under `src/cli/commands/setup-and-utilities/models/`, `docs/commands/`, `docs/diagrams.md`, `docs/docker.md`, and `docs/benchmarks/README.md`. Documentation example and help contracts validate the maintained command surface directly.
