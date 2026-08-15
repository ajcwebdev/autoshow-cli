# CLI Help Output Audit and Improvement Plan

Status: Audit completed; implementation pending

Date: 2026-08-15

## Overview

This report audits 22 representative AutoShow CLI help surfaces and defines a focused improvement plan. The audit covers root help, primary commands, and comic workflow subcommands. Recommendations are limited to verified help defects, small consistency improvements, and maintainability refactors supported by the current implementation.

The previous version included 20 broad consolidation proposals. Most would have combined options with different provider semantics, weakened validation, or introduced compatibility risk without demonstrating a help-output defect. Those proposals have been removed in favor of the 10 evidence-backed actions below.

## Audit Scope

The following help surfaces were reviewed:

1. `bun autoshow --help`
2. `bun autoshow config --help`
3. `bun autoshow setup --help`
4. `bun autoshow links --help`
5. `bun autoshow resume --help`
6. `bun autoshow benchmark --help`
7. `bun autoshow metadata --help`
8. `bun autoshow download --help`
9. `bun autoshow extract --help`
10. `bun autoshow write --help`
11. `bun autoshow tts --help`
12. `bun autoshow voice --help`
13. `bun autoshow image --help`
14. `bun autoshow video --help`
15. `bun autoshow music --help`
16. `bun autoshow comic --help`
17. `bun autoshow comic draft-scenes --help`
18. `bun autoshow comic generate-images --help`
19. `bun autoshow comic generate-audio --help`
20. `bun autoshow comic generate-slideshow --help`
21. `bun autoshow comic reference-sketch --help`
22. `bun autoshow comic reference-voice --help`

The built-in `version` and `help` pages remain covered by CLI help contract tests but are not counted as separate audited surfaces in this matrix.

## Executive Summary

The CLI help system is generally accurate, well grouped, and strongly covered by contract tests. The audit found a small number of concrete defects and consistency issues:

1. `config --help` exposes `--price`, although config explicitly treats it as runtime-only and does not perform price estimation.
2. `--prompt` renders two conflicting-looking defaults: the semantic fallback `"default"` and parser storage default `[]`.
3. Config examples use `bun as` while the canonical public invocation used elsewhere is `bun autoshow`.
4. The built-in version command uses third-person wording while neighboring command descriptions use imperative wording.
5. `comic reference-voice` claims to mirror shared voice management but omits the supported `clone` action.
6. `comic generate-audio` publicly displays the legacy `--panel-video` alias even though `--slideshow` is the canonical term.
7. Command help displays the global `--output-dir` flag even on commands where the dispatcher rejects it.
8. Many flag descriptions repeat defaults that the help renderer already appends from flag metadata.
9. Help tests and command/action lists contain manually duplicated registries that can drift from the actual command tree.
10. The report itself previously contained unsupported provider-generalization proposals, stale paths, and contradictory claims.

## Audit Matrix

| Index | Help surface | Result | Follow-up |
|---|---|---|---|
| 01 | Root | Pass with minor wording issue | Align version command wording. |
| 02 | Config | Needs improvement | Remove `--price`, clean prompt default rendering, and standardize examples. |
| 03 | Setup | Pass | Remove duplicated rendered defaults as part of the shared cleanup. |
| 04 | Links | Pass | Ensure unsupported `--output-dir` is not advertised. |
| 05 | Resume | Pass with presentation issue | Clean prompt default rendering and hide unsupported `--output-dir`. |
| 06 | Benchmark | Pass | Keep modality-specific selectors and judge options. |
| 07 | Metadata | Pass | No command-specific change. |
| 08 | Download | Pass | No command-specific change. |
| 09 | Extract | Pass | Keep transcript-video inputs distinct from lyric-video caption inputs. |
| 10 | Write | Pass with presentation issue | Clean prompt and other duplicated defaults. |
| 11 | TTS | Pass | Retain provider-specific controls where semantics differ. |
| 12 | Voice | Pass with global-flag issue | Hide unsupported `--output-dir`. |
| 13 | Image | Pass | Retain provider capability constraints. |
| 14 | Video | Pass | Retain provider-specific options and persisted reusable video inputs. |
| 15 | Music | Pass with presentation issue | Remove duplicated rendered defaults. |
| 16 | Comic | Pass | No parent-command change. |
| 17 | Comic draft-scenes | Pass | No command-specific change. |
| 18 | Comic generate-images | Pass | No command-specific change. |
| 19 | Comic generate-audio | Needs minor cleanup | Hide legacy `--panel-video` alias while preserving parsing. |
| 20 | Comic generate-slideshow | Pass | No command-specific change. |
| 21 | Comic reference-sketch | Pass | No command-specific change. |
| 22 | Comic reference-voice | Needs correction | Add `clone`, derive actions from the shared registry, and hide unsupported `--output-dir`. |

