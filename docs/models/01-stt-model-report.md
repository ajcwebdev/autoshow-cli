# 2026 Hosted-Model Refresh Report: STT / Transcription

## Status

- **Report Status:** Current
- **Date Created:** 2026-08-03
- **Date Updated:** 2026-08-22

This report is one of eight per-modality records split on 2026-08-19 from the former consolidated 2026 hosted-model refresh ledger (retired as an ADR; the remaining ADRs were renumbered to close the gap). Sibling reports: [OCR](02-ocr-model-report.md), [URL scraping](03-url-model-report.md), [LLMs](04-llm-model-report.md), [TTS](05-tts-model-report.md), [Music](06-music-model-report.md), [Image](07-image-model-report.md), [Video](08-video-model-report.md).

Durable registry, lifecycle, and capability policy belongs to [ADR-010](../adr/ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md); paid approvals, calibration results, artifact repair evidence, and generated-report contracts belong to [ADR-012](../adr/ADR-012-benchmark-evidence-and-generated-report-architecture.md). Latency and token heuristics for new or replacement selectors reuse the closest prior per-provider baseline and stay provisional until an approved ADR-012 calibration promotes them.

## STT refresh

Standardized STT on 17 active selectors across general-purpose hosted batch models, excluding specialized, realtime, streaming, or moving products (Nova-3 Medical, Deepgram Flux, Mistral Realtime, Together streaming).

**Provider 1: AssemblyAI**

- **Provider:** AssemblyAI
- **Active change and retained contract:** Replaced `universal-3-pro` with `universal-3-5-pro`. Bare selection defaults to Universal-3.5 Pro ($0.23/hour). Async request sends singleton `speech_models`, diarization, and optional speaker count. Historical readers preserve Universal-2 ($0.17/hour).

**Provider 2: Deepgram**

- **Provider:** Deepgram
- **Active change and retained contract:** Retained concrete `nova-3` ($0.582/hour diarization-inclusive); excluded redundant `nova-3-general` and domain-specific `nova-3-medical`.

**Provider 3: Gemini**

- **Provider:** Gemini
- **Active change and retained contract:** Replaced `gemini-3-flash-preview` with `gemini-3.6-flash` on GenerateContent/Files adapter ($1.50/1M input, $7.50/1M output, ~$0.1728/hour baseline).

**Provider 4: Gladia**

- **Provider:** Gladia
- **Active change and retained contract:** Replaced `default` with `solaria-3` ($0.61/hour). Async request sends model, diarization, and optional speaker count. Segment checkpoint isolation prevents remote job cross-talk. Historical readers preserve Solaria-1 at the same hourly rate.

**Provider 5: Soniox**

- **Provider:** Soniox
- **Active change and retained contract:** Replaced `stt-async-v4` with `stt-async-v5` on compatible async lifecycle (~$0.10/hour).

**Provider 6: Speechmatics**

- **Provider:** Speechmatics
- **Active change and retained contract:** Retained batch-only `melia-1` ($0.129/hour) with `language: "multi"`. Historical readers preserve Enhanced ($0.40/hour).

**Provider 7: Together**

- **Provider:** Together
- **Active change and retained contract:** Retained `openai/whisper-large-v3` and added `nvidia/parakeet-tdt-0.6b-v3` ($0.09/hour). Parakeet enforces a 20 MiB chunk cap based on batch execution limits.

Compacted STT resume prioritizes canonical `result.json` before falling back to `transcription.txt`.

## 2026-08-22 speaker-aware STT refresh

Implemented 2026-08-22 from the then-current speaker-aware combined report under [docs/benchmarks/stt-with-speakers](../benchmarks/stt-with-speakers/combined-comparison-report.md). Removed 5 selectors and the Rev STT service. Keep `universal-3-5-pro`, `melia-1`, and `solaria-3`. Active hosted count: 22 − 5 = 17. Direct selection of the removed IDs fails with same-service replacement guidance where the provider surface remains; `--provider rev` is an unknown provider. Historical-manifest and pricing readers retain support for the retired rates. The retired provider run artifacts were removed after this decision; the aggregate quality, cost, and speed metrics below are the retained historical benchmark record.

**Provider 1: AssemblyAI `universal-2`**

