# Docker

The supported container runtime is Bun 1.4.2, pinned in `Dockerfile` to the reviewed multi-architecture `oven/bun:1.4.2-slim` digest. Native development and CI use the same exact version from `package.json`; `bun autoshow setup --doctor` reports a warning when the running Bun version differs.

The published image continues to run the TypeScript source entrypoint. `Dockerfile` also contains a non-published `compiled-experiment` target used on native AMD64 and ARM64 CI runners. That target is measured separately and is not the default or production stage because its embedded Bun runtime currently increases the packaging payload. See the [compiled Docker entrypoint evaluation](adr/ADR-014-distribute-the-cli-as-a-docker-image.md#compiled-entrypoint-evaluation) for the decision and acceptance gates.

AutoShow publishes a Docker image with the CLI and common local tools so you can run without installing Bun or those tools on the host. Pre-built `linux/amd64` and `linux/arm64` images are on GitHub Container Registry (GHCR), tagged `latest` and by full commit SHA.

The image includes:

- `ffmpeg` and `ffprobe`
- `yt-dlp` 2026.08.19 and Deno 2.9.6 for YouTube JavaScript challenges
- Tesseract OCR with English language data
- MuPDF `mutool`
- `qpdf`
- Calibre `ebook-convert`
- CMake, Make, GCC/G++, and development headers for Whisper compilation

It does not include heavyweight local STT, LLM, or TTS engines, model weights, Defuddle, or provider credentials.

Deno is copied from its pinned official multi-architecture image and is detected automatically by yt-dlp. yt-dlp bundles its challenge solver scripts; no runtime script download is enabled. Bun remains the CLI runtime. See the [yt-dlp JavaScript runtime requirements](https://github.com/yt-dlp/yt-dlp/wiki/EJS).

## Pull or Build

```bash
docker pull ghcr.io/ajcwebdev/autoshow-cli:latest
```

To build locally from source:

```bash
docker build -t autoshow-cli:local .
```

### Runtime Validation

The local, no-cost baseline command builds separate platform images, verifies their architecture and Bun version, runs all measurements, and writes exact command arrays plus raw samples under the ignored `runtime/profiling/bun-docker-baseline/` directory:

```sh
bun baseline:docker --platform all --repeats 5 --fixture-repeats 3
```

After building and verifying the intended platform images, reuse them to collect samples with `--skip-build`. The recorded Bun 1.3 baseline used this sequence:

```sh
bun baseline:docker --platform all --repeats 5 --fixture-repeats 3 --skip-build
```

For a before/after Bun pin comparison, use the first command with the same Docker host, fixture, sample counts, and execution modes. Compare medians and raw samples; do not compare a native row with an emulated row.

The historical results, source identities, measurement definitions, and native CI gates are archived in [ADR-014](adr/ADR-014-distribute-the-cli-as-a-docker-image.md#bun-14-migration-evidence).

To compare dotenv parsing without printing credential values, run:

```sh
bun compare:env
```

Pass `--platform linux/amd64` or `--platform linux/arm64` to select a Docker architecture explicitly. A changed, missing, or added parsed result makes the command fail.

The dotenv probe compares the local `.env` against the exact Bun 1.3.14 and Bun 1.4.0 base images and records only key names and one-run salted hashes under ignored `runtime/profiling/bun-env-compat/`. The salt and credential values are not retained. The historical compatibility result is archived in [ADR-005](adr/ADR-005-reduce-environment-variable-surface-area.md#bun-14-dotenv-compatibility).

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

The focused DOCX and delayed-network diagnostics above are separate from published-image acceptance. Published-image acceptance uses `bun t:docker` below and always tests the pulled image.

## Published `latest` acceptance

`bun t:docker` is a separate acceptance runner for `ghcr.io/ajcwebdev/autoshow-cli:latest`. It does not participate in ordinary Bun test discovery or the paid-provider runner. Every invocation pulls `latest`, fails if that pull fails, resolves the tag once, and runs the CLI against the resulting immutable digest. `--platform` must match the Docker daemon's native architecture; emulation is not accepted for acceptance results.

```bash
bun t:docker
bun t:docker --suite core
bun t:docker --suite network --platform linux/arm64
bun t:docker --suite models
bun t:docker --suite models --model whisper:medium
bun t:docker --suite models --model whisperfile:large-v3 --platform linux/amd64
bun t:docker --help
```

The default `all` selection contains 51 cases: 28 core, 20 model, and 3 public-network cases. Core includes Tesseract, native EPUB extraction, local HTTP/RSS downloads, Defuddle fixture extraction, caption rerendering, default-write price resolution, and CLI rejection contracts. Model cases execute all five Whisper and eight Whisperfile selectors, plus default selection, splitting, lyric transcription, and batching. Network cases require successful YouTube, Twitch, and public Defuddle extraction. Public-site failures are classified separately and fail acceptance; there are no successful skips. A new local registry selector fails coverage checks until a scenario and CI shard are added.

Acceptance invokes the image's normal entrypoint and normal non-root user. It never rebuilds the image, mounts checkout source over `/app`, substitutes a host CLI, or passes provider credentials or host `.env` files. CLI execution is restricted to exact registered command arrays, with an empty explicit config. Hosted-provider rejection cases run with `--network none`; `write --price` resolves the hosted default without dispatching inference. Tests share download definitions, download/STT artifact assertions, and service rejection definitions with native tests through an explicit adapter. Manifests are inspected through a path-mapping view; the original artifacts remain unchanged.

Fixtures are authored synthetic PDF/EPUB documents, caption text, and generated media in the run workspace. Models transcribe the checksum-pinned, 11-second [whisper.cpp JFK sample](https://github.com/ggml-org/whisper.cpp/blob/v1.7.4/samples/jfk.wav). Media preparation and video stream checks use FFmpeg, MuPDF, Python, Bun, and ffprobe inside the pulled image. Core uses a two-second synthetic tone where speech recognition is not involved. Local HTTP/RSS and article fixtures run in another container from the same digest on an internal Docker network with no host-published ports. Inference and local file cases have networking disabled; setup downloads and the three public cases use ordinary bridge networking. No host FFmpeg or local model installation is required.

Provisioning uses `setup --step whisper-binary`, `setup --models whisper:<model>`, `setup --models whisperfile:<model>`, and `setup --step defuddle`. A fresh container repeats model/Defuddle setup offline, and inference runs in another fresh container. Installed assets persist under `runtime/docker-acceptance/cache/linux-amd64/` or `linux-arm64/`, with separate runtime and home mounts. The home mount also preserves Whisperfile loader assets. On Linux, a network-disabled ownership helper mounts only these two cache directories and runs `chown` as root to restore the image user’s ownership after CI cache extraction; every CLI and setup command still uses the image’s normal user. Inference is sequential per worker. A cache lock prevents concurrent runs from modifying the same architecture's assets; use a different `--cache` directory for an independent worker. An abandoned lock includes `owner.json`; verify that run has stopped before removing only its lock directory. Do not delete model caches or outputs to retry.

Setup and each case have separate bounded deadlines: 1,800 and 1,200 seconds by default. Override them with `--setup-timeout SECONDS` and `--case-timeout SECONDS` (1–7,200). Provisioning errors, missing engines, failed model downloads, timeouts, unsupported execution, assertion failures, and empty selections all fail acceptance. Interruption and timeout cleanup removes only containers owned by this invocation. Outputs, partial downloads, completed models, and setup diagnostics remain available for inspection and reuse.

Plan for at least 16 GB of Docker memory for the largest models, CPU time for inference and Whisper compilation, and approximately 30 GB of free disk for all model assets plus the image, build files, rendered videos, and retained run evidence. A single model shard needs substantially less disk. These are planning allowances, not measured minimums; constrained workers can fail or time out. The 13 selector downloads are several gigabytes in aggregate. `--suite core` installs only Defuddle and uses the image's document/media tools.

Each invocation creates `runtime/docker-acceptance/runs/<timestamp>-<id>/`, or a new directory supplied through `--output`. An existing output directory is rejected so old artifacts cannot satisfy new assertions. Evidence includes `image.json` (requested tag, digest, native platform, image ID, revision, CLI version, image size, user, entrypoint), `results.json` (selection, execution counts, per-case durations, outcomes, failure categories), numbered command/exit/stdout/stderr logs, fixtures, all output manifests and artifacts, and a provisioning inventory with setup/CMake diagnostics. Console output is bounded; full subprocess logs stay on disk. Exits are 0 for a complete pass, 1 for acceptance/infrastructure failure, and 2 for invalid runner arguments.

### Coverage inventory

Paths in this table are relative to `test/test-cases/e2e/`. Shared definitions are in `test/scenarios/local-cli-contracts.ts`; native tests remain available.

| Existing scenario | Container equivalent or native reason |
| --- | --- |
| `local/step-1-download-e2e/download-input-types-local-file`: local audio, local document | `download-local-audio`, `download-local-document`; native local audio now uses an actual local file |
| `local/step-1-download-e2e/download-input-types-direct-url`: direct audio, direct video, URL list with limit 1 | `download-direct-audio`, `download-direct-video`, `download-url-list`; deterministic container HTTP fixtures |
| `local/step-1-download-e2e/download-input-types-feed-or-channel`: RSS with image/audio enclosures and limit 1 | `download-rss`; internal RSS fixture and batch/source/child-manifest assertions |
| `local/step-1-download-e2e/download-input-types-streaming`: YouTube, Twitch | `download-youtube`, `download-twitch`; same public URLs, success required |
| `local/step-2-ocr-e2e/ocr-local/ocr-options`: PDF default, PDF JSON | `ocr-pdf-default`, `ocr-pdf-json` |
| Same file: image default versus explicit Tesseract | `ocr-image-default`, `ocr-image-explicit`; assert identical local extraction method and correct default/explicit provider origin |
| Same file: EPUB cleaned text, default chapter exports with length, no-chapters chunks | `epub-text`, `epub-chapters`, `epub-chunks` |
| Same file: PDF chapter detection and diagnostics | `pdf-chapters` |
| Same file: ignored image chapter flags | `ocr-ignored-chapters` |
| Same file: public Defuddle URL extraction | `defuddle-public`; additional deterministic `defuddle-fixture` proves local installation reuse |
| `local/step-2-stt-e2e/stt-local/whisper/whisper-default`: default, explicit tiny/base, split audio | `stt-whisper-default`, `stt-whisper-tiny`, `stt-whisper-base`, `stt-split-audio` |
| `local/step-2-stt-e2e/stt-local/whisper/whisper-large-v3-turbo`: explicit turbo, split video | `stt-whisper-large-v3-turbo`, `stt-split-video` |
| `local/step-2-stt-e2e/stt-local/whisperfile/whisperfile-default`: explicit tiny | `stt-whisperfile-tiny`; additional `stt-whisperfile-default` tests an omitted model |
| Additional supported Whisper selectors | `stt-whisper-small`, `stt-whisper-medium` |
| Additional supported Whisperfile selectors | `stt-whisperfile-tiny.en`, `stt-whisperfile-small`, `stt-whisperfile-small.en`, `stt-whisperfile-medium`, `stt-whisperfile-medium.en`, `stt-whisperfile-large-v2`, `stt-whisperfile-large-v3` |
| `local/step-3-write-e2e/write-local/write-project-lyrics`: cheapest hosted LLM default resolution | Original resolver test remains native because it directly tests an internal API; `write-default-price` checks the packaged CLI's resolution without generation |
| `local/step-7-music-lyrics-video-e2e/music-lyrics-video`: edited-caption rerender, explicit tiny transcription, default turbo transcription, batch manifest | `lyrics-rerender`, `lyrics-explicit`, `lyrics-default`, `lyrics-batch`; short fixtures replace longer example audio; validate captions, H.264/1080p output, provider metadata, cleanup, and batch children |
| `service/step-4-tts-e2e/tts-services/mistral-validation`: invalid model, missing voice source | `reject-mistral-model`, `reject-mistral-voice` |
| `service/step-4-tts-e2e/tts-services/mistral-voxtral-mini-tts-2603-voice`: unknown voice-name flag | `reject-mistral-voice-name` |
| `service/step-4-tts-e2e/tts-services/mistral-dialogue-ref-audio`: remote reference rejection without disclosure | `reject-mistral-remote-reference` |
| `service/step-5-image-gen-e2e/bfl-validation`: unsupported aspect ratio, invalid size | `reject-bfl-aspect`, `reject-bfl-size` |
| `service/step-5-image-gen-e2e/lumalabs-validation`: unsupported size, invalid ratio, invalid format | `reject-luma-size`, `reject-luma-aspect`, `reject-luma-format` |
| `service/step-7-music-gen-e2e/provider-flag-validation`: missing provider | `reject-music-provider` |
| `service/step-4-tts-e2e/tts-services/inworld-realtime-tts-2`: collects Inworld target | Remains a native internal-selector contract; it has no CLI rejection or artifact workflow to port |
| Other service e2e tests | Hosted generation/transcription/extraction requires provider credits or quota and is excluded; no live-provider suite is imported |

### Publication and verification

The publishing workflow holds a workflow-level concurrency lock from verification through acceptance, with cancellation disabled, so a concurrent release cannot replace `latest` during validation. After the multiarchitecture manifest is published, 30 native jobs run core, public-network, and one shard per engine/model on both `ubuntu-24.04` and `ubuntu-24.04-arm`. Every job still pulls `latest` and checks `--expected-digest` and `--expected-revision` against publication outputs. All matrix failures reach the `Published latest acceptance` aggregate check. Artifacts and local asset caches are saved on failure; CI restores host ownership before archiving cache directories, including private Calibre configuration directories. There is no rollback or retagging. This workflow check does not itself change repository branch-protection settings. GitHub documents [workflow concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).

Run the ordinary checks independently from acceptance:

```bash
bun run check
bun t --price
bun --no-env-file test test/test-cases/validation/docker-acceptance/ test/test-cases/validation/cli/docker-image-contracts.test.ts
bun --no-env-file test test/test-cases/validation/cli/cli-help-contracts.test.ts test/test-cases/validation/cli/cli-usage-errors/ test/test-cases/validation/cli/option-resolution-contracts/
```

Harness contracts exercise pull failure, immutable references, literal arguments, mount and batch-path mapping, credential isolation, command/network allowlisting, timeout cleanup, native architecture enforcement, exact model/CI coverage, and nonzero test counts without Docker or provider requests. A separate encoder regression contract covers FFmpeg builds that list NVIDIA/AMD encoders without usable hardware; lyric rendering now probes a synthetic frame before selecting hardware and otherwise uses libx264.

Bare local STT selectors now resolve their engine's `tiny` model before provider selection. This also preserves explicit provider origin: `extract speech.mp3 --provider whisperfile` selects Whisperfile instead of falling through to Whisper. A native regression checks both bare local selectors without inference.

### Recorded acceptance run

On September 8, 2026 (America/Chicago), the published digest `sha256:fed678e1c4ddaa9740dfcdda563682713f5baa34447308a11f1a3363d3c414d0`, revision `456e391f53c5667d0bd5cd639a8ed3017132b6ec`, passed 38 of 51 cases on a native ARM64 Docker daemon. The image predates the changes described above.

| Suite | Result | Remaining published-image failures |
| --- | --- | --- |
| Core | 27/28 passed | Caption rerender selected NVIDIA without its driver |
| Models | 8/20 passed | Eleven Whisper-dependent cases were blocked by missing CMake; bare Whisperfile selected Whisper |
| Public network | 3/3 passed | None; YouTube, Twitch, and public Defuddle succeeded |

All eight explicit Whisperfile selectors completed inference. A second fresh-container run reused the cached tiny model successfully. Evidence and model caches are retained under `runtime/docker-acceptance/`: `local-core`, `local-models`, `local-network`, and `local-cache-final` contain the reports and logs. The current source includes the prerequisite, encoder, and selector fixes, but acceptance of those fixes requires publication and another run. Native AMD64 acceptance is pending CI; the size experiment below does not establish it. Local verification passed `bun run check`, all 140 `bun t --price` commands, and 292 targeted no-cost contracts.

### Whisper prerequisites and size evidence

The production Dockerfile adds one isolated layer containing CMake, Make, GCC, G++, and libc development headers. The compiler packages bring their required C++/OpenMP development dependencies. The [pinned whisper.cpp build](https://github.com/ggml-org/whisper.cpp/blob/v1.7.4/CMakeLists.txt) defaults optional curl, SDL, and FFmpeg integration off, so those development libraries are not added. Models and engines are still provisioned at runtime through the CLI.

Native build jobs record total image bytes and the exact prerequisite layer bytes in `whisper-toolchain-size.json`, along with raw `docker history --human=false` evidence, and include the result in the workflow summary. A minimal container invocation materializes lazy image layers before reading history sizes. Size is informational and never an acceptance threshold. For a separate local before/after packaging measurement, run the following only after acceptance has finished:

```bash
env -i PATH="$PATH" HOME="$HOME" bun --no-env-file scripts/docker-acceptance/measure-whisper-toolchain.ts
```

This experiment resolves the published base digest, builds a derived image containing only the exact prerequisite layer, and compares image bytes on both architectures. It records results under `runtime/docker-acceptance/size/`; AMD64 measurement on an ARM64 daemon may use emulation. These derived images are never used by `bun t:docker`, and their measurements do not imply native acceptance success. Native CI measurements remain authoritative for the published build.

Measured against the published digest recorded above on September 8, 2026, using Docker's `image inspect .Size` field:

| Platform | Before (bytes) | With prerequisites (bytes) | Increase (bytes) | Execution |
| --- | ---: | ---: | ---: | --- |
| `linux/arm64` | 628,722,833 | 733,797,480 | 105,074,647 (105.1 MB) | Native ARM64 |
| `linux/amd64` | 644,107,779 | 758,319,856 | 114,212,077 (114.2 MB) | Emulated on ARM64 |

The raw measurements, build logs, derived Dockerfiles, and image histories are retained in `runtime/docker-acceptance/size/2026-09-09T03-44-02.571Z/`. This measures the prerequisite layer added to the old published image; it is not a measurement of a newly published application revision.
