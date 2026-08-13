# extract STT

Media inputs are downloaded and transcribed with local or hosted speech-to-text engines.

## Outline

- [STT Setup](#stt-setup)
- [STT Environment](#stt-environment)
- [Shared STT Options](#shared-stt-options)
- [Transcript Videos](#transcript-videos)
- [URL/streaming/source-URL STT](#urlstreamingsource-url-stt)
  - [Happy Scribe](#happy-scribe)
  - [Supadata](#supadata)
  - [ScrapeCreators](#scrapecreators)
  - [Gladia](#gladia)
- [Non-diarized STT](#non-diarized-stt)
  - [Whisper.cpp](#whispercpp)
  - [Whisperfile](#whisperfile)
  - [Groq](#groq)
  - [DeepInfra](#deepinfra)
  - [Together](#together)
  - [Gemini STT](#gemini-stt)
  - [Mistral](#mistral)
- [Diarized STT](#diarized-stt)
  - [Reverb](#reverb)
  - [Grok STT](#grok-stt)
  - [Deepgram](#deepgram)
  - [Soniox](#soniox)
  - [Speechmatics](#speechmatics)
  - [Rev](#rev)
  - [AssemblyAI](#assemblyai)
- [STT Pricing And Manifests](#stt-pricing-and-manifests)
- [STT Notes](#stt-notes)

See the [`extract` overview](./01-extract.md) for input routing across STT, OCR, article HTML, and X/Twitter inputs.

If no engine flag is provided, `extract` defaults to local Whisper.cpp with the `tiny` model for media inputs. `--provider` selectors accept an omitted model value and then resolve to the cheapest or default supported model. Model-selecting selectors are repeatable, including repeated selectors from the same provider.

The standalone `extract` command uses route-aware `--provider provider[=model]` selectors. The `write` and `config` commands use the step selector `--stt provider[=model]`; `resume` uses target-aware `--provider provider[=model]`.

## STT Setup

```bash
# full setup
bun autoshow setup

# build whisper.cpp binary only
bun autoshow setup --step whisper-binary

# download the default whisper model only
bun autoshow setup --step whisper-model

# download large-v3-turbo plus Reverb assets
bun autoshow setup --step transcription

# install the Reverb environment and models
bun autoshow setup --step reverb
```

Whisperfile needs no setup step. The first `--provider whisperfile=<model>` run downloads the matching prebuilt `whisper-<model>.llamafile` from `huggingface.co/Mozilla/whisperfile` into `runtime/bin/whisperfile/` and reuses it afterward. To pre-download it instead, run `bun autoshow setup --step whisperfile` (default `tiny`) or `bun autoshow setup --models whisperfile:<model>` for a specific model.

## STT Environment

| Provider | Required env |
|----------|--------------|
| Groq | `GROQ_API_KEY` |
| Grok STT | `XAI_API_KEY` |
| DeepInfra | `DEEPINFRA_API_KEY` |
| Together | `TOGETHER_API_KEY` |
| Happy Scribe | `HAPPYSCRIBE_API_KEY` |
| Supadata | `SUPADATA_API_KEY` |
| ScrapeCreators | `SCRAPECREATORS_API_KEY` |
| Deepgram | `DEEPGRAM_API_KEY` |
| Soniox | `SONIOX_API_KEY` |
| Speechmatics | `SPEECHMATICS_API_KEY` |
| Rev | `REVAI_ACCESS_TOKEN` |
| Gemini STT | `GEMINI_API_KEY` |
| Mistral | `MISTRAL_API_KEY` |
| AssemblyAI | `ASSEMBLYAI_API_KEY` |
| Gladia | `GLADIA_API_KEY` |

## Shared STT Options

| Flag | Description |
|------|-------------|
| `--all-providers` | Enable every broadly applicable hosted STT provider/model for the input source; Supadata is included for supported public URLs, and ScrapeCreators is included for YouTube URLs |
| `--all-local` | Enable every local STT engine for this route |
| `--youtube-captions` | Prefer English YouTube captions before STT when available; falls back to the selected STT provider path |
| `--speaker-count <n>` | Diarization speaker-count hint for supported services |
| `--split` | Split audio into 30-minute segments before transcription |
| `--batch-limit <n>` | Limit batch size |
| `--batch-all` | Process all batch items |
| `--batch-order <newest\|oldest>` | Choose batch ordering |
| `--batch-concurrency <n>` | Process batch items concurrently |
| `--provider-concurrency <n>` | Max cloud providers running in parallel for one item |
| `--local-concurrency <n>` | Max local providers running in parallel for one item |
| `--stt-segment-concurrency <n>` | Max split segments in flight per provider |
| `--stt-preflight-concurrency <n>` | Max duration probes running in parallel during preflight |
| `--price` | Show the aggregated estimate and exit |

```bash
# Prefer YouTube captions, then fall back to STT
bun autoshow extract https://www.youtube.com/watch?v=MORMZXEaONk --youtube-captions --provider deepgram=nova-3

# Split a long file before transcription
bun autoshow extract https://ajc.pics/autoshow/examples/2-video.mp4 --provider whisper=large-v3-turbo --split

# Process a whole YouTube channel batch with caption-first routing
bun autoshow extract https://www.youtube.com/@channelname --youtube-captions --batch-all
```

## Transcript Videos

`extract --transcript-video` renders a local MP4 from existing STT artifacts without calling an STT provider. AutoShow reads the `manifest.json` in a media extract output directory, infers the audio file, and renders the raw `result.json` payload or completed provider payload. Multi-provider runs with more than one result require `--transcript-result`.

To produce a diarized STT run with speaker labels (using Soniox or another provider from [Diarized STT](#diarized-stt)):

```bash
bun autoshow extract input/examples/audio/1-audio.mp3 --provider soniox --output-dir output/transcript-demo
```

This writes `1-audio.mp3`, `transcription.txt`, and raw domain `result.json` into `output/transcript-demo`.

```bash
# render from that completed media extract directory
bun autoshow extract output/transcript-demo --transcript-video --output-dir output/transcript-demo-video

# render from explicit files without an extract run directory
bun autoshow extract --transcript-video --audio input/examples/audio/1-audio.mp3 --transcript-result output/transcript-demo/result.json

# render from the timestamped text transcript format
bun autoshow extract --transcript-video --audio input/examples/audio/1-audio.mp3 --transcript-text output/transcript-demo/transcription.txt
```

A multi-provider run writes results per provider under `providers/<service>-<model>/` without a root `result.json`. Pass `--transcript-result` explicitly to select a provider result. `--provider soniox` resolves to `stt-async-v5`.

```bash
# one hosted diarized provider and one local provider over the same example file
bun autoshow extract input/examples/audio/1-audio.mp3 --provider soniox --provider whisper=tiny --output-dir output/transcript-demo-multi

# choose the diarized provider result from that multi-provider run
bun autoshow extract output/transcript-demo-multi --transcript-video --transcript-result output/transcript-demo-multi/providers/soniox-stt-async-v5/result.json
```

Without `--output-dir`, each command creates a timestamped directory (`output/<timestamp>_<label>`). The output contains `<label>.mp4`, `<label>.vtt`, `<label>.srt`, and `manifest.json`. Cues use native per-word timings when available, falling back to segment timestamps or `[HH:MM:SS.mmm] [speaker] text` lines. The renderer uses a fixed 1920x1080 ffmpeg pipeline, with `--font` and `--keep-tmp` available.

## URL/streaming/source-URL STT

### Happy Scribe

| Option | Value |
|--------|-------|
| Selector | `--provider happyscribe[=<model>]` |
| Models | `auto` |
| Organization | `--stt-happyscribe-organization-id <id>` |
| Language | Fixed to `en-US` |
| Diarization | Enabled by default; `--speaker-count` is ignored |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider happyscribe=auto
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider happyscribe --stt-happyscribe-organization-id org_123
```

Organization resolution order: CLI `--stt-happyscribe-organization-id`, config default, then auto-select if the API key accesses exactly one organization.

### Supadata

| Option | Value |
|--------|-------|
| Selector | `--provider supadata=auto` |
| Language | `--stt-supadata-lang <code>` when a native transcript is available |
| Required env | `SUPADATA_API_KEY` |
| Input support | Public YouTube, TikTok, Instagram, X/Twitter, Facebook, or direct media/file URLs |

```bash
bun autoshow extract https://www.youtube.com/watch?v=MORMZXEaONk --provider supadata=auto --stt-supadata-lang en
bun autoshow extract https://www.tiktok.com/@example/video/1234567890 --provider supadata=auto
bun autoshow extract https://example.com/audio/interview.mp3 --provider supadata=auto --price
```

Supadata requires a public source URL. It tries provider-native transcripts first (`auto` mode) and generates a transcript when needed. Direct media/file URLs are treated as generated transcripts.

### ScrapeCreators

| Option | Value |
|--------|-------|
| Selector | `--provider scrapecreators=youtube-transcript` |
| Language | `--stt-scrapecreators-lang <code>`, default `en` |
| Required env | `SCRAPECREATORS_API_KEY` |
| Input support | Public `youtube.com` and `youtu.be` URLs only |

```bash
bun autoshow extract "https://www.youtube.com/watch?v=MORMZXEaONk" --provider scrapecreators=youtube-transcript
bun autoshow extract https://youtu.be/dQw4w9WgXcQ --provider scrapecreators=youtube-transcript --stt-scrapecreators-lang es
```

ScrapeCreators retrieves YouTube transcripts via `GET /v1/youtube/video/transcript` and normalizes them into `transcription.txt` and structured STT artifacts.

### Gladia

| Option | Value |
|--------|-------|
| Selector | `--provider gladia[=<model>]` |
| Models | `solaria-1`, `solaria-3` |
| Diarization | Supports exact `--speaker-count` hints |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider gladia=solaria-3
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider gladia --speaker-count 2
```

Bare `--provider gladia` selects `solaria-1`. `--all-providers` includes both active Solaria models.

## Non-diarized STT

### Whisper.cpp

| Option | Value |
|--------|-------|
| Selector | default, or `--provider whisper[=<model>]` |
| Models | `tiny`, `base`, `small`, `medium`, `large-v3-turbo` |
| Runtime | Local `whisper.cpp` |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider whisper=large-v3-turbo
```

### Whisperfile

| Option | Value |
|--------|-------|
| Selector | `--provider whisperfile=<model>` |
| Models | `tiny`, `tiny.en`, `small`, `small.en`, `medium`, `medium.en`, `large-v2`, `large-v3` |
| Runtime | Local prebuilt `whisper-<model>.llamafile` (Mozilla whisperfile); free, no API key |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider whisperfile=tiny
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider whisperfile=large-v3
```

Whisperfile runs prebuilt APE binaries from HuggingFace with embedded GGML weights. Output carries native word timing. Included by `--all-local`. Requires an explicit model selector (`--provider whisperfile=<model>` or `--stt whisperfile=<model>`).

### Groq

| Option | Value |
|--------|-------|
| Selector | `--provider groq[=<model>]` |
| Models | `whisper-large-v3-turbo`, `whisper-large-v3` |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider groq
```

### DeepInfra

| Option | Value |
|--------|-------|
| Selector | `--provider deepinfra[=<model>]` |
| Models | `openai/whisper-large-v3-turbo`, `openai/whisper-large-v3` |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider deepinfra
```

### Together

| Option | Value |
|--------|-------|
| Selector | `--provider together[=<model>]` |
| Models | `openai/whisper-large-v3`, `nvidia/parakeet-tdt-0.6b-v3` |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider together
```

Both models use Together's batch endpoint at `$0.0015`/min. Bare `--provider together` defaults to `parakeet-tdt-0.6b-v3`.

### Gemini STT

| Option | Value |
|--------|-------|
| Selector | `--provider gemini[=<model>]` |
| Models | `gemini-3.6-flash` |
| Behavior | Prompted JSON transcription via Gemini multimodal input |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider gemini
```

### Mistral

| Option | Value |
|--------|-------|
| Selector | `--provider mistral[=<model>]` |
| Models | `voxtral-mini-2602` |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider mistral
```

Mistral STT (Voxtral Mini Transcribe 2) supports up to 500 MB and ~3 hours of audio per request. Requests are serialized across batch items and segments.

## Diarized STT

### Reverb

| Option | Value |
|--------|-------|
| Selector | `--provider reverb` |
| Style | `--stt-reverb-verbatimicity <0-1>` |
| Runtime | Local diarized transcription |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider reverb --stt-reverb-verbatimicity 0.5
```

### Grok STT

| Option | Value |
|--------|-------|
| Selector | `--provider grok[=<model>]` |
| Models | `speech-to-text` |
| Behavior | REST STT with formatted output, word timestamps, and diarization enabled |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider grok=speech-to-text
```

### Deepgram

| Option | Value |
|--------|-------|
| Selector | `--provider deepgram[=<model>]` |
| Models | `nova-3` |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider deepgram=nova-3
```

### Soniox

| Option | Value |
|--------|-------|
| Selector | `--provider soniox[=<model>]` |
| Models | `stt-async-v5` |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider soniox
```

### Speechmatics

| Option | Value |
|--------|-------|
| Selector | `--provider speechmatics[=<model>]` |
| Models | `enhanced`, `melia-1` |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider speechmatics=enhanced
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider speechmatics=melia-1
```

Bare `--provider speechmatics` selects `melia-1` (multilingual). `enhanced` uses single-language detection for maximum per-language accuracy.

### Rev

| Option | Value |
|--------|-------|
| Selector | `--provider rev[=<model>]` |
| Models | `machine`, `low_cost` |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider rev=low_cost
```

### AssemblyAI

| Option | Value |
|--------|-------|
| Selector | `--provider assemblyai[=<model>]` |
| Models | `universal-3-5-pro`, `universal-2` |
| Diarization | Supports `--speaker-count` |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider assemblyai
```

Bare `--provider assemblyai` defaults to `universal-2`. Select `universal-3-5-pro` explicitly for the flagship model.

## STT Pricing And Manifests

Happy Scribe:
- `--price` uses the published rate of `$0.01/min` and local timing without remote uploads or order creation.
- Execution records Happy Scribe billing in `step2.billing` using `totalCost`, `creditsUsed`, `creditRateCents`, `source: "provider_quote"`, and `mode: "order"` (or `mode: "segment_sum"` for split runs).

Supadata:
- `--price` uses the reference rate of `$10 / 1,000 credits` (`1.00 cent/credit`).
- Native estimates 1 credit per request; generated transcripts estimate from duration (~2 credits/min). `auto` estimates as the higher of native vs generated.
- Execution records credit counts from response headers when available.

ScrapeCreators:
- `--price` uses the Freelance reference rate of `$47 / 25,000 credits` (`0.188 cents/request`).
- Estimates and actual billing ignore media duration because ScrapeCreators charges per retrieval request.

## STT Notes

- Before hosted provider upload, AutoShow stages a shared mono AAC-LC `.m4a` audio artifact (96 kbps, original sample rate, metadata stripped). Low-bitrate mono inputs stay on a stream-copy path. Supadata and ScrapeCreators use public source URLs directly.
- Single-provider runs write root `transcription.txt` and `result.json`. Hosted multi-provider runs write outputs per provider under `providers/<service>-<model>/`.
- `--youtube-captions` is English-only and applies to YouTube inputs. If captions are found, STT providers are skipped and recorded as service `youtube-captions` with model `subtitle-track`.
- STT batch roots include `manifest.json` recording item status and routing.
- Backfill existing STT outputs with top-level [`resume`](../../setup-and-utilities/resume/resume.md).
