# ADR-013: Record the 2026 Hosted-Model Refresh Ledger

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-08-03
- **Date Updated:** 2026-08-16
- **Verification Status:** Passed
- **Supersession:** Consolidates per-modality 2026 refresh records into one dated ledger. Durable registry, lifecycle, and capability policy belongs to [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md); paid approvals, calibration results, artifact repair evidence, and generated-report contracts belong to [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md).

## Context

AutoShow completed a broad 2026 refresh of every hosted model registry. The work updated selectors, provider request shapes, prices, defaults, all-provider expansion, resume identity, historical readers, and capability contracts across write, OCR, STT, TTS, music, image, and video. Active surfaces moved to 22 STT selectors, 111 hosted TTS selectors, 3 music selectors, 22 hosted raster image selectors, and 16 video selectors.

These provider releases represent historical change records rather than durable registry policy. ADR-010 governs registry and lifecycle rules, while ADR-012 governs benchmark evidence and report architecture. This ledger records what changed during the 2026 refresh and why provider-specific adapter branches remain.

Why now: the refresh is complete across all seven hosted command surfaces, requiring one dated home for provider-specific decisions before release history accumulates inside durable policy documents.

## Options Considered

| Option                                                                                              | Pros                                                                                                                            | Cons                                                                                | Quantitative Notes                                                 |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **One dated cross-modality refresh ledger separated from durable policy and evidence architecture** | Keeps all 2026 additions, removals, provider constraints, corrections, and final counts discoverable without duplicating policy | Produces a long historical record and requires links to policy/evidence authorities | Consolidates refresh chronologies across 7 hosted command surfaces |
| Keep one live refresh ADR per modality                                                              | Keeps provider details in smaller files                                                                                         | Repeats policy and paid-verification rules across multiple documents                | Retains multiple dated refresh authorities                         |
| Put all chronology into the durable policy ADR                                                      | Gives one model document                                                                                                        | Buries stable lifecycle/capability rules under provider release history             | More than 1,000 lines of mixed policy and evidence                 |
| Preserve only current registry code and delete the decision history                                 | Minimizes documentation                                                                                                         | Loses why historical identities, provider branches, and exclusions exist            | No audit trail for removed selectors or paid corrections           |

## Decision

Maintain a consolidated 2026 hosted-model refresh ledger organized by command modality and provider, documenting additions, replacements, removals, exclusions, compatibility branches, final selector counts, and corrections.

This applies to:

- Dated provider and model changes across write, OCR, STT, TTS, music, image, and video, plus associated adapter branches and historical readers;
- Not durable registry policy (owned by [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md));
- Not benchmark execution, paid approvals, or report generation (owned by [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md)).

Latency and token heuristics for new or replacement selectors reuse the closest prior per-provider baseline and stay provisional until an approved ADR-012 calibration promotes them.

### Write and OCR refresh

#### OpenAI

- Added concrete `gpt-5.6-sol`, `gpt-5.6-terra`, and `gpt-5.6-luna` selectors to write and OCR; duplicate `gpt-5.6` alias was omitted. Structured-output validation includes all three concrete tiers.
- Synchronized Terra rates to `$2/1M` input and `$12/1M` output tokens, and Luna to `$0.20/1M` input and `$1.20/1M` output across write, OCR, and pricing.

#### Anthropic

- Added `claude-fable-5` and `claude-sonnet-5` to write, `claude-fable-5` to OCR, and `claude-opus-5` to write and OCR.
- Excluded invitation-only `claude-mythos-5` to avoid advertising non-GA models.
- Recorded Fable 5's retention/ZDR constraint as provider metadata.

#### xAI Grok

- Added `grok-4.5` to write while retaining its OCR selector. `grok-4.3` remains the cheaper bare write target; write expansion orders 4.3 before 4.5.
- Excluded moving aliases (`grok-4.5-latest`, `grok-build-latest`).
- Set Grok 4.5 price bands to `$2/$0.30/$6` per 1M input/cached-input/output tokens (<=200K input) and `$4/$0.60/$12` (>200K input). Estimates use uncached rates.

#### Google Gemini

- Added `gemini-3.6-flash`, `gemini-3.5-flash`, and `gemini-3.5-flash-lite` to write; added `gemini-3.6-flash` and `gemini-3.5-flash-lite` to OCR (where 3.5 Flash already existed).
- Published Standard rates: `$1.50/$7.50` for Gemini 3.6 Flash, `$1.50/$9.00` for Gemini 3.5 Flash, and `$0.30/$2.50` for Gemini 3.5 Flash-Lite per 1M input/output tokens.
- Excluded `gemini-3-flash-preview` and moving `*-latest` aliases.
- Gemini 3.6/3.5 API transition required no client changes: adapter already used `thinkingConfig.thinkingLevel` for Gemini 3 OCR.
- Retired `gemini-3.1-flash-lite` with replacement guidance to deterministic target `gemini-3.5-flash-lite`; preserved historical `$0.25/$1.50` rates.

