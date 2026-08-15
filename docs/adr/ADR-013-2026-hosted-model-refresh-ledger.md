# ADR-013: Record the 2026 Hosted-Model Refresh Ledger

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-08-03
- **Date Updated:** 2026-08-15
- **Verification Status:** Passed
- **Supersession:** Consolidates the former per-modality 2026 refresh records into one dated ledger. Durable registry, lifecycle, and capability policy belongs to [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md); paid approvals, calibration results, artifact repair evidence, and generated-report contracts belong to [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md).

## Context

AutoShow completed a broad 2026 refresh of every hosted model registry. The work changed selectors, provider request shapes, prices, defaults, all-provider expansion, resume identity, historical readers, and locally testable capability contracts across write, OCR, STT, TTS, music, image, and video. Active surfaces moved to 22 STT selectors, 111 hosted TTS selectors, 5 music selectors, 34 hosted raster image selectors, and 32 video selectors.

Those provider releases are implementation history rather than the stable place future maintainers should learn registry policy. ADR-010 owns the durable rules and ADR-012 owns how a refresh is proven, so this ledger records only what changed during the 2026 refresh and why provider-specific adapter branches remain. It is intentionally dated: future refreshes may append a new dated section or open a new ledger, but must not turn these provider snapshots into timeless policy.

Why now: the refresh is complete across all seven hosted command surfaces, and its provider-specific decisions need one dated home before release history accumulates inside the durable policy and evidence records and ages their contracts.

## Options Considered

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **One dated cross-modality refresh ledger separated from durable policy and evidence architecture** | Keeps all 2026 additions, removals, provider constraints, corrections, and final counts discoverable without duplicating policy | Produces a long historical record and requires links to policy/evidence authorities | Consolidates refresh chronologies across 7 hosted command surfaces |
| Keep one live refresh ADR per modality | Keeps provider details in smaller files | Repeats policy and paid-verification rules across multiple documents | Retains multiple dated refresh authorities |
| Put all chronology into the durable policy ADR | Gives one model document | Buries stable lifecycle/capability rules under provider release history | More than 1,000 lines of mixed policy and evidence |
| Preserve only current registry code and delete the decision history | Minimizes documentation | Loses why historical identities, provider branches, and exclusions exist | No audit trail for removed selectors or paid corrections |

## Decision

Keep one 2026 hosted-model refresh ledger organized by command modality and provider, recording additions, replacements, removals, exclusions, compatibility branches, final selector counts, and corrections that still explain current code.

This applies to:

- dated provider and model changes across write, OCR, STT, TTS, music, image, and video, plus the adapter branches and historical readers those changes require;
- not durable registry policy, which ADR-010 owns and which wins whenever a dated statement here conflicts with it;
- not benchmark trustworthiness, paid approval, or report generation, which ADR-012 owns.

Latency and token heuristics for new or replacement selectors reuse the closest prior per-provider baseline and stay provisional until an approved ADR-012 calibration promotes them. This ledger records prices and capability contracts rather than those provisional estimates.

### Write and OCR refresh

#### OpenAI

- Added concrete `gpt-5.6-sol`, `gpt-5.6-terra`, and `gpt-5.6-luna` selectors to write and OCR; the duplicate `gpt-5.6` alias was not registered. OCR structured-output validation includes all three concrete tiers.
- On 2026-08-12, current Terra rates were synchronized to `$2/1M` input and `$12/1M` output tokens and Luna to `$0.20/1M` input and `$1.20/1M` output across write, OCR, docs, and pricing.

#### Anthropic

- Added `claude-fable-5` and `claude-sonnet-5` to write, `claude-fable-5` to OCR, and `claude-opus-5` to write and OCR.
- Excluded invitation-only `claude-mythos-5` rather than advertising limited availability as self-serve GA.
- Fable 5's retention/ZDR constraint is recorded as provider metadata rather than a hidden adapter assumption.

#### xAI Grok

