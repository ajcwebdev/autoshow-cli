# ADR-018: Derive CLI Help From Registries and Generalize Provider-Specific Flags

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-09-16
- **Date Updated:** 2026-09-22
- **Verification Status:** Passed
- **Supersession:** Replaces the intra-step concurrency spellings and `--url-provider-concurrency` recorded in [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md). The comic bare-model-id spellings it replaced were recorded in the dissolved comic-integration record "Integrate Comic with Shared Model and Native CLI Infrastructure", whose model-resolution decision now lives in [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) and whose command tree lives in [ADR-006](ADR-006-top-level-command-boundaries-and-deprecations.md). ADR-007's lane architecture and fair-queue behavior, and the resolution of comic models through the central registries, remain accepted.

## Context

`bun as <cmd> --help` is the contract for people and for agent consumers, and an audit of every flag against the value its command actually uses found dozens of defaults stated only in prose, several real defaults help never showed, and about fifteen hand-copied choice lists that went stale when their constants changed. The same capability was also exposed through provider-specific flags beside a generic `provider=value` mechanism, so which controls exist, which providers accept them, and which ranges config allows lived in three separate lists. Concurrency had grown to ten flags across three conflated concepts, and comic selected models by bare id while every other command used `--provider provider[=model]`.

Why now: a default that help states wrongly is worse than one it omits, and the separate capability lists had to collapse before another provider was added.

## Options Considered

**Option 1 (selected)**

- **Option:** Make one capability table per domain the source of truth, derive help text, validation, and defaults from it, and remove the provider-prefixed and per-step flag spellings with no aliases
- **Pros:** Help cannot drift from the behavior it describes, and a range change updates help, validation, and the error together
- **Cons:** Breaking rename across the CLI, persisted config keys, and comic resume manifests
- **Quantitative Notes:** 12 provider-prefixed flags collapsed into 11 provider-general spellings; 10 concurrency flags reduced to 4

**Option 2**

- **Option:** Correct the defaults and enumerations only, leaving the provider-prefixed flag surface in place
- **Pros:** No rename, config migration, or resume-manifest invalidation
- **Cons:** Leaves the separate capability lists that produced the drift, so the same defect recurs with the next provider
- **Quantitative Notes:** Rejected; fixes the symptoms and none of the structural cause

**Option 3**

- **Option:** Rename with aliases, keeping the old spellings accepted and hidden
- **Pros:** No breaking change
- **Cons:** An accepted but unlisted alias is undocumented behavior, and resume manifests would still need one spelling
- **Quantitative Notes:** Rejected; would retain 12 retired spellings indefinitely

## Decision

Every advertised default, enumeration, and per-provider range comes from that domain's capability registry. An option whose capability is provider-general is spelled `provider=value`. Retired spellings are removed outright.

TTS and STT each have one registry that supplies the help text, accepted values, defaults, and validation for that domain. STT options are validated for the selected engine, so the result is the same whichever model `--all-stt` selects. Passing an STT option with no STT provider selected is an error. An out-of-range value names the flag, the provider, and the bound.

Intra-step concurrency is `--step-concurrency <scope>=N`. A scoped repeatable flag prints its defaults as `key=value` entries from the registry; an explicit occurrence or a config value overrides that key, and an unset key uses the registry default. Comic selects its primary output with `--provider provider[=model]` and each auxiliary role with `--<role>-provider`.

This applies to:

- Every `default` and enumeration rendered by `bun as <cmd> --help`
- The TTS and STT generic option flags, their config keys, and their validation
- Intra-step concurrency scopes, the URL provider lane, and comic image, text, and QA model selection

It does not apply to:

- Provider-specific fields stored in resume state and read by provider adapters; existing resume directories keep those names
- The concurrency lane architecture and hosted admission coordinator ([ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md))
- Central model registry lifecycle and capability policy ([ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md))

## Rationale

- Deriving the printed default and the used default from one registry makes a mismatch fail a check instead of reaching a user.
- Stability, similarity, style, speaker boost, seed, and pronunciation dictionaries exist only on ElevenLabs today; a generic spelling lets the next provider that supports one of them use the same flag.
- Engine-level STT validation keeps the usage error stable across the models one `--all-stt` run selects.
- Comic can need an image, text, and QA model in one invocation; `--provider` carries the primary domain and `--<role>-provider` the others, the same pattern as `comic generate-audio --sfx-provider`.

