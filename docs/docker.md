# Docker

Run AutoShow and common local tools without a host Bun installation. The Debian slim image runs as non-root `bun`; arguments after the image name are CLI arguments, and a bare run prints help.

Native `linux/amd64` and `linux/arm64` candidates publish from image-input changes on `main`. Verification, smoke tests, scans, and every immutable-candidate acceptance shard must pass before promotion; docs-only pushes keep the previous `latest`. Pins and release gates live in [Dockerfile](../Dockerfile) and [ADR-014](adr/ADR-014-distribute-the-cli-as-a-docker-image.md).

The image includes FFmpeg/ffprobe, yt-dlp/Deno, Tesseract with English data, MuPDF, qpdf, Calibre, and ImageMagick/Pango/DejaVu fonts. Dependency executables, their packaged libraries, installed package graphs, font/delegate configuration, and resources execute from `/app/runtime`. The final base contains OS support and the initial Bun launcher; immutable bundled application code lets help, doctor, dry-run, and argument validation run on a fresh runtime mount without installing packages. An immutable distribution payload at `/opt/autoshow-runtime` supplies fresh writable runtime mounts without downloads; activation preserves previous generations and unrelated configuration/assets. After initialization, normal invocations preserve runtime-owned tool upgrades; use setup and doctor for verification/repair, and changing the image does not silently replace unrelated installations. It omits heavyweight engines/weights, Defuddle, and credentials. Missing managed Tesseract data falls back to packaged English inside the runtime payload; invalid managed data fails in OCR, setup, and doctor.

## Pull or Build

```bash
docker pull ghcr.io/ajcwebdev/autoshow-cli:latest
docker build -t autoshow-cli:local .
```

Examples use `autoshow-cli:local`; substitute the published tag if pulled. Default target `production` omits CPU alignment; add it with `docker build --target alignment -t autoshow-cli:alignment .`.

### Acceptance checks

`bun t:docker --suite core` pulls the published image and runs local acceptance on the daemon's native architecture without hosted inference or credentials. Pulling and optional Defuddle preparation may need network access; failed runs preserve evidence and caches. Use `bun t:docker --help` without starting Docker.

For a local build, use `bun t:docker --suite core --image autoshow-cli:local --pull never`. Pull policies are `always` (default), `missing`, and `never`; pull failure never falls back to a cached tag. The harness resolves an immutable digest/image ID. `--expected-digest` and `--expected-revision` verify identity; `--platform` must match the native daemon architecture.

Acceptance uses the image user unless `--user UID:GID` selects a non-root numeric identity. Reused caches must have compatible ownership and cannot be shared concurrently. `--restricted` drops capabilities and blocks privilege escalation. Targeted context, language-data, and persistent-state checks live in `test/docker-acceptance/`; they do not replace native release acceptance on both architectures.

## Run

```bash
bun autoshow --version
bun autoshow extract input/examples/document/harborlight-field-notes.pdf --provider tesseract --no-chapters
docker run --rm autoshow-cli:local --version
docker run --rm autoshow-cli:local help extract
```

### Mount the current working directory

Mount the source workspace and set its container working directory. Paths and the default `./output` resolve there:

```bash
docker run --rm -i \
  --mount "type=bind,src=$(pwd),dst=/workspace" \
  --workdir /workspace \
  autoshow-cli:local extract input/examples/document/harborlight-field-notes.pdf --provider tesseract --no-chapters
```

Only mounted host files are available. Use container-relative paths or add mounts; an unmounted host-absolute path cannot work. This quick invocation has disposable state. For persistent assets and Linux host-owned output, use the workspace function below.

### Separate input and output mounts

```bash
docker run --rm \
  -v "$(pwd)/input:/app/input:ro" \
  -v "$(pwd)/output:/app/output" \
  autoshow-cli:local extract input/examples/document/harborlight-field-notes.pdf --provider tesseract --no-chapters
```

The image does not bundle user inputs. Here paths resolve from `/app`; output goes to `/app/output` unless `--output-root` changes it.

## Provider Credentials

The entrypoint intentionally disables Bun's automatic `.env` loading. Supply credentials with Docker's `--env-file` option or `-e KEY=value`:

```bash
docker run --rm \
  --env-file .env \
  -v "$(pwd)/input:/app/input:ro" \
  -v "$(pwd)/output:/app/output" \
  autoshow-cli:local write input/examples/tts/harborlight-chapters/01-first-light.md --provider openai=gpt-6.1-sol --prompt shortSummary
```

Docker reads the host file and exports its entries; it does not mount the file. `-e` overrides the same key from `--env-file`. Already-exported container environment variables remain supported.

## Doctor