- Added `grok-4.5` to write while retaining its OCR selector. `grok-4.3` remained the cheaper bare write target; write expansion orders 4.3 before 4.5.
- Rejected `grok-4.5-latest`, `grok-build-latest`, and other moving aliases.
- Corrected the published Grok 4.5 price bands to `$2/$0.30/$6` per 1M input/cached-input/output tokens through 200K input tokens and `$4/$0.60/$12` above 200K. Estimates use uncached rates.

#### Google Gemini

- Added `gemini-3.6-flash`, `gemini-3.5-flash`, and `gemini-3.5-flash-lite` to write; added `gemini-3.6-flash` and `gemini-3.5-flash-lite` to OCR, where 3.5 Flash already existed.
- Used published flat Standard rates of `$1.50/$7.50` for Gemini 3.6 Flash, `$1.50/$9.00` for Gemini 3.5 Flash, and `$0.30/$2.50` for Gemini 3.5 Flash-Lite per 1M input/output tokens.
- Did not register `gemini-3-flash-preview` or moving `*-latest` aliases.
- The Gemini 3.6/3.5 API transition required no new client branch: AutoShow did not send deprecated `temperature`, `top_p`, `top_k`, or `thinking_budget`, did not prefill model turns, did not request unsupported `candidate_count`, and already used `thinkingConfig.thinkingLevel` for Gemini 3 OCR.
- On 2026-08-13, `gemini-3.5-flash-lite` became the deterministic bare and automatic write/OCR target and `gemini-3.1-flash-lite` was retired from active lists and config, ahead of Google's then-announced earliest shutdown date of 2027-05-07.
- Direct retired-selector requests now fail with `gemini-3.5-flash-lite` guidance and no silent substitution. Completed historical manifests retain their original model, unfinished OCR state cannot dispatch the retired target, and historical `$0.25/$1.50` input/output rates remain in retired-rate handling.

#### Moonshot Kimi

- Added `kimi-k3` to write and OCR at published `$3.00/$0.30/$15.00` input/cache-hit-input/output rates. Estimates use uncached input.
- Preserved `kimi-k2.6` as the cheaper bare default.
- K3 rejects the K2.x `thinking` field and uses always-on reasoning; `thinking: { type: "disabled" }` still applies to K2.x. The normalized reasoning resolver owns that model-ID policy, so adapters must not reintroduce a local branch.

#### Additional LLM/OCR audits

- Removed the duplicate `mistral-ocr-latest` selector because it was byte-for-byte equivalent to `mistral-ocr-4-0`, doubled paid all-OCR work, and contradicted the fixed-ID rule. `mistral-ocr-2512` remained the cheapest Mistral default.
- The 2026-08-10 MiniMax structured-output gate remained negative: current `MiniMax-M3` OpenAI-compatible documentation exposed no `response_format` or `json_schema`, and only the deprecated native `MiniMax-Text-01` endpoint documented JSON Schema. The compatibility fallback and schema-guided strategy therefore remain live.

### 2026-08-14 OCR provider-surface expansion

The prioritized OCR expansion across Replicate, fal.ai, and DeepInfra implemented all eight P1–P8 entries in recorded priority order. DeepInfra additions were registry-only changes (`ocr-config/ocr-deepinfra.json`, `ocr-models.ts` validation, help, docs, and contracts) reusing the OpenAI-compatible vision API. Replicate and fal.ai introduced new step-2 OCR services (`ocr-services/replicate-ocr/` and `ocr-services/fal-ocr/`) reusing existing provider client transports, pricing provenance, resume identity, and mocked adapter contracts. Token-billed page costs reuse the DeepInfra per-page heuristic (~7,981 prompt tokens and ~472 completion tokens per page) and stay provisional until an approved ADR-012 calibration promotes them.

