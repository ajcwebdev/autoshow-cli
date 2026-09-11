# 2026 Hosted-Model Refresh Report: TTS

## Status

- **Report Status:** Current
- **Date Created:** 2026-08-03
- **Date Updated:** 2026-09-01

This report is one of eight per-modality records split on 2026-08-19 from the former consolidated 2026 hosted-model refresh ledger (retired as an ADR; the remaining ADRs were renumbered to close the gap). Sibling reports: [STT](../../stt/model-report.md), [OCR](../../text/ocr/model-report.md), [URL scraping](../../text/url/model-report.md), [LLMs](../../text/write/model-report.md), [Music](../music/model-report.md), [Image](../../visuals/image/model-report.md), [Video](../../visuals/video/model-report.md).

Durable registry, lifecycle, and capability policy belongs to [ADR-010](../../../adr/ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md); paid approvals, calibration results, artifact repair evidence, and generated-report contracts belong to [ADR-012](../../../adr/ADR-012-benchmark-evidence-and-generated-report-architecture.md). Latency and token heuristics for new or replacement selectors reuse the closest prior per-provider baseline and stay provisional until an approved ADR-012 calibration promotes them.

## TTS refresh and catalog narrowing

The provider-by-provider entries below preserve the 2026-08-19 refresh record. On 2026-08-29, AutoShow removed Gemini, Deepgram, Replicate, and fal from active TTS. On 2026-09-01, AutoShow removed Fish entirely, removed DeepInfra TTS while preserving DeepInfra STT and OCR, and removed MiniMax TTS while preserving MiniMax write, video, and music. The active TTS surface now contains eight providers: ElevenLabs, Grok, Mistral, OpenAI, Speechify, Hume, Cartesia, and Inworld.

**Provider 1: Speechify**

- **Provider:** Speechify
- **2026 decision and active implementation:** Replaced legacy `simba-english`/`simba-3.0` with `simba-3.2`; added language/voice validation and historical identity handling.

**Provider 2: Cartesia**

- **Provider:** Cartesia
- **2026 decision and active implementation:** Replaced `sonic-3` and moving `sonic-3.5` with fixed `sonic-3.5-2026-05-04`.

**Provider 3: OpenAI**

- **Provider:** OpenAI
- **2026 decision and active implementation:** Replaced moving `gpt-4o-mini-tts` with fixed `gpt-4o-mini-tts-2025-12-15`. Retired `tts-1` and `tts-1-hd` due to lack of instruction steering. Custom voices serialize as `{ id: "voice_…" }`.

**Provider 4: Deepgram**

- **Provider:** Deepgram
- **2026-08-19 historical implementation:** Expanded from 8 to all 91 documented Aura-2 voice models across seven languages; single-default policy avoided multiplying all-provider runs. Excluded Aura-1 and Flux. Deepgram TTS was removed from the active surface on 2026-08-29.

**Provider 5: ElevenLabs**

- **Provider:** ElevenLabs
- **2026 decision and active implementation:** Retained flagship `eleven_v3`; retired multilingual/flash variants to keep only native-dialogue flagship.

**Provider 6: Mistral**

- **Provider:** Mistral
- **2026 decision and active implementation:** Retained canonical API ID `voxtral-mini-tts-2603`.

**Provider 7: xAI**

- **Provider:** xAI
- **2026 decision and active implementation:** Kept `grok-tts` product selector; expanded stock voices to 26 documented IDs with `eve` default.

**Provider 8: Gemini**

- **Provider:** Gemini
- **2026-08-19 historical implementation:** Kept `gemini-3.1-flash-tts-preview` with 30 prebuilt voices supporting single and two-speaker synthesis. Gemini TTS was removed from the active surface on 2026-08-29.

**Provider 9: Inworld**

- **Provider:** Inworld
- **2026 decision and active implementation:** Added `realtime-tts-2` ($25/1M chars, API ID `inworld-tts-2`). Legacy 1.5 Max/Mini remain removed. Step 6 restores `realtime-tts-2-flash` with explicit capability validation ($15/1M chars, API ID `inworld-tts-2-flash`).

**Provider 10: DeepInfra**

- **Provider:** DeepInfra
- **2026-08-19 historical implementation:** Added Chatterbox, MiMo, and Qwen TTS models. DeepInfra TTS was removed from the active surface on 2026-09-01; DeepInfra STT and OCR remain active.

**Provider 11: Replicate**

- **Provider:** Replicate
- **2026-08-19 historical implementation:** Added pinned `jaaari/kokoro-82m` ($0.00022/pred). Removed unmaintained community variants lacking compatible schemas. Replicate TTS was removed from the active surface on 2026-08-29.

**Provider 12: Fish**

- **Provider:** Fish
- **2026-08-19 historical implementation:** Standardized on `s2.1-pro` as the sole synthesis model with native dialogue and timestamps. Fish was removed entirely on 2026-09-01.

### Refused / do not reimplement

These five selectors are retired. Direct selection fails with replacement guidance.

**Refused selector 1: `elevenlabs/eleven_multilingual_v2`**

- **Refused selector:** `elevenlabs/eleven_multilingual_v2`
- **Replacement:** `eleven_v3`
- **Why not come back:** Superseded by native-dialogue flagship

**Refused selector 2: `elevenlabs/eleven_flash_v2_5`**

- **Refused selector:** `elevenlabs/eleven_flash_v2_5`
- **Replacement:** `eleven_v3`
- **Why not come back:** Latency sibling of retired generation

**Refused selector 3: `speechify/simba-3.0`**

- **Refused selector:** `speechify/simba-3.0`
- **Replacement:** `simba-3.2`
- **Why not come back:** Superseded by current Speechify default

**Refused selector 4: `openai/tts-1`**

