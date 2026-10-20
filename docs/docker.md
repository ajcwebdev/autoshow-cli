# Docker

AutoShow publishes a Docker image with the CLI and common local tools so you can run without installing Bun or those tools on the host. The image runs Bun 1.4.2. `bun autoshow setup --doctor` reports a warning when the running Bun version differs.

Pre-built `linux/amd64` and `linux/arm64` images are on GitHub Container Registry (GHCR), tagged `latest` and by full commit SHA. They are published for every push to `main` that changes image inputs (`Dockerfile`, dependencies, `config/`, `src/`, the acceptance harness, or workflows), and docs-only pushes keep the previous `latest`.

Publication first creates a SHA-tagged candidate index after verification, package checks, native offline smoke, and vulnerability scans. All twelve core, model, and public-site acceptance shards run against its immutable digest. Only a successful candidate is copied to `latest`, preserving both native platform descriptors, SBOM, and provenance attestations. A failed or skipped shard blocks promotion and leaves the previous `latest` in place. Push releases remain serialized; existing build, smoke, audit, and required-check names are retained.

Production installs the frozen runtime graph without peer dependencies. The build context allows only the root manifests, application source, and Defuddle/alignment configuration; nested dependency trees, hidden workspace files, and logs are excluded. Native verification recursively checks root ownership, readable/traversable modes, symlink routes, and absent group/other write access across the application and optional alignment tree. Only the configuration link into runtime state is exempt from that immutable boundary.

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

The stages are `youtube-js`, `deps`, `alignment-deps`, `runtime`, `alignment`, and final/default `production`. Build the optional CPU alignment backend with `docker build --target alignment -t autoshow-cli:alignment .`. Its independent builder installs the frozen ONNX graph, keeps only the target Linux architecture's native binaries, and normalizes permissions before copying; it does not install into the runtime user's HOME. Production does not build or ship that graph. The frontend remains digest-pinned at 1.6; permission normalization stays explicit in build steps.

OCR, setup, and doctor use the same English language data selection. If managed `eng.traineddata` is absent, Tesseract uses its packaged default, including when runtime storage is mounted empty. Present but invalid managed data fails with a diagnostic. Doctor and setup initialize the English model as well as listing languages, so a corrupt model does not pass merely because its filename exists.

### Acceptance checks

`bun t:docker --suite core` pulls the published image and runs local acceptance cases on the Docker daemon's native architecture. It uses no hosted inference or provider credentials; pulling the image requires network access. Failed runs retain their evidence and cached assets. Use `bun t:docker --help` to see suite, timeout, and evidence-directory options without starting Docker.

Core acceptance includes authored FB2 conversion through Calibre, conversion metadata and extracted chapter text, malformed-input rejection, and a separate EPUB integrity probe before temporary conversion cleanup. Defuddle preparation may download its optional package; cached tool checks and document conversion run offline, while local URL fixtures use an isolated Docker network. These checks are distinct from public-site acceptance.

`bun --no-env-file test/docker-acceptance/docker-context-acceptance.ts` verifies the allowlist using an authored scratch context and offline BuildKit export. `bun --no-env-file test/docker-acceptance/docker-tesseract-data-acceptance.ts --image autoshow-cli:local` verifies actual OCR, setup, and doctor across packaged, managed, invalid, and reset data layouts without network access. Native dependency-image CI runs that data gate for both targets, checks alignment first use with the image's original HOME before any replacement mounts, then verifies writable mounted state as the default user and a host UID/GID.

Select a local build with `bun t:docker --suite core --image autoshow-cli:local --pull never`. Select a registry candidate with `bun t:docker --suite core --image ghcr.io/ajcwebdev/autoshow-cli@sha256:<digest> --pull always --expected-revision <full-commit-sha>`. The default pull policy is `always`; `missing` uses an already installed image or pulls it if absent. A failed pull never falls back to a cached tag. Registry pulls execute the verified manifest digest, and cached local tags execute the inspected immutable image ID. `--expected-digest` accepts that manifest digest or local image ID. All selections retain native architecture, non-root user, entrypoint, credential, and revision checks.

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

