# Commands

## Outline

- [Quick Start](#quick-start)
- [Command Map](#command-map)
- [Model Refresh Reports](#model-refresh-reports)
- [Selection Guide](#selection-guide)
- [Pricing Preflight](#pricing-preflight)

## Quick Start

Use these as starting commands. Provider lists, flags, and outputs live on the command pages in the [Command Map](#command-map). `help` and `version` are built in.

```bash
# inspect prerequisites, API keys, and config without installing
bun autoshow setup --doctor

# install local runtimes and tools
bun autoshow setup

# pre-download local STT models without running inference
bun autoshow setup --models tiny
bun autoshow setup --models whisperfile:small

# metadata
bun autoshow metadata "https://www.youtube.com/watch?v=u1-WHqATSQU"
bun autoshow metadata "https://www.youtube.com/watch?v=u1-WHqATSQU" --save
bun autoshow metadata "https://www.youtube.com/watch?v=u1-WHqATSQU" --markdown

# download
bun autoshow download "https://www.youtube.com/watch?v=u1-WHqATSQU"

# extract media, documents, articles, and X Spaces
bun autoshow extract "https://www.youtube.com/watch?v=u1-WHqATSQU"
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider deepinfra=openai/whisper-large-v3
bun autoshow extract input/examples/document/1-document.pdf
bun autoshow extract https://example.com/article --all-providers
bun autoshow extract "https://x.com/i/spaces/1DXxyRYNejbKM"

# render a transcript video from an extract run
bun autoshow extract output/<extract-run-dir> --transcript-video

# batch extract
bun autoshow extract input
bun autoshow extract input/examples/document

# write from extracted text or local markdown
bun autoshow extract "https://www.youtube.com/watch?v=u1-WHqATSQU"
bun autoshow write output/<extract-run>/transcription.txt --llm openai=gpt-5.5
bun autoshow write notes.md --llm openai=gpt-5.5
bun autoshow write ./output/demo/text --prompt rockSong

# text-to-speech
bun autoshow tts input/examples/tts/1-tts.md --provider openai=gpt-4o-mini-tts-2025-12-15
bun autoshow tts input/examples/tts/1-tts.md --provider openai=gpt-4o-mini-tts-2025-12-15 --tts-instructions "Warm, unhurried, conversational"
bun autoshow tts input/examples/tts/1-tts.md --provider elevenlabs=eleven_v3 --tts-voice hpp4J3VqNfWAUOO0d1Us
bun autoshow tts input/examples/tts/1-tts.md --provider mistral=voxtral-mini-tts-2603 --tts-ref-audio input/examples/audio/anthony-voice.mp3

# voice catalog discovery and registration
bun autoshow voice list --provider elevenlabs --source account
bun autoshow voice import hero --provider elevenlabs --model eleven_v3 --voice-id hpp4J3VqNfWAUOO0d1Us --provenance-ref project:casting

# image generation and edit
bun autoshow image "a clean studio product photo of a red enamel camping mug on white seamless" --provider openai=gpt-image-2 --size 1024x1024 --format png --output-dir output/mug-base
bun autoshow image "make the mug matte black, keep the same camera angle, and place it on a walnut desk" --provider openai=gpt-image-2 --input output/mug-base/generated-image.png --format webp --compression 80 --output-dir output/mug-edit

# video generation, image-to-video, and multi-provider
bun autoshow video "a cinematic mountain sunrise" --provider gemini=veo-3.1-lite-generate-preview
bun autoshow video "animate the red enamel mug on a slow turntable with glossy highlights" --provider gemini=veo-3.1-fast-generate-preview --mode image-to-video --input-image output/mug-base/generated-image.png --output-dir output/mug-video-base
bun autoshow video "a timelapse storm over downtown chicago" --provider gemini=veo-3.1-lite-generate-preview --provider grok=grok-imagine-video --provider ltx=ltx-2-3-fast --provider lumalabs=ray-3.2

# local lyric-video and hosted music generation
bun autoshow music --audio input/examples/lyrics/01-example-song.mp3
bun autoshow music "an ambient piano instrumental" --provider minimax=music-3.0 --instrumental

# adapt a prose treatment into a fixed-count comic script plus catalog entries
bun autoshow comic draft-treatment input/camp.md --episode 02 --speaker papa-bear

# inspect or set persistent defaults
bun autoshow config --show
bun autoshow config --llm openai=gpt-5.5 --batch-limit 20 --max-cents 50
bun autoshow config --reset

# fetch curated provider documentation
bun autoshow links --openai
bun autoshow links stt
bun autoshow links urls.md

# help, version, and the short alias
bun autoshow
bun autoshow help <command>
bun autoshow --version
bun as <command>
```

## Command Map

`extract` is the shared entrypoint for STT, OCR, and URL text. See the [extract overview](./commands/extract.md) for input routing and common options.

| Capability | Commands and guides |
| --- | --- |
| Sources | [`metadata`](./commands/01-sources/metadata/overview.md), [`download`](./commands/01-sources/download/overview.md) |
| STT | [`extract` media](./commands/02-stt/overview.md): [local](./commands/02-stt/local/overview.md), [diarization](./commands/02-stt/diarization/overview.md), [diarization off by default](./commands/02-stt/diarization-off-by-default/overview.md), [direct URL](./commands/02-stt/direct-url/overview.md) |
| Text | [`write`](./commands/03-text/write/overview.md), [`extract` OCR](./commands/03-text/ocr/overview.md), [`extract` URL](./commands/03-text/url/overview.md) |
| Audio | [`tts`](./commands/04-audio/tts/overview.md), [`voice`](./commands/04-audio/voice/00-voice-overview.md), [`music`](./commands/04-audio/music/overview.md) |
| Visuals | [`image`](./commands/05-visuals/image/overview.md), [`comic`](./commands/05-visuals/comic/00-comic-overview.md), [`video`](./commands/05-visuals/video/overview.md) |

STT workflows have separate guides for [captions](./commands/02-stt/workflows/captions/overview.md), [timing and speakers](./commands/02-stt/workflows/timing/overview.md), [transcript review](./commands/02-stt/workflows/transcript-review/overview.md), and [transcript videos](./commands/02-stt/workflows/transcript-video/overview.md).

Setup and utilities: [`setup`](./commands/00-setup-and-utilities/setup.md) installs prerequisites, [`config`](./commands/00-setup-and-utilities/config.md) manages defaults, [`resume`](./commands/00-setup-and-utilities/resume.md) backfills missing provider outputs, and [`links`](./commands/00-setup-and-utilities/links.md) fetches provider documentation.

## Model Refresh Reports

Dated model changes, pricing decisions, and validation evidence live under `docs/reports/`:

- STT: [Speech recognition models](reports/model-refresh-stt.md).
- Text: [Writing models](reports/model-refresh-write.md), [OCR models](reports/model-refresh-ocr.md), and [URL backends](reports/model-refresh-url.md).
- Audio: [TTS models](reports/model-refresh-tts.md) and [music models](reports/model-refresh-music.md).
- Visuals: [Image models](reports/model-refresh-image.md) and [video models](reports/model-refresh-video.md).

## Selection Guide

- Use `metadata` to inspect a source without downloading it, `download` when you need the file on disk, `extract` for transcripts, OCR, article text, X Space reports, or transcript videos, and `write` for hosted LLM text over local `.md` / `.txt` (including extract artifacts).
- Use `tts`, `image`, `video`, and `music` for generation from text or prompts. Use `voice` to list or register voices without synthesizing speech.
- Use `music --audio`, `--captions`, or `--batch` for local lyric videos from repo audio; hosted music uses a prompt or text file plus `--provider`.
- Use `comic` for episode-script to comic production, including scene drafts, blocking plans, character and location references, panel and page images, blocking and continuity QA, review artifacts, dialogue and soundscape audio, and slideshows. Use `comic draft-treatment` to turn a prose treatment into that episode script and its catalog entries first.
- Use `resume` to backfill missing providers in an existing output directory.
- Use `config` to inspect or persist defaults. Use `links` to fetch provider documentation.

## Pricing Preflight

Most hosted or mixed-provider commands accept `--price` to print an estimated cost and exit without running the job. Estimates do not call paid providers or create remote jobs. Some list prices vary by plan, so treat the figure as a guide.

`music --audio` and `music --batch` are local lyric-video modes, so `--price` reports a free estimate and the expected render files.

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider deepinfra=openai/whisper-large-v3 --price
bun autoshow extract input/examples/document/1-document.pdf --provider deepinfra=Qwen/Qwen3-VL-30B-A3B-Instruct --price
bun autoshow extract https://example.com/article --all-providers --price
bun autoshow write output/<extract-run>/transcription.txt --llm openai=gpt-5.5 --price
bun autoshow tts input/examples/tts/1-tts.md --provider elevenlabs=eleven_v3 --price
bun autoshow image "a sunset" --provider openai=gpt-image-2 --size 1024x1024 --quality low --price
bun autoshow video "a sunset timelapse" --provider gemini=veo-3.1-lite-generate-preview --price
bun autoshow music "an ambient piano instrumental" --provider minimax=music-3.0 --instrumental --price
bun autoshow comic draft-treatment input/camp.md --episode 02 --speaker papa-bear --price
bun autoshow comic draft-scenes 02-01 --only blocking --price
bun autoshow comic generate-images 02-01 --target images --panels 1-16 --price
```
