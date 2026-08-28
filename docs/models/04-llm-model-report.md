# 2026 Hosted-Model Refresh Report: LLMs

## Status

- **Report Status:** Current
- **Date Created:** 2026-08-03
- **Date Updated:** 2026-08-22

This report is one of eight per-modality records split on 2026-08-19 from the former consolidated 2026 hosted-model refresh ledger (retired as an ADR; the remaining ADRs were renumbered to close the gap). Sibling reports: [STT](01-stt-model-report.md), [OCR](02-ocr-model-report.md), [URL scraping](03-url-model-report.md), [TTS](05-tts-model-report.md), [Music](06-music-model-report.md), [Image](07-image-model-report.md), [Video](08-video-model-report.md).

Durable registry, lifecycle, and capability policy belongs to [ADR-010](../adr/ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md); paid approvals, calibration results, artifact repair evidence, and generated-report contracts belong to [ADR-012](../adr/ADR-012-benchmark-evidence-and-generated-report-architecture.md). Latency and token heuristics for new or replacement selectors reuse the closest prior per-provider baseline and stay provisional until an approved ADR-012 calibration promotes them.

This report records the hosted text-model changes, including selector additions shared by the write and OCR registries. The OCR-specific service expansion and catalog audits are recorded in the [OCR report](02-ocr-model-report.md).

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
- The companion Mistral OCR catalog dedup is recorded in the [OCR report](02-ocr-model-report.md).

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

Excluded from this refresh under [ADR-010](../adr/ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md):

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

Closes the extract (OCR) side of the 2026-08-16 P1 write+extract recommendations for `gemini-3.7-flash` and `grok-4.6`, and adds write-only sibling `claude-sonnet-4-6` to OCR. Write selectors, expansion order, and bare `--llm` defaults are unchanged. OCR expansion inserts `gemini-3.7-flash` after `gemini-3.1-pro-preview`, `grok-4.6` after `grok-4.5`, and `claude-sonnet-4-6` after `claude-sonnet-5`. Pricing, reasoning, and page heuristics match the write registries plus the closest prior OCR sibling; see the [OCR report](02-ocr-model-report.md).

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

- Related ADR: [ADR-002](../adr/ADR-002-pipeline-state-resume-and-dry-run-planning.md) — Pipeline state and resume identity
- Related ADR: [ADR-010](../adr/ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) — Durable registry/lifecycle/capability policy
- Related ADR: [ADR-011](../adr/ADR-011-add-refresh-metadata-to-links.md) — Curated primary-source refreshes
- Related ADR: [ADR-012](../adr/ADR-012-benchmark-evidence-and-generated-report-architecture.md) — Benchmark evidence and generated reports
- Hosted model registries: `src/cli/commands/setup-and-utilities/models/`
- Write provider adapters: `src/cli/commands/process-steps/step-3-write/`
- Primary-source snapshots: `src/cli/commands/setup-and-utilities/links/model-links/`
- 2026-08-16 text-catalog dump: `bun autoshow links --claude models --gemini models --grok models --openai models`
