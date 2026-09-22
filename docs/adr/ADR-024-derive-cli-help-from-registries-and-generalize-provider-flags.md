# ADR-024: Derive CLI Help From Registries and Generalize Provider-Specific Flags

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-09-16
- **Date Updated:** 2026-09-22
- **Verification Status:** Passed
- **Supersession:** Replaces the intra-step concurrency spellings and `--url-provider-concurrency` recorded in [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md), and the comic bare-model-id spellings recorded in [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md). ADR-008's lane architecture and fair-queue behavior, and ADR-007's resolution of comic models through the central registries, remain accepted.

## Context

`bun as <cmd> --help` is the contract for people and for agent consumers. An audit of every flag against the value the command actually uses found three kinds of drift.

Defaults were stated inconsistently. Help prints `[default: …]` only when a flag definition sets `default`. Across 26 flag names, 31 occurrences described the default in prose and set no `default` field. Four flags had a real default that help never showed: `--caption-mode`, `--caption-line-width`, `--caption-max-cps`, and `--ocr-concurrency`. `--tts-chunk-concurrency` showed `[default: "30"]` while the command used `2` with `--all-providers` and `50` for a Grok-only selection.

Choice lists were copied by hand. About fifteen flags hardcoded their allowed values in the description even though the command already had a constant for that list, so help went stale when the constant changed.

The same capability was also exposed through provider-specific flags beside a generic `provider=value` mechanism. TTS already had that mechanism; ElevenLabs and six STT providers were never added to it. Which controls exist, which providers accept which flag, and which ranges config allows were maintained as three separate lists. Concurrency had grown to ten flags across three conflated concepts. Comic selected models by bare id, while every other command used `--provider provider[=model]`.

Why now: agent consumers treat `--help` as the contract, and a default help states wrongly is worse than one it omits. The audit measured the drift, and those separate capability lists had to collapse before another provider was added.

## Options Considered

**Option 1 (selected)**

- **Option:** Make one capability table per domain the source of truth, derive help text, validation, and defaults from it, and hard-remove the provider-prefixed and per-step flag spellings with no aliases
- **Pros:** Help cannot drift from the behavior it describes; a range change updates help, validation, and the error together; the flag surface stays provider-general wherever the capability is
- **Cons:** Breaking rename across the CLI, persisted config keys, and comic resume manifests
- **Quantitative Notes:** 26 prose defaults corrected, 15 enumerations derived, 6 ElevenLabs and 6 STT flags collapsed into 11 provider-general spellings, 3 previously unexposed controls added, 10 concurrency flags reduced to 4

**Option 2**

- **Option:** Correct the defaults and enumerations only, leaving the provider-prefixed flag surface in place
- **Pros:** Much smaller diff; no rename, no config migration, no resume-manifest invalidation
- **Cons:** Leaves the separate capability lists that produced the drift, so the same class of defect recurs with the next provider; leaves ten concurrency flags across three conflated concepts
- **Quantitative Notes:** Would have fixed 30 of the 31 default occurrences and none of the structural cause

**Option 3**

- **Option:** Rename with aliases, keeping the old spellings accepted and hidden
- **Pros:** No breaking change for existing invocations or persisted config
- **Cons:** Doubles the surface an agent consumer must reason about; an alias that is accepted but unlisted is undocumented behavior; resume manifests would still need one spelling
- **Quantitative Notes:** Would retain 12 retired spellings indefinitely

## Decision

Every advertised default, enumeration, and per-provider range comes from that domain's capability registry. An option whose capability is provider-general is spelled `provider=value`. Retired spellings are removed outright.

TTS and STT each have one registry, and it supplies the help text, accepted values, defaults, and validation for that domain. STT options are validated for the selected engine, so the result is the same whichever model `--all-stt` selects. Passing an STT option with no STT provider selected is an error. An out-of-range value names the flag, the provider, and the bound.

Intra-step concurrency is `--step-concurrency <scope>=N`. Comic selects its primary output with `--provider provider[=model]` and each auxiliary role with `--<role>-provider`.

A scoped repeatable flag prints its defaults as `key=value` entries from the registry. An explicit occurrence or a config value overrides that key. A key left unset uses the registry default.

This applies to:

- Every `default` and enumeration rendered by `bun as <cmd> --help`
- The TTS and STT generic option flags, their config keys, and their validation
- The five intra-step concurrency knobs and the URL provider lane
- Comic image, text, and QA model selection

It does not apply to:

- Provider-specific fields stored in resume state and read by provider adapters. Existing resume directories keep those names.
- The concurrency lane architecture and hosted admission coordinator, which remain as [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md) records them
- Central model registry lifecycle and capability policy, owned by [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)

## Rationale