#### Moonshot Kimi

- Added `kimi-k3` to write and OCR at published `$3.00/$0.30/$15.00` input/cache-hit-input/output rates. Estimates use uncached input.
- Preserved `kimi-k2.6` as the cheaper bare default.
- `kimi-k3` uses always-on reasoning, while `kimi-k2.6` supports disabling thinking via `thinking: { type: "disabled" }`.

#### Additional LLM/OCR audits

- Removed duplicate `mistral-ocr-latest` (identical to `mistral-ocr-4-0`); `mistral-ocr-2512` remains the cheapest Mistral default.
- MiniMax structured-output gate remains negative: `MiniMax-M3` lacks `response_format`/`json_schema` support, retaining the compatibility fallback and schema-guided strategy.

### 2026-08-14 OCR provider-surface expansion

The prioritized OCR expansion implemented P1–P8 entries across Replicate, fal.ai, and DeepInfra. DeepInfra additions were registry-only (`ocr-config/ocr-deepinfra.json`, `ocr-models.ts` validation) using the OpenAI-compatible vision API. Replicate and fal.ai introduced new step-2 OCR services (`ocr-services/replicate-ocr/`, `ocr-services/fal-ocr/`). Token-billed page costs reuse DeepInfra heuristics (~7,981 prompt and ~472 completion tokens per page) provisionally until calibrated.

| Priority | Selector                                        | Provider              | Pricing basis                                      | Est. cost per 1k pages | Rationale                                                                                                                 |
| -------- | ----------------------------------------------- | --------------------- | -------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| P1       | `datalab-to/ocr`                                | Replicate (official)  | $2 per 1,000 pages, flat page billing              | $2.00                  | Official page-billed model matching Mistral OCR price point; layout analysis, text detection, and tables in 90 languages. |
| P2       | `datalab-to/marker`                             | Replicate (official)  | $4 per 1,000 pages, pinned `fast` mode             | $4.00                  | Marker pipeline with markdown/JSON output (~0.18 s/page batched). Pinned `mode=fast` for deterministic pricing.           |
| P3       | `google/gemma-3-27b-it`                         | DeepInfra             | $0.08/1M input, $0.16/1M output tokens             | ~$0.72                 | Low-cost multimodal addition with registry-only implementation.                                                           |
| P4       | `mistralai/Mistral-Small-3.2-24B-Instruct-2506` | DeepInfra             | $0.075/1M input, $0.20/1M output tokens            | ~$0.69                 | Solid OCR quality with improved instruction following; registry-only change.                                              |
| P5       | `lucataco/deepseek-ocr`                         | Replicate (community) | L40S hardware-billed, ~$0.0033 per ~4 s prediction | ~$3.30 (variable)      | Document parsing (markdown, tables, LaTeX) with version pinning at dispatch.                                              |
| P6       | `meta-llama/Llama-4-Scout-17B-16E-Instruct`     | DeepInfra             | $0.10/1M input, $0.30/1M output tokens             | ~$0.94                 | Multimodal breadth for comparison runs; ranks on cost and model diversity.                                                |
| P7       | `fal-ai/got-ocr/v2`                             | fal.ai                | $0.05 per image                                    | $50.00                 | Specialty coverage (formulas, geometry, molecular structures, sheet music); reserved for specialized content.             |
| P8       | `fal-ai/florence-2-large/ocr`                   | fal.ai                | $0.00125 per GPU compute second                    | ~$7.55 (estimated)     | Compute-second billing calibrated from 2026-08-14 run (~6.04 s/page estimate); billed duration varies by input.           |

Excluded from expansion:

- Replicate `abiruyt/text-extract-ocr`: covered by free local `tesseract` engine.
- Replicate `lucataco/glm-ocr`: duplicates direct GLM `glm-ocr`.
- Replicate `cuuupid/marker`: superseded by official `datalab-to/marker`.
- Replicate `bytedance/dolphin`, `mickeybeurskens/latex-ocr`, `willywongi/donut`, `cjwbw/docentr`, `awilliamson10/meta-nougat`, `cudanexus/ocr-surya`, `pbevan1/llama-3.1-8b-ocr-correction`: low-usage community deployments or single-purpose pre/post-processing tools.
- fal.ai `openrouter/router/vision`: moving router violating fixed-ID policy.
- fal.ai `moondream3-preview/*`: preview endpoints deferred until fixed IDs exist.
- fal.ai `docres`, `docres/dewarp`: image enhancement tools, not OCR.
- DeepInfra partner-hosted Claude/Gemini selectors: duplicates direct providers without price advantages.
- DeepInfra `google/gemma-3-12b-it`, `google/gemma-3-4b-it`: marginal savings with weaker OCR quality than 27B.

### STT refresh

Standardized STT on 22 active selectors across general-purpose hosted batch models, excluding specialized, realtime, streaming, or moving products (Nova-3 Medical, Deepgram Flux, Mistral Realtime, Together streaming).

