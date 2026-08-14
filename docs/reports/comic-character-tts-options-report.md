# Cartoon Sci-Fi Space Crew Voice, Multi-Character TTS, and Soundscape/Foley Options Report

Assessment date: 2026-08-10. Repository baseline: `1bba61c2`. Updated 2026-08-14 to reflect the completed ADR-014 dialogue foundation, the proposed ADR-018 soundscape decision, removal of direct Resemble SaaS, committed delivery phases for first-party Inworld AI, DeepInfra hosted models (ResembleAI Chatterbox, Xiaomi MiMo V2.5, Qwen3-TTS), Replicate open-source speech models (F5-TTS, Dia 1.6B, XTTS-v2), fal.ai unique speech evaluation (Seed Speech v2, Maya1, Zonos2, VibeVoice, Async TTS Pro), and snapshot acquisition via `bun as links`.

## Purpose

This report evaluates the hosted API options relevant to producing comic dialogue, non-verbal vocal reactions, discrete foley, and ambient soundscapes. It is supporting research, not the architecture authority: [ADR-014](../adr/ADR-014-add-character-voice-references-and-multi-speaker-script-to-audio.md) governs voice identity and dialogue rendering, while [ADR-018](../adr/ADR-018-sound-effects-and-multi-track-soundscape-pipeline.md) proposes provider-neutral sound intent, sound-effect generation, timeline placement, and multi-bus mastering.

Provider capabilities and access conditions change independently of AutoShow. A product feature, marketing page, model paper, or third-party wrapper is not enough to establish an implementation target. A candidate normally needs a current official developer endpoint, documented request and response contract, model-qualified capabilities, pricing evidence, and an access/readiness path that can be represented truthfully. ADR-018 makes one explicit exception for the Phase 7 community AudioGen deployment and offsets that weaker lifecycle guarantee with exact version pinning, provenance, opt-in selection, and historical-readability requirements.

No hosted audio generation was run for this report. Repository status was checked locally, and external capability claims were limited to current official provider documentation plus the exact Replicate community-model schema selected by ADR-018 and documentation snapshots captured with `bun as links`.

## Repository baseline

ADR-014 completed the shared dialogue subsystem on 2026-08-11:

- `comic reference-voice` and the shared `voice` surface manage protected candidates, auditions, consent, approval, lifecycle, and immutable provider-qualified registrations.
- `comic generate-audio` consumes `structured-script.json` v4, builds `ComicDialoguePlan` v2, resolves approved voice snapshots, and selects native or segmented dialogue strategies.
- Every dialogue adapter receives explicit per-turn voice identity, runs through bounded provider work, records request evidence, and retains versioned render artifacts.
- The local mastering path supports deterministic pauses, overlaps, selected voice effects, 16-bit or 24-bit mono or stereo PCM WAV output, transform ledgers, final dialogue timelines, caching, and operation-scoped resume.
- ElevenLabs, Hume, Cartesia, and MiniMax have first-class voice-management or advanced dialogue capabilities; seven other hosted dialogue adapters remain available but are outside the soundscape-provider comparison below.

The current implementation does not yet represent authored soundscape intent, generate independent foley assets, resolve cues against the selected final dialogue clock, retain reusable non-speech stems, or render the four-bus master described by ADR-018.

## ADR-018 soundscape direction

ADR-018 is Proposed · Pending. It deliberately separates authored intent from provider execution:

