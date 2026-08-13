# Docker

AutoShow ships a Debian slim local-lite Docker image recipe for users who want the CLI and common local tools without host setup. Pre-built multi-architecture images (`linux/amd64`, `linux/arm64`) are published to GitHub Container Registry (GHCR) on release tags.

The image uses `oven/bun:1.3.14-slim` and installs:

- `ffmpeg` and `ffprobe`
- `yt-dlp`
- Tesseract OCR with English language data
- MuPDF `mutool`
- `qpdf`
- Calibre `ebook-convert`

It does not include heavyweight local STT/LLM/TTS engines, model weights, Defuddle, or provider credentials.

## Pull or Build

To pull the published image from GHCR:

```bash
docker pull ghcr.io/ajcwebdev/autoshow-cli:latest
```

To build locally from source:

```bash
docker build -t autoshow-cli:local .
```

To override the Bun base image while keeping the same Debian package strategy:

```bash
docker build \
  --build-arg BUN_BASE_IMAGE=oven/bun:1.3.14-slim \
  -t autoshow-cli:local .
```

## Run

The Docker entrypoint is the CLI itself, so pass AutoShow arguments directly:

```bash
docker run --rm autoshow-cli:local --version
docker run --rm autoshow-cli:local help extract
```

### Recommended: an `autoshow` wrapper that mirrors the native CLI

The cleanest way to use the image is to run commands **exactly** the way you run native `bun autoshow`: from whatever directory your files live in, with relative or host-absolute paths beneath that directory, and output in `./output`.

The wrapper bind-mounts the current host directory at the identical absolute path inside the container and uses it as the container working directory. Relative paths, host-absolute paths beneath the current directory, paths containing spaces, absolute output paths beneath the current directory, and the default `./output` root therefore resolve just like they do locally, without argument rewriting or per-file mounts. The repo ships `scripts/autoshow-docker.sh`; add a shell function so it is available as `autoshow` from anywhere:

```sh
# ~/.zshrc (or ~/.bashrc)
autoshow() {
  local repo="${AUTOSHOW_REPO:-$HOME/c/autoshow-cli}"
  AUTOSHOW_ENV="${AUTOSHOW_ENV:-$repo/.env}" \
    "$repo/scripts/autoshow-docker.sh" "$@"
}
```

Now, from any project directory (for example one whose books live under `content/`):

```bash
autoshow extract content/book/book.epub
autoshow extract "$PWD/content/book/book.epub"
autoshow tts content/book/text/chapter-00.txt --provider grok
```

The file is read from your current directory exactly as written, and output is written to `./output` next to where you ran the command—identical to the native CLI. Only the current directory is mounted; for a source outside it, change to a common ancestor before invoking `autoshow`. `AUTOSHOW_ENV` points at the `.env` with your provider credentials (defaults to the autoshow-cli checkout); `AUTOSHOW_IMAGE` overrides the image tag.

On Linux, add `--user "$(id -u):$(id -g)"` to the wrapper so files written to `./output` are owned by you rather than the container's `bun` user.

### Advanced: explicit `/app/...` mounts

You can also mount input and output paths explicitly. The CLI resolves relative paths against the container workdir (`/app`), so an argument like `content/book/chapter.txt` is read from `/app/content/...`. If you mount `$PWD/content` to `/app/input`, address the file by its **in-container** path (`input/book/chapter.txt`)—passing `content/book/chapter.txt` looks under `/app/content`, where nothing is mounted, and fails (often as a misleading `Could not classify`/`Input does not exist` error). The `autoshow` wrapper above avoids this path-translation mismatch for files beneath the directory where it is invoked.

```bash
docker run --rm \
  -v "$PWD/content:/app/input:ro" \
  -v "$PWD/output:/app/output" \
  autoshow-cli:local extract input/book/book.epub
```

The default output root is `/app/output` because the container workdir is `/app`. You can still pass `--output-root /app/output/custom` when you need a different root.

## Provider Credentials

Hosted providers still require credentials (for example `tts --provider grok` needs `XAI_API_KEY`). Supply them one of three ways:

- `--env-file .env` — load a whole env file for the run.
- `-e KEY=value` — pass individual variables.
- mount the env file to `/app/.env` — Bun auto-loads `/app/.env` at startup, so every provider key in it is available without listing them:

```bash
docker run --rm \
  --env-file .env \
  -v "$PWD/input:/app/input:ro" \
  -v "$PWD/output:/app/output" \
  autoshow-cli:local write input/example.md --llm openai=gpt-5.5
```

When the `.env` lives in another directory (e.g. the autoshow-cli checkout), point at it explicitly:

```bash
docker run --rm \
  -v /path/to/autoshow-cli/.env:/app/.env:ro \
  -v "$PWD/content:/app/input:ro" \
  -v "$PWD/output:/app/output" \
  autoshow-cli:local tts input/book/text/chapter-00.txt --provider grok
```

Do not bake `.env` into the image. The default `.dockerignore` excludes it.

## Runtime Cache

The local-lite tools are baked into the image. A `runtime/` mount is optional and mainly useful if later commands fetch project-local assets:

```bash
docker run --rm \
  -v "$PWD/input:/app/input:ro" \
  -v "$PWD/output:/app/output" \
  -v "$PWD/runtime:/app/runtime" \
  autoshow-cli:local setup --doctor
```

The image runs as the non-root `bun` user. On Linux hosts, bind-mounted output or runtime directories must be writable by that user, or run with a matching host UID/GID:

```bash
docker run --rm \
  --user "$(id -u):$(id -g)" \
  -v "$PWD/input:/app/input:ro" \
  -v "$PWD/output:/app/output" \
  -v "$PWD/runtime:/app/runtime" \
  autoshow-cli:local --version
```

## Doctor Expectations

`setup --doctor` checks more than this image intentionally provides. The local-lite tools should resolve from `PATH`, including Calibre and Tesseract English data. Warnings for heavyweight local engines, model weights, Defuddle, or missing provider API keys are expected unless you mount or configure those assets separately.
