# benchmark

Benchmark STT transcription quality across audio compression levels and playback speeds, score metadata for an existing text/write run, score voice quality for an existing TTS run, or judge image/video quality for an existing generation run.

## Outline

- [Usage](#usage)
- [Modes](#modes)
- [Flags](#flags)
- [Examples](#examples)
- [TTS Voice-Quality Mode](#tts-voice-quality-mode)
- [Text Write Benchmark Mode](#text-write-benchmark-mode)
- [Image Quality Mode](#image-quality-mode)
- [Video Quality Mode](#video-quality-mode)
- [How It Works](#how-it-works)
  - [Phase 1: Prepare Source Audio](#phase-1-prepare-source-audio)
  - [Phase 2: Generate Audio Variants](#phase-2-generate-audio-variants)
  - [Phase 3: Reference Transcription](#phase-3-reference-transcription)
  - [Phase 4: Transcribe Variants](#phase-4-transcribe-variants)
  - [Phase 5: Compute Quality Scores](#phase-5-compute-quality-scores)
  - [Phase 6: Generate Report](#phase-6-generate-report)
- [Compression Spectrum](#compression-spectrum)
- [Speed Spectrum](#speed-spectrum)
- [Word Error Rate (WER)](#word-error-rate-wer)
- [Output Structure](#output-structure)
- [Report Format](#report-format)
- [Service Availability](#service-availability)
- [Notes](#notes)

## Usage

```bash
bun autoshow benchmark <audio-file> [flags]
bun autoshow benchmark <tts-run-dir> --tts [flags]
bun autoshow benchmark <write-run-dir> --text [flags]
bun autoshow benchmark <image-run-dir> --image [flags]
bun autoshow benchmark <video-run-dir> --video [flags]
```

## Modes

- **Default (STT)**: Takes an audio file, generates degraded bitrate and speed variants, transcribes each through selected STT services, and computes Word Error Rate (WER) against a reference transcription.
- **TTS (`--tts`)**: Scores voice quality of audio outputs in an existing TTS run directory against source text using signal/prosody heuristics and optional judge metrics. Analysis-only.
- **Text (`--text`)**: Scores provider price and speed from item metadata in an existing single-item write run. Analysis-only; does not invoke LLMs.
- **Image (`--image`)**: Scores generated images in an existing image run directory using OpenAI vision rubric judging. Analysis-only.
- **Video (`--video`)**: Extracts 10 ordered frames per generated video in an existing video run directory and scores them using OpenAI vision rubric judging. Analysis-only.
- **Document OCR**: OCR benchmarks run separately via normal extraction (`bun autoshow extract`) and build combined reports under `docs/benchmarks/ocr/`.

## Flags

### STT flags

| Flag | Default | Description |
|------|---------|-------------|
| `--bitrates` | `128,96,64,48,32,24,16,8` | Comma-separated bitrate list in kbps |
| `--speeds` | `1.25,1.5,2.0,2.5,3.0` | Comma-separated speed multipliers |
| `--stt-services` | all available | Comma-separated STT services to test, each optionally pinned as `service:model` |
| `--reference-stt` | `deepgram:nova-3` | Service:model pair for reference transcription |
| `--skip-compression` | `false` | Skip compression spectrum tests |
| `--skip-speed` | `false` | Skip speed spectrum tests |
| `--output-dir` | `output/benchmark/<timestamp>` | Pin exact output directory for benchmark files |

### TTS flags

| Flag | Default | Description |
|------|---------|-------------|
| `--tts` | `false` | Score an existing TTS run instead of running STT benchmark |
| `--tts-input-text` | `items[0].input` | Override original source text with literal text or file path |
| `--tts-mode` | `full` | `full` may call paid STT/audio judge APIs when credentials exist; `local` never does |
| `--tts-roundtrip-dir` | none | Directory of existing roundtrip transcripts |
| `--tts-metric-fixtures` | none | JSON fixtures with precomputed model metrics and transcripts |
| `--tts-audio-judge-model` | `gpt-audio` | OpenAI audio-capable chat model for paid rubric judging |
| `--tts-keep-temp` | `false` | Keep temporary normalized audio files |

### Text flags

| Flag | Default | Description |
|------|---------|-------------|
| `--text` | `false` | Score an existing write run from metadata without calling providers |

### Image flags

| Flag | Default | Description |
|------|---------|-------------|
| `--image` | `false` | Score an existing image run instead of running STT benchmark |
| `--image-judge-model` | `gpt-5.5` | OpenAI vision model for paid image rubric judging |

### Video flags

| Flag | Default | Description |
|------|---------|-------------|
| `--video` | `false` | Score an existing video run instead of running STT benchmark |
| `--video-judge-model` | `gpt-5.5` | OpenAI vision model for paid video rubric judging |

## Examples

```bash
# Full benchmark with all available STT services
bun autoshow benchmark input/examples/audio/1-audio.mp3

# Benchmark with local Whisper only (free, no API keys needed; requires `bun autoshow setup --step whisper-binary`)
bun autoshow benchmark input/examples/audio/1-audio.mp3 --stt-services whisper --reference-stt whisper:base

# Opt in to extra local Whisper model sizes
bun autoshow benchmark audio.mp3 --stt-services whisper:base,whisper:large-v3-turbo

# Compression-only benchmark with select cloud services
bun autoshow benchmark audio.mp3 --stt-services deepgram,groq --skip-speed

# Speed-only benchmark
bun autoshow benchmark audio.mp3 --stt-services whisper,deepgram --skip-compression

# Custom bitrate and speed ranges
bun autoshow benchmark audio.mp3 --bitrates 96,64,32,16 --speeds 1.5,2.0,3.0

# Use a specific reference service
bun autoshow benchmark audio.mp3 --reference-stt deepgram:nova-3

# Custom output location
bun autoshow benchmark audio.mp3 --output-dir output/my-benchmark

# Score an existing TTS run with full scoring
bun autoshow benchmark docs/benchmarks/tts/<run> --tts

# Score an existing TTS run without paid calls
bun autoshow benchmark docs/benchmarks/tts/<run> --tts --tts-mode local

# Score a TTS run with existing roundtrip transcripts
bun autoshow benchmark docs/benchmarks/tts/<run> --tts --tts-roundtrip-dir <dir>

# Score an existing write run without paid calls
bun autoshow benchmark docs/benchmarks/write/<run> --text

# Score an existing image run
bun autoshow benchmark docs/benchmarks/image/<run> --image

# Score an image run with a specific OpenAI judge model
bun autoshow benchmark docs/benchmarks/image/<run> --image --image-judge-model gpt-5.5

# Score an existing video run
bun autoshow benchmark docs/benchmarks/video/<run> --video

# Score a video run with a specific OpenAI judge model
bun autoshow benchmark docs/benchmarks/video/<run> --video --video-judge-model gpt-5.5
```

## TTS Voice-Quality Mode

`bun autoshow benchmark <tts-run-dir> --tts` is analysis-only. It reads an existing single-run manifest (`command: "tts"`) and scores audio files listed in `items[0].metadata.tts[]` against source text (`items[0].input`).

- `--tts-mode full` (default): Computes local signal/prosody heuristics and invokes paid audio judging (OpenAI) plus roundtrip STT (AssemblyAI/OpenAI) when credentials exist.
- `--tts-mode local`: Performs a warning-tolerant pass using local heuristics only, without paid calls.
- External MOS/DNS metric coverage can be injected via `--tts-metric-fixtures`.

Outputs written beside the run directory:

```
<tts-run-dir>/
  voice-quality-report.json
  voice-quality-report.md
  voice-quality-roundtrip/        # Created when full mode runs paid STT
```

When `voice-quality-report.json` exists in the run directory, `provider-comparison-report.json` automatically incorporates `humanSpeechScore` as `qualityScore`.

## Text Write Benchmark Mode

`bun autoshow benchmark <write-run-dir> --text` is no-cost and analysis-only. It reads an existing single-item `write` run manifest and scores provider price and speed from `metadata.step3`, `metadata.cost`, and `metadata.timing` evidence without calling LLM providers.

Outputs written beside the run directory:

```
<write-run-dir>/
  provider-comparison-report.json
  provider-comparison-report.md
```

Text reports separate `llama.cpp` into the local group and hosted LLM providers into the service group. Speed rankings prefer normalized `msPerUnit` timing (per 1K tokens). Automated text quality rankings remain unavailable without explicit benchmark ground-truth fields.

## Image Quality Mode

`bun autoshow benchmark <image-run-dir> --image` is analysis-only. It reads an existing image run manifest (`command: "image"`), sends generated images to OpenAI vision judging (`gpt-5.5` by default) via the Responses API, and scores five criteria on a 1-10 scale (prompt adherence, visual quality, artifact control, composition, detail/text handling).

Outputs written beside the run directory:

```
<image-run-dir>/
  image-quality-report.json
  image-quality-report.md
  provider-comparison-report.json
  provider-comparison-report.md
```

Criterion scores are averaged and multiplied by 10 to produce a 0-100 `qualityScore` for provider comparison ranking.

## Video Quality Mode

`bun autoshow benchmark <video-run-dir> --video` is analysis-only. It reads an existing video run manifest (`command: "video"`), extracts 10 ordered PNG frames per generated video using local `ffmpeg`/`ffprobe`, and sends the frames to OpenAI vision judging (`gpt-5.5` by default) across five criteria (prompt adherence, visual quality, artifact control, temporal consistency, composition/camera).

Outputs written beside the run directory:

```
<video-run-dir>/
  video-quality-frames/
  video-quality-report.json
  video-quality-report.md
  provider-comparison-report.json
  provider-comparison-report.md
```

Criterion scores are averaged and multiplied by 10 to produce a 0-100 `qualityScore` for provider comparison ranking.

## How It Works

1. **Prepare source audio**: Probes input audio with `ffprobe` and normalizes to a baseline mono AAC-LC `.m4a` file (128 kbps).
2. **Generate audio variants**: Creates degraded audio variants via `ffmpeg`:
   - Bitrate compression spectrum (128k down to 8k).
   - Playback speed spectrum (1.25x up to 3.0x using chained `atempo` filters).
3. **Reference transcription**: Transcribes baseline audio using reference STT (default: `deepgram:nova-3`).
4. **Transcribe variants**: Transcribes all variants sequentially through each target service/model.
5. **Compute quality scores**: Computes Word Error Rate (WER) per variant against the reference text.
6. **Generate report**: Writes structured JSON and summary reports identifying compression/speed degradation thresholds and service rankings.

## Compression Spectrum

Default bitrates (kbps): `128, 96, 64, 48, 32, 24, 16, 8`

Variants are encoded as mono AAC-LC in `.m4a` format matching the STT pipeline:

```bash
ffmpeg -i source.m4a -c:a aac -profile:a aac_low -b:a <bitrate> -ac 1 -f ipod <output>.m4a
```

## Speed Spectrum

Default speed multipliers: `1.25, 1.5, 2.0, 2.5, 3.0`

Speeds above 2.0x chain multiple `atempo` filters (e.g. `atempo=2.0,atempo=1.5` for 3.0x). Speed variants are fixed at 96 kbps to isolate speed effects from compression.

## Word Error Rate (WER)

```
WER = (Substitutions + Deletions + Insertions) / Reference Word Count
```

Texts are normalized (lowercased, punctuation stripped, whitespace collapsed) before word-level Levenshtein comparison. A WER of 0.10 (10%) serves as the standard quality degradation threshold.

## Output Structure

```
output/benchmark/<timestamp>/
  source.m4a                              # Normalized source audio
  variants/
    compression/
      128k.m4a ... 8k.m4a                 # Bitrate variants
    speed/
      1.25x.m4a ... 3.0x.m4a              # Speed variants
  transcriptions/
    <variant-label>/
      <service>-<model>/
        benchmark-attempt.json            # Attempt status (started/success/error)
        transcription.txt                 # Variant transcription
        result.json                       # Raw provider payload
  report.json                             # Final benchmark report
```

## Report Format

`report.json` records execution metadata, service attempts, variant WER metrics, and summary thresholds:

- `timestamp`, `sourceAudio`, `referenceService`, `referenceModel`, `referenceWordCount`
- `attempts`: `{ total, succeeded, failed }`
- `compressionResults` & `speedResults`: Array of variant records with `wer`, `substitutions`, `deletions`, `insertions`, and `processingTimeMs`
- `summary`: `bestCompressionThreshold`, `bestSpeedThreshold`, and `serviceRankings` by average WER

Each variant attempt writes `benchmark-attempt.json` before execution starts and updates it upon completion or failure.

## Service Availability

STT service availability is detected automatically from environment variables and local binaries:

| Service | Requirement |
|---------|-------------|
| `whisper` | `runtime/bin/whisper-cli` |
| `deepgram` | `DEEPGRAM_API_KEY` |
| `groq` | `GROQ_API_KEY` |
| `grok` | `XAI_API_KEY` |
| `deepinfra` | `DEEPINFRA_API_KEY` |
| `gemini-stt` | `GEMINI_API_KEY` |
| `together` | `TOGETHER_API_KEY` |
| `mistral` | `MISTRAL_API_KEY` |
| `assemblyai` | `ASSEMBLYAI_API_KEY` |
| `soniox` | `SONIOX_API_KEY` |
| `speechmatics` | `SPEECHMATICS_API_KEY` |
| `rev` | `REVAI_ACCESS_TOKEN` |
| `gladia` | `GLADIA_API_KEY` |
| `happyscribe` | `HAPPYSCRIBE_API_KEY` |

Services requiring remote media URLs (`youtube-captions`, `supadata`, `scrapecreators`) are excluded from local file benchmarks. Managed whisper binaries can be provisioned via `bun autoshow setup --step whisper-binary`.

### Pinning models

Entries in `--stt-services` can be bare service names or explicit `service:model` pairs:

```bash
# Benchmark whisper default model (base)
bun autoshow benchmark audio.mp3 --stt-services whisper

# Pin multiple whisper model sizes
bun autoshow benchmark audio.mp3 --stt-services whisper:base,whisper:large-v3-turbo

# Mix local model pin with hosted service defaults
bun autoshow benchmark audio.mp3 --stt-services whisper:tiny,deepgram
```

Whisper model sizes include `tiny`, `base` (default, ~150 MB), `small`, `medium`, and `large-v3-turbo`. Missing local models are downloaded on first use into `runtime/models/whisper/`.

## Notes

- Use `--stt-services` to target specific providers and manage API costs.
- Benchmarks use the central `sttTarget()` dispatch infrastructure, sharing retry logic, auto-splitting, and model provisioning.
- Run `whisper` locally for zero-cost offline testing: `--stt-services whisper --reference-stt whisper:base`.
- Reference transcription quality directly impacts WER accuracy; select a high-accuracy reference service.
- Speed variants evaluate transcription tolerance for accelerated speech using identical source text.
