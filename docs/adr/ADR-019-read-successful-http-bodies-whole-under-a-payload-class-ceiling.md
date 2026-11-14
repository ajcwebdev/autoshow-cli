# ADR-019: Whole HTTP Bodies and Payload Ceilings

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-09-20
- **Date Updated:** 2026-11-14
- **Verification Status:** Passed

## Context

Diagnostic capture limits can discard already-billed provider results or fail successful subprocesses because of output volume. Payload reads and diagnostic capture need separate policies.

## Decision

Return successful HTTP bodies whole or reject them whole under a payload-class ceiling:

- `control`: 16 MiB for explicitly classified catalogs and metadata.
- `result`: 512 MiB, the default for deliverables and currently for status polls unless otherwise classified.
- `download`: 2 GiB for downloads held in memory.
- `source`: 16 GiB for user documents, media, and reference URLs streamed to disk, with a 10-minute deadline covering request and body reads.

Paid results streamed directly to disk have no payload ceiling. This policy excludes uploads, request bodies, local files, and message-oriented streaming protocols.

`AUTOSHOW_HTTP_PAYLOAD_MAX_BYTES` must be a positive whole byte count; malformed values fail at startup before provider dispatch. It replaces in-memory ceilings and can only raise the disk-streamed `source` ceiling. Callers may override class defaults with positive finite `maxBytes`; a valid environment override takes precedence, subject to the source exception.

Reject an excessive `Content-Length` before reading. Cancel a body that crosses its ceiling while reading. Oversize errors are nonretryable and name the observed size, ceiling, and override variable.

Before dispatch, estimate inline response sizes when request encoding fixes the byte rate: Inworld WAV, ElevenLabs native dialogue MP3, and non-streaming Gemini TTS. Duration and channel assumptions are heuristics, so a billed response may still exceed the estimate. Variable-rate requests without such estimates can also be billed before overflow is detected.

Bound only diagnostic error bodies and subprocess capture. Drain subprocess streams completely; setup retains a 4 MiB tail per stdout/stderr stream and reports omitted bytes. Timeouts and cancellation, rather than capture volume, stop runaway producers.

## Trade-offs

Shared defaults protect new integrations without per-provider fixes, but decoding can hold a full response up to its ceiling in memory. Containers must allow for that memory or lower the override. Larger or slower sources require a raised ceiling or separate download.

## Verification

```bash
bun test test/test-cases/validation/runtime-contracts/http-payload-contracts.test.ts test/test-cases/validation/providers/provider-inline-media-payload-contracts.test.ts test/test-cases/validation/setup/setup-progress-contracts.test.ts
```

Local fixtures cover size enforcement, overrides, pre-dispatch rejection, and bounded diagnostics; they cannot guarantee actual provider response sizes.

## References

- `src/utils/http-payload.ts`, `src/utils/bounded-capture.ts`
- [Docker memory guidance](../docker.md#large-provider-responses)
- [ADR-005: Errors and retries](ADR-005-cli-error-result-and-retry-contract.md)
