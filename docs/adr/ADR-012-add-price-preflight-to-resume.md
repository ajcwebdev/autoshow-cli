# ADR-012: Add Price Preflight to Resume

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-13
- **Date Updated:** 2026-07-25
- **Verification Status:** Passed

## Context

`resume` can backfill missing provider outputs in existing extract, write, TTS, image, video, and music runs. It accepts the same provider-selection surface as execution — `--provider provider[=model]`, `--all-providers`, `--all-local` — so a resume command can initiate paid or quota-limited provider calls. It accepts only the provider-neutral subset of the option surface; provider-named option flags are not part of it.

Before this change, `resume --price` failed before dispatch with `Unexpected flag: price` because `resume-flags.ts` stripped `price` from every routed command flag set, and the resume docs explicitly stated that `resume` did not define `--price`. That prevented users from estimating the cost of additive resume runs, including multi-directory OCR backfills that add new hosted models to historical benchmark outputs.

Why now: users need to estimate the cost of resuming existing OCR benchmark runs with new OpenAI and Anthropic models before making paid provider calls.

## Options Considered

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **Add `--price` support to all resume target types** | Makes resume cost preflight consistent across extract, write, and generation resumes; avoids surprising paid runs; fixes the immediate OCR benchmark workflow | Requires target-aware estimate planning for several resume handlers | Covers 6 resume kinds: extract, write, TTS, image, video, music |
| Add `--price` only for OCR resume | Smallest implementation; fixes the immediate benchmark command | Leaves inconsistent CLI behavior and future paid resume gaps | Covers 1 extract route |
| Keep rejecting `resume --price` | Preserves current behavior and implementation simplicity | Users must estimate manually or risk paid provider calls | No implementation work |

## Decision

Add `--price` as a supported flag for `resume`, and make it a dry-run cost preflight for the providers that the same resume command would attempt.

This applies to:

- Top-level `bun autoshow resume ... --price`.
- Extract resume routes: STT, OCR, and URL article extraction.
- Write LLM resume.
- Standalone TTS, image, video, and music resume.
- Explicit provider selections and additive resume behavior.

It does not apply to:

- Running provider calls during price mode.
- Mutating the canonical `manifest.json` or raw provider artifacts during price mode.
- Changing existing execution behavior when `--price` is omitted.

## API / Type Impact

- `resume` accepts `--price` as a boolean flag.
- The shared price/preflight option slice becomes meaningful for resume dispatch.
- Price-mode resume exits after reporting estimates and before invoking provider runners.
- Unsupported or insufficiently resumable manifests should produce usage errors rather than silently estimating the wrong work.
- `resume` declares no flag named after a provider. Provider-named option flags exit at argv-parse time with `Unexpected flag: <name>`, the same path that already rejects removed pipeline-prefixed aliases on `image`, `video`, and `music`.
- Resume composes command-specific STT, OCR, URL, LLM, TTS, image, video, or music options plus named shared price and concurrency controls. Provider-named knobs remain outside resume's CLI surface; when a domain cannot reconstruct a tuning value from the canonical provider entry, its option slice resolves that value from `autoshow.config` or the provider default after config merging.

## Rationale

- Resume can spend provider credits, so it should support the same no-cost preflight pattern as `extract`, `write`, and generation commands.
- Estimates must be resume-aware: they should include only missing, failed, or newly selected additive providers, not providers that are already complete.
- Full resume coverage avoids a fragmented rule where `--price` works for OCR but fails for other paid resume workflows.
- Reusing existing pricing utilities keeps registry pricing, timing estimates, and human estimate tables consistent with normal command preflight.

## Consequences

Positive outcomes:

- Users can price-check multi-directory resume commands before any paid provider call.
- The OCR benchmark backfill workflow can estimate the three new GPT models and Claude Fable 5 across historical runs.
- Resume CLI behavior becomes consistent with the rest of the paid-provider surface.

Negative outcomes:

- Resume handlers need a dry-run planning path in addition to execution.
- Some estimates will remain heuristic when canonical item/provider metadata does not contain exact source size, duration, prompt, or page-count evidence.
- Tests that asserted `resume --price` was rejected were replaced with dry-run estimate contracts.
- The canonical provider `options` object is the only persisted slot for provider options. Any provider-specific tuning value a resume domain cannot reconstruct from that entry falls back to `autoshow.config` or the provider default, and execution and `--price` use the same resolved value.

## Trade-offs

