# Docker

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

Hosted providers still need credentials (for example `tts --provider grok` needs `XAI_API_KEY`). Supply them with `--env-file .env`, `-e KEY=value`, or a `.env` file mounted at `/app/.env`:

```bash
docker run --rm \
  --env-file .env \
  -v "$(pwd)/input:/app/input:ro" \
  -v "$(pwd)/output:/app/output" \
  autoshow-cli:local write input/example.md --llm openai=gpt-5.5
```

If the `.env` lives elsewhere, mount it at `/app/.env`. Values from `-e` and `--env-file` override a mounted `.env`.

## Doctor

`setup --doctor` checks more than this image includes. Warnings for heavyweight local engines, model weights, Defuddle, or missing provider API keys are expected unless you mount or configure those assets separately.
