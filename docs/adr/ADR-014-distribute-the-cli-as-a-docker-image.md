# ADR-014: Docker Distribution

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-24
- **Date Updated:** 2026-11-14
- **Verification Status:** Passed

## Context

Container users need a useful local-tool baseline without installing Bun, building native tools, or bundling every model engine. Debian slim provides the distribution source for an application-owned native payload, including Calibre, which the image activates beneath `runtime/`.

## Decision

Distribute a Debian slim local-lite image alongside [native setup](ADR-004-setup-toolchain-and-runtime-configuration.md). Pin the Bun base by digest; run bundled JavaScript CLI and preflight assets as non-root `bun` from `/app`. The initial launcher can validate syntax and render help, dry-run, and doctor output without installing runtime packages. Processing initializes a missing managed launcher from the immutable distribution payload under `/app/runtime`; later invocations preserve valid runtime-owned upgrades. Setup uses the trusted initial Bun so it can repair a broken managed launcher. Image arguments are CLI arguments, a bare run prints help, and `setup --doctor` provides offline diagnostics. This is a run-to-completion CLI, with no service ports or HTTP health endpoint.

Include FFmpeg/ffprobe, pinned yt-dlp with Deno, Tesseract English OCR, MuPDF, qpdf, Calibre, ImageMagick/Pango, and DejaVu fonts. Package third-party library, resource, delegate, and font dependencies with the runtime-owned executables. Exclude heavy engines, weights, Defuddle, and credentials. The optional `alignment` target adds the frozen CPU alignment graph under runtime; default `production` omits it. Source, bundled application assets, frozen manifests, and seed payloads remain root-owned/read-only to the runtime user. The installed project package graph lives beneath runtime; the root `node_modules` entry is a validated relative lookup link.

Inject credentials only with Docker `--env-file` or `-e`. The entrypoint disables Bun's automatic `.env` loading; mounting a file at `/app/.env` is not a supported credential path. Bind-mount user data and persist `/app/runtime` for configuration, assets, identities, installed dependencies, caches, locks, and temporary state. Linux callers can select host UID/GID with writable state mounts for host-owned output.

Tools use the shared managed resolver. Fresh writable runtime mounts are initialized from the image's immutable seed without network access; active tools do not fall back to global executable lookup. Tesseract uses verified runtime English data; invalid managed data fails in OCR, setup, and doctor. A read-only doctor against an uninitialized empty mount reports missing managed tools rather than installing them. Omitted capabilities receive ordinary workflow diagnostics. HTTP keepalive is disabled by default for affected Docker Desktop networks; `AUTOSHOW_DISABLE_HTTP_KEEPALIVE=0` restores pooling.

### Publication

Image-input changes on `main` produce GHCR candidates for native `linux/amd64` and `linux/arm64`. Verification, native smoke tests, and vulnerability scans precede a full-commit-SHA candidate. Every native core, model, and public-network acceptance shard must pass against its immutable digest before that same index becomes `latest`. Failed/skipped acceptance and docs-only pushes preserve the previous `latest`.

The managed distribution includes curated package-catalog metadata for relocated native files. Before the existing advisory scan, verify the runtime receipt against the actual payload and require every managed package name/version to appear as a native Debian/Ubuntu package in the generated SPDX inventory. Language packages inside both native payload copies must retain their file-based Debian ownership relationships so distribution patches remain attributable. Missing package or ownership coverage fails verification; package relocation never removes a dependency from the vulnerability gate.

## Trade-offs

Debian slim covers Calibre and the complete tool baseline at greater size than Alpine. Prebuilt multi-architecture images avoid per-user builds but add release maintenance; native workflows remain available. Explicit mounts and credential injection preserve disposable, non-root execution while requiring callers to manage persistent state and ownership.

## Verification

```bash
bun test test/test-cases/validation/cli/docker-image-contracts.test.ts
bun test test/test-cases/validation/cli/docker-runtime-recipe.test.ts
```

Local contracts check recipe/runtime behavior and promotion gates. They do not establish acceptance of a newly built image; native release verification follows the [Docker guide](../docker.md#acceptance-checks).

## References

- [Docker guide](../docker.md)
- [HTTP payload policy](ADR-019-read-successful-http-bodies-whole-under-a-payload-class-ceiling.md)
- `Dockerfile` and `.github/workflows/docker-publish.yml`