- **Provider:** AssemblyAI `universal-2`
- **Mean speaker-aware quality:** 95.92
- **Mean cost / speed:** $0.0485 / 17.03s
- **Why retired:** 2.22 quality below retained Universal-3.5 Pro (98.14) on the same three-run speaker-aware cohort

**Provider 2: Gladia `solaria-1`**

- **Provider:** Gladia `solaria-1`
- **Mean speaker-aware quality:** 95.70
- **Mean cost / speed:** $0.1741 / 19.61s
- **Why retired:** Same published hourly rate as retained Solaria-3, 0.47 worse quality, and no speed advantage

**Provider 3: Speechmatics `enhanced`**

- **Provider:** Speechmatics `enhanced`
- **Mean speaker-aware quality:** 96.27
- **Mean cost / speed:** $0.1142 / 55.25s
- **Why retired:** 0.07 quality below retained Melia-1, about 3× the mean cost, and about 5× slower

**Provider 4: Rev `low_cost` / `machine`**

- **Provider:** Rev `low_cost` / `machine`
- **Mean speaker-aware quality:** 93.65 / 94.08
- **Mean cost / speed:** $0.0286 / 599.03s and $0.0571 / 127.92s
- **Why retired:** Lowest-quality hosted diarization pair in the cohort; `low_cost` is the slowest model at 1.72× realtime. The Rev service is removed from active selection.

**Remove 1: `universal-2`**

- **Remove:** `universal-2`
- **Successor:** `universal-3-5-pro`

**Remove 2: `solaria-1`**

- **Remove:** `solaria-1`
- **Successor:** `solaria-3`

**Remove 3: `enhanced`**

- **Remove:** `enhanced`
- **Successor:** `melia-1`

**Remove 4: `low_cost`, `machine`**

- **Remove:** `low_cost`, `machine`
- **Successor:** none; the Rev provider flag is retired

## Watches and deferrals

deAPI whisper diarization is not a catalog tweak. deAPI STT is not implemented; curated links exist only. Upstream `WhisperLargeV3` has no diarization. `WhisperLargeV3Ct2` adds `diarize=true` and `ts_level: "word"` at +50% of the duration price (segment timestamps stay free). Adding that model is part of the deferred deAPI STT architecture decision in [ADR-010](../adr/ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), not this refresh.

The 2026-08-16 text-catalog gap audit (recorded in the [LLM report](04-llm-model-report.md)) excluded `gpt-4o-mini-transcribe-2025-12-15` because OpenAI STT remains deferred to a separate architecture decision, and excluded live/realtime/speech-to-speech transports (`gemini-3.1-flash-live-preview`, `gemini-3.5-live-translate-preview`, `gpt-realtime-2.1`, `gpt-realtime-2.1-mini`, `grok-voice-think-fast-2.0`).

## API / Type Impact

- The active STT surface is 17 selectors.
- Removed selectors are excluded from active CLI help, configuration defaults, and expansion lists, while remaining parseable in historical manifests and pricing readers.
- The Rev provider flag is removed from extract, resume, config, setup/doctor, and `--all-stt` expansion. Stored `rev` identities remain readable.

## Follow-up Actions

- [ ] Recheck deferred specialized, streaming, realtime, and deAPI/OpenAI STT products via separate architecture ADRs — Deferred

## Test Plan

- Validate registry integrity using `bun run check`, `bun t --price`, CLI help/usage contracts, selector/default/expansion contracts, provider request/response mocks, pricing contracts, and resume identity tests.
- Verify the active STT selector count and removed-selector rejection.
- Verify that documentation checks do not invoke paid or network-dependent provider endpoints.

## References

- Related ADR: [ADR-002](../adr/ADR-002-pipeline-state-resume-and-dry-run-planning.md) — Pipeline state and resume identity
- Related ADR: [ADR-010](../adr/ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) — Durable registry/lifecycle/capability policy
- Related ADR: [ADR-012](../adr/ADR-012-benchmark-evidence-and-generated-report-architecture.md) — Benchmark evidence and generated reports
- Hosted model registries: `src/cli/commands/setup-and-utilities/models/`
- STT provider adapters: `src/cli/commands/process-steps/step-2-extract/`
- Resume handlers: `src/cli/commands/setup-and-utilities/resume/`
- STT without-speakers benchmark artifacts: `docs/benchmarks/stt-without-speakers/`
- STT with-speakers benchmark artifacts: `docs/benchmarks/stt-with-speakers/`
