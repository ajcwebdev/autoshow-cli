# music

Generate music from a text prompt with hosted providers, or render local lyric videos from audio files.

## Outline

- [Setup](#setup)
  - [Environment](#environment)
- [Usage](#usage)
- [Modes](#modes)
- [Shared Music Options](#shared-music-options)
- [Music Services](#music-services)
  - [ElevenLabs](#elevenlabs)
  - [MiniMax](#minimax)
  - [Gemini](#gemini)
  - [Lyric-Video Rendering](#lyric-video-rendering)
- [Output](#output)
- [Notes](#notes)
- [Provider Capabilities](#provider-capabilities)

## Setup

```bash
bun autoshow setup --step music
```

The music setup step checks hosted music API keys and lyric-video tools: `ffmpeg`, `ffprobe`, and the local whisperfile `small.en` bundle.

### Environment

```bash
ELEVENLABS_API_KEY=...
MINIMAX_API_KEY=...
GEMINI_API_KEY=...
```

Lyric-video rendering uses local tools and does not require hosted API keys.

## Usage

```bash
bun autoshow music <prompt-or-text-file> --provider <provider[=model]>
bun autoshow music --audio input/<file>
bun autoshow music --audio input/<file> --captions output/<run-dir>/<stem>.vtt
bun autoshow music --batch input/<dir>
```

## Modes

`music` has two mutually exclusive modes:

| Mode                  | Required input                            | Description                                                                       |
| --------------------- | ----------------------------------------- | --------------------------------------------------------------------------------- |
| Hosted generation     | `<prompt-or-text-file>` with `--provider` | Generates music with hosted ElevenLabs, MiniMax, or Gemini and writes MP3 outputs |
| Lyric-video rendering | `--audio <file>` or `--batch <dir>`       | Uses local whisperfile captions and ffmpeg to write MP4/VTT/SRT outputs           |

Do not mix a hosted prompt or `--provider`, `--all-providers`, `--duration`, `--lyrics-file`, or `--instrumental` with local `--audio`, `--captions`, `--batch`, `--model`, or `--font`. `--audio` and `--captions` cannot be combined with `--batch`. `--output-dir` pins the hosted run, single lyric-video run, or lyric-video batch parent directory. `--price` reports the pinned path without rendering or creating the run directory.

## Shared Music Options

The `music` and `resume` commands use the same short option names, including `--duration`. Saved configuration uses the matching namespaced key, such as `defaults.music.duration`.

Hosted generation flags:

| Flag                                   | Description                                                                                                                                          |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--provider provider[=model]`          | Hosted music provider/model selector; repeat to run multiple targets                                                                                 |
| `--all-providers`                      | Enable every supported hosted music provider/model                                                                                                   |
| `--provider-concurrency <n>`           | Hosted music providers/models to run concurrently; default `7`                                                                                       |
| `--concurrency-mode <ramp\|immediate>` | Ramp from one request (`ramp`, default) or start at the configured cap (`immediate`)                                                                 |
| `--duration <seconds>`                 | Requested music duration                                                                                                                             |
| `--lyrics-file <path>`                 | Lyrics file (`.md` or `.txt`); MiniMax and Gemini use the lyrics as written, ElevenLabs uses headers such as `Verse 1` or `Chorus` as song structure |
| `--instrumental`                       | Force instrumental generation for providers that support it; takes precedence over `--lyrics-file`                                                   |
| `--price`                              | Show the estimate and exit                                                                                                                           |
| `--max-model-cents <n>`                | Exclude each provider/model whose estimated total exceeds the per-model ceiling in cents; works with or without `--price`                            |
| `--output-dir <dir>`                   | Global flag: pin an exact run directory instead of `output/<timestamp>_music-gen/`                                                                   |

Lyric-video flags:

| Flag                | Description                                                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `--batch <dir>`     | Process every supported audio file under directory recursively                                                               |
| `--audio <file>`    | Single-run lyric-video audio file                                                                                            |
| `--captions <file>` | Edited `.vtt` or `.srt` file; skips whisperfile and rerenders only                                                           |
| `--model <name>`    | Whisperfile model: `tiny`, `tiny.en`, `small`, `small.en`, `medium`, `medium.en`, `large-v2`, `large-v3`; default `small.en` |
| `--font <name>`     | Font family for lyric overlays; default `DejaVu Sans`                                                                        |

See [Provider Capabilities](#provider-capabilities) for the per-model matrix.

```bash
bun autoshow music "chill lo-fi beat" --provider elevenlabs=music_v2 --provider minimax=music-3.0
bun autoshow music "chill lo-fi beat" --provider elevenlabs=music_v2 --provider minimax=music-3.0 --price
bun autoshow music "chill lo-fi beat" --all-providers --max-model-cents 10 --price
```

## Music Services

### ElevenLabs

| Option       | Value                                                                                                      |
| ------------ | ---------------------------------------------------------------------------------------------------------- |
| Selector     | `--provider elevenlabs[=<model>]`                                                                          |
| Models       | `music_v2`, `music_v2_5`                                                                                   |
| Duration     | `--duration <seconds>` from `3` to `600`; omit to let the provider choose; `--price` estimates 180 seconds |
| Lyrics       | `--lyrics-file <path>`; generated from prompt when omitted                                                 |
| Instrumental | `--instrumental`                                                                                           |

```bash
bun autoshow music "cinematic orchestral trailer, dramatic strings and percussion" --provider elevenlabs=music_v2
bun autoshow music "lo-fi chillhop with soft piano and vinyl texture" --provider elevenlabs=music_v2 --duration 20 --instrumental
```

With `--lyrics-file`, headers such as `Verse 1` or `Chorus` become song sections (at most 30) and the prompt supplies the musical style.

### MiniMax

| Option       | Value                                               |
| ------------ | --------------------------------------------------- |
| Selector     | `--provider minimax[=<model>]`                      |
| Models       | `music-3.0`                                         |
| Lyrics       | `--lyrics-file <path>`; auto-generated when omitted |
| Instrumental | `--instrumental`                                    |

```bash
bun autoshow music "indie pop, nostalgic summer road trip vibe" --provider minimax=music-3.0
bun autoshow music "indie pop, nostalgic summer road trip vibe" --provider minimax=music-3.0 --lyrics-file input/examples/tts/01-tts-short.md
bun autoshow music "ambient piano instrumental with soft tape saturation" --provider minimax=music-3.0 --instrumental
```

MiniMax ignores `--duration`. When `--lyrics-file` is omitted, generated lyrics are included in the `--price` estimate. Prompts are capped at 2000 characters and lyrics at 3500 characters.

### Gemini

| Option              | Value                                                                          |
| ------------------- | ------------------------------------------------------------------------------ |
| Selector            | `--provider gemini[=<model>]`                                                  |
| Models              | `lyria-3.5` (public preview; default)                                          |
| Duration            | `--duration <seconds>` is a prompt hint; `--price` estimates 120s when omitted |
| Lyrics/instrumental | `--lyrics-file <path>` or `--instrumental`                                     |

```bash
bun autoshow music "bright 90s pop rock with a huge chorus" --provider gemini=lyria-3.5
bun autoshow music "cinematic synth pop with verses, chorus, and bridge" --provider gemini=lyria-3.5 --duration 120
bun autoshow music input/examples/tts/01-tts-short.md --provider gemini=lyria-3.5 --lyrics-file input/examples/tts/01-tts-short.md
```

### Lyric-Video Rendering

```bash
bun autoshow music --audio input/examples/lyrics/01-example-song.mp3
bun autoshow music --audio input/examples/lyrics/01-example-song.mp3 --model small
bun autoshow music --audio input/examples/lyrics/01-example-song.mp3 --captions output/<run-dir>/01-example-song.vtt
bun autoshow music --batch input/examples/lyrics --model small
```

With `--captions`, output names come from the caption file, not the audio file. If an image beside the audio file matches by exact basename or track number, it is used as the background; otherwise a spectrogram background is rendered.

## Output

- **Single-target hosted runs**: write `output/<timestamp>_music-gen/generated-music.mp3` and `manifest.json`.
- **Multi-target hosted runs**: write `generated-music-<provider>-<model>.mp3` per target and `manifest.json`.
- **Gemini `lyria-3.5` extras**: additional audio as `generated-music-gemini-lyria-3.5-part-<n>.mp3` and lyrics or song-structure text as `generated-music-gemini-lyria-3.5.txt`.
- **Lyric-video single runs**: write `<stem>.mp4`, `<stem>.vtt`, `<stem>.srt`, and `manifest.json`.
- **Lyric-video batch runs**: write `<slug>/<stem>.mp4`, `<slug>/<stem>.vtt`, `<slug>/<stem>.srt`, and `manifest.json`.
- **`--output-dir`**: pins an exact hosted or local output directory, including the parent directory for a lyric-video batch; individual batch items keep their child directories.

## Notes

- When multiple providers are specified, each generates independently. A failure from one provider does not cancel the others; the run succeeds if at least one provider succeeds.

## Provider Capabilities

✅ supported, ⚠️ partial or qualified, ❌ not exposed. Rows are newest first. Released dates are provider announcement or model-origin dates. Recency marks: ✅ 2026-04-01 or later, ⚠️ 2026-01-01 through 2026-03-31, ❌ before 2026-01-01. Pricing is the per-run estimate. Pricing: ✅ cheapest third, ⚠️ middle third, ❌ most expensive third. Cost rank is cheapest first. All providers support `--instrumental`.

| Provider                | Released      | Duration                    | Duration control | Lyrics                              | Output                     | Pricing                                           | Cost rank |
| ----------------------- | ------------- | --------------------------- | ---------------- | ----------------------------------- | -------------------------- | ------------------------------------------------- | --------- |
| ElevenLabs `music_v2_5` | ✅ 2026-09-11 | ✅ 3–600s                   | ✅ `--duration`  | ✅ `--lyrics-file` with sections    | ✅ 48 kHz / 192 kbps MP3   | ❌ $0.15/min ($0.45 at the 180s default estimate) | 3/3       |
| Gemini `lyria-3.5`      | ✅ 2026-09-04 | ⚠️ Full song; 120s estimate | ⚠️ Prompt only   | ✅ File or generated text/structure | ✅ 44.1 kHz stereo MP3     | ✅ $0.08/song request                             | 1/3       |
| MiniMax `music-3.0`     | ✅ 2026-08-13 | ✅ Up to 5 minutes          | ❌ Ignored       | ✅ `--lyrics-file` or generated     | ✅ 44.1 kHz / 256 kbps MP3 | ⚠️ $0.15/track (+$0.01 generated lyrics)          | 2/3       |
| ElevenLabs `music_v2`   | ✅ 2026-05-26 | ✅ 3–600s                   | ✅ `--duration`  | ✅ `--lyrics-file` with sections    | ✅ 48 kHz / 192 kbps MP3   | ❌ $0.15/min ($0.45 at the 180s default estimate) | 3/3       |
