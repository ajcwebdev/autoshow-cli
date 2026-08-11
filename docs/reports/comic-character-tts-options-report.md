# Comic Character Voice and Multi-Character TTS Options

Assessment date: 2026-08-10. Repository baseline: `1bba61c2`. Status: historical analysis and recommendation; no provider API was called while preparing it. Phase 0 implementation status was added on 2026-08-11 without rewriting the baseline findings.

## Purpose

This report evaluates the text-to-speech options already represented in AutoShow and a bounded set of important options that are not yet integrated. It focuses on the proposed comic workflow: take a structured script, establish a stable reference voice for every character, and synthesize a multi-character recording in which identity, delivery, accent, and timing remain reviewable and reproducible.

The report distinguishes three separate questions that should not be collapsed into one capability flag:

1. Can the provider supply or create enough distinct character identities?
2. Can the provider perform multiple characters coherently in one request, or must AutoShow assemble independently generated turns?
3. Does the current repository actually expose and correctly execute those capabilities?

Provider features and access conditions change quickly. External claims below are based on official product or API documentation checked on the assessment date and should be revalidated immediately before implementation.

## Phase 0 implementation update

The critical baseline defects documented below were repaired on 2026-08-11 as Phase 0 of ADR-020. All 12 adapters now receive immutable explicit per-turn voice invocations, with mocked A/B/A tests asserting the final provider serializer instead of requested metadata. Gemini native dialogue is restricted to exactly two speakers and partitions only at whole-turn boundaries; other speaker counts use the segmented route. Dialogue work is bounded, source-ordered, cancellable, and workspace-safe. Canonical provider state now uses operation-scoped target identities and strict `ttsAudio` projections, while retained render artifacts record observed per-turn voice identities, normalized dialogue, segments, results, checksums, and audio-run linkage.

Synthesis-time ElevenLabs and Speechify creation fields and named Mistral save requests now fail before provider collection with management-migration guidance. Authorized unnamed standalone and per-speaker Mistral references are validated before synthesis, ingested once per unique asset into an owner-only protected store, represented thereafter only by opaque checksum-bound references, and merely hashed without mutation during price planning. The Deepgram catalog now contains the complete checked 91-voice Aura-2 set, and xAI, Gemini, Groq, and OpenAI selectors were refreshed through ADR-018. The comic voice catalog, audition/approval lifecycle, immutable scene snapshots, mastering pipeline, and `comic generate-audio` remain unimplemented; the rest of this report should be read as the 2026-08-10 baseline that motivated those changes.

## Baseline executive conclusion

AutoShow has most of the low-level pieces needed for comic dialogue, but it does not yet have a trustworthy character-voice workflow.

- The repository contains adapters for 12 TTS providers: Kitten, ElevenLabs, MiniMax, Groq, xAI/Grok, Mistral, OpenAI, Gemini, Deepgram, Speechify, Hume, and Cartesia.
- There is no comic command for creating or approving reference voices and no comic command for generating dialogue audio. The comic command exposes only `draft-scenes`, `generate-images`, and `reference-sketch` in `src/cli/commands/process-steps/step-8-comic/define-comic-command.ts:4-20`.
- The generic TTS command has a multi-speaker parser, speaker mappings, per-turn files, concatenation, and a native Gemini branch. Those are useful seams, but they are not sufficient as currently implemented.
- The most important correctness finding is that the segment-and-concatenate path does not actually switch voices between speakers for ten of the eleven segmented providers. The per-turn runner changes an options object, but those provider targets captured the original voice when the target was collected. Mistral is the sole segmented exception; Gemini's native path also uses distinct mapped voices. Metadata nevertheless reports the requested mappings as if they had been used.
- Consequently, the only currently functioning distinct-character paths are Mistral reference/saved voices through local turn assembly and Gemini's native exactly-two-speaker mode. Even those paths need stronger validation, chunking, preservation of delivery cues, and manifests before they are suitable for comic production.
- The repository implements standalone custom/reference-voice creation for ElevenLabs Instant Voice Cloning, Mistral reference or saved voices, and Speechify Simba 3.0 cloning. It can consume some externally created IDs for other providers, but it has no persistent per-character voice catalog, audition/approval workflow, provider-specific casting map, consent ledger, or remote-resource lifecycle.
- For a managed production service, ElevenLabs currently offers the broadest complete casting surface: a very large voice library, prompt-based design, instant and professional cloning, remixing, and native Text-to-Dialogue. Hume is especially strong for expressive designed voices and contextual multi-utterance dialogue. MiniMax and Cartesia also have high provider-side casting potential. None of those strengths is fully exposed by this repository.
- Mistral is the fastest path to a working reference-audio prototype because its current adapter already honors a different reference or saved voice for each segmented turn. Gemini is the fastest stock-voice prototype for scenes with exactly two speakers.
- Deepgram is the clearest stock-casting expansion inside the existing provider set because its official catalog contains roughly 90 Aura-2 identities with explicit age, expressed-gender, accent, language, and character metadata while the repository exposes only eight English voices.
- For a private or local workflow, Qwen3-TTS is the strongest missing strategic option. Its official Apache-2.0 project supports voice design, short-reference cloning, style instructions, and a documented design-then-clone workflow for persistent fictional voices. Chatterbox is a simpler permissive clone-first alternative. Kitten remains useful as a lightweight local baseline but is too narrow for a varied cast.
- The implementation should begin by repairing the voice-dispatch contract and introducing provider-neutral voice profiles, approved auditions, immutable voice snapshots, and a source-linked dialogue plan. Adding more providers before fixing those foundations would expand an unreliable surface.

## What “custom voice” means

The provider market uses several terms for materially different operations:

- A **stock voice** is a provider-owned identity selected from a catalog. A large, searchable catalog with age, gender presentation, accent, language, and style metadata can support a broad cast without handling actor recordings.
- **Voice design** creates a new synthetic identity from a written brief such as “older Caribbean woman, dry humor, low register.” It is the best fit when the character is fictional and no lawful source recording exists.
- **Voice cloning** derives an identity from reference audio. It can preserve a specific actor's timbre and accent, but it requires documented rights and consent. A short instant clone and a professionally trained clone have different consistency, access, and data requirements.
- A **reference voice recording** in the proposed AutoShow workflow should mean an audition artifact that establishes how the selected stock, designed, or cloned voice sounds. It is not necessarily the source material used to create a clone.
- **Performance control** changes how an identity delivers a line through instructions, emotion, pace, pitch, pronunciation, or style controls. It does not by itself create another stable character identity.
- **Native dialogue** lets one provider request contain multiple speakers or utterances with shared context. **Segmented dialogue** synthesizes turns independently and assembles them locally. Native dialogue can improve conversational continuity; segmented dialogue gives AutoShow stronger caching, repair, timing, and provider portability.