| Priority | Selector | Provider | Pricing basis | Est. cost per 1k pages | Rationale |
|---|---|---|---|---|---|
| P1 | `datalab-to/ocr` | Replicate (official) | $2 per 1,000 pages, flat page billing | $2.00 | Official page-billed model matching Mistral OCR's price point; text detection with bounding boxes, layout analysis, reading order, and table recognition in 90 languages. Best new cost/quality point and deterministic price preflight. |
| P2 | `datalab-to/marker` | Replicate (official) | $4 per 1,000 pages, pinned `fast` mode | $4.00 | Official Marker pipeline with markdown/JSON output; ~0.18 s/page batched and 76.0 on olmOCR-bench (Marker 2). AutoShow pins `mode=fast` so execution and price preflight use the same $4 band. |
| P3 | `google/gemma-3-27b-it` | DeepInfra | $0.08/1M input, $0.16/1M output tokens | ~$0.72 | Cheapest credible-quality addition and the lowest implementation cost of the entire expansion (registry JSON only, adapter unchanged). |
| P4 | `mistralai/Mistral-Small-3.2-24B-Instruct-2506` | DeepInfra | $0.075/1M input, $0.20/1M output tokens | ~$0.69 | Comparable price to Gemma 3 27B with solid vision/OCR quality and improved instruction following; registry-only change. |
| P5 | `lucataco/deepseek-ocr` | Replicate (community) | L40S hardware-billed, ~$0.0033 per ~4 s prediction | ~$3.30 (variable) | Strong document parsing (markdown, tables, LaTeX, ~100 languages) with high visual-token compression, but a community deployment that must pin a verified version at dispatch per the Pruna precedent, and per-second billing makes the page estimate heuristic rather than contractual. |
| P6 | `meta-llama/Llama-4-Scout-17B-16E-Instruct` | DeepInfra | $0.10/1M input, $0.30/1M output tokens | ~$0.94 | Cheap multimodal breadth for fan-out comparison runs; OCR quality trails the entries above, so it ranks on cost and diversity rather than accuracy. |
| P7 | `fal-ai/got-ocr/v2` | fal.ai | $0.05 per image | $50.00 | Unique specialty coverage (formatted documents, tables, charts, mathematical formulas, geometric shapes, molecular formulas, sheet music) but 25x the P1 price; justified only for specialty content, never as a default or all-OCR economy target. |
| P8 | `fal-ai/florence-2-large/ocr` | fal.ai | $0.00125 per GPU compute second | ~$7.55 (benchmark-calibrated estimate) | Compute-second billing has no fixed per-page or per-token rate, so the registry carries a benchmark-calibrated estimate from the 2026-08-14 Florence run (29 pages in 175.099 observed wall seconds, ~6.04 s/page) and explicitly marks it as an estimate rather than an invoice amount; billed GPU seconds vary by image and runtime. |

Pricing provenance was checked 2026-08-14 against Replicate, fal.ai, and DeepInfra model pages.

Excluded from the expansion, with exclusion rationale recorded to prevent treating these as omissions:

- Replicate `abiruyt/text-extract-ocr`: Tesseract-class plain-text extraction; the free local `tesseract` engine already covers this tier.
- Replicate `lucataco/glm-ocr`: duplicates the registered direct GLM provider's `glm-ocr` selector.
- Replicate `cuuupid/marker`: superseded by official `datalab-to/marker`.
- Replicate `bytedance/dolphin`, `mickeybeurskens/latex-ocr`, `willywongi/donut`, `cjwbw/docentr`, `awilliamson10/meta-nougat`, `cudanexus/ocr-surya`, and `pbevan1/llama-3.1-8b-ocr-correction`: low-usage community deployments, single-purpose utilities, or pre/post-processing stages rather than general-purpose page OCR.
- fal.ai `openrouter/router/vision`: moving router violating the fixed-ID rule.
- fal.ai `moondream3-preview/*`: preview-named endpoints; deferred until a fixed non-preview ID exists.
- fal.ai `docres` and `docres/dewarp`: document image enhancement, not OCR.
- DeepInfra partner-hosted Anthropic Claude and Google Gemini selectors: duplicate direct providers without price advantages.
- DeepInfra `google/gemma-3-12b-it` and `google/gemma-3-4b-it`: marginal savings over Gemma 3 27B with weaker OCR quality.

### STT refresh

