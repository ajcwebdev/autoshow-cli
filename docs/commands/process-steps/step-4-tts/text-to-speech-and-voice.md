# tts

Generate speech audio from a local `.md` or `.txt` file with hosted TTS providers.

Durable voice registrations are documented separately in [`voice`](../step-9-voice/00-voice-overview.md).

## Outline

- [Setup](#setup)
  - [Environment](#environment)
- [Usage](#usage)
- [Shared TTS Options](#shared-tts-options)
- [TTS Services](#tts-services)
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
- [Provider Capabilities](#provider-capabilities)
  - [Advanced](#advanced)
  - [Advanced Runner Ups](#advanced-runner-ups)
  - [Voice Cloning and Design without Expressiveness](#voice-cloning-and-design-without-expressiveness)
  - [Stock Voices](#stock-voices)

## Setup

```bash
# full setup
bun autoshow setup

# check hosted TTS API-key readiness
bun autoshow setup --step tts
```

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

`<input>` must be a local `.md` or `.txt` file. If no engine flag is provided, `tts` defaults to the cheapest hosted TTS provider.

## Shared TTS Options

| Flag                                               | Description                                                                                                                                                                       |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--provider provider[=model]`                      | TTS provider/model selector; repeat to run multiple targets                                                                                                                       |
| `--all-providers`                                  | Select the default all-provider TTS target set                                                                                                                                    |
| `--provider-concurrency <n>`                       | Hosted TTS provider/model targets to run concurrently per item; this does not limit chunks inside one target; default `7`                                                         |
| `--batch-concurrency <n>`                          | Batch text files to process concurrently; default `7`                                                                                                                             |
| `--concurrency-mode <ramp\|immediate>`             | Start each hosted provider/account lane at one request and add one slot every five seconds while demand is queued (`ramp`, default), or start at its configured cap (`immediate`) |
| `--tts-voice <provider=value\|value>`              | Generic TTS voice selector                                                                                                                                                        |
| `--tts-speed <provider=value\|value>`              | Generic TTS speed                                                                                                                                                                 |
| `--tts-language <provider=value\|value>`           | Generic TTS language                                                                                                                                                              |
| `--tts-ref-audio <provider=path\|path>`            | Explicit one-off Mistral reference input                                                                                                                                          |
| `--tts-text-normalization <provider=value\|value>` | Generic text normalization                                                                                                                                                        |
| `--tts-instructions <provider=value\|value>`       | Generic voice/style instructions                                                                                                                                                  |
| `--tts-chunk-concurrency <n>`                      | Hosted TTS chunk starts allowed in parallel per provider; default `30` (or `50` for Grok-only)                                                                                    |
| `--allow-ambiguous-redispatch`                     | Explicitly authorize resuming a stored generation slot whose provider admission cannot be reconciled to retained audio, which may repurchase it                                    |
| `--tts-dialogue-format <screenplay|labeled>`      | Dialogue input format for multi-speaker TTS; requires `--tts-speaker`                                                                                                             |
| `--tts-speaker SPEAKER=VOICE|path`                | Multi-speaker voice mapping; repeatable. Selects multi-speaker TTS                                                                                                                |
| `--price`                                          | Show the aggregated estimate and exit                                                                                                                                             |
| `--output-dir <dir>`                               | Global flag: pin an exact run directory instead of a timestamped output directory                                                                                                 |

You can combine multiple TTS targets in one run. `--provider` is repeatable. Shared voice flags apply to every selected model for that provider.

See [Provider Capabilities](#provider-capabilities) for the per-provider stock-voice, expansive-catalog, design, instant clone, native multi-speaker, natural-language prompt, specific-selector, and SSML/emotion-control matrix. A catalog, design, or clone capability does not authorize `tts` or `comic generate-audio` to create a remote resource. Use [`voice`](../step-9-voice/00-voice-overview.md) for those mutations.

When a hosted target fails after producing some chunks, AutoShow retains the target's `.tts-tmp-*` workspace and completed audio files. Do not delete that directory before resuming: the render journal uses retained output evidence to avoid purchasing completed segments again. Successful finalization removes the temporary chunk files normally.

A paid request whose provider admission is ambiguous is never redispatched inside the running command, for any provider. The run stops and reports a recovery checkpoint instead. `--allow-ambiguous-redispatch` authorizes the *next* invocation to reconcile that stored slot and resume, which may purchase the same immutable generation slot a second time. Every attempt is recorded in the admission journal, completed slots remain reusable, and an exhausted run reports the exact retained/unresolved checkpoint for the next invocation.

AutoShow generally splits TTS text into 2000-character chunks, with provider/model registry limits taking precedence: Groq Orpheus uses 200, DeepInfra MiMo uses 1000, DeepInfra Qwen uses 4000, and DeepInfra Chatterbox uses 5000. `--provider-concurrency` limits how many provider/model targets run at once; it does not limit requests within one target. Hosted providers synthesize through the separate `--tts-chunk-concurrency` limit (default `30`, or `50` for Grok-only). In the default ramp mode, that value remains the hard ceiling while each provider/account lane starts at one request and adds one slot every five seconds under queued demand. To cap a single Inworld target at five simultaneous chunks, for example, pass `--tts-chunk-concurrency 5`; `--provider-concurrency 5` alone does not do that.

```bash
bun autoshow tts input/examples/tts/1-tts.md \
  --provider openai=gpt-4o-mini-tts-2025-12-15 \
  --tts-voice alloy

bun autoshow tts input/examples/tts/1-tts.md --provider elevenlabs=eleven_v3
```

## TTS Services

### ElevenLabs

| Option         | Value                                                                                                                                                                                                                                                                                               |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Selector       | `--provider elevenlabs[=<model>]`                                                                                                                                                                                                                                                                   |
| Models         | `eleven_v3`                                                                                                                                                                                                                                                                                         |
| Existing voice | `--tts-voice <id>`, default `hpp4J3VqNfWAUOO0d1Us`                                                                                                                                                                                                                                                  |
| Controls       | `--tts-language`, `--elevenlabs-tts-stability`, `--elevenlabs-tts-similarity-boost`, `--elevenlabs-tts-style`, `--elevenlabs-tts-use-speaker-boost`, `--tts-speed`, `--elevenlabs-tts-seed`, `--tts-text-normalization`, `--elevenlabs-tts-pronunciation-dictionary-locator` |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider elevenlabs=eleven_v3 --tts-voice hpp4J3VqNfWAUOO0d1Us
```

ElevenLabs synthesis uses existing voices only. Single-voice text character limit is 5,000 for `eleven_v3`. Multi-speaker `eleven_v3` uses the timestamped Text-to-Dialogue endpoint when turn boundaries, voices (max 10), and documented v3 audio tags can be represented natively.

Use `voice list --provider` for catalogs, `voice design` for candidate generation, and `voice design --save` to register a selected voice.

### MiniMax

| Option   | Value                                                                                                                                                                            |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Selector | `--provider minimax[=<model>]`                                                                                                                                                   |
| Models   | `speech-2.8-hd`, `speech-2.8-turbo`                                                                                                                                              |
| Voice    | `--tts-voice <id>`, default `English_expressive_narrator`                                                                                                                        |
| Controls | `--tts-language`, `--tts-speed`, `--minimax-tts-volume`, `--minimax-tts-pitch`, `--minimax-tts-emotion`, `--tts-text-normalization`, `--minimax-tts-pronunciation` |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider minimax=speech-2.8-turbo --tts-voice English_expressive_narrator
bun autoshow tts input/examples/tts/1-tts.md --provider minimax=speech-2.8-hd --tts-language English --tts-speed 1.15 --minimax-tts-emotion calm
bun autoshow tts input/examples/tts/1-tts.md --provider minimax=speech-2.8-turbo --tts-voice English_expressive_narrator --price
```

MiniMax TTS uses existing or preset voices and splits text into 2000-character chunks. Multi-speaker dialogue uses the segmented renderer.

### Groq

| Option   | Value                                                                                                       |
| -------- | ----------------------------------------------------------------------------------------------------------- |
| Selector | `--provider groq[=<model>]`                                                                                 |
| Models   | `canopylabs/orpheus-v1-english`                                                                             |
| Voice    | `--tts-voice <id>`; English voices `autumn`, `diana`, `hannah`, `austin`, `daniel`, `troy` (default `troy`) |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider groq=canopylabs/orpheus-v1-english --tts-voice troy
```

Groq voices are validated against the selected model. Text is split into 200-character chunks.

### Grok

| Option             | Value                                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------- |
| Selector           | `--provider grok[=<model>]`                                                                                    |
| Models             | `grok-tts`                                                                                                     |
| Voice              | `--tts-voice <id>`, default `eve`; built-ins `eve`, `ara`, `rex`, `sal`, `leo`, or 8-character custom voice ID |
| Language           | `--tts-language <code>`, default `auto`                                                                        |
| Text normalization | `--tts-text-normalization true`                                                                                |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider grok=grok-tts --tts-voice eve
bun autoshow tts input/examples/tts/1-tts.md --provider grok=grok-tts --tts-voice ab12cd34 --tts-language ar-SA --tts-text-normalization true
```

Grok TTS text is split into 2000-character chunks.

### Mistral

| Option          | Value                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------- |
| Selector        | `--provider mistral[=<model>]`                                                           |
| Models          | `voxtral-mini-tts-2603`                                                                  |
| Voice source    | Existing `--tts-voice <id>` or authorized one-off `--tts-ref-audio <path>`               |
| Saved reference | Not managed by `voice`; use an existing voice ID or authorized one-off `--tts-ref-audio` |
| Dialogue mode   | `--tts-dialogue-format screenplay\|labeled` plus repeatable `--tts-speaker SPEAKER=path` |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider mistral=voxtral-mini-tts-2603 --tts-voice voice_abc123
bun autoshow tts input/chat-and-duco.txt \
  --provider mistral=voxtral-mini-tts-2603 \
  --tts-dialogue-format screenplay \
  --tts-speaker DUCO=input/examples/audio/anthony-voice.mp3 \
  --tts-speaker CHAT=https://ajc.pics/autoshow/examples/1-audio.mp3
```

Mistral Voxtral TTS requires an existing voice ID or an authorized one-off local reference file. `voice` does not create or manage Mistral saved voices.

Dialogue mode uses `--tts-speaker SPEAKER=VOICE|path` and `--tts-dialogue-format`. Gemini, ElevenLabs `eleven_v3`, and Hume `octave-2` use native dialogue serializers when eligible; all other targets synthesize per-turn segments and concatenate them into `speech.wav`.

### OpenAI

| Option   | Value                                                                                    |
| -------- | ---------------------------------------------------------------------------------------- |
| Selector | `--provider openai[=<model>]`                                                            |
| Models   | `gpt-4o-mini-tts-2025-12-15`                                                             |
| Voice    | `--tts-voice <id>`, default `alloy`                                                      |
| Controls | `--tts-instructions <text>` (`gpt-4o-mini-tts-2025-12-15` only), `--tts-speed <0.25..4>` |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider openai=gpt-4o-mini-tts-2025-12-15 --tts-voice alloy
bun autoshow tts input/examples/tts/1-tts.md --provider openai=gpt-4o-mini-tts-2025-12-15 --tts-instructions "Warm documentary narration" --tts-speed 1.1
```

### Gemini

| Option       | Value                                                                         |
| ------------ | ----------------------------------------------------------------------------- |
| Selector     | `--provider gemini[=<model>]`                                                 |
| Models       | `gemini-3.1-flash-tts-preview`                                                |
| Single voice | `--tts-voice <name>`, default `Kore`                                          |
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

| Option               | Value                                                                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Selector             | `--provider deepgram[=<model>]`                                                                                                    |
| Models               | Aura 2 voice models listed by `bun autoshow tts --help`; default `aura-2-thalia-en`                                                |
| Voice/model override | `--tts-voice <model>`, default selected model                                                                                      |
| Controls             | `--tts-speed <0.5..2>`                                                                                                             |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider deepgram=aura-2-thalia-en --tts-voice aura-2-andromeda-en
bun autoshow tts input/examples/tts/1-tts.md --provider deepgram=aura-2-thalia-en --tts-speed 1.1
```

Deepgram requests are pinned to `encoding=linear16` in a WAV container so the intermediate stays lossless before the run remasters it into `speech.wav`.

### Speechify

| Option   | Value                                                                 |
| -------- | --------------------------------------------------------------------- |
| Selector | `--provider speechify[=<model>]`                                      |
| Models   | `simba-3.2`                                                           |
| Voice    | `--tts-voice <id>`, default `geffen_32`                               |
| Controls | `--tts-language <tag>`                                                |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider speechify=simba-3.2 --tts-voice geffen_32 --tts-language en-US
bun autoshow tts input/examples/tts/1-tts.md --provider speechify=simba-3.2 --tts-voice speechify_custom_voice_123
bun autoshow config --tts speechify=simba-3.2 --tts-voice speechify_custom_voice_123
```

Speechify TTS sends text chunks to `POST /v1/audio/speech` with `audio_format` pinned to lossless `wav` and converts the output to `speech.wav`. Input may be plain text or SSML; wrap SSML in `<speak>` to control pitch, rate, volume, pauses, emphasis, substitutions, and emotion via `<speechify:style emotion="...">`. Simba 3.2 is English-only with curated built-ins.

### Hume

| Option         | Value                                                               |
| -------------- | ------------------------------------------------------------------- |
| Selector       | `--provider hume[=<model>]`                                         |
| Models         | `octave-1`, `octave-2`                                              |
| Voice          | `--tts-voice <name-or-id>`, default `Male English Actor`            |
| API settings   | `HUME_API_KEY`                                                      |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider hume=octave-2
bun autoshow tts input/examples/tts/1-tts.md --provider hume=octave-2 --tts-voice "Male English Actor"
bun autoshow tts input/examples/tts/1-tts.md --provider hume=octave-2 --tts-voice 00000000-0000-4000-8000-000000000000
bun autoshow config --tts hume=octave-2 --tts-voice 00000000-0000-4000-8000-000000000000
```

Single-voice Hume TTS uses Octave 2 via `POST /v0/tts/file`. Multi-speaker plans use ordered Octave 2 utterances via `POST /v0/tts`. Hume is synthesis-only: pass an existing stock or custom voice ID with `--tts-voice`. A UUID is sent as a stable voice ID and resolves against any voice the account can reach, including account-owned custom voices; any other value is looked up by name in the Hume voice library. Address a custom voice by its ID, which `voice list` reports.

### Cartesia

| Option       | Value                                                                    |
| ------------ | ------------------------------------------------------------------------ |
| Selector     | `--provider cartesia[=<model>]`                                          |
| Models       | `sonic-3.5-2026-05-04`                                                   |
| Voice        | `--tts-voice <voice-id>`, default `f786b574-daa5-4673-aa0c-cbe3e8534c02` |
| Language     | `--tts-language <code>`                                                  |
| API settings | `CARTESIA_API_KEY`                                                       |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider cartesia=sonic-3.5-2026-05-04 --tts-voice f786b574-daa5-4673-aa0c-cbe3e8534c02
bun autoshow tts input/examples/tts/1-tts.md --provider cartesia=sonic-3.5-2026-05-04 --tts-language en
bun autoshow config --tts cartesia=sonic-3.5-2026-05-04 --tts-voice f786b574-daa5-4673-aa0c-cbe3e8534c02
```

Cartesia TTS uses `POST /tts/bytes` requesting 24000 Hz PCM WAV bytes converted to `speech.wav`. Text is split into 2000-character chunks. Transcripts may include SSML-like `<speed>`, `<volume>`, `<emotion>`, `<break>`, and `<spell>` tags plus `[laughter]`.

### Fish

| Option       | Value                                                          |
| ------------ | -------------------------------------------------------------- |
| Selector     | `--provider fish[=<model>]`                                    |
| Models       | `s2.1-pro`                                                     |
| Voice        | `--tts-voice <id>`, default `7f92f8afb8ec43bf81429cc1c9199cb1` |
| API settings | `FISH_API_KEY`                                                 |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider fish=s2.1-pro
bun autoshow tts input/examples/tts/1-tts.md --provider fish=s2.1-pro --tts-voice 7f92f8afb8ec43bf81429cc1c9199cb1
bun autoshow tts input/examples/tts/1-tts.md --provider fish=s2.1-pro --tts-dialogue-format labeled --tts-speaker Host=VOICE_A --tts-speaker Guest=VOICE_B
```

Fish TTS converts output to `speech.wav`. Single-voice text is split into 2000-character chunks. `s2.1-pro` uses native multi-speaker dialogue with timestamped streaming when turn boundaries and voices can be represented natively. Voice Design is a `s2.1-pro` capability, not a separate synthesis selector: use `voice design --creation-model voice-design-1` for protected preview candidates, then `voice design --save` to register a selected voice. Use `voice list --provider` for catalogs.

### Inworld

| Option       | Value                                                   |
| ------------ | ------------------------------------------------------- |
| Selector     | `--provider inworld[=<model>]`                          |
| Models       | `realtime-tts-2`                                        |
| Voice        | `--tts-voice <id>`, default `voice_inworld_standard_en` |
| Controls     | `--tts-instructions <text>`                             |
| API settings | `INWORLD_API_KEY`                                       |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider inworld=realtime-tts-2
bun autoshow tts input/examples/tts/1-tts.md --provider inworld=realtime-tts-2 --tts-voice Dennis --tts-instructions "Sound reassuring"
```

Inworld selectors serialize as provider IDs `inworld-tts-2` and `inworld-tts-2-flash`. Text is split into 2000-character chunks. Steering via `--tts-instructions` is accepted on `realtime-tts-2` only; inline emotion and vocalization tags are preserved. Multi-speaker dialogue uses the segmented renderer. Use `voice list --provider` for system and account catalogs.

### DeepInfra

| Option       | Value                                                                                                                                                                                                                 |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Selector     | `--provider deepinfra[=<model>]`                                                                                                                                                                                      |
| Models       | `ResembleAI/chatterbox-turbo`, `XiaomiMiMo/MiMo-V2.5-tts`, `XiaomiMiMo/MiMo-V2.5-tts-voicedesign`, `Qwen/Qwen3-TTS`, `Qwen/Qwen3-TTS-VoiceDesign`                                                                     |
| Voice        | `--tts-voice <id>`; Chatterbox defaults to the provider stock voice, MiMo TTS defaults to `mimo_default`, Qwen TTS defaults to `Vivian`; VoiceDesign models use a narration description when `--tts-voice` is omitted |
| Controls     | `--tts-instructions <text>` (MiMo TTS and Qwen TTS `instruct` only)                                                                                                                                                   |
| API settings | `DEEPINFRA_API_KEY`                                                                                                                                                                                                   |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider deepinfra=ResembleAI/chatterbox-turbo
bun autoshow tts input/examples/tts/1-tts.md --provider deepinfra=Qwen/Qwen3-TTS --tts-voice Vivian --tts-instructions "Warm documentary narration"
bun autoshow tts input/examples/tts/1-tts.md --provider deepinfra=Qwen/Qwen3-TTS-VoiceDesign
```

DeepInfra request fields are model-specific: Chatterbox uses `text` with optional `voice_id`, MiMo uses `text` plus `voice`, and Qwen uses `input` plus `voice`. Registry chunk limits take precedence over the 2000-character default: MiMo uses 1000, Qwen uses 4000, and Chatterbox uses 5000. Paid requests with ambiguous admission are not redispatched in flight; `--allow-ambiguous-redispatch` authorizes reconciling the stored slot on the next run. Multi-speaker dialogue uses the segmented renderer. DeepInfra is synthesis-only: pass an existing account or VoiceDesign voice ID with `--tts-voice`.

### Replicate

| Option       | Value                                                                        |
| ------------ | ---------------------------------------------------------------------------- |
| Selector     | `--provider replicate[=<model>]`                                             |
| Models       | `jaaari/kokoro-82m`                                                          |
| Voice        | `--tts-voice <name>`, default `af_bella`; validated Kokoro stock voices only |
| Controls     | `--tts-speed <0.1..5>`                                                       |
| API settings | `REPLICATE_API_TOKEN`                                                        |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider replicate=jaaari/kokoro-82m
bun autoshow tts input/examples/tts/1-tts.md --provider replicate=jaaari/kokoro-82m --tts-voice am_adam --tts-speed 1.1
```

Replicate TTS uses the version-pinned Kokoro stock-voice target and converts output to `speech.wav`. Text is split into 2000-character chunks. Multi-speaker dialogue uses the segmented renderer. Reference-audio clone models are not exposed; there is no voice-management port.

### fal.ai

| Option       | Value                                                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Selector     | `--provider fal[=<model>]`                                                                                                                 |
| Models       | `fal-ai/bytedance/seed-speech/tts/v2`, `fal-ai/maya`, `async/tts-pro/v1.0`                                                                 |
| Voice        | `--tts-voice <id-or-description>`; Seed defaults to `stokie_en`, Async defaults to `Jennie`, Maya uses a narrator description when omitted |
| Controls     | `--tts-instructions <text>` (Seed `voice_instruction` or Maya voice-description prompt)                                                    |
| API settings | `FAL_API_KEY`                                                                                                                              |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider fal=fal-ai/bytedance/seed-speech/tts/v2 --tts-voice stokie_en --tts-instructions "Speak in a warm, cheerful tone."
bun autoshow tts input/examples/tts/1-tts.md --provider fal=fal-ai/maya --tts-instructions "Realistic male voice in the 30s with american accent."
bun autoshow tts input/examples/tts/1-tts.md --provider fal=async/tts-pro/v1.0 --tts-voice Jennie
```

fal.ai TTS submits to the queue API and converts output to `speech.wav`. Text is split into 2000-character chunks. Multi-speaker dialogue uses the segmented renderer. There is no voice-management port.

## Pricing Notes

The registry contains 111 active hosted TTS selectors. This table ranks every selector by the registry's nominal price. Character-priced entries show the equivalent rate per 1K characters; Replicate is separately marked because its published figure is a variable typical per-prediction cost rather than a character tariff. Provider credits, taxes, volume discounts, and retry variance are excluded.

| Rank |                  Nominal price | Selectors                                                                                   | Count |
| ---: | -----------------------------: | ------------------------------------------------------------------------------------------- | ----: |
|    1 | Promotional `$0.00` / 1K chars | `deepinfra/XiaomiMiMo/MiMo-V2.5-tts`, `deepinfra/XiaomiMiMo/MiMo-V2.5-tts-voicedesign`      |     2 |
|    2 |  About `$0.00022` / prediction | `replicate/jaaari/kokoro-82m`                                                               |     1 |
|    3 |            `$0.001` / 1K chars | `deepinfra/ResembleAI/chatterbox-turbo`                                                     |     1 |
|    4 |             `$0.01` / 1K chars | `speechify/simba-3.2`                                                                       |     1 |
|    5 |           `$0.0126` / 1K chars | `openai/gpt-4o-mini-tts-2025-12-15` (`$0.0006` input + `$0.012` output)                     |     1 |
|    6 |            `$0.015` / 1K chars | `fish/s2.1-pro`, `grok/grok-tts`                                                            |     2 |
|    7 |     `$0.016` / 1K output chars | `mistral/voxtral-mini-tts-2603`                                                             |     1 |
|    8 |             `$0.02` / 1K chars | `deepinfra/Qwen/Qwen3-TTS`, `deepinfra/Qwen/Qwen3-TTS-VoiceDesign`                          |     2 |
|    9 |            `$0.021` / 1K chars | `gemini/gemini-3.1-flash-tts-preview` (`$0.001` input + `$0.02` output)                     |     1 |
|   10 |            `$0.022` / 1K chars | `groq/canopylabs/orpheus-v1-english`                                                        |     1 |
|   11 |            `$0.025` / 1K chars | `inworld/realtime-tts-2`                                                                    |     1 |
|   12 |             `$0.03` / 1K chars | All 91 active `deepgram/aura-2-*` voice-model selectors listed by `bun autoshow tts --help` |    91 |
|   13 |         `$0.037375` / 1K chars | `cartesia/sonic-3.5-2026-05-04`                                                             |     1 |
|   14 |             `$0.06` / 1K chars | `minimax/speech-2.8-turbo`                                                                  |     1 |
|   15 |             `$0.10` / 1K chars | `elevenlabs/eleven_v3`, `minimax/speech-2.8-hd`                                             |     2 |
|   16 |             `$0.15` / 1K chars | `hume/octave-1`, `hume/octave-2`                                                            |     2 |

## Output

- Single-target runs write `speech.wav` and `manifest.json`.
- Multi-target runs write `speech-<service>-<sanitized-model>.wav` per successful target and `manifest.json`.
- Dialogue runs write `dialogue-normalized.txt`. Segmented runs retain per-turn WAVs under `segments/`.
- Managed/custom voice runs record the resource ID, voice name, or reference tag as `speaker` in metadata.
- `manifest.json` records metadata including `tts` targets array, `cost`, and `timing`.
- `--output-dir` sets the output directory; output filenames remain provider-deterministic.

## Provider Capabilities

Delivery control is split into natural-language prompts, request-level specific selectors, and in-text SSML or emotion markup.

Pricing is the AutoShow registry rate. Cost rank orders models cheapest-first within each table (1 = cheapest) and ties share a rank, comparing effective cost per 1,000 characters: dual-rate models sum input and output character rates, and Replicate Kokoro spreads its per-request price across its 2,000-character request chunks.

### Advanced

| Provider                        | Released      | Expansive catalog                                                              | Design                                                                 | Instant clone                                                                  | Native multi-speaker                                        | Natural-language prompts                | Specific selectors                               | SSML and emotion control                                                                                                  | Pricing          | Cost rank |
| ------------------------------- | ------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------- | --------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ---------------- | --------- |
| ElevenLabs `eleven_v3`          | ⚠️ 2025-06-03 | ✅ 10,000+ Voice Library plus account voices                                   | ✅ Design and eligibility-proved remix                                 | ✅ Instant clone from protected samples                                        | ⚠️ Text-to-Dialogue when the plan is exactly representable  | ❌ Not exposed                          | ✅ Style exaggeration, stability, and similarity | ✅ v3 audio tags such as `[whispers]` and `[laughs]`, plus `/IPA/` pronunciation; no SSML `<break>`                       | $0.10/1k chars   | 6/6       |
| Inworld `realtime-tts-2`        | ✅ 2026-05-05 | ⚠️ System and account voices via non-paginated `voice list --provider`        | ✅ Prompt design plus publish of one selected preview                  | ✅ Instant clone from protected samples                                        | ❌ No; segmented rendering                                  | ✅ Request-level `instruction` steering | ❌ Not exposed                                   | ✅ Preserved inline emotion and vocalization tags such as `[happy]`, `[laugh]`, and `[breathe]`                           | $0.025/1k chars  | 4/6       |
| Fish `s2.1-pro`                 | ✅ 2026-08-15 | ✅ Thousands of public and account voice models via paginated `voice list --provider` | ✅ Stateless protected preview followed by exact-sample model creation | ✅ Instant fast model creation from protected samples                          | ✅ Native multi-speaker dialogue with timestamped streaming | ❌ Not exposed                          | ❌ Not exposed                                   | ✅ In-text `[emotion]` and delivery markup on dialogue and eligible vocal reactions                                       | $0.015/1k chars  | 3/6       |
| fal.ai `fal-ai/maya`            | ⚠️ 2025-10-18 | ❌ Not exposed                                                                 | ✅ Per-request voice-description prompt                                | ❌ Not exposed                                                                 | ❌ No; segmented rendering                                  | ✅ Voice-description prompt             | ❌ Not exposed                                   | ✅ In-text emotion tags such as `<excited>` and `<laugh>`                                                                 | $0.005/1k chars  | 1/6       |
| Cartesia `sonic-3.5-2026-05-04` | ✅ 2026-05-04 | ✅ Hundreds of public and account voices via paginated `voice list --provider`        | ❌ Not exposed                                                         | ✅ Instant API clone                                                           | ❌ No; segmented rendering                                  | ❌ Not exposed                          | ❌ Not exposed                                   | ✅ SSML-like `<speed>`, `<volume>`, `<emotion>`, `<break>`, and `<spell>` plus `[laughter]`                               | $0.0374/1k chars | 5/6       |
| Speechify `simba-3.2`           | ✅ 2026-07-08 | ✅ Hundreds of shared and personal voices via paginated `voice list --provider`       | ❌ Not exposed                                                         | ✅ Personal voice clone with protected 10–30 second sample and consent payload | ❌ No; segmented rendering                                  | ❌ Not exposed                          | ❌ Not exposed                                   | ✅ SSML `<speak>` with `<prosody>`, `<break>`, `<emphasis>`, `<sub>`, and `<speechify:style emotion="...">` (13 emotions) | $0.01/1k chars   | 2/6       |

### Advanced Runner Ups

| Provider                   | Released      | Expansive catalog                                                 | Design                                                   | Instant clone                                                                                                      | Native multi-speaker       | Natural-language prompts                                | Specific selectors                                                         | SSML and emotion control                                                        | Pricing        | Cost rank |
| -------------------------- | ------------- | ----------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------- | --------- |
| MiniMax `speech-2.8-hd`    | ✅ 2026-01-23 | ⚠️ System, generated, and cloned voices via `voice list --provider` | ⚠️ One temporary generated candidate                     | ✅ One protected mp3/m4a/wav sample, 10 seconds–5 minutes and no larger than 20 MiB, through upload and clone APIs | ❌ No; segmented rendering | ❌ Not exposed                                          | ✅ Explicit emotion selectors (happy, sad, angry, etc.), pitch, and volume | ✅ Pause markers `<#x#>` and interjection tags such as `(laughs)` and `(sighs)` | $0.10/1k chars | 2/4       |
| MiniMax `speech-2.8-turbo` | ✅ 2026-01-23 | ⚠️ System, generated, and cloned voices via `voice list --provider` | ⚠️ One temporary generated candidate                     | ✅ One protected mp3/m4a/wav sample, 10 seconds–5 minutes and no larger than 20 MiB, through upload and clone APIs | ❌ No; segmented rendering | ❌ Not exposed                                          | ✅ Explicit emotion selectors (happy, sad, angry, etc.), pitch, and volume | ✅ Pause markers `<#x#>` and interjection tags such as `(laughs)` and `(sighs)` | $0.06/1k chars | 1/4       |
| Hume `octave-1`            | ❌ 2025-02-26 | ⚠️ Paginated stock and custom account voices via `voice list --provider` | ✅ Octave 1 design, compatible with Octave 1/2 synthesis | ❌ Not exposed                                                                                                     | ❌ No; segmented rendering | ✅ Natural-language acting description and tone prompts | ❌ Not exposed                                                             | ⚠️ In-text `[pause]` and `[long pause]`                                         | $0.15/1k chars | 3/4       |
| Hume `octave-2`            | ⚠️ 2025-10-01 | ⚠️ Paginated stock and custom account voices via `voice list --provider` | ✅ Octave 1 design, compatible with Octave 1/2 synthesis | ❌ Not exposed                                                                                                     | ✅ Native utterances       | ❌ Not exposed                                          | ❌ Not exposed                                                             | ⚠️ In-text `[pause]` and `[long pause]`                                         | $0.15/1k chars | 3/4       |

### Voice Cloning and Design without Expressiveness

| Provider                                         | Released      | Expansive catalog | Design                                                                                  | Instant clone                                                      | Native multi-speaker       | Natural-language prompts | Specific selectors | SSML and emotion control | Pricing                                    | Cost rank |
| ------------------------------------------------ | ------------- | ----------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------- | ------------------------ | ------------------ | ------------------------ | ------------------------------------------ | --------- |
| DeepInfra `ResembleAI/chatterbox-turbo`          | ⚠️ 2025-12-02 | ❌ Not exposed    | ❌ Not exposed                                                                          | ✅ Instant create from protected samples via `POST /v1/voices/add` | ❌ No; segmented rendering | ❌ Not exposed           | ❌ Not exposed     | ❌ Not exposed           | $0.001/1k chars                            | 2/5       |
| DeepInfra `Qwen/Qwen3-TTS`                       | ✅ 2026-01-21 | ❌ Not exposed    | ❌ Not exposed                                                                          | ✅ Instant create from protected samples via `POST /v1/voices/add` | ❌ No; segmented rendering | ✅ `instruct`            | ❌ Not exposed     | ❌ Not exposed           | $0.02/1k chars                             | 4/5       |
| DeepInfra `XiaomiMiMo/MiMo-V2.5-tts-voicedesign` | ✅ 2026-04-27 | ❌ Not exposed    | ✅ Request-time VoiceDesign; materialized voices are account-owned via `GET /v1/voices` | ❌ Not exposed                                                     | ❌ No; segmented rendering | ❌ Not exposed           | ❌ Not exposed     | ❌ Not exposed           | $0 promotional                             | 1/5       |
| DeepInfra `Qwen/Qwen3-TTS-VoiceDesign`           | ✅ 2026-01-21 | ❌ Not exposed    | ✅ Request-time VoiceDesign; materialized voices are account-owned via `GET /v1/voices` | ❌ Not exposed                                                     | ❌ No; segmented rendering | ❌ Not exposed           | ❌ Not exposed     | ❌ Not exposed           | $0.02/1k chars                             | 4/5       |
| Mistral `voxtral-mini-tts-2603`                  | ✅ 2026-03-23 | ❌ Not exposed    | ❌ Not exposed                                                                          | ✅ Project-owned saved-reference voice from a protected sample     | ❌ No; segmented rendering | ❌ Not exposed           | ❌ Not exposed     | ❌ Not exposed           | $16.00 out per 1M chars (≈$0.016/1k chars) | 3/5       |

### Stock Voices

| Provider                                     | Released      | Stock voices                       | Native multi-speaker                                                            | Natural-language prompts                 | Specific selectors          | SSML and emotion control                                                           | Pricing                                                | Cost rank |
| -------------------------------------------- | ------------- | ---------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------ | --------- |
| Groq                                         | ❌ 2025-03-17 | ✅ 6 English                       | ❌ No; segmented rendering                                                      | ❌ Not exposed                           | ❌ Not exposed              | ⚠️ English Orpheus accepts in-text bracketed vocal directions such as `[cheerful]` | $0.022/1k chars                                        | 7/9       |
| Grok                                         | ✅ 2026-05-15 | ✅ 26                              | ❌ No; segmented rendering                                                      | ❌ Not exposed                           | ❌ Not exposed              | ❌ Not exposed                                                                     | $0.015/1k chars                                        | 5/9       |
| OpenAI                                       | ⚠️ 2025-12-15 | ✅ 13                              | ❌ No; segmented rendering                                                      | ✅ `--tts-instructions`                  | ❌ Not exposed              | ❌ Not exposed                                                                     | $0.60 in / $12.00 out per 1M chars (≈$0.0126/1k chars) | 4/9       |
| Gemini                                       | ✅ 2026-02-15 | ✅ 30                              | ⚠️ Native only for exactly two speakers when representable; otherwise segmented | ❌ Not exposed                           | ❌ Not exposed              | ⚠️ Inline delivery tags such as `[whispers]` passed through unchanged              | $1.00 in / $20.00 out per 1M chars (≈$0.021/1k chars)  | 6/9       |
| Deepgram                                     | ❌ 2025-04-02 | ✅ 91                              | ❌ No; segmented rendering                                                      | ❌ Not exposed                           | ❌ Not exposed              | ❌ Not exposed                                                                     | $0.03/1k chars                                         | 8/9       |
| DeepInfra `XiaomiMiMo/MiMo-V2.5-tts`         | ✅ 2026-04-27 | ✅ 8                               | ❌ No; segmented rendering                                                      | ✅ `instruct`                            | ❌ Not exposed              | ⚠️ In-text `(style)` and `[audio tag]` controls                                    | $0 promotional                                         | 1/9       |
| Replicate `jaaari/kokoro-82m`                | ❌ 2025-01-27 | ✅ 46                              | ❌ No; segmented rendering                                                      | ❌ Not exposed                           | ❌ Not exposed              | ❌ Not exposed                                                                     | $0.00022/request (≈$0.00011/1k chars)                  | 2/9       |
| fal.ai `fal-ai/bytedance/seed-speech/tts/v2` | ✅ 2026-03-15 | ✅ 41                              | ❌ No; segmented rendering                                                      | ✅ `voice_instruction` delivery steering | ⚠️ Speed, volume, and pitch | ❌ Not exposed                                                                     | $0.03/1k chars                                         | 8/9       |
| fal.ai `async/tts-pro/v1.0`                  | ✅ 2026-01-15 | ⚠️ Curated Async voice-library IDs | ❌ No; segmented rendering                                                      | ❌ Not exposed                           | ❌ Not exposed              | ⚠️ In-text pause, emphasis, and timing markup                                      | $0.01/1k chars                                         | 3/9       |

Clone ports consume protected assets and explicit consent/provenance records and never place sample bytes or contact PII in ordinary artifacts. Synthesis commands cannot invoke them. Dashboard-only, subscription-gated, and verification-gated clone or design flows are not exposed. Cartesia and Speechify text-prompt design and MiniMax/Cartesia/Speechify/Inworld/DeepInfra native multi-speaker dialogue are unsupported rather than inferred from adjacent provider features. Fish `s2.1-pro` native dialogue and timestamped streaming are implemented. Voice Design is the `voice-design-1` creation endpoint on that same model, not a second synthesis selector. Hume, MiniMax, DeepInfra, Mistral, and every stock-voice provider remain `tts`-only. fal.ai Maya stays synthesis-only until it exposes a durable voice port. Request-time model features are not represented as fabricated durable resources. Durable catalog, design, clone, inspect, and project-owned delete live under [`voice`](../step-9-voice/00-voice-overview.md).

TTS test coverage is documented in [Step 4 Service Tests: TTS](tts-tests.md).