A provider can be excellent for character work without supporting all six categories. The architecture should represent them separately.

## Current repository assessment

### Comic data is already voice-ready

The best canonical input is `metadata/structured-script.json`, not the later LLM-authored `scene.json`.

Structured comic beats and source segments retain stable source identifiers, canonical `speakerKey` values when a speaker resolves unambiguously, the original `speakerLabel`, exact text, delivery, beat indexes, and locations in `src/cli/commands/process-steps/step-8-comic/schemas/schemas.ts:61-82`. The parser deliberately does not split dialogue when constructing source segments, and it retains V.O./O.S. suffixes in the original speaker label while normalizing them for character lookup.

The later panel schema is still useful for synchronization. It distinguishes canonical characters, captions, and uncatalogued voices and carries an optional tone in `schemas.ts:84-104`. However, `scene.json` is LLM-generated, its speech is not deterministically checked against the canonical source text, and a source segment can be referenced by more than one panel. It should not become the audio source of truth.

The future audio planner must define explicit policies for compound speakers, captions and narration, uncatalogued radio/intercom/computer voices, and V.O./O.S. processing. A compound label may have no unique `speakerKey`; captions have no character key; and voice-over state is currently embedded in a label rather than represented as an audio effect.

### Existing TTS surface

The generic TTS CLI already exposes global voice, speed, language, reference-audio, voice-name, consent, instructions, output-format, dialogue-format, and repeatable `SPEAKER=VOICE|path` mappings through `src/cli/flags/tts-flags.ts:13-49`. Reference-audio routing is limited to Mistral, ElevenLabs, and Speechify in `src/cli/flags/service-selector-normalization/generic-tts-option-selectors.ts:12-97`.

`runMultiSpeakerTts` parses a script into ordered turns, writes `dialogue-normalized.txt`, creates `segment-NNN-speaker.wav` files, and either invokes a native target or synthesizes every turn before concatenating the results. The strategy registry marks Gemini as native and every other provider as segmented in `src/cli/commands/process-steps/step-4-tts/tts-targets/multi-speaker-capability.ts:4-17`.

The current normalized turn contains only `speaker` and `text`. The generic screenplay parser strips leading delivery parentheticals and discards action directions, so routing comic Markdown through it would lose information the comic parser has already captured. A comic implementation should pass prepared structured turns beneath this parser instead of serializing and reparsing the script.

### Baseline critical multi-speaker correctness defect

The segmented runner resolves a mapping and calls `overrideVoiceForProvider` for every turn at `src/cli/commands/process-steps/step-4-tts/run-multi-speaker-tts.ts:42-54`. That looks correct at the orchestration layer. Most collected targets, however, close over the original voice or clone selection and ignore the voice fields in the per-invocation options:

- Kitten: `src/cli/commands/process-steps/step-4-tts/tts-local/kitten/kitten-tts-targets.ts:45-62`
- OpenAI: `src/cli/commands/process-steps/step-4-tts/tts-services/tts-openai/openai-tts-targets.ts:11-28`
- ElevenLabs: `src/cli/commands/process-steps/step-4-tts/tts-services/tts-elevenlabs/elevenlabs-tts-targets.ts:19-71`
- MiniMax: `src/cli/commands/process-steps/step-4-tts/tts-services/tts-minimax/minimax-tts-targets.ts:9-30`
- Groq: `src/cli/commands/process-steps/step-4-tts/tts-services/tts-groq/groq-tts-targets.ts:14-32`
- xAI/Grok: `src/cli/commands/process-steps/step-4-tts/tts-services/tts-grok/grok-tts-targets.ts:12-29`
- Deepgram: `src/cli/commands/process-steps/step-4-tts/tts-services/tts-deepgram/deepgram-tts-targets.ts:12-34`
- Speechify: `src/cli/commands/process-steps/step-4-tts/tts-services/speechify/speechify-tts-targets.ts:24-65`
- Hume: `src/cli/commands/process-steps/step-4-tts/tts-services/hume/hume-tts-targets.ts:13-30`
- Cartesia: `src/cli/commands/process-steps/step-4-tts/tts-services/cartesia/cartesia-tts-targets.ts:12-28`

Mistral reads `mistralTtsVoice` and `mistralTtsRefAudio` from runtime options on every invocation, so its segmented switching works. Gemini intentionally consumes the complete speaker registry in its native request.

The practical effect is severe: an OpenAI mapping such as `Alice=alloy` and `Bob=onyx` generates both turns with the originally collected/default voice. ElevenLabs and Speechify per-speaker reference paths likewise do not create or select distinct per-character clones. The final metadata is built from the requested registry rather than observed requests, so `manifest.json` can claim that the voices switched even when they did not.

The current documentation's statement that dialogue works with every provider is therefore inaccurate. The existing OpenAI dialogue contract test checks output ordering by input text but does not assert the voice sent in each request; the Mistral test is the only existing provider contract that proves distinct reference requests.

| Baseline route on 2026-08-10 | Distinct voices actually honored | Production limitations |
|---|---|---|
| Gemini native | Yes | Provider allows exactly two speakers; the repository does not enforce that ceiling, and generic text chunking can split speaker-formatted dialogue unsafely. |
| Mistral segmented | Yes | Repeated reference preparation is inefficient; there is no character registry, segment cache, or saved-resource lifecycle. |
| Other ten segmented adapters | No | Each turn uses the target's originally captured voice even though metadata reports the requested mapping. |

### Other cross-provider limitations

- One provider-agnostic speaker map is reused in multi-provider runs even though voice IDs are provider-specific. `Alice=voice-id` cannot represent an ElevenLabs casting and a different Hume casting in the same comparison run.
- Hosted segmented turns are launched with an unbounded `Promise.all`, which risks rate-limit bursts and clone/resource races for a long scene.
- The assembler normalizes output to mono 16 kHz PCM WAV and provides no configurable conversational pauses, crossfades, room tone, loudness target, or effects bus.
- Output metadata stores one flat speaker summary and at most one clone ID. It does not record the actual per-turn voice, source segment, timing, delivery controls, reference hash, consent, provider resource retention, or cleanup state.
- Dialogue segment artifacts are retained in a simple single-target run but can be deleted from multi-target and batch workspaces even while completion output advertises them.
- No local voice catalog includes structured age or accent fields. The only explicit gender field is part of Speechify clone setup, and the current multipart request appears not to send the resolved locale or gender values.
- The benchmark tool keys TTS results by service/model, so auditions for several characters using the same model collide conceptually. Character and voice-profile identity must be part of the evaluation key.

