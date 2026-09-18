# extract STT

Transcribe media with hosted or local speech-to-text engines. Saved results support caption export, transcript review, and local timing and speaker workflows.

## Outline

- [Provider Capabilities](#provider-capabilities)
- [STT Environment](#stt-environment)
- [Shared STT Options](#shared-stt-options)
- [Provider Controls](#provider-controls)
- [Workflows](#workflows)
- [STT Pricing](#stt-pricing)
- [STT Notes](#stt-notes)

See the [`extract` overview](../overview.md) for input routing and default media transcription. Hosted STT is selected with `--provider`.

`--provider` selectors accept an omitted model value and then resolve to the cheapest or default supported model. Model-selecting selectors are repeatable, including repeated selectors from the same provider.

On `extract` and `resume`, pass `--provider provider[=model]`. On `setup`, persist defaults with `--stt provider[=model]`.

## Provider Capabilities

| Group                                                                | Providers                                                                               |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| [Local](local/overview.md)                                           | Whisperfile                                                                             |
| [Diarization](diarization/overview.md)                               | AssemblyAI, Deepgram, Gemini, Gladia, Grok, Happy Scribe, Mistral, Soniox, Speechmatics |
| [Diarization off by default](diarization-off-by-default/overview.md) | DeepInfra, OpenAI, Together                                                             |

See each subgroup for selectors, examples, and per-model capabilities. Public media URL transcripts (Supadata, ScrapeCreators) and YouTube caption fallback live under [URL extraction](../url/overview.md#public-media-url-transcripts).

## STT Environment

| Provider     | Required env           |
| ------------ | ---------------------- |
| AssemblyAI   | `ASSEMBLYAI_API_KEY`   |
| Deepgram     | `DEEPGRAM_API_KEY`     |
| DeepInfra    | `DEEPINFRA_API_KEY`    |
| Gemini STT   | `GEMINI_API_KEY`       |
| Gladia       | `GLADIA_API_KEY`       |
| Grok STT     | `XAI_API_KEY`          |
| Happy Scribe | `HAPPYSCRIBE_API_KEY`  |
| Mistral      | `MISTRAL_API_KEY`      |
| OpenAI STT   | `OPENAI_API_KEY`       |
| Soniox       | `SONIOX_API_KEY`       |
| Speechmatics | `SPEECHMATICS_API_KEY` |
| Together     | `TOGETHER_API_KEY`     |

## Shared STT Options

Asynchronous transcription jobs and native subtitle exports wait up to 30 minutes. A timeout keeps the remote job so `resume` can recover it.

| Flag                                   | Description                                                                                                                                                                                           |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--all-providers`                      | Enable every broadly applicable hosted STT provider/model for the input source; public-URL transcript backends are documented under [URL extraction](../url/overview.md#public-media-url-transcripts) |
| `--youtube-captions`                   | Prefer English YouTube captions before STT when available; see [YouTube Caption Fallback](../url/overview.md#youtube-caption-fallback)                                                                |
| `--stt-audio-profile <profile>`        | Audio preparation: `default` (provider compression) or `lossless` (verified float32 WAV, original channels/rate)                                                                                      |
| `--speaker-count <n>`                  | Diarization speaker-count hint for supported services                                                                                                                                                 |
| `--split`                              | Split audio into 30-minute segments before transcription                                                                                                                                              |
| `--batch-limit <n\|all>`               | Limit batch size or process all items (`all`)                                                                                                                                                         |
| `--batch-order <newest\|oldest>`       | Choose batch ordering                                                                                                                                                                                 |
| `--batch-concurrency <n>`              | Process batch items concurrently; default `7`                                                                                                                                                         |
| `--provider-concurrency <n>`           | Max hosted provider/model targets running in parallel for one item; default `7`                                                                                                                       |
| `--step-concurrency stt-segment=<n>`   | Max split segments in flight per provider; default `7`; local providers clamp to `1`                                                                                                                  |
| `--step-concurrency stt-preflight=<n>` | Max duration probes in parallel during preflight; default `7`                                                                                                                                         |
| `--concurrency-mode <ramp\|immediate>` | Start each hosted provider/account lane at one request and add one slot every five seconds while demand is queued (`ramp`, default), or start at its configured cap (`immediate`)                     |
| `--price`                              | Show the aggregated estimate and exit                                                                                                                                                                 |
| `--max-model-cents <n>`                | Exclude each provider/model whose estimated total across the invocation exceeds the per-model ceiling in cents; works with or without `--price`                                                       |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/2-video.mp4 --provider deepgram=nova-3 --split
```
## Provider Controls

`--diarization` and `--no-diarization` apply to AssemblyAI, Deepgram, Gemini, Gladia, Grok, Mistral, Soniox, Speechmatics, and Together. Together stays off unless enabled; Together also turns on with `--speaker-count`. `--speaker-count` is supported by AssemblyAI, Gladia, and Together, and is ignored when diarization is disabled. Mistral diarization uses segment timing; disable it for native word timestamps. Together Parakeet word timings can be incomplete. Gemini uses native speaker diarization and word timestamps through `gemini-3.5-transcribe` (verbatim mode); `--speaker-count` is ignored, custom vocabulary and smart transcription are not exposed, and word timestamps may reduce accuracy. Providers that do not support the toggle, including Happy Scribe, report that it was ignored. Hide speaker labels at export with `--no-caption-speakers`.

Chunked results label speakers as `chunk-N/speaker-ID`. The same number in two chunks is not assumed to be the same person. `resume` rejects transcription-setting changes that would reuse incompatible results.

`--native-subtitles` saves provider subtitle files from the same job: AssemblyAI SRT/VTT; Gladia SRT/VTT; Happy Scribe SRT/VTT; Speechmatics SRT; whisperfile SRT/VTT/LRC. Files are named `transcription.native.srt/vtt` (with segment suffixes for split jobs). Split-chunk files keep provider-relative timestamps; export the combined `result.json` for a full-recording timeline. Hosted exports may use provider quota. A failed export leaves the transcript in place. Adding this option when resuming a completed target does not fetch missed exports; re-export locally from the saved result.

DeepInfra defaults to verbose JSON with words and segments. `--stt-response-format deepinfra=srt|deepinfra=vtt` selects a native subtitle response instead of word evidence. It never retranscribes only to fetch a second format. Prefer verbose JSON plus local export when precise word evidence matters.

Grok's `--stt-verbatim grok=true` disables display formatting and requests filler words. These options, diarization, native subtitles, and DeepInfra response format persist in STT configuration and resume.

## Workflows

- [Captions](workflows/captions/overview.md): export saved evidence, format subtitles, and embed tracks in video containers.
- [Timing and speakers](workflows/timing/overview.md): compare timing, force-align text, calibrate Whisper, split or merge channels, and reconcile speaker labels.
- [Transcript review](workflows/transcript-review/overview.md): export review packets and apply source-bound text edits offline.
- [Transcript videos](workflows/transcript-video/overview.md): render video from saved transcripts and audio.

## STT Pricing

AssemblyAI Universal-3.5 Pro is $0.21/hour plus $0.02/hour for diarization ($0.23/hour by default). Disabling diarization removes the add-on. Deepgram Nova-3 is $0.258/hour with diarization included. Estimates use prerecorded rates. [AssemblyAI pricing](https://www.assemblyai.com/pricing), [Deepgram pricing](https://deepgram.com/pricing).

- **Happy Scribe**: Estimated at `$0.01/min` from audio duration.
- **Duration-priced hosted providers** (AssemblyAI, Deepgram, DeepInfra, Gladia, Grok STT, Mistral, OpenAI STT, Soniox, Speechmatics, Together): Estimated from media duration and published per-hour rates.
- **Token-priced providers** (Gemini STT): Estimated from media duration at 25 audio tokens per second plus the advertised output component (~$0.30/hour).

## STT Notes

- Hosted STT engines transcribe from the input audio. Public-URL transcript backends are documented under [URL extraction](../url/overview.md#public-media-url-transcripts).
- Single-provider runs write root `transcription.txt` and `result.json`. Multi-provider runs write outputs per provider under `providers/<service>-<model>/`.
- STT batch roots include `manifest.json` with item status.
- Backfill existing STT outputs with top-level [`resume`](../../00-setup-and-utilities/resume.md).
