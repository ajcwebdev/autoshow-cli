# 2026 Hosted-Model Refresh Report: LLMs

## Status

- **Report Status:** Current
- **Date Created:** 2026-08-03
- **Date Updated:** 2026-08-22

This report is one of eight per-modality records split on 2026-08-19 from the former consolidated 2026 hosted-model refresh ledger (retired as an ADR; the remaining ADRs were renumbered to close the gap). Sibling reports: [STT](../../stt/model-report.md), [OCR](../ocr/model-report.md), [URL scraping](../url/model-report.md), [TTS](../../audio/tts/model-report.md), [Music](../../audio/music/model-report.md), [Image](../../visuals/image/model-report.md), [Video](../../visuals/video/model-report.md).

Durable registry, lifecycle, and capability policy belongs to [ADR-010](../../../adr/ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md); paid approvals, calibration results, artifact repair evidence, and generated-report contracts belong to [ADR-012](../../../adr/ADR-012-benchmark-evidence-and-generated-report-architecture.md). Latency and token heuristics for new or replacement selectors reuse the closest prior per-provider baseline and stay provisional until an approved ADR-012 calibration promotes them.

This report records the hosted text-model changes, including selector additions shared by the write and OCR registries. The OCR-specific service expansion and catalog audits are recorded in the [OCR report](../ocr/model-report.md).

## Write and OCR refresh

### OpenAI

- Added concrete `gpt-5.6-sol`, `gpt-5.6-terra`, and `gpt-5.6-luna` selectors to write and OCR; duplicate `gpt-5.6` alias was omitted. Structured-output validation includes all three concrete tiers.
- Synchronized Terra rates to `$2/1M` input and `$12/1M` output tokens, and Luna to `$0.20/1M` input and `$1.20/1M` output across write, OCR, and pricing.

### Anthropic

- Added `claude-fable-5` and `claude-sonnet-5` to write, `claude-fable-5` to OCR, and `claude-opus-5` to write and OCR.
- Excluded invitation-only `claude-mythos-5` to avoid advertising non-GA models.
- Recorded Fable 5's retention/ZDR constraint as provider metadata.

### xAI Grok

- Added `grok-4.5` to write while retaining its OCR selector. `grok-4.3` remains the cheaper bare write target; write expansion orders 4.3 before 4.5.
- Excluded moving aliases (`grok-4.5-latest`, `grok-build-latest`).
- Set Grok 4.5 price bands to `$2/$0.30/$6` per 1M input/cached-input/output tokens (<=200K input) and `$4/$0.60/$12` (>200K input). Estimates use uncached rates.

### Google Gemini

- Added `gemini-3.6-flash`, `gemini-3.5-flash`, and `gemini-3.5-flash-lite` to write; added `gemini-3.6-flash` and `gemini-3.5-flash-lite` to OCR (where 3.5 Flash already existed).
- Published Standard rates: `$1.50/$7.50` for Gemini 3.6 Flash, `$1.50/$9.00` for Gemini 3.5 Flash, and `$0.30/$2.50` for Gemini 3.5 Flash-Lite per 1M input/output tokens.
- Excluded `gemini-3-flash-preview` and moving `*-latest` aliases.
- Gemini 3.6/3.5 API transition required no client changes: adapter already used `thinkingConfig.thinkingLevel` for Gemini 3 OCR.
- Retired `gemini-3.1-flash-lite` with replacement guidance to deterministic target `gemini-3.5-flash-lite`; preserved historical `$0.25/$1.50` rates.

### Moonshot Kimi

- Added `kimi-k3` to write and OCR at published `$3.00/$0.30/$15.00` input/cache-hit-input/output rates. Estimates use uncached input.
- Preserved `kimi-k2.6` as the cheaper bare default.
- `kimi-k3` uses always-on reasoning, while `kimi-k2.6` supports disabling thinking via `thinking: { type: "disabled" }`.

### Additional LLM audits

- MiniMax structured-output gate remains negative: `MiniMax-M3` lacks `response_format`/`json_schema` support, retaining the compatibility fallback and schema-guided strategy.
- The companion Mistral OCR catalog dedup is recorded in the [OCR report](../ocr/model-report.md).

