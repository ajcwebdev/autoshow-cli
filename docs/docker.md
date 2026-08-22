# Docker

AutoShow ships a Debian slim local-lite Docker image recipe for users who want the CLI and common local tools without host setup. Pre-built multi-architecture images (`linux/amd64`, `linux/arm64`) are published to GitHub Container Registry (GHCR) on every push to `main`, tagged `latest` and by full commit SHA, by a workflow of plain `git`, `apt`, and `docker` commands (no third-party GitHub Actions) that keeps its Buildx layer cache in a GHCR `:buildcache` registry image.

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

Use one of the two supported command surfaces directly:

```bash
# Native checkout
bun autoshow --version
bun autoshow extract content/book/book.epub

# Docker image
docker run --rm autoshow-cli:local --version
docker run --rm autoshow-cli:local help extract
```

The image entrypoint is the CLI, so arguments after the image name are AutoShow arguments. There is no additional project command layer.

### Mount the current working directory

For file-based commands, mount the current directory at `/workspace` and make it the container working directory. Pass paths relative to that directory, and the default `./output` directory will be written back to the host:

```bash
docker run --rm -i \
  --mount "type=bind,src=$(pwd),dst=/workspace" \
  --workdir /workspace \
  autoshow-cli:local extract content/book/book.epub
```

Only the mounted directory is visible. If a source is outside it, run from a common ancestor or add another explicit mount. Paths are interpreted inside the container, so do not pass an unmounted host-absolute path.

On Linux, add `--user "$(id -u):$(id -g)"` to the direct `docker run` command when output should be owned by your host user:

```bash
docker run --rm -i \
  --user "$(id -u):$(id -g)" \
  --mount "type=bind,src=$(pwd),dst=/workspace" \
  --workdir /workspace \
  autoshow-cli:local extract content/book/book.epub
```

### Separate input and output mounts

You can instead mount input and output paths explicitly. The CLI resolves relative paths against the container workdir (`/app`), so an argument like `input/book/book.epub` reads `/app/input/book/book.epub`. If `$(pwd)/content` is mounted at `/app/input`, pass the in-container path under `input/`; an unmounted host path will not resolve.

```bash
docker run --rm \
  -v "$(pwd)/content:/app/input:ro" \
  -v "$(pwd)/output:/app/output" \
  autoshow-cli:local extract input/book/book.epub
```

The default output root is `/app/output` because the container workdir is `/app`. You can still pass `--output-root /app/output/custom` when you need a different root.

## Provider Credentials

Hosted providers still require credentials (for example `tts --provider grok` needs `XAI_API_KEY`). Supply them one of three ways:

- `--env-file .env` — load a whole env file for the run.
- `-e KEY=value` — pass individual variables.
- mount the env file to the container working directory's `.env` (`/app/.env` by default) — Bun auto-loads it at startup, so every provider key in it is available without listing them:

```bash
docker run --rm \
  --env-file .env \
  -v "$(pwd)/input:/app/input:ro" \
  -v "$(pwd)/output:/app/output" \
  autoshow-cli:local write input/example.md --llm openai=gpt-5.5
```

When the `.env` lives in another directory (e.g. the autoshow-cli checkout), point at it explicitly:

```bash
docker run --rm \
  -v /path/to/autoshow-cli/.env:/app/.env:ro \
  -v "$(pwd)/content:/app/input:ro" \
  -v "$(pwd)/output:/app/output" \
  autoshow-cli:local tts input/book/text/chapter-00.txt --provider grok
```

Do not bake `.env` into the image. The default `.dockerignore` excludes it.

The image sets `NODE_ENV=production`. Project code never reads it, but Bun's env loader does: with it set, Bun also auto-loads `.env.production` from that same working directory if one is mounted, and it takes precedence over `.env`. Mounting `/app/.env` is the supported path; treat `.env.production` auto-loading as a Bun side effect, not a project interface. In every case real environment variables (`-e`, `--env-file`) win over values from an auto-loaded file.

## Runtime Cache

The local-lite tools are baked into the image. A `runtime/` mount is optional and mainly useful if later commands fetch project-local assets:

```bash
docker run --rm \
  -v "$(pwd)/input:/app/input:ro" \
  -v "$(pwd)/output:/app/output" \
  -v "$(pwd)/runtime:/app/runtime" \
  autoshow-cli:local setup --doctor
```

The image runs as the non-root `bun` user. On Linux hosts, bind-mounted output or runtime directories must be writable by that user, or run with a matching host UID/GID:

```bash
docker run --rm \
  --user "$(id -u):$(id -g)" \
  -v "$(pwd)/input:/app/input:ro" \
  -v "$(pwd)/output:/app/output" \
  -v "$(pwd)/runtime:/app/runtime" \
  autoshow-cli:local --version
```

## Doctor Expectations

`setup --doctor` checks more than this image intentionally provides. The local-lite tools should resolve from `PATH`, including Calibre and Tesseract English data. Warnings for heavyweight local engines, model weights, Defuddle, or missing provider API keys are expected unless you mount or configure those assets separately.
