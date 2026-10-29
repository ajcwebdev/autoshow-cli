# tts

Generate speech audio from a local `.md` or `.txt` file, or from a directory of text files, with hosted TTS providers.

`tts` uses an existing voice. Create or manage remote voices with [`voice`](../voice/00-voice-overview.md).

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
  - [Gemini](#gemini)
  - [ElevenLabs](#elevenlabs)
  - [Soniox](#soniox)
  - [Grok](#grok)
  - [OpenAI](#openai)
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
GEMINI_API_KEY=...
OPENAI_API_KEY=...
XAI_API_KEY=...
SONIOX_API_KEY=...
ELEVENLABS_API_KEY=...
INWORLD_API_KEY=...
```

## Usage

```bash
bun autoshow tts <input> [flags]
```

`<input>` must be a local `.md` or `.txt` file, or a directory containing text files. Directory synthesis shares provider request limits across files; `--batch-concurrency` does not cap the number of active hosted files. If no `--provider` is given, `tts` uses the saved provider selection or the cheapest hosted TTS provider. An explicit provider selection overrides the saved provider selection.

## Shared TTS Options

| Flag                                                     | Description                                                                                                                                            |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--provider provider[=model]`                            | TTS provider/model selector; repeat to run multiple targets                                                                                            |
| `--model <model>`                                        | Model for exactly one selected provider; alternatively use `--provider provider=model`                                                                 |
| `--all-providers`                                        | Select every supported hosted TTS provider/model                                                                                                       |
| `--provider-concurrency <n>`                             | Concurrent provider/model targets for a single-file input; default `7`. Directory runs use shared provider request limits instead                      |
| `--batch-concurrency <n>`                                | Directory timing-estimate input; default `7`. Does not cap active hosted files; use `--step-concurrency` to limit synthesis requests                   |
| `--concurrency-mode <ramp\|immediate>`                   | Ramp from one request (`ramp`, default) or start at the configured cap (`immediate`)                                                                   |
| `--tts-voice <provider=value\|value>`                    | Generic TTS voice selector                                                                                                                             |
| `--tts-speed <provider=value\|value>`                    | Generic TTS speed                                                                                                                                      |
| `--tts-language <provider=value\|value>`                 | Generic TTS language                                                                                                                                   |
| `--tts-text-normalization <provider=value\|value>`       | Generic text normalization                                                                                                                             |
| `--tts-instructions <provider=value\|value>`             | Generic voice/style instructions                                                                                                                       |
| `--tts-stability <provider=value\|value>`                | Generic TTS voice stability (ElevenLabs `0-1`)                                                                                                         |
| `--tts-seed <provider=value\|value>`                     | Generic TTS generation seed (ElevenLabs `0-4294967295`)                                                                                                |
| `--tts-pronunciation-dictionary <provider=value\|value>` | Generic TTS pronunciation dictionary locator as `dictionary_id` or `dictionary_id:version_id` (ElevenLabs; repeatable)                                 |
| `--tts-response-format <provider=value\|value>`          | Provider source audio format (Gemini `wav\|pcm\|mulaw\|alaw`; ElevenLabs `mp3_44100_128\|mp3_44100_192\|wav_44100\|wav_48000`)                         |
| `--step-concurrency tts-chunk=<n>`                       | Hosted TTS requests allowed in parallel per provider; default `30`, `2` under `--all-providers`, or `50` for Grok-only; Soniox is always capped at `3` |
| `--allow-ambiguous-redispatch`                           | Explicitly authorize repurchasing a provider-admitted TTS slot that has no recoverable audio                                                           |
| `--tts-dialogue-format <screenplay\|labeled>`            | Dialogue input format for multi-speaker TTS; requires `--tts-speaker`                                                                                  |
| `--tts-speaker SPEAKER=VOICE`                            | Multi-speaker voice mapping; repeatable. Selects multi-speaker TTS                                                                                     |
| `--price`                                                | Show the aggregated estimate and exit                                                                                                                  |
| `--max-model-cents <n>`                                  | Exclude each provider/model whose estimated total across the invocation exceeds the per-model ceiling in cents; works with or without `--price`        |
| `--output-dir <dir>`                                     | Global flag: pin an exact run directory instead of a timestamped output directory                                                                      |

See [Provider Capabilities](#provider-capabilities) for the per-model instructions, speed, pause, language, dialogue, stock, design, clone, and price matrix.

Shared voice flags apply to every selected model for that provider. Use `bun autoshow tts --help-topic provider:soniox` (or another provider name) for registered models, voice choices, default voices, and chunk ceilings. Help lists language values and normalization choices from the same capability tables used by validation.

`eleven_v3` rejects `--tts-similarity`, `--tts-style`, and `--tts-speaker-boost`. New runs always use smart chunk boundaries.

Multi-speaker mode requires `--tts-speaker` (repeatable) and `--tts-dialogue-format`, and exactly one active TTS provider. Speaker mappings use existing provider voice IDs; reference-audio paths are unsupported.

If a hosted target fails after producing some audio, keep the output directory and resume it. Add `--allow-ambiguous-redispatch` only when recovery reports unresolved admitted work that requires this authorization; it may purchase the interrupted request a second time.

`--step-concurrency tts-chunk=<n>` limits parallel synthesis requests within each provider, shared across files in a directory run. For example, `--step-concurrency tts-chunk=5` caps an Inworld target at five requests; `--provider-concurrency 5` caps concurrent targets for single-file runs.

```bash
bun autoshow tts input/examples/tts/01-tts-short.md \
  --provider openai=gpt-4o-mini-tts-2025-12-15 \
  --tts-voice alloy

bun autoshow tts input/examples/tts/01-tts-short.md --provider elevenlabs=eleven_v3

bun autoshow tts input/examples/tts/01-tts-short.md --all-providers --max-model-cents 400
```

`--max-model-cents` estimates every selected target, then removes targets above the ceiling. For a directory, the comparison uses each provider/model's summed estimate across all selected files. Add `--price` to inspect the filtered plan without making provider calls. The configured `maxCents` budget from `setup --max-cents` checks the combined estimate instead of filtering individual models.

## Audio Mastering and Export

These flags apply to every provider. Mastering and exports run locally with ffmpeg. Chunk-size and pronunciation settings prepare provider requests and can change what must be synthesized.

| Flag                                                  | Description                                                                                                                                         |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--tts-audio-profile <native\|audiobook\|legacy-16k>` | Final audio profile; default `native`                                                                                                               |
| `--tts-sample-rate <hz>`                              | Final sample rate: `16000`, `22050`, `24000`, `32000`, `44100`, or `48000`; default from the profile                                                |
| `--tts-channels <1\|2>`                               | Final channel count; default from the profile                                                                                                       |
| `--tts-loudness <lufs\|off>`                          | Integrated loudness target from `-40` to `-5` LUFS, or `off`; default from the profile                                                              |
| `--tts-true-peak <dbtp>`                              | True-peak ceiling from `-9` to `0` dBTP, used with loudness normalization                                                                           |
| `--tts-trim-silence <on\|off>`                        | Opt in to outer-edge silence trimming at chunk joins; default `off`; internal pauses stay intact                                                    |
| `--tts-paragraph-pause <ms>`                          | Added silence at paragraph and speaker-turn chunk joins, `0-10000`; default `0`                                                                     |
| `--tts-sentence-pause <ms>`                           | Added silence at sentence chunk joins, `0-10000`; default `0`; no clause or word padding                                                            |
| `--tts-lead-in <ms>`                                  | Silence before the first audio, `0-10000`                                                                                                           |
| `--tts-lead-out <ms>`                                 | Silence after the last audio, `0-10000`                                                                                                             |
| `--tts-chunk-size <chars>`                            | Maximum characters per request, integer `100-100000`; clamped to provider/model and request budgets                                                 |
| `--tts-pronunciations <file>`                         | Local JSON pronunciation lexicon applied to the text for every provider                                                                             |
| `--tts-text-preflight <on\|off>`                      | Check the text for unsupported speech markup before dispatch; default `on`                                                                          |
| `--tts-export-format <wav\|flac\|mp3\|m4a\|m4b>`      | Delivered container written beside the WAV master; default `wav`                                                                                    |
| `--tts-bitrate <kbps>`                                | Bitrate for `mp3`, `m4a`, and `m4b`, `32-320`; default `192` for mp3 and `96` for m4a/m4b                                                           |
| `--tts-metadata key=value`                            | Tag for non-WAV exports; repeatable. Keys: `title`, `artist`, `album`, `album_artist`, `composer`, `date`, `genre`, `comment`, `track`, `copyright` |
| `--tts-cover <image>`                                 | `.jpg`, `.jpeg`, or `.png` cover art embedded in `flac`, `mp3`, `m4a`, and `m4b` exports                                                            |
| `--tts-book`                                          | Directory input only: also assemble one book file with a chapter marker per input file                                                              |

Profiles:

| Profile      | Sample rate and channels             | Loudness              | Lead-in / lead-out | Use                                  |
| ------------ | ------------------------------------ | --------------------- | ------------------ | ------------------------------------ |
| `native`     | The provider's own rate and channels | None                  | `0` / `0` ms       | Default; preserves rate and channels |
| `audiobook`  | 44.1 kHz mono                        | `-19` LUFS, `-3` dBTP | `500` / `1000` ms  | Book chapters with consistent level  |
| `legacy-16k` | 16 kHz mono                          | None                  | None               | No seam trimming, pauses, or export  |

All settings except `--tts-metadata`, `--tts-cover`, `--tts-book`, and `--tts-pronunciations` can be saved as `config/autoshow.json` defaults through `setup`.

### Chunking and seams

Text longer than a provider's request limit is split into chunks, synthesized in parallel, and joined locally. Smart chunking balances chunk sizes and prefers a paragraph break, then a sentence end, clause punctuation, or a space. It protects bracketed delivery tags and does not treat common abbreviations or initials as sentence ends. Earlier saved plans preserve their original request text during resume.

Both `native` and `audiobook` preserve provider edge silence and internal pauses by default, with zero added padding at joins. Audiobook mastering adds a 500 ms lead-in and 1,000 ms lead-out and normalizes loudness.

Pause flags add silence only where separate chunks are joined. For example, `--tts-paragraph-pause 750` adds 750 ms after paragraph and speaker-turn chunks without enabling trimming; `--tts-sentence-pause 350` adds silence only at sentence joins. Zero disables added padding. These flags do not control pauses inside a provider request or shorten long provider pauses.

`--tts-trim-silence on` trims only detected outer silence with speech guards; internal silence remains intact. Ambiguous detections and all-silent clips are left intact. Saved delivery profiles restore their original trim and gap values when resuming supported providers.

Provider requests do not share voice state between chunks. For `eleven_v3`, a fixed `--tts-seed` and moderate `--tts-stability` can reduce variation; lower `--tts-chunk-size` if long requests drift. Listen across joins to assess continuity.

### Audiobook workflow

The `harborlight-chapters` example contains two chapter files, `01-first-light.md` and `02-night-watch.md`. Estimate the book before synthesis; `setup` supplies ffmpeg/ffprobe for mastering and M4B export.

```bash
# Estimate first; no provider calls
bun autoshow tts input/examples/tts/harborlight-chapters --provider elevenlabs=eleven_v3 --price

# One m4b per chapter file plus book.m4b with chapter markers
bun autoshow tts input/examples/tts/harborlight-chapters \
  --provider elevenlabs=eleven_v3 \
  --tts-stability 0.5 --tts-seed 12345 --tts-text-normalization on \
  --tts-audio-profile audiobook --tts-export-format m4b --tts-book \
  --tts-metadata "title=Harborlight Field Notes" --tts-metadata "artist=AutoShow" \
  --output-dir output/harborlight-book
```

The synthesis command uses ElevenLabs' default existing voice; `--tts-voice` can select another available account voice. For your own book, substitute a directory of readable text chapters. Optional `--tts-cover` and `--tts-pronunciations` need your own existing cover image and lexicon file. Chapters follow input filename order with numeric collation, and chapter titles come from the filenames. `m4b` is the most widely supported container for chapter markers; MP3 chapter support varies by player. What a later run reuses or rebuilds is covered in [Existing output directories](#existing-output-directories).

A pronunciation lexicon is a JSON array of alias rules. Rules match whole words and are case sensitive unless stated otherwise. The earliest match wins, ties go to the earlier rule, and inserted aliases are never rescanned. Avoid rules that match speaker labels in dialogue input. The lexicon changes the text sent to the provider, so billing and chunking use the substituted text.

```json
[
  { "match": "Claughton", "alias": "Cloffton" },
  { "match": "UN", "alias": "United Nations" },
  { "match": "dr.", "alias": "Doctor", "caseSensitive": false, "wordBoundary": false }
]
```

Text preflight rejects SSML-style tags such as `<break>` for a provider documented not to support them (`eleven_v3` and `eleven_v4`), because the markup would be read aloud and billed. For Inworld, which accepts timed SSML breaks, it passes silently. For other providers it warns and sends the text unchanged. It also warns about long bracketed passages, which providers tend to speak rather than treat as delivery tags.

### Existing output directories

Completed TTS runs losslessly bundle purchased request audio into `slots/audio.zip` (`items/<stem>/slots/audio.zip` in a directory run). Final audio stays directly playable; the manifest, provider render/timeline records, source dialogue plan, costs and timings remain available. `resume --price` validates compressed audio without extracting it. Local reassembly restores only the source clips it needs, and successful completion bundles them again. Incomplete runs retain their working audio and reconciliation journals.

Preserve the complete local run, including compressed source audio, for playback, regeneration, and resume. Metadata alone cannot restore purchased speech. See [TTS benchmark storage](../../../benchmarks/tts/README.md) for benchmark retention and maintenance.

Choose the audio profile and pause settings on the first run. Rerunning a completed directory with different mastering flags purchases nothing and changes nothing, because completed chapters are skipped. Single-file runs do not attach to an existing directory. A directory rerun rebuilds only the export layer: format, bitrate, tags, cover art, and the book file.

`resume` restores saved delivery, chunk size, and pronunciation settings and preserves older plans' paid audio. Explicit chunking or mastering overrides must match the retained plan. Dispatch, timing estimates, and audio joins use the same resolved chunks.

## TTS Services

### Gemini

Select `--provider gemini` for `gemini-3.8-flash-lite-tts` and the prebuilt voice `Kore`. Select Flash explicitly, or repeat `--provider` to render both models. Both participate in normal all-provider discovery; the default hosted-provider policy compares estimated synthesis costs.

| Model                       | Language coverage                  | Input / output token limits | Standard USD per million text / audio tokens, Sep–Dec 2026 |
| --------------------------- | ---------------------------------- | --------------------------- | ---------------------------------------------------------- |
| `gemini-3.8-flash-tts`      | 130 languages, automatic detection | 8,192 / 16,384              | $0.50 / $9                                                 |
| `gemini-3.8-flash-lite-tts` | 101 languages, automatic detection | 8,192 / 16,384              | $0.50 / $6                                                 |

The [model documentation](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash-tts) and [Flash-Lite documentation](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash-lite-tts) describe coverage and limits. Text preparation preserves inline pause and pronunciation notation. `--tts-instructions` and turn delivery become separate speech style metadata. Numeric speed, forced language, seed, stability, similarity, provider dictionaries and direct reference-audio synthesis are rejected. Qualitative pacing and pauses do not promise exact durations; use local delivery gaps for timed silence. [Speech controls](https://ai.google.dev/gemini-api/docs/speech-generation).

Unary synthesis defaults to 24 kHz WAV. `--tts-response-format wav|pcm|mulaw|alaw` selects the source encoding; sample-rate conversion and exports happen locally. `--gemini-tts-mode stream` retains buffered streaming audio and defaults to PCM. Two eligible prebuilt voices use native dialogue; custom voices, larger casts and incompatible turn controls use segmented rendering. Native takes do not include word or turn timestamps.

```bash
bun autoshow tts input/examples/tts/01-tts-short.md --provider gemini --price
bun autoshow tts input/examples/tts/01-tts-short.md --provider gemini=gemini-3.8-flash-tts --provider gemini=gemini-3.8-flash-lite-tts --tts-voice Kore --price
bun autoshow tts input/examples/tts/01-tts-short.md --provider gemini --gemini-tts-mode stream --tts-instructions "Calm, clear narration." --price
bun autoshow tts input/examples/tts/01-tts-short.md --provider gemini --gemini-tts-mode batch --gemini-tts-batch-wait-seconds 0 --price
```

Remove `--price` to synthesize. A directory normally runs local per-file batching. `--gemini-tts-mode batch` instead submits remote Gemini Batch API jobs. It requires explicit Gemini selection, supports WAV source output, and waits up to 86,400 seconds by default; `--gemini-tts-batch-wait-seconds 0` submits and returns. Other selected providers run concurrently in a separate directory, so mixed-provider runs use `--output-root` rather than `--output-dir`. Both workflows are validated and priced before dispatch, and `--max-cents` covers the Gemini Batch bound plus the other providers' estimate. A failure still reports the other workflow's output and the Batch resume command.

Resume the printed directory with `bun autoshow resume <output-dir> --provider-job-action status|wait|cancel`. The default is `wait`. Interrupting local waiting leaves remote jobs running. Explicit cancellation retains completed results. Resume reuses compatible completed audio and blocks automatic resubmission when an earlier submission is unresolved. `--allow-ambiguous-redispatch` can purchase missing work again. Preserve the output directory and cached audio.

Batch rates are half the standard tariff. Standard and Batch rates double in January 2027; estimates for jobs crossing the transition use the higher schedule. Price output identifies the schedule and conservative spending bound; token and duration estimates are not invoices. `--price` makes no provider calls or artifact writes. [Pricing](https://ai.google.dev/gemini-api/docs/pricing), [Batch API](https://ai.google.dev/gemini-api/docs/batch-api).

Persistent custom voices use the shared [voice lifecycle](../voice/00-voice-overview.md).

### ElevenLabs

| Option         | Value                                                                                                                                                                                                                                                     |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Selector       | `--provider elevenlabs[=<model>]`                                                                                                                                                                                                                         |
| Models         | `eleven_v3` (bare-provider default), `eleven_v4`                                                                                                                                                                                                          |
| Existing voice | `--tts-voice <id>`, default `hpp4J3VqNfWAUOO0d1Us`                                                                                                                                                                                                        |
| Controls       | `--tts-language`, `--tts-stability`, `--tts-seed`, `--tts-text-normalization`, `--tts-pronunciation-dictionary`, `--tts-response-format`. Numeric `--tts-speed`, `--tts-similarity`, `--tts-style`, and `--tts-speaker-boost` are rejected on `eleven_v3` |

```bash
bun autoshow tts input/examples/tts/01-tts-short.md --provider elevenlabs=eleven_v3 --tts-voice hpp4J3VqNfWAUOO0d1Us
```

ElevenLabs synthesis uses existing voices only. V4 accepts Stability and Similarity (`--tts-similarity`), with `similarity_boost` on single-voice requests and `settings.similarity` on dialogue. Numeric speed, style and speaker boost are rejected before dispatch. V3 remains the bare-provider default to preserve existing voice characterization; v4 deliberately changes cross-language accent behavior, so compare accent-dependent voices before migrating. Both models cost $0.08 per 1,000 characters under the published PAYG tariff. [Model limits](https://elevenlabs.io/docs/overview/models#character-limits), [v4 controls and accent behavior](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4), and [pricing](https://elevenlabs.io/pricing/api) were checked 2026-10-29. Single-voice text is limited to 5,000 characters for v3 and 10,000 for v4 per request; longer text is chunked (see [Chunking and seams](#chunking-and-seams)). SSML `<break>` and `<phoneme>` tags are rejected before dispatch because v3 and v4 do not support SSML. The default source format is `mp3_44100_128`. `--tts-response-format mp3_44100_192`, `wav_44100`, or `wav_48000` requests higher-quality source audio where the ElevenLabs plan tier allows it; a rejected format is reported and not replaced with another format. Multi-speaker v3/v4 dialogue supports up to 10 voices and 2,000 total submitted characters per request and documented v3 audio tags such as `[whispers]` and `[laughs]`.

### Soniox

Use the active `tts-rt-v2` model with the existing `SONIOX_API_KEY` credential. Defaults are voice `Adrian`, language `en`, and numeric speed `1.0`.

```bash
bun autoshow tts input/examples/tts/01-tts-short.md --provider soniox --model tts-rt-v2 --tts-voice Adrian --tts-language en --tts-speed 1 --price
bun autoshow tts input/examples/tts/01-tts-short.md --provider soniox --tts-voice Adrian
bun autoshow tts input/examples/tts/harborlight-chapters --provider soniox --step-concurrency tts-chunk=2 --price
```

Built-in voice names and existing cloned-voice IDs retain their case and must contain 1–50 characters. Soniox checks whether the voice is available to your account. Choose a [supported language code](https://soniox.com/docs/tts/concepts/supported-languages); `auto` is rejected. Numeric speed accepts `0.7–1.3`. Native emotion, delivery and pause tags remain in the submitted text, such as `[warm] Hello. [pause] Welcome.` Use English tag names as described in the [tag reference](https://soniox.com/docs/tts/concepts/emotion-and-tone). Free-form `--tts-instructions`, reference audio, response-format overrides and voice creation are not exposed by this adapter. [REST schema](https://soniox.com/docs/api-reference/tts/generate_tts), [speech speed](https://soniox.com/docs/tts/concepts/speech-speed).

Soniox uses sentence-aware chunks of at most 500 characters, including tags. `--tts-chunk-size` can lower this ceiling; it cannot raise it. Complete bracket tags and Unicode characters remain intact. At most three requests run concurrently, with 100 request starts per minute shared across files, speakers, and retries. Audio is requested as 24 kHz WAV. Multi-speaker scripts use `--tts-speaker Host=Adrian --tts-speaker Guest=YOUR_CLONED_VOICE_ID` with `--tts-dialogue-format` and local turn assembly.

The provider caps each response at two minutes. AutoShow retains raw bytes and rejects corrupt, empty or at-least-119-second audio before completing a slot. Interrupted or invalid successful requests require reconciliation before another purchase. Resume reuses compatible completed audio and restores voice, language, speed, speaker and chunk settings. Decoded integrity and shorter duration do not prove that every word was spoken. [REST limits](https://soniox.com/docs/tts/rest-api/limits-and-quotas).

Pricing remains estimated: $4 per million input text tokens and $21.50 per million output audio tokens. At default speed, the local estimate for 1,000 characters is about $0.0141. After generation, estimates use retained provider-audio duration, excluding locally inserted silence. Tags, language and delivery affect usage; REST returns no authoritative token counts. [Official pricing](https://soniox.com/pricing).

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
bun autoshow tts input/examples/tts/01-tts-short.md --provider grok=grok-tts --tts-voice eve --tts-language en --tts-text-normalization true
```

These examples use the documented built-in `eve` voice with the English fixture and require `XAI_API_KEY`. For a custom voice, first obtain a voice ID available to your account from the xAI console's voice card or `GET /v1/custom-voices`; substitute that returned ID for `eve`. AutoShow accepts the supported ID format locally, but `--price` cannot establish that an account owns the voice or can synthesize with it. [Built-in and custom voices](https://docs.x.ai/developers/model-capabilities/audio/text-to-speech#voices).

### OpenAI

| Option   | Value                                                                                              |
| -------- | -------------------------------------------------------------------------------------------------- |
| Selector | `--provider openai[=<model>]`                                                                      |
| Models   | `gpt-4o-mini-tts-2025-12-15`                                                                       |
| Voice    | `--tts-voice <id>`, default `alloy`; eligible custom IDs beginning with `voice_` are also accepted |
| Controls | `--tts-instructions <text>`, `--tts-speed <0.25..4>`                                               |

OpenAI bills text-input and audio-output tokens. Price estimates include repeated instructions and numeric speed; binary WAV responses do not report authoritative token usage. The model accepts up to 2,000 input tokens, while the API separately limits input and instructions to 4,096 characters each. AutoShow applies a conservative input budget, so Unicode text and long instructions can require smaller chunks. See the [model contract](https://developers.openai.com/api/docs/models/gpt-4o-mini-tts) and [speech request](https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create).

```bash
bun autoshow tts input/examples/tts/01-tts-short.md --provider openai=gpt-4o-mini-tts-2025-12-15 --tts-voice alloy
bun autoshow tts input/examples/tts/01-tts-short.md --provider openai=gpt-4o-mini-tts-2025-12-15 --tts-instructions "Warm documentary narration" --tts-speed 1.1
```

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
- Dialogue plans and render/timeline records retain speaker mappings; purchased source audio is bundled under `slots/` after successful completion.
- `manifest.json` records each target, its cost and timing, and the voice and settings used.
- `--output-dir` sets the output directory; output filenames stay provider-deterministic.

## Provider Capabilities

Marks: ✅ supported, ⚠️ partial or qualified, ❌ not exposed. These describe request support; listen to the output to assess spoken text and delivery.

Instructions is synthesis-time delivery for the voice already selected with `--tts-voice`. It is not voice design, cloning, numeric `--tts-speed`, or pause control.

- ✅ a dedicated request field that is not read aloud: `--tts-instructions` for Gemini, OpenAI and Inworld.
- ⚠️ spoken-text markup inside the synthesis input: ElevenLabs audio tags, Grok/Soniox speech tags. Inworld also accepts inline steering tags in addition to `--tts-instructions`.
- ❌ neither a dedicated field nor markup.

Speed: ✅ numeric `--tts-speed`, ⚠️ qualitative instructions or tags, ❌ not exposed. Pause: ✅ timed SSML, ⚠️ qualitative instructions or tags, ❌ not exposed. Language: automatic detection or explicit `--tts-language` as shown. Native dialogue: ✅ multi-speaker in one provider request, ❌ local turn assembly. Every provider supports locally segmented multi-speaker rendering.

Stock: ✅ a built-in voice selectable with `--tts-voice`. Design: ✅ `voice design`. Clone: ✅ `voice clone` from authorized samples, ⚠️ a platform clone registered with `voice import`, ❌ not exposed.

Pricing shows the rates registered by AutoShow and excludes voice setup fees. Use `--price` for an estimate based on your text and controls; token and duration assumptions are not observed charges.

| Provider                            | Instructions           | Speed                   | Pause                | Language           | Native dialogue    | Stock | Design | Clone           | Pricing                             |
| ----------------------------------- | ---------------------- | ----------------------- | -------------------- | ------------------ | ------------------ | ----- | ------ | --------------- | ----------------------------------- |
| Gemini `gemini-3.8-flash-tts`       | ✅ Style metadata       | ⚠️ Qualitative only     | ⚠️ Inline pauses     | ✅ Auto, 130        | ✅ Two stock voices | ✅     | ✅      | ✅ Consent audio | $0.50 text / $9 audio per M tokens  |
| Gemini `gemini-3.8-flash-lite-tts`  | ✅ Style metadata       | ⚠️ Qualitative only     | ⚠️ Inline pauses     | ✅ Auto, 101        | ✅ Two stock voices | ✅     | ✅      | ✅ Consent audio | $0.50 text / $6 audio per M tokens  |
| Soniox `tts-rt-v2`                  | ⚠️ Native inline tags  | ✅ `--tts-speed` 0.7–1.3 | ⚠️ Native pause tags | ✅ `--tts-language` | ❌ Local assembly   | ✅     | ❌      | ⚠️ Existing IDs | $4 text / $21.50 audio per M tokens |
| Inworld `realtime-tts-2`            | ✅ `--tts-instructions` | ✅ `--tts-speed` 0.5–1.5 | ✅ SSML breaks        | ❌ Not exposed      | ❌ Local assembly   | ✅     | ✅      | ✅               | `$0.025` / 1K chars                 |
| Grok `grok-tts`                     | ⚠️ Speech tags         | ✅ `--tts-speed` 0.7–1.5 | ⚠️ `[pause]` tags    | ✅ `--tts-language` | ❌ Local assembly   | ✅     | ❌      | ✅               | `$0.015` / 1K chars                 |
| ElevenLabs `eleven_v3`              | ⚠️ Audio tags          | ❌ Not exposed           | ⚠️ Audio tags        | ✅ `--tts-language` | ✅ Up to 10 voices  | ✅     | ✅      | ✅               | `$0.08` / 1K chars                  |
| ElevenLabs `eleven_v4`              | ⚠️ Audio tags          | ❌ Not exposed           | ⚠️ Audio tags        | ✅ `--tts-language` | ✅ Up to 10 voices  | ✅     | ✅      | ✅               | `$0.08` / 1K chars                  |
| OpenAI `gpt-4o-mini-tts-2025-12-15` | ✅ `--tts-instructions` | ✅ `--tts-speed` 0.25–4  | ⚠️ Qualitative only  | ❌ Not exposed      | ❌ Local assembly   | ✅     | ❌      | ⚠️ Existing IDs | $0.60 text / $12 audio per M tokens |