## Verified Findings

### 1. Ineffective `config --price`

`src/cli/flags/config-flags.ts` adds `priceFlag` to `configCommandFlags`, so `config --help` advertises price estimation. However, `src/cli/commands/setup-and-utilities/config/config-merge.ts` lists `price` in `RUNTIME_ONLY_FLAGS`, and the config command does not execute a pipeline or estimate cost.

The fix is to remove `priceFlag` from the config flag composition. `--max-cents` remains a valid persistent pricing setting.

### 2. Confusing `--prompt` Default

`src/cli/flags/shared-flags.ts` defines `--prompt` with a semantic fallback of `"default"` in its description and an empty array parser default. `src/cli/native/help-renderer.ts` therefore renders both `(default: "default")` and `[default: []]`.

The parser does not need an explicit empty-array default because prompt resolution already handles an omitted value. Removing the metadata default is narrower and safer than teaching the renderer to inspect prose.

### 3. Inconsistent Example Prefix

`src/cli/commands/setup-and-utilities/config/define-config-command.ts` uses `bun as` in its examples. Other command help and the root definition use `bun autoshow` as the canonical public spelling.

Only the config examples need updating; command aliases can continue to work without being mixed into canonical help.

### 4. Version Description Wording

`src/cli/native/builtins.ts` describes the version command as `Prints current version`, while the related flag and neighboring descriptions use imperative wording.

Change the command description to `Print current version`.

### 5. Missing Comic Voice Clone Action

`VOICE_SUBCOMMAND_DEFINITIONS` in `src/cli/commands/process-steps/step-4-tts/voice-management/define-voice-command.ts` includes `voice clone`. The `ACTIONS` list in `src/cli/commands/process-steps/step-8-comic/comic-commands/reference-voice/reference-voice-command.ts` omits it even though the alias flag set already includes clone options such as `--kind` and `--sample`.

The comic alias should derive its valid actions from the shared voice definitions rather than maintaining an independent list. This adds `clone` and prevents future drift.

### 6. Public Legacy Alias

`src/cli/flags/comic-flags.ts` displays both `--slideshow` and `--panel-video`, with the latter documented as an alias. The command handler already accepts either spelling.

Mark `--panel-video` as hidden help metadata while keeping it registered and accepted. Removing the flag definition entirely would break parsing before alias resolution.

### 7. Unsupported Global Flag in Command Help

`src/cli/native/help-renderer.ts` unconditionally prints every global flag on every command page. `src/cli/native/dispatcher.ts` rejects `--output-dir` for commands that do not create run directories, including `config`, `setup`, `links`, `resume`, `voice`, and `comic reference-voice`.

Move the run-directory capability check into shared metadata or a shared predicate and use it for both dispatch validation and command-help filtering. Root help should continue to list `--output-dir` as a global capability.

### 8. Duplicated Default Values

The renderer appends defaults from each flag definition, but many descriptions also contain prose such as `(default: all)`. This produces output such as `(default: all) [default: "all"]` and creates two values that can drift independently.

Flag metadata should be the sole source for ordinary rendered defaults. Descriptions should retain only meaningful qualifications, such as a provider-specific override that differs from the general default.

### 9. Registry Drift Risk

The command tree, command help groups, reference-voice actions, and help-test command lists are duplicated in several places. This has already caused observable drift: the comic alias omitted `clone`, and `help-flag-groups.test.ts` omitted the `voice` command.

Tests should consume exported command definitions where practical, and derived action lists should come from shared subcommand definitions. Registry refactoring should remain small and should not change command routing.

### 10. Report Accuracy

The previous report treated persisted video inputs as silently discarded, but `config-merge.ts` provides destinations for `video-input-image`, `video-last-frame`, `video-reference-image`, and `video-input-video`. Persisting reusable video references is supported behavior, so those flags should remain in config unless a separate product decision and migration plan justify removal.

The previous report also proposed generic provider options for controls that differ by model, provider, type, or lifecycle. Those proposals are rejected below.

## Top 10 Improvement Plan

### 1. Remove `--price` from Config Help

- Remove the `priceFlag` import and spread from `src/cli/flags/config-flags.ts`.
- Keep `--max-cents` under Pricing.
- Keep the runtime-only guard in config merging as defense in depth.
- Add a help contract asserting that config displays `--max-cents` but not `--price`.

### 2. Clean Up `--prompt` Default Rendering

- Remove `default: []` from the shared prompt flag definition.
- Preserve the semantic `"default"` fallback in prompt resolution and help prose.
- Assert that config, resume, and write help no longer display `[default: []]`.
- Cover omitted and repeated prompt parsing to ensure behavior remains unchanged.

