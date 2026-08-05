# ADR-017: Normalize Cross-Provider Reasoning Configuration

## Status

- **Decision Status:** Proposed
- **Date Created:** 2026-08-03
- **Date Updated:** 2026-08-03
- **Verification Status:** Pending

## Context

AutoShow's hosted LLM-backed write and OCR adapters currently express reasoning policy through provider-local request branches. Groq write hardcodes `reasoning_effort: "low"`; Gemini OCR hardcodes `thinkingConfig.thinkingLevel: "LOW"`; Kimi K2.x write and OCR send `thinking: { type: "disabled" }`; Kimi K3 omits `thinking` because that model rejects the field and instead uses always-on reasoning at the provider-default `reasoning_effort`; GLM write disables thinking; Anthropic accepts model defaults; and local llama-family paths disable thinking through template arguments. These choices are not visible in one typed configuration surface, are not consistently recorded in manifests, and cannot be selected by a user without changing adapter code.

Provider vocabularies and capabilities do not line up. Some models accept named effort levels, some accept only enabled or disabled thinking, some require reasoning and reject a disable field, and non-reasoning models expose no reasoning control. A shared flag therefore cannot safely forward one field verbatim or silently coerce an unsupported value. It must resolve a model capability first, validate the requested policy, and map the normalized value into the provider's request schema.

Reasoning changes output-token use, latency, and sometimes price. Price preflight must remain side-effect free and clearly distinguish calibrated estimates from reused heuristics. Historical manifests and resumes must also preserve the effective reasoning policy so a result is not later compared or resumed under a different hidden request shape.

Why now: ADR-011 made Kimi K3 callable by adding a model-ID exception and explicitly deferred a general flag; the current hardcoded Groq, Gemini, Kimi, GLM, Anthropic, and local policies show that another provider-specific exception would deepen the inconsistency.

## Options Considered

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **Add one normalized reasoning-effort flag backed by per-model capability metadata and provider adapters** | Gives users one stable surface; validates before execution; preserves exact provider mappings; makes manifests and estimates explicit | Requires registry metadata, request mapping, and migration of existing hardcoded policies | Initial audit covers at least 6 provider/local policy families across write and OCR |
| Add provider-specific thinking and effort flags | Closely mirrors each upstream API | Expands the public CLI with incompatible names and makes presets and central consumers provider-aware | At least 4 flag shapes are already implied by current adapters |
| Forward a common string without model capabilities | Small implementation | Allows invalid combinations and encourages silent coercion across incompatible APIs | One flag, but no reliable validation contract |
| Keep adapter-local defaults only | No public API change | Leaves policy hidden, hardcoded, and unrecorded; Kimi-style model branches continue to accumulate | Existing divergence remains across at least 6 policy families |

## Decision

Add `--reasoning-effort <value>` as the single public reasoning control for hosted LLM-backed write and OCR workflows and central consumers that dispatch through those workflows. Normalize the accepted values as `default`, `disabled`, `minimal`, `low`, `medium`, `high`, and `max`, then validate and map them through per-model capability metadata rather than forwarding the CLI string directly.

This applies to:

- Model metadata that declares whether reasoning is unsupported, optional, or required; whether `disabled` is valid; and which named effort levels the provider/model accepts.
- Provider request builders that translate a validated normalized value into fields such as `reasoning_effort`, `thinking`, or `thinkingConfig.thinkingLevel`, or omit all reasoning fields for `default`.
- Write and OCR manifests, resume identity, price output, and result diagnostics, which must record the requested and effective reasoning policies when the flag changes provider-default behavior.
- Existing adapter-local reasoning choices, including the Kimi model-ID branch, Groq's hardcoded low effort, Gemini OCR's hardcoded low thinking level, and GLM's hardcoded disabled thinking, which move behind the shared resolver.
- Explicit rejection before price calculation or provider execution when a model does not support the requested value. AutoShow must not silently downgrade, promote, or reinterpret unsupported levels.
- A compatibility default in which omitting the flag preserves the request behavior that existed immediately before this ADR's implementation. Changing provider defaults or benchmark calibration is outside this decision and requires separate evidence.
- Hosted LLM-backed reasoning only in the first implementation. Local inference template controls remain unchanged until their supported levels and performance implications are separately audited.

## API / Type Impact