## 2026-08-16 Claude/Gemini/Grok/OpenAI text-catalog gap audit

Compared the active AutoShow write/OCR/STT/TTS/image/music/video registries against the 2026-08-16 primary-source dump from `bun autoshow links --claude models --gemini models --grok models --openai models`. This section records recommended additions and explicit exclusions; it is not an implemented refresh.

Current write coverage already includes Anthropic `claude-fable-5`, `claude-opus-5`, `claude-opus-4-8`, `claude-sonnet-5`, `claude-sonnet-4-6`, and `claude-haiku-4-5`; Gemini `gemini-3.1-pro-preview`, `gemini-3.6-flash`, `gemini-3.5-flash`, and `gemini-3.5-flash-lite`; Grok `grok-4.3` and `grok-4.5`; and OpenAI `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`, `gpt-5.5`, `gpt-5.4-mini`, and `gpt-5.4-nano`. The `gpt-5.6` alias remains unregistered. Invitation-only `claude-mythos-5` remains excluded.

**Priority 1: P1**

- **Priority:** P1
- **Selector:** `gemini-3.7-flash`
- **Category:** llm + extract
- **Rationale:** New generally available Flash flagship on Google's latest-model page; 1M context; introductory `$0.75/$3.75` per 1M input/output tokens.

**Priority 2: P1**

- **Priority:** P1
- **Selector:** `grok-4.6`
- **Category:** llm + extract
- **Rationale:** New xAI frontier text model and documented default for code/chat; 500K context; `$2.00/$0.50/$6.00` per 1M input/cached-input/output tokens below 200K input, `$4.00/$1.00/$12.00` above.

**Priority 3: P2**

- **Priority:** P2
- **Selector:** `grok-4.20-0309-reasoning`
- **Category:** llm
- **Rationale:** Current reasoning sibling of the extract-only `grok-4.20-0309-non-reasoning` selector.

**Priority 4: P2**

- **Priority:** P2
- **Selector:** `grok-4.20-0309-non-reasoning`
- **Category:** llm
- **Rationale:** Already registered for extract; missing from write.

**Priority 5: P2**

- **Priority:** P2
- **Selector:** `grok-build-0.1`
- **Category:** llm
- **Rationale:** Documented coding replacement for retired `grok-code-fast-1`; 256K context; `$1.00/$0.20/$2.00` below 200K input.

**Priority 6: P2**

- **Priority:** P2
- **Selector:** `gpt-5.4`
- **Category:** llm + extract
- **Rationale:** Still-documented full GPT-5.4 sibling of the already registered mini/nano tiers.

**Priority 7: P3**

- **Priority:** P3
- **Selector:** `grok-4.20-multi-agent-0309`
- **Category:** llm
- **Rationale:** Current multi-agent text sibling; same published token bands as Grok 4.20.

**Priority 8: P3**

- **Priority:** P3
- **Selector:** `gpt-5.5-pro`
- **Category:** llm + extract
- **Rationale:** Still-documented separate Pro slug; GPT-5.6 Pro is a `reasoning.mode` on the existing Sol/Terra/Luna selectors, not a new ID.

**Priority 9: P3**

- **Priority:** P3
- **Selector:** `gemini-omni-flash`
- **Category:** video
- **Rationale:** Preview conversational video generation/editing; requires confirming the existing Veo adapter can host it.

**Priority 10: P3**

- **Priority:** P3
- **Selector:** `gemini-2.5-flash-preview-tts`
- **Category:** tts
- **Rationale:** Older Flash TTS sibling of registered `gemini-3.1-flash-tts-preview`.

**Priority 11: P3**

- **Priority:** P3
- **Selector:** `gemini-2.5-pro-preview-tts`
- **Category:** tts
- **Rationale:** Older Pro TTS sibling; Google recommends migrating to `gemini-3.1-flash-tts-preview`.

**Priority 12: P3**

