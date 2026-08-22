# Commands

## Outline

- [Quick Start](#quick-start)
- [Command Map](#command-map)
- [Selection Guide](#selection-guide)
- [Pricing Preflight](#pricing-preflight)

## Quick Start

AutoShow currently exposes 14 named commands, plus built-in `help` and `version`.

```bash
# install dependencies
bun install

# inspect prerequisites, API keys, and config without installing
bun autoshow setup --doctor

# install/setup local runtimes and tools
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

# extract with local Whisperfile STT
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider whisperfile=tiny

# extract with Groq STT
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider groq=whisper-large-v3

# extract with xAI Grok STT
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider grok=speech-to-text

# extract with DeepInfra Whisper STT
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider deepinfra=openai/whisper-large-v3-turbo

# extract with Happy Scribe STT
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider happyscribe=auto

# extract with Deepgram STT
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider deepgram=nova-3

# extract with AssemblyAI STT
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider assemblyai=universal-3-5-pro

# document OCR/extraction only
bun autoshow extract input/examples/document/1-document.pdf

# document OCR/extraction as JSON
bun autoshow extract input/examples/document/1-document.pdf --format json

# document OCR with DeepInfra
bun autoshow extract input/examples/document/1-document.pdf --provider deepinfra=Qwen/Qwen3-VL-30B-A3B-Instruct

# document OCR with Kimi
bun autoshow extract input/examples/document/1-document.pdf --provider kimi=kimi-k2.6

# document OCR with Grok
bun autoshow extract input/examples/document/1-document.pdf --provider grok=grok-4.3

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

# render a transcript video using remote audio and an existing STT result
bun autoshow extract --transcript-video --audio https://ajc.pics/autoshow/examples/1-audio.mp3 --transcript-result output/<extract-run-dir>/result.json

# batch extraction from a directory and a document subdirectory
bun autoshow extract input
bun autoshow extract input/examples/document

# full pipeline from hosted video media
bun autoshow write "https://www.youtube.com/watch?v=u1-WHqATSQU" --llm openai=gpt-5.5

# full pipeline (download/transcribe + cheapest hosted LLM write)
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3

# full pipeline with hosted OpenAI
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm openai=gpt-5.5

# full pipeline with xAI Grok 4.5 (bare --llm grok still defaults to Grok 4.3)
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm grok=grok-4.5

# full pipeline with Z.AI GLM 5.1
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm glm=glm-5.1

# full pipeline with Kimi K2.6
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm kimi=kimi-k2.6

# full pipeline with Together-hosted Kimi K2.6
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm together=kimi-k2.6

# full pipeline with Together-hosted GLM 5.1
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm together=glm-5.1

# full pipeline with Cerebras public GPT OSS 120B
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm cerebras=gpt-oss-120b

# full pipeline with Cerebras public Z.ai GLM 4.7
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm cerebras=zai-glm-4.7

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

# text-to-speech with OpenAI
bun autoshow tts input/examples/tts/1-tts.md --provider openai=gpt-4o-mini-tts-2025-12-15

# OpenAI text-to-speech with delivery instructions
bun autoshow tts input/examples/tts/1-tts.md --provider openai=gpt-4o-mini-tts-2025-12-15 --tts-instructions "Warm, unhurried, conversational"

# text-to-speech with Gemini
bun autoshow tts input/examples/tts/1-tts.md --provider gemini=gemini-3.1-flash-tts-preview

# text-to-speech with ElevenLabs
bun autoshow tts input/examples/tts/1-tts.md --provider elevenlabs=eleven_v3 --tts-voice hpp4J3VqNfWAUOO0d1Us

# text-to-speech with xAI Grok
bun autoshow tts input/examples/tts/1-tts.md --provider grok=grok-tts --tts-voice eve

# text-to-speech with Groq English Orpheus
bun autoshow tts input/examples/tts/1-tts.md --provider groq=canopylabs/orpheus-v1-english --tts-voice troy

# text-to-speech with Mistral Voxtral reference audio
bun autoshow tts input/examples/tts/1-tts.md --provider mistral=voxtral-mini-tts-2603 --tts-ref-audio input/examples/audio/anthony-voice.mp3

# text-to-speech with MiniMax hosted voices
bun autoshow tts input/examples/tts/1-tts.md --provider minimax=speech-2.8-turbo --tts-voice English_expressive_narrator

# text-to-speech with Hume Octave 2
bun autoshow tts input/examples/tts/1-tts.md --provider hume=octave-2 --tts-voice "Male English Actor"

# text-to-speech with Cartesia Sonic
bun autoshow tts input/examples/tts/1-tts.md --provider cartesia=sonic-3.5-2026-05-04 --tts-voice f786b574-daa5-4673-aa0c-cbe3e8534c02

# voice catalog discovery and registration
bun autoshow voice list --provider elevenlabs --source account
bun autoshow voice import hero --provider elevenlabs --model eleven_v3 --voice-id hpp4J3VqNfWAUOO0d1Us --provenance-ref project:casting

# image generation, then edit/reference the generated image; run this block in order
bun autoshow image "a clean studio product photo of a red enamel camping mug on white seamless" --provider openai=gpt-image-2 --size 1024x1024 --format png --output-dir output/mug-base
bun autoshow image "make the mug matte black, keep the same camera angle, and place it on a walnut desk" --provider openai=gpt-image-2 --input output/mug-base/generated-image.png --format webp --compression 80 --output-dir output/mug-edit

# image reference with native Gemini
bun autoshow image "restyle the generated mug as a 1960s travel poster" --provider gemini=gemini-3.1-flash-lite-image --input output/mug-base/generated-image.png --output-dir output/mug-gemini
bun autoshow image "restyle this product image as a 1960s travel poster" --provider gemini=gemini-3.1-flash-lite-image --input output/mug-base/generated-image.png --output-dir output/mug-gemini

# image references with BFL
bun autoshow image "place the same mug on a rustic breakfast table" --provider bfl=flux-2-klein-4b --input output/mug-base/generated-image.png --size 1024x1024 --output-dir output/mug-bfl
bun autoshow image "a cinematic product photo of a red enamel camping mug" --provider bfl=flux-2-klein-4b --input output/mug-base/generated-image.png --size 1024x1024 --output-dir output/mug-bfl

# image generation with BFL
bun autoshow image "a sunset over mountains" --provider bfl=flux-2-klein-4b --size 1024x1024

# image generation with Luma Labs
bun autoshow image "a sunset over mountains" --provider lumalabs=uni-1 --aspect-ratio 16:9

# image generation with fal.ai
bun autoshow image "a launch poster with crisp typography" --provider fal=alibaba/qwen-image-3 --count 2

# video from the generated image, then extend/edit the generated video; run this block after output/mug-base exists
bun autoshow video "animate the red enamel mug on a slow turntable with glossy highlights" --provider gemini=veo-3.1-fast-generate-preview --mode image-to-video --input-image output/mug-base/generated-image.png --output-dir output/mug-video-base
bun autoshow video "continue the turntable move as the mug rotates toward a warm kitchen window" --provider gemini=veo-3.1-fast-generate-preview --mode extend --input-video output/mug-video-base/generated-video.mp4 --output-dir output/mug-video-extend
bun autoshow video "make the lighting moonlit blue while keeping the mug motion intact" --provider grok=grok-imagine-video --mode edit --input-video output/mug-video-base/generated-video.mp4 --output-dir output/mug-video-edit

# video generation
bun autoshow video "a cinematic mountain sunrise" --provider gemini=veo-3.1-lite-generate-preview

# video generation with fal.ai
bun autoshow video "a cinematic mountain sunrise with synchronized ambience" --provider fal=minimax/h3 --duration 5 --resolution 2k

# video generation with multiple providers
bun autoshow video "a timelapse storm over downtown chicago" --provider gemini=veo-3.1-lite-generate-preview --provider grok=grok-imagine-video --provider ltx=ltx-2-3-fast --provider lumalabs=ray-3.2
bun autoshow video "a timelapse storm over downtown chicago" --provider gemini=veo-3.1-lite-generate-preview --provider ltx=ltx-2-3-fast

# local lyric-video render from repo audio
# bundled lyrics fixtures: input/examples/lyrics/01-example-song.mp3, input/examples/lyrics/01-cover.jpeg, and input/examples/lyrics/01-example-song.txt
bun autoshow music --audio input/examples/lyrics/01-example-song.mp3
bun autoshow music --audio input/examples/lyrics/01-example-song.mp3 --captions output/<run-dir>/01-example-song.vtt
bun autoshow music --batch input/examples/lyrics --model small

# music generation
bun autoshow music "an ambient piano instrumental" --provider minimax=music-3.0
bun autoshow music "an ambient piano instrumental with soft strings" --provider minimax=music-3.0 --instrumental
bun autoshow music "bright 90s pop rock with a huge chorus" --provider gemini=lyria-3-pro-preview

# inspect or set persistent defaults
bun autoshow config --show
bun autoshow config --llm openai=gpt-5.4-mini --stt whisper=base
bun autoshow config --llm openai=gpt-5.5 --batch-limit 20 --max-cents 50
bun autoshow config --tts elevenlabs=eleven_v3 --tts-voice hpp4J3VqNfWAUOO0d1Us
bun autoshow config --tts minimax=speech-2.8-turbo --tts-voice English_expressive_narrator
bun autoshow config --tts hume=octave-2 --tts-voice "Male English Actor"
bun autoshow config --tts cartesia=sonic-3.5-2026-05-04 --tts-voice f786b574-daa5-4673-aa0c-cbe3e8534c02
bun autoshow config --reset

# fetch curated provider documentation links
bun autoshow links --openai
bun autoshow links --better-auth
bun autoshow links --kimi
bun autoshow links stt

# fetch documentation from URLs listed in a local file
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
- Use `extract` when you only need step-2 extraction or transcription without LLM writing, to create an X Space report, or to render transcript videos from an extract run or explicit audio/transcript files.
- Use `write` for the full metadata, download, extract (STT/OCR/URL), and LLM text generation pipeline (steps 0–3), and for lyric draft generation from `./output/<name>/text`. For speech, image, video, or music generation from written outputs, invoke the follow-on `tts`, `image`, `video`, and `music` commands.
- Use standalone `tts`, `image`, `video`, and `music` commands for direct generation workflows. Standalone image generation supports `gemini`, `openai`, `grok`, `bfl`, `replicate`, `lumalabs`, and `fal`.
- Use `voice` to list provider voice catalogs or manage durable voice registrations (import, design, audition, approve, or revoke voices) separately from speech synthesis.
- Use `music --audio`, `music --captions`, or `music --batch` for local lyric-video rendering from repo audio under `input/`; hosted music generation uses a prompt or local text file plus `--provider`.
- Use `comic` for staged or complete episode-script to comic workflows: scene drafting, character sketch references, panel prompt bundles, review sketches, final panel images, grouped page images, manifest-backed dialogue/soundscape audio, and local synchronized still-panel slideshows.
- Use `resume` to backfill missing extract, write LLM, TTS, image, video, or music providers in an existing output directory, including `extract` parent batches.
- Use `config --show`, `config --reset`, or selector flags such as `--llm`, `--stt`, `--image`, and `--max-cents` to inspect or persist reusable CLI defaults.
- Use `links` to fetch the curated provider documentation registry, either all docs, a global section such as `stt`, a provider section, or URLs listed in a local `.md` / `.txt` file.

## Pricing Preflight

Most hosted or mixed-provider runtime commands support `--price` to print estimated cost and exit. The human Cost Estimate table is intentionally compact and always uses `step`, `provider`, `model`, and `cost` columns, adding `input`, `setup`, and `estimatedTime` columns only when those values are available; the `--json` dry-run result keeps the structured pricing basis fields such as token counts, page counts, character counts, and registry rates. `music --audio` and `music --batch` are local lyric-video modes, so their `--price` output reports a free estimate and the expected render files instead of a provider cost:

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider mistral=voxtral-mini-2602 --price
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider deepinfra=openai/whisper-large-v3-turbo --price
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider happyscribe=auto --price
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider deepgram=nova-3 --price
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider groq=whisper-large-v3 --price
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider grok=speech-to-text --price
bun autoshow extract input/examples/document/1-document.pdf --provider deepinfra=Qwen/Qwen3-VL-30B-A3B-Instruct --price
bun autoshow extract input/examples/document/1-document.pdf --provider kimi=kimi-k2.6 --price
bun autoshow extract https://example.com/article --all-providers --price
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm openai=gpt-5.5 --price
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm glm=glm-5.1 --price
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm kimi=kimi-k2.6 --price
bun autoshow write ./output/demo/text --price
bun autoshow tts input/examples/tts/1-tts.md --provider elevenlabs=eleven_v3 --price
bun autoshow tts input/examples/tts/1-tts.md --provider groq=canopylabs/orpheus-v1-english --price
bun autoshow tts input/examples/tts/1-tts.md --provider grok=grok-tts --price
bun autoshow tts input/examples/tts/1-tts.md --provider mistral=voxtral-mini-tts-2603 --price
bun autoshow tts input/examples/tts/1-tts.md --provider minimax=speech-2.8-turbo --price
bun autoshow tts input/examples/tts/1-tts.md --provider hume=octave-2 --price
bun autoshow tts input/examples/tts/1-tts.md --provider cartesia=sonic-3.5-2026-05-04 --price
bun autoshow tts input/examples/tts/1-tts.md --provider openai=gpt-4o-mini-tts-2025-12-15 --price
bun autoshow tts input/examples/tts/1-tts.md --provider openai=gpt-4o-mini-tts-2025-12-15 --tts-instructions "Warm documentary narration" --tts-speed 1.1 --price
bun autoshow voice list --provider cartesia --source provider-library --price
bun autoshow voice design hero --provider elevenlabs --model eleven_v3 --creation-model eleven_ttv_v3 --description "Warm guide" --preview-text "Passing passage for previewing a designed voice..." --price
bun autoshow image "a sunset" --provider openai=gpt-image-2 --size 1024x1024 --quality low --price
bun autoshow image "a sunset" --provider bfl=flux-2-klein-4b --price
bun autoshow image "a sunset" --provider lumalabs=uni-1 --aspect-ratio 16:9 --price
bun autoshow video "a sunset timelapse" --provider gemini=veo-3.1-lite-generate-preview --price
bun autoshow video "a sunset timelapse" --provider grok=grok-imagine-video --price
bun autoshow video "a sunset timelapse" --provider ltx=ltx-2-3-fast --duration 6 --resolution 1080p --price
bun autoshow video "a sunset timelapse" --provider lumalabs=ray-3.2 --duration 5 --resolution 720p --price
bun autoshow video "a sunset timelapse" --all-providers --price
bun autoshow music "an ambient piano instrumental" --provider minimax=music-3.0 --instrumental --price
bun autoshow music "an ambient piano instrumental" --provider gemini=lyria-3-pro-preview --duration 120 --price
bun autoshow comic draft-scenes input/scripts/02-script/01-co-work-smarter.md --price
bun autoshow comic reference-sketch --character peaches --price
bun autoshow comic generate-images input/scripts/02-script/01-co-work-smarter.md --target images --price
bun autoshow comic generate-images 02-01 --target images --panels 1-16 --price
bun autoshow comic generate-slideshow 02-01 --price
```

Pricing preflight uses the same model registry and pricing helpers as post-run cost accounting. Token-priced hosted OCR and write estimates use provider/model input and output rates plus command-specific input heuristics; URL article estimates use the selected backend, or every backend when route-aware `--all-providers` is set. MiniMax music estimates include the selected model's track estimate and any generated-lyrics add-on. Happy Scribe preflight is side-effect free and uses the published AI rate; Supadata STT estimates use the Basic/Pro auto-recharge credit reference rate, with plan-pricing variance possible.
