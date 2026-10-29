# Docker

AutoShow publishes a Docker image with the CLI and common local tools so you can run without installing Bun or those tools on the host. The image runs Bun 1.4.2. `bun autoshow setup --doctor` reports a warning when the running Bun version differs.

Pre-built `linux/amd64` and `linux/arm64` images are on GitHub Container Registry (GHCR), tagged `latest` and by full commit SHA. They are published for every push to `main` that changes image inputs (`Dockerfile`, dependencies, `config/`, `src/`, the acceptance harness, or workflows), and docs-only pushes keep the previous `latest`.

Publication creates a SHA-tagged candidate after verification, native smoke tests, and vulnerability scans. Core, model, and public-site acceptance run against its immutable digest on both architectures before the same image index is promoted to `latest`. A failed or skipped acceptance shard leaves the previous `latest` in place.

The image includes:

- `ffmpeg` and `ffprobe`
- `yt-dlp` 2026.08.19 and Deno 2.9.8 for YouTube JavaScript challenges
- Tesseract OCR with English language data
- MuPDF `mutool`
- `qpdf`
- Calibre `ebook-convert`
- ImageMagick (TIFF conversion and lyric-video/comic compositing), with Pango/DejaVu fonts for caption rendering

It does not include heavyweight local STT, LLM, or TTS engines, model weights, Defuddle, or provider credentials.

## Pull or Build

```bash
docker pull ghcr.io/ajcwebdev/autoshow-cli:latest
```

To build locally from source:

```bash
docker build -t autoshow-cli:local .
```

The default `production` target omits the CPU alignment backend. Build that optional backend with `docker build --target alignment -t autoshow-cli:alignment .`.

If managed `eng.traineddata` is absent, Tesseract uses its packaged English data, including when runtime storage is mounted empty. Invalid managed data fails with a diagnostic from OCR, setup, and doctor.

### Acceptance checks

`bun t:docker --suite core` pulls the published image and runs local acceptance cases on the Docker daemon's native architecture. It uses no hosted inference or provider credentials. Pulling the image and preparing optional Defuddle may require network access; document conversion and cached tool checks run offline, and local URL fixtures use an isolated network. Core checks cover actual OCR and ebook conversion, extracted text, and malformed-input rejection. Failed runs retain evidence and cached assets. Use `bun t:docker --help` for options without starting Docker.

Select a local build with `bun t:docker --suite core --image autoshow-cli:local --pull never`. Select a registry candidate with `bun t:docker --suite core --image ghcr.io/ajcwebdev/autoshow-cli@sha256:<digest> --pull always --expected-revision <full-commit-sha>`. The default pull policy is `always`; `missing` uses a cached image or pulls it if absent. A failed pull never falls back to a cached tag. Containers run the resolved immutable digest or local image ID. `--expected-digest` accepts either identity, and `--platform` must match the Docker daemon's native architecture.

Acceptance uses the image user unless `--user UID:GID` selects a non-root numeric identity. Use the same identity when reusing caches, and ensure restored state is writable; the harness does not repair existing ownership or permissions. Concurrent acceptance runs cannot share a cache. Add `--restricted` to drop capabilities and prevent privilege escalation.

Narrower local checks are available for build context, language data, and persistent state:

- `bun --no-env-file test/docker-acceptance/docker-context-acceptance.ts` checks the build-context allowlist.
- `bun --no-env-file test/docker-acceptance/docker-tesseract-data-acceptance.ts --image autoshow-cli:local` checks OCR, setup, and doctor with packaged, managed, invalid, and reset data layouts.
- `bun --no-env-file test/docker-acceptance/docker-runtime-state-acceptance.ts --image autoshow-cli:local --output runtime/docker-acceptance/new-state-check` checks fresh and reused state, host identities, restricted operation, invalid inputs, and timeout cleanup.

These checks use local fixtures without hosted inference. The language-data and state checks require an installed image; they do not replace release acceptance on both native architectures.

The examples below use `autoshow-cli:local`. Substitute `ghcr.io/ajcwebdev/autoshow-cli:latest` if you pulled the published image.

## Run

Arguments after the image name are AutoShow arguments:

```bash
bun autoshow --version
bun autoshow extract input/examples/document/harborlight-field-notes.pdf --provider tesseract --no-chapters

docker run --rm autoshow-cli:local --version
docker run --rm autoshow-cli:local help extract
```

