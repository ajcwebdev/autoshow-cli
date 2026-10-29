# ADR-018: Derive CLI Help From Registries and Generalize Provider-Specific Flags

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-09-16
- **Date Updated:** 2026-10-28
- **Verification Status:** Passed
- **Supersession:** Replaces the intra-step concurrency spellings and `--url-provider-concurrency` recorded in [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md). Its lane architecture and the central model resolution policy in [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) remain accepted.

## Context

`bun as <cmd> --help` is the contract for people and agent consumers. An audit found missing or incorrect defaults and hand-copied choice lists that drifted from validation. Provider-specific flags duplicated the generic `provider=value` mechanism, while capability, help, and configuration lists disagreed. Separate concurrency flags obscured the lane boundaries, and comic selected models by bare id instead of the shared `--provider provider[=model]` syntax.

Why now: a default that help states wrongly is worse than one it omits, and the separate capability lists had to collapse before another provider was added.

## Options Considered

**Option 1 (selected)**

- **Option:** Make one capability table per domain the source of truth, derive help text, validation, and defaults from it, and remove the provider-prefixed and per-step flag spellings with no aliases
- **Pros:** A capability change updates help, validation, and the error together
- **Cons:** Breaking rename across the CLI and persisted config keys
- **Quantitative Notes:** Five intra-step concurrency flags share one scoped flag

**Option 2**

- **Option:** Correct the defaults and enumerations only, leaving the provider-prefixed flag surface in place
- **Pros:** No rename or config migration
- **Cons:** Leaves the separate capability lists that produced the drift, so the same defect recurs with the next provider
- **Quantitative Notes:** Rejected; fixes the symptoms and none of the structural cause

**Option 3**

- **Option:** Rename with aliases, keeping the old spellings accepted and hidden
- **Pros:** No breaking change
- **Cons:** Retains multiple spellings and a compatibility surface to maintain
- **Quantitative Notes:** n/a

## Decision

Derive help choices, shared defaults, and provider control ranges from the registries and constants used by validation and option resolution. Expose provider-general controls through generic flags and remove retired provider-prefixed spellings outright.

TTS and STT control capabilities supply their help text, accepted values, and validation. STT controls are validated at engine level rather than model level. An unqualified control value requires exactly one selected provider; `provider=value` identifies the provider explicitly. An out-of-range value names the flag, the provider, and the bound.

Intra-step concurrency is `--step-concurrency <scope>=N`. A scoped repeatable flag prints its defaults as `key=value` entries from the registry; an explicit occurrence or a config value overrides that key, and an unset key uses the registry default. Comic selects its primary output with `--provider provider[=model]` and each auxiliary role with `--<role>-provider`.

This applies to:

- Every `default` and enumeration rendered by `bun as <cmd> --help`
- The TTS and STT generic option flags, their config keys, and their validation
- Intra-step concurrency scopes, the URL provider lane, and comic image, text, and QA model selection

It does not apply to:

- The stored provider-specific settings used to resume existing runs
- The concurrency lane architecture and hosted admission coordinator ([ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md))
- Central model registry lifecycle and capability policy ([ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md))

## Rationale

- Deriving the printed default and the used default from one registry makes a mismatch fail a check instead of reaching a user.
- A generic control spelling lets another provider support the same capability without adding another flag.
- Engine-level STT validation keeps the usage error stable across the models one `--all-stt` run selects.
- Comic can need an image, text, and QA model in one invocation; `--provider` carries the primary domain and `--<role>-provider` the others, the same pattern as `comic generate-audio --sfx-provider`.

## Consequences

Positive outcomes:

- Registry-derived help follows the accepted choices and defaults, including the `key=value` defaults on scoped repeatable flags
- Help shows each provider's accepted range; `--tts-speed` lists the providers that accept a numeric speed and notes that ElevenLabs `eleven_v3` rejects it
- `--tts-response-format` exposes capabilities that previously had no flag
- A new step concurrency scope adds no new flag

Negative outcomes:

- Retired spellings are removed with no alias, so existing scripts and saved invocations must be updated
- Persisted config keys for the renamed TTS and STT options change, and old keys fail to load
- Defaults that depend on the provider or the run remain described in prose

## Trade-offs

**Trade-off 1**

- **Gain:** Help output that matches the behavior it describes
- **Sacrifice:** A breaking rename across the CLI and persisted config

**Trade-off 2**

- **Gain:** One `--step-concurrency <scope>=N` flag instead of five, with per-scope defaults printed in help
- **Sacrifice:** A scope from another command is rejected; the error names the scopes the current command accepts

## API / Type Impact

- Provider-prefixed controls use generic replacements such as `--tts-stability`, `--stt-language`, `--stt-verbatim`, and `--stt-response-format`. Their saved configuration keys use the corresponding generic names; retired keys fail to load.
- Per-step concurrency flags use `--step-concurrency <scope>=N`; the URL lane uses `--provider-concurrency`. Comic model flags use `--provider`, `--llm-provider`, and `--qa-provider`.
- Generic names do not promise support on every model. `--tts-similarity`, `--tts-style`, and `--tts-speaker-boost` remain hidden and reject the active ElevenLabs models. The former `--stt-organization-id` and `--stt-chunk-size` controls are unsupported following provider exclusions.

## Test Plan

```bash
bun run check
bun test test/test-cases/validation/cli/generic-option-registry-contracts.test.ts
bun test test/test-cases/validation/cli/option-resolution-contracts/removed-cli-spellings.test.ts
bun test test/test-cases/validation/cli/cli-usage-errors/step-concurrency-usage.test.ts
bun t --price
```

1. The registry contracts verify that generic controls and rendered defaults agree with their capability tables.
2. Removed-spelling and concurrency usage tests verify that retired flags and invalid scopes fail before dispatch, with applicable scopes named in the error.
3. `bun t --price` verifies that registered price commands plan without billable calls.

## References

- Related ADR: [ADR-006](ADR-006-top-level-command-boundaries-and-deprecations.md)
- Related ADR: [ADR-007](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md)
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)
- Related ADR: [ADR-012](ADR-012-tts-synthesis-voice-management-and-delivery.md)
- [CLI help contracts](../../test/test-cases/validation/cli/cli-help-contracts.test.ts)
