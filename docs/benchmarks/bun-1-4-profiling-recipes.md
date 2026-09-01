# Bun 1.4 Profiling Recipes

AutoShow keeps generated CPU profiles, heap profiles, bundle metafiles, compiled probe bundles, logs, and metadata under the ignored `runtime/profiling/bun-runtime/` directory. Every profiling run records the exact child commands, Bun version, package-manager pin, platform, architecture, duration, exit status, and the fact that dotenv loading was disabled. The recipes inherit only `HOME` and `PATH`; they do not receive provider credentials and do not execute provider calls.

## CPU profiles

Run `bun profile:cpu` to generate Markdown CPU profiles for `autoshow --help` startup and the no-cost `bun t --price` path. The command writes `cli-help.cpu.md`, `test-price.cpu.md`, child logs, and `metadata.json` into one timestamped run directory.

Use the same recipe before and after a startup or price-planning optimization, then compare the profile summaries and the command durations in the two metadata files. This recipe does not run test cases or provider commands.

## Heap profile

Run `bun profile:heap` to exercise a deterministic synthetic RSS/XML workload and a large synthetic OCR-style page-normalization workload under `--heap-prof-md`. The fixture contains no user or source-book content. The run writes `local-parsing-normalization.heap.md`, a checksum-bearing workload observation, child logs, and metadata.

## Reference-tokenizer cache profile

Run `bun profile:tokenizer` to record four separate Markdown heap profiles: before the rank map is loaded, after the 199,998-entry map is loaded, after explicit eviction and forced garbage collection, and after deterministic reconstruction. `reference-tokenizer-memory-summary.json` records the total heap parsed from each profile, cache entry counts, memory-usage counters, and token-ID hashes. The after-load and after-reconstruction hashes must match.

## Bundle analysis

Run `bun profile:bundle` to build the same `src/cli/create-cli.ts` entrypoint used by the test prebuild and generate both JSON and Markdown metafiles. The accompanying `bundle-inventory.json` lists the largest input modules, dynamic imports, prompt JSON files and bytes, the tokenizer rank asset, and source-layout references using `import.meta.dir`. Review that inventory before moving assets, changing dynamic imports, or experimenting with a standalone executable.

## Complete capture

Run `bun profile:all` to execute all four no-cost recipes into one timestamped directory. Any recipe accepts `--output-dir <path>` after the script selector when invoked directly, for example `env -i PATH="$PATH" HOME="$HOME" bun --no-env-file scripts/bun-profile.ts bundle --output-dir runtime/profiling/bun-runtime/before-bundle-change`.

Generated artifacts are diagnostic evidence and are not committed. Checked benchmark summaries should contain only aggregate measurements, fixture identities, commands, and conclusions.

## Initial Bun 1.4 capture

The initial complete capture ran on macOS ARM64 with Bun 1.4.0. The ignored evidence is under `runtime/profiling/bun-runtime/2026-08-31T22-45-35-532Z-all/`. CPU-profiled CLI help completed in 110.36 ms and the CPU-profiled no-cost price inventory completed in 2,333.79 ms; these durations include profiler overhead and are comparison baselines, not unprofiled startup claims. The synthetic 12,000-item XML and 16,000-page normalization workload completed in 121.60 ms and retained a 3,951,966-byte profiled heap. The test CLI bundle completed in 55.07 ms and produced 4,908,694 bytes before any compiled-entrypoint optimization.

The bundle inventory found 38 prompt JSON files totaling 84,549 bytes, the 1,689,761-byte compressed tokenizer rank asset, seven dynamic-import edges, and the current `import.meta.dir` source-layout references. The largest source input was Valibot at 206,613 bytes; the largest AutoShow source input was comic revision evaluation at 54,721 bytes. These are inventory measurements, not automatic candidates for removal.

| Tokenizer state | Cache entries | Profiled heap bytes | Token hash |
| --- | ---: | ---: | --- |
| Before load | 0 | 2,050,968 | not loaded |
| After load | 199,998 | 21,144,252 | `1bb6c00c…c561b` |
| After eviction and GC | 0 | 2,917,478 | `1bb6c00c…c561b` |
| After reconstruction | 199,998 | 21,149,377 | `1bb6c00c…c561b` |

Eviction reduced the profiled heap by 86.20% relative to the loaded state. Reconstruction returned to within 0.03% of the loaded profile and produced the identical complete token hash, supporting eviction of this cache while leaving durable and in-flight state untouched.
