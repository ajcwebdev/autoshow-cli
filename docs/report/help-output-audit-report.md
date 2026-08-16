# CLI Help Output Audit

Status: Phases 1–5, 6.1–6.4, and 7 implemented; Phase 6.5–6.7 remaining

Date: 2026-08-15

## Overview

This report tracks AutoShow CLI help accuracy, remaining Global Flags work, and a later pass that removed leftover or bakeable flags. The audit covered root help, primary commands, comic workflow subcommands, and the shared Global Flags block. Recommendations are limited to verified help defects, small consistency fixes, maintainability refactors, and flags that are leftover, unused, or better baked into code. A prior draft of twenty provider-generalization proposals was discarded: those changes would have mixed distinct provider semantics or weakened validation without fixing a help defect.

Phases 1–5 cleaned command help, removed `benchmark`, and locked the contracts. Phase 6.1–6.4 then made global-flag help and dispatch share one allowlist. Phase 7 removed four public flags that were leftover or bakeable and kept `--prompt-md`. Remaining work is `--allow-over-budget` applicability, off-by-default boolean defaults, and the last Phase 6 regression checks.

## Current Help Surfaces

Live surfaces: root, `config`, `setup`, `links`, `resume`, `metadata`, `download`, `extract`, `write`, `tts`, `voice`, `image`, `video`, `music`, `comic`, and the comic children `draft-scenes`, `generate-images`, `generate-audio`, `generate-slideshow`, `reference-sketch`, and `reference-voice`. Built-in `version` and `help` stay under contract tests but are not separate audit rows. `benchmark` is gone: production code, registration, dedicated tests, and the command doc are deleted; `docs/benchmarks/` run data and shared pipeline code remain.

| Surface                                               | Current globals                                           | Notes                                                                                                                                                                                   |
| ----------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root                                                  | Remaining `GLOBAL_FLAG_DEFINITIONS`                       | Still lists `--characters-root` and `--allow-over-budget`. `--model-path` is gone. Cookie flags are gone.                                                                               |
| Config                                                | No `--output-dir`, `--model-path`, or `--characters-root` | `--price` gone. Cookie flags live under Auth. `--allow-over-budget` still advertised. ElevenLabs streaming-latency default is gone.                                                     |
| Setup, links                                          | No `--output-dir`, `--model-path`, or `--characters-root` | `--repeat` gone from setup. `--allow-over-budget` still advertised.                                                                                                                     |
| Resume, write                                         | No `--model-path` or `--characters-root`                  | Cookie flags gone. `--keep-ocr-page-inputs` gone. `--model-path` is no longer a current flag.                                                                                           |
| Metadata, download, extract, tts, image, video, music | No `--model-path` or `--characters-root`                  | Cookie flags gone from metadata/download/extract. `--keep-ocr-page-inputs` gone from extract/write/resume.                                                                              |
| Voice, comic, and comic children                      | `--characters-root` advertised; no `--model-path`         | `--output-dir` hidden on `voice` and `comic reference-voice`. Comic generate-audio no longer exposes WAV mastering flags. `--allow-over-budget` still advertised, including on `voice`. |
| Benchmark                                             | Removed                                                   | `benchmark --help` is an unknown command.                                                                                                                                               |

## Completed Work

Phase 1 fixed low-risk wording and metadata: dropped ineffective `config --price`, removed the conflicting `--prompt` `[default: []]`, standardized examples on `bun autoshow`, made the version description imperative, and hid the legacy `--panel-video` alias while still accepting it.

Phase 2 removed the `benchmark` command. `JsonObject` moved to `src/types/runtime-core/json-types.ts` first. Then the command tree, `src/utils/voice-quality-scoring.ts`, `src/types/benchmarks/`, dedicated tests, and `docs/commands/setup-and-utilities/benchmark/benchmark.md` were deleted. ADR-012 is superseded. Retention checks keep `docs/benchmarks/`, `.claude/skills/consensus`, and shared pipeline code.

Phase 3 fixed renderer and dispatcher metadata: parent commands render `<subcommand>` in the usage line, `voice` now points at per-subcommand help, long examples stack instead of padding every row, group separators are empty lines, and `--output-dir` is hidden and rejected on commands that do not create a run directory.