The STT refresh covered concrete general-purpose hosted batch models only, finishing with 22 active selectors. It excluded medical/specialized, streaming/realtime, dedicated-deployment, human, retrieval, and moving-alias products including Nova-3 Medical, Deepgram Flux, Mistral Realtime, Together streaming/dedicated offerings, Happy Scribe Pro, and Supadata retrieval modes.

| Provider | Active change and retained contract |
|---|---|
| AssemblyAI | Replaced `universal-3-pro` with ordered `universal-3-5-pro` and `universal-2`. Bare selection chooses cheaper Universal-2; both remain in all-provider expansion. The async upload/create/poll body sends singleton `speech_models`, diarization, and optional expected speakers. Effective diarization-inclusive rates are `$0.23/hour` and `$0.17/hour`. |
| Deepgram | Retained only concrete general-purpose `nova-3`; explicitly excluded redundant `nova-3-general` and domain-specific `nova-3-medical`. Diarization-inclusive price remains `$0.0097/minute` or `$0.582/hour`. |
| Gemini | Replaced `gemini-3-flash-preview` with `gemini-3.6-flash` on the existing GenerateContent/Files adapter. Standard price is `$1.50/1M` input and `$7.50/1M` output/thinking tokens; the 32 audio-token/second baseline estimates `$0.1728/hour`. |
| Gladia | Replaced non-identifying `default` with ordered `solaria-1` and `solaria-3`. Bare selection chooses tied-first Solaria 1. The async create body sends the selected model, diarization, and optional exact speaker count. Both use `$0.61/hour`. |
| Soniox | Replaced `stt-async-v4` with concrete `stt-async-v5` on the compatible async lifecycle. The create body sends model/file identity and enables diarization unless disabled. Pricing is approximately `$0.10/hour`. |
| Speechmatics | Retained `enhanced` and added cheaper batch-only `melia-1`. The current request uses `model` instead of deprecated `operating_point`; Enhanced sends `language: "auto"`, Melia `language: "multi"`, and both enable diarization. Rates are `$0.40/hour` and `$0.129/hour`. |
| Together | Retained `openai/whisper-large-v3` and added `nvidia/parakeet-tdt-0.6b-v3` on multipart batch transcription at `$0.0015/audio minute` (`$0.09/hour`). Whisper may receive an optional prompt; Parakeet omits it. Parakeet's operational split cap became 20 MiB after a 103 MB request failed despite the published larger batch limit. |

Completed historical results for removed selectors remain reportable. Unfinished removed targets fail generic active-registry validation and never relabel a replacement under the old identity.

Two corrections found during benchmark validation remain in current code: the split Gladia checkpoint isolates every segment's remote job, and compacted STT resume reads canonical structured `result.json` before the legacy `transcription.txt` fallback.

### TTS refresh and catalog narrowing

The hosted TTS catalog standardized on 111 active selectors across 15 hosted providers (plus local Kitten TTS). Outdated and moving selectors were replaced with fixed versions or retired with explicit refusal guidance. All active selectors participate in the canonical TTS selection descriptor, repeatable `--provider provider=model` normalization, `--all-tts` policy, price planning, and additive resume.