- **Refused selector:** `openai/tts-1`
- **Replacement:** `gpt-4o-mini-tts-2025-12-15`
- **Why not come back:** Classic model rejecting instruction steering

**Refused selector 5: `openai/tts-1-hd`**

- **Refused selector:** `openai/tts-1-hd`
- **Replacement:** `gpt-4o-mini-tts-2025-12-15`
- **Why not come back:** Classic model rejecting instruction steering

## Watches and deferrals

Cartesia now publishes stable `sonic-3.6-2026-08-27`, added alongside the existing 3.5 snapshot. The moving `sonic-preview` alias remains excluded.

Grok TTS speed, output-format, `replace`, and timestamp controls remain deferred; the 2026-08-16 xAI Voice snapshot is from `bun autoshow links --grok tts` (`https://docs.x.ai/developers/model-capabilities/audio/text-to-speech.md`).

The 2026-08-16 text-catalog gap audit (recorded in the [LLM report](../../text/write/model-report.md)) also recorded P3 TTS recommendations for `gemini-2.5-flash-preview-tts`, `gemini-2.5-pro-preview-tts`, and `gpt-audio-1.5`.

## API / Type Impact

- The active hosted TTS surface contains the supported selectors for eight providers.
- Removed selectors are excluded from active CLI help, configuration defaults, and expansion lists, while remaining parseable in historical manifests and pricing readers.

## Follow-up Actions

- [x] Added the dated Sonic 3.6 snapshot on 2026-09-08; `sonic-preview` remains excluded.

## Test Plan

- Validate registry integrity using `bun run check`, `bun t --price`, CLI help/usage contracts, selector/default/expansion contracts, provider request/response mocks, pricing contracts, and resume identity tests.
- Verify the active TTS selector count and refused-selector rejection with replacement guidance.
- Verify that documentation checks do not invoke paid or network-dependent provider endpoints.

## References

- Related ADR: [ADR-002](../../../adr/ADR-002-pipeline-state-resume-and-dry-run-planning.md) — Pipeline state and resume identity
- Related ADR: [ADR-008](../../../adr/ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md) — Provider-lane scheduling
- Related ADR: [ADR-010](../../../adr/ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) — Durable registry/lifecycle/capability policy
- Related ADR: [ADR-012](../../../adr/ADR-012-benchmark-evidence-and-generated-report-architecture.md) — Benchmark evidence and generated reports
- Related ADR: [ADR-013](../../../adr/ADR-013-add-character-voice-references-and-multi-speaker-script-to-audio.md) — Character voice and multi-speaker architecture
- Related ADR: [ADR-017](../../../adr/ADR-017-sound-effects-and-multi-track-soundscape-pipeline.md) — Soundscape and added TTS provider implementation phases
- Hosted model registries: `src/cli/commands/setup-and-utilities/models/`
- TTS provider adapters: `src/cli/commands/audio/tts/`
- Resume handlers: `src/cli/commands/setup-and-utilities/resume/`
- 2026-08-16 xAI Voice snapshot: `bun autoshow links --grok tts` (`https://docs.x.ai/developers/model-capabilities/audio/text-to-speech.md`)

## P1 TTS additions — 2026-09-08

Select `--provider cartesia=sonic-3.6-2026-08-27` or `--provider inworld=realtime-tts-2-flash`. Existing bare-provider defaults remain Sonic 3.5 and Realtime TTS 2; all-model expansion includes both additions. Flash maps to API ID `inworld-tts-2-flash`. Inworld's public Flash addition supersedes the previous local retirement decision; it rejects `--tts-instructions` and per-turn steering because the API documents instructions only for TTS 2. Voice design still requires the existing creation model.

Sonic 3.6 uses `/tts/bytes` with API version `2026-08-14`, a voice ID string and WAV PCM s16le at 24 kHz. Its 44 base language codes include Odia (`or`) and Urdu (`ur`); `--tts-language` accepts these base codes, while locale/accent controls remain unexposed. Existing professional clones are compatible; voice access remains account-dependent. The older snapshot retains its original version and voice object. AutoShow keeps its conservative 2,000-character Cartesia chunk budget; the checked Bytes contract does not specify a numeric input ceiling. [Model and voice compatibility](https://docs.cartesia.ai/build-with-cartesia/tts-models/latest), [Bytes contract](https://docs.cartesia.ai/api-reference/tts/bytes).

Cartesia's estimate is an explicit Scale subscription allocation: $299 / 8,000,000 credits × approximately one credit per character = $37.375/M characters (3.7375 cents/1K). This assumes full credit utilization; it is not a universal marginal or overage tariff. Preprocessing, unused credits, other plans, cloning and enterprise terms can change the invoice. [Credit metering](https://docs.cartesia.ai/pricing), [Subscription plans](https://www.cartesia.ai/pricing).

Flash uses the existing REST endpoint, single stock/custom voice ID, WAV at 48 kHz, word timestamp request and 2,000-character input limit. Language is detected automatically; both Inworld models advertise 200+ languages/locales. The default voice alias still resolves to Dennis. Other host audio encodings are not exposed by this synthesis adapter. Missing alignment remains explicitly unavailable. Flash estimates use the $15/M-character on-demand rate, excluding subscription discounts. [Models](https://docs.inworld.ai/tts/tts-models), [REST parameters](https://docs.inworld.ai/api-reference/ttsAPI/texttospeech/synthesize-speech), [Pricing](https://inworld.ai/pricing).

New-model request controls include model identity in paid segment hashes; the request body and canonical render target also identify the model. Legacy request controls and serializer versions remain stable for retained work. Completed audio and ambiguous-slot reconciliation continue through the existing resume pipeline. Verification uses synthetic audio and mocked transport; account access, latency and speech quality have not been tested through paid inference.