| Provider     | Active change and retained contract                                                                                                                                                                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AssemblyAI   | Replaced `universal-3-pro` with `universal-3-5-pro` and `universal-2`. Bare selection defaults to cheaper Universal-2 ($0.17/hour); Universal-3.5 Pro ($0.23/hour) is retained in expansion. Async request sends singleton `speech_models`, diarization, and optional speaker count. |
| Deepgram     | Retained concrete `nova-3` ($0.582/hour diarization-inclusive); excluded redundant `nova-3-general` and domain-specific `nova-3-medical`.                                                                                                                                            |
| Gemini       | Replaced `gemini-3-flash-preview` with `gemini-3.6-flash` on GenerateContent/Files adapter ($1.50/1M input, $7.50/1M output, ~$0.1728/hour baseline).                                                                                                                                |
| Gladia       | Replaced `default` with `solaria-1` (bare default) and `solaria-3` ($0.61/hour). Async request sends model, diarization, and optional speaker count. Segment checkpoint isolation prevents remote job cross-talk.                                                                    |
| Soniox       | Replaced `stt-async-v4` with `stt-async-v5` on compatible async lifecycle (~$0.10/hour).                                                                                                                                                                                             |
| Speechmatics | Retained `enhanced` ($0.40/hour) and added batch-only `melia-1` ($0.129/hour). Request uses `model` parameter; Enhanced sets `language: "auto"`, Melia sets `language: "multi"`.                                                                                                     |
| Together     | Retained `openai/whisper-large-v3` and added `nvidia/parakeet-tdt-0.6b-v3` ($0.09/hour). Parakeet enforces a 20 MiB chunk cap based on batch execution limits.                                                                                                                       |

Compacted STT resume prioritizes canonical `result.json` before falling back to `transcription.txt`.

### TTS refresh and catalog narrowing

Standardized hosted TTS on 111 active selectors across 15 hosted providers. Moving aliases and unsteerable models were replaced or retired with explicit refusal guidance.

| Provider   | 2026 decision and active implementation                                                                                                                                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Speechify  | Replaced legacy `simba-english`/`simba-3.0` with `simba-3.2`; added language/voice validation and historical identity handling.                                                                                                                               |
| Cartesia   | Replaced `sonic-3` and moving `sonic-3.5` with fixed `sonic-3.5-2026-05-04`.                                                                                                                                                                                  |
| OpenAI     | Replaced moving `gpt-4o-mini-tts` with fixed `gpt-4o-mini-tts-2025-12-15`. Retired `tts-1` and `tts-1-hd` due to lack of instruction steering. Custom voices serialize as `{ id: "voice_…" }`.                                                                |
| Deepgram   | Expanded from 8 to all 91 documented Aura-2 voice models across seven languages; single-default policy avoids multiplying all-provider runs. Excluded Aura-1 and Flux.                                                                                        |
| ElevenLabs | Retained flagship `eleven_v3`; retired multilingual/flash variants to keep only native-dialogue flagship.                                                                                                                                                     |
| Mistral    | Retained canonical API ID `voxtral-mini-tts-2603`.                                                                                                                                                                                                            |
| Groq       | Retained English Orpheus (`canopylabs/orpheus-v1-english`, default voice `abdullah`). Retired narrow Arabic selector.                                                                                                                                         |
| xAI        | Kept `grok-tts` product selector; expanded stock voices to 26 documented IDs with `eve` default.                                                                                                                                                              |
| Gemini     | Kept `gemini-3.1-flash-tts-preview` with 30 prebuilt voices supporting single and two-speaker synthesis.                                                                                                                                                      |
| Inworld    | Added `realtime-tts-2` ($25/1M chars, API ID `inworld-tts-2`). Removed legacy 1.5 Max/Mini and Flash variants.                                                                                                                                                |
| DeepInfra  | Added `ResembleAI/chatterbox-turbo` ($1/1M chars), `XiaomiMiMo/MiMo-V2.5-tts` ($0/1M promo), `XiaomiMiMo/MiMo-V2.5-tts-voicedesign` ($0/1M), `Qwen/Qwen3-TTS` ($20/1M), and `Qwen/Qwen3-TTS-VoiceDesign` ($20/1M). Retired failing `chatterbox-multilingual`. |
| Replicate  | Added pinned `jaaari/kokoro-82m` ($0.00022/pred). Removed unmaintained community variants lacking compatible schemas.                                                                                                                                         |
| Fish       | Standardized on `s2.1-pro` ($15/1M UTF-8 bytes) as sole synthesis model with native dialogue and timestamps. Exposed `voice-design-1` via `--creation-model` rather than synthesis selector.                                                                  |

#### Refused / do not reimplement

These twelve selectors are permanently retired. Direct selection fails with replacement guidance.

