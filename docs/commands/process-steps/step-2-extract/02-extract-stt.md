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

`extract --transcript-video` renders a local MP4 from existing STT artifacts. It does not call an STT provider. The normal path is a media extract output directory; AutoShow reads its `run.json`, infers the saved audio file, and renders the root `result.json` or the single completed provider result. Multi-provider runs with more than one result require `--transcript-result`.

First produce a diarized STT run from a committed example file. Soniox diarizes by default, so the transcript carries speaker labels; any other provider from [Diarized STT](#diarized-stt) works the same way. `--output-dir` pins the run directory so every later command can name it directly instead of guessing a timestamp.

```bash
# Soniox is a hosted provider and needs SONIOX_API_KEY in the environment
bun autoshow extract input/examples/audio/1-audio.mp3 --provider soniox --output-dir output/transcript-demo
```

That single-provider run writes `1-audio.mp3`, `transcription.txt`, and `result.json` into `output/transcript-demo`, with `[HH:MM:SS.mmm] [speaker] text` lines in the transcript.

```bash
# render from that completed media extract directory
bun autoshow extract output/transcript-demo --transcript-video --output-dir output/transcript-demo-video

# render from explicit files without an extract run directory
bun autoshow extract --transcript-video --audio input/examples/audio/1-audio.mp3 --transcript-result output/transcript-demo/result.json

# render from the timestamped text transcript format
bun autoshow extract --transcript-video --audio input/examples/audio/1-audio.mp3 --transcript-text output/transcript-demo/transcription.txt
```

A multi-provider run writes one result per provider under `providers/<service>-<model>/` and no root `result.json`, so pick the diarized provider result explicitly. `--provider soniox` resolves to the supported Soniox model, `stt-async-v5`, which is what names the directory.

```bash
# one hosted diarized provider and one local provider over the same example file
bun autoshow extract input/examples/audio/1-audio.mp3 --provider soniox --provider whisper=tiny --output-dir output/transcript-demo-multi

# choose the diarized provider result from that multi-provider run
bun autoshow extract output/transcript-demo-multi --transcript-video --transcript-result output/transcript-demo-multi/providers/soniox-stt-async-v5/result.json
```

Without `--output-dir` each command creates its own timestamped directory (`output/<timestamp>_1-audio`, `output/<timestamp>_transcript-video-<label>`). The output directory contains `<label>.mp4`, `<label>.vtt`, `<label>.srt`, and `run.json`. When the STT result carries native per-word timings, cues are built from those words rather than from segment stamps, so the on-screen line matches the audio. The active line is drawn between the previous and next lines, with the speaker shown as a colour-coded label on the active line only; `.vtt`/`.srt` keep the speaker inline. Cues also fall back to `result.json` segments or `[HH:MM:SS.mmm] [speaker] text` transcript lines when a provider reports no word timings. The renderer uses the same fixed 1920x1080 local ffmpeg pipeline as lyric videos, with `--font` and `--keep-tmp` available for transcript-video rendering.

## URL/streaming/source-URL STT

These services either work best with provider-side URLs or have source-URL-specific behavior.

### Happy Scribe

| Option | Value |
|--------|-------|
| Selector | `--provider happyscribe[=<model>]` |
| Models | `auto` |
| Organization | `--stt-happyscribe-organization-id <id>` |
| Language | Fixed to `en-US` in v1 |
| Diarization | Enabled by default; `--speaker-count` is ignored |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider happyscribe=auto
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider happyscribe --stt-happyscribe-organization-id org_123
```

Organization resolution order is CLI `--stt-happyscribe-organization-id`, config default, then auto-select only when the API key can access exactly one organization. Non-English audio and multilingual audio are unsupported and may produce poor transcripts.

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

Supadata requires a public source URL and cannot transcribe local file inputs through the AutoShow CLI. AutoShow exposes only Supadata `auto` mode: it tries provider-native transcripts first and generates a transcript when needed. Supadata treats direct media/file URLs as generated transcripts. `--stt-supadata-lang` is sent with the auto request, but generated transcripts ignore that flag.

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

ScrapeCreators is transcript retrieval, not general audio transcription. AutoShow calls `GET /v1/youtube/video/transcript` with the source URL and requested language, then normalizes returned timed transcript entries into `transcription.txt` and structured STT artifacts. It does not replace `--youtube-captions`; use ScrapeCreators when you want it as an explicit paid provider in the same target set as other STT providers.

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

Bare `--provider gladia` selects the tied cheapest model `solaria-1`; `--all-providers` includes both active Solaria models. Select `solaria-3` explicitly when its supported-language profile fits the source.

## Non-diarized STT

These providers are documented as single-speaker or non-diarized in the CLI.

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

Whisperfile is a self-contained alternative to the `whisper.cpp` build: each model is a single Cosmopolitan APE binary with the GGML weights embedded, so it runs with no compiler toolchain. AutoShow launches it through a shell (`sh <binary>`) because macOS cannot `exec` the APE format directly. Output carries native word timing but no diarization. Whisperfile is included by `--all-local`. Unlike `--provider whisper`, the whisperfile selector has no default model, so always pass an explicit model. Whisperfile is selectable through `--provider whisperfile=<model>` on `extract` and `resume`, and through `--stt whisperfile=<model>` on `write` and `config`.

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

Both models use Together's serverless batch transcription endpoint at `$0.0015` per audio minute. The bare selector chooses Parakeet under the standard cheapest-model tie-breaker. AutoShow requests verbose segment timestamps from both models, and its request builder keeps optional decoding prompts model-aware because Together supports them only on Whisper.

### Gemini STT

| Option | Value |
|--------|-------|
| Selector | `--provider gemini[=<model>]` |
| Models | `gemini-3.6-flash` |
| Behavior | Prompted JSON transcription via Gemini multimodal input |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider gemini
```

The retired `gemini-3-flash-preview` selector remains readable in completed historical benchmark artifacts but cannot be selected for new work.

### Mistral

| Option | Value |
|--------|-------|
| Selector | `--provider mistral[=<model>]` |
| Models | `voxtral-mini-2602` |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider mistral
```

Mistral STT follows the current documented Voxtral Mini Transcribe 2 limits: up to 500 MB per audio transcription request and approximately 3 hours of audio per request. Requests are internally serialized across batch items and split segments to reduce provider-side rate limits.

## Diarized STT

These engines either support diarization directly or AutoShow enables diarization for them.

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

Grok STT sends `format=true`, `language=en`, and `diarize=true` to xAI's REST STT endpoint and records word timing, confidence, and speaker evidence when the response includes it.

### Deepgram

| Option | Value |
|--------|-------|
| Selector | `--provider deepgram[=<model>]` |
| Models | `nova-3` |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider deepgram=nova-3
```

AutoShow exposes only Deepgram's concrete general-purpose `nova-3` family selector. The redundant `nova-3-general` specialization and domain-specific `nova-3-medical` model are intentionally excluded from the general-purpose hosted STT registry.

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

Bare `--provider speechmatics` selects the cheaper `melia-1` model. Melia uses Speechmatics' required `language: "multi"` selector for multilingual detection and code-switching; `enhanced` retains `language: "auto"` for automatic single-language identification and remains available explicitly for maximum per-language accuracy.

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

The bare AssemblyAI selector uses the lowest-cost active model, `universal-2`. Select `universal-3-5-pro` explicitly for the flagship model. `--all-providers` includes both models in the order shown above.

## STT Pricing And Manifests

Happy Scribe price preflight is intentionally side-effect free.

- `--price` never creates Happy Scribe uploads or draft orders. Preflight uses the published AI rate of `$0.01/min` and the local timing registry.
- If preflight cannot resolve a unique organization, AutoShow still prints the generic estimate. Execution needs an explicit organization override before exact billing can be captured.
- During execution, AutoShow records Happy Scribe billing in `step2.billing` using `totalCost`, `creditsUsed`, `creditRateCents`, `source: "provider_quote"`, and `mode: "order"` when the selected organization reports `currency: "usd"`. Non-USD execution is rejected in v1. If exact provider billing is unavailable, AutoShow falls back to registry math with `source: "registry_fallback"`.
- Happy Scribe split runs submit one order per segment and merge segment billing into `step2.billing.mode: "segment_sum"`.

Supadata price estimates use provider credits.

- `--price` uses the published Basic/Pro auto-recharge reference rate of `$10 / 1,000 credits`, or `1.00 cents/credit`.
- `native` estimates one transcript request credit, including transcript-unavailable responses.
- `generate` estimates AI generation from media duration at roughly `2 credits/min`.
- `auto` is priced conservatively as the higher of one native transcript request credit or generated transcript credits from media duration.
- Direct media/file URLs are treated as generated transcripts by Supadata, so they estimate from media duration even when `auto` is selected.
- Published credit pricing can vary by plan, billing setup, promotions, or enterprise terms; AutoShow's preflight uses the Basic/Pro auto-recharge reference rate for consistency.
- During execution, Supadata billing metadata records credit counts from provider response headers when available.

ScrapeCreators price estimates use one fixed transcript-request credit.

- `--price` uses the published Freelance reference rate of `$47 / 25,000 credits`, or `0.188` cents per YouTube transcript request.
- Business pricing is lower at `$497 / 500,000 credits`, or `0.0994` cents per request, but AutoShow does not use that as the default estimator.
- Estimates and actual fallback billing ignore media duration because ScrapeCreators charges the retrieval request, not transcription minutes.

## STT Notes

- Before any hosted STT provider upload, AutoShow stages one shared stripped audio-only artifact. The default hosted artifact is mono AAC-LC in `.m4a` capped at 96 kbps, preserves the original sample rate, and drops cover art/chapters/metadata/extra streams. Low-bitrate mono `.m4a`/AAC and `.mp3` inputs stay on a stream-copy cleanup path instead of taking a second lossy encode. Supadata and ScrapeCreators use public source URLs instead of local uploads.
- Single-provider local/upload STT runs write root `transcription.txt` plus root `result.json`; URL transcript retrieval providers write under their provider directory.
- Hosted multi-provider runs write one transcript and one canonical structured artifact per provider under `providers/<service>-<model>/`.
- `--youtube-captions` is English-only in v1 and only applies to YouTube inputs.
- For YouTube channels and playlists, `--youtube-captions` is evaluated per selected video in the batch. Use `--batch-all` when you want the full channel or playlist instead of the default batch limit.
- If captions are found, the selected STT providers are skipped for that item and the caption result becomes the transcript source.
- Caption-backed transcripts are recorded as service `youtube-captions` with model `subtitle-track` in pricing and manifest metadata.
- STT batch roots now include `stt-summary.json`, which records per-item caption-vs-STT routing alongside completion status.
- Backfill existing STT outputs with top-level [`resume`](../../setup-and-utilities/resume/resume.md).
