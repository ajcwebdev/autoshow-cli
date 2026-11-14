# ADR-005: CLI Errors, Results, and Retries

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-13
- **Date Updated:** 2026-11-14
- **Verification Status:** Passed

## Context

Scripts need stable errors and one machine-readable result. Paid requests need explicit retry ownership so ambiguous outcomes cannot silently produce duplicate charges.

## Decision

### Errors and output

Production throws use `AppError` and its typed subclasses, with kinds `usage`, `provider_http`, `retry_exhausted`, `validation`, `infrastructure`, or `internal`. Record `stage` and structured remediation `hints`; classify by fields rather than message wording. Usage and missing credentials exit 2; other errors default to 1. Explicit command overrides include incomplete provider batches at 2 and required-image-model violations at 64.

Text mode emits one physical line per diagnostic event, using stderr when stdout is piped. `--json` emits versioned diagnostics on stderr and exactly one terminal result on stdout, including help/version, parse errors, quiet mode, and fatal exceptions/rejections. Sanitize generic fatal payloads. A failure replaces prepared success; missing or duplicate terminal results are internal errors. `--json=false` and `--no-json` select text mode, which emits no JSON envelope. Help, version, and `metadata --markdown` may write text documents to stdout; `metadata --markdown` rejects `--json`. Tables and `--log-format` are unsupported.

JSON logs contain `schemaVersion: 1`, `type: "log"`, timestamp, run ID, level, category, message, and applicable command/step/context/metadata/error fields. Results contain `schemaVersion: 1`, `type: "result"`, timestamp, run ID, status, exit code, duration, message, and applicable command/data/error/hints fields. Diagnostic-level controls never suppress a terminal result; consumers use structured fields rather than message text.

### Compact result artifacts

`--json --result-file <new-path>` saves the complete sanitized envelope and emits one summary of at most 8 KiB with `resultMode: "summary"`, bounded keys/counts/error previews, and `artifact: { path, bytes, sha256 }`. Exact nested data and prices remain in the artifact; consumers should verify it across storage/process boundaries.

Create the private artifact before dispatch, reject existing files/symlinks, use `0700` for new parents and `0600` for the file, and fail if writing cannot succeed. Reject raw payload bypasses, including isolated workflows. The flag requires JSON and authorizes no provider work; result artifacts are disposable projections, not resume authority.

### Retry ownership

Each provider call has one retry policy. Retry a paid create only after HTTP 425/429 or a structured rejected-and-retryable admission verdict. Explicit non-retryable, billing, quota, deterministic, exhausted-retry, or exhausted-poll failures are terminal. Wording such as “rate limit” cannot authorize redispatch; timeouts, network loss, and unknown paid outcomes stop automatically.

Replay-safe uploads and reads of accepted results may retry transient failures. Honor provider delay up to five minutes. Lane recovery under [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md) cannot re-authorize duplicate spend. Persisted TTS/comic audio requires reconciliation or a later `--allow-ambiguous-redispatch` invocation before potentially repurchasing unresolved work; preserve evidence and completed audio under [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md).

## Trade-offs

Structured errors and one JSON result simplify automation but require vocabulary enforcement. Conservative paid retries sacrifice automatic recovery from ambiguous transient failures to avoid unapproved duplicate spend. Compact output bounds stdout while requiring artifact access for complete results.

## Verification

```bash
bun test test/test-cases/validation/runtime-contracts/app-error-contracts.test.ts test/test-cases/validation/runtime-contracts/output-vocabulary-contracts.test.ts
bun test test/test-cases/validation/runtime-contracts/retry-create-admission-contracts.test.ts test/test-cases/validation/runtime-contracts/retry-hosted-tts-redispatch-contracts.test.ts
bun test test/test-cases/validation/cli/json-output-contracts.test.ts test/test-cases/validation/cli/result-artifact-contracts.test.ts test/test-cases/validation/cli/fatal-json-result-contracts.test.ts
```

Verify exit codes, sanitized single-result output, artifact bounds/checksums/permissions, overwrite rejection, and allowed versus ambiguous redispatch through local/mocked execution.

## References

- [Payload limits](ADR-019-read-successful-http-bodies-whole-under-a-payload-class-ceiling.md)
- `src/utils/error-handler.ts`
- `src/utils/app-logger/result-emitter.ts`
- `src/utils/retry-classification.ts`
