# ADR-014: Docker Distribution

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-24
- **Date Updated:** 2026-11-14
- **Verification Status:** Passed

## Context

Container users need a useful local-tool baseline without installing Bun, building native tools, or bundling every model engine. Debian slim supplies the required tools, including Calibre, through one package manager.

## Decision

Distribute a Debian slim local-lite image alongside [native setup](ADR-004-setup-toolchain-and-runtime-configuration.md). Pin the Bun base by digest; run the source CLI as non-root `bun` from `/app`. Image arguments are CLI arguments, a bare run prints help, and `setup --doctor` provides offline diagnostics. This is a run-to-completion CLI, with no service ports or HTTP health endpoint.

Include FFmpeg/ffprobe, pinned yt-dlp with Deno, Tesseract English OCR, MuPDF, qpdf, Calibre, ImageMagick/Pango, and DejaVu fonts. Exclude heavy engines, weights, Defuddle, and credentials. The optional `alignment` target adds CPU alignment; default `production` omits it. Source, dependencies, and frozen manifests remain root-owned/read-only to the runtime user.

Inject credentials only with Docker `--env-file` or `-e`. The entrypoint disables Bun's automatic `.env` loading; mounting a file at `/app/.env` is not a supported credential path. Bind-mount user data and persist `/app/runtime` and `/home/bun` for configuration, assets, identities, and caches. Linux callers can select host UID/GID with writable state/home mounts for host-owned output.

Tools use normal Linux resolution. Tesseract prefers valid managed English data and otherwise uses packaged data, including with an empty runtime mount; invalid managed data fails in OCR, setup, and doctor. Omitted capabilities receive ordinary workflow diagnostics. HTTP keepalive is disabled by default for affected Docker Desktop networks; `AUTOSHOW_DISABLE_HTTP_KEEPALIVE=0` restores pooling.

### Publication

Image-input changes on `main` produce GHCR candidates for native `linux/amd64` and `linux/arm64`. Verification, native smoke tests, and vulnerability scans precede a full-commit-SHA candidate. Every native core, model, and public-network acceptance shard must pass against its immutable digest before that same index becomes `latest`. Failed/skipped acceptance and docs-only pushes preserve the previous `latest`.

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
