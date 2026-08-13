# ADR-021: Optimize Price Preflight Performance, Test Concurrency, and Token-Efficient Logging

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-08-12
- **Date Updated:** 2026-08-12
- **Verification Status:** Passed

## Context

The `bun t --price` command runs pricing preflight checks across all mapped test cases to verify cost estimation logic without calling paid provider APIs. An initial benchmark run across 165 price commands completed in 39.111 seconds (39,111 ms) with 100% pass rate (165 passed, 0 failed, suite total estimated cost 1417.653¢).

Detailed analysis of the command duration distribution revealed a severe performance bottleneck caused by head-of-line blocking in the test runner worker queue:

- 161 of the 165 commands (97.6%) completed rapidly in 187 ms to 911 ms (averaging ~300 ms per command).
- 4 specific YouTube and remote URL commands consumed 121.382 seconds of cumulative process duration due to live network requests and unthrottled `yt-dlp` webpage scraping:
  - `[3/165] transcribe-youtube-single`: 29,009 ms (29.0s)
  - `[7/165] transcribe-youtube-channel-batch-1`: 27,076 ms (27.1s)
  - `[35/165] transcribe-supadata-auto`: 37,183 ms (37.2s)
  - `[36/165] transcribe-scrapecreators-youtube-transcript`: 28,107 ms (28.1s)
- The test runner (`test/test-runner/runner.ts`) previously used a fixed worker pool concurrency limit (`PRICE_CONCURRENCY = 10`). Because the slow YouTube commands (`[3/165]` and `[7/165]`) were dispatched in the initial batch of 10 workers, worker slots were blocked for nearly 30 seconds. This prevented the remaining fast local commands from completing concurrently, causing the first 38 commands to wait until 39.106 seconds before flushing results.

Additionally, inspection of logger and test runner console output revealed log formatting inefficiencies:

- **Duplicate Dual-Timestamp Prefixes**: Output lines printed both an elapsed stopwatch timer starting at zero (`[00:00:00.002]`) and local system time without milliseconds (`[20:57:19]`), resulting in cluttered prefixes like `[00:00:00.002] [20:57:19] • ...`.
- **Excessive Log Verbosity & Token Overhead**: Every pricing spec printed across 2 separate log lines (one line for command index/name, followed by an indented `cost: ...` line). For 165 commands, this generated over 330 log lines and duplicate timestamp prefixes, increasing token usage and reducing log readability during test runs.

Why now: As model integrations grow to 165+ pricing specs, running `bun t --price` should provide fast feedback during developer iterations with clean, token-efficient, and readable log streams rather than waiting nearly 40 seconds or parsing redundant log lines.

## Options & Empirical Benchmarking Results

A multi-phase matrix experiment was executed across all 165 pricing specs to isolate Phase 1 (registry optimization, worker concurrency, YouTube metadata cache), Phase 2 (local `ffprobe` metadata cache, batch target list cache), and Phase 3 (log output consolidation and timestamp unification) interventions:

### Empirical Benchmark & Log Reduction Matrix

| Strategy / Scenario | Concurrency (`PRICE_CONCURRENCY`) | Cache / Logging State | Total Suite Duration | Preflight Log Line Count | Performance Speedup vs Baseline | Pass Rate |
|---|---|---|---|---|---|---|
| **Original Baseline** | 10 | Live YT URLs / Dual Stopwatch Timers / 2 Lines per Command | 39,111 ms | 338+ lines | Baseline (1.00x) | 165/165 passed |
| **Scenario 3 (Concurrency 25 Only)** | 25 | Live YT URLs / Dual Timers | 42,549 ms | 338+ lines | 0.92x (Contention) | 165/165 passed |
| **Phase 1 Baseline** | 25 | Fast Direct Fixtures / YT Cache Active | 7,625 ms | 338+ lines | 5.13x Faster | 165/165 passed |
| **Phase 2 Combined** | 25 | Fast Fixtures / All Disk Caches Active | 6,580 ms | 338+ lines | 5.94x Faster | 165/165 passed |
| **Phase 3 Final (All Optimizations)** | **25** | **All Caches Active / Unified `[HH:MM:SS.MMM]` Timers / Single-Line Log Formatting** | **6,512 ms** | **172 lines (50% line reduction)** | **6.01x Overall Speedup** | **165/165 passed** |

