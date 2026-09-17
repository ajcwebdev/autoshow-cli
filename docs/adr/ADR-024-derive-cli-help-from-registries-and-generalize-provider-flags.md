# ADR-024: Derive CLI Help From Registries and Generalize Provider-Specific Flags

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-09-16
- **Date Updated:** 2026-09-16
- **Verification Status:** Passed

## Supersession

- Supersedes the concurrency-flag surface of [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md). The lane architecture, admission coordinator, and fair-queue behavior that ADR-008 records remain accepted and unchanged; only its five intra-step flag spellings (`--ocr-concurrency`, `--stt-segment-concurrency`, `--stt-preflight-concurrency`, `--tts-chunk-concurrency`, `--sfx-concurrency`) and `--url-provider-concurrency` are replaced here.
- Supersedes the comic model-selection surface of [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md). Comic still resolves every model through the central LLM and image registries, which is ADR-007's decision; only its bare-model-id flag spellings (`--image-model`, `--llm-model`, `--qa-model`) are replaced here.

## Context

`bun as <cmd> --help` across 30 command and subcommand pages is the primary contract for humans and for agent consumers of this CLI. An audit of every flag definition against its option-resolution code found three classes of defect.

Help stated defaults inconsistently. The renderer prints `[default: …]` only from a flag definition's `default` field, and 31 flag occurrences across 26 unique names encoded their default as prose in the description with no `default` field. Four more had a real default that appeared nowhere in help at all (`--caption-mode`, `--caption-line-width`, `--caption-max-cps`, `--ocr-concurrency`). One advertised a default that was wrong for two common selections: `--tts-chunk-concurrency` rendered `[default: "30"]` while the resolver produced `2` under `--all-providers` and `50` for a Grok-only selection. The existing guard test passed only because it checked the reverse direction — a metadata default restated in prose — and zero flags had both.

Enumerations were hand-maintained copies. About fifteen choice flags hardcoded their value list in the description while a constant for that list already existed elsewhere, so help went stale silently whenever the constant changed.

Provider-specific flags proliferated beside a generic mechanism that already existed. The TTS domain had a provider-general `provider=value` option registry, but ElevenLabs and six STT providers were never folded into it. Capability knowledge was triplicated: `CONTROL_SPECS` in `src/cli/commands/audio/tts/tts-targets/tts-invocation-controls.ts` described per-provider controls for per-turn dialogue, `GENERIC_TTS_OPTION_PROVIDERS` independently restated which providers accept which generic flag, and the valibot config schema restated the same ranges a third time. Concurrency had grown to ten flags across three conflated concepts. Comic selected models by bare ID while every other command used `--provider provider[=model]`.

Why now: agent consumers read `--help` as the contract, and a default that help states wrongly is worse than one it omits. The audit quantified the drift, and the capability tables needed to collapse before any further provider was added on top of three parallel registries.

## Options Considered

**Option 1 (selected)**

- **Option:** Make one capability table per domain the source of truth, derive help text, validation, and defaults from it, and hard-remove the provider-prefixed and per-step flag spellings with no aliases
- **Pros:** Help cannot drift from the code that enforces it; a range change in one table moves the help row, the validator, and the error message together; the flag surface becomes provider-general wherever the capability is
- **Cons:** Breaking rename across the CLI, persisted config keys, and comic resume manifests; one large change touching flag definitions, option resolution, two capability registries, the config schema, help topics, contract tests, and eleven docs
- **Quantitative Notes:** 26 prose defaults corrected, 15 enumerations derived, 6 ElevenLabs and 6 STT flags collapsed into 11 provider-general spellings, 3 previously unexposed controls added, 10 concurrency flags reduced to 4

**Option 2**

- **Option:** Correct the defaults and enumerations only, leaving the provider-prefixed flag surface in place
- **Pros:** Much smaller diff; no rename, no config migration, no resume-manifest invalidation
- **Cons:** Leaves the triplicated capability knowledge that produced the drift, so the same class of defect recurs with the next provider; leaves ten concurrency flags across three conflated concepts
- **Quantitative Notes:** Would have fixed 30 of the 31 default occurrences and none of the structural cause

**Option 3**

- **Option:** Rename with aliases, keeping the old spellings accepted and hidden
- **Pros:** No breaking change for existing invocations or persisted config
- **Cons:** Doubles the surface an agent consumer must reason about; an alias that is accepted but unlisted is exactly the undocumented behavior this change set out to remove; resume manifests would still need to pick one spelling
- **Quantitative Notes:** Would retain 12 retired spellings indefinitely

## Decision

Every advertised default, enumeration, and per-provider range is derived from a single registry, and every option flag whose underlying capability is provider-general is spelled provider-generally as `provider=value`. Old spellings are removed outright rather than aliased.

