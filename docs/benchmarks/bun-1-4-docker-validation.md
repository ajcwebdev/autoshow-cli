# Bun 1.4 Docker Validation

Date: 2026-08-31

This report compares the migrated production image with the checked [Bun 1.3 Docker baseline](bun-1-3-docker-baseline.md). The same Docker Desktop host, fixture, repeat counts, execution modes, and measurement definitions were used. No hosted provider credential was passed to a container and no hosted provider call was made.

## Native ARM64 result

The native ARM64 image built successfully, accepted `bun --no-env-file install --frozen-lockfile --production`, reported Bun 1.4.0, and passed containerized `--help`, `config --show`, and `setup --doctor` smoke commands. Expected doctor warnings cover tools and model assets intentionally excluded from the image; the Bun runtime and included local tools were detected.

| Measurement | Bun 1.3.14 | Bun 1.4.0 | Change |
| --- | ---: | ---: | ---: |
| Image size | 601.51 MiB | 599.52 MiB | -0.33% |
| Cold `--help` median | 290.71 ms | 256.21 ms | -11.87% |
| CLI prebuild median | 77.61 ms | 58.48 ms | -24.65% |
| Fixture peak RSS median | 107.90 MiB | 64.15 MiB | -40.55% |

The Bun 1.4 image ID was `sha256:8af606cf46c72726726ba4ca6c54872478724bebff0d806e66f4572325c5f667`. Cold-help samples were 274.23, 249.38, 248.40, 269.57, and 256.21 ms. CLI prebuild samples were 58.48, 59.09, 62.24, 57.90, and 56.63 ms. Peak-RSS samples were 68,014,080, 67,264,512, and 66,351,104 bytes.

The native image build took 94,531.15 ms. The corresponding uncached Bun 1.3 native build artifact recorded 92,684.48 ms, a 1.99% increase; this small one-sample build-time difference is not treated as a runtime regression and native CI records a fresh build duration for each architecture.

Raw commands, samples, source hashes, Docker identity, image identity, and logs are retained under the ignored `runtime/profiling/bun-docker-baseline/2026-08-31T22-35-43-273Z/` directory. The preceding final-image build record is under `runtime/profiling/bun-docker-baseline/2026-08-31T22-35-20-971Z/`. Container smoke logs are retained under the ignored `runtime/profiling/bun-docker-smoke/arm64/` directory.

## AMD64 status

The AMD64 image built on the same ARM64 Docker Desktop host, but Bun 1.4.0 did not produce `--help` output under QEMU and remained at zero CPU with approximately 38 MiB RSS for more than two minutes. The run was stopped and its build metadata and log were preserved under `runtime/profiling/bun-docker-baseline/2026-08-31T22-20-27-664Z/`. Before that run, executing the architecture-neutral yt-dlp fetch with target-architecture Bun also triggered a Bun memory-exhaustion abort under QEMU; the fetch stage now runs on Docker's native build platform, while the final runtime image remains target-specific.

The Bun 1.3 AMD64 numbers were also emulated and therefore cannot substitute for native release evidence. The publish workflow now performs the frozen production install, help/config/doctor smokes, five cold-help samples, five prebuild samples, three peak-RSS samples with the tracked local setup fixture, and image-size recording on a native Ubuntu AMD64 runner. The ARM64 build job performs the identical checks on a native Ubuntu ARM64 runner. The multi-architecture manifest cannot publish unless both jobs succeed, and each job uploads its logs and measurement JSON for review. The native CI peak-RSS fixture is identical across architectures but is intentionally reported separately from the larger local baseline fixture.

Native AMD64 evidence is therefore a release-gate artifact produced on the next push, not a claim inferred from the failed emulated run.

## Dotenv compatibility

The redacted compatibility probe compared the local `.env` with the exact Bun 1.3.14 and Bun 1.4.0 base images. All 36 discovered keys produced matching parsed values. The report contains key names and one-run salted SHA-256 hashes only; it contains no credential values and does not retain the salt. The raw report is stored under the ignored `runtime/profiling/bun-env-compat/` directory.

Reproduce the comparison without printing values with:

```sh
bun compare:env
```

Pass `--platform linux/amd64` or `--platform linux/arm64` to select a Docker architecture explicitly. A changed, missing, or added parsed result makes the command fail.
