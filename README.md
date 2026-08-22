# autoshow-cli

Bun-native CLI for turning media, documents, and text prompts into metadata, downloads, transcripts, OCR extracts, summaries, and generated speech, images, video, or music.

It supports local and API-backed engines across STT and OCR, plus hosted LLM, TTS, image, video, and music workflows. Defaults can be persisted in `config/autoshow.json`, and runnable commands perform cost preflight before execution.

For command-specific details, use `bun autoshow help <command>` or browse the docs in [`docs/`](./docs/).

`bun autoshow` is the primary command. `bun as <command>` is a shorter equivalent, for example `bun as links --help`.

## Quick Start

```bash
bun install
bun autoshow setup --doctor
bun autoshow setup
```

- `setup --doctor` verifies prerequisites, API keys, and config without installing anything.
- Local workflows can run without service API keys; service-backed commands require the relevant provider credentials.
- Docker users can build the image with `docker build -t autoshow-cli:local .`; see [docs/docker.md](./docs/docker.md).
- If YouTube starts blocking `yt-dlp`, persist cookies with `bun autoshow config` as described in [docs/cookies.md](./docs/cookies.md).

## Common Workflows

These examples cover the primary workflows. Where both local and hosted execution are supported, both are shown. See the [command overview](./docs/commands.md) for the command map and selection guide, and the linked command pages for provider lists, flags, and advanced options.

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
bun autoshow extract https://example.com/article --provider defuddle

# Extract an article URL with hosted Firecrawl
bun autoshow extract https://example.com/article --provider firecrawl

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
# Transcribe media, then write a summary
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3
bun autoshow write output/<extract-run>/transcription.txt --llm openai=gpt-5.5 --prompt shortSummary takeaways

# Extract an article, then write a blog post
bun autoshow extract https://example.com/article
bun autoshow write output/<extract-run>/extraction.txt --llm openai=gpt-5.5 --prompt blog

# Write from a local markdown file
bun autoshow write notes.md --llm openai=gpt-5.5 --prompt shortSummary
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
bun autoshow voice list --provider elevenlabs --source account

# Draft structured comic scenes with hosted OpenAI
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md

# Generate final comic panels with hosted OpenAI
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images --image-model gpt-image-2

# Generate multi-speaker comic audio with hosted Gemini
bun autoshow comic generate-audio 01-01 --provider gemini=gemini-3.1-flash-tts-preview --profile default

# Synchronize comic panels with a complete audio run using local FFmpeg
bun autoshow comic generate-slideshow 01-01
```

## Command Map

| Area                | Commands                                           |
| ------------------- | -------------------------------------------------- |
| Inspect and process | `metadata`, `download`, `extract`, `write`         |
| Generate            | `tts`, `voice`, `image`, `video`, `music`, `comic` |
| Setup & Utilities   | `setup`, `config`, `links`, `resume`               |

- `write` generates structured LLM text from local `.md` or `.txt` files, writes JSON and rendered markdown, and can fan out across multiple LLM providers. Transcribe URLs or media with `extract` first.
- `setup --models` pre-downloads local STT runtimes without running inference, for example `bun autoshow setup --models tiny` or `bun autoshow setup --models whisperfile:small`.

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
- If an input begins with `-`, prefix it so it is not parsed as a flag: `bun autoshow write ./-myfile`.
- If the literal input collides with a command name, use the explicit command form: `bun autoshow metadata setup`.
- `.acsm` files are unsupported. Obtain a lawful readable EPUB or PDF outside AutoShow before processing the book.

### Batch Inputs

Batch mode is selected from the input type rather than a separate subcommand:

```bash
# Newline-delimited URLs
bun autoshow extract input/examples/batch/2-urls.md

# Process files plus 2-urls.md inside the directory
bun autoshow extract input

# Process local files in an input subdirectory
bun autoshow extract input/examples/document
```

Common batch controls:

- `--batch-limit <n|all>`
- `--batch-order newest|oldest`
- `--batch-concurrency`

## Config, Pricing, and Logging

Persistent defaults live in `config/autoshow.json`. You can save provider choices, model defaults, prompts, extract options, voices, batch settings, and pricing thresholds.

```bash
bun autoshow config --show
bun autoshow config --llm openai=gpt-5.5 --batch-limit 20 --max-cents 50
bun autoshow config --tts elevenlabs=eleven_v3 --tts-voice hpp4J3VqNfWAUOO0d1Us
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
bun autoshow write notes.md --verbose
bun autoshow write notes.md --quiet
bun autoshow write notes.md --json

# Environment variables
NO_COLOR=1                 # disable ANSI color in human logs and help
FORCE_COLOR=1              # force ANSI color in redirected output
```

- Human logs use color on a TTY. `NO_COLOR` disables color; `FORCE_COLOR` enables it when output is redirected.
- `--json` output is uncolored. Secrets are redacted from logs.

## Output Layout

Most artifact-producing runs write a timestamped directory under `output/` with `manifest.json` plus the files for the steps that ran. Commands that create a run directory accept `--output-dir <dir>` to pin that directory instead of a timestamped `output/<timestamp>_<slug>` path.

Typical artifacts include:

- downloaded media or converted documents
- `prompt.md`
- `transcription.txt`
- extracted text or OCR output
- `providers/<backend>/extraction.txt` and `providers/<backend>/result.json` for `extract <url> --all-providers`
- `text.json`
- generated speech, image, video, or music files
- `manifest.json`
- `metadata.md` for `metadata --markdown --save`

Mixed `extract` batches write a parent directory with nested `media/`, `document/`, `article/`, and `x-space/` child directories.

Notable exceptions:

- `metadata --save` reports `manifest.json`, and `metadata --markdown --save` also reports `metadata.md`
- utility commands such as `config` and `setup` do not use the `output/` run-directory pattern

## Development

```bash
bun run check
bun test test/test-cases/validation/cli/cli-help-contracts.test.ts
bun test test/test-cases/validation/cli/cli-usage-errors/
bun test test/test-cases/validation/cli/option-resolution-contracts/
```

`bun run check` is the default verification pass. The three `bun test` commands are a no-cost smoke set. `bun t`, `bun run t`, and `bun test/test-runner.ts` may call paid or quota-limited providers and should only be run when that exact run is explicitly approved.
