# autoshow-cli

Bun-native CLI for turning media, documents, and text prompts into metadata, downloads, transcripts, OCR extracts, summaries, and generated speech, images, video, or music.

It supports both local and API-backed engines across STT, OCR, LLM, TTS, image, video, and music workflows. Defaults can be persisted in `config/autoshow.json`, and runnable commands perform cost preflight before execution.

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

- `--cookies-from-browser chrome` is the easiest path when yt-dlp can read your logged-in browser profile.
- `--cookies /absolute/path/to/cookies.txt` is the fallback when you want a dedicated Netscape cookie jar.
- `--cookies` wins when both flags are present. If that file is unreadable, AutoShow reports the path, passes no cookie argument to yt-dlp, and does not fall back to `--cookies-from-browser`.

## Common Workflows

```bash
# Metadata only (no download)
bun autoshow metadata "https://www.youtube.com/watch?v=u1-WHqATSQU"

# Metadata as Markdown frontmatter YAML
bun autoshow metadata "https://www.youtube.com/watch?v=u1-WHqATSQU" --markdown

# Download only
bun autoshow download "https://www.youtube.com/watch?v=u1-WHqATSQU"

# Extraction only (media routes to STT, documents to OCR, articles to URL extraction)
bun autoshow extract "https://www.youtube.com/watch?v=u1-WHqATSQU"

# Hosted Grok speech-to-text
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider grok=speech-to-text

# Render a synced speaker transcript video from a previous media extract run
bun autoshow extract output/<extract-run-dir> --transcript-video

# Render a transcript video from explicit local artifacts
bun autoshow extract --transcript-video --audio https://ajc.pics/autoshow/examples/1-audio.mp3 --transcript-result output/<extract-run-dir>/result.json

# Compare every URL article backend for one remote article
bun autoshow extract https://example.com/article --all-providers

# X Space metadata extraction (auto-detected, requires X_BEARER_TOKEN)
bun autoshow extract "https://x.com/i/spaces/1DXxyRYNejbKM"

# Document OCR / extraction
bun autoshow extract input/examples/document/1-document.pdf --format json

# ACSM fulfillment, then normal EPUB/PDF extraction
bun autoshow setup --step calibre
bun autoshow setup --step acsm-authorize
bun autoshow extract path/to/book.acsm

# Hosted Kimi OCR for a document
bun autoshow extract input/examples/document/1-document.pdf --provider kimi=kimi-k2.6

# Hosted Grok OCR for a document
bun autoshow extract input/examples/document/1-document.pdf --provider grok=grok-4.3

# Full write pipeline: download/extract/transcribe + summary output
bun autoshow write "https://www.youtube.com/watch?v=u1-WHqATSQU" --llm openai=gpt-5.5

# Full write pipeline with xAI Grok 4.5 (bare --llm grok still defaults to Grok 4.3)
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm grok=grok-4.5

# Full write pipeline with Z.AI GLM 5.1
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm glm=glm-5.1

# Full write pipeline with Kimi K2.6
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm kimi=kimi-k2.6

# Full write pipeline with Together-hosted Kimi K2.6
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm together=kimi-k2.6

# Full write pipeline with Together-hosted GLM 5.1
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm together=glm-5.1

# Full write pipeline with Cerebras public GPT OSS 120B
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm cerebras=gpt-oss-120b

# Full write pipeline with Cerebras public Z.ai GLM 4.7
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm cerebras=zai-glm-4.7

# Standalone text-to-speech from local text
bun autoshow tts input/examples/tts/1-tts.md --provider openai=gpt-4o-mini-tts-2025-12-15

# OpenAI text-to-speech with delivery instructions
bun autoshow tts input/examples/tts/1-tts.md --provider openai=gpt-4o-mini-tts-2025-12-15 --tts-instructions "Warm, unhurried, conversational"

# ElevenLabs Instant Voice Cloning
bun autoshow tts input/examples/tts/1-tts.md --provider elevenlabs=eleven_v3 --tts-ref-audio input/examples/audio/anthony-voice.mp3

# Hosted Grok text-to-speech
bun autoshow tts input/examples/tts/1-tts.md --provider grok=grok-tts --tts-voice eve

# Hosted Mistral Voxtral text-to-speech
bun autoshow tts input/examples/tts/1-tts.md --provider mistral=voxtral-mini-tts-2603 --tts-ref-audio input/examples/audio/anthony-voice.mp3

# MiniMax hosted text-to-speech
bun autoshow tts input/examples/tts/1-tts.md --provider minimax=speech-2.8-turbo --tts-voice English_expressive_narrator

# Hume Octave 2 text-to-speech
bun autoshow tts input/examples/tts/1-tts.md --provider hume=octave-2 --tts-voice "Male English Actor"

# Cartesia Sonic text-to-speech
bun autoshow tts input/examples/tts/1-tts.md --provider cartesia=sonic-3.5-2026-05-04 --tts-voice f786b574-daa5-4673-aa0c-cbe3e8534c02

# Prompt-driven generation, then edit/reference the generated image; run this block in order
bun autoshow image "a clean studio product photo of a red enamel camping mug on white seamless" --provider openai=gpt-image-2 --size 1024x1024 --format png --output-dir output/mug-base
bun autoshow image "make the mug matte black, keep the same camera angle, and place it on a walnut desk" --provider openai=gpt-image-2 --input output/mug-base/generated-image.png --format webp --compression 80 --output-dir output/mug-edit
bun autoshow image "restyle this product image as a 1960s travel poster" --provider gemini=gemini-3.1-flash-lite-image --input output/mug-base/generated-image.png --output-dir output/mug-gemini
bun autoshow image "a cinematic product photo of a red enamel camping mug" --provider bfl=flux-2-klein-4b --input output/mug-base/generated-image.png --size 1024x1024 --output-dir output/mug-bfl

# Video from the generated image, then extend/edit the generated video; run this block after output/mug-base exists
bun autoshow video "animate the red enamel mug on a slow turntable with glossy highlights" --provider gemini=veo-3.1-fast-generate-preview --mode image-to-video --input-image output/mug-base/generated-image.png --output-dir output/mug-video-base
bun autoshow video "continue the turntable move as the mug rotates toward a warm kitchen window" --provider gemini=veo-3.1-fast-generate-preview --mode extend --input-video output/mug-video-base/generated-video.mp4 --output-dir output/mug-video-extend
bun autoshow video "make the lighting moonlit blue while keeping the mug motion intact" --provider grok=grok-imagine-video --mode edit --input-video output/mug-video-base/generated-video.mp4 --output-dir output/mug-video-edit

# Standalone video generation with multiple providers
bun autoshow video "a timelapse storm over downtown chicago" --provider gemini=veo-3.1-lite-generate-preview --provider runway=gen4.5 --provider ltx=ltx-2-3-fast

# Hosted music generation
bun autoshow music "an ambient piano instrumental" --provider minimax=music-3.0
bun autoshow music "bright 90s pop rock with a huge chorus" --provider gemini=lyria-3-clip-preview

# Local lyric-video rendering from repo audio
bun autoshow music --audio input/examples/lyrics/01-example-song.mp3

# Fetch curated OpenAI docs into project/links/openai-all-links.md
bun autoshow links --openai

# Fetch Better Auth docs into project/links/better-auth-all-links.md
bun autoshow links --better-auth

# Fetch curated Kimi docs into project/links/kimi-all-links.md
bun autoshow links --kimi

# Fetch STT docs across providers into project/links/all-stt-links.md
bun autoshow links stt

# Fetch docs listed in a local URL file into project/links/urls-links.md
bun autoshow links urls.md
```

## Command Map

| Area | Commands |
|------|----------|
| Inspect and process | `metadata`, `download`, `extract`, `write` |
| Generate | `tts`, `image`, `video`, `music`, `comic` |
| Setup & Utilities | `setup`, `config`, `links`, `resume`, `benchmark` |

High-value notes:

- `write` is the central orchestration command. It can summarize transcripts or extracted documents, write JSON outputs, fan out across multiple LLM providers, and optionally continue into TTS, image, video, or music generation.
- `setup --models` lets you pre-download local runtimes without running inference, for example `bun autoshow setup --models tiny` or `bun autoshow setup --models ggml-org/gemma-3-270m-it-GGUF`.
- If YouTube starts blocking `yt-dlp`, follow [docs/cookies.md](./docs/cookies.md) to pass `--cookies-from-browser` or `--cookies`.

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
