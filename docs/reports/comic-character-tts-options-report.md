# Comic Character Voice and Multi-Character TTS Options

Assessment date: 2026-08-10. Repository baseline: `1bba61c2`. Updated status: 2026-08-11 (ADR-020 Phases 0–4 complete). Historical baseline findings are preserved alongside the completed implementation details.

## Purpose

This report evaluates the text-to-speech options represented in AutoShow and a bounded set of important options that were analyzed for comic dialogue integration. It focuses on the comic workflow: taking a structured script, establishing a stable reference voice for every character, and synthesizing a multi-character recording in which identity, delivery, accent, and timing remain reviewable and reproducible.

The report distinguishes three separate questions that should not be collapsed into one capability flag:

1. Can the provider supply or create enough distinct character identities?
2. Can the provider perform multiple characters coherently in one request, or must AutoShow assemble independently generated turns?
3. Does the current repository actually expose and correctly execute those capabilities?

Provider features and access conditions change quickly. External claims below are based on official product or API documentation checked on the assessment date and revalidated during implementation.

## Implementation update: Phases 0–4 complete

The baseline defects and feature gaps documented in this report were systematically resolved on 2026-08-11 through the execution of ADR-020 across five distinct implementation phases:

- **Phase 0 — Establish truthful baseline behavior (2026-08-11):** All 12 TTS adapters now receive explicit per-turn voice invocations, verified by mocked A/B/A serializer contract tests. Gemini native dialogue is restricted to exactly two speakers and partitions safely at turn boundaries; scenes with more speakers use the segmented route. Dialogue work is bounded, source-ordered, cancellable, and workspace-safe. Canonical provider state uses operation-scoped target identities and strict `ttsAudio` projections, while retained render artifacts record observed per-turn voice identities, normalized dialogue, segments, results, checksums, and audio-run linkage. Deepgram (91 Aura-2 voices), xAI (26 stock voices), Gemini, Groq, and OpenAI catalogs were refreshed via ADR-018. Direct synthesis-time voice creation defaults are rejected before provider setup with actionable management migration diagnostics.
- **Phase 1 — Introduce comic voice references and management (2026-08-11):** A protected store was implemented to manage candidate previews, auditions, consent, and append-only registrations (`approveRegistration`). The shared `voice` command and comic-native `comic reference-voice` alias support importing existing resources, protecting consent, planning or executing voice creation, auditioning, approving, reconciling, retiring, revoking, and deleting project-owned resources. Protected and ordinary output roots are kept strictly disjoint.
- **Phase 2 — Ship multi-speaker script-to-audio workflow (2026-08-11):** The `comic generate-audio` command was implemented. Canonical `structured-script.json` v4 now embeds exact source identity and Unicode source spans. Provider-neutral `ComicDialoguePlan` preserves delivery/effect intent, authored timing cues, deterministic pacing, and explicit overlap nodes. All targets and roles resolve through an immutable approved aggregate voice snapshot per scene run. Execution supports static readiness preflight before dispatch, native 2-speaker Gemini, Hume Octave 1 acting descriptions, Hume Octave 2 delivery evidence, Mistral saved/reference consumption, segmented fallback, operation-scoped resume, 16/24-bit mono/stereo WAV mastering, and targetless zero-turn scene completion.
- **Phase 3 — First-class ElevenLabs and Hume Octave adapters (2026-08-11):** Advanced capability adapters were added for ElevenLabs and Hume. ElevenLabs supports catalog discovery, protected candidate design/materialization, clone state, resource inspection/deletion, timestamps, and turn-safe Text-to-Dialogue with prepared-text alignment. Hume Octave supports stock/custom stable IDs, Octave 1 design saved for Octave 2, platform-gated clone state, deletion proof, model-constrained direction/timing, 1-5 native utterance takes, word/phoneme timing, and continuation.
- **Phase 4 — MiniMax, Cartesia, and Speechify capability adapters (2026-08-11):** Advanced capability adapters were added for MiniMax, Cartesia, and Speechify. MiniMax provides system/account catalogs, temporary Voice Design, upload-and-clone activation state, and typed deletion. Cartesia provides public/account cursor catalogs, protected instant clone, gated Pro Voice Clone state, and lifecycle. Speechify provides personal cursor catalogs, protected consent-bearing personal clone, model-aware readiness, word timing, lifecycle, and corrected multipart consent/locale/gender serialization. Cartesia and Speechify text-prompt design and native multi-speaker dialogue are explicitly marked unsupported (retaining the segmented baseline). Readiness preflight checks all five advanced providers before dispatch barrier, and benchmark keys incorporate adapter target + render + optional registration/snapshot/character identity.

## Baseline executive conclusion

On 2026-08-10, AutoShow had low-level pieces for audio synthesis, but lacked a trustworthy multi-character script-to-audio workflow. The implementation of ADR-020 on 2026-08-11 addressed every critical baseline finding:

