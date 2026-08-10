# Mechanical and Behavioral Consolidation Archive

This archive combines the completed mechanical duplication and behavioral consolidation programs. Part I records the 48-wave mechanical program; Part II records the six-wave behavioral program that followed it. Neither part contains an active backlog.

## Part I — Mechanical consolidation

Date: 2026-08-09. Status: complete. All 48 approved mechanical consolidation waves landed on `staging`. No mechanical backlog remains in this program.

### Outcome and accounting

The program removed 5,139 net lines from `src/` and `test/`; documentation is excluded. The totals were re-audited from committed diffs. Wave 34 was corrected from 46 to 45 net lines, reducing the waves 1–35 subtotal from 4,645 to 4,644. The final-wave forecast was also corrected to remove overlap between O-3 and X-3.

| Implementation commit | Waves | Net lines removed |
|---|---:|---:|
| `70907228` | 1–5 | 1,482 |
| `90ae5109` | 6–14 | 1,792 |
| `4cee163d` | 15–27 | 838 |
| `2a468393` | 28–35 | 532 |
| `3035df9c` | 36–48 | 495 |
| Total | 1–48 | 5,139 |

### Consolidated areas

The 48 waves established shared primitives and removed repeated scaffolding across:

- CLI flag reading, rewriting, option selection, config merge, setup capture, project paths, and common types.
- Generation status, resume handling, provider polling, captions, media benchmarks, and pricing.
- Hosted and local STT request, polling, cleanup, health, startup, and runner lifecycles.
- Hosted OCR schemas, parsing, usage, pricing, guards, and partial-result handling.
- Hosted TTS contracts, chunk processing, audio concatenation, and custom-voice flows.
- URL transport, result finalization, retry scenarios, comic inputs, frontmatter rendering, and test fixtures.

### Historical behavior changes

Most waves preserved behavior. The material exceptions were:

- AssemblyAI and Gladia adopted consistent retry metadata and `Retry-After` interpretation.
- MiniMax multi-chunk audio moved to a single concat pass and the shared concat failure contract.
- Setup failures adopted common stages and messages.
- Partial OCR cache validation began rejecting nonnumeric confidence values, closing the former guard divergence.

Minor insertion-order and unused-field changes were accepted where they did not alter supported behavior.

### Closure review

The mechanical program originally handed several observations to the behavioral program. That work later resolved the substantive items involving OCR failure diagnostics, GLM Reader finalization, ElevenLabs response headers, write-resume errors, and related provider-state behavior. Other observations were confirmed as intentional differences, low-value inconsistencies, or outside the approved consolidation scope. They are not an active backlog in either program.

Higher-risk work was completed in the behavioral program recorded in Part II. Together, the two programs contain only completed outcomes, accepted compatibility decisions, and rejected proposals.

### Verification and provenance

Each implementation batch passed `bun run check` and relevant local, no-cost contract tests. No paid or quota-limited provider command was used for verification. The final accounting uses committed source and test diffs rather than planning estimates.

## Part II — Behavioral consolidation

Date: 2026-08-09. Status: complete. The program closed all 19 approved bug findings and all 31 approved behavioral consolidations. No approved wave remains pending.

### Outcome

The work followed the 48-wave mechanical consolidation recorded in Part I. Waves 2–6 removed 1,610 net lines from `src/` and `test/`; documentation is excluded. Wave 1 consisted primarily of small behavioral corrections and is not included in that total.

| Wave | Scope | Findings | Net lines removed |
|---|---|---:|---:|
| W1 | Live bug fixes | 19 | Not aggregated |
| W2 | Low-risk factories and shared contracts | 3 | 335 |
| W3 | Provider, test, rendering, and option-boundary consolidation | 12 | 917 |
| W4 | Shared engines for benchmarks, polling, media, REST, resume, and reporting | 10 | -149 |
| W5 | Async STT, comic CLI, and generation-test consolidation | 3 | 294 |
| W6 | OCR pipeline, provider-state, and parser convergence | 3 | 213 |
| Total, W2–W6 | Behavioral consolidations | 31 | 1,610 |

Negative net lines indicate that explicit policy adapters and regression contracts added more lines than the production consolidation removed.

### Bugs closed