- `structured-script.json` v5 will retain explicit, source-linked vocal-reaction, action-SFX, and ambience directives without provider names, model IDs, credentials, pricing controls, or output codecs.
- `SoundscapePlan` will anchor cues to scene time, speakable source-segment boundaries, or canonical text offsets. Exact mid-turn placement requires timing evidence mapped to the final dialogue clock.
- Sound generation identity will be independent from placement and mix identity, allowing one verified generated asset to be reused across several dialogue-provider mixes and mix-only revisions.
- The semantic buses are dialogue, non-verbal vocal reactions, discrete action SFX, and ambient beds. Panning, ducking, fades, limiting, and other spatial or dynamics work are local transforms rather than a fifth provider stem.
- `--sfx-provider <provider=model>` will have no paid hosted default. `--price` will make no provider call or write, and ordinary execution will require an explicit target when uncached prompt generation is needed.
- Delivery is split into seven gated phases: a complete ElevenLabs vertical slice; relevant capabilities from the existing Cartesia, Hume, and MiniMax adapters; first-party Inworld AI across TTS, instant/pro cloning, voice design, natural language steering, and applicable `voice` workflows; DeepInfra hosted speech models including ResembleAI Chatterbox, Xiaomi MiMo V2.5, and Qwen3-TTS across dialogue, cloning, and voice design; Replicate open-source speech models including F5-TTS, Dia 1.6B, and XTTS-v2 across zero-shot cloning and multi-speaker dialogue; Fish across TTS, native dialogue, stateless voice design, voice models, and applicable `voice` workflows; and finally a version-pinned Meta AudioGen community deployment through Replicate.
- Dedicated non-speech generation and speech-provider capabilities remain separate. ElevenLabs is the Phase 1 SFX target and Replicate AudioGen becomes the Phase 7 SFX target; Cartesia, Hume, MiniMax, Inworld, DeepInfra, Replicate speech, and Fish are used only where their documented speech or voice-management surfaces apply.

## Retained implemented providers relevant to production

This table is intentionally limited to the four implemented providers retained in the active production comparison. “Relevant” does not mean each provider is a valid independent SFX target.

| Provider | ADR-018 phase | Suitable production role | Independent SFX suitability |
|---|---:|---|---|
| ElevenLabs | 1 | Complete initial vertical slice: character voices, vocal reactions, discrete foley, ambience sources, and final soundscape execution | Yes. The official `POST /v1/sound-generation` contract exposes model-qualified text-to-sound generation, optional duration and prompt influence, and v2 looping. |
| Hume Octave | 2 | Acting-directed dialogue and eligible vocal reactions, native utterances, timing evidence, continuation, authorized Voice Conversion, design, catalog, and voice lifecycle | No. Voice Conversion remains speech-to-speech work; action-SFX and ambience still use the selected SFX target. |
| Cartesia Sonic | 2 | Approved character voices, segmented dialogue, request-scoped emotion guidance, eligible `[laughter]` reactions, catalog, instant cloning, import, inspection, and deletion | No. Its controls and nonverbalisms remain speech performance rather than independent stems. |
| MiniMax Speech | 2 | Character casting, voice design and cloning, segmented dialogue, eligible model-qualified interjection tags, word timing, catalog, inspection, and deletion | No. Its text-to-audio API and voice effects remain speech generation, not standalone foley. |

## Voice providers not suitable as SFX targets

The following providers remain usable through AutoShow's dialogue subsystem, but they are excluded from the SFX candidate matrix and recommendations. Vocal expression inside synthesized speech does not establish an API for independent action effects, reusable ambient beds, or acoustic simulation.

| Provider | Why it is not a soundscape-generation target |
|---|---|
| Deepgram Aura-2 | Speech synthesis only in the evaluated surface; no independent foley or ambience endpoint. |
| Speechify | Voice catalog and personal speech cloning do not provide independent action-SFX or ambient-bed generation. |
| Mistral Voxtral | Saved and reference voice synthesis serve dialogue identity, not non-speech sound generation. |
| Gemini TTS & Audio | Prompted vocal expression and native dialogue remain speech output; no dedicated public SFX endpoint was established. |
| OpenAI | Expressive or vocalized audio output is not a dedicated, reusable foley or ambience contract. |
| xAI / Grok | The evaluated API surface provides speech voices, not independent sound-effect or ambient-bed generation. |
| Groq Orpheus | Bracketed reactions such as laughter or sighs are embedded vocal performance, not discrete SFX or ambience stems. |