### Mount the current working directory

For file-based commands, mount the current directory at `/workspace` and make it the container working directory. Pass paths relative to that directory so the default `./output` directory is written back to the host:

```bash
docker run --rm -i \
  --mount "type=bind,src=$(pwd),dst=/workspace" \
  --workdir /workspace \
  autoshow-cli:local extract input/examples/document/harborlight-field-notes.pdf --provider tesseract --no-chapters
```

Only the mounted directory is visible. If a source is outside it, run from a common ancestor or add another mount. Paths are interpreted inside the container; do not pass an unmounted host-absolute path.

This quick invocation uses disposable application state and home/cache directories. On Linux, use the persistent workspace function below to run with your host UID/GID and writable state/home mounts, so bind-mounted output is owned by your host user.

### Separate input and output mounts

You can instead mount input and output paths explicitly. Relative paths resolve against the container workdir (`/app`):

```bash
docker run --rm \
  -v "$(pwd)/input:/app/input:ro" \
  -v "$(pwd)/output:/app/output" \
  autoshow-cli:local extract input/examples/document/harborlight-field-notes.pdf --provider tesseract --no-chapters
```

The original Harborlight PDF comes from the checkout's mounted `input/` tree; the image does not bundle user inputs. The default output root is `/app/output`. Pass `--output-root` when you need a different root.

## Provider Credentials

Hosted providers still need credentials (for example `tts --provider grok` needs `XAI_API_KEY`). The image entrypoint intentionally disables Bun's automatic `.env` loading. Supply a credential file explicitly with Docker's `--env-file` option, or export individual variables with `-e KEY=value`:

```bash
docker run --rm \
  --env-file .env \
  -v "$(pwd)/input:/app/input:ro" \
  -v "$(pwd)/output:/app/output" \
  autoshow-cli:local write input/examples/tts/harborlight-chapters/01-first-light.md --provider openai=gpt-6.1-sol --prompt shortSummary
```

Docker reads the file on the host and exports its entries into the container environment; the file is not mounted into the image. A variable supplied with `-e` overrides the same variable from Docker's `--env-file`. Already-exported container environment variables remain supported.

## Doctor

`setup --doctor` checks more than this image includes. Warnings for heavyweight local engines, model weights, Defuddle, or missing provider API keys are expected unless you mount or configure those assets separately.

## Long requests and keepalive

The image sets `AUTOSHOW_DISABLE_HTTP_KEEPALIVE=1` to avoid connection resets during long provider requests on affected Docker Desktop for Mac networks. Set it to `0` to restore connection pooling in a container; resets may recur on those networks. Native runs keep pooling unless you set it to `1`.

Ordinary bridge networking is the supported mode. Cancellation deadlines still end a stalled request.

## Large provider responses

Successful HTTP responses are read whole or rejected when they exceed their memory ceiling: 16 MiB for status/catalog/metadata responses, 512 MiB for provider results, including inlined audio or images, and 2 GiB for downloads held in memory. Paid results streamed directly to disk have no size ceiling. User-supplied URL sources stream to disk with a 16 GiB ceiling and a 10-minute deadline per transfer; leave enough free disk for the selected workload. Oversize bodies fail with their observed size and are not automatically retried, since the provider may already have billed the request.

Set `AUTOSHOW_HTTP_PAYLOAD_MAX_BYTES` to a positive whole number of bytes to replace every in-memory ceiling, for example `-e AUTOSHOW_HTTP_PAYLOAD_MAX_BYTES=1073741824` for 1 GiB. Allow memory for response decoding and concurrent work as well as the body itself. This override can raise the source-download ceiling above 16 GiB but cannot lower it. A malformed value fails at startup. Predictable oversized inlined responses, such as Inworld WAV audio, are rejected before provider dispatch.

## Project Workspace Invocation

Use this recommended shell function from any directory after exporting `AUTOSHOW_WORKSPACE` as your absolute project root. Create `.env` there and create `.autoshow/home/.cache` as your host user with `mkdir -p "$AUTOSHOW_WORKSPACE/.autoshow/home/.cache"`. On Linux it preserves host ownership; on Docker Desktop the ordinary bind mounts handle ownership. Arguments remain literal, including spaces and shell metacharacters. Docker failure never triggers native execution.

