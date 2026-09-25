# ADR-019: Read Successful HTTP Bodies Whole Under a Payload-Class Ceiling

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-09-20
- **Date Updated:** 2026-09-22
- **Verification Status:** Passed

## Context

Successful provider responses were read through a diagnostic capture with a 16 MiB limit, so a response past that size failed after the provider had accepted and billed the request. An Inworld audiobook chunk hit it, because Inworld inlines 48 kHz WAV as base64 inside JSON and a full chunk exceeds 16 MiB, and every resume purchased the same chunk again. MiniMax music had already failed on hex audio and received a one-call override, which did nothing for the next provider. A separate capture limit could also cancel a subprocess stream mid-read, so a succeeding subprocess could exit with an error after writing a large stderr.

Why now: a billed chunk failed on every attempt at the capture limit, and a one-off override had already failed to prevent the next provider from hitting the same wall.

## Options Considered

**Option 1 (selected)**

- **Option:** Read every successful body whole under a memory ceiling sized by payload class, with one environment override, and keep bounded capture only for diagnostics
- **Pros:** One policy for every body; a new provider inherits the ceiling; overflow names its size and is never retried; a file download streams to disk with no ceiling
- **Cons:** A response up to the ceiling stays in memory while it is decoded
- **Quantitative Notes:** The `result` ceiling is 512 MiB

**Option 2**

- **Option:** Raise the shared capture default or add per-call overrides wherever a provider inlines media
- **Pros:** Smallest change
- **Cons:** The one-call override already showed the next provider fails the same way, and a truncated success body cannot be used
- **Quantitative Notes:** Rejected

**Option 3**

- **Option:** Keep 16 MiB for plain JSON and let each media-capable client opt in to a larger class
- **Pros:** Tighter bound on bodies expected to be small
- **Cons:** A client cannot tell plain JSON from inlined media; the same clients serve chat and media, and transcripts with word timings grow with the audio
- **Quantitative Notes:** Rejected

## Decision

A successful HTTP body is returned whole or rejected whole. The ceiling follows the payload class, and one environment variable replaces every ceiling.

This applies to:

- `control` at 16 MiB for control-plane JSON such as status polls, catalogs, and metadata; `result` at 512 MiB, the default, for provider deliverables including media inlined as base64 or hex; `download` at 2 GiB for a download held in memory. A download written straight to disk is streamed and has no ceiling.
- `AUTOSHOW_HTTP_PAYLOAD_MAX_BYTES`, a positive whole number of bytes that replaces every ceiling. A malformed value is a usage error at startup, before any provider request. Setup and network-probe child processes receive the variable.
- A `Content-Length` over the ceiling is rejected before the body is read, and a body that exceeds the ceiling while it is read is cancelled. The error is `validation` with `retryable: false`, and it names the observed size, the ceiling, and the variable.
- Hosted TTS chunks whose inlined byte rate is fixed by the request are estimated before the first dispatch, so a lowered ceiling can reject the run before it is billed. Inworld WAV responses and ElevenLabs native dialogue MP3 batches are estimated; duration in the estimate is a heuristic. Providers whose byte rate the request does not fix are not estimated.
- Error bodies and subprocess output still use bounded capture. A subprocess stream is read to the end. An HTTP error body stops after 64 MiB and the capture reports that it was truncated.

It does not apply to:

- Request bodies, uploads, and streaming protocols such as the Inworld WebSocket, which decode one message at a time.
- Reads of local files.
- The error kinds, exit codes, and retry vocabulary the oversize error uses ([ADR-005](ADR-005-cli-error-result-and-retry-contract.md)).
- The environment-variable surface policy that admits `AUTOSHOW_HTTP_PAYLOAD_MAX_BYTES` as a production override with no CLI equivalent ([ADR-004](ADR-004-setup-toolchain-and-runtime-configuration.md)).

## Rationale

- A truncated success body cannot be parsed, so that path can only turn a paid response into a failure.
- A ceiling that is too small has failed twice at real cost, while memory pressure from a misbehaving endpoint has not occurred, so the default errs large and stays overridable.
- A diagnostic capture exists to explain a result; a limit that fails a successful subprocess or hides the error it was collected to explain defeats that purpose.

## Consequences

Positive outcomes:

- Any provider can inline media up to 512 MiB without a per-call limit.
- A container can change the ceiling without a new release.
- A large media download is written to disk as it arrives.
- Subprocess logging cannot fail the subprocess.

Negative outcomes:

- One response up to the ceiling is resident while it is decoded, so a container memory limit has to allow for it.
- The Inworld estimate assumes mono and a slow-speech margin because the channel count is undocumented.
- An inline-audio provider without a pre-dispatch size estimate can be billed before an oversize body is rejected.

## Trade-offs

**Trade-off 1**

- **Gain:** New providers stay inside the policy with no extra configuration.
- **Sacrifice:** Small control JSON is allowed up to 512 MiB unless the call is classified as `control`.

**Trade-off 2**

- **Gain:** The amount a subprocess logs cannot fail it.
- **Sacrifice:** Capture no longer stops a runaway producer; command timeouts and abort signals are the bound.

## Implementation Note

The payload classes, the environment override, and the pre-dispatch TTS estimate have shipped in the shared HTTP client every provider adapter and download uses. Container guidance is in the Docker guide under [Large provider responses](../docker.md#large-provider-responses).

## References

- Related ADR: [ADR-004](ADR-004-setup-toolchain-and-runtime-configuration.md)
- Related ADR: [ADR-005](ADR-005-cli-error-result-and-retry-contract.md)
- Related ADR: [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md)
- Related ADR: [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md)
- Docker guidance: [Large provider responses](../docker.md#large-provider-responses)