## Phased provider evidence

### Phase 1: ElevenLabs complete vertical slice

The official Sound Effects API is the Phase 1 hosted SFX target. Its API reference documents `POST /v1/sound-generation`, `text`, `model_id`, `duration_seconds`, `prompt_influence`, `loop`, and `output_format`. The current reference bounds an explicitly requested duration to 0.5–30 seconds and limits seamless looping to the v2 sound model. Output-format availability can depend on account tier, so static fixtures and execution readiness must represent those constraints separately.

Phase 1 includes the whole provider-neutral schema, planning, timing, price, scheduling, cache, resume, four-bus mixing, stem, and artifact path; it is not merely an ElevenLabs serializer milestone. Selection does not authorize live generation during implementation verification. Serializer, price, readiness, response, cache, and mixer behavior must use local fixtures and mocked responses.

### Phase 2: Existing Cartesia, Hume, and MiniMax capabilities

Phase 2 reuses capability fixtures and adapter ports that already exist in the repository. Hume contributes acting descriptions, native utterances, word and phoneme timing, continuation, authorized Voice Conversion, voice design, catalog, and lifecycle behavior. Cartesia contributes segmented dialogue, request-scoped emotion guidance, its model-qualified `[laughter]` nonverbalism, catalog, instant cloning, import, inspection, and deletion. MiniMax contributes segmented dialogue, model-qualified interjection tags, word-level subtitle timing, voice design and materialization, instant cloning, catalog, inspection, and deletion. The protected `voice clone` command introduced with ElevenLabs in Phase 1 expands to these providers, with Hume returning its documented external-action requirement instead of simulating an API clone.

None of these three providers becomes an independent SFX target in Phase 2. Their speech capabilities may render eligible voice-qualified vocal reactions, and Hume Voice Conversion may transform an authorized donor recording only for the dialogue or vocal-reaction bus. Provider emotion, interjection, nonverbalism, and voice-effect controls remain speech-generation inputs, while action effects and ambience continue to use the explicitly selected ElevenLabs sound-effect target.

### Phase 3: First-party Inworld AI speech and voice workflows

Inworld AI provides a specialized conversational voice synthesis and character platform with low-latency text-to-speech capabilities, committed as Phase 3 for dialogue rendering and voice lifecycle management:

- **Synthesis Engines & Models**: Features flagship Realtime TTS-2 for multi-lingual steerable voice synthesis across 200+ languages and locales ($25.00 / 1M chars On-Demand), along with Realtime TTS 1.5 Max (stability-optimized) and 1.5 Mini ($15.00 / 1M chars On-Demand) models. The engine achieves first-token audio latency as low as ~120ms (~130ms for 1.5 Mini, <250ms for 1.5 Max). Volume pricing discounts scale down to $12.50 / 1M chars (TTS-2) and $7.00 / 1M chars (Flash/Mini) on the $1,500/mo Growth tier.
- **Protocol & Interface Contracts**: Exposes both REST/HTTP endpoints (`InworldHttpTTSService`) for batch/offline dialogue generation and WebSocket streaming interfaces (`InworldTTSService`) for low-latency, multi-turn conversational dialogue.
- **Voice Creation & Cloning**:
  - *Instant Voice Cloning*: Zero-shot cloning created from 3 to 15 seconds of reference audio (`POST /voices/v1/voices:clone`), suitable for dynamic or user-submitted character voice profiles. Tier limits scale from 100 custom voices on Creator up to 30,000 on Growth.
  - *Professional Voice Cloning*: High-fidelity custom voice models fine-tuned from 30+ minutes of clean studio-recorded training audio, available as add-ons on Developer ($300/mo) and included on Growth tiers.
  - *Voice Design*: Prompt-driven voice creation allowing custom voice profiles to be synthesized directly from descriptive text prompts.