| ID | Historical issue | Resolution |
|---|---|---|
| W1.1 | Happy Scribe retries could create a second paid order. | Completion is persisted only after transcript retrieval, so retries reuse the existing order. |
| W1.2 | Soniox removed remote resources after retryable failures. | Cleanup is limited to terminal outcomes. |
| W1.3 | Rendered-page OCR continued scheduling requests after failure. | The duplicate rendered-page pipeline and its scheduler were removed in W6.1. |
| W1.4 | Write-from-media omitted supported runtime options. | The complete overlapping option surface is forwarded and guarded by a typed completeness check. |
| W1.5 | Gemini write requests lacked timeout cancellation. | Each attempt now receives a bounded cancellation signal. |
| W1.6 | Polled generation did not recover from transient poll failures. | Poll reads retry; paid create requests remain single-shot. |
| W1.7 | MiniMax video and music failures used TTS stages. | Each domain now reports its own stage. |
| W1.8 | The video provider-list error omitted `fal`. | Runtime and command-boundary provider lists now agree. |
| W1.9 | Video and music errors named internal rather than accepted flags. | Errors are translated to command-line spellings. |
| W1.10 | STT resume attempts and root artifact paths could be rewritten incorrectly. | Resume preserves worker-owned attempt counts and existing artifact locations. |
| W1.11 | OCR resume could report full completion while a requested provider was missing. | Completion is inferred from requested-provider membership. |
| W1.12 | URL resume could retain stale batch state or return success for a failed run. | Child, parent, and aggregate completion state are synchronized. |
| W1.13 | OCR checkpoints dropped failure diagnostics. | Checkpoint and final manifests share the complete diagnostic projection. |
| W1.14 | TTS preflight conversion dropped setup-fee metadata. | Setup cost and estimate provenance are retained. |
| W1.15 | Several HTTP error paths discarded `Retry-After` headers. | Response headers survive error attachment. |
| W1.16 | Retry wrappers hid timeout identity and response headers. | Final wrappers expose both for retry classification. |
| W1.17 | Replicate diagnostics could retain unredacted provider payloads. | Stored payload previews are bounded and redacted. |
| W1.18 | Two contract suites could inherit real provider credentials. | Test lifecycles clear and restore credentials around each test. |
| W1.19 | TTS concat-list files survived ffmpeg failures. | Temporary concat files are removed on success and failure. |

### Consolidations completed

| Wave | Stable finding IDs | Historical result |
|---|---|---|
| W2 | BC-22, BC-45, BC-35 | Unified generation-resume registration, defaults round-trip tests, and retry-classifiable HTTP errors. |
| W3 | BC-40, BC-41, BC-38, BC-42, BC-23, BC-43, BC-4, BC-9, BC-14, BC-34, BC-31, BC-24 | Consolidated contract lifecycles, fetch recording, provider registries, STT assertions, URL finalization, report fixtures, hosted OCR runners, MiniMax transport, write requests, media rendering, estimate projection, and runtime-option forwarding. |
| W4 | BC-30, BC-13, BC-28, BC-8, BC-10, BC-2, BC-36, BC-19, BC-29, BC-21 | Established shared engines for media benchmarks, local LLMs, model pricing, polled jobs, media references, synchronous STT, provider REST clients, write resume, run traversal, and STT/OCR resume plumbing. |
| W5 | BC-1, BC-16, BC-44 | Moved async STT providers to the shared lifecycle, moved comic subcommands to the native parser, and unified budget-aware image/video/music test definitions. |
| W6 | BC-3, BC-18, BC-17 | Removed the second rendered-page OCR pipeline, shared the useful provider-batch state algebra, and made native flag occurrences the canonical parser representation. |

### Final decisions

The review preserved domain behavior where uniformity would have changed public contracts or provider safety. This includes provider-specific cleanup, local-model shutdown, media MIME handling, selected-only write resume, per-target media durations, OCR provider limits, provider identities, and established result ordering.

W6.2 intentionally stopped at shared provider-state algebra. A proposed universal codec engine was rejected because its policy hooks would have obscured domain behavior without producing a stronger abstraction. That rejected stage is closed and is not backlog.

Broader universal engines, richer scheduler merges, provider-target registries, and several small test or reporting extractions were also rejected or left as opportunistic maintenance because their complexity exceeded their value. Residual naming, error-taxonomy, timing, cue-width, and concurrency-policy differences were outside the approved program and are not represented here as unfinished work.

### Verification

Every completed wave passed `bun run check` and relevant local, no-cost contract tests. High-risk migrations also used focused differential or artifact-compatibility coverage. No paid or quota-limited provider command was run for verification.

The findings were originally produced by subsystem review and independently rechecked against source, tests, and the mechanical record in Part I. This final review reconciled every wave heading, superseded planning note, ruling, and rejected proposal into the completed dispositions above.