## Provider capability matrix

“Working now” refers only to distinct-character dialogue in this repository, not to ordinary single-voice synthesis. “Design” means a prompt-created identity; changing the delivery of a stock voice does not count. Stock counts are approximate where providers update catalogs continuously.

| Provider | Official identity breadth | Custom identity | Provider-native dialogue | Age/gender/accent suitability | Distinct comic voices working now |
|---|---|---|---|---|---|
| Kitten | 8 English voices | None documented | No | Low; no structured demographic catalog | No |
| ElevenLabs | 10,000+ community voices plus provider voices | Voice Design, remixing, instant clone, professional clone | Yes, Text-to-Dialogue | Excellent through filters, design, and cloning | No; current segmented adapter reuses one captured voice |
| MiniMax | 300+ synchronous system voices; 100+ async | Prompt design and rapid clone | No documented speaker-labeled endpoint | Excellent provider potential | No |
| Groq Orpheus | 6 English and 6 Saudi-Arabic voices across separate models | None documented | No | Low; expressive directions but a small identity pool | No |
| xAI/Grok | 26 current stock voices | Short-reference cloning; API creation is Enterprise-only | No documented endpoint | High with custom metadata; medium from stock | No |
| Mistral | Reference and saved voices rather than a broad public stock catalog | Zero-shot reference cloning and saved voices | No documented endpoint | High when lawful reference clips exist | Yes, segmented |
| OpenAI | 13 documented built-ins | Eligible-customer custom voices with separate consent and sample recordings | No documented endpoint | Medium stock breadth; higher if gated custom access is available | No |
| Gemini | 30 fixed voices and prompt-controlled performance | No persistent identity cloning | Yes, exactly two speakers | Good stock variety and prompt control, but no custom identity | Yes, native, for two speakers only |
| Deepgram | Roughly 90 Aura-2 voices | None documented | No | Excellent stock metadata across age, expressed gender, accent, and language | No |
| Speechify | External catalog plus 8 curated Simba 3.2 English voices | 10–30 second cloning; 3.2 approval conditions | A dialogue model is documented, but the surface is changing | High with approved clones; moderate stock breadth in the current repo | No |
| Hume | 100+ library voices | Prompt design and cloning from about 15 seconds | Yes, contextual multi-utterance and continuation | Excellent through design, tags, clone, and acting instructions | No |
| Cartesia | 500+ stock voices | Instant and professional cloning | No documented endpoint | Excellent catalog breadth and clone potential | No |

## Implemented providers in detail

### KittenTTS

**Repository today.** AutoShow provides four local Kitten model variants and the eight fixed voices Bella, Jasper, Luna, Bruno, Rosie, Hugo, Kiki, and Leo. It is the standalone TTS default and requires no paid provider call. Its target captures the selected speaker, so current dialogue mappings do not change voices between turns.

**Provider surface not exposed.** The upstream developer-preview project documents the same eight voices and a speed parameter. The repository does not appear to expose Kitten's speed control. There is no documented self-serve cloning, text-based voice design, multilingual catalog, or demographic search surface in the [official KittenTTS repository](https://github.com/KittenML/KittenTTS).

**Character fit.** Kitten is valuable for private, offline smoke tests and rough timing. Eight identities can cover a small cast manually, but names alone are not reliable age, gender, or accent metadata, and there is no way to create a character-specific identity. It is not a production casting solution for a varied comic.

**Recommendation.** Retain it as the no-cost local baseline and fix per-turn switching, but do not design the reference-voice workflow around its limitations. Add a stronger local provider if privacy or no-cost character cloning is a goal.

### ElevenLabs

**Repository today.** AutoShow supports `eleven_v3`, `eleven_multilingual_v2`, and `eleven_flash_v2_5`, arbitrary existing voice IDs, rich synthesis settings, and Instant Voice Cloning from local or remote reference audio. The clone context is shared across selected ElevenLabs models, but the workflow can provision only one clone context for a run and does not maintain a per-character registry. Current multi-speaker synthesis is segmented and affected by the captured-voice defect, so mapped voice IDs and reference files are not honored per turn.