Phase 4 derived `comic reference-voice` actions from `VOICE_SUBCOMMAND_DEFINITIONS` (including `clone`), grouped the reference-voice flag wall by action, reused family group labels across `config`/`write`/`resume`/`extract`/`tts`, and made flag metadata the sole source for ordinary rendered defaults.

Phase 5 moved `COMMAND_DEFINITIONS` and `HELP_COMMAND_GROUP_BY_NAME` to `src/cli/command-definitions.ts` so help tests walk the live tree, compare advertised flags to registered non-hidden keys, and pin persisted video input destinations. Verification: `bun run check`, `bun t --price`, and the CLI help/usage-error/flag-group contracts.

Phase 6.1–6.4 generalized applicability. `commandAcceptsGlobalFlag` and `globalFlagsForCommand` in `src/cli/native/global-flag-support.ts` now drive both help filtering and dispatcher rejection. `--model-path` is gone. `--characters-root` is allowed only on `voice` and `comic`, including subcommands. `--cookies` and `--cookies-from-browser` left the global surface and persist on `config` as `auth.cookies` / `auth.cookiesFromBrowser`; the dispatcher applies them through `applyConfiguredYtDlpAuth`. Explicit use of a narrow global or cookie flag on an unsupported command exits 2 with a hint.

Phase 7 removed leftover and bakeable flags. `setup --repeat` and its timing helpers are gone. `--elevenlabs-tts-optimize-streaming-latency` is gone from flags, config, and the ElevenLabs request path. `--keep-ocr-page-inputs` is gone from the public CLI; success still cleans up page PDFs, and resilience tests can still pass internal `keepPageInputs`. Comic generate-audio bakes 48 kHz stereo 24-bit PCM WAV instead of exposing `--sample-rate`, `--channels`, and `--codec`. `--prompt-md` stays: the extra markdown few-shot file is useful when pasting a prompt into a chat window.

## Remaining Work: Phase 6.5–6.7

Root help continues to list every remaining global capability. Command pages should list only the globals that command can honor. Explicit use on an unsupported command should fail the same way `--output-dir` already fails.

### 6.5 Hide and reject `--allow-over-budget` where budget is not honored

Allow on priced pipeline and generation commands that already thread `allowOverBudget` through preflight or batch budget checks: `download`, `extract`, `write`, `resume`, `tts`, `image`, `video`, `music`, and the comic generation subcommands that estimate cost.

Hide and reject on `config`, `setup`, `links`, `version`, and `help`. Hide and reject on `voice` until voice budget checks honor the flag: voice currently hard-fails on `--max-cents` and ignores `--allow-over-budget`. Do not fold `--allow-over-budget` into `--max-cents`.

### 6.6 Stop rendering `[default: false]` on off-by-default global booleans

Remove the metadata `default: false` from `--help`, `--version`, `--verbose`, `--quiet`, `--json`, and `--allow-over-budget`, or teach the renderer to omit boolean false defaults. Keep parser behavior: omitted booleans stay false. Leave semantic default notes on `--config-path`, `--output-root`, `--log-level`, `--log-format`, and `--color`.

`boolFlag` in `src/cli/flags/flag-utils.ts` still sets `default: false`, so either the helper or the renderer must change. An omitted `default` key is required; `default: undefined` would still render.

### 6.7 Remaining tests and verification

Already covered by 6.1–6.4: advertised globals come from `globalFlagsForCommand`; `--model-path` is gone; `--characters-root` is limited to `voice`/`comic`; cookie flags live on `config` only.

Still needed:

- Assert `--allow-over-budget` is absent from `voice` and `config` help, and that `voice --allow-over-budget` exits 2.
- Assert off-by-default global booleans no longer render `[default: false]`.
- Run `bun run check`, `bun t --price`, `bun test test/test-cases/validation/cli/cli-help-contracts.test.ts`, and `bun test test/test-cases/validation/cli/cli-usage-errors.test.ts`.

## Phase 7: Remove Leftover and Bakeable Flags

Implemented 2026-08-15. This pass asked whether any public flags can be deleted because they are leftover, unused, or knobs the project should bake in. It does not collapse provider-specific controls.

