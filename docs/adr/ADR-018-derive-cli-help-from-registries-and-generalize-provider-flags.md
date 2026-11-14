# ADR-018: Registry-Derived Help and Shared Flags

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-09-16
- **Date Updated:** 2026-11-14
- **Verification Status:** Passed

## Context

Copied help choices and defaults drift from validation. Separate provider and concurrency flags multiply this maintenance burden.

## Decision

Derive help choices, defaults, accepted ranges, validation, and option resolution from shared registries and constants. Describe selection-dependent defaults explicitly rather than printing a false fixed value.

Use generic TTS/STT control names and configuration keys. An unqualified value requires one selected provider; `provider=value` disambiguates multiple selections. Validate STT controls per engine and TTS controls against supported capabilities. Errors name the public flag, provider, and applicable bound. Active ElevenLabs models reject numeric speed, style, and speaker boost; similarity is supported by `eleven_v4` and rejected by `eleven_v3`.

Keep provider-specific flags only for operations without a generic equivalent. Gemini transport modes, batch wait bounds/default, and resume job actions/default share `src/cli/flags/gemini-tts-contract.ts` across help, validation, and execution.

Use repeatable `--step-concurrency <scope>=N`, with per-command scope validation and registry-derived `key=value` help defaults. Explicit values override configuration, which overrides registry defaults. Current scopes are `stt-segment`, `stt-preflight`, `ocr-page`, `tts-chunk`, and comic `sfx`. The URL lane uses `--provider-concurrency`. Comic primary targets use `--provider provider[=model]`; auxiliary roles use `--<role>-provider`.

Retired spellings and configuration keys fail without compatibility aliases, including `--sfx-concurrency`; comic soundscape uses `--step-concurrency sfx=N`. Stored provider-specific resume settings remain separate from the public flag surface.

## Trade-offs

Shared capability definitions prevent drift and let providers adopt existing controls without adding flags. Removing aliases requires users to update scripts and saved configuration; keeping them would preserve duplicate contracts.

## Verification

```bash
bun test test/test-cases/validation/cli/generic-option-registry-contracts.test.ts test/test-cases/validation/cli/gemini-transport-option-contracts.test.ts test/test-cases/validation/cli/option-resolution-contracts/removed-cli-spellings.test.ts test/test-cases/validation/cli/cli-usage-errors/step-concurrency-usage.test.ts
```

These local contracts check rendered defaults, accepted controls, Gemini fallbacks, and rejection of removed spellings or inapplicable scopes before dispatch.

## References

- [CLI help contracts](../../test/test-cases/validation/cli/cli-help-contracts.test.ts)
- [ADR-007: Hosted admission and lanes](ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md)
- [ADR-010: Model capabilities](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)