**Provider surface not exposed.** ElevenLabs documents [10,000+ community voices, voice discovery, Voice Design, cloning, and remixing](https://elevenlabs.io/docs/overview/capabilities/voices). Prompt-based design and remixing can vary age, gender, accent, tone, style, and pacing. [Instant Voice Cloning and Professional Voice Cloning](https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning) cover quick reference-based identities and higher-consistency trained identities, respectively. The provider also has a [native Text-to-Dialogue capability](https://elevenlabs.io/docs/capabilities/text-to-dialogue) rather than requiring independent turn concatenation. The repository does not expose voice-library search/filtering, Voice Design, remixing, Professional Voice Cloning, native dialogue, timestamped dialogue, or full resource management/deletion.

**Access constraints.** The Voice Library is not available to free-tier API users. Professional Voice Cloning is plan-gated and uses voice-captcha verification; Instant Voice Cloning is more broadly available. These conditions should be preflighted instead of discovered after paid synthesis begins.

**Character fit.** This is the strongest all-around managed option. It can cast by browsing a very large catalog, design fictional identities without an actor recording, clone a consenting performer, and render multi-character dialogue natively. It is suitable for varied ages, gender presentations, accents, languages, and acting styles.

**Recommendation.** Make ElevenLabs a first-wave full provider after the core dispatch fix. Add provider-qualified voice discovery/design/clone registration, approved audition artifacts, clone reuse, Text-to-Dialogue, and a segmented fallback for targeted repairs.

### MiniMax

**Repository today.** AutoShow supports `speech-2.8-hd` and `speech-2.8-turbo`, preset or existing voice IDs, language boost, speed, volume, pitch, nine emotions, text normalization, and pronunciation controls. These controls are global rather than per character. Clone flags were intentionally removed and are rejected, and current segmented dialogue does not honor different mapped voices.

**Provider surface not exposed.** The [official API overview](https://platform.minimax.io/docs/api-reference/api-overview) documents more than 300 system voices for synchronous TTS, more than 100 for async TTS, 40 languages, rapid cloning, and prompt-based Voice Design. [Voice cloning](https://platform.minimax.io/docs/api-reference/voice-cloning-clone) accepts approximately 10 seconds to 5 minutes of audio up to 20 MiB, with an optional short prompt clip for similarity. [Voice Design](https://platform.minimax.io/docs/api-reference/voice-design-design) creates a voice and trial audio from a written prompt. Clone and design IDs are temporary unless activated through synthesis within seven days. AutoShow exposes none of the create, audition, activation, discovery, or resource-lifecycle operations.

**Character fit.** Provider-side potential is excellent: a large system catalog can cover ordinary casting, while design and clone paths cover fictional or actor-specific identities. Expressive controls are also useful for line delivery. No first-class speaker-labeled native dialogue endpoint was found, so AutoShow should plan on bounded per-turn synthesis and local assembly.

**Recommendation.** Add MiniMax after provider-neutral registration exists. Provision and activate each selected voice once, store expiry and activation state, apply controls per turn, and retain a local audition because temporary provider IDs are unsafe as the only reference.

### Groq Orpheus

**Repository today.** AutoShow registers the English Orpheus model and strictly validates six voices: autumn, diana, hannah, austin, daniel, and troy. The segmented adapter is affected by the captured-voice defect.

**Provider surface not exposed.** Groq currently documents [six English voices and six Saudi-Arabic voices](https://console.groq.com/docs/text-to-speech/orpheus) on separate models. English input supports bracketed free-form vocal directions; Arabic currently does not. AutoShow does not register the Arabic model/voices or expose vocal directions as structured per-turn delivery. No cloning, voice design, or native multi-speaker endpoint is documented.

**Character fit.** Twelve identities across two language-specific models are enough for prototypes, and the English acting directions can improve performance, but the pool is too small for systematic age and accent casting. There is no way to create a persistent fictional identity outside the stock set.

**Recommendation.** Fix switching, add the Arabic model, and map comic delivery to bracket instructions where safe. Treat Groq as a fast expressive stock option, not the primary reference-voice provider.

### xAI/Grok

**Repository today.** AutoShow recognizes only the original five built-ins `ara`, `eve`, `leo`, `rex`, and `sal`, plus an eight-character custom voice ID. It can consume an externally created ID but cannot create, list, describe, audition, or delete custom voices. Current segmented dialogue reuses the originally captured voice.

**Provider surface not exposed.** The current [xAI voice documentation](https://docs.x.ai/developers/model-capabilities/audio/voice) lists 26 stock voices, so repository validation blocks 21 valid stock choices. [Custom Voices](https://docs.x.ai/developers/model-capabilities/audio/custom-voices) clone a reference of up to 120 seconds and store metadata including age, gender, accent, language, tone, and use case. Users may create up to 30 voices in the console, while API creation is Enterprise-only. The feature is documented as available in the United States except Illinois.

**Character fit.** The current stock pool is a credible medium-sized cast, and custom metadata aligns well with comic voice profiles. Custom cloning could support a broad cast, but geographic and Enterprise restrictions prevent it from being a dependable default for every user.

**Recommendation.** Refresh the stock catalog first because it is an immediate correctness and breadth gain. Add optional custom-voice lifecycle support only behind explicit capability preflight and geographic/access messaging.

### Mistral Voxtral TTS

**Repository today.** AutoShow supports `voxtral-mini-tts-2603`, one-off reference audio, saved voice IDs, and creation of a saved voice with a name. Unlike the other segmented adapters, its target reads runtime voice/reference settings for each turn, making it the only working segmented multi-character provider today.

**Provider surface not exposed.** Mistral documents [zero-shot voice cloning from as little as two to three seconds, saved voices, nine languages, cross-lingual cloning, code-mixing, and low-latency streaming](https://docs.mistral.ai/studio-api/audio/overview). The [speech endpoint](https://docs.mistral.ai/studio-api/audio/text_to_speech/speech) can use one-off references or stored voices. AutoShow does not expose voice listing, detailed management, streaming output, or a per-character cache. In dialogue mode it removes the saved-voice name during a voice override, so multiple saved character voices must be provisioned before the scene run rather than created inline.

**Character fit.** Mistral is excellent when the project has a lawful reference clip for every character. It transfers identity, accent, tone, rhythm, and performance with very little audio. It is less useful for casting from nothing because no comparable text-designed or large structured stock library is documented.

**Recommendation.** Use it for the earliest reference-audio prototype. Pre-provision saved voices or cache prepared one-off references by character, record their provenance, and add a designed/stock provider for characters that lack approved source recordings.

### OpenAI

**Repository today.** AutoShow supports `gpt-4o-mini-tts-2025-12-15`, `tts-1`, and `tts-1-hd`, sends a string voice ID, defaults to `alloy`, and exposes instructions only for the dated mini model plus global speed. It has no consent or custom-voice creation flow. Current segmented dialogue does not honor per-speaker mappings.

**Provider surface not exposed.** The current [official speech API reference](https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create) documents 13 built-ins: alloy, ash, ballad, coral, echo, fable, onyx, nova, sage, shimmer, verse, marin, and cedar. Instructions can control delivery characteristics such as accent, emotion, intonation, speed, and tone on supported models. OpenAI also documents separate [voice consent](https://developers.openai.com/api/reference/resources/audio/subresources/voice_consents/methods/create) and [custom voice creation](https://developers.openai.com/api/reference/resources/audio/subresources/voices/methods/create) resources for eligible customers; creation requires a consent-recording ID and a sample, and custom voices are represented as voice objects rather than ordinary built-in strings. AutoShow implements none of that object shape, eligibility handling, consent capture, creation, or management.

**Documentation drift.** The current [model page](https://developers.openai.com/api/docs/models/gpt-4o-mini-tts) marks `gpt-4o-mini-tts` deprecated, including the dated snapshot represented in this repository, while the live speech reference still lists the identifiers. Model availability must be rechecked before implementation rather than inferred from the adapter's current list.

**Character fit.** Thirteen stock identities plus performance instructions can support a modest cast, but the public stock catalog lacks the breadth and structured demographic search of ElevenLabs, Cartesia, or Deepgram. Gated custom voices improve identity coverage for eligible customers but should not be the baseline assumption. There is no documented native speaker-labeled dialogue endpoint.

**Recommendation.** Refresh model status first, fix segmented switching, and model custom voices as a distinct typed source rather than passing every identity as a string. Add consent/create support only after eligibility is confirmed.

### Gemini TTS

**Repository today.** AutoShow uses one preview Gemini TTS model, defaults to Kore, and builds a native `multiSpeakerVoiceConfig` from the speaker registry. This path currently honors distinct voices, but AutoShow neither exposes the full catalog nor validates the provider's speaker ceiling. Its generic chunker can also split a long speaker-labeled request at an unsafe boundary.

**Provider surface not exposed.** Google's [Gemini speech-generation guide](https://ai.google.dev/gemini-api/docs/speech-generation) documents 30 prebuilt voices, approximately 70 languages, natural-language controls for style, tone, accent, pace, and character profiles, and native TTS with exactly two speakers. It does not document persistent custom identity cloning. The current model remains preview.

**Character fit.** Gemini is unusually convenient for a two-person scene: users can choose two of 30 identities and instruct their performance in one contextual request. A larger comic cast requires multiple native requests or a segmented mode, and a prompt-described “older” or “accented” performance is not the same as a stable custom identity.

**Recommendation.** Keep Gemini as the first stock native-dialogue route, add the full voice catalog and explicit two-speaker validation, preserve speaker boundaries during chunking, expose scene/character performance instructions, and document preview/drift risk.

### Deepgram Aura-2

**Repository today.** AutoShow strictly permits eight English Aura-2 voice-model IDs and exposes container, sample-rate, and speed controls. It has no voice discovery or demographic metadata. Current segmented dialogue does not honor per-speaker voice-model overrides.

**Provider surface not exposed.** Deepgram's [current Aura-2 model table](https://developers.deepgram.com/docs/tts-models) contains roughly 90 identities across English, Spanish, Dutch, French, German, Italian, and Japanese. Each record includes expressed gender, age, language, accent, characteristics, and intended use. English covers US, UK, Australian, Irish, and Filipino accents; Spanish covers several regional varieties. Official [voice controls](https://developers.deepgram.com/docs/tts-voice-controls) include speed and inline pronunciation overrides. No public cloning, prompt-based identity design, or native dialogue endpoint was found.

**Character fit.** This is the best stock-only casting database among the implemented providers because its metadata maps directly to age, gender presentation, accent, and vocal character. It cannot reproduce a specific actor or create an entirely novel identity, but a catalog of this breadth can cover many comics without consent-heavy cloning.

**Recommendation.** Expand or dynamically discover the full catalog early. Store official metadata in provider-specific casting records, fix per-turn model switching, and use local segment assembly.

### Speechify

**Repository today.** AutoShow supports Simba 3.2 and 3.0, eight curated Simba 3.2 English voices, arbitrary external IDs where allowed, and a Simba 3.0 custom-voice path. It validates reference samples as 10–30 seconds and at most 5 MiB. The flow is one clone context per run, not one registered clone per comic character, and current dialogue mappings do not select separate clones. Consent name/email, locale, and gender are resolved, but the current multipart creation request appears to send only the name, a consent boolean, and the sample; that mismatch should be confirmed and corrected before relying on the metadata.

**Provider surface not exposed.** Speechify's [voice-cloning guide](https://docs.speechify.ai/tts/guides/voice-cloning) describes 10–30 second samples and consent information, with accent, style, and tone captured by the clone. The dated [2026-07-16 changelog](https://docs.speechify.ai/build/changelog/2026/7/16) says Simba 3.0 accepts self-serve zero-shot clones while Simba 3.2 requires manual approval for each cloned voice; older concept pages conflict with this, so the dated entry is the safer implementation baseline. Official model material also describes a dialogue model and `/v1/audio/dialogue`, but this surface is changing and should be verified immediately before coding. AutoShow lacks catalog listing, sample audition, deletion, per-character clone registration, SSML/emotion mapping, native dialogue, and speech-mark output.

**Character fit.** Cross-language cloning makes Speechify useful when consenting actor samples exist, but current model/approval differences complicate an automated workflow. The repository's eight curated 3.2 stock voices alone do not provide dependable age/accent breadth.

**Recommendation.** Preserve it as an optional clone provider, but repair consent serialization and per-character provisioning before adding comic support. Gate 3.2 clones on approval status and implement native dialogue only after reconfirming the live contract.

### Hume Octave

**Repository today.** AutoShow supports Octave 2 and can address an existing Hume AI or custom voice by name or UUID. It defaults to a voice named `Male English Actor`. The adapter sends isolated utterances and exposes none of the provider's creation, search, acting, continuation, or multi-speaker features. Current segmented mappings also reuse the original voice.

**Provider surface not exposed.** Hume documents [more than 100 library voices, voice design, and voice cloning](https://dev.hume.ai/docs/voice/overview). [Voice Design](https://dev.hume.ai/docs/voice/voice-design) can use prompts and tags for attributes such as age, gender, and accent; design currently uses Octave 1 even though designed voices can be synthesized with Octave 2. [Voice cloning](https://dev.hume.ai/docs/voice/voice-cloning) can use about 15 seconds from a consenting speaker and is subscription-dependent. Hume also supports acting instructions, speed, trailing silence, context preservation, multiple utterances with per-utterance voices, and [multi-speaker continuation](https://dev.hume.ai/docs/text-to-speech-tts/continuation). AutoShow exposes none of these and therefore misses a native contextual dialogue path.

**Character fit.** Hume is one of the best matches for dramatic comic dialogue. It can design fictional identities, clone approved actors, search a sizable library, direct line-level acting, and preserve conversational context across different voices. The current version split for design and subscription requirements add operational complexity but do not diminish the feature fit.

**Recommendation.** Treat Hume as a first-tier expansion alongside ElevenLabs. Implement library/design/clone registration and auditions first, then use multi-utterance synthesis and continuation with a segmented repair fallback.

### Cartesia

**Repository today.** AutoShow supports Sonic 3.5, an arbitrary voice ID, and an optional language. The request uses only ID-based voice selection. It has no voice search, cloning, localization, pronunciation, speed, volume, or emotion workflow, and segmented mappings currently reuse the original voice.

**Provider surface not exposed.** Cartesia documents [more than 500 stock voices and voice search/filtering](https://docs.cartesia.ai/build-with-cartesia/capability-guides/choosing-a-voice), [Instant Clone](https://docs.cartesia.ai/build-with-cartesia/capability-guides/clone-voices) from up to ten seconds, and [Professional Clone](https://docs.cartesia.ai/build-with-cartesia/capability-guides/clone-voices-pro) from at least 30 minutes with two hours recommended and a Startup-or-higher plan. [Sonic 3.5](https://docs.cartesia.ai/build-with-cartesia/tts-models/latest) supports 42 languages. The provider also exposes localization and [speed, volume, and emotion controls](https://docs.cartesia.ai/build-with-cartesia/capability-guides/volume-speed-emotion). No first-class speaker-labeled dialogue endpoint was found.

**Character fit.** A 500-plus catalog can cover diverse characters without custom assets, while two clone tiers cover quick references and high-consistency performers. Searchable metadata and multilingual support make it a strong casting option even before cloning.

**Recommendation.** Add catalog discovery and Instant Clone after the core registry exists; add Professional Clone as an explicitly gated workflow. Retain bounded segmented assembly and record every line-level control in the dialogue manifest.

## Important providers not currently integrated

This is a strategic shortlist, not an attempt to catalog every TTS service.

### Azure Speech

Azure is the highest-value missing hosted provider when stock demographic breadth matters. Its [Text to Speech service](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech) covers more than 100 languages and locales. [SSML voice and role controls](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-synthesis-markup-voice) can switch voices in one document and can role-play girl, boy, young-adult, older-adult, and senior presentations in supported voices, in addition to many speaking styles. Neural HD Multi-Talker voices provide contextual dialogue, although important parts of that surface are preview and region-specific.

Azure's [Professional Voice](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/custom-neural-voice) is limited-access and uses voice-talent consent plus substantial training material; the standard fine-tune route requires at least 300 utterances. Personal Voice uses recorded consent and a short prompt to create a speaker profile. These custom paths should be treated as gated, not assumed self-service.

**Fit and priority.** Excellent stock age-role, locale, style, and multi-voice coverage; high-value first new hosted provider if broad stock casting is more important than easy custom cloning. Confirm region, preview, and custom-access requirements before selecting models.

### Google Cloud Text-to-Speech and Chirp 3

This is a distinct API/catalog integration from the repository's Gemini SDK adapter. Google Cloud offers [multiple voice types and a large locale catalog](https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types), 30 Chirp 3 HD styles across many locales, explicit gender metadata, streaming, and controls for pace, pause, and pronunciation. Experimental Studio multi-speaker voices and Cloud-hosted Gemini TTS remain limited to two speakers.

[Chirp 3 Instant Custom Voice](https://docs.cloud.google.com/text-to-speech/docs/chirp3-instant-custom-voice) supports short consent and reference recordings, streaming, long-form use, and multilingual transfer, but is allowlist/sales-gated. It should not be a roadmap dependency without confirmed access.

**Fit and priority.** Strong stock/catalog addition and useful for existing Google Cloud users, but lower priority than expanding the existing Gemini adapter unless the broader catalog or allowlisted custom voice solves a concrete project need.

### Amazon Polly

Polly's [voice table](https://docs.aws.amazon.com/polly/latest/dg/available-voices.html) spans dozens of identities across approximately 42 language/locale rows and includes explicit gender plus several US child voices. Standard, neural, long-form, and [generative voices](https://docs.aws.amazon.com/polly/latest/dg/generative-voices.html) provide a mature self-serve operational surface. [SSML](https://docs.aws.amazon.com/polly/latest/dg/ssml.html) controls pronunciation, rate, pitch, volume, breaths, whispers, and limited styles.

[Brand Voice](https://aws.amazon.com/polly/features/#Brand_Voice) is a bespoke engagement with AWS and a voice actor rather than a self-serve cloning API. No native coherent multi-speaker endpoint was found.

**Fit and priority.** A stable stock fallback with good locale and some child-role coverage, but not a first choice for creating a large custom fictional cast.

### Resemble AI

Resemble is a strong missing custom-character candidate. [Rapid Clone and Professional Clone](https://docs.resemble.ai/voice-creation/voices/clone-overview) cover roughly 10 seconds to 3 minutes for fast cloning and 10–25 or more minutes for higher-quality training, with Business-or-higher access and explicit verifiable consent for professional work. [Voice Design](https://docs.resemble.ai/voice-creation/voice-design/design-overview) generates three candidates from descriptions of age, gender, accent, tone, and style. Official materials also document cross-language cloning, natural-language variants, SSML controls, watermarking, and cloud or on-premises deployment.

No first-class speaker-labeled native dialogue endpoint was found, so it maps cleanly to AutoShow's proposed local segment pipeline.

**Fit and priority.** High priority if creating original character identities is more important than stock breadth. It is the most compelling new custom-voice SaaS candidate after fully using ElevenLabs and Hume.

### PlayAI/PlayHT

Stale [official API documentation](https://docs.play.ht/reference/models) describes a strong character feature set: tagged stock voices, short cross-language cloning, and PlayDialog with contextual two-voice dialogue. The research snapshot found a shutdown notice on the official homepage, and the `play.ai` domain no longer resolved during final link verification.

**Fit and priority.** Disqualified unless the company confirms a live successor and supported API. Stale documentation must not be mistaken for provider availability.

## Self-hosted options not currently integrated

### Qwen3-TTS

The [official Qwen3-TTS project](https://github.com/QwenLM/Qwen3-TTS) is the best local feature match. The Apache-2.0 0.6B and 1.7B model family documents ten languages, nine stock timbres spanning several ages, gender presentations, languages, and dialects, natural-language style control, short-reference rapid cloning, and free-form Voice Design. Its especially relevant design-then-clone workflow can turn a designed fictional identity into a reusable reference for consistent later synthesis.

It does not expose a native multi-speaker conversation API; AutoShow should synthesize and cache turns locally. Hardware, latency, and quantization quality must be benchmarked on the project's actual deployment targets before promising a default local experience.

**Fit and priority.** First local addition when voice design and cloning matter; substantially better aligned with comic characters than Kitten.

### Resemble Chatterbox

The [official Chatterbox project](https://github.com/resemble-ai/chatterbox) is MIT-licensed and provides an English Turbo model and a Multilingual model covering more than 23 languages. It supports zero-shot reference-audio cloning, expressive/paralinguistic tags, and watermarking. It has no public native dialogue surface.

**Fit and priority.** The strongest simple permissive local clone-first alternative. Prefer it over Qwen3-TTS when a known reference identity is the main requirement and free-form voice design is not.

### Fish Audio S2

The [official Fish Speech project](https://github.com/fishaudio/fish-speech) is technically attractive: current materials describe more than 80 languages, native multi-speaker and multi-turn generation, rapid cloning from 10–30 seconds, and inline performance tags. It is also a large 4B-plus-400M system whose published performance uses high-end hardware.

The current Fish Audio Research License is non-commercial/research-oriented; production commercial use requires a separate written license.

**Fit and priority.** Useful for R&D into native local dialogue, but exclude it from a production default unless licensing and hardware are explicitly resolved.

### VibeVoice

Microsoft's VibeVoice originally demonstrated long-form, multi-speaker generation, but Microsoft [removed TTS code from the official repository](https://github.com/microsoft/VibeVoice) in January 2026 after misuse.

**Fit and priority.** Do not plan an integration around unavailable code.

## Which options can cover age, gender, and accent?

The answer depends on whether the project wants to cast from stock, invent identities, or reproduce consenting performers.

| Need | Best current candidates | Why | Main constraint |
|---|---|---|---|
| Largest managed stock search | ElevenLabs, Cartesia | Thousands or hundreds of selectable identities and discovery metadata | Catalog access and terms vary by plan |
| Most structured stock demographic casting | Deepgram, Azure, Google Cloud, Amazon Polly | Explicit age or role, expressed gender, accent, language, and locale metadata | Less ability to invent an exact new identity |
| Fictional identity from a written brief | ElevenLabs, Hume, MiniMax, Resemble, Qwen3-TTS | Voice Design can state age, gender presentation, accent, register, tone, and pacing | Designed identity consistency and access differ by provider |
| Identity from an approved actor reference | ElevenLabs, Mistral, MiniMax, Speechify, Hume, Cartesia, xAI, Resemble, Qwen3-TTS, Chatterbox | Clone/reference workflows preserve timbre and accent | Consent, rights, sample quality, access, and resource retention |
| Native contextual two-character scene | Gemini, ElevenLabs, Hume; Azure/Google/Speechify where the documented model is available | Shared request context can improve conversational flow | Speaker ceilings, preview status, model drift, and weaker repair granularity |
| Local/private varied characters | Qwen3-TTS, Chatterbox | Design or clone without sending source audio to a hosted API | Local compute and quality benchmarking |
| No-cost lightweight timing draft | Kitten | Small local model and eight fixed voices | Too little identity and accent breadth for final casting |

For automated casting, stock count alone is not enough. AutoShow needs normalized voice metadata and a human approval step. “Young,” “male,” or “Irish” tags are useful search constraints, not proof that a performance fits a character. A designed or cloned voice likewise needs an audition across neutral speech, emotional range, proper nouns, and representative dialogue.

## Recommended comic voice architecture

The visual reference workflow provides the right conceptual model: an authored character catalog, a registered current reference with provenance and checksums, and an immutable snapshot copied into a scene run. Voice support should mirror that lifecycle without putting provider credentials or consent data into the strict visual schema.

### 1. Separate the authored voice brief from provider registrations

Create a provider-neutral voice catalog keyed by the existing canonical `CharacterKey`. Do not add provider resource fields directly to the strict version-3 visual character catalog.

An authored voice brief should be able to describe:

- Character key and aliases.
- Language and locale.
- Accent or dialect, including strength and whether it is mandatory or aspirational.
- Apparent age range and gender presentation when those attributes are relevant to casting.
- Pitch/register, timbre, resonance, pace, energy, texture, and vocal mannerisms.
- Default performance notes and prohibited caricatures.
- Pronunciation notes.
- Whether the acceptable source kinds are stock, designed, cloned, or any.

Provider registrations should be separate records containing provider, model, source kind, provider voice ID/name, provider metadata, design prompt or reference asset, synthesis defaults, audition generation, access tier, creation/expiry/retention state, and cleanup status.

### 2. Add a dedicated reference-voice command

A command such as `comic reference-voice --character <key>` should create or select a voice, synthesize a standard audition, and promote it only after all required artifacts succeed. It should not silently synthesize the entire scene.

The audition set should include:

- A neutral identity line for timbre.
- A representative line from the character's script.
- At least two contrasting delivery lines where the provider supports performance control.
- Names, invented terms, and accent-sensitive words used by the project.
- A fixed comparison passage shared by all candidates.

Promotion should register an immutable generation ID, the voice brief hash, provider/model/source kind, provider resource ID, exact settings, local audition checksum and duration, reference-audio checksum where lawful, consent/provenance record, creation timestamp, and prior generation ID. A remote voice ID alone is not an immutable reference because a provider can edit, expire, or delete it.

### 3. Build a source-linked dialogue plan

A command such as `comic generate-audio <script>` should first create a reviewable `dialogue-plan.json` from `structured-script.json`. Each turn should preserve:

- `sourceSegmentId` and `beatIndex`.
- Canonical `characterKey` or explicit narrator/uncatalogued-role key.
- Original speaker label.
- Exact canonical text.
- Delivery/tone.
- V.O., O.S., radio, intercom, telephone, or other effect state.
- Pause before/after and any overlap policy.
- Selected voice registration and snapshot ID.

This avoids the generic parser's loss of parentheticals and makes panel-to-audio timing possible through source IDs.

### 4. Snapshot every selected voice before paid synthesis

Preflight must resolve every character and non-character role, validate provider access and model compatibility, prove that all custom resources exist, enforce native speaker limits, and verify consent/provenance before any provider request.

Copy a voice snapshot manifest into the scene run. For local references, include the audio and checksum. For hosted voices, include provider metadata and a checksummed approved audition when terms permit. Bind the dialogue plan to this snapshot so a resumed scene cannot silently use a newer voice registration.

### 5. Support native and segmented rendering deliberately

Native dialogue and segmented dialogue should be separate provider capabilities, not a single boolean.

- Use native rendering when contextual interaction materially improves quality and the scene fits the provider's speaker, length, and access limits.
- Preserve a segmented route for providers without native dialogue, for scenes exceeding native limits, and for replacing one failed line without regenerating the entire conversation.
- For native output, request timestamps where available and store speaker/utterance timing. If the provider cannot return a reliable per-turn timeline, record that limitation explicitly.
- For segmented output, use bounded concurrency per provider, cache each turn, and add deterministic pause, crossfade, loudness, room-tone, and effects stages locally.

The corrected target contract should pass an explicit per-invocation `VoiceSource` or resolved `VoiceProfile`, or construct a target per character. Mutating a generic options bag after the provider target has captured selection values must not remain the dispatch mechanism.

### 6. Cache by identity and content, not output path

Each segment cache key should include canonical text, source segment, delivery/effect settings, provider/model, complete synthesis settings, and immutable voice snapshot generation. This permits targeted line repair, local remixing, provider comparisons, and deterministic resume without repurchasing unchanged audio.

The final recording manifest should map every source segment to its segment file, checksum, actual provider voice, duration, start/end time, settings, cost, retry history, and final mix placement. Metadata must report the voice actually sent to the provider, not merely the requested speaker map.

### 7. Make casting provider-qualified

A character should have a neutral brief and one or more provider-specific registrations. A comparison run might map the same character to an ElevenLabs designed voice, a Deepgram stock voice, and a Qwen clone. A single `SPEAKER=VOICE` string cannot express that relationship.

Provider comparison should evaluate identity match, consistency across lines, emotional range, intelligibility, pronunciation, conversational timing, artifacts, and cost. The existing benchmark key must include character/voice-profile identity rather than only service/model.

## Recommended delivery sequence

### Phase 0 — establish truthful behavior (complete 2026-08-11)

1. Fix per-turn voice dispatch for every segmented adapter.
2. Add provider contract tests that assert the actual request voice or reference for each speaker, not only audio ordering.
3. Correct documentation and metadata so unsupported or ineffective mappings cannot be reported as successful.
4. Enforce Gemini's exactly-two-speaker limit and speaker-safe chunking.
5. Bound hosted turn concurrency and retain dialogue artifacts in single-, multi-provider, and batch runs.

### Phase 1 — introduce comic voice references

1. Add the provider-neutral voice brief and provider registration schemas.
2. Add `comic reference-voice` with audition generation, approval, provenance, consent, promotion, and prior-generation tracking.
3. Add immutable per-scene voice snapshots modeled after character image snapshots.
4. Add a source-linked `dialogue-plan.json` built directly from structured comic data.

### Phase 2 — ship the smallest useful recording workflow

1. Add `comic generate-audio` with Mistral reference/saved voices as the first custom/reference path.
2. Retain Gemini as the native two-character stock path.
3. Add the local segmented assembler, cache, timeline manifest, pauses, loudness, and effect handling.
4. Define and test policies for narration, captions, compound speakers, uncatalogued roles, and V.O./O.S.

### Phase 3 — unlock high-value provider capabilities

1. ElevenLabs: voice discovery, Voice Design, clone registration/reuse, Text-to-Dialogue, timestamps, and resource lifecycle.
2. Hume: library/design/clone, acting instructions, multi-utterance dialogue, and continuation.
3. Deepgram and xAI: refresh the currently truncated stock catalogs and ingest demographic metadata.
4. MiniMax: Voice Design, cloning, audition/activation, and expiry handling.
5. Cartesia: catalog discovery, Instant Clone, localization, and performance controls.
6. Speechify: correct consent serialization, per-character clone provisioning, approval preflight, and only then native dialogue if the live API remains stable.

### Phase 4 — add a strategic new provider only for a defined need

- Add Qwen3-TTS first for local design and cloning.
- Add Azure first for hosted stock breadth, age-role casting, and multi-talker support.
- Add Resemble first if custom fictional identity creation is the dominant SaaS requirement.
- Add Google Cloud TTS for a broader Google catalog or confirmed Instant Custom Voice access.
- Add Polly as a mature locale/stock fallback.
- Exclude PlayAI while shut down, VibeVoice while code is unavailable, and Fish S2 from commercial production without a suitable license.

## Recommended provider choices by near-term goal

| Goal | Recommended first option | Alternative | Reason |
|---|---|---|---|
| Fastest working reference-audio prototype in this repo | Mistral | Repair ElevenLabs segmented dispatch | Mistral already honors per-turn reference/saved voices |
| Fastest two-character stock prototype | Gemini | Hume after adapter expansion | Gemini already has native mapped speakers; enforce the two-speaker limit |
| Best managed long-term casting platform | ElevenLabs | Hume | Breadth, design, clone tiers, native dialogue, and strong multilingual coverage |
| Most expressive contextual dramatic dialogue | Hume | ElevenLabs | Acting instructions, contextual utterances, and continuation |
| Best stock-only demographic search inside current providers | Deepgram | Cartesia | Structured age, gender, accent, language, and character metadata |
| Best local/private character creation | Qwen3-TTS | Chatterbox | Design plus clone versus a simpler clone-first workflow |
| Lightweight no-cost development baseline | Kitten | Qwen3-TTS on capable hardware | Easy local use, but limited identity breadth |

## Consent, rights, and provenance requirements

Custom voice support creates obligations that do not exist for ordinary stock selection. The workflow should require affirmative provenance rather than treating a reference file path as permission.

- Record who owns or controls the source recording, who consented, what uses were authorized, the jurisdiction/territory if relevant, and any expiration or revocation condition.
- Preserve provider consent IDs and required consent recordings separately from the performer sample.
- Never use a provider-generated TTS audition as cloning material for another provider unless the source provider's terms and the performer's authorization explicitly permit it.
- Prefer designed voices or consenting adult performers for age-coded fictional characters; do not require real minor recordings to obtain a childlike role.
- Record provider retention and deletion state for every created resource. A local registration must know whether the remote voice is active, expired, deleted, or pending approval.
- Treat provider catalog terms and community-library sharing rules as part of casting eligibility, not as an after-the-fact legal note.

These are product requirements, not a substitute for legal review.

## Final recommendation

The strongest path is not to pick one TTS provider and embed it directly in the comic command. Build a provider-neutral character voice and dialogue layer, then let several providers satisfy different source kinds.

Repair the current segmented dispatch first. Then implement approved voice registrations and immutable snapshots, using Mistral to prove reference-audio characters and Gemini to prove native two-speaker stock dialogue. ElevenLabs and Hume should be the first full managed integrations because together they cover large catalogs, designed fictional identities, cloning, expressive direction, and native dialogue. Expand Deepgram immediately afterward for low-friction age/gender/accent stock casting. Add Qwen3-TTS when local/private voice creation is valuable.

That sequence creates a truthful, testable foundation and produces useful comic audio early without locking the comic pipeline to one provider's voice IDs, consent rules, speaker ceiling, or resource lifecycle.

## Verification and research notes

- Repository conclusions were derived from the source paths cited throughout this report at baseline `1bba61c2`.
- External capability claims use official provider documentation linked at the point of use and were checked on 2026-08-10.
- Counts are intentionally described as approximate where catalogs are live and mutable.
- No hosted or quota-limited provider command was run. No voice was created, cloned, uploaded, synthesized, or deleted while preparing this report.