- **Expressive Direction & Audio Markups**: Supports natural language style steering in plain text prompts as well as inline audio markup tags for emotion guidance (e.g., `[happy]`, `[sad]`, `[whisper]`) and non-verbal vocalizations (e.g., `[breathe]`, `[cough]`, `[sigh]`, `[laugh]`).
- **Timing & Alignment Evidence**: Provides character, word, and phoneme/viseme timestamps, enabling precise dialogue clock alignment for lip-syncing and multi-bus timeline synchronization.
- **Non-Speech / Sound Effects Suitability**: Inworld AI does not expose a standalone foley, discrete action-SFX, or ambient soundscape generation endpoint. Official voice-cloning guidelines explicitly specify that reference audio must be free of background music and sound effects to prevent model contamination. Inworld is therefore evaluated strictly as a candidate for the dialogue and non-verbal vocal-reaction buses, with discrete action SFX and ambient beds requiring a dedicated SFX target.

### Phase 4: DeepInfra hosted speech suite (Chatterbox, MiMo V2.5, Qwen3-TTS)

Phase 4 integrates DeepInfra's hosted open-weight speech models to provide low-cost dialogue generation, promotional voice design, and high-quality zero-shot cloning:

- **ResembleAI Chatterbox (`ResembleAI/chatterbox-multilingual` & `chatterbox-turbo`)**: Hosted at $1.00 / 1M characters on DeepInfra. It provides an open-weight, highly cost-effective multi-speaker dialogue synthesis path without requiring direct Resemble SaaS account management or subscription fees.
- **Xiaomi MiMo V2.5 (`XiaomiMiMo/MiMo-V2.5-tts` & `MiMo-V2.5-tts-voicedesign`)**: Hosted at a $0.00 / 1M characters promotional rate on DeepInfra. It supports native voice design and speech generation, making it an optimal target for zero-cost test coverage, rapid prototyping, and character voice experiments.
- **Alibaba Qwen3-TTS (`Qwen/Qwen3-TTS` & `Qwen/Qwen3-TTS-VoiceDesign`)**: Hosted at $20.00 / 1M characters on DeepInfra. It provides high-quality zero-shot reference voice cloning and prompt-based voice design across multiple languages.

### Phase 5: Replicate open-source speech suite (F5-TTS, Dia 1.6B, XTTS-v2)

Phase 5 integrates high-capability open-source speech and multi-speaker dialogue models deployed on Replicate through its standardized prediction API (`POST /v1/predictions`):

- **F5-TTS (`x-lance/f5-tts`)**: State-of-the-art open-source non-autoregressive voice cloning. Provides fast, natural zero-shot cloning from short audio reference clips without third-party SaaS voice registry constraints.
- **Dia 1.6B (`zsxkib/dia` by Nari Labs)**: Specifically built for realistic multi-speaker script dialogue synthesis, embedding non-verbal cues and voice cloning directly within conversational turns.
- **Coqui XTTS-v2 (`lucataco/xtts-v2`)**: Multilingual zero-shot voice cloning across 17+ languages (proven with 7.2M+ runs on Replicate).

All Replicate speech adapters execute predictions asynchronously and capture successful output WAV audio into checksummed local artifacts before the 1-hour remote prediction file expiration window.

### Phase 6: Fish speech and voice workflows

Fish's official API documents single-speaker TTS, S2 Pro native multi-speaker dialogue, stable voice-model references or zero-shot reference clips, prosody controls, several output formats, timestamped streaming, stateless prompt-based Voice Design, and create/list/get/update/delete voice-model operations. That evidence qualifies Fish for first-class dialogue rendering and the applicable shared `voice` workflows: import, discovery, design, materialization through selected protected candidate audio, protected cloning, audition, approval, inspection, ambiguous-create reconciliation, retirement, revocation, and exact project-owned deletion.