- **Priority:** P3
- **Selector:** `gpt-audio-1.5`
- **Category:** tts
- **Rationale:** Documented audio replacement for retiring `gpt-4o-audio` / `gpt-audio` families; confirm it fits the hosted TTS lifecycle before adding.

Excluded from this refresh under [ADR-010](../../../adr/ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md):

**Selector 1: `gpt-5.6`**

- **Selector:** `gpt-5.6`
- **Why excluded:** Duplicate alias of registered `gpt-5.6-sol`.

**Selector 2: `claude-mythos-5`, `claude-mythos-preview`**

- **Selector:** `claude-mythos-5`, `claude-mythos-preview`
- **Why excluded:** Invitation-only / non-GA.

**Selector 3: `claude-opus-4-7`, `claude-opus-4-6`, `claude-opus-4-5`, `claude-sonnet-4-5`**

- **Selector:** `claude-opus-4-7`, `claude-opus-4-6`, `claude-opus-4-5`, `claude-sonnet-4-5`
- **Why excluded:** Superseded generations still marked Active upstream.

**Selector 4: `gemini-3.1-flash-lite`**

- **Selector:** `gemini-3.1-flash-lite`
- **Why excluded:** Already retired in favor of `gemini-3.5-flash-lite`.

**Selector 5: `gemini-3-flash-preview`, `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`**

- **Selector:** `gemini-3-flash-preview`, `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`
- **Why excluded:** Preview or superseded Gemini generations.

**Selector 6: `gemini-2.5-flash-image`, `imagen-4.0-*`**

- **Selector:** `gemini-2.5-flash-image`, `imagen-4.0-*`
- **Why excluded:** Superseded image generations; Nano Banana 2 / Pro already registered.

**Selector 7: `lyria-realtime-exp`**

- **Selector:** `lyria-realtime-exp`
- **Why excluded:** Streaming RealTime music, already excluded.

**Selector 8: `gpt-4o-mini-transcribe-2025-12-15`**

- **Selector:** `gpt-4o-mini-transcribe-2025-12-15`
- **Why excluded:** OpenAI STT remains deferred to a separate architecture decision.

**Selector 9: `gemini-3.1-flash-live-preview`, `gemini-3.5-live-translate-preview`, `gpt-realtime-2.1`, `gpt-realtime-2.1-mini`, `grok-voice-think-fast-2.0`**

- **Selector:** `gemini-3.1-flash-live-preview`, `gemini-3.5-live-translate-preview`, `gpt-realtime-2.1`, `gpt-realtime-2.1-mini`, `grok-voice-think-fast-2.0`
- **Why excluded:** Live/realtime/speech-to-speech transports.

**Selector 10: Embeddings, computer-use, deep-research, Antigravity, robotics, and retired GPT/o-series / Sora 2 slugs**

- **Selector:** Embeddings, computer-use, deep-research, Antigravity, robotics, and retired GPT/o-series / Sora 2 slugs
- **Why excluded:** Outside implemented AutoShow command lifecycles or already shut down.

## 2026-08-18 Grok 4.6 and Gemini 3.7 Flash write additions

Implements the two P1 write recommendations from the 2026-08-16 text-catalog gap audit. Both additions cover the write registry only; the audit's extract (OCR) recommendations for these selectors remain open.

### xAI Grok

- Added `grok-4.6` to write alongside retained `grok-4.3` and `grok-4.5`; write expansion orders 4.3, 4.5, 4.6 and the bare `--llm grok` default stays `grok-4.3`.
- Set Grok 4.6 price bands to `$2/$0.50/$6` per 1M input/cached-input/output tokens (<=200K input) and `$4/$1.00/$12` (>200K input), checked 2026-08-18 against the xAI model page. Estimates use uncached rates.
- Reasoning mirrors Grok 4.5: required with low/medium/high efforts. Latency and token heuristics reuse the Grok 4.5 baseline and stay provisional until an approved ADR-012 calibration promotes them.
- xAI removed the `.md` mirrors under `docs.x.ai/developers/models/`; the model-links dump keeps the working `https://docs.x.ai/developers/grok-4-6.md` reference.