| Refused selector                               | Replacement                     | Why not come back                                            |
| ---------------------------------------------- | ------------------------------- | ------------------------------------------------------------ |
| `fish/fish-speech-1.5`                         | `s2.1-pro`                      | Superseded generation; absent from official API              |
| `fish/s1`                                      | `s2.1-pro`                      | Previous-generation parenthesis-tag model                    |
| `fish/s2-pro`                                  | `s2.1-pro`                      | Previous S2 generation replaced by production default        |
| `fish/voice-design-1`                          | `s2.1-pro`                      | Voice Design creation endpoint, not a synthesis selector     |
| `elevenlabs/eleven_multilingual_v2`            | `eleven_v3`                     | Superseded by native-dialogue flagship                       |
| `elevenlabs/eleven_flash_v2_5`                 | `eleven_v3`                     | Latency sibling of retired generation                        |
| `inworld/realtime-tts-2-flash`                 | `realtime-tts-2`                | Latency sibling rejecting `--tts-instructions`               |
| `speechify/simba-3.0`                          | `simba-3.2`                     | Superseded by current Speechify default                      |
| `deepinfra/ResembleAI/chatterbox-multilingual` | `ResembleAI/chatterbox-turbo`   | Unreliable upstream HTTP 500 errors                          |
| `openai/tts-1`                                 | `gpt-4o-mini-tts-2025-12-15`    | Classic model rejecting instruction steering                 |
| `openai/tts-1-hd`                              | `gpt-4o-mini-tts-2025-12-15`    | Classic model rejecting instruction steering                 |
| `groq/canopylabs/orpheus-arabic-saudi`         | `canopylabs/orpheus-v1-english` | Narrow 200-character WAV-only model without vocal directions |

### Music refresh

Standardized active music generation on 3 selectors across 3 hosted providers.

- Added ElevenLabs `music_v2` and later retired transitional `music_v1`. Active output format is `mp3_48000_192`. Historical readers preserve the v1 per-minute rate and `mp3_44100_128` identity.
- Replaced MiniMax `music-2.6` with `music-3.0` on prompt/lyrics/instrumental lifecycle. Historical readers preserve 2.6 rate ($0.15/track + $0.01 for lyrics).
- Retained Gemini `lyria-3-pro-preview` and retired `lyria-3-clip-preview`. Historical readers preserve the clip per-track rate.
- Excluded streaming Lyria RealTime, cover generation, and reference-audio products.
- Music resume promotes outputs to provider/model filenames before merging metadata to avoid artifact collisions.

### Image refresh

Standardized hosted raster image generation on 34 selectors across 6 providers, removing 7 outdated selectors.

| Provider  | 2026 decision and implementation                                                                                                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Gemini    | Replaced `gemini-3.1-flash-image-preview` with `gemini-3.1-flash-lite-image` (default), `gemini-3.1-flash-image`, and `gemini-3-pro-image`. Added model-specific pricing, dimensions, and historical reader. |
| Reve      | Removed direct Reve provider and `latest`/`reve-create@20250915` selectors ahead of the 2026-08-14 API sunset; historical results retain direct-Reve identities.                                             |
| Recraft   | Removed four SVG/vector selectors; hosted generation standardized on raster-only output.                                                                                                                     |
| BFL       | Added fixed `flux-2-klein-4b` and `flux-2-klein-9b` endpoints; excluded moving previews.                                                                                                                     |
| Replicate | Added `bytedance/seedream-5-pro`, Ideogram v4 (Turbo/Balanced/Quality), and Pruna ERNIE Image (Standard/Turbo with version pinning).                                                                         |
| fal.ai    | Added `fal-ai/hidream-o1-image`, `microsoft/mai-image-2.5`, `microsoft/mai-image-2.5-pro`, `alibaba/qwen-image-3`, and `reve/2.1` with queue/poll lifecycle and mode routing.                                |

### Video refresh

Standardized hosted video generation on 32 selectors across 7 providers.

- Replicate: replaced `alibaba/happyhorse-1.0` with 1.1; added Kling v3 Video, Kling v3 Omni, PixVerse V6, and Runway Aleph 2.
- xAI: added `grok-imagine-video-1.5` with per-second/resolution pricing; retained `grok-imagine-video` for edit/extend operations.
- fal.ai: added `minimax/h3` and `fal-ai/pixverse/c1` with explicit mode routing (text/image/reference), native audio, and duration/aspect validation.
- Retained: LTX 2.3 Fast/Pro, Seedance 2.0/2.0 Fast, Wan 2.7 T2V, Veo 3.1 Lite, Ray 3.2. Excluded unreleased Meta Muse, unavailable SkyReels V4, realtime Helios, and interactive stream tools.
- MiniMax: retained direct 01-series selectors (`T2V-01` 19¢ bare default).
- Veo: standardized on raw REST response boundary (`response.generateVideoResponse.generatedSamples[0].video`, `encodedVideo`), removing deprecated SDK wrapper types.

### 2026-08-16 Claude/Gemini/Grok/OpenAI text-catalog gap audit

Compared the active AutoShow write/OCR/STT/TTS/image/music/video registries against the 2026-08-16 primary-source dump `project/links/claude-models-text--gemini-models-text--grok-models-text--openai-models-text-links.md`. This section records recommended additions and explicit exclusions; it is not an implemented refresh.

