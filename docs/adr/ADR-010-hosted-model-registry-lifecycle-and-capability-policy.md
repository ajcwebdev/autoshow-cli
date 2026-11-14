# ADR-010: Hosted Model Registry Policy

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-13
- **Date Updated:** 2026-11-14
- **Verification Status:** Passed

## Context

Model identity, lifecycle, capabilities, pricing, defaults, expansion, and resume must agree across commands. Shared policy prevents independently valid catalogs from producing different requests or misrepresenting recorded charges.

## Decision

The central registries govern hosted write, OCR, STT, TTS, music, image, and video, including comic. Hosted image selectors produce raster output. Every selector change updates validation, defaults, exact `--all-*` membership, help, prices/limits, capabilities, execution, manifests, and resume together. Reject unsupported combinations before pricing, credentials, or dispatch; never silently change a retained provider identity.

Comic uses central LLM, image, QA, and dialogue catalogs; QA uses vision-capable OpenAI/Gemini models. Sound effects keep a dedicated validated model/endpoint/price/capability fixture in `src/cli/commands/audio/tts/soundscape/elevenlabs-sfx-adapter.ts`, with its hash pinned in target/render identity. Do not duplicate that fixture in the music registry.

### Identity and lifecycle

- Use concrete stable IDs for current generally available models the CLI can execute. Exclude moving/preview aliases when stable IDs exist, duplicate names, and billing-only free-tier variants. Products without upstream IDs may use documented stable local selectors. Open-weight deployments require pinned versions and represented request/output/price/capability contracts.
- Current siblings and documented service, quality, or latency tiers may coexist when operations or trade-offs differ. Superseded generations leave active selection. Unsupported streaming, realtime, reference-audio, or domain-specific products need a separate integration decision.
- Lifecycle metadata controls active/deprecated state, optional shutdown/replacement, and default/expansion eligibility. Selection never changes with wall-clock dates. Bare-provider defaults use the cheapest eligible active model unless documented policy pins a representative; expansion preserves registry order and eligibility. Explicit names remain usable during supported transitions.
- Retired names leave new selection, defaults, help, config, and expansion. Errors name concrete same-service successors when available. Finished runs retain identity and historical rates; recorded cost outranks reconstructed pricing. Unfinished retired targets cannot execute under the old name; successors create new targets. Exclusion decisions below can override ordinary retention.
- Kimi/GLM write/OCR, Together writing, DeepInfra OCR, and fal image/video remain unavailable without substitution; Together/DeepInfra STT remain supported. User-directed removals of retired write/OCR routes, fal, and OpenAI `gpt-image-2` waived historical-rate and benchmark retention. Current membership belongs in live catalogs.

### Subscription-free API eligibility

Core API usage must be available without mandatory recurring fees or recurring minimum spending. Metered billing and one-time prepaid credits qualify; free allowances with subscription-only continuation do not. Optional subscriptions/discounts do not disqualify independently available usage.

Provider additions/refreshes need dated primary evidence for route-specific eligibility, prepaid minimums, and expiry. Missing or conflicting terms remain unresolved; another supported route does not prove entitlement or pricing. Reintroducing an excluded integration requires new evidence addressing its recorded reason and a user decision.

#### Excluded integrations

The following are active exclusion decisions, not pending additions. Excluded selections/settings and unfinished excluded targets fail locally before credentials or dispatch without substitution. Preserve existing assets, completed receipts, and recorded charges. Completed extraction targets may coexist with newly selected supported targets; ordinary historical pricing remains except the explicit TTS/removal waivers.

Hume, Cartesia, and Speechify billing exclusions were recorded 2026-09-25.

<!-- excluded-tts-providers:start -->

**Provider: Hume**

