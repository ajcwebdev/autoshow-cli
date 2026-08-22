# Commands

## Outline

- [Quick Start](#quick-start)
- [Command Map](#command-map)
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
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider groq=whisper-large-v3
bun autoshow extract input/examples/document/1-document.pdf
bun autoshow extract https://example.com/article --all-providers
bun autoshow extract "https://x.com/i/spaces/1DXxyRYNejbKM"

# render a transcript video from an extract run
bun autoshow extract output/<extract-run-dir> --transcript-video

# batch extract
bun autoshow extract input
bun autoshow extract input/examples/document

# full write pipeline
bun autoshow write "https://www.youtube.com/watch?v=u1-WHqATSQU" --llm openai=gpt-5.5
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3
bun autoshow write ./output/demo/text --prompt rockSong
bun autoshow write input/examples/batch/2-urls.md

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

- `setup`: [setup](./commands/setup-and-utilities/setup/setup.md) — install local runtimes and pre-download STT models
- `metadata`: [metadata](./commands/process-steps/step-0-metadata/metadata.md) — inspect source metadata without downloading
- `download`: [download](./commands/process-steps/step-1-download/download-file.md) — download or stage a source before extraction
- `extract`: [extract](./commands/process-steps/step-2-extract/01-extract.md) — transcribe media, extract documents or articles, report on X Spaces, or render transcript videos
- `write`: [write](./commands/process-steps/step-3-write/write-text.md) — run extract plus hosted LLM text generation
- `tts`: [tts](./commands/process-steps/step-4-tts/text-to-speech-and-voice.md) — generate speech from text
- `voice`: [voice](./commands/process-steps/step-9-voice/00-voice-overview.md) — list and register provider voices
- `image`: [image](./commands/process-steps/step-5-image/text-to-image.md) — generate or edit images
- `video`: [video](./commands/process-steps/step-6-video/text-to-video-services.md) — generate, extend, or edit video
- `music`: [music](./commands/process-steps/step-7-music/text-to-music-services.md) — generate music or render local lyric videos
- `comic`: [comic](./commands/process-steps/step-8-comic/00-comic-overview.md) — turn episode scripts into comics
- `resume`: [resume](./commands/setup-and-utilities/resume/resume.md) — backfill missing providers in an existing run
- `config`: [config](./commands/setup-and-utilities/config-command/config.md) — inspect or persist CLI defaults
- `links`: [links](./commands/setup-and-utilities/links/links.md) — fetch curated provider documentation

## Selection Guide

- Use `metadata` to inspect a source without downloading it, `download` when you need the file on disk, `extract` for transcripts, OCR, article text, X Space reports, or transcript videos, and `write` for that extract pipeline plus LLM text.
- Use `tts`, `image`, `video`, and `music` for generation from text or prompts. Use `voice` to list or register voices without synthesizing speech.
- Use `music --audio`, `--captions`, or `--batch` for local lyric videos from repo audio; hosted music uses a prompt or text file plus `--provider`.
- Use `comic` for episode-script to comic production, including scene drafts, character sketches, panel and page images, dialogue and soundscape audio, and slideshows.
- Use `resume` to backfill missing providers in an existing output directory.
- Use `config` to inspect or persist defaults. Use `links` to fetch provider documentation.

## Pricing Preflight

Most hosted or mixed-provider commands accept `--price` to print an estimated cost and exit without running the job. Estimates do not call paid providers or create remote jobs. Some list prices vary by plan, so treat the figure as a guide.

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
