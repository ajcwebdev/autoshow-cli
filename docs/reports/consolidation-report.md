# Consolidation Program Completion Report

Status: Completed

Completion date: 2026-08-10

## Outcome

The consolidation program is complete. Every approved consolidation item was implemented, folded into the canonical persistence cutover, or explicitly retired because the clean-break design removed the abstraction it would have created. There is no active backlog in this report.

The completed work reduced production ownership surfaces, replaced duplicated vocabularies with derived types and guards, consolidated exact test infrastructure, and strengthened independent contracts. The final text diff is slightly positive because the source reduction is accompanied by broader differential, integrity, containment, and no-legacy oracles.

## Completion matrix

| ID | Status | Completed outcome |
|---|---|---|
| `CC-M1` | Completed | Repeatable model flags now come from one ordered inventory, with the TypeScript union derived from that tuple and two-direction coverage proving uniqueness, order, and selectable-target completeness. |
| `CC-M2` | Completed | STT and OCR selection projections are derived from the step-2 registry. Routing, collectors, and input types share the same keys, including Gemini and Together STT. |
| `CC-M3` | Completed | Exact standard EPUB reader/container fixtures use one narrow helper while malformed, missing, encrypted, and custom-container cases retain raw fixture construction. |
| `CC-M4` | Completed with `LR-D1` | Canonical manifest command, completion-status, and traversal-safe relative-path vocabularies are shared by the sole persistence implementation. Old kind-, scope-, and envelope-specific vocabularies were removed rather than preserved. |
| `CC-M5` | Completed | Immediate-cleanup and suite-lifetime temporary-directory lifecycles now live in neutral test utilities. Only exact lifecycle copies were migrated, preserving tests with intentionally different lifetime semantics. |
| `CC-M6` | Completed | Cost sources and token-priced OCR providers each have one tuple, derived type, guard, and independent integrity contract. Schema, parsing, reporting, and pricing consumers use those vocabularies. |
| `CC-D1` | Completed | `ProcessingOptions` is a positive typed composition of bounded domain slices plus source XOR and `outputDir`. The internal schema mirror, negative forwarding allowlist, and boundary casts are gone. `step2SelectionOrigins` is preserved through projection, and a defaults/explicit/config/all-provider by URL/file differential contract pins values and downstream behavior. |
| Former `CC-D2` | Retired and folded into `LR-D1` | The sole unversioned manifest reader and atomic writer made a codec or manifest-kind registry unnecessary. No compatibility dispatch, per-version codec, or alternate persistence envelope remains. |
| `CC-D3` | Completed | Image, video, and music pricing and resume projections derive from bounded selection descriptors with two-direction contracts. TTS remains intentionally explicit because its differing field and output relationships did not satisfy the report's conditional consolidation clause. |
| `CC-D4` | Completed | Character-reference snapshot verification has one shared implementation covering containment, relative paths, checksum, schema version, and snapshot identity, with valid and adversarial contracts. |

## Canonical persistence outcome

The shared legacy and consolidation work now has one clean-break persistence model: one unversioned `manifest.json`, one reader, one serialized atomic writer, and one `command`/`scope`/`items` structure. Single and batch roots use the same item and provider-state algebra. Provider result artifacts are direct domain JSON, while canonical provider states own persisted identity, metadata, result, progress, and resume control.

Run, batch, extract-batch, checkpoint, provider-checkpoint, provider-result, version, and kind envelopes were removed. The implementation does not contain a compatibility reader, migration layer, codec registry, or command-, route-, scope-, batch-, or provider-specific manifest union. A tree-wide guard covers source and tests, benchmark fixtures, the consensus skill, README, ADR-002, and current command, diagram, test, and release documentation. Planning reports and unrelated domain schemas are outside that guard; the test runner's `.active-run.json` and one intentionally unsupported `source.json` CLI error fixture are explicit filename exemptions.

## Measured text diff

The completed source and test change against `HEAD` was measured with 20% rename detection:

| Scope | Added | Removed | Net |
|---|---:|---:|---:|
| `src/` | 3,722 | 4,114 | -392 |
| `test/` | 2,278 | 1,735 | +543 |
| Total | 6,000 | 5,849 | +151 |

Production source shrank by 392 lines. Added differential, two-direction, corruption, containment, and no-legacy coverage increased tests by 543 lines, yielding a total net addition of 151 lines. Documentation, benchmark data, consensus scripts and fixtures, and binary files are outside this text measurement. Rename detection removes matched relocation churn; the gross added and removed counts still include ordinary edit churn.

## Retained distinctions

- The canonical manifest owns persistence, not provider execution policy. Retry, cleanup, scheduling, result ordering, and completion decisions remain domain-owned.
- Selection descriptors own provider/model field relationships only. Request construction, capabilities, pricing formulas, cleanup, and paid-operation retry behavior remain outside them.
- TTS selection remains explicit; forcing it into the image/video/music descriptor shape would obscure real domain differences.
- External CLI, configuration, provider-response, and artifact validation boundaries remain intact. Only redundant validation of already normalized internal processing options was removed.
- Raw provider artifacts remain user-facing domain outputs. Canonical provider states are the sole persisted source for resume and async control state.
- Specialized test fixtures and lifecycle helpers remain where their behavior is intentionally different; only exact duplication was consolidated.

## Verification

| Verification | Result |
|---|---:|
| `bun run check` | Passed |
| CLI contracts | 208 passed, 0 failed, 5,251 assertions |
| Combined focused contracts | 124 passed, 0 failed, 948 assertions |
| Canonical manifest and guard contracts | 10 passed, 0 failed, 115 assertions |
| No-legacy persistence guard | 3 passed |

The canonical-manifest row is a focused subset/rerun of the combined contract set and is not additive to the 124-test total. The no-legacy guard is included in that canonical subset.

Additional focused local runs covered the repeatable-selection inventory, EPUB fixtures, pricing vocabularies, the 2,007-assertion processing-options differential, resume behavior, direct provider results, mocked REST providers, URL orchestration, OCR/STT recovery, model calibration, and consensus packet builders. These results are supporting evidence and are not added to the aggregate rows above.

No paid or quota-limited provider command, end-to-end suite, or full repository test runner was executed.

## Final state

All consolidation IDs are closed. The former proposal, sequencing, forecast, and active-backlog material has been removed. Any future consolidation work requires a new source-based reanalysis rather than reopening these completed items.
