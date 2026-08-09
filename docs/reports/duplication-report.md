# Duplication Consolidation Archive

Date: 2026-08-09. Status: complete. All 48 approved mechanical consolidation waves landed on `staging`. No mechanical backlog remains in this report.

## Outcome and accounting

The program removed 5,139 net lines from `src/` and `test/`; documentation is excluded. The totals were re-audited from committed diffs. Wave 34 was corrected from 46 to 45 net lines, reducing the waves 1–35 subtotal from 4,645 to 4,644. The final-wave forecast was also corrected to remove overlap between O-3 and X-3.

| Implementation commit | Waves | Net lines removed |
|---|---:|---:|
| `70907228` | 1–5 | 1,482 |
| `90ae5109` | 6–14 | 1,792 |
| `4cee163d` | 15–27 | 838 |
| `2a468393` | 28–35 | 532 |
| `3035df9c` | 36–48 | 495 |
| Total | 1–48 | 5,139 |

## Consolidated areas

The 48 waves established shared primitives and removed repeated scaffolding across:

- CLI flag reading, rewriting, option selection, config merge, setup capture, project paths, and common types.
- Generation status, resume handling, provider polling, captions, media benchmarks, and pricing.
- Hosted and local STT request, polling, cleanup, health, startup, and runner lifecycles.
- Hosted OCR schemas, parsing, usage, pricing, guards, and partial-result handling.
- Hosted TTS contracts, chunk processing, audio concatenation, and custom-voice flows.
- URL transport, result finalization, retry scenarios, comic inputs, frontmatter rendering, and test fixtures.

## Historical behavior changes

Most waves preserved behavior. The material exceptions were:

- AssemblyAI and Gladia adopted consistent retry metadata and `Retry-After` interpretation.
- MiniMax multi-chunk audio moved to a single concat pass and the shared concat failure contract.
- Setup failures adopted common stages and messages.
- Partial OCR cache validation began rejecting nonnumeric confidence values, closing the former guard divergence.

Minor insertion-order and unused-field changes were accepted where they did not alter supported behavior.

## Closure review

The mechanical report originally handed several observations to the behavioral program. That work later resolved the substantive items involving OCR failure diagnostics, GLM Reader finalization, ElevenLabs response headers, write-resume errors, and related provider-state behavior. Other observations were confirmed as intentional differences, low-value inconsistencies, or outside the approved consolidation scope. They are not an active backlog in either archive.

Higher-risk work was completed separately and is recorded in `behavioral-consolidation-report.md`. Together, the two archives now contain only completed outcomes, accepted compatibility decisions, and rejected proposals.

## Verification and provenance

Each implementation batch passed `bun run check` and relevant local, no-cost contract tests. No paid or quota-limited provider command was used for verification. The final accounting uses committed source and test diffs rather than planning estimates.
