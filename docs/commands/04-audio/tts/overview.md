# tts

Generate speech audio from a local `.md` or `.txt` file, or from a directory of text files, with hosted TTS providers.

`tts` uses an existing voice or a one-off Mistral `--tts-ref-audio` file. Create or manage remote voices with [`voice`](../voice/00-voice-overview.md).

## Outline

- [Setup](#setup)
  - [Environment](#environment)
- [Usage](#usage)
- [Shared TTS Options](#shared-tts-options)
- [Audio Mastering and Export](#audio-mastering-and-export)
  - [Chunking and seams](#chunking-and-seams)
  - [Audiobook workflow](#audiobook-workflow)
  - [Existing output directories](#existing-output-directories)
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

| Flag                                                     | Description                                                                                                                                     |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `--provider provider[=model]`                            | TTS provider/model selector; repeat to run multiple targets                                                                                     |
| `--all-providers`                                        | Select every supported hosted TTS provider/model                                                                                                |
| `--provider-concurrency <n>`                             | Hosted TTS provider/model targets to run concurrently per item; this does not limit requests inside one target; default `7`                     |
| `--batch-concurrency <n>`                                | Batch text files to process concurrently; default `7`                                                                                           |
| `--concurrency-mode <ramp\|immediate>`                   | Ramp from one request (`ramp`, default) or start at the configured cap (`immediate`)                                                            |
| `--tts-voice <provider=value\|value>`                    | Generic TTS voice selector                                                                                                                      |
| `--tts-speed <provider=value\|value>`                    | Generic TTS speed                                                                                                                               |
| `--tts-language <provider=value\|value>`                 | Generic TTS language                                                                                                                            |
| `--tts-ref-audio <provider=path\|path>`                  | Explicit one-off Mistral reference input                                                                                                        |
| `--tts-text-normalization <provider=value\|value>`       | Generic text normalization                                                                                                                      |
| `--tts-instructions <provider=value\|value>`             | Generic voice/style instructions                                                                                                                |
| `--tts-stability <provider=value\|value>`                | Generic TTS voice stability (ElevenLabs `0-1`)                                                                                                  |
| `--tts-similarity <provider=value\|value>`               | Generic TTS voice similarity boost (ElevenLabs `0-1`; not `eleven_v3`)                                                                          |
| `--tts-style <provider=value\|value>`                    | Generic TTS voice style exaggeration (ElevenLabs `0-1`; not `eleven_v3`)                                                                        |
| `--tts-speaker-boost <provider=value\|value>`            | Generic TTS speaker boost (ElevenLabs `true\|false`; not `eleven_v3`)                                                                           |
| `--tts-seed <provider=value\|value>`                     | Generic TTS deterministic generation seed (ElevenLabs `0-4294967295`)                                                                           |
| `--tts-pronunciation-dictionary <provider=value\|value>` | Generic TTS pronunciation dictionary locator as `dictionary_id` or `dictionary_id:version_id` (ElevenLabs; repeatable)                          |
| `--tts-trailing-silence <provider=value\|value>`         | Generic TTS trailing silence in seconds (Hume `0-60`)                                                                                           |
| `--tts-response-format <provider=value\|value>`          | Provider source audio format (Mistral `wav\|mp3\|flac\|opus`; ElevenLabs `mp3_44100_128\|mp3_44100_192\|wav_44100\|wav_48000`; Hume `mp3\|wav`) |
| `--step-concurrency tts-chunk=<n>`                       | Hosted TTS requests allowed in parallel per provider; default `30`, `2` under `--all-providers`, or `50` for Grok-only                          |
| `--allow-ambiguous-redispatch`                           | Explicitly authorize repurchasing a provider-admitted TTS slot that has no recoverable audio                                                    |
| `--tts-dialogue-format <screenplay\|labeled>`            | Dialogue input format for multi-speaker TTS; requires `--tts-speaker`                                                                           |
| `--tts-speaker SPEAKER=VOICE\|path`                      | Multi-speaker voice mapping; repeatable. Selects multi-speaker TTS                                                                              |
| `--price`                                                | Show the aggregated estimate and exit                                                                                                           |
| `--max-model-cents <n>`                                  | Exclude each provider/model whose estimated total across the invocation exceeds the per-model ceiling in cents; works with or without `--price` |
| `--output-dir <dir>`                                     | Global flag: pin an exact run directory instead of a timestamped output directory                                                               |

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

## Audio Mastering and Export

These flags apply to every provider. They run locally with ffmpeg after synthesis and never add provider requests.

| Flag                                                  | Description                                                                                                                                         |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--tts-audio-profile <native\|audiobook\|legacy-16k>` | Final audio profile; default `native`                                                                                                               |
| `--tts-sample-rate <hz>`                              | Final sample rate: `16000`, `22050`, `24000`, `32000`, `44100`, or `48000`; default from the profile                                                |
| `--tts-channels <1\|2>`                               | Final channel count; default from the profile                                                                                                       |
| `--tts-loudness <lufs\|off>`                          | Integrated loudness target from `-40` to `-5` LUFS, or `off`; default from the profile                                                              |
| `--tts-true-peak <dbtp>`                              | True-peak ceiling from `-9` to `0` dBTP, used with loudness normalization                                                                           |
| `--tts-trim-silence <on\|off>`                        | Trim provider silence at chunk seams before inserting pauses; default `on`                                                                          |
| `--tts-paragraph-pause <ms>`                          | Pause at paragraph and speaker-turn seams, `0-10000`; default `750`                                                                                 |
| `--tts-sentence-pause <ms>`                           | Pause at sentence seams, `0-10000`; default `350`                                                                                                   |
| `--tts-lead-in <ms>`                                  | Silence before the first audio, `0-10000`                                                                                                           |
| `--tts-lead-out <ms>`                                 | Silence after the last audio, `0-10000`                                                                                                             |
| `--tts-chunk-boundary <smart\|legacy>`                | How text is split into provider requests; default `smart`                                                                                           |
| `--tts-chunk-size <chars>`                            | Maximum characters per request, `100` or more; clamped to the provider/model limit                                                                  |
| `--tts-pronunciations <file>`                         | Local JSON pronunciation lexicon applied to the text for every provider                                                                             |
| `--tts-text-preflight <on\|off>`                      | Check the text for unsupported speech markup before dispatch; default `on`                                                                          |
| `--tts-export-format <wav\|flac\|mp3\|m4a\|m4b>`      | Delivered container written beside the WAV master; default `wav`                                                                                    |
| `--tts-bitrate <kbps>`                                | Bitrate for `mp3`, `m4a`, and `m4b`, `32-320`; default `192` for mp3 and `96` for m4a/m4b                                                           |
| `--tts-metadata key=value`                            | Tag for non-WAV exports; repeatable. Keys: `title`, `artist`, `album`, `album_artist`, `composer`, `date`, `genre`, `comment`, `track`, `copyright` |
| `--tts-cover <image>`                                 | `.jpg` or `.png` cover art embedded in `flac`, `mp3`, `m4a`, and `m4b` exports                                                                      |
| `--tts-book`                                          | Directory input only: also assemble one book file with a chapter marker per input file                                                              |

Profiles:

| Profile      | Sample rate and channels             | Loudness              | Lead-in / lead-out | Use                                  |
| ------------ | ------------------------------------ | --------------------- | ------------------ | ------------------------------------ |
| `native`     | The provider's own rate and channels | None                  | `0` / `0` ms       | Default; keeps full provider quality |
| `audiobook`  | 44.1 kHz mono                        | `-19` LUFS, `-3` dBTP | `500` / `1000` ms  | Book chapters with consistent level  |
| `legacy-16k` | 16 kHz mono                          | None                  | None               | No seam trimming, pauses, or export  |

All settings except `--tts-metadata`, `--tts-cover`, `--tts-book`, and `--tts-pronunciations` can be saved as `config/autoshow.json` defaults through `setup`.

### Chunking and seams

Text longer than a provider's request limit is split into chunks, synthesized in parallel, and joined locally. `smart` chunking balances chunk sizes and cuts at the best boundary near each target length: a paragraph break, then a sentence end, then clause punctuation, then a space. It does not cut inside a bracketed delivery tag. `legacy` cuts at the last newline or last space before the limit.

At each seam, mastering trims the provider's leading and trailing silence and inserts a fixed pause for that boundary, so pacing does not depend on how much silence a provider returned. Separate input paragraphs with blank lines so seams land on paragraph breaks.

Providers do not share voice state between chunks. For `eleven_v3`, pin `--tts-seed` and a moderate `--tts-stability` so chunks stay consistent, and lower `--tts-chunk-size` if long requests drift.

### Audiobook workflow

```bash
# Estimate first; no provider calls
bun autoshow tts input/books/my-book --provider elevenlabs=eleven_v3 --price

# One m4b per chapter file plus book.m4b with chapter markers
bun autoshow tts input/books/my-book \
  --provider elevenlabs=eleven_v3 --tts-voice YOUR_VOICE_ID \
  --tts-stability 0.5 --tts-seed 12345 --tts-text-normalization on \
  --tts-audio-profile audiobook --tts-export-format m4b --tts-book \
  --tts-metadata "title=My Book" --tts-metadata "artist=Author Name" \
  --tts-cover input/books/my-book/cover.jpg \
  --tts-pronunciations input/books/my-book/lexicon.json \
  --output-dir output/my-book
```
Chapters follow input filename order with numeric collation, and chapter titles come from the filenames. `m4b` is the most widely supported container for chapter markers; MP3 chapter support varies by player. What a later run reuses or rebuilds is covered in [Existing output directories](#existing-output-directories).

A pronunciation lexicon is a JSON array of alias rules. Rules match whole words and are case sensitive unless stated otherwise. The earliest match wins, ties go to the earlier rule, and inserted aliases are never rescanned. Avoid rules that match speaker labels in dialogue input. The lexicon changes the text sent to the provider, so billing and chunking use the substituted text.

```json
[
  { "match": "Claughton", "alias": "Cloffton" },
  { "match": "UN", "alias": "United Nations" },
  { "match": "dr.", "alias": "Doctor", "caseSensitive": false, "wordBoundary": false }
]
```
Text preflight rejects SSML-style tags such as `<break>` for a provider documented not to support them (`eleven_v3`), because the markup would be read aloud and billed. For Speechify, Cartesia, and Inworld, which accept timed SSML breaks, it passes silently. For other providers it warns and sends the text unchanged. It also warns about long bracketed passages, which providers tend to speak rather than treat as delivery tags.

### Existing output directories

Purchased request audio is kept under `slots/` (`items/<stem>/slots/` in a directory run) and reused.

Choose the audio profile and pause settings on the first run. Rerunning a completed directory with different mastering flags purchases nothing and changes nothing, because completed chapters are skipped. Single-file runs do not attach to an existing directory. A directory rerun rebuilds only the export layer: format, bitrate, tags, cover art, and the book file.

`resume` keeps `legacy` chunking and 16 kHz output for a run that used them when you pass no chunking or mastering flag, so completed audio is not repurchased. Passing `--tts-chunk-boundary`, `--tts-chunk-size`, `--tts-audio-profile`, or another mastering override turns that fallback off. Pass the same `--tts-pronunciations` file again when the original run used one.

## TTS Services

### ElevenLabs

| Option         | Value                                                                                                                                                                                                                                                     |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Selector       | `--provider elevenlabs[=<model>]`                                                                                                                                                                                                                         |
| Models         | `eleven_v3`                                                                                                                                                                                                                                               |
| Existing voice | `--tts-voice <id>`, default `hpp4J3VqNfWAUOO0d1Us`                                                                                                                                                                                                        |
| Controls       | `--tts-language`, `--tts-stability`, `--tts-seed`, `--tts-text-normalization`, `--tts-pronunciation-dictionary`, `--tts-response-format`. Numeric `--tts-speed`, `--tts-similarity`, `--tts-style`, and `--tts-speaker-boost` are rejected on `eleven_v3` |

```bash
bun autoshow tts input/examples/tts/01-tts-short.md --provider elevenlabs=eleven_v3 --tts-voice hpp4J3VqNfWAUOO0d1Us
```
ElevenLabs synthesis uses existing voices only. Single-voice text is limited to 5,000 characters per request; longer text is chunked (see [Chunking and seams](#chunking-and-seams)). SSML `<break>` and `<phoneme>` tags are rejected before dispatch because `eleven_v3` would read them aloud. The default source format is `mp3_44100_128`. `--tts-response-format mp3_44100_192`, `wav_44100`, or `wav_48000` requests higher-quality source audio where the ElevenLabs plan tier allows it; a rejected format is reported and not replaced with another format. Multi-speaker `eleven_v3` supports up to 10 voices and documented v3 audio tags such as `[whispers]` and `[laughs]`.

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
| Controls      | `--tts-response-format <wav\|mp3\|flac\|opus>`                                           |
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
```
Input may be plain text or SSML. Wrap SSML in `<speak>` to control pitch, rate, volume, pauses, emphasis, substitutions, and emotion via `<speechify:style emotion="...">`. Simba 3.2 is English-only.

### Hume

| Option   | Value                                                                                                                                                                  |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Selector | `--provider hume[=<model>]`                                                                                                                                            |
| Models   | `octave-1`, `octave-2`                                                                                                                                                 |
| Voice    | `--tts-voice <name-or-id>`, default `Male English Actor`                                                                                                               |
| Controls | `--tts-speed <0.5..2>`, `--tts-trailing-silence <0..60>`, `--tts-response-format <mp3\|wav>` (single-voice), Octave 1 utterance `description` via `--tts-instructions` |

```bash
bun autoshow tts input/examples/tts/01-tts-short.md --provider hume=octave-2
bun autoshow tts input/examples/tts/01-tts-short.md --provider hume=octave-2 --tts-trailing-silence 0.5
```
Pass an existing stock or custom voice with `--tts-voice`. A UUID is treated as a voice ID; any other value is looked up by name in the Hume voice library. Address a custom voice by its ID. `--tts-speed` is a nonlinear relative scale; `2` does not mean twice the speaking rate.

### Cartesia

Snapshot check on September 23, 2026: Cartesia still lists `sonic-3.6-2026-08-27` as its stable dated Sonic 3.6 snapshot. The moving `sonic-3.6` and `sonic-preview` aliases remain excluded. [Dated snapshots](https://docs.cartesia.ai/build-with-cartesia/tts-models/latest#dated-snapshots).

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
`--tts-language` accepts Cartesia language codes and regional locales such as `en-GB`. `--tts-speed` is guidance, not a fixed speaking rate. Transcripts may include SSML-like `<speed>`, `<volume>`, `<emotion>`, `<break>`, and `<spell>` tags plus `[laughter]`.

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

- Single-target runs write `speech.wav` and `manifest.json`. The WAV uses the selected `--tts-audio-profile`; with the default `native` profile it keeps the provider sample rate.
- `--tts-export-format` other than `wav` writes that file beside the WAV master with the same stem, such as `speech.m4b`.
- Directory runs with `--tts-book` also write `book.<format>` (`book-<service>-<sanitized-model>.<format>` for multi-target runs).
- Multi-target runs write `speech-<service>-<sanitized-model>.wav` per successful target and one `manifest.json`.
- Dialogue runs write `dialogue-normalized.txt`. Multi-speaker runs that synthesize one turn at a time keep per-turn WAVs under `segments/`.
- `manifest.json` records each target, its cost and timing, and the voice and settings used.
- `--output-dir` sets the output directory; output filenames stay provider-deterministic.

## Provider Capabilities

Marks: ✅ supported, ⚠️ partial or qualified, ❌ not exposed. Rows are newest first. Recency marks: ✅ 2026-04-01 or later, ⚠️ 2026-01-01 through 2026-03-31, ❌ before 2026-01-01.

Instructions is synthesis-time delivery for the voice already selected with `--tts-voice`. It is not voice design, cloning, `--tts-ref-audio`, numeric `--tts-speed`, or pause control.

- ✅ a dedicated request field that is not read aloud: `--tts-instructions` for OpenAI and Inworld, or Hume Octave 1 utterance `description`.
- ⚠️ spoken-text markup inside the synthesis input: ElevenLabs audio tags, Grok speech tags, Speechify SSML, or Cartesia SSML-like tags. Inworld also accepts inline steering tags in addition to `--tts-instructions`.
- ❌ neither a dedicated field nor markup.

Speed: ✅ numeric `--tts-speed`, ⚠️ SSML or tags only, ❌ not exposed. Pause: ✅ timed SSML or request silence, ⚠️ qualitative tags or trailing silence, ❌ not exposed. Language: ✅ `--tts-language`, ⚠️ English-only, ❌ not exposed. Native dialogue: ✅ multi-speaker in one provider request, ⚠️ native utterances, ❌ local turn assembly. Every provider can still take part in locally segmented multi-speaker rendering.

Stock: ✅ a built-in voice selectable with `--tts-voice`. Design: ✅ `voice design`. Clone: ✅ `voice clone` from authorized samples, ⚠️ a platform clone registered with `voice import`, ❌ not exposed.

Pricing is the AutoShow estimate. ✅ cheapest third, ⚠️ middle third, ❌ most expensive third. Cost rank is cheapest first (1 = cheapest); ties share a rank.

| Provider                            | Released     | Instructions                  | Speed                   | Pause               | Language           | Native dialogue      | Stock | Design | Clone                   | Pricing                       | Cost rank |
| ----------------------------------- | ------------ | ----------------------------- | ----------------------- | ------------------- | ------------------ | -------------------- | ----- | ------ | ----------------------- | ----------------------------- | --------- |
| Cartesia `sonic-3.6-2026-08-27`     | ✅ 2026-08-27 | ⚠️ SSML-like `<emotion>` tags | ✅ `--tts-speed` 0.6–1.5 | ✅ SSML `<break>`    | ✅ `--tts-language` | ❌ Local assembly     | ✅     | ❌      | ✅                       | ⚠️ `$0.065` / 1K chars        | 6/9       |
| Speechify `simba-3.2`               | ✅ 2026-07-08 | ⚠️ SSML `<speechify:style>`   | ⚠️ SSML rate            | ✅ SSML breaks       | ⚠️ English only    | ❌ Local assembly     | ✅     | ❌      | ❌                       | ✅ `$0.01` / 1K chars          | 1/9       |
| Inworld `realtime-tts-2`            | ✅ 2026-05-05 | ✅ `--tts-instructions`        | ✅ `--tts-speed` 0.5–1.5 | ✅ SSML breaks       | ❌ Not exposed      | ❌ Local assembly     | ✅     | ✅      | ✅                       | ⚠️ `$0.025` / 1K chars        | 5/9       |
| Grok `grok-tts`                     | ✅ 2026-04    | ⚠️ Speech tags                | ✅ `--tts-speed` 0.7–1.5 | ⚠️ `[pause]` tags   | ✅ `--tts-language` | ❌ Local assembly     | ✅     | ❌      | ✅                       | ✅ `$0.015` / 1K chars         | 3/9       |
| Mistral `voxtral-mini-tts-2603`     | ⚠️ 2026-03   | ❌ Not exposed                 | ❌ Not exposed           | ❌ Not exposed       | ❌ Not exposed      | ❌ Local assembly     | ✅     | ❌      | ✅                       | ⚠️ `$0.016` / 1K output chars | 4/9       |
| ElevenLabs `eleven_v3`              | ⚠️ 2026-02   | ⚠️ Audio tags                 | ❌ Not exposed           | ⚠️ Audio tags       | ✅ `--tts-language` | ✅ Up to 10 voices    | ✅     | ✅      | ✅                       | ❌ `$0.10` / 1K chars          | 7/9       |
| OpenAI `gpt-4o-mini-tts-2025-12-15` | ❌ 2025-12-15 | ✅ `--tts-instructions`        | ✅ `--tts-speed` 0.25–4  | ⚠️ Qualitative only | ❌ Not exposed      | ❌ Local assembly     | ✅     | ❌      | ❌                       | ✅ About `$0.0126` / 1K chars  | 2/9       |
| Hume `octave-2`                     | ❌ 2025-10    | ❌ Not exposed                 | ✅ `--tts-speed` 0.5–2   | ⚠️ Trailing silence | ❌ Not exposed      | ⚠️ Native utterances | ✅     | ✅      | ⚠️ Platform then import | ❌ `$0.15` / 1K chars          | 8/9       |
| Hume `octave-1`                     | ❌ 2025-02-26 | ✅ Utterance `description`     | ✅ `--tts-speed` 0.5–2   | ⚠️ Trailing silence | ❌ Not exposed      | ❌ Segmented          | ✅     | ✅      | ⚠️ Platform then import | ❌ `$0.15` / 1K chars          | 8/9       |
