# setup

`setup --network-check serve|probe` runs a local delayed-response fixture or a bounded probe, separately from installation and doctor. It needs no provider credentials. Use `--probe-url http://host.docker.internal:8787 --probe-client rest --delay-seconds 150` to exercise the shared REST transport from Docker; `fetch` and `fetch-no-keepalive` are diagnostic controls. See [Docker-only network diagnostics](../../docker.md#docker-only-network-diagnostic) for readiness, loopback publishing, deadlines, and fixture cleanup.

Install local runtimes and prerequisite tools. Use `--models` to pre-download local STT models without running inference.

`--network-check` cannot be combined with `--models`, `--doctor`, `--strict`, `--step`, or `--force-redownload`. Its `--probe-url`, `--probe-client`, `--delay-seconds`, and `--port` controls require network-check mode. `--strict` requires `--doctor`. `--models` selects model download mode, `--doctor` selects diagnostics, and other invocations use installation mode; help groups these controls separately.

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
yt-dlp | defuddle | whisperfile | calibre | all | transcription | music
```

Isolated steps assume their prerequisites are already present. On a clean machine, prefer `bun autoshow setup`.

```bash
# yt-dlp, ffmpeg, and ffprobe
bun autoshow setup --step yt-dlp

# mutool, qpdf, and Calibre ebook-convert
bun autoshow setup --step calibre

# local URL article extraction
bun autoshow setup --step defuddle

# default whisperfile model (tiny)
bun autoshow setup --step whisperfile

# whisperfile tiny and transcription provider configuration
bun autoshow setup --step transcription

# lyric-video tools and whisperfile small.en
bun autoshow setup --step music
```

## Model Downloads

Ordinary setup (`setup`, `setup --step whisperfile`, or `setup --step transcription`) installs only whisperfile `tiny` for local STT. `setup --step music` installs `small.en` after checking the music prerequisites. Missing explicitly selected models can also download on demand during transcription.

Install the four recommended models explicitly with repeatable `--models` flags:

```bash
bun autoshow setup --models tiny --models tiny.en --models small --models whisperfile:small.en
```

Optional larger models remain supported and require explicit selection:

```bash
bun autoshow setup --models whisperfile:medium --models whisperfile:medium.en
bun autoshow setup --models whisperfile:large-v2 --models whisperfile:large-v3
```

Bare names and `whisperfile:<model>` are equivalent. `--models` downloads without inference; all selectors are validated before downloading. The removed `whisper:` prefix and `whisper-binary`/`whisper-model` setup steps are rejected.

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
