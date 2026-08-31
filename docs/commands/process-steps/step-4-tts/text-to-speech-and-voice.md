# tts

Generate speech audio from a local `.md` or `.txt` file, or from a directory of text files, with hosted TTS providers.

Durable voice registrations are documented separately in [`voice`](../step-9-voice/00-voice-overview.md).

## Outline

- [Setup](#setup)
  - [Environment](#environment)
- [Usage](#usage)
- [Shared TTS Options](#shared-tts-options)
- [TTS Services](#tts-services)
  - [ElevenLabs](#elevenlabs)
  - [MiniMax](#minimax)
  - [Grok](#grok)
  - [Mistral](#mistral)
  - [OpenAI](#openai)
  - [Speechify](#speechify)
  - [Hume](#hume)
  - [Cartesia](#cartesia)
  - [Fish](#fish)
  - [Inworld](#inworld)
  - [DeepInfra](#deepinfra)
- [Pricing Notes](#pricing-notes)
- [Output](#output)
- [Provider Capabilities](#provider-capabilities)

## Setup

```bash
# full setup
bun autoshow setup

# check hosted TTS API-key readiness
bun autoshow setup --doctor
```

### Environment

Hosted providers require API keys set in environment variables:

```bash
OPENAI_API_KEY=...
XAI_API_KEY=...
ELEVENLABS_API_KEY=...
MINIMAX_API_KEY=...
MISTRAL_API_KEY=...
SPEECHIFY_API_KEY=...
HUME_API_KEY=...
CARTESIA_API_KEY=...
FISH_API_KEY=...
INWORLD_API_KEY=...
DEEPINFRA_API_KEY=...
```

## Usage

```bash
bun autoshow tts <input> [flags]
```

`<input>` must be a local `.md` or `.txt` file, or a directory containing text files that are batched through `--batch-concurrency`. If no `--provider` is given, `tts` defaults to the cheapest hosted TTS provider.

## Shared TTS Options

| Flag                                               | Description                                                                                          |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `--provider provider[=model]`                      | TTS provider/model selector; repeat to run multiple targets                                          |
| `--all-providers`                                  | Select the default all-provider TTS target set                                                       |
| `--provider-concurrency <n>`                       | Hosted TTS provider/model targets to run concurrently per item; this does not limit requests inside one target; default `7` |
| `--batch-concurrency <n>`                          | Batch text files to process concurrently; default `7`                                                |
| `--concurrency-mode <ramp\|immediate>`             | Ramp from one request (`ramp`, default) or start at the configured cap (`immediate`)                 |
| `--tts-voice <provider=value\|value>`              | Generic TTS voice selector                                                                           |
| `--tts-speed <provider=value\|value>`              | Generic TTS speed                                                                                    |
| `--tts-language <provider=value\|value>`           | Generic TTS language                                                                                 |
| `--tts-ref-audio <provider=path\|path>`            | Explicit one-off Mistral reference input                                                             |
| `--tts-text-normalization <provider=value\|value>` | Generic text normalization                                                                           |
| `--tts-instructions <provider=value\|value>`       | Generic voice/style instructions                                                                     |
| `--tts-chunk-concurrency <n>`                      | Parallel requests allowed inside one hosted target; default `30` (or `50` for Grok-only)             |
| `--allow-ambiguous-redispatch`                     | Resume a stored generation that has no recoverable audio; may repurchase it                          |
| `--tts-dialogue-format <screenplay\|labeled>`      | Dialogue input format for multi-speaker TTS; requires `--tts-speaker`                                |
| `--tts-speaker SPEAKER=VOICE\|path`                | Multi-speaker voice mapping; repeatable. Selects multi-speaker TTS                                   |
| `--price`                                          | Show the aggregated estimate and exit                                                                |
| `--output-dir <dir>`                               | Global flag: pin an exact run directory instead of a timestamped output directory                    |

You can combine multiple TTS targets in one run. `--provider` is repeatable. Shared voice flags apply to every selected model for that provider.

See [Provider Capabilities](#provider-capabilities) for catalog, design, clone, multi-speaker, prompt, selector, and SSML or emotion-control support. Catalog, design, and clone are not available on `tts` or `comic generate-audio`. Use [`voice`](../step-9-voice/00-voice-overview.md) to create or change remote voices.

Multi-speaker mode requires `--tts-speaker` (repeatable) and `--tts-dialogue-format`, and exactly one active TTS provider. Reference-audio speaker paths work only with Mistral. ElevenLabs `eleven_v3`, Hume `octave-2`, and Fish `s2.1-pro` can use native grouped synthesis when the dialogue is eligible; other targets synthesize each turn and concatenate into `speech.wav`.

If a hosted target fails after producing some audio, keep the run's `.tts-tmp-*` directory so completed files can be reused. Successful finalization removes those files. If the run stops with a recovery checkpoint, pass `--allow-ambiguous-redispatch` on the next run to resume. That may purchase the interrupted request a second time.

`--provider-concurrency` limits how many provider/model targets run at once. `--tts-chunk-concurrency` limits parallel requests within one target. To cap a single Inworld target at five simultaneous requests, pass `--tts-chunk-concurrency 5`; `--provider-concurrency 5` does not.

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

ElevenLabs synthesis uses existing voices only. Single-voice text is limited to 5,000 characters. Multi-speaker `eleven_v3` supports up to 10 voices and documented v3 audio tags such as `[whispers]` and `[laughs]`.

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
```

MiniMax TTS uses existing or preset voices. Multi-speaker dialogue synthesizes each turn separately. Pause markers `<#x#>` and interjections such as `(laughs)` are supported.

### Grok

| Option             | Value                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Selector           | `--provider grok[=<model>]`                                                                                                     |
| Models             | `grok-tts`                                                                                                                      |
| Voice              | `--tts-voice <id>`, default `eve`; 26 stock voices including `eve`, `ara`, `rex`, `sal`, and `leo`, or an 8-character custom voice ID |
| Language           | `--tts-language <code>`, default `auto`                                                                                         |
| Text normalization | `--tts-text-normalization true`                                                                                                 |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider grok=grok-tts --tts-voice eve
bun autoshow tts input/examples/tts/1-tts.md --provider grok=grok-tts --tts-voice ab12cd34 --tts-language ar-SA --tts-text-normalization true
```

### Mistral

| Option        | Value                                                                      |
| ------------- | -------------------------------------------------------------------------- |
| Selector      | `--provider mistral[=<model>]`                                             |
| Models        | `voxtral-mini-tts-2603`                                                    |
| Voice source  | Existing `--tts-voice <id>` or authorized one-off `--tts-ref-audio <path>` |
| Dialogue mode | `--tts-dialogue-format screenplay\|labeled` plus repeatable `--tts-speaker SPEAKER=path` |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider mistral=voxtral-mini-tts-2603 --tts-voice voice_abc123
bun autoshow tts input/examples/tts/tts-dialogue.txt \
  --provider mistral=voxtral-mini-tts-2603 \
  --tts-dialogue-format labeled \
  --tts-speaker Host=input/examples/audio/anthony-voice.mp3 \
  --tts-speaker Guest=input/examples/audio/1-audio.mp3
```

Mistral requires an existing voice ID or an authorized one-off local reference file. Use `voice clone --provider mistral` to create and register a crash-safe saved reference.

### OpenAI

| Option   | Value                                                                 |
| -------- | --------------------------------------------------------------------- |
| Selector | `--provider openai[=<model>]`                                         |
| Models   | `gpt-4o-mini-tts-2025-12-15`                                          |
| Voice    | `--tts-voice <id>`, default `alloy`                                   |
| Controls | `--tts-instructions <text>`, `--tts-speed <0.25..4>`                  |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider openai=gpt-4o-mini-tts-2025-12-15 --tts-voice alloy
bun autoshow tts input/examples/tts/1-tts.md --provider openai=gpt-4o-mini-tts-2025-12-15 --tts-instructions "Warm documentary narration" --tts-speed 1.1
```

### Speechify

| Option   | Value                            |
| -------- | -------------------------------- |
| Selector | `--provider speechify[=<model>]` |
| Models   | `simba-3.2`                      |
| Voice    | `--tts-voice <id>`, default `geffen_32` |
| Controls | `--tts-language <tag>`           |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider speechify=simba-3.2 --tts-voice geffen_32 --tts-language en-US
bun autoshow tts input/examples/tts/1-tts.md --provider speechify=simba-3.2 --tts-voice speechify_custom_voice_123
```

Input may be plain text or SSML. Wrap SSML in `<speak>` to control pitch, rate, volume, pauses, emphasis, substitutions, and emotion via `<speechify:style emotion="...">`. Simba 3.2 is English-only.

### Hume

| Option   | Value                                                    |
| -------- | -------------------------------------------------------- |
| Selector | `--provider hume[=<model>]`                              |
| Models   | `octave-1`, `octave-2`                                   |
| Voice    | `--tts-voice <name-or-id>`, default `Male English Actor` |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider hume=octave-2
bun autoshow tts input/examples/tts/1-tts.md --provider hume=octave-2 --tts-voice "Male English Actor"
```

Hume is synthesis-only: pass an existing stock or custom voice ID with `--tts-voice`. A UUID is treated as a voice ID; any other value is looked up by name in the Hume voice library. Address a custom voice by its ID.

### Cartesia

| Option   | Value                                                                    |
| -------- | ------------------------------------------------------------------------ |
| Selector | `--provider cartesia[=<model>]`                                          |
| Models   | `sonic-3.5-2026-05-04`                                                   |
| Voice    | `--tts-voice <voice-id>`, default `f786b574-daa5-4673-aa0c-cbe3e8534c02` |
| Language | `--tts-language <code>`                                                  |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider cartesia=sonic-3.5-2026-05-04 --tts-voice f786b574-daa5-4673-aa0c-cbe3e8534c02
bun autoshow tts input/examples/tts/1-tts.md --provider cartesia=sonic-3.5-2026-05-04 --tts-language en
```

Transcripts may include SSML-like `<speed>`, `<volume>`, `<emotion>`, `<break>`, and `<spell>` tags plus `[laughter]`.

### Fish

| Option   | Value                                                          |
| -------- | -------------------------------------------------------------- |
| Selector | `--provider fish[=<model>]`                                    |
| Models   | `s2.1-pro`                                                     |
| Voice    | `--tts-voice <id>`, default `7f92f8afb8ec43bf81429cc1c9199cb1` |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider fish=s2.1-pro
bun autoshow tts input/examples/tts/1-tts.md --provider fish=s2.1-pro --tts-voice 7f92f8afb8ec43bf81429cc1c9199cb1
```

Voice design is a `s2.1-pro` capability, not a separate synthesis selector. Use [`voice`](../step-9-voice/00-voice-overview.md) to design and save a voice, then pass that ID to `tts`.

### Inworld

| Option   | Value                                                   |
| -------- | ------------------------------------------------------- |
| Selector | `--provider inworld[=<model>]`                          |
| Models   | `realtime-tts-2`                                        |
| Voice    | `--tts-voice <id>`, default `voice_inworld_standard_en` |
| Controls | `--tts-instructions <text>`                             |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider inworld=realtime-tts-2
bun autoshow tts input/examples/tts/1-tts.md --provider inworld=realtime-tts-2 --tts-voice Dennis --tts-instructions "Sound reassuring"
```

`--tts-instructions` is accepted. Inline emotion and vocalization tags such as `[happy]`, `[laugh]`, and `[breathe]` are preserved.

### DeepInfra

| Option   | Value                                                                                                                                                                                                                 |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Selector | `--provider deepinfra[=<model>]`                                                                                                                                                                                      |
| Models   | `ResembleAI/chatterbox-turbo`, `XiaomiMiMo/MiMo-V2.5-tts`, `XiaomiMiMo/MiMo-V2.5-tts-voicedesign`, `Qwen/Qwen3-TTS`, `Qwen/Qwen3-TTS-VoiceDesign`                                                                     |
| Voice    | `--tts-voice <id>`; Chatterbox defaults to the provider stock voice, MiMo TTS defaults to `mimo_default`, Qwen TTS defaults to `Vivian`; VoiceDesign models use a narration description when `--tts-voice` is omitted |
| Controls | None; MiMo TTS and Qwen TTS style instructions are not available through `--tts-instructions`                                                                                                                         |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider deepinfra=ResembleAI/chatterbox-turbo
bun autoshow tts input/examples/tts/1-tts.md --provider deepinfra=Qwen/Qwen3-TTS --tts-voice Vivian
bun autoshow tts input/examples/tts/1-tts.md --provider deepinfra=Qwen/Qwen3-TTS-VoiceDesign
```

Pass an existing account or VoiceDesign voice ID with `--tts-voice`. DeepInfra catalog, design, clone, inspection, and deletion are also available through `voice`.

## Pricing Notes

The active registry ranks only the 11 supported TTS providers. Historical rates for removed providers remain available to manifest and report readers but are excluded from selection, defaults, and `--all-providers` expansion.

| Nominal price | Active selectors |
| ---: | --- |
| Promotional `$0.00` / 1K chars | `deepinfra/XiaomiMiMo/MiMo-V2.5-tts`, `deepinfra/XiaomiMiMo/MiMo-V2.5-tts-voicedesign` |
| `$0.001` / 1K chars | `deepinfra/ResembleAI/chatterbox-turbo` |
| `$0.01` / 1K chars | `speechify/simba-3.2` |
| About `$0.0126` / 1K chars | `openai/gpt-4o-mini-tts-2025-12-15` |
| `$0.015` / 1K chars | `fish/s2.1-pro`, `grok/grok-tts` |
| `$0.016` / 1K output chars | `mistral/voxtral-mini-tts-2603` |
| `$0.02` / 1K chars | `deepinfra/Qwen/Qwen3-TTS`, `deepinfra/Qwen/Qwen3-TTS-VoiceDesign` |
| `$0.025` / 1K chars | `inworld/realtime-tts-2` |
| `$0.037375` / 1K chars | `cartesia/sonic-3.5-2026-05-04` |
| `$0.06` / 1K chars | `minimax/speech-2.8-turbo` |
| `$0.10` / 1K chars | `elevenlabs/eleven_v3`, `minimax/speech-2.8-hd` |
| `$0.15` / 1K chars | `hume/octave-1`, `hume/octave-2` |

## Output

- Single-target runs write `speech.wav` and `manifest.json`.
- Multi-target runs write `speech-<service>-<sanitized-model>.wav` per successful target and `manifest.json`.
- Dialogue runs write `dialogue-normalized.txt`. Multi-speaker runs that synthesize one turn at a time retain per-turn WAVs under `segments/`.
- Managed or custom voice runs record the voice ID, name, or reference as `speaker` in metadata.
- `manifest.json` records `tts` targets, `cost`, and `timing`.
- `--output-dir` sets the output directory; output filenames remain provider-deterministic.

## Provider Capabilities

Every active provider supports local import, registration listing, approval, retirement, and canonical audition. Remote commands are restricted by the capability registry.

| Provider | Active synthesis models | Remote catalog and lifecycle | Design | Clone |
| --- | --- | ---: | ---: | ---: |
| ElevenLabs | `eleven_v3` | Yes | Yes | Yes |
| MiniMax | `speech-2.8-hd`, `speech-2.8-turbo` | Yes | Yes | Yes |
| Grok | `grok-tts` | Yes | No | Yes |
| Mistral | `voxtral-mini-tts-2603` | Yes | No | Yes |
| OpenAI | `gpt-4o-mini-tts-2025-12-15` | No | No | Deferred |
| Speechify | `simba-3.2` | Yes | No | Deferred |
| Hume | `octave-1`, `octave-2` | Yes | Yes | External UI |
| Cartesia | `sonic-3.5-2026-05-04` | Yes | No | Yes |
| Fish | `s2.1-pro` | Yes | Yes | Yes |
| Inworld | `realtime-tts-2` | Yes | Yes | Yes |
| DeepInfra | Supported Chatterbox, Qwen, and MiMo models | Yes | Yes | Yes |

Use `voice` for durable catalog, design, clone, inspection, and deletion operations. `tts` consumes an existing voice or request-scoped reference and never creates a remote voice.