| Gains | Sacrifices |
|---|---|
| Safer paid resume workflow | More resume handler complexity |
| Consistent `--price` CLI surface | Additional tests and docs to maintain |
| Resume-aware additive estimates | Some manifest-dependent estimation fallbacks |

## Implementation Note

| Action | Owner | Current State |
|---|---|---|
| Add `priceFlag` to `resumeFlags` instead of omitting `price` from resume support | CLI maintainers | Implemented |
| Add a shared resume price-planning path that resolves the same targets execution would run | CLI maintainers | Implemented |
| Implement extract resume estimates for STT, OCR, and URL routes without provider calls | Extract maintainers | Implemented |
| Implement write resume estimates for selected missing LLM targets using stored `prompt.md`/prompt metadata | Write maintainers | Implemented |
| Implement generation resume estimates for TTS, image, video, and music using canonical item input plus selected missing/failed provider entries | Generation maintainers | Implemented |
| Ensure `--price` does not write manifests or artifacts and exits before provider execution | CLI maintainers | Implemented |
| Update resume docs to document `--price` and remove the "does not define `--price`" note | Docs maintainers | Implemented |
| Replace tests expecting `resume --price` rejection with dry-run estimate contracts | Test maintainers | Implemented |
| Rebuild `resumeFlags` as `pickFlags` allow-lists reusing the option-name constants already exported by `tts-flags.ts`, `image-flags.ts`, and `video-flags.ts`, so new provider flags cannot leak into resume | CLI maintainers | Implemented |
| Remove the 37 provider-named option flags resume inherited by `omitFlags` deny-list: 23 TTS tuning flags, 7 `--replicate-video-*`, 2 `--grok-video-storage-*`, `--gemini-search-grounding`, and 4 `--stt-*` provider params plus their 4 hidden legacy aliases | CLI maintainers | Implemented |
| Delete the resume-only aggregates `sttFlags` (`src/cli/flags/stt-flags.ts`) and `ocrCommandFlags`, which existed only to be stripped back down by resume | CLI maintainers | Implemented |
| Keep `--image-*`/`--video-*`/`--music-*` prefixes on resume instead of the short standalone-command names, since one resume flag set serves image, video, music, and OCR and the short names collide | CLI maintainers | Implemented |

## Test Plan

- `bun run check`
- `bun test test/test-cases/validation/cli/cli-help-contracts.test.ts`
- `bun test test/test-cases/validation/cli/cli-usage-errors.test.ts`
- `bun test test/test-cases/validation/cli/option-resolution-contracts/`
- `bun test test/test-cases/validation/reports-pricing/price-mode-contracts/`
- Add targeted resume price-mode tests proving:
  - `resume --price` is accepted and emits estimates.
  - OCR resume estimates only selected missing/additive providers.
  - Multi-directory resume reports per-directory estimates and a suite total.
  - Existing manifests are not modified in price mode.
  - Provider runner functions are not invoked in price mode.
- Add resume flag-surface contracts proving:
  - `resumeFlags` contains every provider-neutral option name exported by the shared and per-step flag modules.
  - `resumeFlags` contains none of the removed provider-named flags.
  - No `resumeFlags` key starts with any provider name derivable from `EXTRACT_PUBLIC_SELECTOR_FLAGS`, `WRITE_LLM_PROVIDER_TARGETS`, or the four `STANDALONE_*_PROVIDER_TARGETS` registries.
  - `resume` exits `2` with `Unexpected flag: <camelCaseName>` for a representative removed flag from each group.

Do not run paid provider, smoke, or e2e tests that can call third-party APIs.

## References

- `docs/adr/ADR-009-unify-ocr-extraction-architecture-and-reliability-guardrails.md`
- `docs/adr/ADR-011-refresh-current-hosted-llm-and-ocr-models.md`
- `docs/commands/setup-and-utilities/resume/resume.md`
- `src/cli/flags/resume-flags.ts`
- `src/cli/flags/shared-flags.ts`
- `src/cli/flags/tts-flags.ts`
- `src/cli/commands/setup-and-utilities/resume/resume-dispatch.ts`
- `src/cli/commands/setup-and-utilities/resume/extract/ocr-resume.ts`
- `src/cli/commands/setup-and-utilities/config/config-merge.ts`
- `src/utils/pricing/aggregate-pricing.ts`
- `test/test-cases/validation/resume-manifests/resume-provider-surface-contracts.test.ts`
