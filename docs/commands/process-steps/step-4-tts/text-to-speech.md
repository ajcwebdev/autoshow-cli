# tts

Generate speech audio from a local `.md` or `.txt` file with local or hosted TTS providers.

## Outline

- [Setup](#setup)
  - [Environment](#environment)
- [Usage](#usage)
- [Voice Management](voice-management.md)
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
- [Pricing Notes](#pricing-notes)
- [Output](#output)

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
| `--provider-concurrency <n>` | Hosted TTS providers/models to run concurrently per item; default `10` |
| `--local-concurrency <n>` | Local TTS providers to run concurrently per item; default `10` |
| `--batch-concurrency <n>` | Batch text files to process concurrently; default `10` |
| `--tts-voice <provider=value\|value>` | Generic TTS voice selector |
| `--tts-speed <provider=value\|value>` | Generic TTS speed |
| `--tts-language <provider=value\|value>` | Generic TTS language |
| `--tts-ref-audio <provider=path\|path>` | Explicit one-off Mistral reference input |
| `--tts-text-normalization <provider=value\|value>` | Generic text normalization |
| `--tts-instructions <provider=value\|value>` | Generic voice/style instructions |
| `--tts-output-format <provider=value\|value>` | Generic output format |
| `--tts-chunk-concurrency <n>` | Hosted TTS chunk starts allowed in parallel per provider; default `30` (or `50` for Grok-only) |
| `--tts-dialogue-format <screenplay\|labeled>` | Dialogue input format for multi-speaker TTS; requires `--tts-speaker` |
| `--tts-speaker SPEAKER=VOICE\|path` | Multi-speaker voice mapping; repeatable. Selects multi-speaker TTS |
| `--price` | Show the aggregated estimate and exit |
| `--output-dir <dir>` | Global flag: pin an exact run directory instead of a timestamped output directory |

You can combine multiple TTS targets in one run. `--provider` is repeatable. Shared voice flags apply to every selected model for that provider.

### Dialogue and Voice-Management Capabilities

| Provider | Multi-speaker render | Catalog/design/clone management |
|---|---|---|
| Gemini | Native only for exactly two speakers when representable; otherwise segmented | Existing voice names only |
| ElevenLabs | Native `eleven_v3` Text-to-Dialogue when eligible; otherwise segmented | Catalogs, design, remix, instant clone, PVC state, inspect/delete |
| Hume | Native Octave 2 utterances when eligible; otherwise segmented | Catalogs, Octave 1 design, gated external clone, inspect/delete |
| Mistral | Segmented | Existing/saved voices and protected one-off references |
| MiniMax | Segmented | System/account catalog, temporary design, instant clone, inspect/delete |
| Cartesia | Segmented | Public/account catalog, instant clone, gated Pro clone, inspect/delete |
| Speechify | Segmented | Shared/personal catalog, personal clone, inspect/delete |
| Kitten, Groq, Grok, OpenAI, Deepgram | Segmented | Existing/local voice selectors only |

Voice management is separate from synthesis. A catalog, design, or clone capability does not authorize `tts` or `comic generate-audio` to create a remote resource.

AutoShow splits TTS text into 2000-character chunks (200-character chunks for Groq Orpheus). Hosted providers synthesize through `--tts-chunk-concurrency` (default `30`, or `50` for Grok-only). Kitten synthesizes chunks sequentially.

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
| Models | `eleven_v3`, `eleven_multilingual_v2`, `eleven_flash_v2_5` |
| Existing voice | `--tts-voice <id>`, default `hpp4J3VqNfWAUOO0d1Us` |
| Controls | `--tts-output-format`, `--tts-language`, `--elevenlabs-tts-stability`, `--elevenlabs-tts-similarity-boost`, `--elevenlabs-tts-style`, `--elevenlabs-tts-use-speaker-boost`, `--tts-speed`, `--elevenlabs-tts-seed`, `--tts-text-normalization`, `--elevenlabs-tts-pronunciation-dictionary-locator`, `--elevenlabs-tts-optimize-streaming-latency` |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider elevenlabs=eleven_v3 --tts-voice hpp4J3VqNfWAUOO0d1Us
```

ElevenLabs synthesis uses existing voices only. Single-voice text character limits are 5,000 for `eleven_v3`, 10,000 for `eleven_multilingual_v2`, and 40,000 for `eleven_flash_v2_5`. Multi-speaker `eleven_v3` uses the timestamped Text-to-Dialogue endpoint when turn boundaries, voices (max 10), and documented v3 audio tags can be represented natively; other models use the segmented path.

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
| Models | `canopylabs/orpheus-v1-english`, `canopylabs/orpheus-arabic-saudi` |
| Voice | `--tts-voice <id>`; English voices `autumn`, `diana`, `hannah`, `austin`, `daniel`, `troy` (default `troy`); Saudi Arabic voices `abdullah`, `fahad`, `sultan`, `lulwa`, `noura`, `aisha` (default `abdullah`) |

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
| Models | `gpt-4o-mini-tts-2025-12-15`, `tts-1`, `tts-1-hd` |
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
| Models | `simba-3.2`, `simba-3.0` |
| Voice | `--tts-voice <id>`, default `geffen_32` |
| Controls | `--tts-output-format mp3\|ogg\|aac\|wav\|pcm`, `--tts-language <tag>` |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider speechify=simba-3.2 --tts-voice geffen_32 --tts-language en-US --tts-output-format mp3
bun autoshow tts input/examples/tts/1-tts.md --provider speechify=simba-3.0 --tts-language fr-FR
bun autoshow tts input/examples/tts/1-tts.md --provider speechify=simba-3.2 --tts-voice speechify_custom_voice_123
bun autoshow config --tts speechify=simba-3.2 --tts-voice speechify_custom_voice_123
```

Speechify TTS sends text chunks to `POST /v1/audio/speech` and converts the output to `speech.wav`. Simba 3.2 is English-only with curated built-ins; Simba 3.0 supports multilingual tags and the full voice catalog.

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

Cartesia TTS uses `POST /tts/bytes` requesting 24000 Hz PCM WAV bytes converted to `speech.wav`. Text is split into 2000-character chunks.

## Pricing Notes

- **ElevenLabs**: `$0.10` / 1K chars (`eleven_v3`, `eleven_multilingual_v2`), `$0.05` / 1K chars (`eleven_flash_v2_5`).
- **MiniMax**: `$0.06` / 1K chars (`speech-2.8-turbo`), `$0.10` / 1K chars (`speech-2.8-hd`).
- **Groq**: `$22` / 1M chars (English Orpheus), `$40` / 1M chars (Saudi Arabic Orpheus).
- **Grok**: `$15` / 1M chars (`$0.015` / 1K chars).
- **Mistral**: `$16` / 1M output chars (`$0.016` / 1K chars).
- **OpenAI**: `$0.60` / 1M input + `$12` / 1M output chars (`gpt-4o-mini-tts-2025-12-15`); `$15` / 1M chars (`tts-1`), `$30` / 1M chars (`tts-1-hd`).
- **Gemini**: `$1` / 1M input + `$20` / 1M output chars (`gemini-3.1-flash-tts-preview`).
- **Deepgram**: `$0.03` / 1K chars.
- **Speechify**: `$0.01` / 1K chars (`simba-3.2`, `simba-3.0`).
- **Hume**: `$0.15` / 1K chars (`octave-1`, `octave-2`).
- **Cartesia**: `$0.037375` / 1K chars (`sonic-3.5-2026-05-04`).

## Output

- Single-target runs write `speech.wav` and `manifest.json`.
- Multi-target runs write `speech-<service>-<sanitized-model>.wav` per successful target and `manifest.json`.
- Dialogue runs write `dialogue-normalized.txt`. Segmented runs retain per-turn WAVs under `segments/`.
- Managed/custom voice runs record the resource ID, voice name, or reference tag as `speaker` in metadata.
- `manifest.json` records metadata including `tts` targets array, `cost`, and `timing`.
- `--output-dir` sets the output directory; output filenames remain provider-deterministic.