```bash
autoshow() (
  autoshow_workspace=${AUTOSHOW_WORKSPACE:?Set AUTOSHOW_WORKSPACE to the absolute project root}
  set -- --rm -i \
    --mount "type=bind,src=$autoshow_workspace,dst=/workspace" \
    --mount "type=bind,src=$autoshow_workspace/.autoshow,dst=/app/runtime" \
    --mount "type=bind,src=$autoshow_workspace/.autoshow/home,dst=/home/bun" \
    --workdir /workspace --env-file "$autoshow_workspace/.env" \
    --env AUTOSHOW_REQUIRED_IMAGE_MODEL=gpt-image-2.5-flare \
    "${AUTOSHOW_IMAGE:-autoshow-cli:local}" "$@"
  if [ "$(uname -s)" = Linux ]; then
    set -- --user "$(id -u):$(id -g)" "$@"
  fi
  docker run "$@"
)
```

The `AUTOSHOW_REQUIRED_IMAGE_MODEL` line is optional. Remove it for unrestricted models. When it is set, image-producing comic commands and standalone image commands require exactly one `--provider openai=<model>` matching that value; all-provider selection is rejected. Help, version, and `comic generate-images --qa-only` stay exempt. A violation exits 64 before pricing or output setup.

Keep the separate `/app/runtime` and `/home/bun` mounts to retain voice assets, identity state, managed tools, configuration, and caches. Configuration is created in runtime storage on the first write; application files remain read-only to the runtime user. For other Linux `--user` invocations, mount host-owned writable state, home, and output directories; changing the user alone does not initialize them. Keep identity/voice state and credentials out of broad evidence uploads. `AUTOSHOW_IMAGE` selects a different image tag or digest.

### Restricted input/output invocation

This opt-in function exposes only read-only `input/` plus writable `output/`, runtime state and HOME. It drops every Linux capability and prevents privilege escalation while retaining ordinary bridge networking and the keepalive workaround. Docker describes these [runtime privilege controls](https://docs.docker.com/engine/containers/run/#runtime-privilege-and-linux-capabilities). It leaves the container root filesystem and resource limits at their defaults; tighter limits need workload-specific validation.

```bash
autoshow_restricted() (
  autoshow_workspace=${AUTOSHOW_WORKSPACE:?Set AUTOSHOW_WORKSPACE to the absolute project root}
  mkdir -p "$autoshow_workspace/input" "$autoshow_workspace/output" "$autoshow_workspace/.autoshow/home/.cache" || exit
  set -- --rm -i --cap-drop ALL --security-opt no-new-privileges:true \
    --mount "type=bind,src=$autoshow_workspace/input,dst=/workspace/input,readonly" \
    --mount "type=bind,src=$autoshow_workspace/output,dst=/workspace/output" \
    --mount "type=bind,src=$autoshow_workspace/.autoshow,dst=/app/runtime" \
    --mount "type=bind,src=$autoshow_workspace/.autoshow/home,dst=/home/bun" \
    --workdir /workspace --env-file "$autoshow_workspace/.env" \
    --env AUTOSHOW_DISABLE_HTTP_KEEPALIVE=1 \
    "${AUTOSHOW_IMAGE:-autoshow-cli:local}" "$@"
  if [ "$(uname -s)" = Linux ]; then
    set -- --user "$(id -u):$(id -g)" "$@"
  fi
  docker run "$@"
)
```

For example, `autoshow_restricted extract input/document.png --provider tesseract` keeps the source image read-only and writes under `output/`. Relative source paths must stay inside the mounted input tree. Configuration and paid assets persist through the two state mounts; removing a disposable container does not delete them. Missing mounts or a Docker error are failures and never trigger native fallback.

## Security pin maintenance

The release maintainer owns image security pins and reviews them after the scheduled Monday audits and before releases that change them. Bun, Deno, the Debian snapshot, and yt-dlp are pinned in `Dockerfile`; native setup metadata and workflows must stay consistent with shared tool versions. Current pins and release gates are maintained in the recipe and workflows referenced by [ADR-014](adr/ADR-014-distribute-the-cli-as-a-docker-image.md).

A pinned snapshot does not acquire later security fixes through a rebuild alone. Update affected pins together, then verify the exact candidate on native AMD64 and ARM64 with scans and acceptance before promotion. Retain image inventories, advisory dispositions, and acceptance evidence with the release; a source change or separate local build does not establish what `latest` contains.

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