Current write coverage already includes Anthropic `claude-fable-5`, `claude-opus-5`, `claude-opus-4-8`, `claude-sonnet-5`, `claude-sonnet-4-6`, and `claude-haiku-4-5`; Gemini `gemini-3.1-pro-preview`, `gemini-3.6-flash`, `gemini-3.5-flash`, and `gemini-3.5-flash-lite`; Grok `grok-4.3` and `grok-4.5`; and OpenAI `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`, `gpt-5.5`, `gpt-5.4-mini`, and `gpt-5.4-nano`. The `gpt-5.6` alias remains unregistered. Invitation-only `claude-mythos-5` remains excluded.

| Priority | Selector | Category | Rationale |
| -------- | -------- | -------- | --------- |
| P1 | `gemini-3.7-flash` | llm + extract | New generally available Flash flagship on Google's latest-model page; 1M context; introductory `$0.75/$3.75` per 1M input/output tokens. |
| P1 | `grok-4.6` | llm + extract | New xAI frontier text model and documented default for code/chat; 500K context; `$2.00/$0.50/$6.00` per 1M input/cached-input/output tokens below 200K input, `$4.00/$1.00/$12.00` above. |
| P2 | `grok-4.20-0309-reasoning` | llm | Current reasoning sibling of the extract-only `grok-4.20-0309-non-reasoning` selector. |
| P2 | `grok-4.20-0309-non-reasoning` | llm | Already registered for extract; missing from write. |
| P2 | `grok-build-0.1` | llm | Documented coding replacement for retired `grok-code-fast-1`; 256K context; `$1.00/$0.20/$2.00` below 200K input. |
| P2 | `gpt-5.4` | llm + extract | Still-documented full GPT-5.4 sibling of the already registered mini/nano tiers. |
| P3 | `grok-4.20-multi-agent-0309` | llm | Current multi-agent text sibling; same published token bands as Grok 4.20. |
| P3 | `gpt-5.5-pro` | llm + extract | Still-documented separate Pro slug; GPT-5.6 Pro is a `reasoning.mode` on the existing Sol/Terra/Luna selectors, not a new ID. |
| P3 | `gemini-omni-flash` | video | Preview conversational video generation/editing; requires confirming the existing Veo adapter can host it. |
| P3 | `gemini-2.5-flash-preview-tts` | tts | Older Flash TTS sibling of registered `gemini-3.1-flash-tts-preview`. |
| P3 | `gemini-2.5-pro-preview-tts` | tts | Older Pro TTS sibling; Google recommends migrating to `gemini-3.1-flash-tts-preview`. |
| P3 | `gpt-audio-1.5` | tts | Documented audio replacement for retiring `gpt-4o-audio` / `gpt-audio` families; confirm it fits the hosted TTS lifecycle before adding. |

Excluded from this refresh under ADR-010:

| Selector | Why excluded |
| -------- | ------------ |
| `gpt-5.6` | Duplicate alias of registered `gpt-5.6-sol`. |
| `claude-mythos-5`, `claude-mythos-preview` | Invitation-only / non-GA. |
| `claude-opus-4-7`, `claude-opus-4-6`, `claude-opus-4-5`, `claude-sonnet-4-5` | Superseded generations still marked Active upstream. |
| `gemini-3.1-flash-lite` | Already retired in favor of `gemini-3.5-flash-lite`. |
| `gemini-3-flash-preview`, `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite` | Preview or superseded Gemini generations. |
| `gemini-2.5-flash-image`, `imagen-4.0-*` | Superseded image generations; Nano Banana 2 / Pro already registered. |
| `lyria-realtime-exp` | Streaming RealTime music, already excluded. |
| `gpt-4o-mini-transcribe-2025-12-15` | OpenAI STT remains deferred to a separate architecture decision. |
| `gemini-3.1-flash-live-preview`, `gemini-3.5-live-translate-preview`, `gpt-realtime-2.1`, `gpt-realtime-2.1-mini`, `grok-voice-think-fast-2.0` | Live/realtime/speech-to-speech transports. |
| Embeddings, computer-use, deep-research, Antigravity, robotics, and retired GPT/o-series / Sora 2 slugs | Outside implemented AutoShow command lifecycles or already shut down. |

### 2026-08-16 image, video, and music refresh

Compared the active image, video, and music catalogs plus the xAI Imagine/Voice snapshots `project/links/grok-image-links.md`, `project/links/grok-tts-links.md`, and `project/links/grok-video-links.md`. Image, music, and video removals are implemented. Removed selectors stay parseable in historical manifests and pricing readers and fail direct selection with replacement guidance where the provider surface remains. Grok TTS speed, output-format, `replace`, and timestamp controls remain deferred.

#### TTS / STT watches

