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

| Mode | Required input | Description |
|------|----------------|-------------|
| Hosted generation | `<prompt-or-text-file>` with `--provider` | Generates music with hosted ElevenLabs, MiniMax, or Gemini APIs and writes MP3 outputs |
| Lyric-video rendering | `--audio <file>` or `--batch` | Uses local Whisper captions and ffmpeg rendering to write MP4/VTT/SRT outputs |

Do not mix hosted generation flags with lyric-video flags.

## Shared Music Options

The standalone `music` command drops the `music-` prefix these options carry on `write`, `config`, and `resume` (e.g. `--duration` vs `--music-duration`). See [ADR-002](../../../adr/ADR-002-pipeline-state-resume-and-dry-run-planning.md).

Hosted generation flags:

| Flag | Description |
|------|-------------|
| `--provider provider[=model]` | Hosted music provider/model selector; repeat to run multiple targets |
| `--all-providers` | Enable every supported hosted music provider/model |
| `--provider-concurrency <n>` | Hosted music providers/models to run concurrently per item; default `7` |
| `--concurrency-mode <ramp|immediate>` | Start each hosted provider/account lane at one request and add one slot every five seconds while demand is queued (`ramp`, default), or start at its configured cap (`immediate`) |
| `--duration <seconds>` | Requested music duration |
| `--lyrics-file <path>` | Lyrics file path (`.md` or `.txt`) for MiniMax and Gemini music generation |
| `--instrumental` | Force instrumental generation for providers that support prompt/instrumental mode |
| `--price` | Show the estimate and exit |
| `--output-dir <dir>` | Global flag: pin an exact hosted music run directory instead of `output/<timestamp>_music-gen/` |

Lyric-video flags:

| Flag | Description |
|------|-------------|
| `--input-dir <dir>` | Input directory for lyric-video audio roots |
| `--batch` | Process every supported audio file under `--input-dir`, or `input` when omitted, recursively |
| `--audio <file>` | Single-run audio file inside `input` |
| `--captions <file>` | Edited `.vtt` or `.srt` file inside `./output`; skips Whisper and rerenders only |
| `--model <name>` | Local Whisper model: `tiny`, `base`, `small`, `medium`, `large-v3-turbo`; default `large-v3-turbo` |
| `--font <name>` | Font family for lyric overlays; default `DejaVu Sans` |
| `--keep-tmp` | Keep the per-run `.lyrics-tmp` workspace inside the output directory |

One or more hosted provider selectors can be specified. Repeating the same provider runs each selected model independently and produces its own output file.

```bash
bun autoshow music "chill lo-fi beat" --provider elevenlabs=music_v2 --provider minimax=music-3.0
bun autoshow music "chill lo-fi beat" --provider elevenlabs=music_v2 --provider minimax=music-3.0 --price
```

## Music Services

### ElevenLabs

| Option | Value |
|--------|-------|
| Selector | `--provider elevenlabs[=<model>]` |
| Models | `music_v1`, `music_v2` |
| Duration | `--duration <seconds>` from `3` to `600`; default 180 seconds |
| Instrumental | `--instrumental` |

```bash
bun autoshow music "cinematic orchestral trailer, dramatic strings and percussion" --provider elevenlabs=music_v2
bun autoshow music "lo-fi chillhop with soft piano and vinyl texture" --provider elevenlabs=music_v2 --duration 20 --instrumental
bun autoshow music "lo-fi chillhop with soft piano and vinyl texture" --provider elevenlabs=music_v2 --price
```

ElevenLabs returns audio directly (`mp3_44100_128` for `music_v1`, `mp3_48000_192` for `music_v2`). Pricing estimates use explicit `--duration` or default to 180 seconds.

### MiniMax

| Option | Value |
|--------|-------|
| Selector | `--provider minimax[=<model>]` |
| Models | `music-3.0` |
| Lyrics | `--lyrics-file <path>`; auto-generated when omitted |
| Instrumental | `--instrumental` |

