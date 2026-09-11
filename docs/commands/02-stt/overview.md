# extract STT

Transcribe media with hosted or local speech-to-text engines. Saved results support caption export, transcript review, and local timing and speaker workflows.

## Outline

- [Provider Capabilities](#provider-capabilities)
- [STT Environment](#stt-environment)
- [Shared STT Options](#shared-stt-options)
- [Provider controls](#provider-controls)
- [Workflows](#workflows)
- [STT Pricing](#stt-pricing)
- [STT Notes](#stt-notes)

See the [`extract` overview](../extract.md) for input routing and default media transcription. Hosted STT is selected with `--provider`.

`--provider` selectors accept an omitted model value and then resolve to the cheapest or default supported model. Model-selecting selectors are repeatable, including repeated selectors from the same provider.

On `extract` and `resume`, pass `--provider provider[=model]`. On `config`, pass `--stt provider[=model]`.

## Provider Capabilities

Groups describe current defaults, including the optional speaker capabilities of Gemini and Together. Provider selectors and configuration remain the same across groups.

| Group | Providers |
| --- | --- |
| [Local](local/overview.md) | Whisperfile |
| [Diarization](diarization/overview.md) | AssemblyAI, Deepgram, Gladia, Grok, Happy Scribe, Mistral, Soniox, Speechmatics |
| [Diarization off by default](diarization-off-by-default/overview.md) | DeepInfra, Gemini, Together |
| [Direct URL](direct-url/overview.md) | Supadata, ScrapeCreators; also documents YouTube caption fallback |

Each subgroup guide includes its provider selectors, examples, and capability details. YouTube caption fallback is a flag, not an additional provider.

## STT Environment

| Provider       | Required env             |
| -------------- | ------------------------ |
| AssemblyAI     | `ASSEMBLYAI_API_KEY`     |
| Deepgram       | `DEEPGRAM_API_KEY`       |
| DeepInfra      | `DEEPINFRA_API_KEY`      |
| Gemini STT     | `GEMINI_API_KEY`         |
| Gladia         | `GLADIA_API_KEY`         |
| Grok STT       | `XAI_API_KEY`            |
| Happy Scribe   | `HAPPYSCRIBE_API_KEY`    |
| Mistral        | `MISTRAL_API_KEY`        |
| ScrapeCreators | `SCRAPECREATORS_API_KEY` |
| Soniox         | `SONIOX_API_KEY`         |
| Speechmatics   | `SPEECHMATICS_API_KEY`   |
| Supadata       | `SUPADATA_API_KEY`       |
| Together       | `TOGETHER_API_KEY`       |

## Shared STT Options

Fresh asynchronous transcription jobs and subtitle exports using the shared STT polling loop wait up to 30 minutes for completion. A polling timeout retains the existing remote job identity for recovery.

| Flag                                  | Description                                                                                                                                                                       |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--all-providers`                     | Enable every broadly applicable hosted STT provider/model for the input source; Supadata is included for supported public URLs, and ScrapeCreators is included for YouTube URLs   |
| `--youtube-captions`                  | Prefer English YouTube captions before STT when available; falls back to the selected STT provider path                                                                           |
| `--speaker-count <n>`                 | Diarization speaker-count hint for supported services                                                                                                                             |
| `--split`                             | Split audio into 30-minute segments before transcription                                                                                                                          |
| `--batch-limit <n|all>`               | Limit batch size or process all items (`all`)                                                                                                                                     |
| `--batch-order <newest|oldest>`       | Choose batch ordering                                                                                                                                                             |
| `--batch-concurrency <n>`             | Process batch items concurrently; default `7`                                                                                                                                     |
| `--provider-concurrency <n>`          | Max hosted provider/model targets running in parallel for one item; default `7`                                                                                                   |
| `--stt-segment-concurrency <n>`       | Max split segments in flight per provider; default `7`                                                                                                                            |
| `--stt-preflight-concurrency <n>`     | Max media-duration probes running in parallel during preflight; default `7`                                                                                                      |
| `--concurrency-mode <ramp|immediate>` | Start each hosted provider/account lane at one request and add one slot every five seconds while demand is queued (`ramp`, default), or start at its configured cap (`immediate`) |
| `--price`                             | Show the aggregated estimate and exit                                                                                                                                             |
| `--max-model-cents <n>`               | Exclude each provider/model whose estimated total across the invocation exceeds the per-model ceiling in cents; works with or without `--price`                                  |

See [Provider Capabilities](#provider-capabilities) for the per-model release date, diarization, speaker-count, word-timestamp, cleanup, duration, and file-size matrix.

```bash
# Prefer YouTube captions, then fall back to STT
bun autoshow extract https://www.youtube.com/watch?v=MORMZXEaONk --youtube-captions --provider deepgram=nova-3

# Split a long file before transcription
bun autoshow extract https://ajc.pics/autoshow/examples/2-video.mp4 --provider deepgram=nova-3 --split

# Process a whole YouTube channel batch with caption-first routing
bun autoshow extract https://www.youtube.com/@channelname --youtube-captions --batch-limit all
```

## Provider controls

`--diarization` and `--no-diarization` control AssemblyAI, Deepgram, Gladia, Grok, Mistral, Soniox, Speechmatics, and Together. Defaults remain provider-specific; Together is off unless enabled or given a speaker count. `--speaker-count` is supported by AssemblyAI, Gladia, and Together and is ignored when diarization is explicitly disabled. Together sends matching minimum/maximum speaker bounds. Capability resolution is model-aware: Together Whisper has documented diarization, and Parakeet's diarization was live-tested on a two-speaker sample on 2026-09-10. That Parakeet response contained 24 speaker-labeled word entries, including 12 zero-length intervals; caption export preserved all text and reported 12 inferred timings. This confirms endpoint compatibility, not acoustic accuracy or uniformly usable native boundaries. Mistral warns that diarization uses segment timing; disable diarization for native words. Gemini supports optional generated speaker hypotheses; these are not acoustically aligned speaker measurements. Unsupported providers, including Happy Scribe's undocumented off switch, report the ignored toggle. Hide their labels at export with `--no-caption-speakers`.

Chunked diarized results scope speaker labels as `chunk-N/speaker-ID`. The same numeric speaker in two independently transcribed chunks is not assumed to be the same person. Raw chunk evidence and source offsets survive save/load. Resume rejects changes to transcription-affecting settings instead of silently reusing incompatible results.

`--native-subtitles` opts into native artifacts from the same inference or completed job: AssemblyAI SRT/VTT; Gladia SRT/VTT; Happy Scribe SRT/VTT; Speechmatics SRT; whisperfile SRT/VTT/LRC. Local engines probe their installed help before enabling optional flags and save invocation/model/help provenance in `transcription.engine.json`. Native artifacts are named `transcription.native.srt/vtt` (with segment suffixes for split jobs) and retain provider-relative timestamps within split chunks. Use local export of the combined `result.json` for a full-recording timeline. Hosted exports may consume requests, quota, or provider credits. Export failures create separate error artifacts and retain structured transcription evidence. Adding this option when resuming an already successful target does not trigger another transcription or retroactively fetch exports; use local re-export for those results.

DeepInfra defaults to verbose JSON with words and segments. `--deepinfra-stt-response-format srt|vtt` explicitly selects a native text response in one inference request, preserving subtitle cue timing instead of word evidence. It never retranscribes simply to fetch a second format. Prefer verbose JSON plus local export when precise word evidence matters.

Grok's `--stt-grok-verbatim` disables display formatting and requests filler words. Supadata's `--stt-supadata-chunk-size <characters>` controls chunk readability; it does not add word alignment. These options, diarization, native subtitles, and DeepInfra response format are supported in persistent STT configuration and resume.

## Workflows

- [Captions](workflows/captions/overview.md): export saved evidence, format subtitles, and embed tracks in video containers.
- [Timing and speakers](workflows/timing/overview.md): compare timing, force-align text, calibrate Whisper, split or merge channels, and reconcile speaker labels.
- [Transcript review](workflows/transcript-review/overview.md): export review packets and apply source-bound text edits offline.
- [Transcript videos](workflows/transcript-video/overview.md): render video from saved transcripts and audio.

## STT Pricing

The 2026-09-07 pricing check lists AssemblyAI Universal-3.5 Pro at $0.21/hour plus $0.02/hour for diarization ($0.23/hour by default); disabling diarization removes the add-on. Deepgram Nova-3 monolingual prerecorded audio is $0.0043/minute ($0.258/hour), with diarization included. Estimates use these prerecorded rates, not streaming promotions. [AssemblyAI pricing](https://www.assemblyai.com/pricing), [Deepgram pricing](https://deepgram.com/pricing).

- **Happy Scribe**: Estimated at `$0.01/min` from audio duration.
- **Supadata**: Reference rate of `$10 / 1,000 credits` (`1.00 cent/credit`). Native transcripts estimate 1 credit per request; generated transcripts estimate ~2 credits/min. `auto` mode estimates the higher rate.
- **ScrapeCreators**: Reference rate of `$47 / 25,000 credits` (`0.188 cents/request`), charging per retrieval request regardless of duration.
- **Duration-priced hosted providers** (AssemblyAI, Deepgram, DeepInfra, Gladia, Grok STT, Mistral, Soniox, Speechmatics, Together): Estimated based on media duration and published provider per-hour rates.
- **Token-priced providers** (Gemini STT): Estimated from media duration at 32 audio tokens per second; completed runs record the token usage the API returns.

## STT Notes

- Supadata and ScrapeCreators require a public source URL. Other hosted providers transcribe from the input audio.
- Single-provider runs write root `transcription.txt` and `result.json`. Multi-provider runs write outputs per provider under `providers/<service>-<model>/`.
- `--youtube-captions` is English-only and applies to YouTube inputs. When captions are found, hosted STT providers are skipped.
- STT batch roots include `manifest.json` with item status.
- Backfill existing STT outputs with top-level [`resume`](../00-setup-and-utilities/resume.md).

See the [model report](../../reports/model-refresh-stt.md) for historical model changes and the [testing guide](tests.md) for verification coverage.