| Provider | 2026 decision and active implementation |
|---|---|
| Speechify | Replaced legacy `simba-english` and `simba-3.0` with active default `simba-3.2`; added current pricing/timing, model-specific language and built-in-voice validation, and historical identity handling. Clone access was not inferred. |
| Cartesia | Replaced `sonic-3` and moving `sonic-3.5` with fixed `sonic-3.5-2026-05-04`, preserving compatible default voice behavior and historical aliases. |
| OpenAI | Replaced moving `gpt-4o-mini-tts` with fixed `gpt-4o-mini-tts-2025-12-15`. Retired classic `tts-1` and `tts-1-hd` because they reject instruction steering. Custom voices serialize as `{ id: "voice_…" }`. |
| Deepgram | Expanded from 8 to all 91 documented Aura-2 voice-model IDs across seven languages on the existing query transport, 2,000-character limit, and Aura-2 price. Aura-1 and Early Access Flux remain excluded. Deepgram's one-default all-TTS policy prevents 91 voices from multiplying ordinary all-provider execution. |
| ElevenLabs | Retained flagship `eleven_v3` with current pricing, timing, limits, controls, help, and tests on the existing endpoint. Retired earlier multilingual/flash variants to keep only the native-dialogue flagship. |
| Mistral | Retained exact canonical `voxtral-mini-tts-2603`, which primary documentation enumerates as the API ID. |
| Groq | Retained English Orpheus (`canopylabs/orpheus-v1-english`) with default voice `abdullah`. Retired narrow Arabic Orpheus selector. |
| xAI | Kept local product selector `grok-tts` because the REST request has no model field; expanded stock voices from 5 to all 26 documented case-insensitive IDs with `eve` default and retained eight-lowercase-alphanumeric custom-ID validation. |
| Gemini | Kept `gemini-3.1-flash-tts-preview` and added all 30 documented case-insensitive prebuilt voices for single-speaker and exactly-two-speaker TTS. |
| Inworld | Added `realtime-tts-2` on first-party REST synthesis at published `$25/1M` characters (API ID `inworld-tts-2`). Removed legacy 1.5 Max/Mini IDs and retired Flash variant. Contract covers single-voice synthesis, steering/markup serialization, and read-only catalog discovery; advanced capabilities remain gated by ADR-018. |
| DeepInfra | Added `ResembleAI/chatterbox-turbo` ($1/1M chars), `XiaomiMiMo/MiMo-V2.5-tts` ($0/1M promo rate), `XiaomiMiMo/MiMo-V2.5-tts-voicedesign` ($0/1M), `Qwen/Qwen3-TTS` ($20/1M), and `Qwen/Qwen3-TTS-VoiceDesign` ($20/1M) on the hosted inference transport. Chatterbox uses `text` and optional `voice_id`, MiMo uses `text` and `voice` (1,000-char limit), and Qwen uses `input` and `voice` (4,000-char limit). Retired failing `chatterbox-multilingual`. |
| Replicate | Added version-pinned `jaaari/kokoro-82m` with exact `{ text, voice, speed? }` serialization, validated stock voices, immediate output capture, and estimated `$0.00022` prediction. Removed speculative `x-lance/f5-tts`, `zsxkib/dia`, and `lucataco/xtts-v2` entries lacking Kokoro-compatible schemas. |
| Fish | Standardized on `s2.1-pro` at published `$15 / M UTF-8 bytes` ($0.015 / 1K characters English ASCII estimate) as Fish's sole synthesis model. Native dialogue, timestamp streaming, and `[bracket]` delivery markup are scoped to `s2.1-pro`. `voice-design-1` is exposed as the Voice Design creation endpoint via `--creation-model voice-design-1` rather than a synthesis selector. |

Stock-voice changes that did not alter a model selector remain in this ledger because they explain current capability tables and request validation. Voice resource lifecycle, casting, cloning, and multi-speaker architecture belong to ADR-014.

Resume no longer carries a handwritten 12-provider inventory: new-provider completeness is compile-time checked against model fields, and local contracts prove selection/resume parity across all 16 current TTS providers. ADR-002 owns the narrow completed-legacy-TTS bridge; ADR-012 records the paid cohort evidence.

#### Refused / do not reimplement

These twelve selectors are retired on purpose. Direct selection fails with replacement guidance and no silent substitution. Do not reintroduce them during catalog or language sweeps.

