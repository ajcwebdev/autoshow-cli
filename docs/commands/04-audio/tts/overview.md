# tts

Generate speech audio from a local `.md` or `.txt` file, or from a directory of text files, with hosted TTS providers.

`tts` uses an existing voice or a one-off Mistral `--tts-ref-audio` file. Create or manage remote voices with [`voice`](../voice/00-voice-overview.md).

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
- [Output](#output)
- [Speed and pause controls](#speed-and-pause-controls)
- [Provider Capabilities](#provider-capabilities)

## Setup

```bash
bun autoshow setup

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

| Flag                                               | Description                                                                                                                                     |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `--provider provider[=model]`                      | TTS provider/model selector; repeat to run multiple targets                                                                                     |
| `--all-providers`                                  | Select every supported hosted TTS provider/model                                                                                                |
| `--provider-concurrency <n>`                       | Hosted TTS provider/model targets to run concurrently per item; this does not limit requests inside one target; default `7`                     |
| `--batch-concurrency <n>`                          | Batch text files to process concurrently; default `7`                                                                                           |
| `--concurrency-mode <ramp\|immediate>`             | Ramp from one request (`ramp`, default) or start at the configured cap (`immediate`)                                                            |
| `--tts-voice <provider=value\|value>`              | Generic TTS voice selector                                                                                                                      |
| `--tts-speed <provider=value\|value>`              | Generic TTS speed                                                                                                                               |
| `--tts-language <provider=value\|value>`           | Generic TTS language                                                                                                                            |
| `--tts-ref-audio <provider=path\|path>`            | Explicit one-off Mistral reference input                                                                                                        |
| `--tts-text-normalization <provider=value\|value>` | Generic text normalization                                                                                                                      |
| `--tts-instructions <provider=value\|value>`       | Generic voice/style instructions                                                                                                                |
| `--tts-stability <provider=value\|value>`          | Generic TTS voice stability (ElevenLabs `0-1`)                                                                                                  |
| `--tts-similarity <provider=value\|value>`         | Generic TTS voice similarity boost (ElevenLabs `0-1`; not `eleven_v3`)                                                                          |
| `--tts-style <provider=value\|value>`              | Generic TTS voice style exaggeration (ElevenLabs `0-1`; not `eleven_v3`)                                                                        |
| `--tts-speaker-boost <provider=value\|value>`      | Generic TTS speaker boost (ElevenLabs `true\|false`; not `eleven_v3`)                                                                           |
| `--tts-seed <provider=value\|value>`               | Generic TTS deterministic generation seed (ElevenLabs `0-4294967295`)                                                                           |
| `--tts-pronunciation-dictionary <provider=value\|value>` | Generic TTS pronunciation dictionary locator as `dictionary_id` or `dictionary_id:version_id` (ElevenLabs; repeatable)                    |
| `--tts-trailing-silence <provider=value\|value>`   | Generic TTS trailing silence in seconds (Hume `0-60`)                                                                                           |
| `--tts-response-format <provider=value\|value>`    | Generic TTS audio response format (Mistral `wav\|mp3\|flac\|opus`)                                                                              |
| `--step-concurrency tts-chunk=<n>`                 | Hosted TTS requests allowed in parallel per provider; default `30`, `2` for all providers, or `50` for Grok-only                                |
| `--allow-ambiguous-redispatch`                     | Explicitly authorize repurchasing a provider-admitted TTS slot that has no recoverable audio                                                    |
| `--tts-dialogue-format <screenplay\|labeled>`      | Dialogue input format for multi-speaker TTS; requires `--tts-speaker`                                                                           |
| `--tts-speaker SPEAKER=VOICE\|path`                | Multi-speaker voice mapping; repeatable. Selects multi-speaker TTS                                                                              |
| `--price`                                          | Show the aggregated estimate and exit                                                                                                           |
| `--max-model-cents <n>`                            | Exclude each provider/model whose estimated total across the invocation exceeds the per-model ceiling in cents; works with or without `--price` |
| `--output-dir <dir>`                               | Global flag: pin an exact run directory instead of a timestamped output directory                                                               |

See [Provider Capabilities](#provider-capabilities) for the per-model instructions, speed, pause, language, dialogue, stock, design, clone, and price matrix.

Shared voice flags apply to every selected model for that provider.

Multi-speaker mode requires `--tts-speaker` (repeatable) and `--tts-dialogue-format`, and exactly one active TTS provider. Reference-audio speaker paths work only with Mistral.

If a hosted target fails after producing some audio, keep the output directory. If the run stops with a recovery checkpoint, pass `--allow-ambiguous-redispatch` on the next run to resume. That may purchase the interrupted request a second time.

`--provider-concurrency` limits how many provider/model targets run at once. `--step-concurrency tts-chunk=<n>` limits parallel requests within one provider. To cap a single Inworld target at five simultaneous requests, pass `--step-concurrency tts-chunk=5`; `--provider-concurrency 5` does not.

```bash
bun autoshow tts input/examples/tts/01-tts-short.md \
  --provider openai=gpt-4o-mini-tts-2025-12-15 \
  --tts-voice alloy

bun autoshow tts input/examples/tts/01-tts-short.md --provider elevenlabs=eleven_v3

bun autoshow tts input/examples/tts/01-tts-short.md --all-providers --max-model-cents 400
```
`--max-model-cents` estimates every selected target, then removes targets above the ceiling. For a directory, the comparison uses each provider/model's summed estimate across all selected files. Add `--price` to inspect the filtered plan without making provider calls. This differs from the configured `maxCents` budget from `setup --max-cents`, which checks the combined retained cost instead of filtering individual models.

## TTS Services

### ElevenLabs

| Option         | Value                                                                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Selector       | `--provider elevenlabs[=<model>]`                                                                                                                                         |
| Models         | `eleven_v3`                                                                                                                                                               |
| Existing voice | `--tts-voice <id>`, default `hpp4J3VqNfWAUOO0d1Us`                                                                                                                        |
| Controls       | `--tts-language`, `--tts-stability`, `--tts-seed`, `--tts-text-normalization`, `--tts-pronunciation-dictionary`. Numeric `--tts-speed`, `--tts-similarity`, `--tts-style`, and `--tts-speaker-boost` are rejected on `eleven_v3` |

```bash
bun autoshow tts input/examples/tts/01-tts-short.md --provider elevenlabs=eleven_v3 --tts-voice hpp4J3VqNfWAUOO0d1Us
```
ElevenLabs synthesis uses existing voices only. Single-voice text is limited to 5,000 characters. Multi-speaker `eleven_v3` supports up to 10 voices and documented v3 audio tags such as `[whispers]` and `[laughs]`.

### Grok

| Option             | Value                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Selector           | `--provider grok[=<model>]`                                                                                                           |
| Models             | `grok-tts`                                                                                                                            |
| Voice              | `--tts-voice <id>`, default `eve`; 26 stock voices including `eve`, `ara`, `rex`, `sal`, and `leo`, or an 8-character custom voice ID |
| Language           | `--tts-language <code>`, default `auto`                                                                                               |
| Text normalization | `--tts-text-normalization true`                                                                                                       |

```bash
bun autoshow tts input/examples/tts/01-tts-short.md --provider grok=grok-tts --tts-voice eve
bun autoshow tts input/examples/tts/01-tts-short.md --provider grok=grok-tts --tts-voice ab12cd34 --tts-language ar-SA --tts-text-normalization true
```
### Mistral

| Option        | Value                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------- |
| Selector      | `--provider mistral[=<model>]`                                                           |
| Models        | `voxtral-mini-tts-2603`                                                                  |
| Voice source  | Existing `--tts-voice <id>` or authorized one-off `--tts-ref-audio <path>`               |
| Controls      | `--tts-response-format <wav\|mp3\|flac\|opus>`                                            |
| Dialogue mode | `--tts-dialogue-format screenplay\|labeled` plus repeatable `--tts-speaker SPEAKER=path` |

```bash
bun autoshow tts input/examples/tts/01-tts-short.md --provider mistral=voxtral-mini-tts-2603 --tts-voice voice_abc123
bun autoshow tts input/examples/tts/04-tts-dialogue.txt \
  --provider mistral=voxtral-mini-tts-2603 \
  --tts-dialogue-format labeled \
  --tts-speaker Host=input/examples/audio/anthony-voice.mp3 \
  --tts-speaker Guest=input/examples/audio/1-audio.mp3
```
Mistral synthesis requires an existing voice ID or an authorized one-off local reference file. `--all-providers --price` includes Mistral in the estimate even without a voice source. A non-price `--all-providers` run without a Mistral voice source warns, skips Mistral, and continues with the other targets; an explicit Mistral selection without a voice source remains a usage error. Use `voice clone --provider mistral` to create and register a saved reference.

### OpenAI

| Option   | Value                                                |
| -------- | ---------------------------------------------------- |
| Selector | `--provider openai[=<model>]`                        |
| Models   | `gpt-4o-mini-tts-2025-12-15`                         |
| Voice    | `--tts-voice <id>`, default `alloy`                  |
| Controls | `--tts-instructions <text>`, `--tts-speed <0.25..4>` |

```bash
bun autoshow tts input/examples/tts/01-tts-short.md --provider openai=gpt-4o-mini-tts-2025-12-15 --tts-voice alloy
bun autoshow tts input/examples/tts/01-tts-short.md --provider openai=gpt-4o-mini-tts-2025-12-15 --tts-instructions "Warm documentary narration" --tts-speed 1.1
```
### Speechify

| Option   | Value                                   |
| -------- | --------------------------------------- |
| Selector | `--provider speechify[=<model>]`        |
| Models   | `simba-3.2`                             |
| Voice    | `--tts-voice <id>`, default `geffen_32` |
| Controls | `--tts-language <tag>`                  |

```bash
bun autoshow tts input/examples/tts/01-tts-short.md --provider speechify=simba-3.2 --tts-voice geffen_32 --tts-language en-US
bun autoshow tts input/examples/tts/01-tts-short.md --provider speechify=simba-3.2 --tts-voice speechify_custom_voice_123
```
Input may be plain text or SSML. Wrap SSML in `<speak>` to control pitch, rate, volume, pauses, emphasis, substitutions, and emotion via `<speechify:style emotion="...">`. Simba 3.2 is English-only.

### Hume

| Option   | Value                                                    |
| -------- | -------------------------------------------------------- |
| Selector | `--provider hume[=<model>]`                              |
| Models   | `octave-1`, `octave-2`                                   |
| Voice    | `--tts-voice <name-or-id>`, default `Male English Actor` |
| Controls | `--tts-speed <0.5..2>`, `--tts-trailing-silence <0..60>`, Octave 1 utterance `description` via `--tts-instructions` |

```bash
bun autoshow tts input/examples/tts/01-tts-short.md --provider hume=octave-2
bun autoshow tts input/examples/tts/01-tts-short.md --provider hume=octave-2 --tts-voice "Male English Actor"
bun autoshow tts input/examples/tts/01-tts-short.md --provider hume=octave-2 --tts-trailing-silence 0.5
```
Pass an existing stock or custom voice with `--tts-voice`. A UUID is treated as a voice ID; any other value is looked up by name in the Hume voice library. Address a custom voice by its ID. On Octave 1, `--tts-instructions` maps to the utterance `description` acting-instruction field.

### Cartesia

| Option   | Value                                                                    |
| -------- | ------------------------------------------------------------------------ |
| Selector | `--provider cartesia[=<model>]`                                          |
| Models   | `sonic-3.6-2026-08-27` (default)                                         |
| Voice    | `--tts-voice <voice-id>`, default `f786b574-daa5-4673-aa0c-cbe3e8534c02` |
| Language | `--tts-language <code>`                                                  |

```bash
bun autoshow tts input/examples/tts/01-tts-short.md --provider cartesia=sonic-3.6-2026-08-27 --tts-voice f786b574-daa5-4673-aa0c-cbe3e8534c02
bun autoshow tts input/examples/tts/01-tts-short.md --provider cartesia=sonic-3.6-2026-08-27 --tts-language en
```
`--tts-language` accepts Cartesia language codes and regional locales such as `en-GB`. Transcripts may include SSML-like `<speed>`, `<volume>`, `<emotion>`, `<break>`, and `<spell>` tags plus `[laughter]`.

### Inworld

| Option   | Value                                                            |
| -------- | ---------------------------------------------------------------- |
| Selector | `--provider inworld[=<model>]`                                   |
| Models   | `realtime-tts-2` (default)                                       |
| Voice    | `--tts-voice <id>`, default Dennis (`voice_inworld_standard_en`) |
| Controls | `--tts-instructions <text>` on `realtime-tts-2`                  |

```bash
bun autoshow tts input/examples/tts/01-tts-short.md --provider inworld=realtime-tts-2
bun autoshow tts input/examples/tts/01-tts-short.md --provider inworld=realtime-tts-2 --tts-voice Dennis --tts-instructions "Sound reassuring"
```
Inline emotion and vocalization tags such as `[happy]`, `[laugh]`, and `[breathe]` are preserved.

## Output

- Single-target runs write `speech.wav` and `manifest.json`.
- Multi-target runs write `speech-<service>-<sanitized-model>.wav` per successful target and `manifest.json`.
- Dialogue runs write `dialogue-normalized.txt`. Multi-speaker runs that synthesize one turn at a time retain per-turn WAVs under `segments/`.
- Successful runs also write `render.json` and `timeline.json`.
- Managed or custom voice runs record the voice ID, name, or reference as `speaker` in metadata.
- `manifest.json` records `tts` targets, `cost`, and `timing`.
- `--output-dir` sets the output directory; output filenames remain provider-deterministic.

## Speed and pause controls

`--tts-speed` is a numeric control for OpenAI (0.25–4), Grok (0.7–1.5), Cartesia (0.6–1.5), Hume (0.5–2), and Inworld (0.5–1.5). Hume uses a nonlinear relative scale; 2 does not promise twice the speaking rate. Cartesia treats its value as guidance.

Eleven v3 does not support `--tts-speed`. Use its pacing audio tags and punctuation. Speechify uses SSML rate keywords or signed percentage adjustments instead of a numeric request field. Inworld also accepts inline steering and `--tts-instructions`.

Pause syntax is provider-specific: Speechify, Cartesia, and Inworld accept timed SSML breaks; Hume accepts utterance trailing silence in seconds and inline pause tags; Grok accepts `[pause]` and `[long-pause]`; Eleven v3 accepts pause audio tags but not SSML breaks. OpenAI pause instructions are qualitative.

## Provider Capabilities

Marks: ✅ supported, ⚠️ partial or qualified, ❌ not exposed. Released dates are provider announcement or model-origin dates. Recency marks: ✅ 2026-04-01 or later, ⚠️ 2026-01-01 through 2026-03-31, ❌ before 2026-01-01. Rows are newest first.

Instructions is synthesis-time delivery for the already selected voice. It is not voice design, cloning, `--tts-ref-audio`, numeric `--tts-speed`, or pause control.

- ✅ dedicated non-spoken request field: `--tts-instructions` serializes as OpenAI `instructions` or Inworld `instruction`. Hume Octave 1 uses utterance `description` (acting instructions), which is a separate field and is not `--tts-instructions`. These fields are not spoken as script text.
- ⚠️ spoken-text markup: the directive is inside the synthesis input. Use the provider-native name only: ElevenLabs audio tags, Grok speech tags, Speechify SSML, or Cartesia SSML-like tags. Inworld also accepts inline steering tags in addition to `--tts-instructions`. Markup is not `--tts-instructions` and is not Hume `description`.
- ❌ not exposed: no dedicated field and no markup path in this adapter.

Speed: ✅ numeric `--tts-speed`, ⚠️ SSML or tags only, ❌ not exposed on the implemented model. Pause: ✅ timed SSML or request silence, ⚠️ qualitative tags or trailing silence, ❌ not exposed. Language: ✅ `--tts-language`, ⚠️ English-only, ❌ not exposed. Native dialogue: ✅ multi-speaker in one provider request, ⚠️ native utterances, ❌ local assembly only. All providers can participate in locally segmented multi-speaker rendering.

Stock: ✅ provider-stock or built-in library voices selectable with `--tts-voice`. Design: ✅ `voice design` text-prompt creation. Clone: ✅ `voice clone` instant clone from authorized samples, ⚠️ provider-platform clone registered with `voice import`, ❌ not exposed. Hume Voice Design uses creation model `octave-1` even when the saved voice synthesizes with Octave 2.

Pricing is the AutoShow estimate rate. Pricing: ✅ cheapest third, ⚠️ middle third, ❌ most expensive third. Cost rank is cheapest first (1 = cheapest); ties share a rank. Cartesia estimates use a Scale-plan credit allocation, not a universal per-character tariff.

| Provider                            | Released     | Instructions                  | Speed                   | Pause               | Language           | Native dialogue      | Stock | Design | Clone                   | Pricing                                              | Cost rank |
| ----------------------------------- | ------------ | ----------------------------- | ----------------------- | ------------------- | ------------------ | -------------------- | ----- | ------ | ----------------------- | ---------------------------------------------------- | --------- |
| Cartesia `sonic-3.6-2026-08-27`     | ✅ 2026-08-27 | ⚠️ SSML-like `<emotion>` tags | ✅ `--tts-speed` 0.6–1.5 | ✅ SSML `<break>`    | ✅ `--tts-language` | ❌ Local assembly     | ✅     | ❌      | ✅                       | ❌ `$0.037375` / 1K chars (Scale allocation estimate) | 6/9       |
| Speechify `simba-3.2`               | ✅ 2026-07-08 | ⚠️ SSML `<speechify:style>`   | ⚠️ SSML rate            | ✅ SSML breaks       | ⚠️ English only    | ❌ Local assembly     | ✅     | ❌      | ❌                       | ✅ `$0.01` / 1K chars                                 | 1/9       |
| Inworld `realtime-tts-2`            | ✅ 2026-05-05 | ✅ `--tts-instructions`        | ✅ `--tts-speed` 0.5–1.5 | ✅ SSML breaks       | ❌ Not exposed      | ❌ Local assembly     | ✅     | ✅      | ✅                       | ⚠️ `$0.025` / 1K chars                               | 5/9       |
| Grok `grok-tts`                     | ✅ 2026-04    | ⚠️ Speech tags                | ✅ `--tts-speed` 0.7–1.5 | ⚠️ `[pause]` tags   | ✅ `--tts-language` | ❌ Local assembly     | ✅     | ❌      | ✅                       | ✅ `$0.015` / 1K chars                                | 3/9       |
| Mistral `voxtral-mini-tts-2603`     | ⚠️ 2026-03   | ❌ Not exposed                 | ❌ Not exposed           | ❌ Not exposed       | ❌ Not exposed      | ❌ Local assembly     | ✅     | ❌      | ✅                       | ⚠️ `$0.016` / 1K output chars                        | 4/9       |
| ElevenLabs `eleven_v3`              | ⚠️ 2026-02   | ⚠️ Audio tags                 | ❌ Not exposed           | ⚠️ Audio tags       | ✅ `--tts-language` | ✅ Up to 10 voices    | ✅     | ✅      | ✅                       | ❌ `$0.10` / 1K chars                                 | 7/9       |
| OpenAI `gpt-4o-mini-tts-2025-12-15` | ❌ 2025-12-15 | ✅ `--tts-instructions`        | ✅ `--tts-speed` 0.25–4  | ⚠️ Qualitative only | ❌ Not exposed      | ❌ Local assembly     | ✅     | ❌      | ❌                       | ✅ About `$0.0126` / 1K chars                         | 2/9       |
| Hume `octave-2`                     | ❌ 2025-10    | ❌ Not exposed                 | ✅ `--tts-speed` 0.5–2   | ⚠️ Trailing silence | ❌ Not exposed      | ⚠️ Native utterances | ✅     | ✅      | ⚠️ Platform then import | ❌ `$0.15` / 1K chars                                 | 8/9       |
| Hume `octave-1`                     | ❌ 2025-02-26 | ✅ Utterance `description`     | ✅ `--tts-speed` 0.5–2   | ⚠️ Trailing silence | ❌ Not exposed      | ❌ Segmented          | ✅     | ✅      | ⚠️ Platform then import | ❌ `$0.15` / 1K chars                                 | 8/9       |