### 7.1 Remove `setup --repeat` — done

Leftover from the deleted `benchmark` command. It only looped a setup step and printed median/p90 timings.

- Removed the flag from `src/cli/flags/setup-flags.ts`.
- Removed parse/validation and the `--models` conflict entry in `define-setup-command.ts`.
- Collapsed `runSetupStep` to a single run and deleted `computeMedian`, `computeP90`, and `logBenchmarkResults`.
- Setup help no longer advertises `--repeat`. `docs/benchmarks/` and shared pipeline code stay.

### 7.2 Remove `--elevenlabs-tts-optimize-streaming-latency` — done

Streaming-quality tradeoff on the non-streaming `POST /text-to-speech/{id}` path. AutoShow waits for full chunks.

- Removed the flag, option-resolution field, config schema key, `FLAG_TO_CONFIG_PATH` entry, selection/invocation types, and request query wiring.
- Saved `defaults.post.tts.elevenlabsTtsOptimizeStreamingLatency` is now a strict-schema reject.
- Help, option-resolution, config, resume-surface, and ElevenLabs provider contracts no longer mention the flag.

### 7.3 Remove `--keep-ocr-page-inputs` — done

Debug keep of intermediate page PDFs after hosted OCR fallback succeeds. Failures already retain those inputs for resume.

- Removed the public flag and `keepOcrPageInputs` from option resolution and extraction option types.
- Production hosted OCR no longer passes `keepPageInputs`, so success cleanup stays the default.
- Internal `keepPageInputs` remains on `pdf-chunk-fallback.ts` for resilience tests.

### 7.4 Bake comic generate-audio mastering — done

`--sample-rate`, `--channels`, and `--codec` exposed the project mastering profile. Defaults were already `48000` / `2` / `pcm_s24le`.

- Removed the three flags from `comic-flags.ts`.
- `generate-audio` now uses `DEFAULT_COMIC_SOUNDSCAPE_MIX_PROFILE` for both soundscape mix and TTS mastering.
- Mastering stays identity-bearing; it is just no longer user-tunable.

### Kept: `--prompt-md`

Considered for removal because nothing downstream reads `prompt-md.md`. Kept because the extra markdown few-shot file pastes cleanly into a chat window, while the normal JSON prompt file makes the model reply with JSON.

### Next tier, not planned

OCR `--format tsv`/`hocr` (fake formats), Deepgram container/bit-rate/sample-rate (remastered to WAV), `--epub-bun` inspect mode, and Grok storage filename/expiry.

## Policy

Do not invent generic flags or collapse provider-specific controls. Removals are allowed when a flag is leftover, unused, or bakeable. Keep `--prompt-md`. Keep `--json` and `--verbose` as documented shortcuts. Keep `--cookies` and `--cookies-from-browser` as two yt-dlp modes, configured only through `config`. Keep `--bin-dir`, `--config-path`, `--color`, `--output-root`, and the logger flags global. `--output-root` stays on every command page.

## Completion Criteria

- Help advertises only flags the named command accepts.
- Canonical examples use `bun autoshow`.
- Defaults appear once and describe actual behavior.
- Shared aliases stay backward compatible without cluttering primary help.
- Shared action lists come from one registry.
- Provider-specific controls stay specific when semantics differ.
- Subcommand parents show a `<subcommand>` placeholder.
- `benchmark` stays removed; `docs/benchmarks/` and shared pipeline code stay intact.
- Large flag surfaces use group headers; equivalent option families share the same label.
- No help line is whitespace-only; example descriptions stay within the column cap.
- Command help advertises only globals that command can honor; root help still lists the remaining global set.
- Narrow globals (`--characters-root` and `--allow-over-budget`) are hidden and rejected where they are no-ops. `--model-path` is gone.
- Cookie auth is configured only through `bun autoshow config`.
- `--output-root` remains a true global.
- Leftover and bakeable flags stay gone: `setup --repeat`, `--elevenlabs-tts-optimize-streaming-latency`, `--keep-ocr-page-inputs`, and comic `--sample-rate` / `--channels` / `--codec`.
- `--prompt-md` remains available.