- A default that help states must be the default the command uses. Deriving both from one registry makes a mismatch fail a check.
- TTS capabilities were maintained in three places that happened to agree. One registry removes that class of drift.
- Stability, similarity, style, speaker boost, seed, and pronunciation dictionaries exist only on ElevenLabs today. A generic spelling lets the next provider that supports one of them use the same flag.
- An STT flag whose validity depended on the winning model would change the usage error across models in one `--all-stt` run. Engine-level validation keeps that error stable.
- Comic can need an image model, a text model, and a QA model in one invocation. `--provider` carries the primary domain and `--<role>-provider` carries the others, the same pattern as `comic generate-audio --sfx-provider`.

## Consequences

Positive outcomes:

- Every rendered `[default: …]` is the value the command uses, including the `key=value` defaults on scoped repeatable flags
- Help shows each provider's accepted range. `--tts-speed` lists the providers that accept a numeric speed, and notes that ElevenLabs `eleven_v3` rejects numeric speed
- `--tts-trailing-silence`, `--tts-response-format`, and Hume's description on `--tts-instructions` are available. Those capabilities already existed and had no flag
- A new step concurrency scope adds no new flag

Negative outcomes:

- Retired spellings are removed with no alias, so existing scripts and saved invocations must be updated
- Persisted config keys for the renamed TTS and STT options change, and old keys fail to load
- Comic image and audio resume manifests re-plan once, because those recovery hashes embed flag names

## Trade-offs

**Trade-off 1**

- **Gain:** Help output that matches the behavior it describes
- **Sacrifice:** A breaking rename across the CLI, persisted config, and comic resume manifests, shipped as one combined change

**Trade-off 2**

- **Gain:** One `--step-concurrency <scope>=N` flag instead of five, with per-scope defaults still printed in help
- **Sacrifice:** A scope from another command is rejected. The error names the scopes the current command accepts

**Trade-off 3**

- **Gain:** A printed `[default: …]` is the value the command uses
- **Sacrifice:** Eighteen defaults that depend on the provider or the run remain described in prose

## API / Type Impact

- Removed CLI spellings: `--elevenlabs-tts-stability`, `--elevenlabs-tts-similarity-boost`, `--elevenlabs-tts-style`, `--elevenlabs-tts-use-speaker-boost`, `--elevenlabs-tts-seed`, `--elevenlabs-tts-pronunciation-dictionary-locator`, `--stt-happyscribe-organization-id`, `--stt-supadata-lang`, `--stt-scrapecreators-lang`, `--stt-grok-verbatim`, `--stt-supadata-chunk-size`, `--deepinfra-stt-response-format`, `--ocr-concurrency`, `--stt-segment-concurrency`, `--stt-preflight-concurrency`, `--tts-chunk-concurrency`, `--sfx-concurrency`, `--url-provider-concurrency`, comic `--concurrency`, `--image-model`, `--llm-model`, `--qa-model`, and `--whisper-engine`
- Added CLI spellings: `--tts-stability`, `--tts-similarity`, `--tts-style`, `--tts-speaker-boost`, `--tts-seed`, `--tts-pronunciation-dictionary`, `--tts-trailing-silence`, `--tts-response-format`, `--stt-organization-id`, `--stt-language`, `--stt-verbatim`, `--stt-chunk-size`, `--stt-response-format`, `--step-concurrency`, comic `--qa-provider` and `--llm-provider`
- Config keys: `defaults.tts.{elevenlabsTtsStability,elevenlabsTtsSimilarityBoost,elevenlabsTtsStyle,elevenlabsTtsUseSpeakerBoost,elevenlabsTtsSeed,elevenlabsTtsPronunciationDictionaryLocators}` become `defaults.tts.{stability,similarity,style,speakerBoost,seed,pronunciationDictionary}`; `defaults.extract.stt.{happyscribeOrganizationId,supadataLang,scrapecreatorsLang,deepinfraResponseFormat,grokVerbatim,supadataChunkSize}` become `defaults.extract.stt.{organizationId,language,responseFormat,verbatim,chunkSize}`; `defaults.comic.sfxConcurrency` is added. Step concurrency scopes keep their existing domain-organized JSON paths.

## Test Plan

```bash
bun run check
bun test test/test-cases/validation/
bun t --price
bun as tts input/examples/tts/01-tts-short.md --provider elevenlabs=eleven_v3 --tts-stability 0.4 --price
bun as extract "https://www.youtube.com/watch?v=MORMZXEaONk" --provider supadata --stt-language es --price
bun as extract input/examples/audio/1-audio.mp3 --step-concurrency stt-segment=3 --price
bun as extract input/examples/audio/1-audio.mp3 --step-concurrency bogus=3
```

1. `bun run check` proves renamed config and flag consumers still typecheck.
2. The validation suite proves help text, option resolution, config round-trips, resume, and comic recovery agree with the new spellings.
3. `bun t --price` proves every registered price command still plans without a billable call.
4. The `--tts-stability` and `--stt-language` price runs plan those generic flags for the selected provider.
5. A registered `--step-concurrency` scope is accepted. An unknown scope is rejected, and the error names the scopes that command accepts.

## References

- Related ADR: [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md)
- Related ADR: [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md)
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)
- [CLI help inventory](../reports/help-output-inventory.md)
