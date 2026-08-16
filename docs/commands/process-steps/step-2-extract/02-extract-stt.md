# extract STT

Media inputs are downloaded and transcribed with hosted speech-to-text engines.

## Outline

- [STT Environment](#stt-environment)
- [Shared STT Options](#shared-stt-options)
- [Transcript Videos](#transcript-videos)
- [STT Services](#stt-services)
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
- [Provider Capabilities](#provider-capabilities)
  - [Diarization](#diarization)
  - [No Diarization](#no-diarization)
  - [Direct URL](#direct-url)

See the [`extract` overview](./01-extract.md) for input routing and default media transcription. Hosted STT is selected with `--provider`.

`--provider` selectors accept an omitted model value and then resolve to the cheapest or default supported model. Model-selecting selectors are repeatable, including repeated selectors from the same provider.

The standalone `extract` command uses route-aware `--provider provider[=model]` selectors. The `write` and `config` commands use the step selector `--stt provider[=model]`; `resume` uses target-aware `--provider provider[=model]`.

## STT Environment

| Provider       | Required env             |
| -------------- | ------------------------ |
| AssemblyAI     | `ASSEMBLYAI_API_KEY`     |
| Deepgram       | `DEEPGRAM_API_KEY`       |
| DeepInfra      | `DEEPINFRA_API_KEY`      |
| Gemini STT     | `GEMINI_API_KEY`         |
| Gladia         | `GLADIA_API_KEY`         |
| Grok STT       | `XAI_API_KEY`            |
| Groq           | `GROQ_API_KEY`           |
| Happy Scribe   | `HAPPYSCRIBE_API_KEY`    |
| Mistral        | `MISTRAL_API_KEY`        |
| Rev            | `REVAI_ACCESS_TOKEN`     |
| ScrapeCreators | `SCRAPECREATORS_API_KEY` |
| Soniox         | `SONIOX_API_KEY`         |
| Speechmatics   | `SPEECHMATICS_API_KEY`   |
| Supadata       | `SUPADATA_API_KEY`       |
| Together       | `TOGETHER_API_KEY`       |

## Shared STT Options

| Flag                                  | Description                                                                                                                                                                       |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--all-providers`                     | Enable every broadly applicable hosted STT provider/model for the input source; Supadata is included for supported public URLs, and ScrapeCreators is included for YouTube URLs   |
| `--youtube-captions`                  | Prefer English YouTube captions before STT when available; falls back to the selected STT provider path                                                                           |
| `--speaker-count <n>`                 | Diarization speaker-count hint for supported services                                                                                                                             |
| `--split`                             | Split audio into 30-minute segments before transcription                                                                                                                          |
| `--batch-limit <n>`                   | Limit batch size                                                                                                                                                                  |
| `--batch-all`                         | Process all batch items                                                                                                                                                           |
| `--batch-order <newest|oldest>`       | Choose batch ordering                                                                                                                                                             |
| `--batch-concurrency <n>`             | Process batch items concurrently; default `7`                                                                                                                                     |
| `--provider-concurrency <n>`          | Max cloud providers running in parallel for one item; default `7`                                                                                                                 |
| `--stt-segment-concurrency <n>`       | Max split segments in flight per provider; default `7`                                                                                                                            |
| `--stt-preflight-concurrency <n>`     | Max duration probes running in parallel during preflight; default `7`                                                                                                             |
| `--concurrency-mode <ramp|immediate>` | Start each hosted provider/account lane at one request and add one slot every five seconds while demand is queued (`ramp`, default), or start at its configured cap (`immediate`) |
| `--price`                             | Show the aggregated estimate and exit                                                                                                                                             |

The hosted ramp applies to provider requests and split STT segments. Audio splitting, duration probes, and other preflight work remain immediate.

See [Provider Capabilities](#provider-capabilities) for the per-model release date, input path, diarization, speaker-count, word-timestamp, cleanup, duration, and file-size matrix.

```bash
# Prefer YouTube captions, then fall back to STT
bun autoshow extract https://www.youtube.com/watch?v=MORMZXEaONk --youtube-captions --provider deepgram=nova-3

# Split a long file before transcription
bun autoshow extract https://ajc.pics/autoshow/examples/2-video.mp4 --provider deepgram=nova-3 --split

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

### AssemblyAI

| Option      | Value                                    |
| ----------- | ---------------------------------------- |
| Selector    | `--provider assemblyai[=<model>]`        |
| Models      | `universal-3-5-pro`, `universal-2`       |
| Diarization | Supported; accepts `--speaker-count <n>` |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider assemblyai
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider assemblyai=universal-3-5-pro --speaker-count 2
```

Bare `--provider assemblyai` defaults to `universal-2`. Select `universal-3-5-pro` explicitly for the flagship model.

### Deepgram

| Option      | Value                           |
| ----------- | ------------------------------- |
| Selector    | `--provider deepgram[=<model>]` |
| Models      | `nova-3`                        |
| Diarization | Enabled by default              |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider deepgram=nova-3
```

### DeepInfra

| Option   | Value                                                      |
| -------- | ---------------------------------------------------------- |
| Selector | `--provider deepinfra[=<model>]`                           |
| Models   | `openai/whisper-large-v3-turbo`, `openai/whisper-large-v3` |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider deepinfra
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider deepinfra=openai/whisper-large-v3
```

### Gemini STT

| Option   | Value                         |
| -------- | ----------------------------- |
| Selector | `--provider gemini[=<model>]` |
| Models   | `gemini-3.6-flash`            |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider gemini
```

Multimodal audio transcription via Gemini JSON prompt output.

### Gladia

| Option      | Value                                    |
| ----------- | ---------------------------------------- |
| Selector    | `--provider gladia[=<model>]`            |
| Models      | `solaria-1`, `solaria-3`                 |
| Diarization | Supported; accepts `--speaker-count <n>` |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider gladia=solaria-3
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider gladia --speaker-count 2
```

Bare `--provider gladia` selects `solaria-1`. `--all-providers` includes both active Solaria models.

### Grok STT

| Option      | Value                       |
| ----------- | --------------------------- |
| Selector    | `--provider grok[=<model>]` |
| Models      | `speech-to-text`            |
| Diarization | Enabled by default          |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider grok=speech-to-text
```

### Groq

| Option   | Value                                        |
| -------- | -------------------------------------------- |
| Selector | `--provider groq[=<model>]`                  |
| Models   | `whisper-large-v3-turbo`, `whisper-large-v3` |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider groq
```

### Happy Scribe

| Option       | Value                                    |
| ------------ | ---------------------------------------- |
| Selector     | `--provider happyscribe[=<model>]`       |
| Models       | `auto`                                   |
| Organization | `--stt-happyscribe-organization-id <id>` |
| Language     | Fixed to `en-US`                         |
| Diarization  | Enabled by default                       |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider happyscribe=auto
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider happyscribe --stt-happyscribe-organization-id org_123
```

Organization resolution order: CLI `--stt-happyscribe-organization-id`, config default, then auto-select if the API key accesses exactly one organization.

### Mistral

| Option   | Value                          |
| -------- | ------------------------------ |
| Selector | `--provider mistral[=<model>]` |
| Models   | `voxtral-mini-2602`            |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider mistral
```

Voxtral Mini Transcribe 2 supports up to 500 MB and ~3 hours of audio per request. Requests are serialized across batch items and segments.

### Rev

| Option      | Value                      |
| ----------- | -------------------------- |
| Selector    | `--provider rev[=<model>]` |
| Models      | `machine`, `low_cost`      |
| Diarization | Enabled by default         |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider rev=low_cost
```

### ScrapeCreators

| Option        | Value                                            |
| ------------- | ------------------------------------------------ |
| Selector      | `--provider scrapecreators=youtube-transcript`   |
| Language      | `--stt-scrapecreators-lang <code>`, default `en` |
| Input support | Public `youtube.com` and `youtu.be` URLs only    |

```bash
bun autoshow extract "https://www.youtube.com/watch?v=MORMZXEaONk" --provider scrapecreators=youtube-transcript
bun autoshow extract https://youtu.be/dQw4w9WgXcQ --provider scrapecreators=youtube-transcript --stt-scrapecreators-lang es
```

Retrieves existing YouTube transcripts via API and normalizes them into standard STT output.

### Soniox

| Option      | Value                         |
| ----------- | ----------------------------- |
| Selector    | `--provider soniox[=<model>]` |
| Models      | `stt-async-v5`                |
| Diarization | Enabled by default            |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider soniox
```

### Speechmatics

| Option      | Value                               |
| ----------- | ----------------------------------- |
| Selector    | `--provider speechmatics[=<model>]` |
| Models      | `melia-1`, `enhanced`               |
| Diarization | Enabled by default                  |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider speechmatics=melia-1
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider speechmatics=enhanced
```

Bare `--provider speechmatics` selects `melia-1` (multilingual). `enhanced` uses single-language detection for maximum per-language accuracy.

### Supadata

| Option        | Value                                                                        |
| ------------- | ---------------------------------------------------------------------------- |
| Selector      | `--provider supadata=auto`                                                   |
| Language      | `--stt-supadata-lang <code>` when a native transcript is available           |
| Input support | Public YouTube, TikTok, Instagram, X/Twitter, Facebook, or direct media URLs |

```bash
bun autoshow extract https://www.youtube.com/watch?v=MORMZXEaONk --provider supadata=auto --stt-supadata-lang en
bun autoshow extract https://www.tiktok.com/@example/video/1234567890 --provider supadata=auto
```

Supadata requires a public source URL. It tries provider-native transcripts first (`auto` mode) and generates a transcript when needed.

### Together

| Option   | Value                                                    |
| -------- | -------------------------------------------------------- |
| Selector | `--provider together[=<model>]`                          |
| Models   | `nvidia/parakeet-tdt-0.6b-v3`, `openai/whisper-large-v3` |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider together
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider together=openai/whisper-large-v3
```

Uses Together's batch transcription endpoint. Bare `--provider together` defaults to `nvidia/parakeet-tdt-0.6b-v3`.

## STT Pricing

- **Happy Scribe**: Estimated at `$0.01/min` from audio duration.
- **Supadata**: Reference rate of `$10 / 1,000 credits` (`1.00 cent/credit`). Native transcripts estimate 1 credit per request; generated transcripts estimate ~2 credits/min. `auto` mode estimates the higher rate.
- **ScrapeCreators**: Freelance reference rate of `$47 / 25,000 credits` (`0.188 cents/request`), charging per retrieval request regardless of duration.
- **Duration-priced hosted providers** (Deepgram, Groq, DeepInfra, Together, Rev, Gladia, Soniox, Speechmatics, Mistral): Estimated based on media duration and published provider per-minute rates.
- **Token-priced providers** (Gemini STT, Grok STT): Estimated from media duration and token rates.

## STT Notes

- Before hosted provider upload, AutoShow stages a shared mono AAC-LC `.m4a` audio artifact (96 kbps, original sample rate, metadata stripped). Low-bitrate mono inputs stay on a stream-copy path. Supadata and ScrapeCreators use public source URLs directly.
- Single-provider runs write root `transcription.txt` and `result.json`. Multi-provider runs write outputs per provider under `providers/<service>-<model>/`.
- `--youtube-captions` is English-only and applies to YouTube inputs. When captions are found, STT providers are skipped and recorded as service `youtube-captions` with model `subtitle-track`.
- STT batch roots include `manifest.json` recording item status and routing.
- Backfill existing STT outputs with top-level [`resume`](../../setup-and-utilities/resume/resume.md).

## Provider Capabilities

Marks match the [TTS capability tables](../step-4-tts/text-to-speech-and-voice.md#provider-capabilities): ✅ supported, ⚠️ partial or qualified, ❌ not exposed. Released dates are provider announcement or model-origin dates. Recency marks follow the TTS convention: current-year GA is ✅, older still-current snapshots are ⚠️, and pre-2026 engines are ❌. Rows are newest first.

Duration uses the same marks with fixed thresholds: under 2 hours is ❌, 2–4 hours is ⚠️, 5+ hours or no documented cap is ✅. File size uses ❌ under 100 MiB, ⚠️ 100 MiB to under 1 GiB, and ✅ 1 GiB or no cap. Hosted engines upload AutoShow's staged audio unless noted as public-URL only. Some vendor APIs also accept remote URLs; AutoShow does not send those except for Supadata and ScrapeCreators.

Pricing is the AutoShow registry rate. Cost rank orders models cheapest-first within each table (1 = cheapest) and ties share a rank; hosted tables rank on the per-hour rate and the Direct URL tables rank on the per-request retrieval cost.

### Diarization

| Provider                       | Released      | Input             | Diarization            | Speaker count        | Word timestamps              | Transcript cleanup                                    | Duration              | File size         | Pricing   | Cost rank |
| ------------------------------ | ------------- | ----------------- | ---------------------- | -------------------- | ---------------------------- | ----------------------------------------------------- | --------------------- | ----------------- | --------- | --------- |
| AssemblyAI `universal-3-5-pro` | ✅ 2026-07-07 | ⚠️ Staged upload  | ✅ Speaker labels      | ✅ `--speaker-count` | ✅ Native words              | ❌ Not requested                                      | ✅ 10 hours           | ✅ 2.2 GiB upload | $0.23/hr  | 8/12      |
| Speechmatics `melia-1`         | ✅ 2026-06-17 | ⚠️ Staged upload  | ✅ Speaker diarization | ❌ Not exposed       | ✅ Native words              | ⚠️ Punctuation tokens in the response                 | ✅ No documented cap  | ✅ 1 GiB          | $0.129/hr | 5/12      |
| Soniox `stt-async-v5`          | ✅ 2026-06-11 | ⚠️ File-id upload | ✅ Speaker diarization | ❌ Not exposed       | ✅ Native token/word timings | ⚠️ Smart formatting included, not requested as a flag | ✅ 5 hours            | ⚠️ 500 MiB        | $0.10/hr  | 1/12      |
| Gladia `solaria-3`             | ✅ 2026-06-10 | ⚠️ Staged upload  | ✅ Speaker labels      | ✅ `--speaker-count` | ✅ Native words              | ❌ Not requested                                      | ⚠️ 2 hours 15 minutes | ⚠️ 1000 MiB       | $0.61/hr  | 11/12     |
| Grok `speech-to-text`          | ✅ 2026-05    | ⚠️ Staged upload  | ✅ `diarize=true`      | ❌ Not exposed       | ✅ Native words              | ✅ `format=true`                                      | ✅ No documented cap  | ⚠️ 500 MiB        | $0.10/hr  | 1/12      |
| Mistral `voxtral-mini-2602`    | ✅ 2026-02-04 | ⚠️ Staged upload  | ✅ `diarize=true`      | ❌ Not exposed       | ⚠️ Segment timestamps only   | ❌ Not requested                                      | ⚠️ ~3 hours           | ⚠️ 500 MiB        | $0.12/hr  | 4/12      |
| Gladia `solaria-1`             | ⚠️ 2025-06    | ⚠️ Staged upload  | ✅ Speaker labels      | ✅ `--speaker-count` | ✅ Native words              | ❌ Not requested                                      | ⚠️ 2 hours 15 minutes | ⚠️ 1000 MiB       | $0.61/hr  | 11/12     |
| Deepgram `nova-3`              | ⚠️ 2025-02-12 | ⚠️ Staged upload  | ✅ `diarize=true`      | ❌ Not exposed       | ✅ Native words              | ✅ `punctuate` and `smart_format`                     | ✅ No documented cap  | ✅ 2 GiB          | $0.582/hr | 10/12     |
| AssemblyAI `universal-2`       | ❌ 2024-10-30 | ⚠️ Staged upload  | ✅ Speaker labels      | ✅ `--speaker-count` | ✅ Native words              | ❌ Not requested                                      | ✅ 10 hours           | ✅ 2.2 GiB upload | $0.17/hr  | 6/12      |
| Rev `low_cost`                 | ❌ 2023       | ⚠️ Staged upload  | ✅ Monologue speakers  | ❌ Not exposed       | ✅ Word `ts`/`end_ts`        | ✅ `remove_disfluencies`                              | ✅ 17 hours           | ✅ 2 GiB          | $0.10/hr  | 1/12      |
| Rev `machine`                  | ❌ 2018       | ⚠️ Staged upload  | ✅ Monologue speakers  | ❌ Not exposed       | ✅ Word `ts`/`end_ts`        | ✅ `remove_disfluencies`                              | ✅ 17 hours           | ✅ 2 GiB          | $0.20/hr  | 7/12      |
| Speechmatics `enhanced`        | ❌ 2018       | ⚠️ Staged upload  | ✅ Speaker diarization | ❌ Not exposed       | ✅ Native words              | ⚠️ Punctuation tokens in the response                 | ✅ No documented cap  | ✅ 1 GiB          | $0.40/hr  | 9/12      |

### No Diarization

| Provider                                  | Released      | Input            | Word timestamps            | Transcript cleanup         | Duration             | File size                          | Pricing   | Cost rank |
| ----------------------------------------- | ------------- | ---------------- | -------------------------- | -------------------------- | -------------------- | ---------------------------------- | --------- | --------- |
| Gemini `gemini-3.6-flash`                 | ✅ 2026-07    | ⚠️ Staged upload | ❌ Segment JSON only       | ❌ Exact-transcribe prompt | ✅ No documented cap | ❌ 20 MiB inline / 2 GiB Files API | $0.173/hr | 7/7       |
| Together `nvidia/parakeet-tdt-0.6b-v3`    | ⚠️ 2025-08-14 | ⚠️ Staged upload | ⚠️ Segment timestamps only | ❌ Not requested           | ⚠️ 4 hours           | ⚠️ 500 MiB                         | $0.09/hr  | 4/7       |
| DeepInfra `openai/whisper-large-v3-turbo` | ❌ 2024-09    | ⚠️ Staged upload | ⚠️ Segment timestamps only | ❌ Not requested           | ✅ No documented cap | ✅ No documented cap               | $0.012/hr | 1/7       |
| Groq `whisper-large-v3-turbo`             | ❌ 2024-09    | ⚠️ Staged upload | ⚠️ Segment timestamps only | ❌ Not requested           | ✅ No documented cap | ❌ 25 MiB                          | $0.04/hr  | 3/7       |
| DeepInfra `openai/whisper-large-v3`       | ❌ 2023-11    | ⚠️ Staged upload | ⚠️ Segment timestamps only | ❌ Not requested           | ✅ No documented cap | ✅ No documented cap               | $0.027/hr | 2/7       |
| Groq `whisper-large-v3`                   | ❌ 2023-11    | ⚠️ Staged upload | ⚠️ Segment timestamps only | ❌ Not requested           | ✅ No documented cap | ❌ 25 MiB                          | $0.111/hr | 6/7       |
| Together `openai/whisper-large-v3`        | ❌ 2023-11    | ⚠️ Staged upload | ⚠️ Segment timestamps only | ❌ Not requested           | ⚠️ 4 hours           | ❌ 20 MiB operational cap          | $0.09/hr  | 4/7       |

### Direct URL

Vendor APIs that accept a public page URL (YouTube or similar), even when AutoShow still uploads staged audio. AutoShow only sends the original source URL to Supadata and ScrapeCreators.

#### Direct URL with diarization

| Provider            | Released | YouTube | Other page URLs | AutoShow uses URL | Speaker count  | Word timestamps                         | Transcript cleanup | Duration             | File size            | Pricing  | Cost rank |
| ------------------- | -------- | ------- | --------------- | ----------------- | -------------- | --------------------------------------- | ------------------ | -------------------- | -------------------- | -------- | --------- |
| Happy Scribe `auto` | ❌ 2017  | ✅ Yes  | ✅ Vimeo        | ❌ Signed upload  | ❌ Not exposed | ⚠️ Words when the payload includes them | ❌ Not requested   | ✅ No documented cap | ✅ No documented cap | $0.60/hr | 1/1       |

#### Direct URL without diarization

| Provider                            | Released   | YouTube | Other page URLs                                      | AutoShow uses URL | Word timestamps       | Transcript cleanup                | Duration             | File size           | Pricing                                   | Cost rank |
| ----------------------------------- | ---------- | ------- | ---------------------------------------------------- | ----------------- | --------------------- | --------------------------------- | -------------------- | ------------------- | ----------------------------------------- | --------- |
| Supadata `auto`                     | ❌ 2024-08 | ✅ Yes  | ✅ TikTok, Instagram, X/Twitter, Facebook, media URL | ✅ Source URL     | ❌ Chunk offsets only | ⚠️ Native transcript or generated | ✅ No documented cap | ✅ 1 GiB remote URL | $0.01/request native; $0.02/min generated | 2/2       |
| ScrapeCreators `youtube-transcript` | ❌ 2024-06 | ✅ Yes  | ❌ YouTube only                                      | ✅ Source URL     | ❌ Cue times only     | ⚠️ Retrieves existing captions    | ✅ No documented cap | ✅ No upload        | $0.00188/request                          | 1/2       |

`--speaker-count` is sent only to AssemblyAI (`speakers_expected`) and Gladia (`diarization_config.number_of_speakers`). Gladia Solaria-3 is English, French, German, Spanish, and Italian only. Enterprise Gladia plans can raise duration to 4 hours 15 minutes. Deepgram documents no batch audio-length cap and a 10-minute processing-time cap. Gemini keeps inline audio under 20 MiB and uses the Files API above that, with a 2 GiB hard reject. Together Parakeet uses the documented 500 MiB upload cap; Together Whisper uses a 20 MiB operational cap after oversized multipart rejections. AssemblyAI, Deepgram, Gladia, Groq, Mistral, Rev, Soniox, Speechmatics, and Together APIs can also accept remote URLs, but AutoShow uploads staged audio instead. AutoShow `--split` and retry-with-split cover unpublished duration or size caps.

STT test coverage is documented in [Step 2 Tests: STT](05-extract-stt-tests.md).