The Voice Design endpoint returns base64 audio candidates directly and does not create a durable remote voice resource or expose a separate candidate-materialization operation. AutoShow must therefore ingest each candidate into protected storage, validate exactly one selection against the current create-model sample contract, and use that candidate as authorized reference audio for the ordinary fast model-creation path while retaining the design-to-model lineage. An ineligible candidate fails locally instead of being padded, regenerated, or silently replaced. The documented Fish surface still does not establish standalone non-speech generation, and in-speech emotion controls remain on the dialogue or vocal-reaction bus rather than becoming action-SFX or ambience stems.

### Phase 7: Meta AudioGen through Replicate

The reviewed Replicate target is the public community deployment `sepal/audiogen`, not an official Meta-owned or Replicate-maintained model. ADR-018 accepts that narrower reliability boundary for Phase 7 and compensates by pinning the exact initial version `154b3e5141493cb1b8cec976d9aa90f2b691137e39ad906d2421b74c2a8c52b8`, recording source and license provenance, excluding it from implicit selection, and requiring reviewed fixture updates for any owner, version, schema, hardware, or license change. The upstream model card and Replicate-linked weight license identify the model weights as CC BY-NC 4.0, so the initial fixture must reject commercial or unknown intended use unless separately documented rights support a new reviewed fixture.

The deployment generates one-to-ten-second audio from a text prompt and exposes sampling controls plus WAV or MP3 output. Replicate community runs use prediction objects with asynchronous polling or completion webhooks, cancellation, terminal statuses, and compute metadata. API prediction inputs, outputs, files, and logs are removed after one hour by default, so the adapter must copy successful output immediately into a checksummed local artifact. AudioGen is limited to action-SFX and ambient sources and has no dialogue or `voice` role.

### fal.ai unique TTS catalog & expressive voice-design analysis

To prevent duplicate integration effort, models hosted on fal.ai that are already covered by primary or partner endpoints in prior committed phases—specifically ElevenLabs (Phase 1), MiniMax Speech (Phase 2), Inworld AI (Phase 3), Resemble Chatterbox (Phase 4 via DeepInfra), Alibaba Qwen3-TTS (Phase 4 via DeepInfra), and Dia 1.6B (Phase 5 via Replicate)—are omitted from fal.ai evaluation. The following unique fal.ai endpoints provide distinct custom voice, voice-design, zero-shot cloning, and emotion-control capabilities:

- **ByteDance Seed Speech v2 (`fal-ai/bytedance/seed-speech/tts/v2`)**: A large-scale speech generation family by ByteDance capable of human-indistinguishable TTS, stylized speech transformation, and lip-sync alignment for animated avatars.
- **Maya Research Maya1 (`fal-ai/maya`, `maya/stream`, `maya/batch`)**: State-of-the-art expressive voice generation model engineered specifically for capturing fine-grained human emotion and precise prompt-based voice design.
- **Zyphra Zonos2 (`fal-ai/zonos2`)**: Next-generation Zonos model providing fast zero-shot voice cloning from short sample audio with natural multilingual prosody.
- **Microsoft VibeVoice (`fal-ai/vibevoice`, `vibevoice/7b`)**: Multi-voice, multi-speaker long-form speech synthesis model built for expressive podcast and dialogue script generation.
- **Async TTS Pro (`fal-ai/async/tts-pro/v1.0`)**: Provides text-based control over pauses, speech timing, and emphasis using curated voice IDs.

### Credible or claimed candidates still deferred

