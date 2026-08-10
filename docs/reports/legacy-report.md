# Legacy Removal Completion Report

Status: Completed

Implementation date: 2026-08-10

## Outcome

The legacy-removal program is complete. Every approved mechanical removal and deep refactor landed, the pipeline now has one canonical manifest concept, and the catch-all runtime option architecture is gone. There is no active legacy-removal backlog from this program.

## Completion matrix

| ID | Category | Completed result |
|---|---|---|
| `LR-M1` | Mechanical | Deleted the dead hosted-target-count chain: the ignored concurrency input, target-count calculator, supporting type/context plumbing, call arguments, and now-unused imports. The live explicit, configured, `all-*`, and default concurrency behavior remains unchanged. |
| `LR-M2` | Mechanical | Removed the phantom double-dash argument from `buildOptsFromFlags` and all call sites. The real write-path passthrough remains at its actual ownership boundary. An AST/arity guard now rejects the obsolete call shape. |
| `LR-M3` | Mechanical | Removed production-unreachable and test-only helpers, facades, constants, types, exports, and their API-only tests after repository-wide reachability checks. Live behavior contracts were retained rather than preserving dead APIs for test count. |
| `LR-M4` | Mechanical | Removed no-op parameters, feedback payloads, and single-policy facades whose inputs could not affect output, while retaining the underlying retry, completion, parsing, media, and scheduling behavior. |
| `LR-M5` | Mechanical | Removed the setup benchmark's phantom `engine` field/column and the commented-out Repomix test include. Neither represented a live selectable behavior. |
| `LR-D1` | Deep | Replaced all pipeline, batch, extract, provider-result, and checkpoint manifest variants with one unversioned canonical `manifest.json`; deleted version/kind dispatch, compatibility readers, migration paths, old envelope types, route adapters, duplicate provider control state, and alternate manifest filenames. |
| `LR-D2` | Deep | Eliminated `RuntimeOptions` rather than renaming it. Consumers now accept composed domain slices or minimal generics, `ResolvedFlagContext` owns flag-building context, `WriteRuntimeOptions` exists only for the full write pipeline, broad casts are gone, and command-neutral option resolution lives under `src/cli/options/option-resolution/`. |

## Canonical manifest clean break

There is one manifest format and one filename: unversioned `manifest.json`. It is not a “v4 manifest,” and there is no manifest version or kind to validate, migrate, infer, or support for compatibility. Existing legacy run directories must be rerun.

The canonical record stores ordinary command, scope, source, item, child-link, metadata, and provider-state data. Direct provider `result.json` artifacts remain domain payloads only: they are non-authoritative for control state, cannot establish resume eligibility, and are never accepted as manifests. Async provider progress updates the matching canonical provider entry.

The retained safety boundary validates the sole current shape, checks relative-path containment, enforces parent-child identity and links, and serializes atomic item/provider updates. The no-legacy guard covers production code and tests, committed pipeline fixtures, expected-output inventories, the consensus skill, README, ADR-002, and current command, diagram, test, and release documentation. Planning reports and unrelated domain schemas are outside that scan; the test runner's `.active-run.json` and one intentionally unsupported `source.json` CLI error fixture are explicit filename exemptions. All 39 committed `docs/benchmarks/**/manifest.json` files use the canonical shape.

## Runtime option boundaries

STT, OCR, URL extraction, TTS, image, video, music, pricing, planning, preflight, expected-output, batch, and resume paths now request only their domain requirements. Shared fields are composed explicitly instead of flowing through an all-command bag. Positive typed projection replaced exclusion mirrors, and differential option contracts preserve defaults, configured and explicit origins, repeatable values, provider shortcuts, model selection, and concurrency behavior.

## Measured source and test change

The text diff against `HEAD`, measured across `src/` and `test/` with 20% rename detection, is:

| Scope | Added | Removed | Net |
|---|---:|---:|---:|
| `src/` | 3,722 | 4,114 | -392 |
| `test/` | 2,278 | 1,735 | +543 |
| Combined | 6,000 | 5,849 | +151 |

Production shrank by 392 lines while stronger canonical-shape, negative, differential, and source-guard coverage added 543 net test lines, producing an aggregate increase of 151 lines. Documentation, committed benchmark data, consensus scripts and fixtures, and binary assets are outside this measurement. Rename detection removes matched relocation churn; the gross added and removed counts still include ordinary edit churn.

## Verification record

- `bun run check`: passed.
- Safe CLI contract set: 208 passed, 0 failed, 5,251 assertions.
- Combined focused local/no-cost contracts: 124 passed, 0 failed, 948 assertions.
- Canonical-manifest plus no-legacy-guard subset: 10 passed, 0 failed, 115 assertions. This was a focused subset/rerun and is not added to the combined total above.
- The no-legacy persistence guard contributes 3 passing tests within that subset.

No paid-provider, quota-bearing, smoke/e2e, or full-suite execution was performed. `bun run t` and `bun test/test-runner.ts` were not run.

## Retained distinctions

- Domain-specific retry classification, polling cadence, remote-resource cleanup, and terminal-state policy remain live behavior; only dead wrappers and non-influential inputs were removed.
- Versioned schemas unrelated to pipeline persistence remain valid where they describe comic artifacts, reports, links, or test-runner records. They are not manifest compatibility paths.
- No provider model was retired, and no CoreML behavior was removed or changed.

## Final status

All `LR-M1` through `LR-M5`, `LR-D1`, and `LR-D2` work is complete. No proposed sequence, planning range, migration phase, compatibility tail, or active backlog remains.
