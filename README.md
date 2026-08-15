# autoshow-cli

Bun-native CLI for turning media, documents, and text prompts into metadata, downloads, transcripts, OCR extracts, summaries, and generated speech, images, video, or music.

It supports local and API-backed engines across STT and OCR, plus hosted LLM, TTS, image, video, and music workflows. Defaults can be persisted in `config/autoshow.json`, and runnable commands perform cost preflight before execution.

For command-specific details, use `bun autoshow help <command>` or browse the docs in [`docs/`](./docs/).

`bun autoshow` is the canonical command. `bun as <command>` is available as a shorter equivalent, for example `bun as links --help`.

## Quick Start

```bash
bun install
bun autoshow setup --doctor
bun autoshow setup
```

- `setup --doctor` verifies prerequisites, API keys, and config without installing anything.
- Local workflows can run without service API keys; service-backed commands require the relevant provider credentials.
- Docker users can build the Debian slim local-lite image with `docker build -t autoshow-cli:local .`; see [docs/docker.md](./docs/docker.md).

### YouTube Auth After Setup

If YouTube starts challenging `yt-dlp` requests with a bot-check or sign-in prompt, follow the exact browser-profile or `cookies.txt` setup commands in [docs/cookies.md](./docs/cookies.md).

Short version:

- `bun autoshow config --cookies-from-browser chrome` is the easiest path when yt-dlp can read your logged-in browser profile.
- `bun autoshow config --cookies /absolute/path/to/cookies.txt` is the fallback when you want a dedicated Netscape cookie jar.
- A configured cookies file wins when both settings are present. If that file is unreadable, AutoShow reports the path, passes no cookie argument to yt-dlp, and does not fall back to `--cookies-from-browser`.

## Common Workflows

These examples cover the primary workflows. Where both local and hosted execution are supported, both are shown. See the [command docs](./docs/commands.md) for every provider and model, batch inputs, reference and editing modes, transcript video rendering, specialized source types, and advanced options.

### Metadata and Download

```bash
# Inspect metadata without downloading
bun autoshow metadata "https://www.youtube.com/watch?v=u1-WHqATSQU"

# Download a source without extracting it
bun autoshow download "https://www.youtube.com/watch?v=u1-WHqATSQU"
```

### Extract

```bash
# Extract an article URL locally with Defuddle
bun autoshow extract https://example.com/article --url-provider defuddle

# Extract an article URL with hosted Firecrawl
bun autoshow extract https://example.com/article --url-provider firecrawl

# Extract a PDF locally with Tesseract
bun autoshow extract input/examples/document/1-document.pdf --provider tesseract --format json

# Extract a PDF with hosted OpenAI OCR
bun autoshow extract input/examples/document/1-document.pdf --provider openai=gpt-5.4-nano --format json

# Extract native text and chapters from an EPUB locally
bun autoshow extract input/examples/document/1-epub.epub

# Extract an EPUB with hosted OpenAI OCR
bun autoshow extract input/examples/document/1-epub.epub --provider openai=gpt-5.4-nano

# Transcribe locally without diarization using Whisperfile
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider whisperfile=tiny

# Transcribe with hosted Groq without diarization
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider groq=whisper-large-v3

# Transcribe with hosted Deepgram speaker diarization
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider deepgram=nova-3
```

### Write

```bash
# Run the full extract-and-write pipeline with the cheapest hosted LLM
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3

# Run the full extract-and-write pipeline with hosted OpenAI
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm openai=gpt-5.5

# Combine a short summary with key takeaways
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm openai=gpt-5.5 --prompt shortSummary takeaways

# Turn an article into a blog post
bun autoshow write https://example.com/article --llm openai=gpt-5.5 --prompt blog

# Draft a YouTube description from a video
bun autoshow write "https://www.youtube.com/watch?v=u1-WHqATSQU" --llm openai=gpt-5.5 --prompt youtubeDescription
```

### TTS and Music

```bash
# Generate speech with hosted OpenAI
bun autoshow tts input/examples/tts/1-tts.md --provider openai=gpt-4o-mini-tts-2025-12-15

# Render a lyric video locally from existing audio
bun autoshow music --audio input/examples/lyrics/01-example-song.mp3

# Generate instrumental music with hosted MiniMax
bun autoshow music "an ambient piano instrumental" --provider minimax=music-3.0 --instrumental
```

### Image and Video

```bash
# Generate an image with hosted OpenAI
bun autoshow image "a clean studio product photo of a red enamel camping mug" --provider openai=gpt-image-2 --size 1024x1024 --output-dir output/mug-image

# Animate the generated image with hosted Gemini
bun autoshow video "animate the mug on a slow turntable" --provider gemini=veo-3.1-fast-generate-preview --mode image-to-video --input-image output/mug-image/generated-image.png --output-dir output/mug-video

# Generate a video with hosted Gemini
bun autoshow video "a timelapse storm over downtown chicago" --provider gemini=veo-3.1-lite-generate-preview
```

### Comic and Voice

```bash
# Register an existing provider voice locally without making a provider call
bun autoshow voice import hero --provider elevenlabs --model eleven_v3 --voice-id hpp4J3VqNfWAUOO0d1Us --origin provider-stock --provenance-ref project:casting

# Discover voices from a hosted ElevenLabs account
bun autoshow voice discover --provider elevenlabs --source account

# Draft structured comic scenes with hosted OpenAI
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md

# Generate final comic panels with hosted OpenAI
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images --image-model gpt-image-2

# Generate multi-speaker comic audio with hosted Gemini
bun autoshow comic generate-audio 01-01 --provider gemini=gemini-3.1-flash-tts-preview --profile default

# Synchronize canonical comic panels with a complete audio run using local FFmpeg
bun autoshow comic generate-slideshow 01-01
```