The image sets `AUTOSHOW_DISABLE_HTTP_KEEPALIVE=1`. Long provider requests on Docker Desktop for Mac were reset while Bun reused connections, including when the request timeout was disabled. Fresh connections avoid that reset. Set the variable to `0` to restore connection pooling in a container; that also restores the failure on affected networks. Native runs keep pooling unless you set the variable to `1`. Bun documents [disabling fetch keepalive](https://bun.sh/docs/runtime/networking/fetch).

Ordinary bridge networking is the supported mode. Cancellation deadlines still end a stalled request.

## Large provider responses

Successful HTTP response bodies are read whole under a memory ceiling sized by what the body is for: 16 MiB for control-plane JSON (status polls, catalogs, metadata), 512 MiB for provider results, including audio or images that a provider inlines in JSON as base64 or hex, and 2 GiB for downloads held in memory. Paid results written straight to disk are streamed and have no ceiling. A source you supply by URL, such as a document, media file, or reference, is also streamed to disk, but stops at 16 GiB or after the 10-minute media download deadline, so a runaway source cannot fill the container disk. A body over its ceiling is rejected with its observed size, never truncated, and the failure is not retried because the provider may already have billed the request.

Set `AUTOSHOW_HTTP_PAYLOAD_MAX_BYTES` to a positive whole number of bytes to replace every in-memory ceiling, for example `-e AUTOSHOW_HTTP_PAYLOAD_MAX_BYTES=1073741824` for 1 GiB. Size it to the container's memory limit, since one response is held in memory while it is decoded. It lowers nothing for source downloads; a value above 16 GiB raises the source ceiling. A malformed value fails at startup, before any provider request. When the request fixes the inlined response size, as with Inworld WAV audio, the run is estimated before dispatch, so a ceiling below what that chunk needs is rejected before it is billed.

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
    --env AUTOSHOW_REQUIRED_IMAGE_MODEL=gpt-image-2 \
    "${AUTOSHOW_IMAGE:-autoshow-cli:local}" "$@"
  if [ "$(uname -s)" = Linux ]; then
    set -- --user "$(id -u):$(id -g)" "$@"
  fi
  docker run "$@"
)
```

The `AUTOSHOW_REQUIRED_IMAGE_MODEL` line is optional. Remove it for unrestricted models. When it is set, image-producing comic commands and standalone image commands must name that model explicitly. Help, version, and `comic generate-images --qa-only` stay exempt. A violation exits 64 before pricing or output setup.

Keep the separate `/app/runtime` and `/home/bun` mounts intact: protected voice assets, provisioning journals, account identity keys, managed tools, configuration, and caches must survive disposable containers. The default `/app/config/autoshow.json` path links to `/app/runtime/autoshow.json`; an empty runtime mount provisions it on first config write. Source, dependencies, frozen manifests, and bundled configuration assets remain root-owned. For other Linux `--user` invocations, bind host-owned writable directories to `/app/runtime` and `/home/bun` plus any input/output locations the command uses; changing the user alone does not initialize these directories. Keep identity/voice state and credentials out of broad evidence uploads. Docker's explicit `--env` overrides the same key in `--env-file`. `AUTOSHOW_IMAGE` selects a rebuilt tag without a host launcher.

## Security pin maintenance

The release/dependency maintainer, `@ajcwebdev`, owns the image security pins and their promotion evidence. Review them together every Monday after the scheduled native uncached audits, and before a release that changes one of these pins. For an applicable security advisory, assess it as soon as notified, update all affected pins in one change, and run the same native candidate gates before promotion. If a fix is unavailable, retain the advisory's owner, affected packages, reachability, disposition, and next action in the release triage; a rebuild alone does not close it.

| Pin family           | Coordinated update surfaces                                                                                                                                                                                                      |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bun                  | `package.json` packageManager, `bun.lock`, `src/utils/bun-version.ts`, Docker base tag/digest, setup metadata, pinned setup-bun versions, and version contracts                                                                  |
| Deno and yt-dlp      | Docker image/download digests and URLs, defaults in `src/cli/commands/setup-and-utilities/setup/dependency-metadata.ts`, optional `config/deps.json` overrides, native setup distribution metadata, and documented tool versions |
| Build infrastructure | Dockerfile frontend digest, Buildx version, BuildKit image digest, and pinned Docker/checkout/setup actions in workflows and shared actions                                                                                      |
| Scanners             | Syft/Grype version selectors, architecture selection, and release-checksum verification in `.github/actions/scan-image/`, plus callers overriding versions                                                                       |
| Debian               | Dockerfile `DEBIAN_SNAPSHOT`, signed Debian/security snapshot sources, the Bun base digest's distribution, and package inventory/advisory evidence for both native architectures                                                 |

Verify exact metadata paths against the current setup registry when updating a tool. Preserve signed APT metadata, snapshot selection, `apt-get upgrade`, frozen dependency installation, and digest/checksum checks. The scheduled `--pull --no-cache` audit detects problems in the selected inputs; a pinned old snapshot still contains its old packages. Move the snapshot and relevant base/tool pins to acquire later security releases, following [Debian Snapshot](https://snapshot.debian.org/) and [Docker's base-image pinning guidance](https://docs.docker.com/build/building/best-practices/#pin-base-image-versions).

Confirm a fix through the candidate index digest, each original native build digest, shipped Debian and production dependency inventories, both native scans, every high/critical advisory disposition, and all acceptance shards. The shared audit action records the exact image identity, package list, SBOM, scan, scanner database timestamp, notices, and triage. Promotion uses a single accepted index source as a [verbatim index copy](https://docs.docker.com/reference/cli/docker/buildx/imagetools/create/) and checks the final `latest` digest against it. Retain those CI artifacts with the release; a source pin edit or a separate rebuild is not proof of what `latest` ships.

Release and independent image audits share native evidence capture from the inspected immutable image ID: package inventory, notices, rendering capabilities, shipped source pins/policies, identity, and checksums. On main pushes, the independent workflow can omit its production rebuild only after both same-commit native release audits succeed and retain matching evidence artifacts. The lookup waits at most 180 seconds; missing, failed, expired, or unavailable coverage retains production auditing. PRs, schedules, and manual runs retain both targets, including scheduled uncached builds.

Scanner downloads use one bounded transient-retry policy; checksum and archive-integrity failures stop immediately. Scanning an existing SBOM, including database warmup, installs Grype alone. Image inventory also installs Syft. Database hydration, freshness evidence, and severity/fixability gates remain required.

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
