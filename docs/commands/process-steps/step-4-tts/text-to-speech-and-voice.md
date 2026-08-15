# tts and voice

Generate speech audio from a local `.md` or `.txt` file with local or hosted TTS providers, and manage durable provider voice references separately from speech synthesis. The comic-native `comic reference-voice` command delegates to the same voice implementation and protected store.

## Outline

- [Setup](#setup)
  - [Environment](#environment)
- [Usage](#usage)
- [Shared TTS Options](#shared-tts-options)
- [TTS Services](#tts-services)
  - [Kitten TTS](#kitten-tts)
  - [ElevenLabs](#elevenlabs)
  - [MiniMax](#minimax)
  - [Groq](#groq)
  - [Grok](#grok)
  - [Mistral](#mistral)
  - [OpenAI](#openai)
  - [Gemini](#gemini)
  - [Deepgram](#deepgram)
  - [Speechify](#speechify)
  - [Hume](#hume)
  - [Cartesia](#cartesia)
  - [Fish](#fish)
  - [Inworld](#inworld)
  - [DeepInfra](#deepinfra)
  - [Replicate](#replicate)
  - [fal.ai](#falai)
- [Pricing Notes](#pricing-notes)
- [Output](#output)
- [Voice](#voice)
  - [Voice Usage](#voice-usage)
  - [Typical Flow](#typical-flow)
  - [Lifecycle](#lifecycle)
  - [Protected and Ordinary Artifacts](#protected-and-ordinary-artifacts)
  - [Voice Price Safety](#voice-price-safety)
- [Provider Capabilities](#provider-capabilities)
  - [Advanced](#advanced)
  - [Cloning and Stock Voices](#cloning-and-stock-voices)
  - [Stock Voices](#stock-voices)

## Setup

```bash
# full setup
bun autoshow setup

# install Kitten TTS, download local models, and check hosted TTS readiness
bun autoshow setup --step tts
```

Local TTS runtime pieces:

- Kitten TTS venv under `runtime/bin/kitten-tts/`
- Downloaded model cache created by Kitten TTS

### Environment

Hosted providers require API keys set in environment variables:

```bash
OPENAI_API_KEY=...
GEMINI_API_KEY=...
GROQ_API_KEY=...
XAI_API_KEY=...
ELEVENLABS_API_KEY=...
MINIMAX_API_KEY=...
DEEPGRAM_API_KEY=...
MISTRAL_API_KEY=...
SPEECHIFY_API_KEY=...
HUME_API_KEY=...
CARTESIA_API_KEY=...
FISH_API_KEY=...
INWORLD_API_KEY=...
DEEPINFRA_API_KEY=...
REPLICATE_API_TOKEN=...
FAL_API_KEY=...
```

## Usage

```bash
bun autoshow tts <input> [flags]
```

`<input>` must be a local `.md` or `.txt` file. If no engine flag is provided, `tts` defaults to Kitten TTS with `kitten-tts-nano-0.8-int8`.

## Shared TTS Options

| Flag | Description |
|------|-------------|
| `--provider provider[=model]` | TTS provider/model selector; repeat to run multiple targets |
| `--all-providers` | Select the default all-provider TTS target set |
| `--all-local` | Select every local TTS engine |
| `--provider-concurrency <n>` | Hosted TTS provider/model targets to run concurrently per item; this does not limit chunks inside one target; default `7` |
| `--local-concurrency <n>` | Local TTS providers to run concurrently per item; default `7` |
| `--batch-concurrency <n>` | Batch text files to process concurrently; default `7` |
| `--concurrency-mode <ramp\|immediate>` | Start each hosted provider/account lane at one request and add one slot every five seconds while demand is queued (`ramp`, default), or start at its configured cap (`immediate`) |
| `--tts-voice <provider=value\|value>` | Generic TTS voice selector |
| `--tts-speed <provider=value\|value>` | Generic TTS speed |
| `--tts-language <provider=value\|value>` | Generic TTS language |
| `--tts-ref-audio <provider=path\|path>` | Explicit one-off Mistral reference input |
| `--tts-text-normalization <provider=value\|value>` | Generic text normalization |
| `--tts-instructions <provider=value\|value>` | Generic voice/style instructions |
| `--tts-output-format <provider=value\|value>` | Generic output format |
| `--tts-chunk-concurrency <n>` | Hosted TTS chunk starts allowed in parallel per provider; default `30` (or `50` for Grok-only) |
| `--tts-allow-ambiguous-redispatch` | Explicitly authorize bounded in-process retries and later repurchase when a paid request has ambiguous provider admission |
| `--tts-dialogue-format <screenplay\|labeled>` | Dialogue input format for multi-speaker TTS; requires `--tts-speaker` |
| `--tts-speaker SPEAKER=VOICE\|path` | Multi-speaker voice mapping; repeatable. Selects multi-speaker TTS |
| `--price` | Show the aggregated estimate and exit |
| `--output-dir <dir>` | Global flag: pin an exact run directory instead of a timestamped output directory |

You can combine multiple TTS targets in one run. `--provider` is repeatable. Shared voice flags apply to every selected model for that provider.

See [Provider Capabilities](#provider-capabilities) for the per-provider stock-voice, expansive-catalog, design, instant clone, native multi-speaker, natural-language prompt, specific-selector, and SSML/emotion-control matrix. Voice management is separate from synthesis. A catalog, design, or clone capability does not authorize `tts` or `comic generate-audio` to create a remote resource.

When a hosted target fails after producing some chunks, AutoShow retains the target's `.tts-tmp-*` workspace and completed audio files. Do not delete that directory before resuming: the render journal uses retained output evidence to avoid purchasing completed segments again. Successful finalization removes the temporary chunk files normally.

Paid requests with ambiguous admission are not retried by default. `--tts-allow-ambiguous-redispatch` explicitly authorizes a provider's bounded in-process retry policy and subsequent checkpoint resume; it may purchase the same immutable generation slot more than once. DeepInfra uses up to eight attempts with exponential jittered backoff. Every attempt is recorded in the admission journal, completed slots remain reusable, and an exhausted run reports the exact retained/unresolved checkpoint for the next invocation.

AutoShow generally splits TTS text into 2000-character chunks, with provider/model registry limits taking precedence: Groq Orpheus uses 200, DeepInfra MiMo uses 1000, DeepInfra Qwen uses 4000, and DeepInfra Chatterbox uses 5000. `--provider-concurrency` limits how many provider/model targets run at once; it does not limit requests within one target. Hosted providers synthesize through the separate `--tts-chunk-concurrency` limit (default `30`, or `50` for Grok-only). In the default ramp mode, that value remains the hard ceiling while each provider/account lane starts at one request and adds one slot every five seconds under queued demand. To cap a single Inworld target at five simultaneous chunks, for example, pass `--tts-chunk-concurrency 5`; `--provider-concurrency 5` alone does not do that. Kitten synthesizes chunks sequentially and is unaffected by the hosted mode.

The current Inworld selector is `realtime-tts-2`, serialized as provider ID `inworld-tts-2`. DeepInfra request fields are model-specific: Chatterbox Turbo uses `text` with optional `voice_id`, MiMo uses `text` plus `voice`, and Qwen uses `input` plus `voice`. Voice-design models use a narration description as the implicit voice when `--tts-voice` is omitted.

```bash
bun autoshow tts input/examples/tts/1-tts.md \
  --provider kitten=kitten-tts-mini \
  --provider openai=gpt-4o-mini-tts-2025-12-15 \
  --tts-voice alloy

bun autoshow tts input/examples/tts/1-tts.md --provider elevenlabs=eleven_v3
```

## TTS Services

### Kitten TTS

| Option | Value |
|--------|-------|
| Selector | `--provider kitten[=<model>]` |
| Models | `kitten-tts-mini`, `kitten-tts-micro`, `kitten-tts-nano`, `kitten-tts-nano-0.8-int8` |
| Voice | `--tts-voice <name>`, default `Jasper` |

```bash
bun autoshow tts input/examples/tts/1-tts.md
bun autoshow tts input/examples/tts/1-tts.md --provider kitten=kitten-tts-mini --tts-voice Luna
```

Kitten strips markdown, splits local text into 2000-character chunks, and synthesizes chunks sequentially in the local Python runtime.

### ElevenLabs

| Option | Value |
|--------|-------|
| Selector | `--provider elevenlabs[=<model>]` |
| Models | `eleven_v3` |
| Existing voice | `--tts-voice <id>`, default `hpp4J3VqNfWAUOO0d1Us` |
| Controls | `--tts-output-format`, `--tts-language`, `--elevenlabs-tts-stability`, `--elevenlabs-tts-similarity-boost`, `--elevenlabs-tts-style`, `--elevenlabs-tts-use-speaker-boost`, `--tts-speed`, `--elevenlabs-tts-seed`, `--tts-text-normalization`, `--elevenlabs-tts-pronunciation-dictionary-locator`, `--elevenlabs-tts-optimize-streaming-latency` |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider elevenlabs=eleven_v3 --tts-voice hpp4J3VqNfWAUOO0d1Us
```

ElevenLabs synthesis uses existing voices only. Single-voice text character limit is 5,000 for `eleven_v3`. Multi-speaker `eleven_v3` uses the timestamped Text-to-Dialogue endpoint when turn boundaries, voices (max 10), and documented v3 audio tags can be represented natively.

Use `voice discover` for catalogs, `voice design` for candidate generation, and `voice materialize` to register voices.

### MiniMax

| Option | Value |
|--------|-------|
| Selector | `--provider minimax[=<model>]` |
| Models | `speech-2.8-hd`, `speech-2.8-turbo` |
| Voice | `--tts-voice <id>`, default `English_expressive_narrator` |
| Controls | `--minimax-tts-language-boost`, `--tts-speed`, `--minimax-tts-volume`, `--minimax-tts-pitch`, `--minimax-tts-emotion`, `--tts-text-normalization`, `--minimax-tts-pronunciation` |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider minimax=speech-2.8-turbo --tts-voice English_expressive_narrator
bun autoshow tts input/examples/tts/1-tts.md --provider minimax=speech-2.8-hd --minimax-tts-language-boost English --tts-speed 1.15 --minimax-tts-emotion calm
bun autoshow tts input/examples/tts/1-tts.md --provider minimax=speech-2.8-turbo --tts-voice English_expressive_narrator --price
```

MiniMax TTS uses existing or preset voices and splits text into 2000-character chunks. Multi-speaker dialogue uses the segmented renderer.

### Groq

| Option | Value |
|--------|-------|
| Selector | `--provider groq[=<model>]` |
| Models | `canopylabs/orpheus-v1-english` |
| Voice | `--tts-voice <id>`; English voices `autumn`, `diana`, `hannah`, `austin`, `daniel`, `troy` (default `troy`) |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider groq=canopylabs/orpheus-v1-english --tts-voice troy
```

Groq voices are validated against the selected model. Text is split into 200-character chunks.

### Grok

| Option | Value |
|--------|-------|
| Selector | `--provider grok[=<model>]` |
| Models | `grok-tts` |
| Voice | `--tts-voice <id>`, default `eve`; built-ins `eve`, `ara`, `rex`, `sal`, `leo`, or 8-character custom voice ID |
| Language | `--tts-language <code>`, default `auto` |
| Text normalization | `--tts-text-normalization true` |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider grok=grok-tts --tts-voice eve
bun autoshow tts input/examples/tts/1-tts.md --provider grok=grok-tts --tts-voice ab12cd34 --tts-language ar-SA --tts-text-normalization true
```

Grok TTS text is split into 2000-character chunks.

### Mistral

| Option | Value |
|--------|-------|
| Selector | `--provider mistral[=<model>]` |
| Models | `voxtral-mini-tts-2603` |
| Voice source | Existing `--tts-voice <id>` or authorized one-off `--tts-ref-audio <path>` |
| Saved reference | Create separately with `voice save-reference` |
| Dialogue mode | `--tts-dialogue-format screenplay\|labeled` plus repeatable `--tts-speaker SPEAKER=path` |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider mistral=voxtral-mini-tts-2603 --tts-voice voice_abc123
bun autoshow voice save-reference hero --model voxtral-mini-tts-2603 --voice-name AutoShowAnthony --reference-audio input/examples/audio/anthony-voice.mp3 --authorization-ref release:hero --consent-ref protected-consent:v1:STORE:ASSET:SHA256 --provenance-ref project:casting --price
bun autoshow tts input/chat-and-duco.txt \
  --provider mistral=voxtral-mini-tts-2603 \
  --tts-dialogue-format screenplay \
  --tts-speaker DUCO=input/examples/audio/anthony-voice.mp3 \
  --tts-speaker CHAT=https://ajc.pics/autoshow/examples/1-audio.mp3
```

Mistral Voxtral TTS requires an existing voice ID or an authorized one-off local reference file. Saved reference voices are created via `voice save-reference`.

Dialogue mode uses `--tts-speaker SPEAKER=VOICE|path` and `--tts-dialogue-format`. Gemini, ElevenLabs `eleven_v3`, and Hume `octave-2` use native dialogue serializers when eligible; all other targets synthesize per-turn segments and concatenate them into `speech.wav`.

### OpenAI

| Option | Value |
|--------|-------|
| Selector | `--provider openai[=<model>]` |
| Models | `gpt-4o-mini-tts-2025-12-15` |
| Voice | `--tts-voice <id>`, default `alloy` |
| Controls | `--tts-instructions <text>` (`gpt-4o-mini-tts-2025-12-15` only), `--tts-speed <0.25..4>` |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider openai=gpt-4o-mini-tts-2025-12-15 --tts-voice alloy
bun autoshow tts input/examples/tts/1-tts.md --provider openai=gpt-4o-mini-tts-2025-12-15 --tts-instructions "Warm documentary narration" --tts-speed 1.1
```

### Gemini

| Option | Value |
|--------|-------|
| Selector | `--provider gemini[=<model>]` |
| Models | `gemini-3.1-flash-tts-preview` |
| Single voice | `--tts-voice <name>`, default `Kore` |
| Multispeaker | `--tts-dialogue-format labeled` plus repeatable `--tts-speaker SPEAKER=VOICE` |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider gemini=gemini-3.1-flash-tts-preview --tts-voice Kore

bun autoshow tts input/examples/tts/tts-dialogue.txt \
  --provider gemini=gemini-3.1-flash-tts-preview \
  --tts-dialogue-format labeled \
  --tts-speaker Host=Kore \
  --tts-speaker Guest=Puck
```

Gemini multispeaker mode uses native two-speaker synthesis when eligible. Explicit speaker labels (e.g. `Host:`, `Guest:`) in the input text match configured speaker names. Inline delivery tags like `[whispers]` are passed through unchanged.

### Deepgram

| Option | Value |
|--------|-------|
| Selector | `--provider deepgram[=<model>]` |
| Models | Aura 2 voice models listed by `bun autoshow tts --help`; default `aura-2-thalia-en` |
| Voice/model override | `--tts-voice <model>`, default selected model |
| Controls | `--deepgram-tts-container <container>`, `--deepgram-tts-bit-rate <bps>`, `--deepgram-tts-sample-rate <hz>`, `--tts-speed <0.5..2>` |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider deepgram=aura-2-thalia-en --tts-voice aura-2-andromeda-en
bun autoshow tts input/examples/tts/1-tts.md --provider deepgram=aura-2-thalia-en --deepgram-tts-container wav --deepgram-tts-sample-rate 24000
```

### Speechify

| Option | Value |
|--------|-------|
| Selector | `--provider speechify[=<model>]` |
| Models | `simba-3.2` |
| Voice | `--tts-voice <id>`, default `geffen_32` |
| Controls | `--tts-output-format mp3\|ogg\|aac\|wav\|pcm`, `--tts-language <tag>` |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider speechify=simba-3.2 --tts-voice geffen_32 --tts-language en-US --tts-output-format mp3
bun autoshow tts input/examples/tts/1-tts.md --provider speechify=simba-3.2 --tts-voice speechify_custom_voice_123
bun autoshow config --tts speechify=simba-3.2 --tts-voice speechify_custom_voice_123
```

Speechify TTS sends text chunks to `POST /v1/audio/speech` and converts the output to `speech.wav`. Input may be plain text or SSML; wrap SSML in `<speak>` to control pitch, rate, volume, pauses, emphasis, substitutions, and emotion via `<speechify:style emotion="...">`. Simba 3.2 is English-only with curated built-ins.

### Hume

| Option | Value |
|--------|-------|
| Selector | `--provider hume[=<model>]` |
| Models | `octave-1`, `octave-2` |
| Voice | `--tts-voice <name-or-id>`, default `Male English Actor` |
| Voice provider | `--hume-tts-voice-provider HUME_AI|CUSTOM_VOICE`, default `HUME_AI` |
| API settings | `HUME_API_KEY` |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider hume=octave-2
bun autoshow tts input/examples/tts/1-tts.md --provider hume=octave-2 --tts-voice "Male English Actor"
bun autoshow tts input/examples/tts/1-tts.md --provider hume=octave-2 --tts-voice 00000000-0000-4000-8000-000000000000
bun autoshow config --tts hume=octave-2 --tts-voice "Studio Voice" --hume-tts-voice-provider CUSTOM_VOICE
```

Single-voice Hume TTS uses Octave 2 via `POST /v0/tts/file`. Multi-speaker plans use ordered Octave 2 utterances via `POST /v0/tts`. Use `voice discover` to inspect Hume stock/custom voices.

### Cartesia

| Option | Value |
|--------|-------|
| Selector | `--provider cartesia[=<model>]` |
| Models | `sonic-3.5-2026-05-04` |
| Voice | `--tts-voice <voice-id>`, default `f786b574-daa5-4673-aa0c-cbe3e8534c02` |
| Language | `--tts-language <code>` |
| API settings | `CARTESIA_API_KEY` |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider cartesia=sonic-3.5-2026-05-04 --tts-voice f786b574-daa5-4673-aa0c-cbe3e8534c02
bun autoshow tts input/examples/tts/1-tts.md --provider cartesia=sonic-3.5-2026-05-04 --tts-language en
bun autoshow config --tts cartesia=sonic-3.5-2026-05-04 --tts-voice f786b574-daa5-4673-aa0c-cbe3e8534c02
```

Cartesia TTS uses `POST /tts/bytes` requesting 24000 Hz PCM WAV bytes converted to `speech.wav`. Text is split into 2000-character chunks. Transcripts may include SSML-like `<speed>`, `<volume>`, `<emotion>`, `<break>`, and `<spell>` tags plus `[laughter]`.

### Fish

| Option | Value |
|--------|-------|
| Selector | `--provider fish[=<model>]` |
| Models | `s2.1-pro` |
| Voice | `--tts-voice <id>`, default `7f92f8afb8ec43bf81429cc1c9199cb1` |
| API settings | `FISH_API_KEY` |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider fish=s2.1-pro
bun autoshow tts input/examples/tts/1-tts.md --provider fish=s2.1-pro --tts-voice 7f92f8afb8ec43bf81429cc1c9199cb1
bun autoshow tts input/examples/tts/1-tts.md --provider fish=s2.1-pro --tts-dialogue-format labeled --tts-speaker Host=VOICE_A --tts-speaker Guest=VOICE_B
```

Fish TTS converts output to `speech.wav`. Single-voice text is split into 2000-character chunks. `s2.1-pro` uses native multi-speaker dialogue with timestamped streaming when turn boundaries and voices can be represented natively. Voice Design is a `s2.1-pro` capability, not a separate synthesis selector: use `voice design --creation-model voice-design-1` for protected preview candidates, then `voice materialize` to register a selected voice. Use `voice discover` for catalogs.

### Inworld

| Option | Value |
|--------|-------|
| Selector | `--provider inworld[=<model>]` |
| Models | `realtime-tts-2` |
| Voice | `--tts-voice <id>`, default `voice_inworld_standard_en` |
| Controls | `--tts-instructions <text>` |
| API settings | `INWORLD_API_KEY` |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider inworld=realtime-tts-2
bun autoshow tts input/examples/tts/1-tts.md --provider inworld=realtime-tts-2 --tts-voice Dennis --tts-instructions "Sound reassuring"
bun autoshow tts input/examples/tts/1-tts.md --provider inworld=realtime-tts-2
```

Inworld selectors serialize as provider IDs `inworld-tts-2` and `inworld-tts-2-flash`. Text is split into 2000-character chunks. Steering via `--tts-instructions` is accepted on `realtime-tts-2` only; inline emotion and vocalization tags are preserved. Multi-speaker dialogue uses the segmented renderer. Use `voice discover` for system and account catalogs.

### DeepInfra

| Option | Value |
|--------|-------|
| Selector | `--provider deepinfra[=<model>]` |
| Models | `ResembleAI/chatterbox-turbo`, `XiaomiMiMo/MiMo-V2.5-tts`, `XiaomiMiMo/MiMo-V2.5-tts-voicedesign`, `Qwen/Qwen3-TTS`, `Qwen/Qwen3-TTS-VoiceDesign` |
| Voice | `--tts-voice <id>`; Chatterbox defaults to the provider stock voice, MiMo TTS defaults to `mimo_default`, Qwen TTS defaults to `Vivian`; VoiceDesign models use a narration description when `--tts-voice` is omitted |
| Controls | `--tts-instructions <text>` (MiMo TTS and Qwen TTS `instruct` only) |
| API settings | `DEEPINFRA_API_KEY` |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider deepinfra=ResembleAI/chatterbox-turbo
bun autoshow tts input/examples/tts/1-tts.md --provider deepinfra=Qwen/Qwen3-TTS --tts-voice Vivian --tts-instructions "Warm documentary narration"
bun autoshow tts input/examples/tts/1-tts.md --provider deepinfra=Qwen/Qwen3-TTS-VoiceDesign
```

DeepInfra request fields are model-specific: Chatterbox uses `text` with optional `voice_id`, MiMo uses `text` plus `voice`, and Qwen uses `input` plus `voice`. Registry chunk limits take precedence over the 2000-character default: MiMo uses 1000, Qwen uses 4000, and Chatterbox uses 5000. Paid requests with ambiguous admission are not retried unless `--tts-allow-ambiguous-redispatch` is set. Multi-speaker dialogue uses the segmented renderer. Use `voice discover`, `voice design`, and `voice materialize` for account catalog and VoiceDesign flows.

### Replicate

| Option | Value |
|--------|-------|
| Selector | `--provider replicate[=<model>]` |
| Models | `jaaari/kokoro-82m` |
| Voice | `--tts-voice <name>`, default `af_bella`; validated Kokoro stock voices only |
| Controls | `--tts-speed <0.1..5>` |
| API settings | `REPLICATE_API_TOKEN` |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider replicate=jaaari/kokoro-82m
bun autoshow tts input/examples/tts/1-tts.md --provider replicate=jaaari/kokoro-82m --tts-voice am_adam --tts-speed 1.1
```

Replicate TTS uses the version-pinned Kokoro stock-voice target and converts output to `speech.wav`. Text is split into 2000-character chunks. Multi-speaker dialogue uses the segmented renderer. Reference-audio clone models are not exposed; there is no voice-management port.

### fal.ai

| Option | Value |
|--------|-------|
| Selector | `--provider fal[=<model>]` |
| Models | `fal-ai/bytedance/seed-speech/tts/v2`, `fal-ai/maya`, `async/tts-pro/v1.0` |
| Voice | `--tts-voice <id-or-description>`; Seed defaults to `stokie_en`, Async defaults to `Jennie`, Maya uses a narrator description when omitted |
| Controls | `--tts-instructions <text>` (Seed `voice_instruction` or Maya voice-description prompt) |
| API settings | `FAL_API_KEY` |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider fal=fal-ai/bytedance/seed-speech/tts/v2 --tts-voice stokie_en --tts-instructions "Speak in a warm, cheerful tone."
bun autoshow tts input/examples/tts/1-tts.md --provider fal=fal-ai/maya --tts-instructions "Realistic male voice in the 30s with american accent."
bun autoshow tts input/examples/tts/1-tts.md --provider fal=async/tts-pro/v1.0 --tts-voice Jennie
```

fal.ai TTS submits to the queue API and converts output to `speech.wav`. Text is split into 2000-character chunks. Multi-speaker dialogue uses the segmented renderer. There is no voice-management port.

## Pricing Notes

The registry contains 115 active TTS selectors: 111 hosted selectors and 4 local Kitten models. This table ranks every selector by the registry's nominal price. Character-priced entries show the equivalent rate per 1K characters; Replicate is separately marked because its published figure is a variable typical per-prediction cost rather than a character tariff. Provider credits, taxes, volume discounts, and retry variance are excluded.

| Rank | Nominal price | Selectors | Count |
|---:|---:|---|---:|
| 1 | Free locally | `kitten/kitten-tts-mini`, `kitten/kitten-tts-micro`, `kitten/kitten-tts-nano`, `kitten/kitten-tts-nano-0.8-int8` | 4 |
| 1 | Promotional `$0.00` / 1K chars | `deepinfra/XiaomiMiMo/MiMo-V2.5-tts`, `deepinfra/XiaomiMiMo/MiMo-V2.5-tts-voicedesign` | 2 |
| 2 | About `$0.00022` / prediction | `replicate/jaaari/kokoro-82m` | 1 |
| 3 | `$0.001` / 1K chars | `deepinfra/ResembleAI/chatterbox-turbo` | 1 |
| 4 | `$0.01` / 1K chars | `speechify/simba-3.2` | 1 |
| 5 | `$0.0126` / 1K chars | `openai/gpt-4o-mini-tts-2025-12-15` (`$0.0006` input + `$0.012` output) | 1 |
| 6 | `$0.015` / 1K chars | `fish/s2.1-pro`, `grok/grok-tts` | 2 |
| 7 | `$0.016` / 1K output chars | `mistral/voxtral-mini-tts-2603` | 1 |
| 8 | `$0.02` / 1K chars | `deepinfra/Qwen/Qwen3-TTS`, `deepinfra/Qwen/Qwen3-TTS-VoiceDesign` | 2 |
| 9 | `$0.021` / 1K chars | `gemini/gemini-3.1-flash-tts-preview` (`$0.001` input + `$0.02` output) | 1 |
| 10 | `$0.022` / 1K chars | `groq/canopylabs/orpheus-v1-english` | 1 |
| 11 | `$0.025` / 1K chars | `inworld/realtime-tts-2` | 1 |
| 12 | `$0.03` / 1K chars | All 91 active `deepgram/aura-2-*` voice-model selectors listed by `bun autoshow tts --help` | 91 |
| 13 | `$0.037375` / 1K chars | `cartesia/sonic-3.5-2026-05-04` | 1 |
| 14 | `$0.06` / 1K chars | `minimax/speech-2.8-turbo` | 1 |
| 15 | `$0.10` / 1K chars | `elevenlabs/eleven_v3`, `minimax/speech-2.8-hd` | 2 |
| 16 | `$0.15` / 1K chars | `hume/octave-1`, `hume/octave-2` | 2 |

## Output

- Single-target runs write `speech.wav` and `manifest.json`.
- Multi-target runs write `speech-<service>-<sanitized-model>.wav` per successful target and `manifest.json`.
- Dialogue runs write `dialogue-normalized.txt`. Segmented runs retain per-turn WAVs under `segments/`.
- Managed/custom voice runs record the resource ID, voice name, or reference tag as `speaker` in metadata.
- `manifest.json` records metadata including `tts` targets array, `cost`, and `timing`.
- `--output-dir` sets the output directory; output filenames remain provider-deterministic.

## Voice

Manage durable provider voice references separately from speech synthesis. The comic-native `comic reference-voice` command delegates to the same implementation and protected store.

### Voice Usage

```bash
bun autoshow voice <action> [identity] [flags]
bun autoshow comic reference-voice <action> [identity] [flags]
```

Available actions are `consent`, `revoke-consent`, `discover`, `import`, `design`, `materialize`, `save-reference`, `audition`, `approve`, `inspect`, `reconcile`, `retire`, `revoke`, `delete`, and `status`. Run `bun autoshow voice <action> --help` for the exact action flags.

Voice management reads authored profiles from `input/characters/character-voices.json`. Profiles are independent of the visual character catalog. A minimal catalog is:

```json
{
  "schemaVersion": 1,
  "briefs": [
    {
      "subjectKey": "hero",
      "profileKey": "default",
      "language": "en",
      "locale": "en-US",
      "timbre": "warm and grounded",
      "mannerisms": [],
      "prohibitedCaricatures": [],
      "pronunciations": [],
      "allowedOrigins": ["provider-stock", "saved-reference"]
    }
  ]
}
```

### Typical Flow

Register an existing provider voice without making a provider call:

```bash
bun autoshow voice import hero --provider openai --model gpt-4o-mini-tts-2025-12-15 --voice-id cedar --origin provider-stock --provenance-ref project:casting
```

ElevenLabs, Hume, MiniMax, Cartesia, Fish, Speechify, Inworld, and DeepInfra expose read-only catalog discovery through the same shared command. `--price` validates the operation and reports the dated capability fixture without reading the provider:

```bash
bun autoshow voice discover --provider elevenlabs --source account
bun autoshow voice discover --provider elevenlabs --source shared-library --cursor OPAQUE_CURSOR
bun autoshow voice discover --provider hume --source provider-library
bun autoshow voice discover --provider hume --source account --price
bun autoshow voice discover --provider minimax --source account
bun autoshow voice discover --provider cartesia --source provider-library --cursor OPAQUE_CURSOR
bun autoshow voice discover --provider fish --source account --price
bun autoshow voice discover --provider speechify --source account --price
bun autoshow voice discover --provider deepinfra --source account --price
```

Advanced Voice Design is a two-step operation for ElevenLabs, Hume, MiniMax, Fish, Inworld, and DeepInfra. `design` creates a bounded set of protected, unapproved candidates; `materialize` creates exactly one selected provider resource through the crash-safe provisioning journal and appends a draft registration. Hume designs with Octave 1 even when the materialized voice will synthesize with Octave 2. ElevenLabs remix requires both the stable source ID and a dated eligibility snapshot hash before any provider call. MiniMax returns one candidate whose remote ID remains temporary until first successful synthesis and expires after seven days if it is not activated. Fish and DeepInfra design are request-time inference, so materialization resolves the selected protected preview and supplies those exact non-empty bytes to the documented create-voice endpoint; a candidate ID alone is never treated as a remote voice:

```bash
bun autoshow voice design hero --provider hume --model octave-2 --creation-model octave-1 --description "Warm, weathered guide" --preview-text "A representative passage of at least one hundred characters that exercises the intended voice..." --candidates 3 --price
bun autoshow voice design hero --provider elevenlabs --model eleven_v3 --creation-model eleven_ttv_v3 --description "Warm, weathered guide" --preview-text "A representative passage of at least one hundred characters that exercises the intended voice..." --price
bun autoshow voice design hero --provider minimax --model speech-2.8-hd --creation-model voice-design --description "Warm, weathered guide" --preview-text "A short representative passage." --candidates 1 --price
bun autoshow voice design hero --provider fish --model s2.1-pro --creation-model voice-design-1 --description "Warm, weathered guide" --preview-text "A short representative passage." --candidates 1 --price
bun autoshow voice design hero --provider deepinfra --model Qwen/Qwen3-TTS --creation-model Qwen/Qwen3-TTS-VoiceDesign --description "Warm, weathered guide" --preview-text "A short representative passage." --candidates 1 --price
bun autoshow voice materialize CANDIDATE_ID --provider hume --subject-key hero --voice-name HeroGuide --provenance-ref project:casting --price
```

Remove `--price` from `design` only when you intend to purchase provider previews. Candidate audio stays in the owner-only protected store. Remove `--price` from `materialize` only after selecting one candidate and intending to create its remote voice. A materialized registration must still pass the canonical audition and explicit local approval flow below before comic rendering can use it.

For a consent-bound reference, first store an explicit per-action consent record. Omitted actions default to denied, and contact PII must not be used as the actor or provenance reference:

```bash
bun autoshow voice consent hero --provenance-ref release:hero-v1 --allow upload,new-synthesis,retention,deletion --actor-id casting_editor
```

The command prints an opaque `protected-consent:v1:...` locator. Use that locator when planning or explicitly executing Mistral saved-reference provisioning:

```bash
bun autoshow voice save-reference hero --model voxtral-mini-tts-2603 --voice-name HeroReference --reference-audio input/voices/hero.wav --authorization-ref release:hero-v1 --consent-ref protected-consent:v1:STORE:ASSET:SHA256 --provenance-ref project:casting --price
```

Remove `--price` only when you intend to execute the provider mutation. A provisioning journal is written before dispatch, records issued provider resources before the terminal outcome, and never automatically repeats an ambiguous create. Use `voice reconcile` with the pending registration generation after an interrupted request.

Consent records are immutable and content-addressed. Revoke one by appending a protected marker; the original locator then fails every consent gate:

```bash
bun autoshow voice revoke-consent protected-consent:v1:STORE:ASSET:SHA256 --reason "Authorization withdrawn" --actor-id casting_editor
```

Auditioning synthesizes a protected canonical set containing neutral, representative, emotional contrast, pronunciation, and comparison passages. It is a provider-backed action unless `--price` is supplied:

```bash
bun autoshow voice audition vr_ID --generation-id GENERATION_SHA256 --representative-line "We leave at dawn." --takes 1 --price
bun autoshow voice approve vr_ID --generation-id AUDITIONED_GENERATION_SHA256 --actor-id casting_editor
```

Approval appends a new content-identified registration generation and atomically advances the sole current pointer for `(subject, provider, provider model, profile)`. This model-qualified key permits one subject to hold independent approved Hume Octave 1 and Octave 2 selections that refer to the same provider voice resource. Approval does not create a scene snapshot.

### Lifecycle

`retire` and `revoke` are local append-preserving transitions that remove the exact approved generation from the current index. Revocation records a reason and moves protected assets to `deletion-required` when the registration policy requires it; it does not silently delete remote resources.

`inspect` performs a read-only provider check for ready ElevenLabs, Hume, MiniMax, Cartesia, Fish, Speechify, Inworld, DeepInfra, and Mistral account resources unless `--price` is supplied. MiniMax designed and cloned voices remain pending until activation makes them visible in the account catalog. Expired, missing, pending, or verification-required resources never become synthesis-ready merely because a local registration exists.

`delete` is an explicit provider-mutating action for eligibility-checked, project-owned Mistral, ElevenLabs, Hume, MiniMax, Cartesia, Fish, Speechify, Inworld, and DeepInfra resources and requires `--confirm-voice-id` to equal the exact resource ID. A resource cannot be deleted while another current model-qualified registration shares its provider/resource identity. Hume's endpoint deletes by mutable name, so Hume additionally requires `--expected-name`; AutoShow immediately refreshes the custom catalog and proceeds only when that name resolves uniquely to the expected ID. MiniMax deletion selects the clone or generated-voice resource class from the registered origin. Cartesia, Fish, and Speechify delete only project-owned account/personal resources. AutoShow first appends a local `deletion-pending` generation, then records a terminal deleted tombstone after the provider confirms deletion.

### Protected and Ordinary Artifacts

Protected reference, preview, audition, consent, and reconciliation bytes live under the registered owner-only runtime store. Policies are content-addressed, workspaces are disposable, and the protected root must be disjoint from ordinary output roots.

Ordinary character artifacts contain only strict versioned metadata and opaque protected-asset locators:

- `input/characters/character-voices.json`
- `input/characters/character-voice-registrations.json`
- `input/characters/character-voice-current.json`
- `input/characters/voice-candidates/<candidate-id>.json`
- `input/characters/voice-references/<subject>/<provider>/<registration>/<generation>/registration-snapshot.json`
- `input/characters/voice-references/<subject>/<provider>/<registration>/<generation>/audition-manifest.json`

Registration and audition generations are create-only and content-identified. The catalog preserves every prior generation; the current index contains only approved, ready registrations.

### Voice Price Safety

Management `--price` modes perform local validation and estimate only. They make no provider calls and write neither protected nor ordinary artifacts. Voice Design reports a numeric preview estimate from the exact provider, creation model, character count, and candidate count; ElevenLabs charges its preview text once while Hume charges it for each requested candidate. Materialization reports zero estimated provider cost because the supported design flows include saving the selected resource. Ordinary `tts`, `write`, resume, configuration loading, and synthesis price paths cannot express provider resource creation.

Provider prices and eligibility can change. Treat the estimate as a preflight derived from AutoShow's dated pricing configuration and use the provider console when account-specific terms matter.

## Provider Capabilities

Delivery control is split into natural-language prompts, request-level specific selectors, and in-text SSML or emotion markup.

### Advanced

| Provider | Released | Expansive catalog | Design | Instant clone | Native multi-speaker | Natural-language prompts | Specific selectors | SSML and emotion control |
|---|---|---|---|---|---|---|---|---|
| ElevenLabs `eleven_v3` | ⚠️ 2025-06-03 | ✅ 10,000+ Voice Library plus account voices | ✅ Design and eligibility-proved remix | ✅ Instant clone from protected samples | ⚠️ Text-to-Dialogue when the plan is exactly representable | ❌ Not exposed | ✅ Style exaggeration, stability, and similarity | ✅ v3 audio tags such as `[whispers]` and `[laughs]`, plus `/IPA/` pronunciation; no SSML `<break>` |
| Inworld `realtime-tts-2` | ✅ 2026-05-05 | ⚠️ System and account voices via non-paginated `voice discover` | ✅ Prompt design plus publish of one selected preview | ✅ Instant clone from protected samples | ❌ No; segmented rendering | ✅ Request-level `instruction` steering | ❌ Not exposed | ✅ Preserved inline emotion and vocalization tags such as `[happy]`, `[laugh]`, and `[breathe]` |
| Fish `s2.1-pro` | ✅ 2026-08-15 | ✅ Thousands of public and account voice models via paginated `voice discover` | ✅ Stateless protected preview followed by exact-sample model creation | ✅ Instant fast model creation from protected samples | ✅ Native multi-speaker dialogue with timestamped streaming | ❌ Not exposed | ❌ Not exposed | ✅ In-text `[emotion]` and delivery markup on dialogue and eligible vocal reactions |
| fal.ai `fal-ai/maya` | ⚠️ 2025-10-18 | ❌ Not exposed | ✅ Per-request voice-description prompt | ❌ Not exposed | ❌ No; segmented rendering | ✅ Voice-description prompt | ❌ Not exposed | ✅ In-text emotion tags such as `<excited>` and `<laugh>` |
| Cartesia `sonic-3.5-2026-05-04` | ✅ 2026-05-04 | ✅ Hundreds of public and account voices via paginated `voice discover` | ❌ Not exposed | ✅ Instant API clone | ❌ No; segmented rendering | ❌ Not exposed | ❌ Not exposed | ✅ SSML-like `<speed>`, `<volume>`, `<emotion>`, `<break>`, and `<spell>` plus `[laughter]` |
| Speechify `simba-3.2` | ✅ 2026-07-08 | ✅ Hundreds of shared and personal voices via paginated `voice discover` | ❌ Not exposed | ✅ Personal voice clone with protected 10–30 second sample and consent payload | ❌ No; segmented rendering | ❌ Not exposed | ❌ Not exposed | ✅ SSML `<speak>` with `<prosody>`, `<break>`, `<emphasis>`, `<sub>`, and `<speechify:style emotion="...">` (13 emotions) |

### Advanced Runner Ups

| Provider | Released | Expansive catalog | Design | Instant clone | Native multi-speaker | Natural-language prompts | Specific selectors | SSML and emotion control |
|---|---|---|---|---|---|---|---|---|
| MiniMax `speech-2.8-hd` | ✅ 2026-01-23 | ⚠️ System, generated, and cloned voices via `voice discover` | ⚠️ One temporary generated candidate | ✅ One protected mp3/m4a/wav sample, 10 seconds–5 minutes and no larger than 20 MiB, through upload and clone APIs | ❌ No; segmented rendering | ❌ Not exposed | ✅ Explicit emotion selectors (happy, sad, angry, etc.), pitch, and volume | ✅ Pause markers `<#x#>` and interjection tags such as `(laughs)` and `(sighs)` |
| MiniMax `speech-2.8-turbo` | ✅ 2026-01-23 | ⚠️ System, generated, and cloned voices via `voice discover` | ⚠️ One temporary generated candidate | ✅ One protected mp3/m4a/wav sample, 10 seconds–5 minutes and no larger than 20 MiB, through upload and clone APIs | ❌ No; segmented rendering | ❌ Not exposed | ✅ Explicit emotion selectors (happy, sad, angry, etc.), pitch, and volume | ✅ Pause markers `<#x#>` and interjection tags such as `(laughs)` and `(sighs)` |
| Hume `octave-1` | ❌ 2025-02-26 | ⚠️ Paginated stock and custom account voices via `voice discover` | ✅ Octave 1 design, compatible with Octave 1/2 synthesis | ❌ Not exposed | ❌ No; segmented rendering | ✅ Natural-language acting description and tone prompts | ❌ Not exposed | ⚠️ In-text `[pause]` and `[long pause]` |
| Hume `octave-2` | ⚠️ 2025-10-01 | ⚠️ Paginated stock and custom account voices via `voice discover` | ✅ Octave 1 design, compatible with Octave 1/2 synthesis | ❌ Not exposed | ✅ Native utterances | ❌ Not exposed | ❌ Not exposed | ⚠️ In-text `[pause]` and `[long pause]` |

### Voice Cloning and Design without Expressiveness

| Provider | Released | Expansive catalog | Design | Instant clone | Native multi-speaker | Natural-language prompts | Specific selectors | SSML and emotion control |
|---|---|---|---|---|---|---|---|---|
| DeepInfra `ResembleAI/chatterbox-turbo` | ⚠️ 2025-12-02 | ❌ Not exposed | ❌ Not exposed | ✅ Instant create from protected samples via `POST /v1/voices/add` | ❌ No; segmented rendering | ❌ Not exposed | ❌ Not exposed | ❌ Not exposed |
| DeepInfra `Qwen/Qwen3-TTS` | ✅ 2026-01-21 | ❌ Not exposed | ❌ Not exposed | ✅ Instant create from protected samples via `POST /v1/voices/add` | ❌ No; segmented rendering | ✅ `instruct` | ❌ Not exposed | ❌ Not exposed |
| DeepInfra `XiaomiMiMo/MiMo-V2.5-tts-voicedesign` | ✅ 2026-04-27 | ❌ Not exposed | ✅ Request-time VoiceDesign; materialized voices are account-owned via `GET /v1/voices` | ❌ Not exposed | ❌ No; segmented rendering | ❌ Not exposed | ❌ Not exposed | ❌ Not exposed |
| DeepInfra `Qwen/Qwen3-TTS-VoiceDesign` | ✅ 2026-01-21 | ❌ Not exposed | ✅ Request-time VoiceDesign; materialized voices are account-owned via `GET /v1/voices` | ❌ Not exposed | ❌ No; segmented rendering | ❌ Not exposed | ❌ Not exposed | ❌ Not exposed |
| Mistral `voxtral-mini-tts-2603` | ✅ 2026-03-23 | ❌ Not exposed | ❌ Not exposed | ✅ Project-owned saved-reference voice from a protected sample | ❌ No; segmented rendering | ❌ Not exposed | ❌ Not exposed | ❌ Not exposed |

### Stock Voices

| Provider | Released | Stock voices | Native multi-speaker | Natural-language prompts | Specific selectors | SSML and emotion control |
|---|---|---|---|---|---|---|
| Kitten | ✅ 2026-02-19 | ✅ 8 | ❌ No; segmented rendering | ❌ Not exposed | ❌ Not exposed | ❌ Not exposed |
| Groq | ❌ 2025-03-17 | ✅ 6 English | ❌ No; segmented rendering | ❌ Not exposed | ❌ Not exposed | ⚠️ English Orpheus accepts in-text bracketed vocal directions such as `[cheerful]` |
| Grok | ✅ 2026-05-15 | ✅ 26 | ❌ No; segmented rendering | ❌ Not exposed | ❌ Not exposed | ❌ Not exposed |
| OpenAI | ⚠️ 2025-12-15 | ✅ 13 | ❌ No; segmented rendering | ✅ `--tts-instructions` | ❌ Not exposed | ❌ Not exposed |
| Gemini | ✅ 2026-02-15 | ✅ 30 | ⚠️ Native only for exactly two speakers when representable; otherwise segmented | ❌ Not exposed | ❌ Not exposed | ⚠️ Inline delivery tags such as `[whispers]` passed through unchanged |
| Deepgram | ❌ 2025-04-02 | ✅ 91 | ❌ No; segmented rendering | ❌ Not exposed | ❌ Not exposed | ❌ Not exposed |
| DeepInfra `XiaomiMiMo/MiMo-V2.5-tts` | ✅ 2026-04-27 | ✅ 8 | ❌ No; segmented rendering | ✅ `instruct` | ❌ Not exposed | ⚠️ In-text `(style)` and `[audio tag]` controls |
| Replicate `jaaari/kokoro-82m` | ❌ 2025-01-27 | ✅ 46 | ❌ No; segmented rendering | ❌ Not exposed | ❌ Not exposed | ❌ Not exposed |
| fal.ai `fal-ai/bytedance/seed-speech/tts/v2` | ✅ 2026-03-15 | ✅ 41 | ❌ No; segmented rendering | ✅ `voice_instruction` delivery steering | ⚠️ Speed, volume, and pitch | ❌ Not exposed |
| fal.ai `async/tts-pro/v1.0` | ✅ 2026-01-15 | ⚠️ Curated Async voice-library IDs | ❌ No; segmented rendering | ❌ Not exposed | ❌ Not exposed | ⚠️ In-text pause, emphasis, and timing markup |

Clone ports consume protected assets and explicit consent/provenance records and never place sample bytes or contact PII in ordinary artifacts. Synthesis commands cannot invoke them. Dashboard-only, subscription-gated, and verification-gated clone or design flows are not exposed. Cartesia and Speechify text-prompt design and MiniMax/Cartesia/Speechify/Inworld/DeepInfra native multi-speaker dialogue are unsupported rather than inferred from adjacent provider features. Fish `s2.1-pro` native dialogue and timestamped streaming are implemented. Voice Design is the `voice-design-1` creation endpoint on that same model, not a second synthesis selector. Inworld exposes catalog discovery, prompt voice design, instant clone, inspect, and project-owned delete. DeepInfra exposes account catalog discovery, VoiceDesign inference, instant clone through create-voice, inspect, and project-owned delete. Replicate exposes only the pinned Kokoro stock-voice synthesis target; reference-audio clone models remain unavailable until they have protected-asset and consent-aware adapters. Request-time model features are not represented as fabricated durable resources.
