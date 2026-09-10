# setup

`setup --network-check serve|probe` runs a local delayed-response fixture or a bounded probe, separately from installation and doctor. It needs no provider credentials. Use `--probe-url http://host.docker.internal:8787 --probe-client rest --delay-seconds 150` to exercise the shared REST transport from Docker; `fetch` and `fetch-no-keepalive` are diagnostic controls. See [Docker-only network diagnostics](../../docker.md#docker-only-network-diagnostic) for readiness, loopback publishing, deadlines, and fixture cleanup.

Install local runtimes and prerequisite tools. Use `--models` to pre-download local STT models without running inference.

## Outline

- [Usage](#usage)
- [Disk and Network Requirements](#disk-and-network-requirements)
- [Doctor](#doctor)
- [Targeted Setup Steps](#targeted-setup-steps)
- [Model Downloads](#model-downloads)
- [Testing](#testing)

## Usage

```bash
bun autoshow setup
```

Use full setup on a clean machine so local download, OCR, STT, and write workflows have their prerequisites installed.

## Disk and Network Requirements

A full `bun autoshow setup` downloads several gigabytes and builds some tools from source. Budget roughly **10 GB free** and expect 5-10 minutes on a fast connection. A re-run with everything already installed takes a few seconds.

Installs live under `runtime/` in the project checkout (~3 GiB of binaries and local STT models). Interrupted downloads resume instead of restarting from zero.

## Doctor

Check prerequisites, configuration, and which provider API keys are set without installing anything:

```bash
bun autoshow setup --doctor
bun autoshow setup --doctor --strict
```

API-key checks are presence-only: doctor reports whether each managed variable is set, not whether the key is valid. Warnings do not change the default exit code. `--strict` exits 2 when a configured default needs a missing provider credential. Doctor does not make live provider calls. It reads `.env` from the working directory; exported environment variables win over file values.

Doctor also reports YouTube cookie configuration and whether a configured cookies file is readable. If YouTube starts challenging anonymous `yt-dlp` requests, configure cookies using [docs/cookies.md](../../cookies.md).

## Targeted Setup Steps

Valid `--step` values:

```text
yt-dlp | defuddle | whisper-binary | whisper-model | whisperfile | calibre | all | transcription | music
```

Isolated steps assume their prerequisites are already present. On a clean machine, prefer `bun autoshow setup`.

```bash
# yt-dlp, ffmpeg, and ffprobe
bun autoshow setup --step yt-dlp

# mutool, qpdf, and Calibre ebook-convert
bun autoshow setup --step calibre

# local URL article extraction
bun autoshow setup --step defuddle

# Whisper binary only
bun autoshow setup --step whisper-binary

# default Whisper model only
bun autoshow setup --step whisper-model

# default whisperfile model (tiny)
bun autoshow setup --step whisperfile

# Whisper large-v3-turbo
bun autoshow setup --step transcription

# lyric-video tools and Whisper large-v3-turbo
bun autoshow setup --step music
```

## Model Downloads

```bash
bun autoshow setup --models base
bun autoshow setup --models whisperfile:small
bun autoshow setup --models whisperfile:large-v3
```

`--models` downloads a Whisper or whisperfile model without running inference. Use the `whisperfile:` prefix for names that overlap with Whisper (`tiny`, `small`, `medium`). An optional `whisper:` prefix is also accepted.

Supported whisperfile models: `tiny`, `tiny.en`, `small`, `small.en`, `medium`, `medium.en`, `large-v2`, `large-v3`.

## Testing

The no-cost `test/test-cases/validation/cli/network-check-contracts.test.ts` covers option validation, readiness, all three clients, bounded failure, and fixture cleanup; `docker-workspace-invocation.test.ts` executes the documented shell function with fake Docker to verify literal arguments, mounts, Linux ownership, environment enforcement, image override, and failure propagation. A real 150-second Docker host-gateway fixture probe is separate container acceptance.

Coverage for the `setup` command, `--doctor`, progress output, and managed downloads.

Safety: this suite is local and no-cost. Downloads are mocked, so nothing here calls a paid or quota-limited provider.

### Quick Start

```bash
bun test test/test-cases/validation/setup/
```

### Price Preflight

Setup has no provider-priced commands, so `--price` and `--budget` do not estimate anything for this suite.

### Related Docs

- [Testing Overview](../testing.md)
