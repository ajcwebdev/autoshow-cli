# extract STT

Media inputs are downloaded and transcribed with local or hosted speech-to-text engines.

## Outline

- [STT Setup](#stt-setup)
- [STT Environment](#stt-environment)
- [Shared STT Options](#shared-stt-options)
- [Transcript Videos](#transcript-videos)
- [STT Services](#stt-services)
  - [Whisper.cpp](#whispercpp)
  - [Whisperfile](#whisperfile)
  - [Reverb](#reverb)
  - [AssemblyAI](#assemblyai)
  - [Deepgram](#deepgram)
  - [DeepInfra](#deepinfra)
  - [Gemini STT](#gemini-stt)
  - [Gladia](#gladia)
  - [Grok STT](#grok-stt)
  - [Groq](#groq)
  - [Happy Scribe](#happy-scribe)
  - [Mistral](#mistral)
  - [Rev](#rev)
  - [ScrapeCreators](#scrapecreators)
  - [Soniox](#soniox)
  - [Speechmatics](#speechmatics)
  - [Supadata](#supadata)
  - [Together](#together)
- [STT Pricing](#stt-pricing)
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
| AssemblyAI | `ASSEMBLYAI_API_KEY` |
| Deepgram | `DEEPGRAM_API_KEY` |
| DeepInfra | `DEEPINFRA_API_KEY` |
| Gemini STT | `GEMINI_API_KEY` |
| Gladia | `GLADIA_API_KEY` |
| Grok STT | `XAI_API_KEY` |
| Groq | `GROQ_API_KEY` |
| Happy Scribe | `HAPPYSCRIBE_API_KEY` |
| Mistral | `MISTRAL_API_KEY` |
| Rev | `REVAI_ACCESS_TOKEN` |
| ScrapeCreators | `SCRAPECREATORS_API_KEY` |
| Soniox | `SONIOX_API_KEY` |
| Speechmatics | `SPEECHMATICS_API_KEY` |
| Supadata | `SUPADATA_API_KEY` |
| Together | `TOGETHER_API_KEY` |

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
| `--batch-order <newest|oldest>` | Choose batch ordering |
| `--batch-concurrency <n>` | Process batch items concurrently; default `7` |
| `--provider-concurrency <n>` | Max cloud providers running in parallel for one item; default `7` |
| `--local-concurrency <n>` | Max local providers running in parallel for one item; default `7` |
| `--stt-segment-concurrency <n>` | Max split segments in flight per provider; default `7` |
| `--stt-preflight-concurrency <n>` | Max duration probes running in parallel during preflight; default `7` |
| `--concurrency-mode <ramp|immediate>` | Start each hosted provider/account lane at one request and add one slot every five seconds while demand is queued (`ramp`, default), or start at its configured cap (`immediate`) |
| `--price` | Show the aggregated estimate and exit |

The hosted ramp applies to provider requests and split STT segments. Local engines, audio splitting, duration probes, and other preflight work remain immediate.

```bash
# Prefer YouTube captions, then fall back to STT
bun autoshow extract https://www.youtube.com/watch?v=MORMZXEaONk --youtube-captions --provider deepgram=nova-3

# Split a long file before transcription
bun autoshow extract https://ajc.pics/autoshow/examples/2-video.mp4 --provider whisper=large-v3-turbo --split

# Process a whole YouTube channel batch with caption-first routing
bun autoshow extract https://www.youtube.com/@channelname --youtube-captions --batch-all
```

## Transcript Videos

`extract --transcript-video` renders a 1920x1080 MP4 from existing STT artifacts without calling an STT provider. AutoShow reads the `manifest.json` in a media extract output directory, infers the audio file, and renders the transcript cues (per-word timings when available, falling back to segment timestamps or speaker lines).

```bash
# Render from a completed media extract directory
bun autoshow extract output/transcript-demo --transcript-video --output-dir output/transcript-demo-video

# Render from explicit audio and result files
bun autoshow extract --transcript-video --audio input/examples/audio/1-audio.mp3 --transcript-result output/transcript-demo/result.json

# Render from timestamped text transcript
bun autoshow extract --transcript-video --audio input/examples/audio/1-audio.mp3 --transcript-text output/transcript-demo/transcription.txt

# Render a specific provider result from a multi-provider run
bun autoshow extract output/transcript-multi --transcript-video --transcript-result output/transcript-multi/providers/soniox-stt-async-v5/result.json
```

The output contains `<label>.mp4`, `<label>.vtt`, `<label>.srt`, and `manifest.json`. Optional rendering controls include `--font <family>` (default `DejaVu Sans`) and `--keep-tmp`.

## STT Services

### Whisper.cpp

| Option | Value |
|--------|-------|
| Selector | default, or `--provider whisper[=<model>]` |
| Models | `tiny`, `base`, `small`, `medium`, `large-v3-turbo` |
| Runtime | Local `whisper.cpp` (free) |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider whisper=large-v3-turbo
```

### Whisperfile

| Option | Value |
|--------|-------|
| Selector | `--provider whisperfile=<model>` |
| Models | `tiny`, `tiny.en`, `small`, `small.en`, `medium`, `medium.en`, `large-v2`, `large-v3` |
| Runtime | Local prebuilt `whisper-<model>.llamafile` (free) |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider whisperfile=tiny
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider whisperfile=large-v3
```

Prebuilt binaries with embedded weights and native word timings. Downloads automatically to `runtime/bin/whisperfile/` on first use. Requires an explicit model selector. Included by `--all-local`.

### Reverb

| Option | Value |
|--------|-------|
| Selector | `--provider reverb` |
| Style | `--stt-reverb-verbatimicity <0-1>`, default `0.5` |
| Diarization | Enabled by default |
| Runtime | Local diarized transcription (free) |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider reverb --stt-reverb-verbatimicity 0.5
```

### AssemblyAI

| Option | Value |
|--------|-------|
| Selector | `--provider assemblyai[=<model>]` |
| Models | `universal-3-5-pro`, `universal-2` |
| Diarization | Supported; accepts `--speaker-count <n>` |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider assemblyai
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider assemblyai=universal-3-5-pro --speaker-count 2
```

Bare `--provider assemblyai` defaults to `universal-2`. Select `universal-3-5-pro` explicitly for the flagship model.

### Deepgram

| Option | Value |
|--------|-------|
| Selector | `--provider deepgram[=<model>]` |
| Models | `nova-3` |
| Diarization | Enabled by default |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider deepgram=nova-3
```

### DeepInfra

| Option | Value |
|--------|-------|
| Selector | `--provider deepinfra[=<model>]` |
| Models | `openai/whisper-large-v3-turbo`, `openai/whisper-large-v3` |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider deepinfra
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider deepinfra=openai/whisper-large-v3
```

### Gemini STT

| Option | Value |
|--------|-------|
| Selector | `--provider gemini[=<model>]` |
| Models | `gemini-3.6-flash` |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider gemini
```

Multimodal audio transcription via Gemini JSON prompt output.

### Gladia

| Option | Value |
|--------|-------|
| Selector | `--provider gladia[=<model>]` |
| Models | `solaria-1`, `solaria-3` |
| Diarization | Supported; accepts `--speaker-count <n>` |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider gladia=solaria-3
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider gladia --speaker-count 2
```

Bare `--provider gladia` selects `solaria-1`. `--all-providers` includes both active Solaria models.

### Grok STT

| Option | Value |
|--------|-------|
| Selector | `--provider grok[=<model>]` |
| Models | `speech-to-text` |
| Diarization | Enabled by default |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider grok=speech-to-text
```

### Groq

| Option | Value |
|--------|-------|
| Selector | `--provider groq[=<model>]` |
| Models | `whisper-large-v3-turbo`, `whisper-large-v3` |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider groq
```

### Happy Scribe

| Option | Value |
|--------|-------|
| Selector | `--provider happyscribe[=<model>]` |
| Models | `auto` |
| Organization | `--stt-happyscribe-organization-id <id>` |
| Language | Fixed to `en-US` |
| Diarization | Enabled by default |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider happyscribe=auto
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider happyscribe --stt-happyscribe-organization-id org_123
```

Organization resolution order: CLI `--stt-happyscribe-organization-id`, config default, then auto-select if the API key accesses exactly one organization.

### Mistral

| Option | Value |
|--------|-------|
| Selector | `--provider mistral[=<model>]` |
| Models | `voxtral-mini-2602` |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider mistral
```

Voxtral Mini Transcribe 2 supports up to 500 MB and ~3 hours of audio per request. Requests are serialized across batch items and segments.

### Rev

| Option | Value |
|--------|-------|
| Selector | `--provider rev[=<model>]` |
| Models | `machine`, `low_cost` |
| Diarization | Enabled by default |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider rev=low_cost
```

### ScrapeCreators

| Option | Value |
|--------|-------|
| Selector | `--provider scrapecreators=youtube-transcript` |
| Language | `--stt-scrapecreators-lang <code>`, default `en` |
| Input support | Public `youtube.com` and `youtu.be` URLs only |

```bash
bun autoshow extract "https://www.youtube.com/watch?v=MORMZXEaONk" --provider scrapecreators=youtube-transcript
bun autoshow extract https://youtu.be/dQw4w9WgXcQ --provider scrapecreators=youtube-transcript --stt-scrapecreators-lang es
```

Retrieves existing YouTube transcripts via API and normalizes them into standard STT output.

### Soniox

| Option | Value |
|--------|-------|
| Selector | `--provider soniox[=<model>]` |
| Models | `stt-async-v5` |
| Diarization | Enabled by default |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider soniox
```

### Speechmatics

| Option | Value |
|--------|-------|
| Selector | `--provider speechmatics[=<model>]` |
| Models | `melia-1`, `enhanced` |
| Diarization | Enabled by default |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider speechmatics=melia-1
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider speechmatics=enhanced
```

Bare `--provider speechmatics` selects `melia-1` (multilingual). `enhanced` uses single-language detection for maximum per-language accuracy.

### Supadata

| Option | Value |
|--------|-------|
| Selector | `--provider supadata=auto` |
| Language | `--stt-supadata-lang <code>` when a native transcript is available |
| Input support | Public YouTube, TikTok, Instagram, X/Twitter, Facebook, or direct media URLs |

```bash
bun autoshow extract https://www.youtube.com/watch?v=MORMZXEaONk --provider supadata=auto --stt-supadata-lang en
bun autoshow extract https://www.tiktok.com/@example/video/1234567890 --provider supadata=auto
```

Supadata requires a public source URL. It tries provider-native transcripts first (`auto` mode) and generates a transcript when needed.

### Together

| Option | Value |
|--------|-------|
| Selector | `--provider together[=<model>]` |
| Models | `nvidia/parakeet-tdt-0.6b-v3`, `openai/whisper-large-v3` |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider together
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider together=openai/whisper-large-v3
```

Uses Together's batch transcription endpoint. Bare `--provider together` defaults to `nvidia/parakeet-tdt-0.6b-v3`.

## STT Pricing

- **Happy Scribe**: Estimated at `$0.01/min` from local audio duration.
- **Supadata**: Reference rate of `$10 / 1,000 credits` (`1.00 cent/credit`). Native transcripts estimate 1 credit per request; generated transcripts estimate ~2 credits/min. `auto` mode estimates the higher rate.
- **ScrapeCreators**: Freelance reference rate of `$47 / 25,000 credits` (`0.188 cents/request`), charging per retrieval request regardless of duration.
- **Duration-priced hosted providers** (Deepgram, Groq, DeepInfra, Together, Rev, Gladia, Soniox, Speechmatics, Mistral): Estimated based on media duration and published provider per-minute rates.
- **Token-priced providers** (Gemini STT, Grok STT): Estimated from media duration and token rates.
- Local engines (Whisper.cpp, Whisperfile, Reverb) are free.

## STT Notes

- Before hosted provider upload, AutoShow stages a shared mono AAC-LC `.m4a` audio artifact (96 kbps, original sample rate, metadata stripped). Low-bitrate mono inputs stay on a stream-copy path. Supadata and ScrapeCreators use public source URLs directly.
- Single-provider runs write root `transcription.txt` and `result.json`. Multi-provider runs write outputs per provider under `providers/<service>-<model>/`.
- `--youtube-captions` is English-only and applies to YouTube inputs. When captions are found, STT providers are skipped and recorded as service `youtube-captions` with model `subtitle-track`.
- STT batch roots include `manifest.json` recording item status and routing.
- Backfill existing STT outputs with top-level [`resume`](../../setup-and-utilities/resume/resume.md).
