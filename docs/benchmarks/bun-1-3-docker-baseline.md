# Bun 1.3 Docker Baseline

Date: 2026-08-31

This baseline preserves the production-image measurements needed to evaluate the Bun 1.4 migration. It uses the current exact base image, `oven/bun:1.3.14-slim@sha256:d56a2534ffd262e92c12fd3249d3924d296d97086da773f821d7d0477435ea04`, without changing any Bun version surface or calling a hosted provider.

## Source identity

- Git revision: `399df322adfcb37da7337bb693353c6835cb1f1a`; the measured candidate worktree contained the Phase 1 and Phase 2 changes, while the Docker Bun pin and dependency lock remained unchanged.
- Dockerfile SHA-256: `02ef2ea810a375a2ebf34d7ef693c510da00ba5f8f437b9f7e1de70fe28e91e8`.
- `package.json` SHA-256: `d69e25e63a3cea61100a13904e0178a991a34b0c506a171ef5b87a49e0536c9e`.
- `bun.lock` SHA-256: `7e36e75b714e1ae5c1b38181054d2dc1e9e56f14b27667b4cf98fc8d17be94c7`.
- `tsconfig.json` SHA-256: `72ad395500f1370335090ec54da0c9d9181862f103a080ef558921637949f663`.
- Deterministic `src/` tree SHA-256: `48e05cc88bfca2a947a2aa9270aedafe66666f894cf9ac0f2916eac6f2e70697`.
- Fixture: `input/examples/document/30-document.pdf`, 571,633 bytes, SHA-256 `e395620917bd93dc0ca37e23c50f695aac6344542ecad49a6e315778f54b053d`.
- Docker client and server: 29.7.2; Darwin ARM64 client and Linux ARM64 Docker Desktop server.
- Linux transparent huge pages during both container measurements: `[always] madvise never`.

The fixture workload is local Tesseract OCR with `--ocr-concurrency 1`. It receives no provider credentials and makes no hosted provider request.

## Results

| Platform | Execution mode | Bun | Image ID | Image size | Cold `--help` median | CLI prebuild median | Fixture peak RSS median |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| `linux/amd64` | Docker Desktop emulation | 1.3.14 | `sha256:5d2fcc9b66cbe1424b9da59865916a4c0cecc62cba2eef42673b2c08f105d354` | 615.73 MiB | 2,237.96 ms | 723.56 ms | 410.87 MiB |
| `linux/arm64` | Native ARM64 Linux VM | 1.3.14 | `sha256:f2d4d1c557af48e6513028b6b6f8d6e7d1aff08de61d38d6ee14f3f037a1ff73` | 601.51 MiB | 290.71 ms | 77.61 ms | 107.90 MiB |

Cold help uses five fresh `docker run` processes and host wall time. The AMD64 samples were 2,233.87, 2,272.41, 2,201.87, 2,262.63, and 2,237.96 ms. The ARM64 samples were 295.40, 290.71, 279.60, 286.58, and 303.03 ms.

CLI prebuild uses five fresh containers and measures `bun build /app/src/cli/create-cli.ts --target=bun --outfile /tmp/autoshow-cli-baseline.js` with in-container `performance.now()`. The AMD64 samples were 670.91, 641.05, 723.56, 784.22, and 812.42 ms. The ARM64 samples were 77.61, 81.76, 76.53, 74.34, and 83.68 ms.

Peak RSS uses cgroup v2 `memory.peak` after the local fixture completes in each of three fresh containers. The AMD64 samples were 460,587,008, 430,825,472, and 410,738,688 bytes. The ARM64 samples were 135,864,320, 113,139,712, and 109,428,736 bytes.

AMD64 timing and memory values include emulation overhead and must be compared only with a Bun 1.4 run using the same Docker Desktop execution mode. Native AMD64 release evidence remains a separate release-runner requirement.

## Reproduction

The repository command builds separate platform images, verifies their architecture and Bun version, runs all measurements, and writes exact command arrays plus raw samples under the ignored `runtime/profiling/bun-docker-baseline/` directory:

```sh
bun baseline:docker --platform all --repeats 5 --fixture-repeats 3
```

The recorded run built the final images per platform and then collected the final combined sample set with:

```sh
bun baseline:docker --platform all --repeats 5 --fixture-repeats 3 --skip-build
```

After the Bun pin changes, use the first command with the same Docker host, fixture, sample counts, and execution modes. Compare medians and raw samples; do not compare a native row with an emulated row.