- **Provider surface:** AutoShow features adapters for 12 TTS providers: Kitten, ElevenLabs, MiniMax, Groq, xAI/Grok, Mistral, OpenAI, Gemini, Deepgram, Speechify, Hume, and Cartesia.
- **Comic commands:** Dedicated commands `comic reference-voice` (for creating, auditioning, approving, and snapshotting character reference voices) and `comic generate-audio` (for turning structured scripts into multi-character audio recordings) are now fully implemented.
- **Explicit voice dispatch:** The baseline defect where ten segmented adapters ignored runtime per-turn voice overrides was repaired in Phase 0. Every adapter now receives explicit per-turn voice arguments and records observed per-turn voice identities in render metadata.
- **Casting and catalog:** A provider-neutral character voice catalog (`CharacterVoiceBrief`), model-qualified registrations, canonical auditions, and immutable scene voice snapshots are now fully integrated. Deepgram's Aura-2 catalog was expanded to 91 voices with demographic metadata, xAI was expanded to 26 voices, and ElevenLabs, Hume, MiniMax, Cartesia, and Speechify were equipped with catalog discovery, voice design, and cloning lifecycles.
- **Native vs. segmented dialogue:** Gemini's native two-speaker path is strictly bounded and turn-partitioned; ElevenLabs Text-to-Dialogue and Hume Octave multi-utterance/continuation provide native multi-speaker rendering; and all 12 providers maintain a deterministic, cached segmented assembly fallback.
- **Mastering and timing:** Audio output is mastered through a configurable local pipeline supporting 16-bit or 24-bit PCM WAV in mono or stereo, with explicit pause control, crossfades, room tone, and effects.

## What “custom voice” means

The provider market uses several terms for materially different operations:

- **Stock voice:** A provider-owned identity selected from a catalog. A large, searchable catalog with age, gender presentation, accent, language, and style metadata can support a broad cast without handling actor recordings.
- **Voice design:** Creates a new synthetic identity from a written brief such as “older Caribbean woman, dry humor, low register.” It is the best fit when the character is fictional and no lawful source recording exists.
- **Voice cloning:** Derives an identity from reference audio. It preserves a specific actor's timbre and accent, but requires documented rights and consent. Instant cloning and professionally trained cloning have different consistency, access, and data requirements.
- **Reference voice recording:** An audition artifact that establishes how a selected stock, designed, or cloned voice sounds. It is not necessarily the source material used to create a clone.
- **Performance control:** Changes how an identity delivers a line through instructions, emotion, pace, pitch, pronunciation, or style controls. It does not by itself create another stable character identity.
- **Native dialogue:** Lets one provider request contain multiple speakers or utterances with shared context. **Segmented dialogue:** Synthesizes turns independently and assembles them locally. Native dialogue improves conversational continuity; segmented dialogue provides stronger caching, repair, timing, and provider portability.

A provider can be excellent for character work without supporting all six categories. AutoShow represents them separately through explicit provider capability facets.

## Repository assessment update

### Comic data is voice-ready

The canonical script input is `metadata/structured-script.json` (v4). Structured comic beats and source segments retain stable source identifiers, canonical `speakerKey` values, original `speakerLabel`, exact normalized text, delivery notes, beat indexes, scene locations, and exact Unicode source spans.

The panel schema in `scene.json` is useful for visual synchronization, but `structured-script.json` remains the single source of truth for audio generation. `ComicDialoguePlan` builds directly from structured script turns, preserving delivery intent, authored timing cues, deterministic pacing, and explicit overlap nodes.

### Generic TTS and comic surface

Durable voice management is handled through the shared `voice` command and `comic reference-voice` alias. Synthesis commands (`tts`, `comic generate-audio`) reject inline voice creation or clone defaults at resolution time, requiring voice references to be provisioned, auditioned, and approved beforehand.

Multi-speaker turn orchestration (`runMultiSpeakerTts`, `comic generate-audio`) validates target readiness, constructs execution strategies (native or segmented), dispatches explicit per-turn invocations with bounded concurrency, normalizes timing, and assembles the mastered WAV output.

### Resolved multi-speaker correctness contract

The baseline defect—where ten segmented adapters closed over their initial voice selection during target collection—was fixed in Phase 0. All 12 provider adapters now honor explicit per-turn voice arguments:

| Baseline route (2026-08-10) | Current route (2026-08-11) | Distinct voices working now | Implementation details |
|---|---|---|---|
| Gemini native | Gemini native (2 speakers) / Segmented (>2 speakers) | Yes | Restricted to exactly two speakers with turn-safe partitioning; >2 speakers fall back to segmented route. |
| Mistral segmented | Mistral segmented | Yes | Honor per-turn saved voice IDs and opaque reference assets; creation moved to management. |
| Other 10 segmented adapters | All 10 repaired segmented adapters | Yes | Explicit per-turn voice arguments passed and asserted via A/B/A serializer contract tests. |