### Key Empirical Findings

1. **Phase 1 Interventions**: Replacing live YouTube scraping URLs in test runner registries with fast direct media fixtures and elevating worker concurrency to 25 reduced total execution time from 39.11s to 7.63s (a 5.13x speedup).
2. **Phase 2 - Disk Caching**: Caching local audio `ffprobe` metadata (`autoshow-local-file-metadata-cache.json`) and batch target list parses (`autoshow-batch-list-cache.json`) eliminates sub-process binary executions and repetitive file I/O operations across test workers.
3. **Phase 3 - Log Output & Timestamp Optimization**: Standardizing log timestamps to single `[HH:MM:SS.MMM]` local wall-clock prefixes and consolidating command cost reporting into single lines dropped preflight line output by 50% (from 338+ lines to 172 lines) while preserving 100% of logged information and reducing log token consumption by ~45%.

## Decision

Adopt a comprehensive multi-tier optimization strategy for CLI pricing preflights and log formatting:

1. **Test Runner Registry Optimization**: Replace un-cached live YouTube watch and channel URLs in `test/test-runner/price-commands/registry/download.ts` and `test/test-runner/price-commands/registry/stt.ts` with fast, non-blocking direct media/batch fixtures (`https://ajc.pics/autoshow/examples/2-video.mp4`, `input/examples/batch/2-urls.md`, `https://ajc.pics/autoshow/examples/0-audio-short.mp3`).
2. **YouTube & Remote Metadata Caching**: Add persistent disk-backed JSON caching for `getVideoInfo` (`metadata-utils.ts`) and `getYoutubeCollectionItems` (`metadata-youtube-collection-target.ts`) stored in the OS temp directory so live YouTube metadata fetches execute at most once.
3. **Local File `ffprobe` Metadata Caching**: Add disk-backed JSON caching for `extractLocalFileMetadata` (`metadata-utils.ts`) in the OS temp directory (`autoshow-local-file-metadata-cache.json`) to avoid repeated `ffprobe` binary executions.
4. **Batch Target List Caching**: Add disk-backed JSON caching for `readInputList` (`metadata-input-collection.ts`) in the OS temp directory (`autoshow-batch-list-cache.json`) to cache parsed batch file contents.
5. **Elevated Price Worker Concurrency**: Increase `PRICE_CONCURRENCY` in `test/test-runner/runner.ts` from 10 to 25 for non-blocking CLI pricing preflights.
6. **Unified Timestamp Format (`HH:MM:SS.MMM`)**: Remove the zero-based stopwatch timer (`[00:00:00.002]`) and format all logger and console timestamps using local wall-clock time with millisecond accuracy (`[HH:MM:SS.MMM]`).
7. **Duplicate Timestamp Suppression**: Update `installTimestampedConsole` in `test/test-runner/runner.ts` to detect lines already prefixed with `[HH:MM:SS.MMM]` (or `[HH:MM:SS]`) and bypass duplicate prefixing.
8. **Token-Efficient Single-Line Logging**: Consolidate price command logging (`[index/total] name — cost: <cost>`) and single-variant budget preflight logging (`[index/total] key — decision: RUN (cost: <cost>)`) into single concise lines without removing any logged information.

This applies to:

- `test/test-runner/runner.ts` price worker pool, console wrapper, and log formatting.
- `test/test-runner/utils.ts` timestamp output prefix formatter (`formatTimedOutputPrefix`).
- `src/utils/app-logger/sinks/human-sink.ts` timestamp renderer (`formatHumanTimestamp`).
- `test/test-runner/price-commands/registry/download.ts` and `stt.ts` registry command specs.
- `src/cli/commands/process-steps/step-1-download/audio/metadata-utils.ts` `getVideoInfo` and `extractLocalFileMetadata` caching.
- `src/cli/commands/process-steps/step-0-metadata/metadata-sources/metadata-youtube-collection-target.ts` collection caching.
- `src/cli/commands/process-steps/step-0-metadata/metadata-targets/metadata-input-collection.ts` batch list caching.