### Google Gemini

- Added `gemini-3.7-flash` to write alongside the retained Gemini selectors; expansion orders it after `gemini-3.1-pro-preview` and before `gemini-3.6-flash`, and the bare `--llm gemini` default stays `gemini-3.5-flash-lite`.
- Recorded conservative Standard rates of `$1.50/$7.50` per 1M input/output tokens effective 2027-01-01 rather than the introductory `$0.75/$3.75` window through 2026-12-31, so estimates overstate cost until year-end.
- Reasoning is optional with low/medium/high efforts only: the model page documents that `minimal` returns an error, unlike Gemini 3.6/3.5 Flash. Latency and token heuristics reuse the Gemini 3.6 Flash baseline and stay provisional until an approved ADR-012 calibration promotes them.

## 2026-08-22 Gemini 3.7 Flash, Grok 4.6, and Claude Sonnet 4.6 OCR additions

Closes the extract (OCR) side of the 2026-08-16 P1 write+extract recommendations for `gemini-3.7-flash` and `grok-4.6`, and adds write-only sibling `claude-sonnet-4-6` to OCR. Write selectors, expansion order, and bare `--llm` defaults are unchanged. OCR expansion inserts `gemini-3.7-flash` after `gemini-3.1-pro-preview`, `grok-4.6` after `grok-4.5`, and `claude-sonnet-4-6` after `claude-sonnet-5`. Pricing, reasoning, and page heuristics match the write registries plus the closest prior OCR sibling; see the [OCR report](../ocr/model-report.md).

## API / Type Impact

- Write and OCR unions accept concrete 2026 OpenAI, Anthropic, Grok, Gemini, and Kimi identifiers.
- Removed selectors are excluded from active CLI help, configuration defaults, and expansion lists, while remaining parseable in historical manifests and pricing readers.

## Follow-up Actions

- [x] Implement the 2026-08-16 P1 extract (OCR) registrations for `gemini-3.7-flash` and `grok-4.6`, plus write-only sibling `claude-sonnet-4-6`
- [ ] Implement the remaining 2026-08-16 recommended selectors after confirming adapter fit and published pricing — Pending
- [ ] Record future large hosted-model refreshes in dated report sections while preserving ADR-010 policy — Ongoing guardrail

## Test Plan

- Validate registry integrity using `bun run check`, `bun t --price`, CLI help/usage contracts, selector/default/expansion contracts, provider request/response mocks, pricing contracts, and resume identity tests.
- Verify active selector coverage and removed-selector rejection for the write and OCR registries.
- Verify that documentation checks do not invoke paid or network-dependent provider endpoints.

## References

- Related ADR: [ADR-002](../../../adr/ADR-002-pipeline-state-resume-and-dry-run-planning.md) — Pipeline state and resume identity
- Related ADR: [ADR-010](../../../adr/ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) — Durable registry/lifecycle/capability policy
- Related ADR: [ADR-011](../../../adr/ADR-011-add-refresh-metadata-to-links.md) — Curated primary-source refreshes
- Related ADR: [ADR-012](../../../adr/ADR-012-benchmark-evidence-and-generated-report-architecture.md) — Benchmark evidence and generated reports
- Hosted model registries: `src/cli/commands/setup-and-utilities/models/`
- Write provider adapters: `src/cli/commands/text/write/`
- Primary-source snapshots: `src/cli/commands/setup-and-utilities/links/model-links/`
- 2026-08-16 text-catalog dump: `bun autoshow links --claude models --gemini models --grok models --openai models`

## 2026-09-05 Claude Fable 5.1 write support