`setup --doctor` checks the installed toolchain without hydration, installation, or provider calls. Linux doctor verifies managed receipts, wrappers, payload integrity, and resources without launching tool capability probes; setup performs functional probes before activation, and native image acceptance exercises OCR and rendering. Help, version, and `setup --dry-run` are also read-only. On a fresh empty runtime bind mount, run `setup` once to activate the image payload before checking readiness. Warnings about omitted engines, weights, Defuddle, and unconfigured provider keys are expected unless those capabilities are supplied separately.

## Long requests and keepalive

Docker sets `AUTOSHOW_DISABLE_HTTP_KEEPALIVE=1` for affected Docker Desktop networks. Set it to `0` to restore pooling; native runs retain pooling unless explicitly disabled. Ordinary bridge networking is supported, and cancellation deadlines still end stalled requests.

## Large provider responses

Successful bodies are read whole or rejected under their payload ceiling: explicitly classified control responses use 16 MiB; the default `result` class, including status polls unless otherwise classified, uses 512 MiB; downloads held in memory use 2 GiB. Paid results streamed directly to disk have no ceiling. User URL sources stream to disk under a 16 GiB ceiling and 10-minute deadline.

Set `AUTOSHOW_HTTP_PAYLOAD_MAX_BYTES` to a positive whole byte count to replace in-memory ceilings; `1073741824` allows 1 GiB. It can raise, but never lower, the source-download ceiling. Malformed values fail at startup. Allow memory for concurrent decoding and disk space for sources. Predictable inline TTS sizes are checked before dispatch; other oversize results can already be billed and are not automatically retried. See [ADR-019](adr/ADR-019-read-successful-http-bodies-whole-under-a-payload-class-ceiling.md).

## Project Workspace Invocation

Export `AUTOSHOW_WORKSPACE` as the absolute project root, create its `.env`, and run `mkdir -p "$AUTOSHOW_WORKSPACE/.autoshow/home"` as your host user. This function preserves literal arguments, persistent state, and Linux host ownership; Docker failures never trigger native execution.

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

The optional `AUTOSHOW_REQUIRED_IMAGE_MODEL` line requires exactly one matching OpenAI image selection for image-producing commands; all-provider selection fails. Help, version, and `comic generate-images --qa-only` are exempt. Violations exit 64 before pricing/output setup. Remove the line for unrestricted models.

`/app/runtime` retains installed tools, package/model/font caches, temporary workspaces, locks, voice assets, identities, and the default `runtime/autoshow.json`. The optional `/home/bun` mount supplies a stable user home for explicit browser-cookie integration; application caches remain under runtime. Custom Linux users need host-owned writable runtime and output directories. Keep credentials and identity/voice state out of broad evidence uploads. `AUTOSHOW_IMAGE` selects a tag or digest.

### Restricted input/output invocation

This opt-in wrapper exposes only read-only input plus writable output/state/home, drops capabilities, and prevents privilege escalation. It retains bridge networking and the keepalive workaround; filesystem/resource limits otherwise remain Docker defaults.

```bash
autoshow_restricted() (
  autoshow_workspace=${AUTOSHOW_WORKSPACE:?Set AUTOSHOW_WORKSPACE to the absolute project root}
  mkdir -p "$autoshow_workspace/input" "$autoshow_workspace/output" "$autoshow_workspace/.autoshow/home" || exit
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

For example, `autoshow_restricted extract input/document.png --provider tesseract` reads the mounted input and writes under `output/`. Source paths must remain inside the input mount. State survives disposable containers; missing mounts and Docker failures never trigger native fallback.

## Security pin maintenance

Review shared Bun/Deno/yt-dlp and Debian snapshot pins after scheduled security audits and before releases changing them. Rebuilding an old snapshot does not acquire later fixes. Update pins together and validate the exact candidate with scans and native AMD64/ARM64 acceptance before promotion; retain inventories, advisory dispositions, and acceptance evidence.

## Docker-only Network Diagnostic

`setup --network-check serve|probe` is separate from installation, configuration, and doctor. It uses no providers. Defaults are port 8787, delay 150 seconds, and REST probe; `--delay-seconds` accepts 1–600.

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

Wait for readiness in fixture logs and stop that named fixture on success, failure, or interruption. Inspect occupied names/ports instead of deleting unrelated containers. The listener is loopback-published; some Linux configurations cannot route its host gateway to that mapping.

Probes accept only HTTP origins on localhost, loopback, or `host.docker.internal` and reject redirects. `--probe-client fetch` uses raw Bun fetch; `fetch-no-keepalive` disables pooling. Results include `passed` and `elapsedSeconds`; failures exit nonzero. With `--json`, serve readiness is diagnostic stderr and shutdown emits one terminal result.