| Candidate | Current disposition |
|---|---|
| ByteDance Seed Speech v2 (fal.ai) | Large-scale speech model focusing on expressive voice synthesis, stylized delivery, and lip-sync alignment. Candidate for fal.ai speech adapter expansion. |
| Maya Research Maya1 (fal.ai) | Expressive voice generation model built for human emotion capture and voice design in batch and real-time streaming modes. |
| Zyphra Zonos2 (fal.ai) | Voice cloning from short audio samples across multiple languages with natural prosody. |
| Microsoft VibeVoice 7B (fal.ai) | Multi-voice long-form speech synthesis model for multi-speaker script and dialogue rendering. |
| hexgrad Kokoro-82M (DeepInfra / Replicate) | Apache-licensed 82M open-weight model hosted at $0.62 / 1M chars. Highly cost-efficient candidate for low-cost dialogue baselines. |
| Stability AI | Stable Audio 3 documents text-to-audio and audio-to-audio generation at 44.1 kHz stereo with requested durations up to 380 seconds, but its distinct pricing, polling, moderation, and lifecycle contracts are outside the committed phases. The prior description of this API as “uncapped” was incorrect. |
| LOVO Genny | No retained official technical API reference established a public standalone SFX endpoint and complete request, pricing, and access contract. Product-level sound-effects functionality is insufficient for an adapter commitment. |

## Four-bus production profile

### 1. Dialogue bus

Character speech comes from any approved ADR-014 dialogue target. Voice selection, consent, native/segmented strategy, repair, and speech timing remain separate from the sound-effect provider.

### 2. Non-verbal vocal-reaction bus

Authored gasps, laughter, screams, sighs, grunts, and other voice-like performances remain distinct from dialogue and action foley. They may be rendered through a capable voice provider or the selected SFX target, but the result is normalized and retained as its own semantic stem.

### 3. Discrete action-SFX bus

Phaser-like shots, airlocks, interface chirps, impacts, squeaks, boings, and other one-shots are generated once per immutable SFX generation identity, placed against the selected dialogue timeline, and reused across compatible mixes.

### 4. Ambient-bed bus

Engine hum, ventilation, room tone, and environmental ambience use loopable source assets trimmed to the resolved scene range with deterministic overlap fades. Ambience is ducked from the measured dialogue and vocal-reaction envelope.

Stereo pan, gain, fades, sidechain ducking, loudness policy, and limiting are versioned local mix controls. They are not provider capabilities and must not be inferred from panel coordinates or prompt language.

## Remaining implementation gaps

| Phase | Ordered subphases |
|---|---|
| 1 — Complete ElevenLabs vertical slice | 1A authored intent and immutable planning → 1B ElevenLabs voice and clone reference path → 1C ElevenLabs SFX target and shared execution → 1D four-bus mixer and canonical artifacts → 1E end-to-end offline acceptance |
| 2 — Existing provider capabilities | 2A capability-scoped vocal routing → 2B Hume integration → 2C Cartesia integration → 2D MiniMax integration → 2E cross-provider acceptance |
| 3 — First-party Inworld AI | 3A registry, capability, and pricing foundation → 3B TTS, timing, and render artifacts → 3C instant/pro cloning and voice design → 3D natural language steering and audio markups → 3E soundscape routing and acceptance |
| 4 — DeepInfra hosted suite | 4A registry, capability, and pricing foundation → 4B Chatterbox multilingual & turbo adapters → 4C MiMo V2.5 TTS & voice design adapters → 4D Qwen3-TTS & VoiceDesign zero-shot adapters → 4E soundscape routing and acceptance |
| 5 — Replicate open-source speech suite | 5A registry, capability, and prediction foundation → 5B F5-TTS zero-shot cloning adapter → 5C Dia 1.6B multi-speaker dialogue adapter → 5D XTTS-v2 multilingual cloning adapter → 5E soundscape routing and acceptance |
| 6 — Fish | 6A registry, capability, and pricing foundation → 6B single-speaker TTS and reference identity → 6C native dialogue and timestamp streaming → 6D voice design, model management, and reconciliation → 6E soundscape routing and acceptance |
| 7 — Meta AudioGen through Replicate | 7A community-model governance, license eligibility, and pinning → 7B Replicate SFX target and static pricing → 7C prediction execution lifecycle → 7D expiry-safe artifact capture and soundscape routing → 7E end-to-end and historical acceptance |

Each subphase has its own offline exit criterion in ADR-018. Subphases are sequential within a phase, and a later provider phase cannot start until the preceding phase's `E` acceptance subphase and phase gate pass.