### 3. Standardize Examples on `bun autoshow`

- Update all config examples from `bun as config` to `bun autoshow config`.
- Add or retain help contracts requiring the canonical prefix.
- Do not remove supported aliases from runtime behavior.

### 4. Align Version Command Wording

- Change `Prints current version` to `Print current version` in the built-in command definition.
- Assert consistent root-help wording.

### 5. Add and Derive the Comic Voice `clone` Action

- Derive valid reference-voice actions from `VOICE_SUBCOMMAND_DEFINITIONS`.
- Ensure `clone` routes its identity to the shared handler as `subjectKey`.
- Keep registration-ID routing for lifecycle actions unchanged.
- Test action parity between the shared voice surface and the comic alias.

### 6. Add Focused Regression Tests and Correct Report Claims

- Extend `test/test-cases/validation/cli/cli-help-contracts.test.ts` for the accepted help changes.
- Update command-tree coverage so every registered command and comic subcommand renders help.
- Keep report assertions tied to source behavior rather than manually counted flag totals.
- Correct stale paths, counts, and compatibility claims when implementation changes land.

### 7. Run Required Verification

- Run `bun run check`.
- Run `bun t --price`.
- Run `bun test test/test-cases/validation/cli/cli-help-contracts.test.ts`.
- Run `bun test test/test-cases/validation/cli/cli-usage-errors.test.ts` when global-flag filtering changes.
- Run `bun test test/test-cases/validation/cli/option-resolution-contracts/` when prompt parsing changes.

### 8. Hide the Legacy `--panel-video` Alias

- Keep `--panel-video` registered so existing scripts remain valid.
- Mark it hidden in help metadata and continue resolving it as an alias for `--slideshow`.
- Assert that help shows only `--slideshow` while parser coverage confirms that both spellings work.

### 9. Hide Unsupported `--output-dir` Flags

- Extract the command run-directory capability from the dispatcher into shared code or command metadata.
- Filter `--output-dir` from command-level global help when the command cannot create a run directory.
- Preserve `--output-root`, which remains the suggested base-directory override.
- Assert that run-producing commands display `--output-dir` and non-run commands do not.

### 10. Use Flag Metadata as the Default Source

- Remove duplicate ordinary default prose where a flag already has a `default` field.
- Preserve provider-specific exceptions and behavioral notes that metadata cannot express.
- Add a contract that prevents descriptions from restating the same concrete default.
- Spot-check setup, shared concurrency, OCR, URL, TTS, and music help after cleanup.

## Rejected Consolidations

The following classes of changes are intentionally excluded from this plan:

- Generic video audio/reference flags: Replicate and fal.ai models have different support, limits, and validation requirements.
- Universal media seeds: provider ranges and fan-out behavior differ, and a generic value would be ambiguous in multi-provider runs.
- Composite concurrency strings: existing concurrency flags control distinct resource domains and retain stronger typing and validation.
- Benchmark provider syntax replacement: benchmark selectors define a scoring matrix rather than ordinary pipeline provider selection.
- Transcript/lyric caption unification: transcript-video inputs and VTT/SRT lyric captions are different artifact types.
- Generic provider language mapping: synthesis language, transcript language, voice locale, and dialect boosts are not interchangeable.
- Generic negative prompts or prompt expansion: no cross-provider image/video capability currently supports the proposed common contract.
- Generic TTS pitch, volume, and emotion: provider controls have different types and meanings.
- Comic/general speaker-map unification: comic role mappings resolve through approved durable registrations and have stricter governance.
- Global request retries: provider retries can affect billing and idempotency and require a separate safety design.
- Generic image compression/background support: current BFL and Recraft target validation explicitly rejects these OpenAI-specific controls.
- Generic judge flags: text, vision, and audio judges require different capabilities and defaults.
- Generic multi-shot video flags: Kling shot-plan JSON and PixVerse multi-clip booleans are distinct controls.
- Comic/provider audio-format unification: provider response encoding and final local WAV mastering are different layers.
- Composite voice settings: replacing typed flags with an untyped key-value string would weaken validation and discoverability.
- Removing Grok storage flags: remote API storage filename and TTL are not replacements for local `--output-dir` behavior.

## Completion Criteria

This audit is complete when all accepted changes are implemented, targeted tests pass, required verification succeeds, and generated help satisfies these contracts:

- Help advertises only flags accepted by the named command.
- Canonical examples consistently use `bun autoshow`.
- Defaults appear once and describe actual behavior.
- Shared aliases remain backward compatible without cluttering primary help.
- Shared command surfaces derive their action lists from one authoritative registry.
- Provider-specific controls remain specific when their semantics differ.