Added `claude-fable-5-1` to the write registry while retaining `claude-fable-5`. [Anthropic’s model overview](https://platform.claude.com/docs/en/models/fable-5-1/overview) lists standard rates of $10 per million input tokens and $50 per million output tokens, with always-on adaptive thinking and default high effort. The CLI delegates default effort to the provider and rejects disabled thinking.

The existing Anthropic write adapter uses native `output_config.format` JSON schemas, which the [migration guide](https://platform.claude.com/docs/en/models/fable-5-1/migration-guide) recommends for schema-conformant JSON. It does not force tool use, which Fable 5.1 rejects. Mocked REST contracts cover the chapter lyric schema with default and supported named efforts, selector resolution, rates, and rejection of unsupported reasoning before HTTP. Timing estimates inherit the existing Fable heuristic and have not been calibrated against a live Fable 5.1 run.

## 2026-09-05 GPT-6 Astra write support

Added `gpt-6-astra` to write while retaining all existing OpenAI selectors. [Official OpenAI documentation](https://developers.openai.com/api/docs/models/gpt-6-astra) lists $10 per million input tokens, $1 cached input, and $50 output; requests above 272K input tokens use $20 input, $2 cached input, and $75 output for the entire request. Standard uncached rates drive estimates; cache writes and alternate service tiers are excluded. Timing remains an uncalibrated heuristic.

The existing Responses API adapter supports its native structured outputs. Astra accepts `low`, `medium`, `high`, `xhigh`, and `max`; the CLI now recognizes `xhigh` and still validates each model’s supported efforts. Default requests omit reasoning overrides, while disabled and minimal reasoning are rejected for Astra. Mocked lyric-schema requests and pricing boundary tests cover the addition. Account access has not been verified with a live provider request.

## Chapter rap output alignment

`rapSongChapter` retains the model-generated source-derived song title rather than replacing it with the transcript filename. Its schema now matches the enhanced prompt: 2–6 intro and chorus lines, 12–20 lines per verse, and 2–8 bridge lines. The long-rap preset retains its fixed section lengths. Local regression tests cover chapter title preservation and all section boundaries.

Native structured write calls now persist each returned response and its usage metadata before validation. If an automatic validation retry fails, the prior response remains available as a validation envelope instead of being discarded. A mocked insufficient-credit retry verifies response preservation.

## 2026-09-08 Gemini 3.8 Flash addition

Gemini 3.8 Flash is available as `gemini-3.8-flash` for writing/OCR (`gemini`) and prompted audio extraction (`gemini-stt`), with existing selectors and defaults preserved. Writing and OCR support low/medium/high reasoning; minimal and disabled are rejected. STT uses the provider default thinking level (medium), without a reasoning override. Requests omit legacy sampling controls; the transport rejects incompatible 3.8 settings before dispatch. Audio timestamps remain generated, with no native word alignment claim.

Pricing checked 2026-09-08: introductory $0.75/$3.75 per million input/output tokens through 2026-12-31, then $1.50/$7.50 starting 2027-01-01. AutoShow follows its existing conservative policy and uses the standard rates for estimates and usage-based cost calculations even during the introductory window. Automatic date transitions are unsupported; recheck the tariff and refresh all three price paths by 2027-01-01. STT uses a $0.1728/hour audio-input baseline (32 tokens/second), then accounts for prompt, candidate and thinking tokens from returned usage. OCR page and writing/STT latency heuristics are reused and provisional; caching and discounted service tiers are excluded.

Sources: [model specification](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash), [migration guide](https://ai.google.dev/gemini-api/docs/latest-model?hl=en), [pricing](https://ai.google.dev/gemini-api/docs/pricing).

## Direct GLM 5.3 additions — 2026-09-08

Writing accepts `--llm glm=glm-5.3` and `--llm glm=glm-5.3-flash`, alongside `glm-5.1`. Bare `--llm glm` still selects 5.1; both additions participate in `--all-llm`. Both models require reasoning and accept `--reasoning-effort low`, `high` or `max`. Omitted/default effort leaves the provider default (max); disabled, minimal, medium and xhigh are rejected before HTTP. The existing 5.1 default still disables thinking. See the [flagship contract](https://docs.z.ai/guides/llm/glm-5.3) and [Flash contract](https://docs.z.ai/guides/vlm/glm-5.3-flash).

Both use direct Z.ai Chat Completions with text messages, enabled thinking and the existing 16,000-token request cap (below their published 128K output maximum and 1M context). Structured writing requests JSON-object output through the existing fallback path. Responses preserve returned model identity, provider input/output/total usage and raw usage; valid cached input counts appear in `providerUsage.cachedInputTokenCount` as a subset of prompt tokens. Reasoning content is not inserted into prose or counted again on top of completion usage. Missing usage retains local token-count fallback. Flash vision input, GLM 5.2 and Together additions are outside this integration. See the [API contract](https://docs.z.ai/api-reference/llm/chat-completion).

Standard direct prices per million input/cached-input/output tokens are $1.40/$0.26/$4.40 for 5.3 and $0.15/$0.03/$0.50 for Flash. Flash's separate 50% promotion is $0.075/$0.015/$0.25 through September 9, 2026 at 24:00 UTC+8, expiring at `2026-09-09T16:00:00Z`. Estimates and observed-token costs use standard uncached rates before and after expiry, so they overstate promotional or cached charges. No automatic promotion transition or cache discount is applied. Cache storage is currently temporarily free; future storage charges, batch/enterprise discounts, taxes and credits are excluded. Latency heuristics are inherited and uncalibrated. [Pricing checked September 8, 2026](https://docs.z.ai/guides/overview/pricing).


## Together hosted writing additions — 2026-09-08

Together accepts these additional short selectors. `--llm together` still selects `glm-5.1`; `kimi-k2.6` and `glm-5.1` keep their original host mappings. `--all-llm` includes all five Together choices. These selectors are scoped to Together and do not change direct Kimi or GLM behavior.

| Selector | Exact Together API ID | Input / cached input / output USD per million tokens |
| --- | --- | --- |
| `kimi-k3` | `moonshotai/Kimi-K3` | $3.00 / $0.30 / $15.00 |
| `glm-5.3` | `zai-org/GLM-5.3` | $1.40 / $0.26 / $4.40 |
| `glm-5.3-flash` | `zai-org/GLM-5.3-Flash` | $0.15 / $0.03 / $0.50 |

Together's [serverless catalog](https://docs.together.ai/docs/serverless/models) lists native structured output for all three and context limits of 1,048,576 tokens for K3 and 1,048,575 for both GLMs. Estimates and observed-token costs use flat uncached rates. Cached input rates are metadata only; no direct-provider promotion, automatic cached discount, batch discount, enterprise rate, tax or credit is applied. Latency heuristics remain uncalibrated.

All three accept `--reasoning-effort low`, `high` or `max`; omitted/default effort leaves the host default unchanged. Together K3 also accepts `disabled`, serialized as `reasoning: { enabled: false }`. Its [host quickstart](https://docs.together.ai/docs/kimi-k3-quickstart) documents max as the default and a 131,072-token completion budget, which AutoShow now uses. Reasoning and final text share this budget. The explicit low/high/max list and developer guide take precedence over the conflicting medium value in the quickstart parameter table and TypeScript comment; unsupported minimal/medium/xhigh values fail locally.

The [GLM 5.3 host page](https://www.together.ai/models/glm-5-3) documents always-enabled thinking and max default. The [Flash host page](https://www.together.ai/models/glm-5-3-flash) documents low/high/max but no disable contract, so AutoShow rejects disabled for both GLM additions. Named efforts use Together's top-level `reasoning_effort`; no direct Z.ai `thinking` field is sent. Both retain AutoShow's 32,768-token request cap. This is a local budget, not a claimed host output maximum: Together's checked pages publish context limits but no separate GLM output ceiling. Host context-limit validation remains authoritative. Large reasoning traces can exhaust the local cap before completing the answer.

The existing Chat Completions transport sends text messages and native JSON Schema for structured writing, with the established fallback without `response_format` on compatible schema errors. Final prose reads only message content. Metadata retains returned model identity, raw usage and normalized prompt/completion/total tokens, including valid cached-input counts as a subset of prompt usage, with fallback to Together's top-level `cached_tokens` when the nested counter is unavailable. Reasoning tokens included in completion usage are counted once. Missing usage retains local token-count fallback. Vision/OCR, tools and multi-turn thinking replay are outside this writing addition; no paid access check was performed.
