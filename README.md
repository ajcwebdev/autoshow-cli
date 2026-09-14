# autoshow-cli

Bun-native CLI for extracting text from media, documents, and web pages, writing summaries, and generating speech, images, video, music, and comics. STT, OCR, and article extraction support local engines; hosted workflows use provider APIs.

## Quick Start

From a checkout with Bun installed:

```bash
bun install
bun autoshow setup --doctor
bun autoshow setup
```

`setup --doctor` checks prerequisites, configuration, and API-key presence without installing anything or calling providers. `setup` installs local runtimes and tools. For hosted workflows, add the relevant credentials to `.env`; each command guide lists its variables.

See [setup](./docs/commands/00-setup-and-utilities/setup.md) for targeted installs and model downloads, [Docker](./docs/docker.md) for container usage, and [YouTube cookies](./docs/commands/00-setup-and-utilities/cookies.md) for sign-in or bot-check failures.

## Command Guide

| Command | Use it to |
| --- | --- |
| [`metadata`](./docs/commands/01-sources/metadata/overview.md) | Inspect a source without downloading it. |
| [`download`](./docs/commands/01-sources/download/overview.md) | Download or stage a source before extraction. |
| [`extract`](./docs/commands/02-extract/overview.md) | Transcribe media, extract document text, or read articles. |
| [`write`](./docs/commands/03-write/overview.md) | Generate summaries, show notes, or other writing from local Markdown or text. |
| [`tts`](./docs/commands/04-audio/tts/overview.md) | Generate speech from local text. |
| [`voice`](./docs/commands/04-audio/voice/00-voice-overview.md) | Discover and manage reusable provider voices. |
| [`image`](./docs/commands/05-visuals/image/overview.md) | Generate or edit images. |
| [`video`](./docs/commands/05-visuals/video/overview.md) | Generate video from prompts, images, or supported video inputs. |
| [`music`](./docs/commands/04-audio/music/overview.md) | Generate music or render local lyric videos. |
| [`comic`](./docs/commands/05-visuals/comic/00-comic-overview.md) | Turn treatments and scripts into comic artwork, audio, and slideshows. |
| [`setup`](./docs/commands/00-setup-and-utilities/setup.md) | Install tools, check prerequisites, and save defaults. |
| [`resume`](./docs/commands/00-setup-and-utilities/resume.md) | Recover incomplete runs or fill missing provider outputs. |
| [`links`](./docs/commands/00-setup-and-utilities/links.md) | Fetch curated provider documentation. |

`extract` chooses its route from the input. Its detailed guides cover [speech-to-text](./docs/commands/02-extract/stt/overview.md), [documents and OCR](./docs/commands/02-extract/ocr/overview.md), and [web pages](./docs/commands/02-extract/url/overview.md).

## Common Workflows

### Inspect and Download

```bash
bun autoshow metadata "https://www.youtube.com/watch?v=u1-WHqATSQU"
bun autoshow download "https://www.youtube.com/watch?v=u1-WHqATSQU"
```

### Transcribe and Summarize

Transcribe locally, then send the saved transcript to a hosted writer:

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider whisperfile=tiny --output-dir output/transcript
bun autoshow write output/transcript/transcription.txt --provider openai=gpt-5.6-sol --prompt shortSummary takeaways
```

`write` accepts local `.md` and `.txt` files or directories of those files. Use `extract` first for URLs, media, and documents. Hosted transcription and speaker diarization options are in the [STT guide](./docs/commands/02-extract/stt/overview.md).

### Extract Articles and Documents

These examples use local extraction:

```bash
bun autoshow extract https://example.com/article --provider defuddle
bun autoshow extract input/examples/document/1-document.pdf --provider tesseract
bun autoshow extract input/examples/document/1-epub.epub
```

Pass a directory or a newline-delimited URL list for a batch. See [batch inputs](./docs/commands/02-extract/overview.md#batch-inputs) for limits, ordering, and concurrency.

### Generate Media

These examples use hosted providers:

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider openai=gpt-4o-mini-tts-2025-12-15
bun autoshow image "a studio photo of a red enamel camping mug" --provider openai=gpt-image-2 --size 1024x1024
bun autoshow video "a timelapse storm over downtown chicago" --provider gemini=gemini-omni-1.1-flash
bun autoshow music "an ambient piano instrumental" --provider minimax=music-3.0 --instrumental
```

The command guides cover provider choices, editing, voice registration, and staged comic production.

## Configuration and Pricing

Save defaults in `config/autoshow.json` through `setup`. Explicit runtime flags override saved settings.

```bash
bun autoshow setup --show
bun autoshow setup --llm openai=gpt-5.6-sol --batch-limit 20 --max-cents 50
```

Hosted and mixed-provider runs estimate cost before execution. Append `--price` to preview the estimate without running the job or making paid provider calls:

```bash
bun autoshow image "a studio photo of a red enamel camping mug" --provider openai=gpt-image-2 --size 1024x1024 --price
```

`--max-cents` sets a hard budget; `--allow-over-budget` overrides it for one run. Provider plans can affect actual billing. See [configuration and budgets](./docs/commands/00-setup-and-utilities/setup.md#setting-defaults-and-configuration) for saved providers, voices, prompts, and other defaults.

## Help and Output

Use command-first syntax: `bun autoshow <command> [input] [flags]`. `bun as <command>` is a shorter equivalent.

```bash
bun autoshow help extract
bun autoshow --version
```

Most artifact-producing runs save a timestamped directory under `output/`, containing `manifest.json` and the command's output files. Use `--output-dir <dir>` to choose the run directory. Command pages describe their artifacts; [resume](./docs/commands/00-setup-and-utilities/resume.md) explains how to continue an existing run.

See [CLI usage](./docs/commands/00-setup-and-utilities/usage.md) for focused help, logging, and JSON output for scripts.

## Development

Run the default local checks and price-only preflight:

```bash
bun run check
bun t --price
```

The [testing guide](./docs/commands/testing.md) covers targeted smoke tests and provider verification. Full-suite execution requires explicit approval under [repository rules](./AGENTS.md). Architecture details live in [diagrams](./docs/diagrams.md) and [design decisions](./docs/adr/README.md); dated provider changes live in [model refresh reports](./docs/reports/).
