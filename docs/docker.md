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

## Long requests and keepalive

The Docker runtime sets `AUTOSHOW_DISABLE_HTTP_KEEPALIVE=1`. The shared provider REST client uses this opt-out to pass `keepalive: false` to Bun fetch while retaining `timeout: false`, caller cancellation, request serialization and existing error/retry semantics. Both the source runtime and compiled experiment inherit the setting. Native executions retain their previous connection pooling unless the variable is explicitly set to `1`. Setting it to `0` restores Bun's default pooling in a container, but also restores the observed failure on affected networks. The option affects shared REST clients (including OpenAI text, images, image edits and audio, Anthropic, Gemini, Mistral and Replicate); direct fetch call sites are unchanged.

This prevents a reproduced silent-request reset on Docker Desktop for Mac with Bun 1.4.0. Against a local HTTP server delaying every response byte by 100 seconds, the host control succeeded, container Bun default fetch reset after 74.29 seconds despite `timeout: false`, container Bun with `keepalive: false` succeeded at 100.20 seconds. These controlled results isolate a keepalive/transport interaction; they do not establish a general Docker idle limit. Bun documents [disabling fetch keepalive](https://bun.sh/docs/runtime/networking/fetch).

Changing Docker Desktop's `NetworkType` to `vpnkit` and enabling host networking both failed the same test and were reverted. Ordinary bridge networking works with the transport option; no proxy, Dockerfile network change, native fallback or automatic redispatch is required. The tradeoff is fresh TCP/TLS connections for shared REST requests instead of pooling. Existing cancellation deadlines remain the mechanism for ending stalled requests.

Use the supported Docker-only fixture below to diagnose recurrence. No host Bun, Docker socket mount, credentials, or provider requests are required. Rebuild after updating the shared client or Dockerfile.

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

The model environment setting is optional for general AutoShow users; remove that line for unrestricted models. Projects that require a fixed image model should retain it. When set, it requires an explicit model for image-producing comic commands and explicit `openai=<required-model>` selectors for standalone images. Defaults, model lists, and alternate/comparison providers are rejected before pricing or output setup with exit code 64 in normal error output. Help/version and `comic generate-images --qa-only` remain exempt. The policy uses parsed flags and occurrences, guards resolved/resumed targets before pricing, and checks internal image dispatch and OpenAI image edits. It does not prove reference-image pixel lineage; project provenance audits remain responsible for that.

Keep the separate `/app/runtime` mount intact: protected voice assets, provisioning journals, and account identity keys must survive disposable containers. Docker's explicit `--env` overrides the same key in `--env-file`. `AUTOSHOW_IMAGE` selects a rebuilt tag without a host launcher.

## Docker-only Network Diagnostic

`setup --network-check serve|probe` is separate from installation and doctor modes. It cannot be combined with setup installation flags. The fixture binds port 8787 by default, disables its idle timeout, exposes `/ready`, and delays `/responses` by 150 seconds by default. `--delay-seconds` accepts integers from 1 through 600; `--port` selects the fixture port.

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

Wait for readiness JSON in the fixture logs. Always stop the specifically named fixture on completion, failure, or interruption; `--rm` removes it on exit. Inspect an occupied name or port instead of deleting an unrelated container. This loopback-published fixture exercises Docker's host gateway without exposing a public listener; some Linux configurations cannot route the host gateway to loopback-published ports and will fail readiness. Diagnose that result without changing host networking automatically.

The probe runs in a bounded child process with uppercase and lowercase HTTP, HTTPS, and ALL proxy environment variables removed, so cached Bun proxy settings cannot route fixture traffic through a proxy. The caller’s environment and ordinary provider proxy behavior remain intact. The default probe uses the actual shared OpenAI REST client with a dummy key against the fixture. `--probe-client fetch` uses raw Bun fetch and `fetch-no-keepalive` explicitly disables keepalive for comparison. The probe only accepts HTTP origins on localhost, loopback, or `host.docker.internal` and rejects redirects on both readiness and response requests, including the shared REST request; it never reads provider credentials. Readiness and response share a bounded deadline of `--delay-seconds` plus 30 seconds. The command emits machine-readable `passed` and `elapsedSeconds`, and returns nonzero on failure. Server mode handles SIGINT/SIGTERM by stopping the fixture. No price preflight exists because this diagnostic cannot call paid providers.

## Local DOCX Markdown

`extract file.docx --docx-markdown --output-dir output/review` writes `extraction.md` alongside ordinary `extraction.txt` and `manifest.json`, recording the Markdown artifact in extraction metadata. This opt-in mode accepts a local DOCX only and rejects provider and unrelated extraction flags; configured OCR providers are rejected too. The exact same command plus `--price` validates ZIP/XML and reports zero cost without artifact writes. Ordinary extraction remains unchanged.

The formatter uses the existing ZIP central-directory reader and Bun XML APIs, preserving the migrated formatter's headings, uppercase front-title handling (including USS), emphasis, lists, tables, whitespace, numeric normalization, and error behavior. Content-control wrappers are traversed in document order, including nested blocks and controls around table rows, cells, and paragraphs. Review and promotion are separate editorial steps; extraction does not modify canonical Markdown.

## Focused No-cost Verification

Run `bun run check`, then the explicit validation paths below. These suites exercise local fixtures, parser/policy boundaries, artifacts, documented shell invocation, REST serialization, and Docker contracts without provider requests. Require nonzero test counts; never substitute the full provider test runner.

```bash
bun test test/test-cases/validation/extraction/ test/test-cases/validation/cli/required-image-model-contracts.test.ts test/test-cases/validation/cli/network-check-contracts.test.ts test/test-cases/validation/cli/docker-workspace-invocation.test.ts
bun test test/test-cases/validation/cli/option-resolution-contracts/ test/test-cases/validation/cli/native-cli-parser-contracts.test.ts test/test-cases/validation/cli/docker-image-contracts.test.ts test/test-cases/validation/providers/provider-rest-client-contracts.test.ts test/test-cases/validation/providers/openai-rest-contracts/
```

Container acceptance additionally builds the runtime image, checks version/help, converts a synthetic DOCX with a zero-cost preflight, rejects noncompliant models with exit 64, and completes the 150-second delayed REST probe through the host gateway. Use only temporary fixture data and clean up the specifically named fixture container.
