# Duplication Consolidation Archive

Date: 2026-08-09. Status: complete. All 48 approved mechanical consolidation waves landed on `staging`; there is no remaining mechanical backlog in this report. Higher-risk redesign work lives in `behavioral-consolidation-report.md`.

## Outcome and accounting

The program removed 5,139 net lines from `src/` and `test/`. Net means deleted lines minus added helper, adapter, type, import, and call-site lines; documentation is excluded. The archive was re-audited from each implementation commit's `git show --numstat` output. The first 27 wave figures reconcile to their commit batches, waves 28–35 were re-partitioned by their disjoint file footprints, and waves 36–48 were re-partitioned by diff hunk and dependency overlap.

| Implementation commit | Waves | Net lines removed |
|---|---:|---:|
| `70907228` | 1–5 | 1,482 |
| `90ae5109` | 6–14 | 1,792 |
| `4cee163d` | 15–27 | 838 |
| `2a468393` | 28–35 | 532 |
| `3035df9c` | 36–48 | 495 |
| Total | 1–48 | 5,139 |

The previous report overstated waves 1–35 by one line: wave 34 removed 45, not 46, so the correct subtotal is 4,644 rather than 4,645. It also described waves 36–48 as an additive ~512-line forecast even though that number included about eight O-3 lines already assigned to X-3. The comparable non-overlapping forecast was about 504; actual removal was 495, nine lines lower.

## Landed waves

| Wave | ID | Consolidation | Actual net |
|---:|---|---|---:|
| 1 | CLI-1 | Shared scalar, list, and boolean flag readers | 551 |
| 2 | G-1 | Shared generation status logging | 293 |
| 3 | TE-1 | Shared TTS contract-suite lifecycle | 275 |
| 4 | R-1 | Table-driven generation resume clear/collect/price helpers | 180 |
| 5 | S-2 | Shared STT polling-deadline and resume-probe errors | 183 |
| 6 | S-3 | Shared whisper.cpp/whisperfile runner core | 135 |
| 7 | O-1 | Shared token-priced OCR estimator | 143 |
| 8 | T-2 | Runtime-key-derived TTS/image/video option types | 134 |
| 9 | X-2 | Canonical concurrency mapper | 126 |
| 10 | X-1 | Canonical API-key guards across provider runners | 441 |
| 11 | T-1 | Domain option types and key unions | 230 |
| 12 | S-1 | Shared synchronous STT request lifecycle | 289 |
| 13 | TT-1 | Shared hosted-TTS chunk pipeline | 145 |
| 14 | B-1 | Table-driven config merge | 149 |
| 15 | O-2 | Shared hosted-OCR JSON schemas and parser factory | 97 |
| 16 | D-1 | Generic CLI option picker and packed model-key arrays | 160 |
| 17 | TE-2 | Shared config/default test fixtures | 110 |
| 18 | G-3 | Shared Replicate video option type | 75 |
| 19 | U-1 | Shared hosted URL JSON transport and key guard | 68 |
| 20 | TE-3 | Shared report-test temporary-root lifecycle | 65 |
| 21 | S-5 | Shared remote STT resource deletion | 60 |
| 22 | CLI-2 | Shared long-flag argument rewriter | 37 |
| 23 | C-1 | Shared grouped comic reference resolver | 49 |
| 24 | B-3 | Table-driven cheapest-model selectors | 58 |
| 25 | B-5 | Generic media benchmark run loader | 31 |
| 26 | B-4 | Shared OpenAI benchmark judge transport | 16 |
| 27 | R-2 | Shared generation-resume preamble and target resolution | 12 |
| 28 | S-4 | AssemblyAI/Gladia adoption of the shared STT request lifecycle | 152 |
| 29 | B-2 | Shared media comparison rows and report writer | 47 |
| 30 | TT-2 | MiniMax adoption of the shared audio concatenator | 57 |
| 31 | G-4 | Shared polled-image HTTP transport | 49 |
| 32 | TE-4 | Canonical mock-fetch recorder adoption | 95 |
| 33 | R-3 | Shared setup command capture | 54 |
| 34 | T-3 | Shared pricing type fragments | 45 |
| 35 | C-2 | Shared comic CLI parsing helpers | 33 |
| 36 | S-7 | HappyScribe helper reuse | 40 |
| 37 | W-1 | Shared local-LLM stream tail and startup-failure handling | 28 |
| 38 | TE-5 | Shared voice-quality judge fixtures | 40 |
| 39 | W-2 | Shared local-LLM health and process primitives | 31 |
| 40 | T-4 | Shared resolved-LLM model key type | 40 |
| 41 | X-5 | Shared project-path and caption timestamp helpers | 62 |
| 42 | X-3 | Canonical `isRecord` adoption | 33 |
| 43 | T-5 | Processing-option-derived cost estimate types | 34 |
| 44 | G-5 | Shared VTT/SRT caption parser core | 38 |
| 45 | M-1 | Shared frontmatter value renderer | 46 |
| 46 | O-3 | Shared OCR guards and usage reader | 34 |
| 47 | U-2 | Shared URL article result finalization | 32 |
| 48 | TE-6 | Shared links retry scenario harness | 37 |