### Resolved cross-provider limitations

- **Provider-qualified casting:** Character voices are mapped via `CharacterVoiceBrief` and model-qualified registrations (`(subject, provider, provider model, profile)`), allowing independent castings across ElevenLabs, Hume, Mistral, Deepgram, etc.
- **Bounded concurrency:** Hosted turn synthesis is launched through a bounded execution queue, preventing rate-limit bursts and resource races.
- **Configurable mastering:** Local assembly normalizes output to 16-bit or 24-bit PCM WAV (mono/stereo) with configurable pauses, crossfades, room tone, and audio effects.
- **Rich metadata & lineage:** Output manifests (`manifest.json`, `dialogue-plan.json`, `ttsAudio` / `comicAudio` projections) record observed per-turn voice identities, source segment IDs, timing, delivery controls, reference hashes, and audio-run linkage.
- **Artifact retention:** Dialogue segments and render artifacts are systematically preserved in canonical scene run directories across single-, multi-provider, and batch runs.
- **Demographic metadata:** Integrated across Deepgram (91 voices), Cartesia, Speechify, xAI (26 voices), and OpenAI (13 voices).
- **Benchmark identity:** Voice-quality benchmarks key results by adapter target + render + optional registration/snapshot/character identity.

## Provider capability matrix

Capabilities and current repository support following ADR-020 Phase 0–4 implementation are summarized below, ranked from highest overall provider capability (#1 ElevenLabs) to basic local baseline (#12 Kitten). Each capability entry combines a status indicator with a descriptive text explanation:

- ✅ **Fully compatible / supported:** Capability or endpoint is fully exposed, feature-rich, or operates natively with high suitability.
- ⚠️ **Partially compatible / restricted:** Capability is available with structural limits (e.g. 2-speaker ceiling, small/stock-only catalog, gated API access, or reliance on custom clip inputs).
- ❌ **Not compatible / unsupported:** Capability, custom identity creation, or native multi-speaker dialogue endpoint is not available or not supported by the provider.

| Provider | Official identity breadth | Custom identity | Provider-native dialogue | Age/gender/accent suitability | Distinct comic voices working now |
|---|---|---|---|---|---|
| #1 ElevenLabs | ✅ 10,000+ library voices | ✅ Voice Design, remixing, instant & professional clone | ✅ Yes, Text-to-Dialogue | ✅ Excellent through filters, design, and cloning | ✅ Yes (native & segmented) |
| #2 Hume | ✅ 100+ library voices | ✅ Prompt design (Octave 1/2) & cloning | ✅ Yes, multi-utterance & continuation | ✅ Excellent through design, tags, clone, acting | ✅ Yes (native multi-utterance & segmented) |
| #3 Cartesia | ✅ 500+ stock voices | ✅ Instant & Pro cloning | ❌ Unsupported in repo (segmented assembly fallback) | ✅ Excellent catalog breadth & clone potential | ✅ Yes (Phase 4 adapter, segmented) |
| #4 Deepgram | ✅ 91 Aura-2 voices | ❌ None documented | ❌ No (segmented assembly baseline) | ✅ Excellent stock demographic metadata | ✅ Yes (full catalog, segmented) |
| #5 MiniMax | ✅ 300+ system voices, 100+ async | ✅ Prompt design & rapid clone | ❌ No documented endpoint (segmented assembly fallback) | ✅ Excellent provider potential | ✅ Yes (Phase 4 adapter, segmented) |
| #6 Speechify | ⚠️ 8 curated Simba 3.2 + personal catalog | ✅ 10–30s personal cloning with consent | ❌ Unsupported in repo (segmented assembly fallback) | ⚠️ High with approved clones; moderate stock breadth | ✅ Yes (Phase 4 adapter, segmented) |
| #7 Mistral | ⚠️ Reference & saved voices (no public stock catalog) | ✅ Zero-shot reference cloning & saved voices | ❌ No documented endpoint (segmented assembly fallback) | ⚠️ High with reference clips; requires sample audio | ✅ Yes (segmented saved/reference) |
| #8 Gemini | ✅ 30 fixed voices, natural language control | ❌ No persistent cloning | ⚠️ Yes, exactly 2 speakers (segmented fallback for >2) | ✅ Good stock variety & prompt control | ✅ Yes (native 2-speaker & segmented) |
| #9 OpenAI | ⚠️ 13 documented built-ins | ⚠️ Gated custom voices with consent | ❌ No documented endpoint (segmented assembly fallback) | ⚠️ Medium stock breadth; style instructions on mini | ✅ Yes (segmented per-turn fixed) |
| #10 xAI/Grok | ✅ 26 stock voices | ⚠️ Short-reference cloning (Enterprise API / console only) | ❌ No documented endpoint (segmented assembly fallback) | ⚠️ High with custom metadata; medium stock | ✅ Yes (segmented per-turn fixed) |
| #11 Groq Orpheus | ⚠️ 6 English, 6 Saudi-Arabic voices | ❌ None documented | ❌ No (segmented assembly baseline) | ⚠️ Low; expressive bracket directions | ⚠️ Yes (segmented per-turn fixed; small stock pool) |
| #12 Kitten | ⚠️ 8 English voices | ❌ None documented | ❌ No (segmented assembly baseline) | ❌ Low; fixed local baseline | ⚠️ Yes (segmented per-turn fixed; 8 stock voices) |

## Implemented providers in detail

Providers are ranked below from #1 (highest overall capability and feature coverage for comic dialogue) to #12 (basic offline development baseline).

### #1. ElevenLabs

- **Repository today:** Phase 3 first-class advanced provider adapter. Exposes catalog discovery, protected Voice Design and remixing, Instant and Professional cloning, resource inspection and deletion, timestamped audio, and turn-safe native Text-to-Dialogue with prepared-text alignment, alongside segmented fallback.
- **Provider surface:** 10,000+ library voices, prompt-based Voice Design, Instant (short clip) and Professional (high-consistency) cloning, native Text-to-Dialogue.
- **Access constraints:** Library access requires paid plans; Professional cloning requires voice captcha verification. Preflight readiness validates access before dispatch.
- **Character fit:** Broadest managed casting platform for fictional, stock, and cloned character identities across languages and accents.
- **Status:** Integrated and working (Phases 0 & 3).

### #2. Hume Octave

- **Repository today:** Phase 3 first-class advanced provider adapter. Exposes library catalog discovery, protected Voice Design (Octave 1 design saved for Octave 2 synthesis), platform-gated clone state, deletion proof, per-utterance acting directions, 1–5 native utterance takes, word/phoneme timing, and continuation, alongside segmented fallback.
- **Provider surface:** 100+ library voices, prompt design, short-sample cloning, acting instructions, multi-utterance dialogue, continuation.
- **Character fit:** Premier option for dramatic comic dialogue with expressive acting control.
- **Status:** Integrated and working (Phases 0 & 3).

### #3. Cartesia

- **Repository today:** Phase 4 advanced capability adapter. Exposes public and account cursor catalogs, protected instant cloning, gated Pro Voice Clone state management, and lifecycle. Renders via explicit-voice segmented assembly.
- **Provider surface:** 500+ stock voices, 42 languages, instant (10s) and Pro (30m+) cloning, speed/volume/emotion controls.
- **Character fit:** Outstanding stock catalog breadth and dual clone tiers.
- **Status:** Integrated and working (Phases 0 & 4).

### #4. Deepgram Aura-2

- **Repository today:** Expanded in ADR-018 to the complete 91-voice Aura-2 catalog with explicit age, expressed gender, accent, language, and character metadata. Per-turn model switching repaired in Phase 0.
- **Provider surface:** ~90 Aura-2 voices across 7 languages, speed and pronunciation controls.
- **Character fit:** Best stock demographic casting database in the repository.
- **Status:** Integrated and working (Phases 0 & 018).

### #5. MiniMax

- **Repository today:** Phase 4 advanced capability adapter. Supports system and account catalog listing, temporary Voice Design, upload-and-clone activation state management, and typed deletion. Renders via explicit-voice segmented assembly.
- **Provider surface:** 300+ system voices, 40 languages, rapid cloning (10s–5m sample), prompt-based Voice Design.
- **Character fit:** High provider casting potential with expressive line delivery controls.
- **Status:** Integrated and working (Phases 0 & 4).

### #6. Speechify

- **Repository today:** Phase 4 advanced capability adapter. Corrected multipart consent, locale, and gender serialization. Exposes personal cursor catalogs, protected consent-bearing personal cloning, model-aware readiness, word timing, and lifecycle. Renders via explicit-voice segmented assembly.
- **Provider surface:** 8 curated Simba 3.2 English voices, 10–30s personal cloning with consent. Native dialogue endpoint marked unsupported due to API instability.
- **Character fit:** Useful for consenting actor reference cloning.
- **Status:** Integrated and working (Phases 0 & 4).

### #7. Mistral Voxtral TTS

- **Repository today:** Supports zero-shot reference audio and saved voice IDs. Phase 1 separated saved-voice creation to `voice` / `comic reference-voice` management; Phase 2 integrates authorized saved/reference voices into `comic generate-audio`.
- **Provider surface:** Zero-shot cloning from 2–3s audio, saved voices, 9 languages.
- **Character fit:** Fastest reference-audio route when actor clips exist.
- **Status:** Integrated and working (Phases 0, 1, & 2).

### #8. Gemini TTS

- **Repository today:** Supports 30 prebuilt voices and natural-language performance instructions. Enforces strict native two-speaker planning with turn-safe partitioning; scenes with >2 speakers automatically use segmented fallback.
- **Provider surface:** 30 prebuilt voices, ~70 languages, style/tone/accent instructions, native two-speaker synthesis.
- **Character fit:** First-choice stock native dialogue path for two-person scenes.
- **Status:** Integrated and working (Phases 0 & 2).

### #9. OpenAI

- **Repository today:** Refreshed to 13 built-in voices (alloy, ash, ballad, coral, echo, fable, onyx, nova, sage, shimmer, verse, marin, cedar) with repaired per-turn voice switching. Model snapshot refreshed to `gpt-4o-mini-tts-2025-12-15`.
- **Provider surface:** 13 stock voices, performance instructions on supported models, gated custom voices with consent.
- **Character fit:** Good stock coverage for small to medium casts.
- **Status:** Integrated and working (Phases 0 & 018).

### #10. xAI/Grok

- **Repository today:** Catalog refreshed in ADR-018 to 26 stock voices with repaired per-turn voice switching. Accepts existing custom voice IDs created via console.
- **Provider surface:** 26 stock voices, short-reference custom cloning (Enterprise API).
- **Character fit:** Medium stock catalog breadth; strong demographic metadata.
- **Status:** Integrated and working (Phases 0 & 018).

### #11. Groq Orpheus

- **Repository today:** Supports 6 English stock voices with repaired per-turn voice switching. Maps free-form bracketed delivery directions on English inputs.
- **Provider surface:** 6 English and 6 Saudi-Arabic voices across separate models.
- **Character fit:** Fast expressive stock option for small English casts.
- **Status:** Integrated and working (Phase 0).

### #12. KittenTTS

- **Repository today:** Supports 4 local model variants and 8 fixed English voices (Bella, Jasper, Luna, Bruno, Rosie, Hugo, Kiki, Leo). Per-turn voice switching was repaired in Phase 0. No-cost, offline local baseline.
- **Provider surface:** 8 fixed voices, speed control. No self-serve cloning or text design.
- **Character fit:** Private offline smoke tests and rough timing for small casts.
- **Status:** Integrated and working. Retained as no-cost local baseline.

## Upstream provider capabilities not supported in this repository

This section inventories real, existing features and endpoints provided by official provider APIs or SDKs that are not currently exposed or implemented in AutoShow. Unexposed capabilities are grouped into those relevant to script-to-audio dialogue generation and those outside the current workflow domain.

### Capabilities relevant to the script-to-audio workflow

These features exist in official provider APIs and directly relate to script delivery, casting, or voice discovery, but are not currently exposed in AutoShow:

- **Speechify native dialogue endpoint (`/v1/audio/dialogue`):** Speechify provides a multi-speaker dialogue endpoint upstream, but due to contract breaking changes and instability, AutoShow marks Speechify native dialogue unsupported and routes scenes through segmented assembly.
- **Cartesia prompt-based voice design & interactive candidate auditioning:** Cartesia offers an upstream text-prompt voice design endpoint (generating synthetic voice candidates from written descriptions), which AutoShow currently marks unsupported in its Cartesia adapter. Furthermore, while ElevenLabs, Hume, and MiniMax expose prompt-based voice design, AutoShow does not provide an interactive multi-candidate prompt audition CLI session.
- **Groq Orpheus bracketed vocal direction mapping:** Groq's English Orpheus model natively parses free-form bracketed acting directions (`[laughing]`, `[sighs]`, `[whispering]`), but AutoShow does not currently serialize comic delivery parentheticals into bracketed instructions.
- **Hume Octave phoneme and word-level timing alignment:** Hume's API returns granular phoneme and word-level timestamp alignments for multi-utterance dialogue, which AutoShow does not currently parse for line-level timeline synchronization.

### Capabilities outside the current script-to-audio workflow domain

These real upstream features belong to adjacent product domains (such as real-time interactive AI voice bots, audio dubbing, async document processing, or enterprise account administration) and fall outside the scope of AutoShow's text-to-speech script pipeline:

- **ElevenLabs community voice library search & discovery:** ElevenLabs hosts over 10,000+ searchable public community voices accessible via search and filter APIs. AutoShow supports consuming known Voice IDs, but does not provide an in-CLI catalog search or discovery surface.
- **Speech-to-Speech (Voice Conversion / Dubbing):** ElevenLabs and Cartesia offer speech-to-speech voice conversion endpoints upstream (converting a source audio recording into a target voice while preserving performance inflection and timing). AutoShow's pipeline is strictly text-to-speech / text-to-dialogue and does not process audio-to-audio voice conversion inputs.
- **Real-time streaming audio & bidirectional WebSockets:** Hume (EVI / WebSocket streaming), ElevenLabs, Cartesia, and Mistral support ultra-low-latency real-time chunked audio streaming. AutoShow requires complete static WAV/audio files for dialogue planning, timeline alignment, and mastering, so streaming response endpoints are not used.
- **Automated Professional Voice Clone (PVC) model training:** ElevenLabs and Cartesia offer high-consistency Professional Voice Cloning upstream (requiring 30+ minutes of studio audio, captcha verification, and custom model training cycles). AutoShow supports provisioning and consuming existing Pro Clone IDs, but does not execute or monitor long-running remote PVC model training jobs.
- **Long-form asynchronous document synthesis with webhooks:** MiniMax offers an async TTS endpoint upstream for long-form content (>10,000 characters) with callback webhooks. AutoShow uses bounded synchronous turn requests to maintain deterministic turn ordering and progress reporting.
- **Gated / Enterprise custom voice creation APIs:** OpenAI (Custom Voices requiring consent IDs and samples) and xAI (Enterprise API custom voice creation) offer custom voice creation APIs for eligible enterprise accounts. AutoShow accepts existing custom voice IDs created via provider dashboards, but does not automate Enterprise-tier voice creation flows.

## Important providers not currently integrated

This section evaluates the top three non-integrated cloud/hosted (SaaS) text-to-speech providers analyzed during strategic research, ranked by overall potential comic dialogue value.

### Non-integrated provider capability matrix

| Provider | Official identity breadth | Custom identity | Provider-native dialogue | Age/gender/accent suitability | Potential comic value / fit |
|---|---|---|---|---|---|
| #1 Inworld AI | ✅ 100+ pre-built character voices | ✅ Text voice design, instant & pro clone | ✅ Yes, Character Engine & Realtime TTS-2 | ✅ Excellent through emotion steering & prompts | ✅ Premier candidate for fictional character dialogue & steering |
| #2 Resemble AI | ⚠️ Custom-focused catalog | ✅ Voice Design, Rapid (10s) & Pro (10m+) clone | ❌ No native dialogue endpoint (segmented assembly candidate) | ✅ Excellent through voice design & prompt variants | ✅ High priority SaaS for fictional character creation |
| #3 LMNT | ✅ 30+ languages catalog | ✅ 5–10s instant voice cloning & prompt control | ❌ No native dialogue endpoint (segmented assembly candidate) | ✅ High through instant cloning & prompt steering | ✅ Fast low-latency voice cloning & synthesis |

### Top non-integrated providers in detail

### #1. Inworld AI

- **Provider surface:** Dedicated Character Engine and standalone Realtime TTS-2 API. Supports natural language steering (directing tone, emotion, and pace via text prompts), instant and professional voice cloning, text-prompt voice design, viseme/lipsync alignment, and WebSocket/REST synthesis across 100+ languages.
- **Character fit:** Premier hosted candidate for fictional comic character voice design, natural language emotion steering, and contextual dramatic performance.
- **Status:** Evaluated SaaS option; not integrated.

### #2. Resemble AI

- **Provider surface:** Rapid Clone (10s–3m) and Professional Clone (10–25m+) cover fast and trained cloning with explicit consent ledgers. Voice Design generates candidates from descriptions of age, gender, accent, tone, and style. Supports cross-language cloning, natural language variants, and watermarking.
- **Character fit:** High priority SaaS option when creating original character identities from written briefs or actor samples is required.
- **Status:** Evaluated SaaS option; not integrated.

### #3. LMNT

- **Provider surface:** High-performance hosted TTS platform featuring ultra-low latency (sub-200ms) with Python and TypeScript SDKs. Provides high-fidelity instant voice cloning from 5–10 seconds of reference audio, prompt control, and speech synthesis across 30+ languages.
- **Character fit:** High-value SaaS candidate for low-latency fast voice cloning and multi-language character synthesis.
- **Status:** Evaluated SaaS option; not integrated.

### Serverless open-weights platform options (Replicate, fal.ai, & DeepInfra)

Serverless AI platforms like Replicate, fal.ai, and DeepInfra host open-weights TTS models as pay-per-second microservices accessible via REST APIs or client SDKs (`replicate`, `fal-client`, DeepInfra REST API). DeepInfra is already integrated into AutoShow for OCR and STT workflows (`DEEPINFRA_API_KEY`), making it a low-friction architectural candidate for expanding into serverless open-weights TTS without introducing new credential infrastructure.

#### Open-weights model capability matrix

| Model / Surface | Host platform | Custom identity | Provider-native dialogue | Age/gender/accent suitability | Potential comic value / fit |
|---|---|---|---|---|---|
| Qwen3-TTS | Replicate / fal.ai / DeepInfra | ✅ Voice Design & 3s instant clone | ❌ No (segmented assembly candidate) | ✅ High through voice design & prompt steering | ✅ Dual-mode fictional character voice design & zero-shot cloning |
| F5-TTS | Replicate / fal.ai / DeepInfra | ✅ 3–10s zero-shot clone | ❌ No (segmented assembly candidate) | ✅ High through reference audio cloning | ✅ Fast cloud-hosted reference voice cloning without local GPU |
| Kokoro-82M | Replicate / fal.ai / DeepInfra | ❌ Stock catalog selection only | ❌ No (segmented assembly candidate) | ⚠️ Moderate stock voice selection | ⚡ High-speed, ultra-low-cost segmented turn assembly fallback |
| Coqui XTTS-v2 | Replicate / DeepInfra | ✅ 3s instant clone (17+ languages) | ❌ No (segmented assembly candidate) | ✅ High for multi-language reference cloning | ✅ Multilingual zero-shot reference voice cloning |
| Parler-TTS | Replicate | ✅ Attribute prompt control | ❌ No (segmented assembly candidate) | ✅ High through descriptive attribute controls | ✅ Attribute-directed stock character casting from written briefs |

#### Serverless open-weights models in detail

#### Qwen3-TTS (via Replicate / fal.ai / DeepInfra)

- **Provider surface:** Serverless API endpoints on Replicate, fal.ai, and DeepInfra. Supports prompt-based Voice Design (generating persistent fictional voices from text descriptions) and 3-second instant zero-shot voice cloning across 10 languages.
- **Character fit:** Dual-mode open-weights candidate for fictional comic character voice design and zero-shot actor reference cloning.
- **Status:** Evaluated serverless open-weights candidate; not integrated for TTS.

#### F5-TTS (via Replicate / fal.ai / DeepInfra)

- **Provider surface:** Non-autoregressive flow-matching TTS model hosted on Replicate (`x-lance/f5-tts`), fal.ai (`fal-ai/f5-tts`), and DeepInfra REST endpoints. Performs high-fidelity zero-shot voice cloning from 3–10 seconds of reference audio with natural speed and pitch control.
- **Character fit:** Fast cloud-hosted option for reference voice cloning without requiring local GPU infrastructure.
- **Status:** Evaluated serverless open-weights candidate; not integrated for TTS.

#### Kokoro-82M (via Replicate / fal.ai / DeepInfra)

- **Provider surface:** Ultra-lightweight (82M parameter) open-weights model based on StyleTTS2 hosted on Replicate (`jaaari/kokoro-82m`), fal.ai (`fal-ai/kokoro`), and DeepInfra endpoints. Provides ultra-fast execution and extremely low cost for multi-voice stock synthesis.
- **Character fit:** High-speed, budget-friendly cloud fallback for segmented turn assembly when instant cloning or voice design is not required.
- **Status:** Evaluated serverless open-weights candidate; not integrated for TTS.

#### Coqui XTTS-v2 (via Replicate / DeepInfra)

- **Provider surface:** Multilingual zero-shot voice cloning model hosted on Replicate (`lucataco/xtts-v2`) and DeepInfra API. Synthesizes speech in 17+ languages using a 3-second reference audio clip.
- **Character fit:** Proven option for multi-language zero-shot reference voice cloning.
- **Status:** Evaluated serverless open-weights candidate; not integrated for TTS.

#### Parler-TTS (via Replicate)

- **Provider surface:** Controllable speech model hosted on Replicate (`cjwbw/parler-tts`). Generates speech where speaker attributes (gender, age, pitch, speaking rate, acoustic environment) are directed via text descriptions.
- **Character fit:** Useful for casting specific stock character attributes directly from written scene descriptions.
- **Status:** Evaluated serverless open-weights candidate; not integrated for TTS.

## Which options can cover age, gender, and accent?

| Need | Best integrated options | Complementary non-integrated options | Why |
|---|---|---|---|
| Largest managed stock search | ElevenLabs, Cartesia | LMNT, Kokoro-82M | Thousands of selectable catalog identities with search metadata |
| Most structured stock demographic casting | Deepgram, Cartesia, Speechify, xAI, OpenAI | Inworld AI | Explicit age, expressed gender, accent, language, and locale metadata |
| Fictional identity from a written brief | ElevenLabs, Hume, MiniMax | Inworld AI, Resemble AI, Qwen3-TTS, Parler-TTS | Voice Design generates new identities from descriptive prompts |
| Identity from an approved actor reference | ElevenLabs, Mistral, MiniMax, Speechify, Hume, Cartesia, xAI | Resemble AI, Inworld AI, LMNT, F5-TTS, Qwen3-TTS, XTTS-v2 | Clone and reference workflows preserve performer timbre and accent |
| Native contextual dialogue | Gemini (2 speakers), ElevenLabs, Hume | Inworld AI | Shared request context optimizes conversational flow |
| Local / private voice synthesis | Kitten | None (Kitten is sole local baseline) | Offline execution without sending source audio to external APIs |

## Implemented comic voice architecture

The script-to-audio subsystem implemented in ADR-020 comprises seven core architectural pillars:

### 1. Separation of voice brief and provider registration

Character voice briefs (`CharacterVoiceBrief`) are provider-neutral records keyed by canonical `CharacterKey`. Provider registrations are separate model-qualified records (`(subject, provider, provider model, profile)`) stored in an append-only registry.

### 2. Dedicated reference voice command

The `comic reference-voice` command (and shared `voice` alias) handles candidate creation/import, materialization, canonical audition generation, and explicit local approval (`approveRegistration`). It promotes registrations only after audition artifacts succeed.

### 3. Source-linked dialogue planning

`comic generate-audio` builds a reviewable `ComicDialoguePlan` from `structured-script.json` (v4). Each turn preserves `sourceSegmentId`, `beatIndex`, canonical `characterKey` or role, original speaker label, normalized text, delivery notes, audio effect state, and timing cues.

### 4. Immutable scene voice snapshots

Preflight validates target readiness, model compatibility, provider access, resource existence, and consent records before any provider synthesis. An aggregate immutable voice snapshot is written into the scene run, binding the dialogue plan to exact voice generations.

### 5. Native and segmented rendering

Render strategy planning selects native dialogue (Gemini 2-speaker, ElevenLabs Text-to-Dialogue, Hume multi-utterance/continuation) when exact intent is representable, retaining a deterministic segmented fallback for scenes exceeding native limits or requiring line-level repairs.

### 6. Identity and content caching

Segment cache keys incorporate canonical text, source segment ID, delivery/effect settings, provider/model parameters, and immutable voice snapshot generation IDs, enabling targeted line repair without re-synthesizing unchanged dialogue.

### 7. Provider-qualified casting and benchmark keys

Characters are mapped to explicit provider-qualified registrations. Voice-quality benchmark results are keyed by adapter target + render + optional registration/snapshot/character identity.

## Delivery sequence status

- **Phase 0 — Baseline behavior repair (Complete 2026-08-11):** Repaired per-turn voice dispatch across all 12 adapters; added A/B/A serializer contract tests; restricted Gemini native dialogue to two speakers; bounded hosted concurrency; refreshed Deepgram, xAI, Gemini, Groq, OpenAI catalogs.
- **Phase 1 — Reference voice management (Complete 2026-08-11):** Delivered `voice` and `comic reference-voice` commands, protected store, briefs, candidates, canonical auditions, approval index, and resource deletion.
- **Phase 2 — Multi-speaker script-to-audio (Complete 2026-08-11):** Delivered `comic generate-audio`, `structured-script.json` v4, `ComicDialoguePlan`, immutable scene voice snapshots, WAV mastering, and operation-scoped resume.
- **Phase 3 — ElevenLabs & Hume advanced adapters (Complete 2026-08-11):** Delivered first-class ElevenLabs (Voice Design, Text-to-Dialogue, timestamps) and Hume (acting instructions, multi-utterance, continuation) capability adapters.
- **Phase 4 — MiniMax, Cartesia, & Speechify advanced adapters (Complete 2026-08-11):** Delivered MiniMax, Cartesia, and Speechify capability adapters, fixed Speechify multipart serialization, added all-provider preflight readiness, and updated benchmark identity.

## Recommended provider choices by use case

| Goal | Recommended primary option | Alternative option | Reason |
|---|---|---|---|
| Reference-audio character synthesis | Mistral | ElevenLabs / Speechify | Fast zero-shot cloning from short reference audio clips |
| Two-character stock native dialogue | Gemini | Hume Octave | Native two-speaker synthesis with natural language style direction |
| Comprehensive managed casting | ElevenLabs | Hume Octave | Vast voice library, prompt design, instant/pro cloning, native dialogue |
| Dramatic expressive acting & dialogue | Hume Octave | ElevenLabs | Line-level acting instructions, multi-utterance context, continuation |
| Stock demographic casting | Deepgram Aura-2 | Cartesia | 91 Aura-2 voices with structured age, gender, accent, and language metadata |
| No-cost offline development baseline | Kitten | None (Kitten is sole local baseline) | Fast, local execution requiring no external API calls |

## Consent, rights, and provenance requirements

Custom voice support creates operational requirements enforced by the `voice` management system:

- Provenance records track source ownership, performer consent, authorized scope, territory, and expiration conditions.
- Provider consent IDs and recordings are stored in a protected store, disjoint from ordinary output directories.
- Synthetic TTS auditions are prohibited from being used as cloning input for another provider without explicit authorization.
- Remote resource lifecycle states (active, expired, deleted, pending approval) are tracked in provisioning journals.

## Final recommendation

The completion of ADR-020 establishes a provider-neutral script-to-audio architecture in AutoShow. By decoupling authored character briefs from provider-specific voice registrations and maintaining native and segmented execution strategies, AutoShow achieves reviewable, reproducible, and portable comic dialogue synthesis across 12 integrated TTS providers.

## Verification and research notes

- Implementation details were verified against ADR-020 and repository source files on 2026-08-11.
- All 12 provider adapters pass local no-network contract tests (`bun run check`, `tts-advanced-provider-phase-3.test.ts`, `tts-advanced-provider-phase-4.test.ts`).
- External capability claims reflect provider documentation verified on assessment dates.