## Command Map

| Area | Commands |
|------|----------|
| Inspect and process | `metadata`, `download`, `extract`, `write` |
| Generate | `tts`, `image`, `video`, `music`, `comic` |
| Setup & Utilities | `setup`, `config`, `links`, `resume` |

High-value notes:

- `write` is the central orchestration command. It can summarize transcripts or extracted documents, write JSON outputs, fan out across multiple LLM providers, and optionally continue into TTS, image, video, or music generation.
- `setup --models` lets you pre-download local STT runtimes without running inference, for example `bun autoshow setup --models tiny` or `bun autoshow setup --models whisperfile:small`.
- If YouTube starts blocking `yt-dlp`, follow [docs/cookies.md](./docs/cookies.md) to persist `--cookies-from-browser` or `--cookies` with `bun autoshow config`.

## Usage Basics

Use command-first order for all examples and scripts:

```bash
bun autoshow <command> [input] [flags]
bun autoshow help <command>       # preferred targeted help
bun autoshow <command> --help
bun autoshow --version
```

- Use `bun autoshow extract <input> --provider whisper=tiny`, not `bun autoshow --provider whisper=tiny extract <input>`.
- Inputs can be URLs, local files, directories, `.md`/`.txt` URL lists, or prompt strings for `image`, `video`, and `music`.
- If an input begins with `-`, end flag parsing first: `bun autoshow write -- -myfile`.
- If the literal input collides with a command name, use the explicit command form: `bun autoshow metadata setup`.
- `.acsm` document inputs are supported through setup-managed Calibre ACSM plugin scripts. Run `bun autoshow setup --step calibre`, then `bun autoshow setup --step acsm-authorize`, and AutoShow fulfills to EPUB/PDF locally before extraction.

### Batch Inputs

Batch mode is selected from the input type rather than a separate subcommand:

```bash
# Newline-delimited URLs
bun autoshow write input/examples/batch/2-urls.md

# Process files plus 2-urls.md inside the directory
bun autoshow extract input

# Process local files in an input subdirectory
bun autoshow extract input/examples/document
```

Common batch controls:

- `--batch-limit`
- `--batch-all`
- `--batch-order newest|oldest`
- `--batch-concurrency`

## Config, Pricing, and Logging

Persistent defaults live in `config/autoshow.json`. You can save provider choices, model defaults, prompts, extract options, voices, batch settings, and pricing thresholds.

```bash
bun autoshow config --show
bun autoshow config --llm openai=gpt-5.5 --batch-limit 20 --max-cents 50
bun autoshow config --tts elevenlabs=eleven_v3 --tts-ref-audio input/examples/audio/anthony-voice.mp3
bun autoshow config --tts minimax=speech-2.8-turbo --tts-voice English_expressive_narrator
bun autoshow config --tts hume=octave-2 --tts-voice "Male English Actor"
bun autoshow config --tts cartesia=sonic-3.5-2026-05-04 --tts-voice f786b574-daa5-4673-aa0c-cbe3e8534c02
bun autoshow config --reset
```

Pricing and budget behavior:

- Runnable commands estimate cost before execution.
- `--price` is the estimate-only mode.
- `--allow-over-budget` overrides a configured hard budget for a single run.
- `--config-path` lets you use an alternate config file on any command.

Logging controls:

```bash
# CLI flags
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --verbose
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --quiet
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --json

# Environment variables
NO_COLOR=1                 # disable ANSI color in human logs and help
FORCE_COLOR=1              # force ANSI color in redirected output
```

- Human-readable logs color table columns and log prefixes when output is a TTY; `NO_COLOR` disables this and `FORCE_COLOR` enables it for captured output.
- JSON logs and `--json` output stay machine-readable and uncolored.
- Secrets and credentials are redacted from logger output.

## Output Layout

Most artifact-producing runs write a timestamped directory under `output/` with one unversioned `manifest.json` plus the files for the steps that actually ran. Standalone `tts`, `image`, `video`, and hosted `music` accept `--output-dir <dir>` to choose the run directory exactly.

Typical artifacts include:

- downloaded media or normalized documents
- `prompt.md`
- `transcription.txt`
- extracted text or OCR output
- `providers/<backend>/extraction.txt` and `providers/<backend>/result.json` for `extract <url> --all-providers`
- `text.json`
- generated speech, image, video, or music files
- `manifest.json`
- `metadata.md` for `metadata --markdown --save`

Single runs and batches use the same canonical manifest shape. Mixed `extract` batches use a parent manifest whose items link to nested `media/`, `document/`, `article/`, and `x-space/` child directories; each child root also owns exactly one canonical manifest. Source identity, item status, and provider progress live in that shape rather than companion control files.

Notable exceptions:

- `metadata --save` reports `manifest.json`, and `metadata --markdown --save` also reports `metadata.md`
- `links` writes to a selection-based file under `project/links/`, for example `project/links/all-all-links.md`
- utility commands such as `config`, `setup`, and `links` do not use the `output/` run-directory pattern

## Development

```bash
bun run check
bun test test/test-cases/validation/cli/cli-help-contracts.test.ts
bun test test/test-cases/validation/cli/cli-usage-errors.test.ts
bun test test/test-cases/validation/cli/option-resolution-contracts/
```

- `bun run check` is the default verification pass for docs and code changes.
- The three targeted `bun test` commands above are the no-cost smoke set for CLI help, usage errors, and option resolution.
- `bun t`, `bun run t`, and `bun test/test-runner.ts` are full-runner commands for human service/e2e coverage. They may call paid or quota-limited providers and should only be run when that exact run is explicitly approved.