- `write`, hosted OCR `extract`, and resume paths for those workflows accept `--reasoning-effort <default|disabled|minimal|low|medium|high|max>` wherever their selected model advertises the requested capability.
- The central model registry gains typed reasoning-capability metadata rather than inferring support from provider or model-name string checks.
- Provider options receive a normalized reasoning policy, and request builders remain responsible for producing provider-native fields.
- Manifests distinguish an omitted flag from an explicit value and record the effective mapped value so resume compatibility and benchmark reports can identify reasoning-policy changes.
- Existing configurations without the flag remain valid and preserve their pre-ADR request shape.

## Rationale

- One normalized user concept avoids exposing provider API vocabulary throughout the CLI while capability metadata preserves the differences that matter.
- Validation after model resolution can reject unsupported combinations without credentials, cost, quota use, or network access.
- Recording requested and effective policy prevents hidden reasoning changes from contaminating resume identity, benchmark comparison, timing, or cost evidence.
- Preserving existing behavior when the flag is omitted avoids silently changing output quality or provider spend during migration.
- Explicit unsupported-value errors are safer than a lowest-common-denominator enum or provider-specific fallback rules.

## Consequences

Positive outcomes:

- Users can select reasoning behavior consistently when a model supports it.
- Provider-specific request fields and Kimi's model exception become implementation details behind one tested resolver.
- Price and benchmark artifacts can explain reasoning-related cost and latency differences.
- New reasoning models can declare capabilities without adding another public flag or scattered model-name branch.

Negative outcomes:

- Registries need additional model-level metadata that must be maintained as provider capabilities change.
- The seven-value public enum is a superset; most individual models will accept only part of it.
- Existing estimates remain provisional until each materially different reasoning level has calibration evidence.
- Resume compatibility becomes stricter when an explicit reasoning policy differs from the stored effective policy.

## Trade-offs

| Gains | Sacrifices |
|---|---|
| One stable cross-provider flag | Per-model capability tables and adapter mappings |
| Explicit validation and reproducible manifests | Rejection of unsupported values instead of permissive fallback |
| Backward-compatible omitted-flag behavior | Existing hidden defaults remain until migrated behind the resolver |
| Honest cost and latency provenance | Additional calibration work for each meaningful effort tier |

## Test Plan

- Run `bun run check` and `git diff --check`.
- Add local/no-cost option-resolution and CLI usage contracts for the normalized enum, omitted-flag compatibility, and rejection before dispatch.
- Add request-builder contracts for Groq, Gemini, Kimi, GLM, and Anthropic mappings without making provider calls.
- Add registry contracts proving every selectable reasoning-capable model declares a valid capability and every declared mapping is handled by its adapter.
- Add manifest and resume contracts proving requested/effective policy persistence and rejection of incompatible resumes.
- Add price-mode contracts proving the flag remains side-effect free and that provisional or calibrated estimate provenance is surfaced.
- Do not run paid provider calls as implementation verification. Any live mapping confirmation requires separate immediate approval naming the exact provider command and estimated cost or quota risk.

## Follow-up Actions

| Action | Owner | Current State |
|---|---|---|
| Audit current write and OCR models and define the typed reasoning-capability schema | Model registry maintainers | Pending |
| Add `--reasoning-effort` to write, hosted OCR extract, and compatible resume option routing | CLI maintainers | Pending |
| Implement the shared resolver and migrate Groq, Gemini, Kimi, GLM, and Anthropic request builders while preserving omitted-flag behavior | Provider maintainers | Pending |
| Persist requested and effective reasoning policy in manifests and enforce resume compatibility | Workflow maintainers | Pending |
| Add local/no-cost registry, request-body, CLI, price, manifest, and resume contracts | Test maintainers | Pending |
| Calibrate materially different reasoning levels only through separately approved paid benchmark runs | Benchmark maintainers | Deferred pending exact paid approval |

## References

- Related ADR: [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md)
- Related ADR: [ADR-011](ADR-011-refresh-current-hosted-llm-and-ocr-models.md)
- Related ADR: [ADR-012](ADR-012-add-price-preflight-to-resume.md)
- `src/cli/commands/process-steps/step-3-write/write-services/write-groq/run-groq.ts`
- `src/cli/commands/process-steps/step-3-write/write-services/write-glm/run-glm.ts`
- `src/cli/commands/process-steps/step-3-write/write-services/kimi/run-kimi.ts`
- `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/gemini-ocr/run-gemini-ocr.ts`
- `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/kimi-ocr/run-kimi-ocr.ts`
- `src/cli/commands/setup-and-utilities/models/llm-config.json`
- `src/cli/commands/setup-and-utilities/models/ocr-config/`