| Refused selector | Replacement | Why not come back |
|---|---|---|
| `fish/fish-speech-1.5` | `s2.1-pro` | Superseded Fish generation; official API no longer lists this AutoShow-local alias |
| `fish/s1` | `s2.1-pro` | Previous-generation parenthesis-tag model |
| `fish/s2-pro` | `s2.1-pro` | Previous S2 generation; `s2.1-pro` is Fish's production default with the same native-dialogue and timestamp contract |
| `fish/voice-design-1` | `s2.1-pro` | Not a synthesis selector; it is the Voice Design creation endpoint of `s2.1-pro` |
| `elevenlabs/eleven_multilingual_v2` | `eleven_v3` | Keep only the current native-dialogue flagship |
| `elevenlabs/eleven_flash_v2_5` | `eleven_v3` | Latency sibling of a refused generation |
| `inworld/realtime-tts-2-flash` | `realtime-tts-2` | Latency sibling that rejected `--tts-instructions` |
| `speechify/simba-3.0` | `simba-3.2` | Keep only the current Speechify default |
| `deepinfra/ResembleAI/chatterbox-multilingual` | `ResembleAI/chatterbox-turbo` | Keep turbo; live hard-input HTTP 500s |
| `openai/tts-1` | `gpt-4o-mini-tts-2025-12-15` | Reverses earlier classic OpenAI retention; classic models reject instructions |
| `openai/tts-1-hd` | `gpt-4o-mini-tts-2025-12-15` | Same classic OpenAI refusal |
| `groq/canopylabs/orpheus-arabic-saudi` | `canopylabs/orpheus-v1-english` | Narrow language, 200-character WAV-only, no vocal directions |

### Music refresh

The active music surface finished with 5 selectors across 3 hosted providers.

- Added ElevenLabs `music_v2` while retaining `music_v1` during its documented transition. The compose route automatically selects `mp3_44100_128` for v1 and `mp3_48000_192` for v2 and records the actual format. The v2 contract remains prompt-only; reference audio, inpainting, long-form section composition, and fine-tuning were not implied.
- Replaced MiniMax `music-2.6` with recommended `music-3.0` on the existing `/v1/music_generation` prompt/lyrics/instrumental lifecycle. New selection rejects 2.6; historical readers preserve its `15¢` per-track rate plus `1¢` for generated lyrics. A recorded provider cost still wins.
- Retained Gemini `lyria-3-clip-preview` and `lyria-3-pro-preview`, their per-track pricing, 30-second Clip behavior, prompt-controlled Pro duration, and Interactions API routing. Lyria RealTime is a streaming product, not another finished-track selector.
- Excluded MiniMax free-tier duplicate IDs, `music-cover`, cover-free, reference-audio products, and Lyria RealTime because their availability, inputs, rate limits, or streaming lifecycle differ from text-to-music.
- Additive music resume now promotes outputs to provider/model-specific filenames before merging metadata, preventing artifact collisions during benchmark passes.

### Image refresh

The image phase removed seven active identities and finished with 34 hosted raster selectors.

| Provider | 2026 decision and implementation |
|---|---|
| Gemini | Removed shut-down `gemini-3.1-flash-image-preview`; added `gemini-3.1-flash-lite-image`, `gemini-3.1-flash-image`, and `gemini-3-pro-image`, with Lite as the release/default selected at the cutoff. Added model-specific price, timing, size, references, response handling, docs, and historical identity. |
| Reve | Removed the direct provider and `latest`/`reve-create@20250915` selectors before its announced 2026-08-14 public-API sunset. Historical results remain direct-Reve identities. Missing Reve-only resume fails generic target reconstruction; mixed incomplete manifests may run other providers and then remain incomplete, but never substitute Reve. |
| Recraft | Removed all four SVG/vector generation selectors. Hosted generation remains raster-only; generic SVG reading may remain for historical/external inputs. |
| BFL | Added fixed `flux-2-klein-4b` and `flux-2-klein-9b` endpoints with pricing, timing, output/reference constraints, help, and tests; moving previews remain excluded. |
| Replicate | Added `bytedance/seedream-5-pro`, Ideogram v4 Turbo/Balanced/Quality, and Pruna ERNIE Image standard/Turbo. Family-specific builders enforce outputs, references, resolution, price, and timing; community Pruna deployments pin verified versions at dispatch while selectors stay stable. |
| fal.ai | Added `fal-ai/hidream-o1-image`, `microsoft/mai-image-2.5`, `microsoft/mai-image-2.5-pro`, `alibaba/qwen-image-3`, and `reve/2.1` with queue/poll/cancel/retry/download, price, reference/output, help, defaults, resume, and mocked contracts. fal Reve 2.1 is never reinterpreted as a retired direct-Reve result. |

