# ADR-027: Read Successful HTTP Bodies Whole Under a Payload-Class Ceiling

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-09-20
- **Date Updated:** 2026-09-22
- **Verification Status:** Passed

## Context

Successful JSON responses were read with a diagnostic capture whose HTTP limit was 16 MiB. Past that limit the run failed after the provider had accepted the request and billed it.

An Inworld audiobook run in a container hit the limit. Inworld returns 48 kHz 16-bit WAV as base64 inside JSON, about 128,000 JSON bytes per second of audio, so 16 MiB covers about 131 seconds. A full 2000-character chunk lasts about that long, so a chunk near the character limit failed on every attempt, and resuming purchased the same chunk again. MiniMax music had already failed on hex audio and was given a one-call override of 64 MiB.

That limit applied to the shared provider clients. Other HTTP calls had no size policy. A separate 64 MiB cap cancelled a stream while reading it, so a subprocess that was succeeding could exit with an error after writing a large stderr.

Why now: a billed Inworld chunk failed on every attempt at the 16 MiB capture limit, and a one-off larger limit for MiniMax had already failed to prevent the next provider from hitting the same wall.

## Options Considered

**Option 1 (selected)**

- **Option:** Read every successful body whole under a memory ceiling sized by payload class, with one environment override. Keep bounded capture for diagnostics, where overflow is reported and does not fail the run.
- **Pros:** One policy for every body. A new provider inherits the generous ceiling. Overflow names its size and is never retried. A file download streams to disk with no ceiling.
- **Cons:** A response up to the ceiling stays in memory while it is decoded.
- **Quantitative Notes:** The `result` ceiling is 512 MiB. A full Inworld chunk is about 17 to 25 MiB.

**Option 2**

- **Option:** Raise the shared capture default, or add a per-call override wherever a provider inlines media.
- **Pros:** Smallest change.
- **Cons:** Rejected; the MiniMax override did this, and the next provider failed the same way. A truncated success body cannot be used.
- **Quantitative Notes:** n/a

**Option 3**

- **Option:** Keep 16 MiB for plain JSON and let each media-capable client opt in to a larger class.
- **Pros:** Tighter bound on bodies expected to be small.
- **Cons:** Rejected; a client cannot tell plain JSON from inlined media. The same clients serve chat and media, some management responses include preview audio, and transcripts with word timings grow with the audio.
- **Quantitative Notes:** n/a

## Decision

A successful HTTP body is returned whole or rejected whole. The ceiling follows the payload class, and one environment variable replaces every ceiling.

This applies to:

- `control` at 16 MiB for control-plane JSON such as status polls, catalogs, and metadata. `result` at 512 MiB, the default, for provider deliverables, including media inlined as base64 or hex. `download` at 2 GiB for a download held in memory. A download written straight to disk is streamed, holds nothing in memory, and has no ceiling.
- `AUTOSHOW_HTTP_PAYLOAD_MAX_BYTES`, a positive whole number of bytes. A malformed value is a usage error at startup, before any provider request. Setup and network-probe child processes receive the variable.
- A `Content-Length` over the ceiling, which is rejected before the body is read. A body that exceeds the ceiling while it is read is cancelled. The error is `validation`, with `retryable: false`, and names the observed size, the ceiling, and the variable.
- Hosted TTS chunks whose inlined byte rate is fixed by the request. Each chunk is estimated before the first dispatch, so a lowered ceiling can reject the run before it is billed. Inworld declares the estimate for its WAV responses. ElevenLabs native dialogue applies it to every batch for the verified 128 kbps and 192 kbps MP3 formats. Duration in the estimate is a heuristic. Providers whose byte rate the request does not fix, including Speechify, are not estimated.
- Error bodies and subprocess output, which still use bounded capture. A subprocess stream is read to the end. An HTTP error body stops after 64 MiB and the capture reports that it was truncated.

It does not apply to:

- Request bodies, uploads, and streaming protocols such as the Inworld WebSocket, which decode one message at a time.
- Reads of local files.

## Rationale

- A truncated success body cannot be parsed, so that path can only turn a paid response into a failure.
- A ceiling that is too small has failed twice, and each failure costs money. A ceiling that is too large risks memory pressure from a misbehaving endpoint, which has not occurred. The default follows that difference.
- A diagnostic capture exists to explain a result. A limit that fails a successful subprocess, or that hides the HTTP error it was collected to explain, defeats that purpose.
- A per-client opt-in covers only the providers known today. The default has to cover the next one.

## Consequences

Positive outcomes:

- Any provider can inline media up to 512 MiB without a per-call limit.
- A container can change the ceiling without a new release.
- A large media download is written to disk as it arrives.
- Subprocess logging cannot fail the subprocess.

Negative outcomes:

- One response up to the ceiling is resident while it is decoded, so a container memory limit has to allow for it.
- Inworld does not document channel count. The pre-dispatch estimate assumes mono and uses the slow-speech rate of 8 characters per second as margin.
- An inline-audio provider that is not estimated, including Speechify, can be billed before an oversize body is rejected.

## Trade-offs

**Trade-off 1**

- **Gain:** New providers stay inside the policy with no extra configuration.
- **Sacrifice:** Small control JSON is allowed up to 512 MiB unless the call is classified as `control`.

**Trade-off 2**

- **Gain:** The amount a subprocess logs cannot fail it.
- **Sacrifice:** Capture no longer stops a runaway producer. Command timeouts and abort signals are the bound.

## Implementation Note

Shipped in `src/utils/http-payload.ts`.

## References

- Related ADR: [ADR-005](ADR-005-reduce-environment-variable-surface-area.md)
- Related ADR: [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md)
- Related ADR: [ADR-025](ADR-025-master-tts-delivery-audio-outside-paid-slot-identity.md)
- `src/utils/http-payload.ts`
- Docker guidance: [Large provider responses](../docker.md#large-provider-responses)
- Inworld synthesize-speech reference: `audioConfig.audioEncoding` value `WAV` is uncompressed 16-bit signed little-endian samples, and the default `sampleRateHertz` is 48000
