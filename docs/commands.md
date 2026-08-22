# Commands

## Outline

- [Quick Start](#quick-start)
- [Command Map](#command-map)
- [Selection Guide](#selection-guide)
- [Pricing Preflight](#pricing-preflight)

## Quick Start

Use these as starting commands. Provider lists, flags, and outputs live on the command pages in the [Command Map](#command-map). `help` and `version` are built in.

```bash
# install dependencies
bun install

# inspect prerequisites, API keys, and config without installing
bun autoshow setup --doctor

# install local runtimes and tools
bun autoshow setup

# pre-download local STT models without running inference
bun autoshow setup --models tiny
bun autoshow setup --models whisperfile:small

# metadata only (no download or save)
bun autoshow metadata "https://www.youtube.com/watch?v=u1-WHqATSQU"

# metadata with save
bun autoshow metadata "https://www.youtube.com/watch?v=u1-WHqATSQU" --save

# metadata as Markdown frontmatter YAML
bun autoshow metadata "https://www.youtube.com/watch?v=u1-WHqATSQU" --markdown

# literal input that collides with a command name
bun autoshow metadata setup

# download only
bun autoshow download "https://www.youtube.com/watch?v=u1-WHqATSQU"

# extract hosted video media (no LLM summary)
bun autoshow extract "https://www.youtube.com/watch?v=u1-WHqATSQU"

# extract only (no LLM summary)
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3

# generic local Whisper STT
bun autoshow extract <input> --provider whisper=tiny

# extract with hosted STT
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider groq=whisper-large-v3

# document OCR/extraction only
bun autoshow extract input/examples/document/1-document.pdf

# document OCR/extraction as JSON
bun autoshow extract input/examples/document/1-document.pdf --format json

# URL article extraction with every backend
bun autoshow extract https://example.com/article --all-providers

# X Space metadata extraction (auto-detected, requires X_BEARER_TOKEN)
bun autoshow extract "https://x.com/i/spaces/1DXxyRYNejbKM"

# X post referencing a Space (looks up the post, extracts Space metadata)
bun autoshow extract "https://x.com/user/status/1234567890"

# render a synced transcript video from an existing media extract run
bun autoshow extract output/<extract-run-dir> --transcript-video

# render a transcript video from explicit local audio and STT result files
bun autoshow extract --transcript-video --audio input/audio.mp3 --transcript-result output/<extract-run-dir>/result.json

# batch extraction from a directory and a document subdirectory
bun autoshow extract input
bun autoshow extract input/examples/document

# full pipeline from hosted video media
bun autoshow write "https://www.youtube.com/watch?v=u1-WHqATSQU" --llm openai=gpt-5.5

# full pipeline (download/transcribe + cheapest hosted LLM write)
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3

# lyric draft generation from project text
bun autoshow write ./output/demo/text --prompt rockSong

# batch write from a newline-delimited URL list
bun autoshow write input/examples/batch/2-urls.md

# input beginning with a dash
bun autoshow write -- -myfile

# logging output controls
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --verbose
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --quiet
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --json

# text-to-speech
bun autoshow tts input/examples/tts/1-tts.md --provider openai=gpt-4o-mini-tts-2025-12-15

# text-to-speech with delivery instructions
bun autoshow tts input/examples/tts/1-tts.md --provider openai=gpt-4o-mini-tts-2025-12-15 --tts-instructions "Warm, unhurried, conversational"

# text-to-speech with a named voice
bun autoshow tts input/examples/tts/1-tts.md --provider elevenlabs=eleven_v3 --tts-voice hpp4J3VqNfWAUOO0d1Us

# text-to-speech with reference audio
bun autoshow tts input/examples/tts/1-tts.md --provider mistral=voxtral-mini-tts-2603 --tts-ref-audio input/examples/audio/anthony-voice.mp3

# voice catalog discovery and registration
bun autoshow voice list --provider elevenlabs --source account
bun autoshow voice import hero --provider elevenlabs --model eleven_v3 --voice-id hpp4J3VqNfWAUOO0d1Us --provenance-ref project:casting

# image generation, then edit the generated image; run this block in order
bun autoshow image "a clean studio product photo of a red enamel camping mug on white seamless" --provider openai=gpt-image-2 --size 1024x1024 --format png --output-dir output/mug-base
bun autoshow image "make the mug matte black, keep the same camera angle, and place it on a walnut desk" --provider openai=gpt-image-2 --input output/mug-base/generated-image.png --format webp --compression 80 --output-dir output/mug-edit

# image reference
bun autoshow image "restyle the generated mug as a 1960s travel poster" --provider gemini=gemini-3.1-flash-lite-image --input output/mug-base/generated-image.png --output-dir output/mug-gemini

# video from the generated image, then extend or edit the generated video; run this block after output/mug-base exists
bun autoshow video "animate the red enamel mug on a slow turntable with glossy highlights" --provider gemini=veo-3.1-fast-generate-preview --mode image-to-video --input-image output/mug-base/generated-image.png --output-dir output/mug-video-base
bun autoshow video "continue the turntable move as the mug rotates toward a warm kitchen window" --provider gemini=veo-3.1-fast-generate-preview --mode extend --input-video output/mug-video-base/generated-video.mp4 --output-dir output/mug-video-extend
bun autoshow video "make the lighting moonlit blue while keeping the mug motion intact" --provider grok=grok-imagine-video --mode edit --input-video output/mug-video-base/generated-video.mp4 --output-dir output/mug-video-edit

# video generation
bun autoshow video "a cinematic mountain sunrise" --provider gemini=veo-3.1-lite-generate-preview

# video generation with multiple providers
bun autoshow video "a timelapse storm over downtown chicago" --provider gemini=veo-3.1-lite-generate-preview --provider grok=grok-imagine-video --provider ltx=ltx-2-3-fast --provider lumalabs=ray-3.2

# local lyric-video render from repo audio
bun autoshow music --audio input/examples/lyrics/01-example-song.mp3
bun autoshow music --audio input/examples/lyrics/01-example-song.mp3 --captions output/<run-dir>/01-example-song.vtt
bun autoshow music --batch input/examples/lyrics --model small

# music generation
bun autoshow music "an ambient piano instrumental" --provider minimax=music-3.0
bun autoshow music "an ambient piano instrumental with soft strings" --provider minimax=music-3.0 --instrumental

# inspect or set persistent defaults
bun autoshow config --show
bun autoshow config --llm openai=gpt-5.5 --batch-limit 20 --max-cents 50
bun autoshow config --tts elevenlabs=eleven_v3 --tts-voice hpp4J3VqNfWAUOO0d1Us
bun autoshow config --reset

# fetch curated provider documentation links
bun autoshow links --openai
bun autoshow links stt
bun autoshow links urls.md

# command syntax, help, version, and the short alias
bun autoshow <command> [input] [flags]
bun autoshow
bun autoshow help <command>
bun autoshow <command> --help
bun autoshow --version
bun as <command>
bun as links --help
```

## Command Map

- `setup` / model pre-downloads: [setup](./commands/setup-and-utilities/setup/setup.md)
- `metadata`: [metadata](./commands/process-steps/step-0-metadata/metadata.md) — inspects media, documents, articles, and X/Twitter Space or post metadata without downloading the source.
- `download`: [download](./commands/process-steps/step-1-download/download-file.md) — downloads or stages media, documents, articles, and X Space audio before extraction.
- `extract`: [extract](./commands/process-steps/step-2-extract/01-extract.md) — routes media to STT, documents/images to OCR, article HTML to URL extraction, and X/Twitter Space or post links to the X API.
- `write`: [command](./commands/process-steps/step-3-write/write-text.md) | [setup](./commands/process-steps/step-3-write/write-text.md#setup)
- `tts`: [command](./commands/process-steps/step-4-tts/text-to-speech-and-voice.md) | [setup](./commands/process-steps/step-4-tts/text-to-speech-and-voice.md#setup)
- `voice`: [voice](./commands/process-steps/step-9-voice/00-voice-overview.md) — manages durable provider voice registrations separately from speech synthesis.
- `image`: [command](./commands/process-steps/step-5-image/text-to-image.md) | [setup](./commands/process-steps/step-5-image/text-to-image.md#setup)
- `video`: [video](./commands/process-steps/step-6-video/text-to-video-services.md)
- `music`: [music](./commands/process-steps/step-7-music/text-to-music-services.md)
- `comic`: [comic](./commands/process-steps/step-8-comic/00-comic-overview.md)
- `resume`: [resume](./commands/setup-and-utilities/resume/resume.md)
- `config`: [config](./commands/setup-and-utilities/config-command/config.md)
- `links`: [links](./commands/setup-and-utilities/links/links.md)

## Selection Guide

- Use `metadata` for quick metadata inspection without downloading, including X Space and post metadata.
- Use `download` for downloading media/documents, X Space audio, and collecting metadata.
- Use `extract` when you only need transcription, OCR, or URL extraction without LLM writing, to create an X Space report, or to render transcript videos from an extract run or explicit audio/transcript files.
- Use `write` for the full metadata, download, extract, and LLM text generation pipeline, and for lyric draft generation from `./output/<name>/text`. For speech, image, video, or music generation from written outputs, invoke `tts`, `image`, `video`, and `music`.
- Use standalone `tts`, `image`, `video`, and `music` commands for direct generation workflows.
- Use `voice` to list provider voice catalogs or manage durable voice registrations separately from speech synthesis.
- Use `music --audio`, `music --captions`, or `music --batch` for local lyric-video rendering from repo audio under `input/`; hosted music generation uses a prompt or local text file plus `--provider`.
- Use `comic` for episode-script to comic workflows: scene drafting, character sketches, panel and page images, dialogue and soundscape audio, and synchronized slideshows.
- Use `resume` to backfill missing extract, write LLM, TTS, image, video, or music providers in an existing output directory, including extract batch directories.
- Use `config --show`, `config --reset`, or selector flags such as `--llm`, `--stt`, `--image`, and `--max-cents` to inspect or persist reusable CLI defaults.
- Use `links` to fetch the curated provider documentation registry: all docs, a global section such as `stt`, a provider section, or URLs listed in a local `.md` / `.txt` file.

## Pricing Preflight

Most hosted or mixed-provider commands accept `--price` to print an estimated cost and exit without running the job. The human table lists step, provider, model, and cost, and adds input, setup, or estimated time when those values are known. `--json` includes the structured estimate fields. Estimates do not call paid providers or create remote jobs. Some list prices vary by plan, so treat the figure as a guide.

`music --audio` and `music --batch` are local lyric-video modes, so `--price` reports a free estimate and the expected render files.

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider groq=whisper-large-v3 --price
bun autoshow extract input/examples/document/1-document.pdf --provider deepinfra=Qwen/Qwen3-VL-30B-A3B-Instruct --price
bun autoshow extract https://example.com/article --all-providers --price
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm openai=gpt-5.5 --price
bun autoshow tts input/examples/tts/1-tts.md --provider elevenlabs=eleven_v3 --price
bun autoshow image "a sunset" --provider openai=gpt-image-2 --size 1024x1024 --quality low --price
bun autoshow video "a sunset timelapse" --provider gemini=veo-3.1-lite-generate-preview --price
bun autoshow music "an ambient piano instrumental" --provider minimax=music-3.0 --instrumental --price
bun autoshow comic generate-images 02-01 --target images --panels 1-16 --price
```