## Recommendation

Implement ADR-018 through the ordered 1A–7E subphases and their seven parent gates. Phase 1A–1E must be complete enough to ship independently with ElevenLabs; Phases 2A–6E add only capabilities actually documented for each speech and voice provider; Phase 7A–7E adds the exact pinned AudioGen community deployment as the second SFX target, restricted by default to documented license-compatible noncommercial use. Each phase requires fresh primary-source confirmation of exact endpoints, model identities, request and response schemas, duration and format limits, pricing units, access and license restrictions, asynchronous lifecycle, and failure behavior before dispatch code is enabled.

Keep dialogue casting independent from sound-effect selection. A provider that is excellent for voice identity or expressive speech does not become an SFX provider unless it exposes a dedicated non-speech generation contract.

## Verification and research notes

- Repository behavior was checked against ADR-014 and the current script-to-audio, comic audio, schema, mastering, cache, manifest, and scheduling code on 2026-08-13.
- ADR-018 remained Proposed · Pending at the time of this update; descriptions of v5, subphases 1A–7E, new providers, SFX targets, stems, and multi-bus mastering are planned contracts, not shipped behavior.
- External documentation was reviewed without making provider calls. No live TTS, SFX, music, or other paid/quota-limited execution was used. Documentation snapshots were fetched locally using `bun as links`.
- Default repository verification for this documentation update is `bun run check`, `bun t --price`, and `git diff --check`.

## References