## Consequences

Positive outcomes:

- Every rendered `[default: …]` is the value the command uses, including the `key=value` defaults on scoped repeatable flags
- Help shows each provider's accepted range; `--tts-speed` lists the providers that accept a numeric speed and notes that ElevenLabs `eleven_v3` rejects it
- `--tts-response-format` expose capabilities that previously had no flag
- A new step concurrency scope adds no new flag

Negative outcomes:

- Retired spellings are removed with no alias, so existing scripts and saved invocations must be updated
- Persisted config keys for the renamed TTS and STT options change, and old keys fail to load
- Comic image and audio resume manifests re-plan once, because their recovery hashes embed flag names
- Defaults that depend on the provider or the run remain described in prose

## Trade-offs

**Trade-off 1**

- **Gain:** Help output that matches the behavior it describes
- **Sacrifice:** A breaking rename across the CLI, persisted config, and comic resume manifests, shipped as one change

**Trade-off 2**

- **Gain:** One `--step-concurrency <scope>=N` flag instead of five, with per-scope defaults printed in help
- **Sacrifice:** A scope from another command is rejected; the error names the scopes the current command accepts

## API / Type Impact

- Removed CLI spellings: `--elevenlabs-tts-stability`, `--elevenlabs-tts-similarity-boost`, `--elevenlabs-tts-style`, `--elevenlabs-tts-use-speaker-boost`, `--elevenlabs-tts-seed`, `--elevenlabs-tts-pronunciation-dictionary-locator`, `--stt-happyscribe-organization-id`, `--stt-supadata-lang`, `--stt-scrapecreators-lang`, `--stt-grok-verbatim`, `--stt-supadata-chunk-size`, `--deepinfra-stt-response-format`, `--ocr-concurrency`, `--stt-segment-concurrency`, `--stt-preflight-concurrency`, `--tts-chunk-concurrency`, `--sfx-concurrency`, `--url-provider-concurrency`, comic `--concurrency`, `--image-model`, `--llm-model`, `--qa-model`, and `--whisper-engine`
- Added CLI spellings: `--tts-stability`, `--tts-similarity`, `--tts-style`, `--tts-speaker-boost`, `--tts-seed`, `--tts-pronunciation-dictionary`, `--tts-response-format`, `--stt-organization-id`, `--stt-language`, `--stt-verbatim`, `--stt-chunk-size`, `--stt-response-format`, `--step-concurrency`, comic `--qa-provider` and `--llm-provider`
- Config keys: `defaults.tts.{elevenlabsTtsStability,elevenlabsTtsSimilarityBoost,elevenlabsTtsStyle,elevenlabsTtsUseSpeakerBoost,elevenlabsTtsSeed,elevenlabsTtsPronunciationDictionaryLocators}` become `defaults.tts.{stability,similarity,style,speakerBoost,seed,pronunciationDictionary}`; `defaults.extract.stt.{happyscribeOrganizationId,supadataLang,scrapecreatorsLang,deepinfraResponseFormat,grokVerbatim,supadataChunkSize}` become `defaults.extract.stt.{organizationId,language,responseFormat,verbatim,chunkSize}`; `defaults.comic.sfxConcurrency` is added. Step concurrency scopes keep their existing domain-organized JSON paths.

## Test Plan

```bash
bun run check
bun test test/test-cases/validation/cli/
bun t --price
bun as tts input/examples/tts/01-tts-short.md --provider elevenlabs=eleven_v3 --tts-stability 0.4 --price
bun as extract input/examples/audio/1-audio.mp3 --step-concurrency bogus=3
```

1. The CLI suite proves help text, option resolution, config round-trips, resume, and comic recovery agree with the new spellings.
2. `bun t --price` proves every registered price command still plans without a billable call.
3. The `--tts-stability` price run plans a generic flag for the selected provider, and the unknown `--step-concurrency` scope is rejected with an error naming the accepted scopes.

## References

- Related ADR: [ADR-006](ADR-006-top-level-command-boundaries-and-deprecations.md)
- Related ADR: [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md)
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)
- Related ADR: [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md)
- [CLI help contracts](../../test/test-cases/validation/cli/cli-help-contracts.test.ts)
