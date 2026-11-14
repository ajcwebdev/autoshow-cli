# autoshow-cli

Bun-native CLI for text extraction, summaries, speech, images, video, music, and comics. STT, OCR, and article extraction have local engines; hosted workflows use provider APIs.

## Quick Start

With Bun installed:

```bash
bun install
bun autoshow setup --doctor
bun autoshow setup
```

Doctor checks tools, configuration, and credential presence without installing or calling providers. Setup installs local tools. Add hosted credentials to `.env`; see [setup](./docs/commands/00-setup-and-utilities/setup.md), [Docker](./docs/docker.md), and [YouTube cookies](./docs/commands/00-setup-and-utilities/cookies.md).

## Command Guide

| Command                                                          | Purpose                                                |
| ---------------------------------------------------------------- | ------------------------------------------------------ |
| [`metadata`](./docs/commands/01-sources/metadata/overview.md)    | Inspect and expand source metadata.                    |
| [`download`](./docs/commands/01-sources/download/overview.md)    | Download or stage sources.                             |
| [`extract`](./docs/commands/02-extract/overview.md)              | Transcribe media, extract documents, or read articles. |
| [`write`](./docs/commands/03-write/overview.md)                  | Generate text from local Markdown or plaintext.        |
| [`tts`](./docs/commands/04-audio/tts/overview.md)                | Generate speech and audiobook exports.                 |
| [`voice`](./docs/commands/04-audio/voice/00-voice-overview.md)   | Discover and manage provider voices.                   |
| [`image`](./docs/commands/05-visuals/image/overview.md)          | Generate or edit images.                               |
| [`video`](./docs/commands/05-visuals/video/overview.md)          | Generate video from supported text/media inputs.       |
| [`music`](./docs/commands/04-audio/music/overview.md)            | Generate music or local lyric videos.                  |
| [`comic`](./docs/commands/05-visuals/comic/00-comic-overview.md) | Produce scripts, artwork, audio, and slideshows.       |
| [`setup`](./docs/commands/00-setup-and-utilities/setup.md)       | Install tools, check readiness, and save defaults.     |
| [`resume`](./docs/commands/00-setup-and-utilities/resume.md)     | Recover incomplete or missing outputs.                 |
| [`links`](./docs/commands/00-setup-and-utilities/links.md)       | Fetch curated provider documentation.                  |

## Common Workflows

### Inspect and Download

```bash
bun autoshow metadata "https://www.youtube.com/watch?v=u1-WHqATSQU"
bun autoshow download "https://www.youtube.com/watch?v=u1-WHqATSQU"
```

### Transcribe and Summarize

```bash
bun autoshow extract input/examples/audio/1-audio.mp3 --provider whisperfile=tiny --output-dir output/transcript
bun autoshow write output/transcript/transcription.txt --provider openai=gpt-6.1-sol --prompt shortSummary takeaways
```

Install Whisperfile `tiny` and FFmpeg/FFprobe first. After extraction succeeds, the writer sends its saved transcript to OpenAI using `OPENAI_API_KEY`. `write` accepts local `.md`/`.txt` files or directories; extract URLs, media, and documents first. See [STT](./docs/commands/02-extract/stt/overview.md) for hosted transcription and diarization.

### Extract Articles and Documents

Local examples:

```bash
bun autoshow extract input/examples/document/harborlight-article.html --provider defuddle
bun autoshow extract input/examples/document/harborlight-field-notes.pdf --provider tesseract --no-chapters
bun autoshow extract input/examples/document/1-epub.epub
```

Directories and newline-delimited URL lists support [batch processing](./docs/commands/02-extract/overview.md#batch-inputs).

### Generate Media

Hosted examples; append `--price` to preview costs before execution:

```bash
bun autoshow tts input/examples/tts/01-tts-short.md --provider openai=gpt-4o-mini-tts-2025-12-15
bun autoshow image "a studio photo of a red enamel camping mug" --provider openai=gpt-image-2.5-flare --size 1024x1024
bun autoshow video "a timelapse storm over downtown chicago" --provider gemini=gemini-omni-1.1-flash
bun autoshow music "an ambient piano instrumental" --provider minimax=music-3.0 --instrumental
```

## Configuration and Pricing

Save defaults in `config/autoshow.json`; explicit runtime flags override them:

```bash
bun autoshow setup --show
bun autoshow setup --llm openai=gpt-6.1-sol --batch-limit 20 --max-cents 50
bun autoshow image "a studio photo of a red enamel camping mug" --provider openai=gpt-image-2.5-flare --size 1024x1024 --price
```

`--price` estimates without running the job or making paid calls. The saved `--max-cents` limit blocks over-budget estimates; `--allow-over-budget` overrides it for one run. Actual charges may differ. See [configuration and budgets](./docs/commands/00-setup-and-utilities/setup.md#setting-defaults-and-configuration).

## Help and Output

Use `bun autoshow <command> [input] [flags]`, or the shorter `bun as`:

```bash
bun autoshow help extract
bun autoshow --version
```

Most artifact-producing runs write `manifest.json` and outputs under a timestamped `output/` directory. Use `--output-dir` to choose the directory and [resume](./docs/commands/00-setup-and-utilities/resume.md) to continue compatible runs. [CLI usage](./docs/commands/00-setup-and-utilities/usage.md) covers logging, focused help, and JSON results.

## Development

```bash
bun run check
bun t --price
```

`bun t` forwards configured provider credentials and can bill providers. Select explicit local paths with `bun t:local`; it forwards no hosted credentials. Full-suite runs require explicit authorization under [repository rules](./AGENTS.md).

See [testing](./docs/commands/testing.md), [architecture diagrams](./docs/diagrams.md), and [design decisions](./docs/adr/README.md).
