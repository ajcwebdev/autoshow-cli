# music

Generate hosted music from a prompt or local `.md`/`.txt` file, or render lyric videos from local audio.

## Setup

```bash
bun autoshow setup --step music
```

Hosted generation needs the selected provider's `ELEVENLABS_API_KEY`, `MINIMAX_API_KEY`, or `GEMINI_API_KEY`. The setup step provisions the managed media/rendering graph, verifies FFmpeg/ffprobe and lyric overlays, and installs whisperfile `small.en`. Overlays use FFmpeg's `ass` filter or managed Pango/ImageMagick with private fonts. Local rendering needs no hosted key.

## Usage

```bash
bun autoshow music "cinematic orchestral trailer" --provider elevenlabs=music_v2 --price
bun autoshow music "lo-fi piano instrumental" --provider elevenlabs=music_v2_5 --duration 20 --instrumental
bun autoshow music "indie pop, summer road trip" --provider minimax=music-3.0 --lyrics-file input/examples/tts/01-tts-short.md
bun autoshow music "bright pop rock with a huge chorus" --provider gemini=lyria-3.5
bun autoshow music "chill lo-fi beat" --all-providers --max-model-cents 10 --price
```

## Modes

Hosted generation loads saved `defaults.music` unless overridden. Without a saved selection, choose `--provider provider[=model]` or `--all-providers`. Repeat `--provider` to run independent targets; sibling failures do not cancel successful outputs, and missing targets remain recorded in the manifest. The command fails when no target produces music.

Local lyric-video mode uses `--audio <file>` or recursive `--batch <dir>` and ignores hosted defaults. Do not combine a hosted prompt or generation flags (`--provider`, `--all-providers`, `--duration`, `--lyrics-file`, `--instrumental`) with local flags (`--audio`, `--captions`, `--batch`, `--model`, `--font`). Neither `--audio` nor `--captions` can accompany `--batch`.

## Shared Music Options

- `--duration <seconds>`: provider-specific duration behavior below.
- `--lyrics-file <path>`: supplied lyrics. `--instrumental` takes precedence and skips them.
- `--provider-concurrency <n>`: target concurrency, default 7. `--concurrency-mode ramp|immediate` defaults to ramp.
- `--price`: estimate selected work and expected outputs without provider calls or run-directory creation.
- `--max-model-cents <n>`: exclude targets exceeding the per-model estimate ceiling.
- `--output-dir <dir>`: pin the hosted run, local run, or local batch parent directory.

## Music Services

### ElevenLabs

Supports `music_v2` and `music_v2_5`, requesting 48 kHz/192 kbps MP3. Explicit duration is 3–600 seconds. Prompt-only generation omits the length when unset; supplied lyrics default to 180 seconds, which is also the price-estimate fallback.

Lyrics headers such as `Verse 1` and `Chorus` form a composition plan of at most 30 sections; the prompt supplies musical styles. Instrumental mode uses the prompt instead of that plan. Registry pricing is per minute, so actual duration can change cost.

### MiniMax

Supports `music-3.0`, requesting 44.1 kHz/256 kbps MP3 with provider-controlled length up to five minutes. `--duration` is ignored with a warning. Prompts over 2000 characters are truncated; lyrics over 3500 are rejected. Omitted lyrics trigger a separate lyrics-generation request unless instrumental mode is selected, and the estimate includes that add-on.

Music and lyrics APIs are closed to new users; existing paying users retain access under [MiniMax's published access notice](https://platform.minimax.io/docs/pricing/overview). Selecting the model does not establish account eligibility.

### Gemini

Supports `lyria-3.5` through Gemini Interactions; the adapter records 44.1 kHz stereo MP3. Duration, lyrics, and instrumental requests are prompt instructions. Pricing is per song request; the default duration estimate is 120 seconds. The registry labels this model public preview and its timing estimate provisional.

## Lyric-Video Rendering

```bash
bun autoshow music --audio input/examples/lyrics/01-example-song.mp3
bun autoshow music --audio input/examples/lyrics/01-example-song.mp3 --captions output/<run-dir>/01-example-song.vtt
bun autoshow music --batch input/examples/lyrics --model small
```

`--captions` accepts edited VTT/SRT and skips whisperfile. Output stems follow the caption filename when supplied, otherwise the audio filename. A nearby image matching the basename or track number supplies the background; otherwise the renderer uses a spectrogram.

`--model` defaults to `small.en`; supported models are `tiny`, `tiny.en`, `small`, `small.en`, `medium`, `medium.en`, `large-v2`, and `large-v3`. `--font` defaults to `DejaVu Sans`.

## Output

Hosted runs write `manifest.json` and `generated-music.mp3` for one target, or `generated-music-<provider>-<model>.mp3` for multiple targets, under `output/<timestamp>_music-gen/`. Gemini may also retain generated lyrics/structure in `generated-music-gemini-lyria-3.5.txt` and extra audio as `generated-music-gemini-lyria-3.5-part-<n>.mp3`.

Local runs write `<stem>.mp4`, `<stem>.vtt`, `<stem>.srt`, and `manifest.json`; batches keep per-audio child directories and a parent manifest. `--output-dir` replaces the timestamped parent without flattening those children.

Use [resume](../../00-setup-and-utilities/resume.md) to inspect remaining hosted work before dispatch. Rates come from the current registry; `--price` is an estimate, not an invoice. [Tests](tests.md) distinguish local/mocked checks from paid coverage.