Excluded older/superseded Recraft, Qwen, Reve, MAI, and unverified Hunyuan endpoints. Current purpose-specific quality/latency tiers remain eligible when they are not replacements.

### Video refresh

The video phase replaced one selector, added eight, and finished with 32 hosted selectors.

- Replicate replaced `alibaba/happyhorse-1.0` with 1.1 and added Kling v3 Video, Kling v3 Omni, PixVerse V6, and Runway Aleph 2. Aleph requires an input video. The adapter added family request builders, output normalization, duration/resolution, native audio, multi-shot, references, edit inputs, price, resume, and historical HappyHorse pricing.
- xAI added `grok-imagine-video-1.5` with per-second/resolution-aware pricing and model-specific input/reference rules while retaining the original Grok selector for broader edit/extend operations. A later references feature expanded the same selector rather than adding another model identity.
- fal.ai added stable `minimax/h3`, routing explicit text/image/reference modes to their corresponding H3 endpoints with 768p/2K prices, duration/aspect, stereo audio, first/last frames, and multimodal references. The direct MiniMax adapter did not invent an H3 ID absent from its published enumeration.
- fal.ai added stable `fal-ai/pixverse/c1`, routing explicit text/image/reference/transition modes with reference naming, first/last frames, native audio, multi-clip, 1–15-second duration, 360p–1080p validation, and resolution-aware pricing. C1 and Replicate PixVerse V6 are purpose-specific siblings.
- Retained current LTX 2.3 Fast/Pro, original Grok, Seedance 2.0/2.0 Fast, Wan 2.7 T2V, Veo 3.1 Lite, and Ray 3.2. Excluded LTX-2, SkyReels V3, HappyHorse 1.0, Ray3.14, unreleased Meta Muse, unavailable SkyReels V4, realtime Helios, and interactive PixVerse R1/PikaStream/Vidu products.

The MiniMax audit retained all six direct 01-series selectors because the provider's T2V/I2V/S2V enumerations still listed them. Bare MiniMax video remained 19¢ `T2V-01` rather than the 28¢ Hailuo 2.3 while the cheaper fixed model stayed served. Historical contracts pin all six 19¢ rates.

The Veo audit kept the raw REST output boundary: completed operations read `response.generateVideoResponse.generatedSamples[0].video`, and inline bytes use `encodedVideo` plus `encoding`. SDK-normalized `videoBytes`/`mimeType`, unwrapped responses, raw `generatedVideos`, and `_self` aliases were removed because they mixed SDK and REST shapes.

## API / Type Impact

- Write/OCR unions gained the concrete 2026 OpenAI, Anthropic, Grok, Gemini, and Kimi models described above; Gemini 3.1 Flash-Lite and duplicate Mistral latest are absent from active validation but remain historically readable where applicable.
- STT active entries finish at 22, hosted TTS at 111, music at 5, hosted image at 34 raster selectors, and video at 32 selectors, each with exact model/voice/mode compatibility.
- Removed selectors are absent from current help, defaults, all-provider expansion, and new manifests. Historical results keep their provider/model keys and rates.
- Bare defaults and all-provider expansion changed only through explicit active-registry policy; invalid model-specific modes fail before pricing or dispatch.

## Rationale

- A single dated ledger preserves provider history without making release details the durable registry authority.
- Grouping all modalities reveals where similar selector rules produced different adapter work and why those branches remain.
- Concrete model IDs and preserved historical identities keep reports and manifests reproducible through refreshes.
- Recording rejected and deferred products prevents a future catalog sweep from treating incompatible transports as omissions.
- Keeping exact corrections—checkpoint isolation, compacted resume, music artifact naming, Veo REST normalization—explains current code that model tables alone cannot justify.

## Consequences

Positive outcomes:

- Maintainers can audit every 2026 hosted-model change in one dated record while learning current policy from ADR-010.
- Removed model identities, successor paths, provider-specific capabilities, and retained compatibility branches remain discoverable.
- Selector counts and modality outcomes are explicit without duplicating paid benchmark authority.

Negative outcomes:

