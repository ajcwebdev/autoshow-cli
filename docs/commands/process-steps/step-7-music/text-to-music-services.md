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

The music setup step checks hosted music API keys and lyric-video tools: `ffmpeg`, `ffprobe`, `whisper-cli`, and the local Whisper `large-v3-turbo` model.

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
bun autoshow music --batch input/<dir>
```

## Modes

`music` has two mutually exclusive modes:

| Mode                  | Required input                            | Description                                                                            |
| --------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------- |
| Hosted generation     | `<prompt-or-text-file>` with `--provider` | Generates music with hosted ElevenLabs, MiniMax, or Gemini APIs and writes MP3 outputs |
| Lyric-video rendering | `--audio <file>` or `--batch <dir>`       | Uses local Whisper captions and ffmpeg rendering to write MP4/VTT/SRT outputs          |

Do not mix hosted generation flags with lyric-video flags.

## Shared Music Options

The standalone `music` command drops the `music-` prefix these options carry on `config` and `resume` (e.g. `--duration` vs `--music-duration`).

Hosted generation flags:

| Flag                                  | Description                                                                                                                                                                       |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--provider provider[=model]`         | Hosted music provider/model selector; repeat to run multiple targets                                                                                                              |
| `--all-providers`                     | Enable every supported hosted music provider/model                                                                                                                                |
| `--provider-concurrency <n>`          | Hosted music providers/models to run concurrently per item; default `7`                                                                                                           |
| `--concurrency-mode <ramp|immediate>` | Start each hosted provider/account lane at one request and add one slot every five seconds while demand is queued (`ramp`, default), or start at its configured cap (`immediate`) |
| `--duration <seconds>`                | Requested music duration                                                                                                                                                          |
| `--lyrics-file <path>`                | Lyrics file (`.md` or `.txt`); MiniMax and Gemini use the lyrics as written, ElevenLabs uses headers such as `Verse 1` or `Chorus` as song structure                             |
| `--instrumental`                      | Force instrumental generation for providers that support prompt/instrumental mode                                                                                                 |
| `--price`                             | Show the estimate and exit                                                                                                                                                        |
| `--output-dir <dir>`                  | Global flag: pin an exact hosted music run directory instead of `output/<timestamp>_music-gen/`                                                                                   |

Lyric-video flags:

| Flag                | Description                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| `--batch <dir>`     | Process every supported audio file under directory recursively                                     |
| `--audio <file>`    | Single-run lyric-video audio file                                                                  |
| `--captions <file>` | Edited `.vtt` or `.srt` file; skips Whisper and rerenders only                                     |
| `--model <name>`    | Local Whisper model: `tiny`, `base`, `small`, `medium`, `large-v3-turbo`; default `large-v3-turbo` |
| `--font <name>`     | Font family for lyric overlays; default `DejaVu Sans`                                              |

See [Provider Capabilities](#provider-capabilities) for the per-model matrix.

Repeating `--provider` runs each selected model independently and writes its own output file.

```bash
bun autoshow music "chill lo-fi beat" --provider elevenlabs=music_v2 --provider minimax=music-3.0
bun autoshow music "chill lo-fi beat" --provider elevenlabs=music_v2 --provider minimax=music-3.0 --price
```

## Music Services

### ElevenLabs

| Option       | Value                                                                                                      |
| ------------ | ---------------------------------------------------------------------------------------------------------- |
| Selector     | `--provider elevenlabs[=<model>]`                                                                          |
| Models       | `music_v2`                                                                                                 |
| Duration     | `--duration <seconds>` from `3` to `600`; omit to let the provider choose; `--price` estimates 180 seconds |
| Lyrics       | `--lyrics-file <path>`; generated from prompt when omitted                                                 |
| Instrumental | `--instrumental`                                                                                           |

```bash
bun autoshow music "cinematic orchestral trailer, dramatic strings and percussion" --provider elevenlabs=music_v2
bun autoshow music "lo-fi chillhop with soft piano and vinyl texture" --provider elevenlabs=music_v2 --duration 20 --instrumental
```

With `--lyrics-file`, headers such as `Verse 1` or `Chorus` become song sections (at most 30) and the prompt supplies the musical style. `--instrumental` takes precedence over `--lyrics-file` and logs a warning.

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
```

MiniMax ignores `--duration`. When `--lyrics-file` is omitted, generated lyrics are included in the `--price` estimate. Prompts are capped at 2000 characters and lyrics at 3500 characters.

### Gemini

| Option              | Value                                                                                |
| ------------------- | ------------------------------------------------------------------------------------ |
| Selector            | `--provider gemini[=<model>]`                                                        |
| Models              | `lyria-3-pro-preview`                                                                |
| Duration            | `--duration <seconds>` is a prompt hint; `--price` estimates 120s when omitted       |
| Lyrics/instrumental | `--lyrics-file <path>` or `--instrumental`                                           |

```bash
bun autoshow music "bright 90s pop rock with a huge chorus" --provider gemini=lyria-3-pro-preview
bun autoshow music "cinematic synth pop with verses, chorus, and bridge" --provider gemini=lyria-3-pro-preview --duration 120
bun autoshow music input/examples/tts/1-tts.md --provider gemini=lyria-3-pro-preview --lyrics-file input/examples/tts/1-tts.md
```

`--instrumental` takes precedence over `--lyrics-file` and logs a warning.

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
- **Multi-target hosted runs**: write `generated-music-<provider>-<sanitized-model>.mp3` per target and `manifest.json`.
- **Lyric-video single runs**: write `<stem>.mp4`, `<stem>.vtt`, `<stem>.srt`, and `manifest.json`.
- **Lyric-video batch runs**: write `<slug>/<stem>.mp4`, `<stem>.vtt`, `<stem>.srt`, and `manifest.json`.
- **`--output-dir`**: pins an exact output directory; filenames remain provider-deterministic.
- **`manifest.json`**: records single-run metadata including `music` array, `cost`, and `timing`.

## Notes

- When multiple providers are specified, each generates independently. A failure from one provider does not cancel the others; a warning is logged and the run succeeds if at least one provider succeeds.

## Provider Capabilities

✅ supported, ⚠️ partial or qualified, ❌ not exposed. Rows are newest first. Pricing is the AutoShow registry rate.

| Provider                      | Released      | Duration                          | Duration control | Instrumental        | Lyrics                          | Output                     | Pricing                                        | Cost rank |
| ----------------------------- | ------------- | --------------------------------- | ---------------- | ------------------- | ------------------------------- | -------------------------- | ---------------------------------------------- | --------- |
| MiniMax `music-3.0`           | ✅ 2026-08-13 | ✅ Up to 5 minutes billed         | ❌ Ignored       | ✅ `--instrumental` | ✅ `--lyrics-file` or generated | ✅ 44.1 kHz / 256 kbps MP3 | $0.15/track (+$0.01 generated lyrics)          | 2/3       |
| ElevenLabs `music_v2`         | ✅ 2026-05-26 | ✅ 3–600s                         | ✅ `--duration`  | ✅ `--instrumental` | ✅ `--lyrics-file` with sections | ✅ 48 kHz / 192 kbps MP3   | $0.15/min ($0.45 at the 180s default estimate) | 3/3       |
| Gemini `lyria-3-pro-preview`  | ✅ 2026-03-25 | ⚠️ Default 120s, no published max | ⚠️ Prompt only   | ✅ `--instrumental` | ⚠️ File appended to prompt      | ❌ MP3, rate unpublished   | $0.08/track                                    | 1/3       |