Concretely: `CONTROL_SPECS` is the one TTS capability table, and `GENERIC_TTS_CONTROL_MAP` maps each generic flag to a control key per provider with a compile-time key check plus a runtime contract test. `STT_ENGINE_CAPABILITIES` gains the option-support fields for all 17 engines and is the one STT capability table, validated at engine level and never at engine+model, because the flag layer runs before model selection is final. A shared `createGenericProviderOptionSelectors` factory instantiates both domains. `STEP_CONCURRENCY_SCOPES` is the one intra-step concurrency registry behind `--step-concurrency <scope>=N`. Comic selects its primary output domain with `--provider` and each auxiliary role with `--<role>-provider`.

Scoped repeatable flags follow one convention with two required halves: the rendered `default` is an array of `key=value` strings derived from the registry, and the resolver never reads that seeded array — it reads explicit occurrences and config-injected values, then falls back to the registry for any key left unassigned.

This applies to:

- Every `default` and enumeration rendered by `bun as <cmd> --help`
- The TTS and STT generic option flags, their config keys, and their validation
- The five intra-step concurrency knobs and the URL provider lane
- Comic image, text, and QA model selection

It does not apply to:

- The runtime option field names (`supadataLang`, `elevenlabsTtsStability`, …), which stay provider-specific because provider-specific adapters consume them and they round-trip through persisted resume state
- The concurrency lane architecture and hosted admission coordinator, which remain as [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md) records them
- Central model registry lifecycle and capability policy, owned by [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)

## Rationale

- A default that help states must be the default the resolver uses. Deriving both from one constant makes drift a type or test error rather than a silent lie.
- The three TTS registries were verified to agree at the time of the audit, but nothing enforced it. Collapsing them removes the class of defect rather than its current instance.
- Five of the six renamed ElevenLabs flags are legitimately single-provider: no other TTS adapter implements stability, similarity, style, speaker boost, seed, or pronunciation dictionaries. Generic in spelling and mechanism while single-provider in fact is the correct outcome, because the mechanism is what lets the next provider join without a new flag.
- Validating STT options at engine level rather than engine+model is required for determinism: `--all-stt` expands to many models, so a flag whose validity depended on the winning model would produce non-deterministic usage errors.
- Comic needs up to three model roles in one invocation, so a single bare `--provider` cannot carry it. `--provider` for the primary domain plus `--<role>-provider` for auxiliaries reuses the idiom `comic generate-audio --sfx-provider` already ships, so the change removes an idiom (bare model IDs) rather than adding one.

## Consequences

Positive outcomes:

- Every rendered `[default: …]` is the value the resolver actually uses, including the array defaults for scoped repeatable flags
- Per-provider value ranges appear in help for the first time: `--tts-speed` now lists all six providers' ranges, derived from `CONTROL_SPECS`
- Three capabilities the control table already defined gained CLI flags with no new plumbing: `--tts-trailing-silence`, `--tts-response-format`, and Hume's description folded into `--tts-instructions`
- A new step concurrency scope costs zero new flags
- The QA vision-capability restriction is structural rather than a hand-written check, and the resume flag-surface allowlist emptied by construction

Negative outcomes:

- Twelve flag spellings are removed with no alias, so existing scripts and saved invocations must be updated
- Persisted config keys for the renamed TTS and STT options change, and old keys now fail to load with a named error
- Comic image and audio resume manifests re-plan once, because those recovery hashes embed flag names

## Trade-offs

**Trade-off 1**

- **Gain:** Help output that cannot drift from the code that enforces it
- **Sacrifice:** A breaking rename across the CLI, persisted config, and comic resume manifests, shipped as one combined change

**Trade-off 2**

- **Gain:** One `--step-concurrency <scope>=N` flag instead of five, with per-scope defaults still machine-rendered
- **Sacrifice:** Scope applicability is a per-command fact carried in flag metadata and validated centrally, which is one more mechanism than five independent flags

**Trade-off 3**

- **Gain:** A short, explicitly-named allowlist is the only way to keep a prose default, so every future one has to justify itself
- **Sacrifice:** Fifteen genuinely provider-dependent or runtime-resolved defaults remain prose, and the allowlist has to be maintained

## Implementation Note

- Capability tables and derivation: `src/cli/commands/audio/tts/tts-targets/tts-invocation-controls.ts`, `src/cli/flags/service-selector-normalization/generic-tts-controls.ts`, `src/cli/commands/stt/stt-cli.ts`, `src/cli/flags/service-selector-normalization/generic-stt-controls.ts`
- Shared selector core: `src/cli/flags/service-selector-normalization/generic-provider-option-selectors.ts`, instantiated by `generic-tts-option-selectors.ts` and `generic-stt-option-selectors.ts`
- Step concurrency registry and central validation: `src/cli/flags/service-selector-normalization/step-concurrency-scopes.ts`, validated once per invocation in `src/cli/native/dispatcher.ts`
- Comic provider selection: `src/cli/flags/service-selector-normalization/provider-targets.ts`, `src/cli/flags/comic-flags.ts`, `src/cli/commands/visuals/comic/comic-utils/comic-argument-readers.ts`
- Retired config keys: `src/cli/commands/setup-and-utilities/config-command/config-loader.ts`