Cartesia Sonic 3.6 is documented as a beta on the moving alias `sonic-preview` (44 languages, locale codes such as `en-GB`, Odia/Urdu, improved Hinglish). AutoShow stays on the fixed snapshot `sonic-3.5-2026-05-04`. Do not register `sonic-preview`. Add 3.6 only when Cartesia publishes a dated snapshot ID comparable to `sonic-3.5-2026-05-04`.

deAPI whisper diarization is not a catalog tweak. deAPI STT is not implemented; curated links exist only. Upstream `WhisperLargeV3` has no diarization. `WhisperLargeV3Ct2` adds `diarize=true` and `ts_level: "word"` at +50% of the duration price (segment timestamps stay free). Adding that model is part of the deferred deAPI STT architecture decision in [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md), not this image/video/music refresh.

#### Image

Implemented 2026-08-16. Removed 12 selectors, kept `grok-imagine-image-quality`, and retired the Recraft provider and `recraft-image` flag. Active count: 34 − 12 = 22. The recorded `grok-imagine-image-2.0` successor is unavailable and was not added; the refresh was removal-only.

| Provider | Released | Max resolution | Aspect ratio | Count | Formats |
| -------- | -------- | -------------- | ------------ | ----- | ------- |
| fal.ai `microsoft/mai-image-2.5-pro` | ✅ 2026-07-28 | ❌ Unpublished | ✅ 8 ratios | ✅ 1–4 | ✅ png/jpeg/webp |
| Replicate `ideogram-ai/ideogram-v4-turbo` / `ideogram-v4-balanced` / `ideogram-v4-quality` | ✅ 2026-06-03 | ⚠️ Presets to 3328 | ❌ No | ❌ 1 | ❌ PNG |
| fal.ai `microsoft/mai-image-2.5` | ✅ 2026-06-02 | ❌ Unpublished | ✅ 8 ratios | ✅ 1–4 | ✅ png/jpeg/webp |
| Recraft `recraftv4_1` / `recraftv4_1_utility` | ✅ 2026-05-14 | ❌ 1MP presets | ✅ Size or ratio, not both | ✅ 1–6 | ❌ PNG |
| Recraft `recraftv4_1_pro` / `recraftv4_1_utility_pro` | ✅ 2026-05-14 | ✅ 4MP presets | ✅ Size or ratio, not both | ✅ 1–6 | ❌ PNG |
| Replicate `prunaai/ernie-image` / `ernie-image-turbo` | ✅ 2026-04-14 | ⚠️ Custom 64–2048 | ❌ No | ✅ 1–4 | ⚠️ png/jpeg |
| Grok `grok-imagine-image` | ✅ 2026-01-28 | ⚠️ 2K | ✅ 14 ratios | ✅ 1–10 | ❌ JPEG |

| Remove | Successor |
| ------ | --------- |
| `grok-imagine-image` | `grok-imagine-image-2.0` |
| `microsoft/mai-image-2.5`, `microsoft/mai-image-2.5-pro` | `alibaba/qwen-image-3` |
| `ideogram-ai/ideogram-v4-turbo`, `ideogram-ai/ideogram-v4-balanced`, `ideogram-ai/ideogram-v4-quality` | `bytedance/seedream-5-lite` |
| `recraftv4_1`, `recraftv4_1_pro`, `recraftv4_1_utility`, `recraftv4_1_utility_pro` | `flux-2-klein-4b` |
| `prunaai/ernie-image`, `prunaai/ernie-image-turbo` | `qwen/qwen-image-2` |

`grok-imagine-image-2.0` does not exist and was not added. The existing `grok-imagine-image-quality` selector remains active with its current generation and edit/reference behavior.

#### Video

Implemented 2026-08-16. Removed 16 selectors and retired standalone GLM video and Runway (`glm-video`, `runway-video`). Direct `MiniMax-H3` was not added and remains unavailable; fal.ai `minimax/h3` remains a separate active path. Active count: 32 − 16 = 16.

