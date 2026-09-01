# Docker

The supported container runtime is Bun 1.4.0, pinned in `Dockerfile` to the reviewed multi-architecture `oven/bun:1.4.0-slim` digest. Native development and CI use the same exact version from `package.json`; `bun autoshow setup --doctor` reports a warning when the running Bun version differs.

The published image continues to run the TypeScript source entrypoint. `Dockerfile` also contains a non-published `compiled-experiment` target used on native AMD64 and ARM64 CI runners. That target is measured separately and is not the default or production stage because its embedded Bun runtime currently increases the packaging payload. See `docs/benchmarks/bun-1-4-native-api-evaluations.md` for the decision and acceptance gates.

AutoShow publishes a Docker image with the CLI and common local tools so you can run without installing Bun or those tools on the host. Pre-built `linux/amd64` and `linux/arm64` images are on GitHub Container Registry (GHCR), tagged `latest` and by full commit SHA.

The image includes:

- `ffmpeg` and `ffprobe`
- `yt-dlp`
- Tesseract OCR with English language data
- MuPDF `mutool`
- `qpdf`
- Calibre `ebook-convert`

It does not include heavyweight local STT, LLM, or TTS engines, model weights, Defuddle, or provider credentials.

## Pull or Build

```bash
docker pull ghcr.io/ajcwebdev/autoshow-cli:latest
```

To build locally from source:

```bash
docker build -t autoshow-cli:local .
```

To capture a no-provider, platform-specific runtime baseline before or after a Bun image change, run `bun baseline:docker --platform all --repeats 5 --fixture-repeats 3`. Raw command logs and samples go under the ignored `runtime/profiling/bun-docker-baseline/` directory. The checked results and measurement definitions are in [Bun 1.3 Docker Baseline](benchmarks/bun-1-3-docker-baseline.md) and [Bun 1.4 Docker Validation](benchmarks/bun-1-4-docker-validation.md).

The examples below use `autoshow-cli:local`. Substitute `ghcr.io/ajcwebdev/autoshow-cli:latest` if you pulled the published image.

## Run

Arguments after the image name are AutoShow arguments:

```bash
# Native checkout
bun autoshow --version
bun autoshow extract content/book/book.epub

# Docker image
docker run --rm autoshow-cli:local --version
docker run --rm autoshow-cli:local help extract
```

### Mount the current working directory

For file-based commands, mount the current directory at `/workspace` and make it the container working directory. Pass paths relative to that directory so the default `./output` directory is written back to the host:

```bash
docker run --rm -i \
  --mount "type=bind,src=$(pwd),dst=/workspace" \
  --workdir /workspace \
  autoshow-cli:local extract content/book/book.epub
```

Only the mounted directory is visible. If a source is outside it, run from a common ancestor or add another mount. Paths are interpreted inside the container; do not pass an unmounted host-absolute path.

On Linux, add `--user "$(id -u):$(id -g)"` so bind-mounted output is owned by your host user.

### Separate input and output mounts

You can instead mount input and output paths explicitly. Relative paths resolve against the container workdir (`/app`):

```bash
docker run --rm \
  -v "$(pwd)/content:/app/input:ro" \
  -v "$(pwd)/output:/app/output" \
  autoshow-cli:local extract input/book/book.epub
```

The default output root is `/app/output`. Pass `--output-root` when you need a different root.

## Provider Credentials

Hosted providers still need credentials (for example `tts --provider grok` needs `XAI_API_KEY`). The image entrypoint intentionally disables Bun's automatic `.env` loading. Supply a credential file explicitly with Docker's `--env-file` option, or export individual variables with `-e KEY=value`:

```bash
docker run --rm \
  --env-file .env \
  -v "$(pwd)/input:/app/input:ro" \
  -v "$(pwd)/output:/app/output" \
  autoshow-cli:local write input/example.md --llm openai=gpt-5.5
```

Docker reads the file on the host and exports its entries into the container environment; the file is not mounted into the image. A variable supplied with `-e` overrides the same variable from Docker's `--env-file`. Already-exported container environment variables remain supported.

## Doctor

`setup --doctor` checks more than this image includes. Warnings for heavyweight local engines, model weights, Defuddle, or missing provider API keys are expected unless you mount or configure those assets separately.
