# tts

Generate speech audio from a local `.md` or `.txt` file, or from a directory of text files, with hosted TTS providers.

Durable voice registrations are documented separately in [`voice`](../voice/00-voice-overview.md).

## Outline

- [Setup](#setup)
  - [Environment](#environment)
- [Usage](#usage)
- [Shared TTS Options](#shared-tts-options)
- [TTS Services](#tts-services)
  - [ElevenLabs](#elevenlabs)
  - [Grok](#grok)
  - [Mistral](#mistral)
  - [OpenAI](#openai)
  - [Speechify](#speechify)
  - [Hume](#hume)
  - [Cartesia](#cartesia)
  - [Inworld](#inworld)
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
MISTRAL_API_KEY=...
SPEECHIFY_API_KEY=...
HUME_API_KEY=...
CARTESIA_API_KEY=...
INWORLD_API_KEY=...
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
| `--all-providers`                                  | Select every supported hosted TTS provider/model                                                     |
| `--provider-concurrency <n>`                       | Hosted TTS provider/model targets to run concurrently per item; this does not limit requests inside one target; default `7` |
| `--batch-concurrency <n>`                          | Batch text files to process concurrently; default `7`                                                |
| `--concurrency-mode <ramp\|immediate>`             | Ramp from one request (`ramp`, default) or start at the configured cap (`immediate`)                 |
| `--tts-voice <provider=value\|value>`              | Generic TTS voice selector                                                                           |
| `--tts-speed <provider=value\|value>`              | Generic TTS speed                                                                                    |
| `--tts-language <provider=value\|value>`           | Generic TTS language                                                                                 |
| `--tts-ref-audio <provider=path\|path>`            | Explicit one-off Mistral reference input                                                             |
| `--tts-text-normalization <provider=value\|value>` | Generic text normalization                                                                           |
| `--tts-instructions <provider=value\|value>`       | Generic voice/style instructions                                                                     |
| `--tts-chunk-concurrency <n>`                      | Hosted TTS chunk starts allowed in parallel per provider across the current run; default `30`, `2` for all providers, or `50` for Grok-only |
| `--allow-ambiguous-redispatch`                     | Explicitly authorize repurchasing a provider-admitted TTS slot that has no recoverable audio         |
| `--tts-dialogue-format <screenplay\|labeled>`      | Dialogue input format for multi-speaker TTS; requires `--tts-speaker`                                |
| `--tts-speaker SPEAKER=VOICE\|path`                | Multi-speaker voice mapping; repeatable. Selects multi-speaker TTS                                   |
| `--price`                                          | Show the aggregated estimate and exit                                                                |
| `--max-model-cents <n>`                            | Exclude each provider/model whose estimated total across the invocation exceeds the per-model ceiling in cents; works with or without `--price` |
| `--output-dir <dir>`                               | Global flag: pin an exact run directory instead of a timestamped output directory                    |

You can combine multiple TTS targets in one run. `--provider` is repeatable. Shared voice flags apply to every selected model for that provider.

Catalog, design, and clone are not available on `tts` or `comic generate-audio`. Use [`voice`](../voice/00-voice-overview.md) to create or change remote voices.

Multi-speaker mode requires `--tts-speaker` (repeatable) and `--tts-dialogue-format`, and exactly one active TTS provider. Reference-audio speaker paths work only with Mistral. ElevenLabs `eleven_v3` and Hume `octave-2` can use native grouped synthesis when the dialogue is eligible; other targets synthesize each turn and concatenate into `speech.wav`.

If a hosted target fails after producing some audio, keep the run's `.tts-tmp-*` directory so completed files can be reused. If the run stops with a recovery checkpoint, pass `--allow-ambiguous-redispatch` on the next run to resume. That may purchase the interrupted request a second time.

`--provider-concurrency` limits how many provider/model targets run at once. `--tts-chunk-concurrency` limits parallel chunk starts within one provider across the run, including multiple items. Defaults are `30` for a single hosted target, `50` for Grok-only, and `2` for `--all-providers`. To cap a single Inworld target at five simultaneous requests, pass `--tts-chunk-concurrency 5`; `--provider-concurrency 5` does not.

```bash
bun autoshow tts input/examples/tts/1-tts.md \
  --provider openai=gpt-4o-mini-tts-2025-12-15 \
  --tts-voice alloy

bun autoshow tts input/examples/tts/1-tts.md --provider elevenlabs=eleven_v3

# Keep only TTS provider/model runs estimated at $4 or less
bun autoshow tts input/book.md --all-providers --max-model-cents 400
```

`--max-model-cents` first estimates every selected target, then removes targets above the ceiling before provider readiness checks, output planning, or synthesis. For a directory, the comparison uses each provider/model's summed estimate across all selected files. Add `--price` to inspect the filtered plan without making provider calls. This differs from the configured `--max-cents` command-wide budget, which checks the combined retained cost instead of filtering individual models.

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

Mistral synthesis requires an existing voice ID or an authorized one-off local reference file. `--all-providers --price` includes Mistral in the estimate even without a voice source. A non-price `--all-providers` run without a Mistral voice source warns, skips Mistral, and continues with the other targets; an explicit Mistral selection without a voice source remains a usage error. Use `voice clone --provider mistral` to create and register a saved reference.

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

Pass an existing stock or custom voice with `--tts-voice`. A UUID is treated as a voice ID; any other value is looked up by name in the Hume voice library. Address a custom voice by its ID.

### Cartesia

| Option   | Value                                                                    |
| -------- | ------------------------------------------------------------------------ |
| Selector | `--provider cartesia[=<model>]`                                          |
| Models   | `sonic-3.6-2026-08-27` (default)                  |
| Voice    | `--tts-voice <voice-id>`, default `f786b574-daa5-4673-aa0c-cbe3e8534c02` |
| Language | `--tts-language <code>`                                                  |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider cartesia=sonic-3.6-2026-08-27 --tts-voice f786b574-daa5-4673-aa0c-cbe3e8534c02
bun autoshow tts input/examples/tts/1-tts.md --provider cartesia=sonic-3.6-2026-08-27 --tts-language en
```

`--tts-language` accepts Cartesia language codes and regional locales such as `en-GB`. Transcripts may include SSML-like `<speed>`, `<volume>`, `<emotion>`, `<break>`, and `<spell>` tags plus `[laughter]`.

### Inworld

| Option   | Value                                                   |
| -------- | ------------------------------------------------------- |
| Selector | `--provider inworld[=<model>]`                          |
| Models   | `realtime-tts-2` (default)      |
| Voice    | `--tts-voice <id>`, default Dennis (`voice_inworld_standard_en`) |
| Controls | `--tts-instructions <text>` on `realtime-tts-2` |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider inworld=realtime-tts-2
bun autoshow tts input/examples/tts/1-tts.md --provider inworld=realtime-tts-2 --tts-voice Dennis --tts-instructions "Sound reassuring"
```

Inline emotion and vocalization tags such as `[happy]`, `[laugh]`, and `[breathe]` are preserved.

## Pricing Notes

| Nominal price | Active selectors |
| ---: | --- |
| `$0.01` / 1K chars | `speechify/simba-3.2` |
| About `$0.0126` / 1K chars | `openai/gpt-4o-mini-tts-2025-12-15` |
| `$0.015` / 1K chars | `grok/grok-tts` |
| `$0.016` / 1K output chars | `mistral/voxtral-mini-tts-2603` |
| `$0.025` / 1K chars | `inworld/realtime-tts-2` |
| `$0.037375` / 1K chars (Scale allocation estimate) | `cartesia/sonic-3.6-2026-08-27` |
| `$0.10` / 1K chars | `elevenlabs/eleven_v3` |
| `$0.15` / 1K chars | `hume/octave-1`, `hume/octave-2` |

Cartesia estimates use a Scale-plan credit allocation, not a universal per-character tariff.

## Output

- Single-target runs write `speech.wav` and `manifest.json`.
- Multi-target runs write `speech-<service>-<sanitized-model>.wav` per successful target and `manifest.json`.
- Dialogue runs write `dialogue-normalized.txt`. Multi-speaker runs that synthesize one turn at a time retain per-turn WAVs under `segments/`.
- Managed or custom voice runs record the voice ID, name, or reference as `speaker` in metadata.
- `manifest.json` records `tts` targets, `cost`, and `timing`.
- `--output-dir` sets the output directory; output filenames remain provider-deterministic.

Successful standalone and directory-batch runs automatically compact each provider's working metadata into `render.json` and `timeline.json`, alongside the shared manifest, input plan and cached audio slots. The controls benchmark uses this same path. Resume also compacts completed synthesis. Working journals remain available during synthesis and after failure or interruption; cleanup runs only after the successful archive is published. Completing one provider never prunes another provider's paid audio slots.

## Provider Capabilities

`tts` synthesizes with an existing voice or a request-scoped Mistral reference and does not create remote voices. Catalog, design, clone, inspection, and deletion live on [`voice`](../voice/00-voice-overview.md).

## Speed and pause controls

`--tts-speed` sends a provider request field for OpenAI (0.25–4), Grok (0.7–1.5), Cartesia (0.6–1.5), Hume (0.5–2), and Inworld (0.5–1.5). Hume uses a nonlinear relative scale; 2 does not promise twice the speaking rate. Cartesia treats its value as guidance. Values do not alter the output audio sample rate. Explicit per-turn speed controls override the CLI default; `null` clears that default for a turn.

Eleven v3 does not support numeric speed, so selecting it with `--tts-speed` fails before synthesis. Use its pacing audio tags and punctuation. The generic ElevenLabs speed range applies only to compatible models, not v3. Speechify uses SSML rate keywords or signed percentage adjustments instead of a numeric request field. Inworld TTS-2 also accepts inline steering and the instruction field; numeric `--tts-speed` is sent as REST `audioConfig.speakingRate`.

Pause syntax is provider-specific: Speechify, Cartesia and Inworld accept timed SSML breaks; Hume accepts utterance trailing silence in seconds and inline pause tags; Grok accepts `[pause]` and `[long-pause]`; Eleven v3 accepts pause audio tags but not SSML breaks. OpenAI pause instructions are qualitative. Do not multiply pacing controls from different methods in one speed test, and reset speed or steering before testing pauses.

The [speed/pause benchmark audit](../../../benchmarks/tts/2026-09-12_detailed-instructions/2026-09-12_06-tts-speed-pauses/benchmark-report.md) documents exact native fields, syntax, sources and exclusions. The [emotion benchmark](../../../benchmarks/tts/2026-09-12_detailed-instructions/2026-09-12_05-tts-emotion/benchmark-report.md) is separate. Both exclude nonverbal vocalizations and sound effects.