- The ledger is large and should not accumulate unrelated future architecture.
- Provider facts are snapshots and require rechecking before a future refresh.
- Some retained model names are previews or local product labels because the underlying current product has no fixed alternative; the ledger must preserve that nuance.

## Trade-offs

| Gains | Sacrifices |
|---|---|
| One searchable 2026 provider chronology | A long dated record |
| Durable policy and evidence remain separate | Readers may follow links across three authorities |
| Exact compatibility and correction history | Provider details will age |
| Preserved removed-model rationale | Continued historical-reader maintenance |

## Implementation Note

All selectable baseline refresh phases described here are implemented, including the 2026-08-14 OCR provider-surface expansion: its DeepInfra registry entries, new Replicate and fal.ai step-2 OCR services, pricing provenance, resume identity, mocked contracts, and the benchmark-calibrated Florence compute-second estimate all shipped in P1–P8 order. Current registries, provider adapters, price metadata, help, docs, resume behavior, historical normalization, and local contracts reflect the final selector sets. ADR-018 remains the authority for advanced Inworld, DeepInfra, Replicate, and Fish capabilities that have not passed their original phase gates. ADR-012 retains the corresponding source, no-cost preflights, exact paid approvals, 51-of-52 corrected-cohort result, preserved DeepInfra failure evidence, and regenerated reports.

## Follow-up Actions

| Action | Owner | Current State |
|---|---|---|
| Append future large hosted-model refreshes as a new dated ledger or clearly dated section while keeping durable policy in ADR-010 | Model registry maintainers | Ongoing guardrail |
| Recheck deferred specialized, streaming, realtime, cover, reference-audio, SkyReels, Helios, deAPI, and OpenAI STT products only through their required architecture decisions | Domain maintainers | Deferred outside this completed refresh |
| Promote the expansion's provisional token-billed page heuristics and the benchmark-calibrated Florence compute-second estimate only through approved ADR-012 calibration | OCR maintainers | Deferred pending immediate approval for each exact paid calibration run |

## Test Plan

- Use ADR-010's shared local registry/capability verification and ADR-012's evidence lifecycle.
- Run `bun run check`, `bun t --price`, CLI help/usage/option-resolution contracts, selector/default/expansion contracts, provider request/response contracts, pricing/provenance contracts, resume/historical-identity contracts, and `git diff --check`.
- Verify active selector counts and removed-selector rejection for each modality, plus exact capability combinations for models changed in the ledger.
- Do not run hosted provider commands, provider smoke tests, price-associated E2E paths, or the full suite as documentation verification. Any future paid refresh or calibration requires immediate approval for its exact command and risk.

## References

- Pipeline state and resume identity: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)
- Shared model consumers: [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md)
- Provider-lane scheduling: [ADR-008](ADR-008-decompose-work-into-chunks-and-concurrency-lanes.md)
- Durable registry/lifecycle/capability policy: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)
- Curated primary-source refreshes: [ADR-011](ADR-011-add-refresh-metadata-to-links.md)
- Benchmark evidence and generated reports: [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md)
- Character voice and multi-speaker architecture: [ADR-014](ADR-014-add-character-voice-references-and-multi-speaker-script-to-audio.md)
- Soundscape and added TTS provider implementation phases: [ADR-018](ADR-018-sound-effects-and-multi-track-soundscape-pipeline.md)
- Hosted model registries: `src/cli/commands/setup-and-utilities/models/`
- Provider adapters: `src/cli/commands/process-steps/step-2-extract/`, `src/cli/commands/process-steps/step-3-write/`, `src/cli/commands/process-steps/step-4-tts/`, `src/cli/commands/process-steps/step-5-image/`, `src/cli/commands/process-steps/step-6-video/`, `src/cli/commands/process-steps/step-7-music/`
- Resume handlers: `src/cli/commands/setup-and-utilities/resume/`
- Historical cost reconstruction: `src/cli/commands/pricing-orchestration/compute-actual-costs.ts`
- Primary-source snapshots: `project/links/`
- STT benchmark artifacts: `docs/benchmarks/stt/`
- Music benchmark artifacts: `docs/benchmarks/music/`