```bash
bun autoshow music "indie pop, nostalgic summer road trip vibe" --provider minimax=music-3.0
bun autoshow music "indie pop, nostalgic summer road trip vibe" --provider minimax=music-3.0 --lyrics-file input/examples/tts/1-tts.md
bun autoshow music "ambient piano instrumental with soft tape saturation" --provider minimax=music-3.0 --instrumental
bun autoshow music "indie pop, nostalgic summer road trip vibe" --provider minimax=music-3.0 --price
```

MiniMax auto-generates lyrics when `--lyrics-file` is omitted, which is included in `--price` estimation. `music-3.0` supports instrumental mode. `--duration` is ignored by MiniMax.

### Gemini

| Option | Value |
|--------|-------|
| Selector | `--provider gemini[=<model>]` |
| Models | `lyria-3-clip-preview`, `lyria-3-pro-preview` |
| Duration | Gemini Clip is fixed at 30 seconds; Gemini Pro uses `--duration` (default 120 seconds) |
| Lyrics/instrumental | `--lyrics-file <path>` or `--instrumental` |

```bash
bun autoshow music "bright 90s pop rock with a huge chorus" --provider gemini=lyria-3-clip-preview
bun autoshow music "cinematic synth pop with verses, chorus, and bridge" --provider gemini=lyria-3-pro-preview --duration 120
bun autoshow music input/examples/tts/1-tts.md --provider gemini=lyria-3-pro-preview --lyrics-file input/examples/tts/1-tts.md
bun autoshow music "ambient piano and strings" --provider gemini=lyria-3-clip-preview --price
```

Gemini Lyria 3 Clip always generates a 30-second MP3 clip. Lyria 3 Pro uses duration instructions from `--duration` (default 120 seconds). `--lyrics-file` appends lyrics to the prompt. If `--instrumental` is also set, instrumental takes precedence and the lyrics file is ignored with a warning.

### Lyric-Video Rendering

| Option | Value |
|--------|-------|
| Single audio | `--audio <file>` inside `input` |
| Input root | `--input-dir <dir>` |
| Rerender | `--captions <file>` inside `./output` |
| Batch | `--batch` |
| Whisper model | `--model tiny|base|small|medium|large-v3-turbo`, default `large-v3-turbo` |
| Overlay | `--font <name>` |
| Debug artifacts | `--keep-tmp` |

```bash
bun autoshow music --audio input/examples/lyrics/01-example-song.mp3
bun autoshow music --audio input/examples/lyrics/01-example-song.mp3 --model small
bun autoshow music --audio input/examples/lyrics/01-example-song.mp3 --captions output/<run-dir>/01-example-song.vtt
bun autoshow music --audio input/examples/lyrics/01-example-song.mp3 --keep-tmp
bun autoshow music --input-dir input/examples/lyrics --batch --model small
bun autoshow music --batch --model tiny
```

Lyric-video rendering uses local Whisper captions and ffmpeg rendering. In rerender mode, output stems come from the caption filename. If an image beside the lyric-video audio file matches by exact basename or track number, it is used as the background; otherwise a spectrogram background is rendered.

## Output

- **Single-target hosted runs**: write `output/<timestamp>_music-gen/generated-music.mp3` and `manifest.json`.
- **Multi-target hosted runs**: write `generated-music-<provider>-<sanitized-model>.mp3` per target and `manifest.json`.
- **Lyric-video single runs**: write `<stem>.mp4`, `<stem>.vtt`, `<stem>.srt`, and `manifest.json` (plus `.lyrics-tmp/` when `--keep-tmp` is set).
- **Lyric-video batch runs**: write `<slug>/<stem>.mp4`, `<stem>.vtt`, `<stem>.srt`, and `manifest.json`.
- **`--output-dir`**: pins an exact output directory; filenames remain provider-deterministic.
- **`manifest.json`**: records single-run metadata including `music` array, `cost`, and `timing`.

## Notes

- When multiple providers are specified, each generates independently. A failure from one provider does not cancel the others; a warning is logged and the run succeeds if at least one provider succeeds.
- Music generation tests cover validation and `--price`; live provider-generation tests require API keys. See [Step 7 Service Tests: Music](../../../tests/step-7-service-tests-music.md).