| Provider | Released | text-to-video | image-to-video | reference-to-video | interpolate | edit | extend | Duration | Max resolution | Aspect ratio | Native audio | References |
| -------- | -------- | ------------- | -------------- | ------------------ | ----------- | ---- | ------ | -------- | -------------- | ------------ | ------------ | ---------- |
| Replicate `runwayml/aleph-2` | ✅ 2026-05-21 | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ Clip 2–30s | ⚠️ Source | ❌ No | ❌ No | ❌ No |
| Replicate `wan-video/wan-2.7-t2v` | ✅ 2026-04-01 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ 2–15s | ⚠️ 1080p | ✅ 5 ratios | ❌ No | ❌ No |
| Runway `gen4.5` | ⚠️ 2025-12-01 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ 2–10s | ❌ 720p | ✅ 16:9 or 9:16 | ❌ No | ❌ No |
| MiniMax `MiniMax-Hailuo-2.3` | ⚠️ 2025-10-28 | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ⚠️ 6–10s | ⚠️ 1080p | ❌ No | ❌ No | ❌ No |
| MiniMax `MiniMax-Hailuo-2.3-Fast` | ⚠️ 2025-10-28 | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ⚠️ 6–10s | ⚠️ 1080p | ❌ No | ❌ No | ❌ No |
| GLM `cogvideox-3` | ⚠️ 2025 | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ⚠️ 5–10s | ✅ 4K | ✅ 5 ratios | ❌ Off | ❌ No |
| GLM `viduq1-text` | ⚠️ 2025 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ 5s | ⚠️ 1080p | ✅ 5 ratios | ❌ No | ❌ No |
| MiniMax `T2V-01` / `T2V-01-Director` | ⚠️ 2025-01 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ 6s | ❌ 720p | ❌ No | ❌ No | ❌ No |
| MiniMax `I2V-01` / `I2V-01-Director` / `I2V-01-live` | ⚠️ 2025-01 | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ 6s | ❌ 720p | ❌ No | ❌ No | ❌ No |
| MiniMax `S2V-01` | ⚠️ 2025-01 | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ 6s | ❌ 720p | ❌ No | ❌ No | ⚠️ 1 |
| GLM `vidu2-image` | ❌ 2024-11 | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ 4s | ❌ 720p | ✅ 5 ratios | ❌ No | ❌ No |
| GLM `vidu2-start-end` | ❌ 2024-11 | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ 4s | ❌ 720p | ✅ 5 ratios | ❌ No | ❌ No |
| GLM `vidu2-reference` | ❌ 2024-11 | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ 4s | ❌ 720p | ✅ 5 ratios | ❌ Off | ⚠️ Up to 3 |

| Remove | Successor |
| ------ | --------- |
| `MiniMax-Hailuo-2.3`, `MiniMax-Hailuo-2.3-Fast`, `T2V-01`, `T2V-01-Director`, `I2V-01`, `I2V-01-Director`, `I2V-01-live`, `S2V-01` | `MiniMax-H3` |
| `cogvideox-3`, `viduq1-text`, `vidu2-image`, `vidu2-start-end`, `vidu2-reference` | `ltx-2-3-fast` |
| `gen4.5` | `ray-3.2` |
| `runwayml/aleph-2` | `grok-imagine-video` edit |
| `wan-video/wan-2.7-t2v` | `bytedance/seedance-2.0-fast` |

`MiniMax-H3` is a new V2 adapter, not a rename of `/v1/video_generation`. Create on `POST /v2/video_generation` with required `model`, `content[]`, `resolution` (`768P`/`2K`), and `duration` (4–15). Poll `GET /v2/query/video_generation/{task_id}` for `task.content.url`; do not use the V1 file_id retrieve path. Mode mapping: text uses a single `text` item and requires a concrete `ratio` (not `adaptive`); image-to-video uses `role=first_frame` and ignores `ratio`; interpolate uses first plus last frame; reference-to-video accepts up to 9 images, 3 videos, and 3 audios with a mixed cap of 12. Defer H3-Context-IR and 768P→2K regeneration.

Also add Grok `grok-imagine-video-1.5` `reference_audios` (up to 3 TTS `voice_id`s; audio-only R2V allowed). Keep current Grok limits: edit/extend on `grok-imagine-video` only, 1080p on 1.5 text/image-to-video, reference-to-video capped at 720p. Ignore 1.5 aliases.

#### Music

Implemented 2026-08-16. Removed 2 selectors. Keep `music-3.0`. Active count: 5 − 2 = 3 (`music_v2`, `music-3.0`, `lyria-3-pro-preview`). Direct selection of the removed IDs fails with replacement guidance; historical manifests and pricing readers retain the retired rates.

| Provider | Released | Duration | Duration control | Instrumental | Lyrics | Output |
| -------- | -------- | -------- | ---------------- | ------------ | ------ | ------ |
| Gemini `lyria-3-clip-preview` | ✅ 2026-03-25 | ❌ 30s fixed | ❌ Fixed 30s | ✅ `--instrumental` | ⚠️ File appended to prompt | ❌ MP3, rate unpublished |
| ElevenLabs `music_v1` | ⚠️ 2025-08-05 | ✅ 3–600s | ✅ `--duration` | ✅ `--instrumental` | ❌ Prompt vocals only | ⚠️ 44.1 kHz / 128 kbps MP3 |

| Remove | Successor |
| ------ | --------- |
| `music_v1` | `music_v2` |
| `lyria-3-clip-preview` | `lyria-3-pro-preview` |

## API / Type Impact

- Write and OCR unions accept concrete 2026 OpenAI, Anthropic, Grok, Gemini, and Kimi identifiers.
- Active selector counts: 22 STT, 111 hosted TTS, 3 music, 22 hosted raster image, and 16 video selectors.
- Removed selectors are excluded from active CLI help, configuration defaults, and expansion lists, while remaining parseable in historical manifests and pricing readers.

## Rationale

- A consolidated dated ledger preserves refresh history without burdening durable policy documents with provider release notes.
- Recording specific exclusions and rejected aliases prevents future catalog sweeps from reintroducing incompatible endpoints.
- Documenting compatibility branches (Veo REST shapes, Gladia segment checkpoints, ElevenLabs audio formats) explains essential adapter logic that model tables alone cannot capture.

