# ADR-002: Pipeline State, Resume, and Dry-Run Planning

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-12
- **Date Updated:** 2026-11-14
- **Verification Status:** Pending

## Context

Execution, recovery, and cost planning need one authority for attempted work. Provider settings must remain inspectable without changing the identity of purchased artifacts.

## Decision

### Canonical manifest and planning

Each output root has one current, unversioned `manifest.json` recording ordered work, routes, outputs, statuses, and provider progress. Mixed-route batches link child manifests; pooled OCR page state lives in the canonical item. Raw responses and artifacts support validation but do not replace this authority. Reject missing, invalid, or superseded manifests before provider work; incompatible formats require a new run without deleting retained evidence.

### Resume

`resume` covers extract STT/OCR/URL, write, TTS, image, video, music, and recorded single-scene comic work. `resume --price` selects and estimates the same remaining work without provider calls, polling, or output mutation. Missing size, duration, or page counts may require configuration/default estimates.

Execution and resume share the current provider inventory through `--provider provider[=model]`, `--all-providers`, and extract's `--all-local`. Reject provider-prefixed or unknown flags and cross-route recovery. X Spaces cannot resume. Extract and generation may recover missing/failed targets or add selections; write runs only explicitly selected providers. Standalone/extract recovery uses the requested or configured concurrency mode; [comic recovery](ADR-013-comic-scene-audio-and-presentation.md#recorded-comic-recovery-through-resume) restores recorded options.

Completed TTS may add model targets without repurchasing existing audio. Compatible canonical runs created before delivery mastering adopt retained chunking and legacy 16 kHz delivery when chunking/mastering flags are not explicit; mismatches fail before spending. Incompatible pre-canonical directories require a new run. [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md) owns paid-slot and audio compatibility.

### Provider settings

Optional versioned `providers[].settings` record effective request controls, local output options, and ignored flags outside purchased-work identity hashes. Use project-relative paths, redact secret-like values, and hash lexicons and prompt files. Free-text instructions and preview text remain verbatim. Preserve untouched targets' records and refresh targets that execute; failed targets may lack resolved request details.

Restore retained TTS chunking, mastering, exports, pronunciation, speaker/dialogue mappings, Gemini/Soniox controls, and write prompt selections/hashes. Available settings may reject incompatible STT profiles, Gemini controls, or prompts. Matching settings never prove completion or reuse: provider state, request identity, artifact validation, and domain compatibility are still required. Older compatible runs may lack settings; image/video/music restoration and some content hashes remain incomplete.

### Remote Gemini TTS jobs

The manifest links `providerJobs.path` to `gemini-provider-jobs.json`, which records account scope, request fingerprints, submission state, job IDs, slot checksums, and delivery options. Validate this ledger and reconcile retained audio and known jobs before submitting missing work. It supports manifest-directed recovery rather than inferred completion.

`--provider-job-action status|wait|cancel` inspects, waits/collects, or explicitly cancels recorded jobs; default `wait`. Local interruption preserves records and does not cancel accepted remote work. `--allow-ambiguous-redispatch` permits a later potentially billed attempt for unresolved admission under [ADR-005](ADR-005-cli-error-result-and-retry-contract.md); preserve completed audio and evidence.

## Trade-offs

One manifest and no compatibility migrations reduce competing state but make incompatible runs non-resumable. Separate settings preserve paid identity while requiring domain-specific restoration and validation. Every recovery workflow must maintain a non-mutating price plan alongside execution.

## Verification

```bash
bun test test/test-cases/validation/resume-manifests/canonical-manifest-contracts.test.ts test/test-cases/validation/resume-manifests/documented-resume-workflows.test.ts
bun test test/test-cases/validation/resume-manifests/resume-provider-flag-surface-contracts.test.ts
bun test test/test-cases/validation/audio/tts/tts-resolved-chunk-plan.test.ts test/test-cases/validation/audio/tts/tts-provider-settings-record.test.ts
```

Local contracts cover manifest rejection, selectors, non-mutating planning, retained chunk plans, and sanitized settings. Verification remains Pending for the restoration and hashing gaps below.

## Follow-up Actions

- [ ] Restore remaining image, video, and music controls from saved settings — Pending
- [ ] Hash path-only music lyrics, image/video reference media, and TTS cover art — Pending

## References

- [Resume guide](../commands/00-setup-and-utilities/resume.md)
- [Source routing](ADR-001-source-ingestion-and-normalization.md) and [pooled OCR](ADR-008-ocr-execution-pooling-and-artifacts.md)
- `src/cli/commands/command-shared/pipeline-manifest/`
- `src/cli/commands/setup-and-utilities/resume/`
- `src/cli/commands/audio/tts/tts-services/tts-gemini/gemini-tts-batch-jobs.ts`
