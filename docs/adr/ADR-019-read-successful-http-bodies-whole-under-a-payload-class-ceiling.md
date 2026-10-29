# ADR-019: Read Successful HTTP Bodies Whole Under a Payload-Class Ceiling

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-09-20
- **Date Updated:** 2026-10-28
- **Verification Status:** Passed

## Context

Successful provider responses were read through a diagnostic capture with a 16 MiB limit, so a larger response failed after the provider had accepted and billed the request. Inlined audiobook audio exposed this limit, and a per-call workaround for another provider had not prevented it. Diagnostic capture could also cancel a subprocess stream mid-read, turning a successful command into a failure because of its output volume.

Why now: a billed chunk failed on every attempt at the capture limit, and a one-off override had already failed to prevent the next provider from hitting the same wall.

## Options Considered

**Option 1 (selected)**

- **Option:** Read every successful body whole under a memory ceiling sized by payload class, with one environment override, and keep bounded capture only for diagnostics
- **Pros:** One policy for every body; a new provider inherits the ceiling; overflow names its size and is never retried; a paid result streams to disk with no ceiling
- **Cons:** A response up to the ceiling stays in memory while it is decoded
- **Quantitative Notes:** The `result` ceiling is 512 MiB

**Option 2**

- **Option:** Raise the shared capture default or add per-call overrides wherever a provider inlines media
- **Pros:** Smallest change
- **Cons:** The one-call override already showed the next provider fails the same way, and a truncated success body cannot be used
- **Quantitative Notes:** n/a

**Option 3**

- **Option:** Keep 16 MiB for plain JSON and let each media-capable client opt in to a larger class
- **Pros:** Tighter bound on bodies expected to be small
- **Cons:** A client cannot tell plain JSON from inlined media; the same clients serve chat and media, and transcripts with word timings grow with the audio
- **Quantitative Notes:** n/a

## Decision

A successful HTTP body is returned whole or rejected whole. The ceiling follows the payload class, and one environment variable overrides the in-memory ceilings or raises the source-download ceiling.

This applies to:

- `control` at 16 MiB for control-plane JSON such as status polls, catalogs, and metadata; `result` at 512 MiB, the default, for provider deliverables including media inlined as base64 or hex; `download` at 2 GiB for a download held in memory. A paid result written straight to disk is streamed and has no ceiling.
- `source` at 16 GiB for a user-supplied document, media, or reference URL streamed to disk. Its fetch also carries the 10-minute media download deadline, which ends the body read as well as the request. These limits bound source-download disk consumption.
- `AUTOSHOW_HTTP_PAYLOAD_MAX_BYTES`, a positive whole number of bytes that replaces every in-memory ceiling. For the disk-streamed `source` class it can only raise the ceiling, so a value sized for container memory does not lower the source-download budget. A malformed value is a usage error at startup, before any provider request.
- A `Content-Length` over the ceiling is rejected before the body is read, and a body that exceeds the ceiling while it is read is cancelled. The nonretryable validation error names the observed size, the ceiling, and the variable.
- Hosted TTS chunks whose inlined byte rate is fixed by the request are estimated before the first dispatch, so a lowered ceiling can reject the run before it is billed. Inworld WAV responses and ElevenLabs native dialogue MP3 batches are estimated; duration in the estimate is a heuristic. Providers whose byte rate the request does not fix are not estimated.
- Error bodies and subprocess output still use bounded diagnostic capture. Subprocess streams are drained to the end so output volume does not fail a successful command.

It does not apply to:

- Request bodies, uploads, and streaming protocols such as the Inworld WebSocket, which decode one message at a time.
- Reads of local files.
- The error kinds, exit codes, and retry vocabulary the oversize error uses ([ADR-005](ADR-005-cli-error-result-and-retry-contract.md)).
- The environment-variable surface policy that admits `AUTOSHOW_HTTP_PAYLOAD_MAX_BYTES` as a production override with no CLI equivalent ([ADR-004](ADR-004-setup-toolchain-and-runtime-configuration.md)).

## Rationale

- A truncated success body cannot be parsed, so that path can only turn a paid response into a failure.
- A ceiling that is too small has discarded paid results, so the default leaves headroom and stays overridable.
- A diagnostic capture exists to explain a result; a limit that fails a successful subprocess or hides the error it was collected to explain defeats that purpose.

## Consequences

Positive outcomes:

- Any provider can inline media up to 512 MiB without a per-call limit.
- A container can change the ceiling without a new release.
- A large media download is written to disk as it arrives, and a runaway source download stops at its ceiling or deadline.
- Subprocess logging cannot fail the subprocess.

Negative outcomes:

- One response up to the ceiling is resident while it is decoded, so a container memory limit has to allow for it.
- Pre-dispatch speech estimates use duration heuristics and, for Inworld, an assumed mono channel count; they cannot guarantee that the billed response will fit.
- An inline-audio provider without a pre-dispatch size estimate can be billed before an oversize body is rejected.
- A source larger than 16 GiB needs the override raised, and a source that cannot finish within 10 minutes fails and must be downloaded separately.

## Trade-offs

**Trade-off 1**

- **Gain:** New providers stay inside the policy with no extra configuration.
- **Sacrifice:** Small control JSON is allowed up to 512 MiB unless the call is classified as `control`.

**Trade-off 2**

- **Gain:** The amount a subprocess logs cannot fail it.
- **Sacrifice:** Capture no longer stops a runaway producer; command timeouts and abort signals are the bound.

## References

- Related ADR: [ADR-004](ADR-004-setup-toolchain-and-runtime-configuration.md)
- Related ADR: [ADR-005](ADR-005-cli-error-result-and-retry-contract.md)
- Related ADR: [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md)
- Related ADR: [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md)
- Payload policy: `src/utils/http-payload.ts`
- Diagnostic capture: `src/utils/bounded-capture.ts`
- Docker guidance: [Large provider responses](../docker.md#large-provider-responses)
