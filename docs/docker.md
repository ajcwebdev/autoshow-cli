# Docker

AutoShow publishes a Docker image with the CLI and common local tools so you can run without installing Bun or those tools on the host. The image runs Bun 1.4.2. `bun autoshow setup --doctor` reports a warning when the running Bun version differs.

Pre-built `linux/amd64` and `linux/arm64` images are on GitHub Container Registry (GHCR), tagged `latest` and by full commit SHA. They are published for every push to `main` that changes image inputs (`Dockerfile`, dependencies, `config/`, `src/`, the acceptance harness, or workflows), and docs-only pushes keep the previous `latest`.

The image includes:

- `ffmpeg` and `ffprobe`
- `yt-dlp` 2026.08.19 and Deno 2.9.6 for YouTube JavaScript challenges
- Tesseract OCR with English language data
- MuPDF `mutool`
- `qpdf`
- Calibre `ebook-convert`
- ImageMagick (TIFF conversion and lyric-video/comic compositing), with Pango/DejaVu fonts for caption rendering

It does not include heavyweight local STT, LLM, or TTS engines, model weights, Defuddle, or provider credentials.

Deno is included so yt-dlp can solve YouTube JavaScript challenges without downloading solver scripts at runtime. See the [yt-dlp JavaScript runtime requirements](https://github.com/yt-dlp/yt-dlp/wiki/EJS).

## Pull or Build

```bash
docker pull ghcr.io/ajcwebdev/autoshow-cli:latest
```

To build locally from source:

```bash
docker build -t autoshow-cli:local .
```

### Acceptance checks

`bun t:docker --suite core` pulls the published image and runs local acceptance cases on the Docker daemon's native architecture. It uses no hosted inference or provider credentials; pulling the image requires network access. Failed runs retain their evidence and cached assets. Use `bun t:docker --help` to see suite, timeout, and evidence-directory options without starting Docker.

The examples below use `autoshow-cli:local`. Substitute `ghcr.io/ajcwebdev/autoshow-cli:latest` if you pulled the published image.

## Run

Arguments after the image name are AutoShow arguments:

```bash
bun autoshow --version
bun autoshow extract input/examples/document/1-epub.epub

docker run --rm autoshow-cli:local --version
docker run --rm autoshow-cli:local help extract
```

### Mount the current working directory

For file-based commands, mount the current directory at `/workspace` and make it the container working directory. Pass paths relative to that directory so the default `./output` directory is written back to the host:

```bash
docker run --rm -i \
  --mount "type=bind,src=$(pwd),dst=/workspace" \
  --workdir /workspace \
  autoshow-cli:local extract input/examples/document/1-epub.epub
```

Only the mounted directory is visible. If a source is outside it, run from a common ancestor or add another mount. Paths are interpreted inside the container; do not pass an unmounted host-absolute path.

On Linux, add `--user "$(id -u):$(id -g)"` so bind-mounted output is owned by your host user.

### Separate input and output mounts

You can instead mount input and output paths explicitly. Relative paths resolve against the container workdir (`/app`):

```bash
docker run --rm \
  -v "$(pwd)/input:/app/input:ro" \
  -v "$(pwd)/output:/app/output" \
  autoshow-cli:local extract input/examples/document/1-epub.epub
```

The default output root is `/app/output`. Pass `--output-root` when you need a different root.

## Provider Credentials

Hosted providers still need credentials (for example `tts --provider grok` needs `XAI_API_KEY`). The image entrypoint intentionally disables Bun's automatic `.env` loading. Supply a credential file explicitly with Docker's `--env-file` option, or export individual variables with `-e KEY=value`:

```bash
docker run --rm \
  --env-file .env \
  -v "$(pwd)/input:/app/input:ro" \
  -v "$(pwd)/output:/app/output" \
  autoshow-cli:local write input/example.md --provider openai=gpt-5.6-sol
```

Docker reads the file on the host and exports its entries into the container environment; the file is not mounted into the image. A variable supplied with `-e` overrides the same variable from Docker's `--env-file`. Already-exported container environment variables remain supported.

## Doctor

`setup --doctor` checks more than this image includes. Warnings for heavyweight local engines, model weights, Defuddle, or missing provider API keys are expected unless you mount or configure those assets separately.

## Long requests and keepalive

The image sets `AUTOSHOW_DISABLE_HTTP_KEEPALIVE=1`. Long provider requests on Docker Desktop for Mac were reset while Bun reused connections, including when the request timeout was disabled. Fresh connections avoid that reset. Set the variable to `0` to restore connection pooling in a container; that also restores the failure on affected networks. Native runs keep pooling unless you set the variable to `1`. Bun documents [disabling fetch keepalive](https://bun.sh/docs/runtime/networking/fetch).

Ordinary bridge networking is the supported mode. Cancellation deadlines still end a stalled request.

## Large provider responses

Successful HTTP response bodies are read whole under a memory ceiling sized by what the body is for: 16 MiB for control-plane JSON (status polls, catalogs, metadata), 512 MiB for provider results, including audio or images that a provider inlines in JSON as base64 or hex, and 2 GiB for downloads held in memory. Media downloads written straight to disk are streamed and have no ceiling. A body over its ceiling is rejected with its observed size, never truncated, and the failure is not retried because the provider may already have billed the request.

Set `AUTOSHOW_HTTP_PAYLOAD_MAX_BYTES` to a positive whole number of bytes to replace every ceiling, for example `-e AUTOSHOW_HTTP_PAYLOAD_MAX_BYTES=1073741824` for 1 GiB. Size it to the container's memory limit, since one response is held in memory while it is decoded. A malformed value fails at startup, before any provider request. When the request fixes the inlined response size, as with Inworld WAV audio, the run is estimated before dispatch, so a ceiling below what that chunk needs is rejected before it is billed.

## Project Workspace Invocation

Use this optional shell function from any directory after exporting `AUTOSHOW_WORKSPACE` as your absolute project root. Create `.env` and `.autoshow/` there first. On Linux it preserves host ownership; on Docker Desktop the ordinary bind mounts handle ownership. Arguments remain literal, including spaces and shell metacharacters. Docker failure never triggers native execution.

```bash
autoshow() (
  autoshow_workspace=${AUTOSHOW_WORKSPACE:?Set AUTOSHOW_WORKSPACE to the absolute project root}
  set -- --rm -i \
    --mount "type=bind,src=$autoshow_workspace,dst=/workspace" \
    --mount "type=bind,src=$autoshow_workspace/.autoshow,dst=/app/runtime" \
    --workdir /workspace --env-file "$autoshow_workspace/.env" \
    --env AUTOSHOW_REQUIRED_IMAGE_MODEL=gpt-image-2 \
    "${AUTOSHOW_IMAGE:-autoshow-cli:local}" "$@"
  if [ "$(uname -s)" = Linux ]; then
    set -- --user "$(id -u):$(id -g)" "$@"
  fi
  docker run "$@"
)
```

The `AUTOSHOW_REQUIRED_IMAGE_MODEL` line is optional. Remove it for unrestricted models. When it is set, image-producing comic commands and standalone image commands must name that model explicitly. Help, version, and `comic generate-images --qa-only` stay exempt. A violation exits 64 before pricing or output setup.

Keep the separate `/app/runtime` mount intact: protected voice assets, provisioning journals, and account identity keys must survive disposable containers. Docker's explicit `--env` overrides the same key in `--env-file`. `AUTOSHOW_IMAGE` selects a rebuilt tag without a host launcher.

## Docker-only Network Diagnostic

`setup --network-check serve|probe` is separate from installation and doctor modes. It cannot be combined with setup installation flags. The fixture binds port 8787 by default and delays its response by 150 seconds by default. `--delay-seconds` accepts integers from 1 through 600; `--port` selects the fixture port. No provider credentials or paid requests are involved.

```bash
docker run --rm -d --name autoshow-network-fixture \
  -p 127.0.0.1:8787:8787 autoshow-cli:local \
  setup --network-check serve --port 8787 --delay-seconds 150

docker logs autoshow-network-fixture

docker run --rm --add-host host.docker.internal:host-gateway autoshow-cli:local \
  setup --network-check probe --probe-url http://host.docker.internal:8787 \
  --probe-client rest --delay-seconds 150

docker stop autoshow-network-fixture
```

Wait for readiness JSON in the fixture logs before probing. Always stop the specifically named fixture on completion, failure, or interruption; `--rm` removes it on exit. Inspect an occupied name or port instead of deleting an unrelated container. This loopback-published fixture uses Docker's host gateway and does not expose a public listener. Some Linux configurations cannot route the host gateway to loopback-published ports and will fail readiness.

The default probe uses the shared REST client. `--probe-client fetch` uses raw Bun fetch, and `fetch-no-keepalive` disables keepalive for comparison. The probe only accepts HTTP origins on localhost, loopback, or `host.docker.internal`, and it rejects redirects. It prints `passed` and `elapsedSeconds`, and returns nonzero on failure.