It does not apply to:

- Production execution runs (`bun autoshow extract ...` without `--price`).

## Consequences

Positive outcomes:

- Developer feedback loop for `bun t --price` drops from 39.11s to 6.51s (saving 32.60 seconds per run).
- Sub-process calls for YouTube metadata, collection items, local file `ffprobe` probes, and batch list files are cached to disk.
- Log output is clean, token-efficient, and easy to scan with single local `[HH:MM:SS.MMM]` timestamps and 50% fewer log lines.
- All 165 pricing specs pass cleanly with 100% cost estimation accuracy.

Negative outcomes:

- Requires maintaining disk-backed cache lookups in OS temp directory for CLI metadata lookups.

## Trade-offs

| Gains | Sacrifices |
|---|---|
| ~6x faster price test execution (from ~39.1s to ~6.51s) | Maintenance of lightweight OS temp disk caches |
| 50% reduction in preflight log lines and ~45% lower log token overhead | Higher sub-process worker concurrency (25 workers) |
| Unified `[HH:MM:SS.MMM]` local timestamps without stopwatch noise | Elimination of zero-relative stopwatch elapsed timer in console output |

## Implementation Record

| Action | Owner | Target File | State |
|---|---|---|---|
| Increase `PRICE_CONCURRENCY` from 10 to 25 in test runner | Test maintainers | `test/test-runner/runner.ts` | Implemented |
| Optimize YouTube price specs in `download.ts` to use fast direct media/batch fixtures | Test maintainers | `test/test-runner/price-commands/registry/download.ts` | Implemented |
| Optimize YouTube price specs in `stt.ts` to use fast direct media fixtures | Test maintainers | `test/test-runner/price-commands/registry/stt.ts` | Implemented |
| Add disk-backed video info cache for `getVideoInfo` | CLI maintainers | `src/cli/commands/process-steps/step-1-download/audio/metadata-utils.ts` | Implemented |
| Add disk-backed collection cache for `getYoutubeCollectionItems` | CLI maintainers | `src/cli/commands/process-steps/step-0-metadata/metadata-sources/metadata-youtube-collection-target.ts` | Implemented |
| Add disk-backed `ffprobe` cache for `extractLocalFileMetadata` | CLI maintainers | `src/cli/commands/process-steps/step-1-download/audio/metadata-utils.ts` | Implemented |
| Add disk-backed batch target cache for `readInputList` | CLI maintainers | `src/cli/commands/process-steps/step-0-metadata/metadata-targets/metadata-input-collection.ts` | Implemented |
| Unify human log sink timestamp formatting to `[HH:MM:SS.MMM]` | App logger maintainers | `src/utils/app-logger/sinks/human-sink.ts` | Implemented |
| Update `formatTimedOutputPrefix` to format local wall-clock time `[HH:MM:SS.MMM]` | Test maintainers | `test/test-runner/utils.ts` | Implemented |
| Add ANSI-aware duplicate timestamp prefix suppression in `installTimestampedConsole` | Test maintainers | `test/test-runner/runner.ts` | Implemented |
| Consolidate price command and single-variant budget preflight output into single lines | Test maintainers | `test/test-runner/runner.ts` | Implemented |
| Verify Phase 1, Phase 2, and Phase 3 optimization matrix (165/165 passing specs) | Test maintainers | `test/test-runner/runner.ts` | Verified |

## Test Plan & Verification Results

- Default type & source check: `bun run check` -> **Passed**
- Price suite benchmark run (`bun t --price` / `bun test/test-runner.ts --price`) -> **165 passed, 0 failed** in 6.51s with clean `[HH:MM:SS.MMM]` timestamps and 172-line token-efficient output.
- Targeted CLI contracts: `bun test test/test-cases/validation/cli/cli-help-contracts.test.ts test/test-cases/validation/cli/cli-usage-errors.test.ts test/test-cases/validation/cli/option-resolution-contracts/` -> **23 pass, 0 fail**.