## Final-wave estimate audit

| Wave | Planned net | Actual net | Audit note |
|---:|---:|---:|---|
| 36 | 44 | 40 | Import and call-site overhead was four lines higher than modeled. |
| 37 | 43 | 28 | The new helper cost more than the duplicated bodies alone suggested. |
| 38 | 42 | 40 | Near estimate. |
| 39 | 41 | 31 | The shared health module cost more than modeled. |
| 40 | 40 | 40 | Exact. |
| 41 | ~40 | 62 | Existing project-root machinery allowed more deletion than the plan counted. |
| 42 | 39+ | 33 | Only 38 live exact copies remained; exported compatibility sites saved no physical lines. |
| 43 | 39 | 34 | Type aliases required five more lines than modeled. |
| 44 | 38 | 38 | Exact. |
| 45 | 38 | 46 | The common renderer removed more branch scaffolding than counted. |
| 46 | ~28 additive | 34 | The original 36-line estimate overlapped X-3; the remaining OCR extraction beat the overlap-adjusted estimate. |
| 47 | 36 | 32 | The new finalizer cost four more lines than modeled. |
| 48 | 36 | 37 | One line better than estimate. |

The large misses support the program's calibration rule: adopting an existing primitive or deleting surrounding scaffolding can beat an estimate, while extracting a new helper often misses because its signature and call sites were underpriced. The final group happened to balance closely in aggregate despite poor precision at individual-wave level.

## Accepted behavior and compatibility deltas

All unlisted waves were intended to preserve behavior and passed the repository's local verification. The deltas worth retaining for archaeology are:

- Wave 16 changed only built-option property insertion order; wave 23 adds an unused `characterReferences` field to sketch references; wave 26 moved the OpenAI config lookup after media reads.
- Wave 28 standardized AssemblyAI/Gladia retry metadata and `Retry-After` interpretation while preserving user-facing messages.
- Wave 30 changed MiniMax multi-chunk audio from two ffmpeg passes to one, removed the intermediate merged MP3, and adopted the shared concat error stage and message.
- Wave 33 standardized setup failure stages and messages and introduced a benign function-body import cycle between `download.ts` and `run-complete-setup.ts`.
- Wave 46 deliberately made partial OCR cache validation reject a nonnumeric `confidence`, matching the two canonical guards. This closed the old OCR guard divergence.

## Open divergences handed to maintainers

These were discovered during mechanical verification and deliberately not unified. Several are now explicit subwaves or rulings in `behavioral-consolidation-report.md`.

- OCR checkpoint failures omit `stage`, `status`, `retryAfterMs`, and `rawResponseFile` retained by finalization.
- Firecrawl uses the error stage `extract:firecrawl` while peer URL providers use `url:<id>`.
- GLM Reader still omits the shared URL final-URL backfill and author projection and returns `preparedMarkdown` from its provider layer.
- The x-space batch executor hardcodes `extract` where the document variant forwards `commandName`.
- ElevenLabs IVC attaches HTTP status without headers, losing `Retry-After` classification data.
- Write resume throws hand-built exit-code errors where generation resume uses `InfraError`.
- `SttStep2ResolutionOptions` lacks accepted Gemini and Together STT keys.
- OCR cost row joins do not normalize provider/model names like manifest indexing does.
- Deepgram's empty-text TTS guard uses `InfraError` where peer runners use `ValidationError`.
- `text-input-utils.ts` prefixes project-relative paths with `./`; the video renderers use bare relative paths.

## Verification and provenance

Each implementation batch passed `bun run check` and relevant local, no-cost contract tests; no paid-provider command was used for verification. The original scan combined clone detection with subsystem review, then independently re-read and recounted accepted findings. This final archival audit used committed source/test diffs rather than the planning arithmetic, which is why it corrects wave 34 and the overlap-adjusted final forecast.
