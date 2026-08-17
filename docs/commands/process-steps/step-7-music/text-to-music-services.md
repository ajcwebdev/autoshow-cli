# music

Generate music from a text prompt with hosted providers, or render local lyric videos from repo audio.

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

The music setup step checks hosted music API readiness and local lyric-video prerequisites:

- `ffmpeg` and `ffprobe`
- ffmpeg `ass` subtitle filter, or `pango-view` plus ImageMagick `convert` for fallback overlays
- `whisper-cli`
- Local Whisper `large-v3-turbo` model

### Environment

```bash
ELEVENLABS_API_KEY=...
MINIMAX_API_KEY=...
GEMINI_API_KEY=...
```

Lyric-video rendering uses local tools and does not require hosted API keys.

## Usage

```bash
bun autoshow music <prompt-or-text-file> --provider elevenlabs[=<model>]
bun autoshow music <prompt-or-text-file> --provider minimax[=<model>]
bun autoshow music <prompt-or-text-file> --provider gemini[=<model>]
bun autoshow music --audio input/<file>
bun autoshow music --audio input/<file> --captions output/<run-dir>/<stem>.vtt
bun autoshow music --batch
```

## Modes

`music` has two mutually exclusive modes:

| Mode                  | Required input                            | Description                                                                            |
| --------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------- |
| Hosted generation     | `<prompt-or-text-file>` with `--provider` | Generates music with hosted ElevenLabs, MiniMax, or Gemini APIs and writes MP3 outputs |
| Lyric-video rendering | `--audio <file>` or `--batch`             | Uses local Whisper captions and ffmpeg rendering to write MP4/VTT/SRT outputs          |

Do not mix hosted generation flags with lyric-video flags.

## Shared Music Options

The standalone `music` command drops the `music-` prefix these options carry on `config` and `resume` (e.g. `--duration` vs `--music-duration`). See [ADR-002](../../../adr/ADR-002-pipeline-state-resume-and-dry-run-planning.md).

Hosted generation flags:

| Flag                                  | Description                                                                                                                                                                       |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--provider provider[=model]`         | Hosted music provider/model selector; repeat to run multiple targets                                                                                                              |
| `--all-providers`                     | Enable every supported hosted music provider/model                                                                                                                                |
| `--provider-concurrency <n>`          | Hosted music providers/models to run concurrently per item; default `7`                                                                                                           |
| `--concurrency-mode <ramp|immediate>` | Start each hosted provider/account lane at one request and add one slot every five seconds while demand is queued (`ramp`, default), or start at its configured cap (`immediate`) |
| `--duration <seconds>`                | Requested music duration                                                                                                                                                          |
| `--lyrics-file <path>`                | Lyrics file path (`.md` or `.txt`) for MiniMax and Gemini music generation                                                                                                        |
| `--instrumental`                      | Force instrumental generation for providers that support prompt/instrumental mode                                                                                                 |
| `--price`                             | Show the estimate and exit                                                                                                                                                        |
| `--output-dir <dir>`                  | Global flag: pin an exact hosted music run directory instead of `output/<timestamp>_music-gen/`                                                                                   |

Lyric-video flags:

| Flag                | Description                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| `--batch <dir>`     | Process every supported audio file under directory recursively                                     |
| `--audio <file>`    | Single-run lyric-video audio file                                                                 |
| `--captions <file>` | Edited `.vtt` or `.srt` file; skips Whisper and rerenders only                                     |
| `--model <name>`    | Local Whisper model: `tiny`, `base`, `small`, `medium`, `large-v3-turbo`; default `large-v3-turbo` |
| `--font <name>`     | Font family for lyric overlays; default `DejaVu Sans`                                              |

See [Provider Capabilities](#provider-capabilities) for the per-model release date, duration, duration-control, instrumental, lyrics, and output matrix.

One or more hosted provider selectors can be specified. Repeating the same provider runs each selected model independently and produces its own output file.

```bash
bun autoshow music "chill lo-fi beat" --provider elevenlabs=music_v2 --provider minimax=music-3.0
bun autoshow music "chill lo-fi beat" --provider elevenlabs=music_v2 --provider minimax=music-3.0 --price
```

## Music Services

### ElevenLabs

| Option       | Value                                                         |
| ------------ | ------------------------------------------------------------- |
| Selector     | `--provider elevenlabs[=<model>]`                             |
| Models       | `music_v2`                                                    |
| Duration     | `--duration <seconds>` from `3` to `600`; default 180 seconds |
| Instrumental | `--instrumental`                                              |

```bash
bun autoshow music "cinematic orchestral trailer, dramatic strings and percussion" --provider elevenlabs=music_v2
bun autoshow music "lo-fi chillhop with soft piano and vinyl texture" --provider elevenlabs=music_v2 --duration 20 --instrumental
bun autoshow music "lo-fi chillhop with soft piano and vinyl texture" --provider elevenlabs=music_v2 --price
```

ElevenLabs returns audio directly (`mp3_48000_192` for `music_v2`). Pricing estimates use explicit `--duration` or default to 180 seconds.

### MiniMax

| Option       | Value                                               |
| ------------ | --------------------------------------------------- |
| Selector     | `--provider minimax[=<model>]`                      |
| Models       | `music-3.0`                                         |
| Lyrics       | `--lyrics-file <path>`; auto-generated when omitted |
| Instrumental | `--instrumental`                                    |

```bash
bun autoshow music "indie pop, nostalgic summer road trip vibe" --provider minimax=music-3.0
bun autoshow music "indie pop, nostalgic summer road trip vibe" --provider minimax=music-3.0 --lyrics-file input/examples/tts/1-tts.md
bun autoshow music "ambient piano instrumental with soft tape saturation" --provider minimax=music-3.0 --instrumental
bun autoshow music "indie pop, nostalgic summer road trip vibe" --provider minimax=music-3.0 --price
```

MiniMax auto-generates lyrics when `--lyrics-file` is omitted, which is included in `--price` estimation. `music-3.0` supports instrumental mode. `--duration` is ignored by MiniMax.

### Gemini

| Option              | Value                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------- |
| Selector            | `--provider gemini[=<model>]`                                                          |
| Models              | `lyria-3-pro-preview`                                                                  |
| Duration            | Gemini Pro uses `--duration` (default 120 seconds)                                     |
| Lyrics/instrumental | `--lyrics-file <path>` or `--instrumental`                                             |

```bash
bun autoshow music "bright 90s pop rock with a huge chorus" --provider gemini=lyria-3-pro-preview
bun autoshow music "cinematic synth pop with verses, chorus, and bridge" --provider gemini=lyria-3-pro-preview --duration 120
bun autoshow music input/examples/tts/1-tts.md --provider gemini=lyria-3-pro-preview --lyrics-file input/examples/tts/1-tts.md
bun autoshow music "ambient piano and strings" --provider gemini=lyria-3-pro-preview --price
```

Lyria 3 Pro uses duration instructions from `--duration` (default 120 seconds). `--lyrics-file` appends lyrics to the prompt. If `--instrumental` is also set, instrumental takes precedence and the lyrics file is ignored with a warning.

### Lyric-Video Rendering

| Option          | Value                                                                     |
| --------------- | ------------------------------------------------------------------------- |
| Single audio    | `--audio <file>`                                                          |
| Batch directory | `--batch <dir>`                                                           |
| Rerender        | `--captions <file>`                                                       |
| Whisper model   | `--model tiny|base|small|medium|large-v3-turbo`, default `large-v3-turbo` |
| Overlay         | `--font <name>`                                                           |

```bash
bun autoshow music --audio input/examples/lyrics/01-example-song.mp3
bun autoshow music --audio input/examples/lyrics/01-example-song.mp3 --model small
bun autoshow music --audio input/examples/lyrics/01-example-song.mp3 --captions output/<run-dir>/01-example-song.vtt
bun autoshow music --batch input/examples/lyrics --model small
```

Lyric-video rendering uses local Whisper captions and ffmpeg rendering. In rerender mode, output stems come from the caption filename. If an image beside the lyric-video audio file matches by exact basename or track number, it is used as the background; otherwise a spectrogram background is rendered.

## Output

- **Single-target hosted runs**: write `output/<timestamp>_music-gen/generated-music.mp3` and `manifest.json`.
- **Multi-target hosted runs**: write `generated-music-<provider>-<sanitized-model>.mp3` per target and `manifest.json`.
- **Lyric-video single runs**: write `<stem>.mp4`, `<stem>.vtt`, `<stem>.srt`, and `manifest.json`. The per-run `.lyrics-tmp/` workspace is deleted on success and retained only when the run fails, so failures stay debuggable.
- **Lyric-video batch runs**: write `<slug>/<stem>.mp4`, `<stem>.vtt`, `<stem>.srt`, and `manifest.json`.
- **`--output-dir`**: pins an exact output directory; filenames remain provider-deterministic.
- **`manifest.json`**: records single-run metadata including `music` array, `cost`, and `timing`.

## Notes

- When multiple providers are specified, each generates independently. A failure from one provider does not cancel the others; a warning is logged and the run succeeds if at least one provider succeeds.
- Music generation tests cover validation and `--price`; live provider-generation tests require API keys. See [Step 7 Tests: Music](music-tests.md).

## Provider Capabilities

Marks match the [TTS capability tables](../step-4-tts/text-to-speech-and-voice.md#provider-capabilities): ✅ supported, ⚠️ partial or qualified, ❌ not exposed. Released dates are provider announcement or snapshot dates. Recency marks follow the TTS convention: current-year GA is ✅, older still-current snapshots are ⚠️, and pre-2026 engines are ❌. Rows are newest first. Duration uses ✅ 5 minutes or longer, ⚠️ 1–4 minutes, and ❌ under 1 minute. Duration control uses ✅ an API duration field, ⚠️ prompt-only, and ❌ ignored or fixed. Pricing is the AutoShow registry rate. Cost rank orders models cheapest-first (1 = cheapest) and ties share a rank, comparing the price of a default-length track: ElevenLabs is estimated at its 180-second default and MiniMax bills per track up to five minutes.

| Provider                      | Released      | Duration                          | Duration control | Instrumental        | Lyrics                          | Output                     | Pricing                                        | Cost rank |
| ----------------------------- | ------------- | --------------------------------- | ---------------- | ------------------- | ------------------------------- | -------------------------- | ---------------------------------------------- | --------- |
| MiniMax `music-3.0`           | ✅ 2026-08-13 | ✅ Up to 5 minutes billed         | ❌ Ignored       | ✅ `--instrumental` | ✅ `--lyrics-file` or generated | ✅ 44.1 kHz / 256 kbps MP3 | $0.15/track (+$0.01 generated lyrics)          | 2/3       |
| ElevenLabs `music_v2`         | ✅ 2026-05-26 | ✅ 3–600s                         | ✅ `--duration`  | ✅ `--instrumental` | ❌ Prompt vocals only           | ✅ 48 kHz / 192 kbps MP3   | $0.15/min ($0.45 at the 180s default estimate) | 3/3       |
| Gemini `lyria-3-pro-preview`  | ✅ 2026-03-25 | ⚠️ Default 120s, no published max | ⚠️ Prompt only   | ✅ `--instrumental` | ⚠️ File appended to prompt      | ❌ MP3, rate unpublished   | $0.08/track                                    | 1/3       |

ElevenLabs sends `music_length_ms` only when `--duration` is set; omitted requests let the provider choose length while estimates still use 180 seconds. MiniMax ignores `--duration`, auto-generates lyrics when `--lyrics-file` is omitted, and caps prompts at 2000 characters and lyrics at 3500 characters. Gemini instrumental mode wins over `--lyrics-file`. Lyric-video rendering is local and mutually exclusive with hosted generation flags. Direct selection of retired `music_v1` and `lyria-3-clip-preview` fails with replacement guidance to `music_v2` and `lyria-3-pro-preview`.