## API / Type Impact

- Removed CLI spellings: `--elevenlabs-tts-stability`, `--elevenlabs-tts-similarity-boost`, `--elevenlabs-tts-style`, `--elevenlabs-tts-use-speaker-boost`, `--elevenlabs-tts-seed`, `--elevenlabs-tts-pronunciation-dictionary-locator`, `--stt-happyscribe-organization-id`, `--stt-supadata-lang`, `--stt-scrapecreators-lang`, `--stt-grok-verbatim`, `--stt-supadata-chunk-size`, `--deepinfra-stt-response-format`, `--ocr-concurrency`, `--stt-segment-concurrency`, `--stt-preflight-concurrency`, `--tts-chunk-concurrency`, `--sfx-concurrency`, `--url-provider-concurrency`, comic `--concurrency`, `--image-model`, `--llm-model`, `--qa-model`, and `--whisper-engine`
- Added CLI spellings: `--tts-stability`, `--tts-similarity`, `--tts-style`, `--tts-speaker-boost`, `--tts-seed`, `--tts-pronunciation-dictionary`, `--tts-trailing-silence`, `--tts-response-format`, `--stt-organization-id`, `--stt-language`, `--stt-verbatim`, `--stt-chunk-size`, `--stt-response-format`, `--step-concurrency`, comic `--qa-provider` and `--llm-provider`
- Config keys: `defaults.tts.{elevenlabsTtsStability,elevenlabsTtsSimilarityBoost,elevenlabsTtsStyle,elevenlabsTtsUseSpeakerBoost,elevenlabsTtsSeed,elevenlabsTtsPronunciationDictionaryLocators}` become `defaults.tts.{stability,similarity,style,speakerBoost,seed,pronunciationDictionary}`; `defaults.extract.stt.{happyscribeOrganizationId,supadataLang,scrapecreatorsLang,deepinfraResponseFormat,grokVerbatim,supadataChunkSize}` become `defaults.extract.stt.{organizationId,language,responseFormat,verbatim,chunkSize}`; `defaults.comic.sfxConcurrency` is added. Step concurrency scopes keep their existing domain-organized JSON paths.
- `TtsRuntimeOptions` gains `humeTtsTrailingSilence`, `humeTtsDescription`, and `mistralTtsResponseFormat`; `TtsTargetSelection` gains `humeTrailingSilence`, `humeDescription`, and `mistralResponseFormat`

## Keep (with rationale)

- Runtime option field names stay provider-specific. They are consumed by provider-specific adapters, they round-trip through persisted resume state in `stt-run-state.ts`, and renaming them would ripple widely for no user-visible benefit. The TTS side already worked this way, with `--tts-voice` resolving into `elevenlabsVoiceId`.
- The image-policy command list in `src/utils/required-image-model.ts` stays explicit rather than derived, because `comic character-sketch` registers no flags of its own and must keep failing closed.

## Test Plan

```
bun run check
bun test test/test-cases/validation/
bun t --price
bun as tts input/examples/tts/01-tts-short.md --provider elevenlabs=eleven_v3 --tts-stability 0.4 --price
bun as extract "https://www.youtube.com/watch?v=MORMZXEaONk" --provider supadata --stt-language es --price
bun as extract input/examples/audio/1-audio.mp3 --step-concurrency stt-segment=3 --price
bun as extract input/examples/audio/1-audio.mp3 --step-concurrency bogus=3
```

1. `bun run check` proves the control-map key types hold and no consumer of a renamed field was missed.
2. The validation suite proves the help contracts, option resolution, config round-trips, resume flag surface, and comic recovery replay all agree with the new spellings.
3. `bun t --price` proves every registered price command still plans without a billable call.
4. The `--tts-stability` run proves a generic flag reaches an ElevenLabs control, and an out-of-range value raises `--tts-stability for elevenlabs: must be at most 1.` from `normalizeControlValue` rather than a reimplemented bound.
5. The `--stt-language` run proves the generic STT option resolves against the selected provider, and that passing it with no selected STT provider now errors instead of silently no-opping.
6. The two `--step-concurrency` runs prove a registered scope is accepted and an unknown scope is rejected with the valid scopes for that command named.

## References

- Related ADR: [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md)
- Related ADR: [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md)
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)
- `src/cli/native/help-renderer.ts`
- `src/cli/native/help-topics.ts`
- [Help output audit report](../reports/02-help-output-audit/help-output-audit-report.md)