- **Model identifiers:** `octave-1`, `octave-2`
- **Removal decision:** [Official FAQ](https://dev.hume.ai/docs/text-to-speech-tts/faq): Free and Starter cannot buy additional TTS usage; Creator or higher is required.

**Provider: Cartesia**

- **Model identifiers:** `sonic-3.6-2026-08-27`, `sonic-3.5-2026-05-04`, `sonic-3`, `sonic-3.6`, `sonic-preview`, `sonic-2`
- **Removal decision:** [Official pricing](https://www.cartesia.ai/pricing): monthly plans supply model credits and paid subscribers receive overages.

**Provider: Speechify**

- **Model identifiers:** `simba-3.2`, `simba-3.0`, `simba-english`
- **Removal decision:** [Official API pricing](https://speechify.ai/pricing), rechecked 2026-09-25: Free cannot top up; continued usage requires a paid monthly plan.

**Provider: Mistral**

- **Model identifiers:** `voxtral-mini-tts-2603`
- **Removal decision:** TTS and voice management removed; STT/OCR retained

<!-- excluded-tts-providers:end -->

TTS/voice exclusions also reject saved voices and resume attempts without deleting local or remote assets. The removed Mistral utterance endpoint was the only implementation of `--tts-trailing-silence`; that flag and its saved configuration key remain unsupported. Mistral STT/OCR remain supported. Hume/Cartesia/Speechify exclusions waive ordinary historical-rate retention.

<!-- excluded-extraction-providers:start -->

**Provider: Firecrawl**

- **Removed category/model tuples:** `extract/firecrawl/firecrawl`
- **Dated primary evidence and decision:** [Billing](https://docs.firecrawl.dev/billing), checked 2026-10-15: Free has no pay-as-you-go option; additional credits require a paid plan.

**Provider: Supadata**

- **Removed category/model tuples:** `extract/supadata/supadata`, `stt/supadata/auto`
- **Dated primary evidence and decision:** [Pricing](https://supadata.ai/pricing), checked 2026-10-15: Free cannot recharge; paid subscriptions unlock recharge.

**Provider: Happy Scribe**

- **Removed category/model tuples:** `stt/happyscribe/auto`
- **Dated primary evidence and decision:** [Plans and pricing](https://help.happyscribe.com/en/articles/6906232-plans-and-pricing), published 2026-07-23 and checked 2026-10-15: the pay-as-you-go Starter offer was retired; one-off AI transcription requires a subscription.

**Provider: GLM Reader**

- **Removed category/model tuples:** `extract/glm-reader/glm-reader`
- **Dated primary evidence and decision:** [REST Reader](https://docs.z.ai/api-reference/tools/web-reader) and [pricing](https://docs.z.ai/guides/overview/pricing), checked 2026-10-15: no verified REST Reader tariff or independent billing entitlement. The Web Search price and Coding Plan Reader MCP are different contracts.

<!-- excluded-extraction-providers:end -->

The associated `--stt-organization-id` and `--stt-chunk-size` controls remain unsupported. Defuddle failures must not trigger paid fallback. Retain extraction historical rates; GLM Reader's former Web Search-based estimate remains historical and unverified.

<!-- excluded-hosted-models:start -->

**Provider: Cloudflare**

- **Excluded category/model tuples:** `stt/cloudflare/@cf/deepgram/nova-3`
- **Decision:** Removed at the user's direction after the [October 2026 STT benchmarks](../benchmarks/README.md#october-2026-stt-refresh) found direct Deepgram `deepgram=nova-3` cheaper and faster with comparable quality. Cloudflare Whisper models remain.

**Provider: Together**

- **Excluded category/model tuples:** `stt/together/nvidia/nemotron-3.5-asr-streaming-0.6b`, `stt/together/nvidia/nemotron-3-asr-streaming-0.6b`
- **Decision:** Not batch-callable: Together's transcription page lists them, but a 2026-10-17 `POST /v1/audio/transcriptions` request for Nemotron 3.5 returned 400 "This model only supports WebSocket streaming." Streaming transcription is outside current STT dispatch.

<!-- excluded-hosted-models:end -->

These tuples fail before dispatch while their providers remain supported. Finished Cloudflare Nova-3 results retain identity and historical pricing.

### Pricing and calibration

Keep dated published rates in their original units, context boundaries, tiers, and cache categories. Use uncached estimates unless trustworthy cache evidence applies; record flat rates only when published. Provider billing outranks estimates, and recorded charges outrank reconstructed rates. Report retries, reruns, billing variance, and excluded/invalid outputs.

Borrowed usage/timing heuristics remain provisional and separate from prices. Copied timing uses optional `estimation.timingProvenance` with `status: "provisional"`, `sourceModel`, and notes; absent metadata does not prove measured latency. Paid calibration is not required for a lifecycle transition supported by primary documentation and local request contracts.

Bundled OCR calibration in `src/cli/commands/setup-and-utilities/models/ocr-calibration-profiles.json` derives from three original English prose sources, Harbor, Meadow, and Summit, rendered as single-page 1020×1320 images in `test/fixtures/reasoning-calibration/`. Qualification required matching model/effective policy, finite usage, positive timing, calculated usage cost, a nonempty decoded artifact, one successful source-covering attempt, matching page/text artifacts, and text equality ignoring case, punctuation, and whitespace. Failed, partial, retried, or incorrect outputs were excluded.

Each promoted component is the median of at least three distinct healthy sources matched on provider/model/mode/page band/effective reasoning policy, all on one side of the estimate with median absolute percentage error over 20% using observed values as denominator. Bundled `calibrated-registry` profiles are fallback usage estimates when no learned profile exists; they do not change published rates or scheduler timing. Other modes, page bands, reasoning policies, and general write estimates remain unqualified. These samples establish normalized OCR text correctness, not punctuation/layout fidelity, general model quality, or invoiced cost. [ADR-008](ADR-008-ocr-execution-pooling-and-artifacts.md) owns OCR estimation and [ADR-015](ADR-015-govern-documentation-examples-and-verification-evidence.md) governs new evidence collection.

### Normalized reasoning

`--reasoning-effort default|disabled|minimal|low|medium|high|xhigh|max` is the hosted write/OCR control. Each model declares unsupported/optional/required reasoning and accepted levels, including whether disabling is legal. Reject unsupported combinations before pricing/dispatch. Omission preserves command policy, including Gemini 3 OCR `low`; explicit `default` clears the CLI override and delegates to the provider.

When behavior changes, persist requested/effective policies in manifests, estimates, diagnostics, and resume identity. Reject explicit resume policies incompatible with retained effective policy. Expanding the public enum requires a concrete provider/model/endpoint contract and coordinated mapping, validation, persistence, pricing, help, resume, and local behavior tests; SDK names and synonyms alone do not qualify.

## Trade-offs

Stable IDs and static lifecycle make a commit reproducible at the cost of explicit refreshes and replacement metadata. One reasoning surface rejects unsupported values instead of coercing them. Qualified calibration preserves rate integrity but leaves unmeasured contexts provisional.

## Verification

```bash
bun test test/test-cases/validation/providers/provider-selection-contracts/
bun test test/test-cases/validation/providers/retired-model-successor-contracts.test.ts test/test-cases/validation/configuration/model-timing-provenance-contracts.test.ts
bun test test/test-cases/validation/audio/tts/excluded-provider-contracts.test.ts test/test-cases/validation/providers/excluded-hosted-model-contracts.test.ts test/test-cases/validation/providers/excluded-extraction-provider-contracts.test.ts
bun test test/test-cases/validation/reports-pricing/bundled-ocr-calibration-contracts.test.ts
```

Local/mocked contracts cover selector/expansion parity, retirement, exclusions, reasoning, provenance, and calibration scope; they do not establish live entitlement or perceptual quality.

## References

- Live catalogs: `src/cli/commands/setup-and-utilities/models/`; [write reasoning guide](../commands/03-write/overview.md)
- [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md): stored identity; [ADR-018](ADR-018-derive-cli-help-from-registries-and-generalize-provider-flags.md): registry-derived controls/help