- [ADR-014: Add Character Voice References and Multi-Speaker Script-to-Audio](../adr/ADR-014-add-character-voice-references-and-multi-speaker-script-to-audio.md)
- [ADR-018: Add Provider-Neutral Sound Effects and Multi-Track Soundscape Mixing](../adr/ADR-018-sound-effects-and-multi-track-soundscape-pipeline.md)
- [ADR-018 implementation documentation index](../adr/ADR-018-sound-effects-and-multi-track-soundscape-pipeline.md#implementation-documentation-index)
- [ElevenLabs Sound Effects API reference](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert)
- [ElevenLabs Sound Effects overview](https://elevenlabs.io/docs/overview/capabilities/sound-effects)
- [Hume Voice Conversion guide](https://dev.hume.ai/docs/text-to-speech-tts/voice-conversion)
- [Hume timestamp guide](https://dev.hume.ai/docs/text-to-speech-tts/timestamps)
- [Cartesia emotion and nonverbalism controls](https://docs.cartesia.ai/build-with-cartesia/capability-guides/volume-speed-emotion)
- [Cartesia API changes](https://docs.cartesia.ai/build-with-cartesia/tts-models/api-changes)
- [MiniMax T2A interjection and subtitle reference](https://platform.minimax.io/docs/api-reference/speech-t2a-http)
- [MiniMax Voice Clone guide](https://platform.minimax.io/docs/guides/speech-voice-clone)
- [Inworld AI documentation](https://docs.inworld.ai/)
- [Inworld AI pricing](https://inworld.ai/pricing)
- [Inworld AI Voice Cloning API guide](https://docs.inworld.ai/docs/tutorial-basics/voice-cloning/)
- [Inworld AI TTS overview](https://docs.inworld.ai/)
- [DeepInfra TTS API reference](https://docs.deepinfra.com/apis/text-to-speech)
- [DeepInfra TTS models catalog](https://deepinfra.com/models/text-to-speech)
- [DeepInfra Kokoro-82M model](https://deepinfra.com/hexgrad/Kokoro-82M)
- [DeepInfra Qwen3-TTS model](https://deepinfra.com/Qwen/Qwen3-TTS)
- [DeepInfra Qwen3-TTS VoiceDesign model](https://deepinfra.com/Qwen/Qwen3-TTS-VoiceDesign)
- [DeepInfra Audio8-TTS-Preview-0.6b model](https://deepinfra.com/Audio8/Audio8-TTS-Preview-0.6b)
- [DeepInfra Chatterbox Multilingual model](https://deepinfra.com/ResembleAI/chatterbox-multilingual)
- [DeepInfra Chatterbox Turbo model](https://deepinfra.com/ResembleAI/chatterbox-turbo)
- [DeepInfra Xiaomi MiMo-V2.5-tts model](https://deepinfra.com/XiaomiMiMo/MiMo-V2.5-tts)
- [DeepInfra Xiaomi MiMo-V2.5-tts-voicedesign model](https://deepinfra.com/XiaomiMiMo/MiMo-V2.5-tts-voicedesign)
- [DeepInfra HiggsAudioV2.5 model](https://deepinfra.com/bosonai/HiggsAudioV2.5)
- [DeepInfra Orpheus-3B model](https://deepinfra.com/canopylabs/orpheus-3b-0.1-ft)
- [DeepInfra Inworld Realtime TTS 1.5 Max model](https://deepinfra.com/inworld-ai/realtime-tts-1.5-max)
- [DeepInfra Inworld Realtime TTS 1.5 Mini model](https://deepinfra.com/inworld-ai/realtime-tts-1.5-mini)
- [DeepInfra Inworld Realtime TTS 2 model](https://deepinfra.com/inworld-ai/realtime-tts-2)
- [DeepInfra Sesame CSM-1B model](https://deepinfra.com/sesame/csm-1b)
- [Replicate Speech Generation Collection](https://replicate.com/collections/speech-generation)
- [Replicate F5-TTS model](https://replicate.com/x-lance/f5-tts)
- [Replicate Dia dialogue model](https://replicate.com/zsxkib/dia)
- [Replicate XTTS-v2 model](https://replicate.com/lucataco/xtts-v2)
- [fal.ai Text to Speech catalog](https://fal.ai/models?category=text-to-speech)
- [fal.ai ByteDance Seed Speech v2](https://fal.ai/models/bytedance/seed-speech/tts/v2)
- [fal.ai Maya1](https://fal.ai/models/maya)
- [fal.ai Zyphra Zonos2](https://fal.ai/models/zonos2)
- [fal.ai Microsoft VibeVoice](https://fal.ai/models/vibevoice)
- [fal.ai Async TTS Pro](https://fal.ai/models/async/tts-pro/v1.0)
- [Stability AI API reference](https://platform.stability.ai/docs/api-reference)
- [Fish Audio TTS API reference](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech)
- [Fish Audio timestamped streaming reference](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech-stream-with-timestamps)
- [Fish Audio Voice Design API](https://docs.fish.audio/api-reference/endpoint/openapi-v1/voice-design)
- [Fish Audio voice-model creation reference](https://docs.fish.audio/api-reference/endpoint/model/create-model)
- [Fish Audio voice-model catalog reference](https://docs.fish.audio/api-reference/endpoint/model/list-models)
- [Fish Audio pricing and rate limits](https://docs.fish.audio/developer-guide/models-pricing/pricing-and-rate-limits)
- [Replicate community-model policy](https://replicate.com/docs/topics/models/community-models)
- [Exact pinned `sepal/audiogen` API schema](https://replicate.com/sepal/audiogen/versions/154b3e5141493cb1b8cec976d9aa90f2b691137e39ad906d2421b74c2a8c52b8/api)
- [Replicate prediction lifecycle](https://replicate.com/docs/topics/predictions/lifecycle)
- [Replicate prediction data retention](https://replicate.com/docs/topics/predictions/data-retention)
- [AudioCraft AudioGen implementation notes](https://github.com/facebookresearch/audiocraft/blob/main/docs/AUDIOGEN.md)
- [AudioGen model card](https://github.com/facebookresearch/audiocraft/blob/main/model_cards/AUDIOGEN_MODEL_CARD.md)
- [AudioCraft CC BY-NC 4.0 weight license](https://github.com/facebookresearch/audiocraft/blob/main/LICENSE_weights)