## Consequences

Positive outcomes:

- Provides a single audit trail for all 2026 hosted-model changes while maintaining clean separation from ADR-010 and ADR-012.
- Captures removed model identifiers, successor paths, and retired pricing for manifest continuity.
- Establishes clear baseline selector counts across all seven hosted modalities.

Negative outcomes:

- Provider snapshots age over time and require re-verification during subsequent refresh cycles.
- Temporary preview names and product aliases must be maintained in the ledger where upstream providers lack fixed version IDs.

## Trade-offs

| Gains                                                       | Sacrifices                                                               |
| ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| Consolidated 2026 provider chronology                       | Maintains a large dated document                                         |
| Clean separation from durable policy and benchmark evidence | Requires cross-referencing ADR-010 and ADR-012 for policy/evidence rules |
| Preserved historical identity and adapter context           | Historical adapter branches remain in codebase                           |

## Implementation Note

All earlier 2026 refresh phases are implemented across active model registries, provider adapters, pricing metadata, help documentation, resume handlers, and local test contracts. The 2026-08-16 image, music, and video removals are implemented. `grok-imagine-image-2.0` and direct `MiniMax-H3` were deliberately not added and remain unavailable. The 2026-08-16 text-catalog gap audit remains pending. Advanced multi-track capabilities remain governed by [ADR-018](ADR-018-sound-effects-and-multi-track-soundscape-pipeline.md), while benchmark run artifacts and report generation remain governed by [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md).

## Follow-up Actions

| Action                                                                                                                     | Owner                      | Current State                              |
| -------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------ |
| Record future large hosted-model refreshes in a new dated ledger section while preserving ADR-010 policy                   | Model registry maintainers | Ongoing guardrail                          |
| Implement the 2026-08-16 P1 write/OCR additions `gemini-3.7-flash` and `grok-4.6`                                          | Model registry maintainers | Pending                                    |
| Implement the remaining 2026-08-16 recommended selectors after confirming adapter fit and published pricing                | Model registry maintainers | Pending                                    |
| Watch Cartesia for a dated Sonic 3.6 snapshot; do not register `sonic-preview`                                             | Model registry maintainers | Deferred until a fixed 3.6 ID exists       |
| Recheck deferred specialized, streaming, realtime, cover, and reference-audio products via separate architecture ADRs      | Domain maintainers         | Deferred                                   |
| Promote provisional OCR token-billed heuristics and Florence compute-second estimates through approved ADR-012 calibration | OCR maintainers            | Deferred pending paid calibration approval |

## Test Plan

- Validate registry integrity using `bun run check`, `bun t --price`, CLI help/usage contracts, selector/default/expansion contracts, provider request/response mocks, pricing contracts, and resume identity tests.
- Verify active selector counts and removed-selector rejection across all seven modalities.
- Verify that documentation checks do not invoke paid or network-dependent provider endpoints.

## References

- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md) — Pipeline state and resume identity
- Related ADR: [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md) — Shared model consumers
- Related ADR: [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md) — Provider-lane scheduling
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) — Durable registry/lifecycle/capability policy
- Related ADR: [ADR-011](ADR-011-add-refresh-metadata-to-links.md) — Curated primary-source refreshes
- Related ADR: [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md) — Benchmark evidence and generated reports
- Related ADR: [ADR-014](ADR-014-add-character-voice-references-and-multi-speaker-script-to-audio.md) — Character voice and multi-speaker architecture
- Related ADR: [ADR-018](ADR-018-sound-effects-and-multi-track-soundscape-pipeline.md) — Soundscape and added TTS provider implementation phases
- Hosted model registries: `src/cli/commands/setup-and-utilities/models/`
- Provider adapters: `src/cli/commands/process-steps/step-2-extract/`, `src/cli/commands/process-steps/step-3-write/`, `src/cli/commands/process-steps/step-4-tts/`, `src/cli/commands/process-steps/step-5-image/`, `src/cli/commands/process-steps/step-6-video/`, `src/cli/commands/process-steps/step-7-music/`
- Resume handlers: `src/cli/commands/setup-and-utilities/resume/`
- Historical cost reconstruction: `src/cli/commands/pricing-orchestration/compute-actual-costs.ts`
- Primary-source snapshots: `src/cli/commands/setup-and-utilities/links/model-links/`
- 2026-08-16 text-catalog dump: `project/links/claude-models-text--gemini-models-text--grok-models-text--openai-models-text-links.md`
- 2026-08-16 Imagine/Voice snapshots: `project/links/grok-image-links.md`, `project/links/grok-tts-links.md`, `project/links/grok-video-links.md`
- MiniMax H3: https://platform.minimax.io/docs/guides/video-generation.md, https://platform.minimax.io/docs/api-reference/video-generation-v2-create.md
- STT benchmark artifacts: `docs/benchmarks/stt/`
- Music benchmark artifacts: `docs/benchmarks/music/`
