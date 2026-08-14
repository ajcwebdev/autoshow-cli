# Cartoon Sci-Fi Space Crew Voice, Multi-Character TTS, and Soundscape/Foley Options Report

Assessment date: 2026-08-10. Repository baseline: `1bba61c2`. Updated 2026-08-13 to reflect the completed ADR-014 dialogue foundation and the proposed ADR-018 soundscape decision.

## Purpose

This report evaluates the hosted API options relevant to producing comic dialogue, non-verbal vocal reactions, discrete foley, and ambient soundscapes. It is supporting research, not the architecture authority: [ADR-014](../adr/ADR-014-add-character-voice-references-and-multi-speaker-script-to-audio.md) governs voice identity and dialogue rendering, while [ADR-018](../adr/ADR-018-sound-effects-and-multi-track-soundscape-pipeline.md) proposes provider-neutral sound intent, sound-effect generation, timeline placement, and multi-bus mastering.

Provider capabilities and access conditions change independently of AutoShow. A product feature, marketing page, model paper, or third-party wrapper is not enough to establish an implementation target. A candidate normally needs a current official developer endpoint, documented request and response contract, model-qualified capabilities, pricing evidence, and an access/readiness path that can be represented truthfully. ADR-018 makes one explicit exception for the Phase 5 community AudioGen deployment and offsets that weaker lifecycle guarantee with exact version pinning, provenance, opt-in selection, and historical-readability requirements.

No hosted audio generation was run for this report. Repository status was checked locally, and external capability claims were limited to current official provider documentation plus the exact Replicate community-model schema selected by ADR-018.

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
- Delivery is split into five gated phases: a complete ElevenLabs vertical slice; relevant capabilities from the existing Cartesia, Hume, and MiniMax adapters; Resemble across TTS, speech-to-speech, and applicable `voice` workflows; Fish across TTS, native dialogue, stateless voice design, voice models, and applicable `voice` workflows; and finally a version-pinned Meta AudioGen community deployment through Replicate.
- Dedicated non-speech generation and speech-provider capabilities remain separate. ElevenLabs is the Phase 1 SFX target and Replicate AudioGen becomes the Phase 5 SFX target; Cartesia, Hume, MiniMax, Resemble, and Fish are used only where their documented speech or voice-management surfaces apply.

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

### Phase 3: Resemble speech and voice workflows

Resemble's official surface supports synchronous and streaming TTS, grapheme and phoneme timestamps, prompt-designed voice candidates, creation from a selected candidate, custom voice creation/build, catalog inspection, deletion, and speech-to-speech conversion. That evidence qualifies Resemble for a first-class TTS adapter and every applicable shared `voice` workflow, including import, discovery, design, materialization, consent-gated cloning, audition, approval, inspection, reconciliation, retirement, revocation, and deletion.

Speech-to-speech preserves the delivery and timing of an authorized donor recording while changing its target voice, so it can serve dialogue or voice-qualified vocal reactions. Resemble Fill is part of voice training for speech-to-speech; it is not an endpoint for arbitrary foley insertion, ambient beds, or spatial acoustic simulation. Resemble is therefore committed in Phase 3 without becoming an `--sfx-provider` target.

### Phase 4: Fish speech and voice workflows

Fish's official API documents single-speaker TTS, S2 Pro native multi-speaker dialogue, stable voice-model references or zero-shot reference clips, prosody controls, several output formats, timestamped streaming, stateless prompt-based Voice Design, and create/list/get/update/delete voice-model operations. That evidence qualifies Fish for first-class dialogue rendering and the applicable shared `voice` workflows: import, discovery, design, materialization through selected protected candidate audio, protected cloning, audition, approval, inspection, ambiguous-create reconciliation, retirement, revocation, and exact project-owned deletion.

The Voice Design endpoint returns base64 audio candidates directly and does not create a durable remote voice resource or expose a separate candidate-materialization operation. AutoShow must therefore ingest each candidate into protected storage, validate exactly one selection against the current create-model sample contract, and use that candidate as authorized reference audio for the ordinary fast model-creation path while retaining the design-to-model lineage. An ineligible candidate fails locally instead of being padded, regenerated, or silently replaced. The documented Fish surface still does not establish standalone non-speech generation, and in-speech emotion controls remain on the dialogue or vocal-reaction bus rather than becoming action-SFX or ambience stems.

### Phase 5: Meta AudioGen through Replicate

The reviewed Replicate target is the public community deployment `sepal/audiogen`, not an official Meta-owned or Replicate-maintained model. ADR-018 accepts that narrower reliability boundary for Phase 5 and compensates by pinning the exact initial version `154b3e5141493cb1b8cec976d9aa90f2b691137e39ad906d2421b74c2a8c52b8`, recording source and license provenance, excluding it from implicit selection, and requiring reviewed fixture updates for any owner, version, schema, hardware, or license change. The upstream model card and Replicate-linked weight license identify the model weights as CC BY-NC 4.0, so the initial fixture must reject commercial or unknown intended use unless separately documented rights support a new reviewed fixture.

The deployment generates one-to-ten-second audio from a text prompt and exposes sampling controls plus WAV or MP3 output. Replicate community runs use prediction objects with asynchronous polling or completion webhooks, cancellation, terminal statuses, and compute metadata. API prediction inputs, outputs, files, and logs are removed after one hour by default, so the adapter must copy successful output immediately into a checksummed local artifact. AudioGen is limited to action-SFX and ambient sources and has no dialogue or `voice` role.

### Credible or claimed candidates still deferred

| Candidate | Current disposition |
|---|---|
| Stability AI | Stable Audio 3 documents text-to-audio and audio-to-audio generation at 44.1 kHz stereo with requested durations up to 380 seconds, but its distinct pricing, polling, moderation, and lifecycle contracts are outside the five committed phases. The prior description of this API as “uncapped” was incorrect. |
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
| 3 — Resemble | 3A registry, capability, and pricing foundation → 3B TTS, timing, and render artifacts → 3C discovery, design, and materialization → 3D clone, lifecycle, and reconciliation → 3E speech-to-speech and soundscape acceptance |
| 4 — Fish | 4A registry, capability, and pricing foundation → 4B single-speaker TTS and reference identity → 4C native dialogue and timestamp streaming → 4D voice design, model management, and reconciliation → 4E soundscape routing and acceptance |
| 5 — Meta AudioGen through Replicate | 5A community-model governance, license eligibility, and pinning → 5B Replicate SFX target and static pricing → 5C prediction execution lifecycle → 5D expiry-safe artifact capture and soundscape routing → 5E end-to-end and historical acceptance |

Each subphase has its own offline exit criterion in ADR-018. Subphases are sequential within a phase, and a later provider phase cannot start until the preceding phase's `E` acceptance subphase and phase gate pass.

## Recommendation

Implement ADR-018 through the ordered 1A–5E subphases and their five parent gates. Phase 1A–1E must be complete enough to ship independently with ElevenLabs; Phases 2A–4E add only capabilities actually documented for each speech and voice provider; Phase 5A–5E adds the exact pinned AudioGen community deployment as the second SFX target, restricted by default to documented license-compatible noncommercial use. Each phase requires fresh primary-source confirmation of exact endpoints, model identities, request and response schemas, duration and format limits, pricing units, access and license restrictions, asynchronous lifecycle, and failure behavior before dispatch code is enabled.

Keep dialogue casting independent from sound-effect selection. A provider that is excellent for voice identity or expressive speech does not become an SFX provider unless it exposes a dedicated non-speech generation contract.

## Verification and research notes

- Repository behavior was checked against ADR-014 and the current script-to-audio, comic audio, schema, mastering, cache, manifest, and scheduling code on 2026-08-13.
- ADR-018 remained Proposed · Pending at the time of this update; descriptions of v5, subphases 1A–5E, new providers, SFX targets, stems, and multi-bus mastering are planned contracts, not shipped behavior.
- External documentation was reviewed without making provider calls. No live TTS, SFX, music, or other paid/quota-limited execution was used.
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
- [Stability AI API reference](https://platform.stability.ai/docs/api-reference)
- [Fish Audio TTS API reference](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech)
- [Fish Audio timestamped streaming reference](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech-stream-with-timestamps)
- [Fish Audio Voice Design API](https://docs.fish.audio/api-reference/endpoint/openapi-v1/voice-design)
- [Fish Audio voice-model creation reference](https://docs.fish.audio/api-reference/endpoint/model/create-model)
- [Fish Audio voice-model catalog reference](https://docs.fish.audio/api-reference/endpoint/model/list-models)
- [Fish Audio pricing and rate limits](https://docs.fish.audio/developer-guide/models-pricing/pricing-and-rate-limits)
- [Resemble synchronous TTS reference](https://docs.resemble.ai/voice-generation/text-to-speech/synchronous)
- [Resemble speech-to-speech reference](https://docs.resemble.ai/voice-generation/speech-to-speech)
- [Resemble voice design reference](https://docs.resemble.ai/voice-creation/voice-design/generate)
- [Resemble voice creation documentation](https://docs.resemble.ai/voice-creation/voices/create)
- [Resemble voice build documentation](https://docs.resemble.ai/voice-creation/voices/build)
- [Replicate community-model policy](https://replicate.com/docs/topics/models/community-models)
- [Exact pinned `sepal/audiogen` API schema](https://replicate.com/sepal/audiogen/versions/154b3e5141493cb1b8cec976d9aa90f2b691137e39ad906d2421b74c2a8c52b8/api)
- [Replicate prediction lifecycle](https://replicate.com/docs/topics/predictions/lifecycle)
- [Replicate prediction data retention](https://replicate.com/docs/topics/predictions/data-retention)
- [AudioCraft AudioGen implementation notes](https://github.com/facebookresearch/audiocraft/blob/main/docs/AUDIOGEN.md)
- [AudioGen model card](https://github.com/facebookresearch/audiocraft/blob/main/model_cards/AUDIOGEN_MODEL_CARD.md)
- [AudioCraft CC BY-NC 4.0 weight license](https://github.com/facebookresearch/audiocraft/blob/main/LICENSE_weights)
