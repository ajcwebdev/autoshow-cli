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

See the [`extract` overview](../overview.md) for input routing and default media transcription.

On `extract` and `resume`, pass `--provider provider[=model]`. On `setup`, persist defaults with `--stt provider[=model]`. Omit the model to select that provider's cheapest supported model. Repeat `--provider` to run several models, including more than one model from the same provider.

## Provider Capabilities

| Group                                                                | Providers                                                                 |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [Local](local/overview.md)                                           | Whisperfile                                                               |
| [Diarization](diarization/overview.md)                               | AssemblyAI, Deepgram, Gemini, Gladia, Grok, Mistral, Soniox, Speechmatics |
| [Diarization off by default](diarization-off-by-default/overview.md) | Cloudflare, DeepInfra, OpenAI, Together                                   |

See each subgroup for selectors, examples, and per-model capabilities. Public media URL transcripts (ScrapeCreators) and YouTube caption fallback live under [URL extraction](../url/overview.md#public-media-url-transcripts).

## STT Environment

| Provider     | Required env                                    |
| ------------ | ----------------------------------------------- |
| AssemblyAI   | `ASSEMBLYAI_API_KEY`                            |
| Cloudflare   | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` |
| Deepgram     | `DEEPGRAM_API_KEY`                              |
| DeepInfra    | `DEEPINFRA_API_KEY`                             |
| Gemini STT   | `GEMINI_API_KEY`                                |
| Gladia       | `GLADIA_API_KEY`                                |
| Grok STT     | `XAI_API_KEY`                                   |
| Mistral      | `MISTRAL_API_KEY`                               |
| OpenAI STT   | `OPENAI_API_KEY`                                |
| Soniox       | `SONIOX_API_KEY`                                |
| Speechmatics | `SPEECHMATICS_API_KEY`                          |
| Together     | `TOGETHER_API_KEY`                              |

## Shared STT Options

New asynchronous transcription jobs have a completion deadline of 30 minutes to 2 hours, scaled with audio duration. A timeout preserves the remote job for recovery with `resume`.

| Flag                                   | Description                                                                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--all-providers`                      | Run every broadly applicable hosted STT model for this input.                                                                                    |
| `--youtube-captions`                   | Prefer English YouTube captions before STT when they are available. See [YouTube Caption Fallback](../url/overview.md#youtube-caption-fallback). |
| `--stt-audio-profile <profile>`        | Audio preparation: `default` (provider compression) or `lossless` (verified float32 WAV, original channels and rate).                            |
| `--speaker-count <n>`                  | Speaker-count hint for diarization services that accept it.                                                                                      |
| `--split`                              | Request segments of up to 30 minutes; provider limits may shorten them. Oversized inputs also split automatically.                               |
| `--batch-limit <n\|all>`               | Limit the batch, or pass `all` to process every item.                                                                                            |
| `--batch-order <newest\|oldest>`       | Choose batch ordering.                                                                                                                           |
| `--batch-concurrency <n>`              | Batch items to process at once. Default `7`.                                                                                                     |
| `--provider-concurrency <n>`           | Hosted provider and model targets to run at once for one item. Default `7`.                                                                      |
| `--step-concurrency stt-segment=<n>`   | Split segments in flight per provider. Default `7`. Local providers and Mistral stay at `1`.                                                     |
| `--step-concurrency stt-preflight=<n>` | Media-duration checks to run at once before transcription. Default `7`.                                                                          |
| `--concurrency-mode <ramp\|immediate>` | Start hosted work at one in-flight request and raise it while work is waiting (`ramp`, default), or start at the configured cap (`immediate`).   |
| `--price`                              | Print the aggregated estimate and exit.                                                                                                          |
| `--max-model-cents <n>`                | Skip each provider and model whose estimate for this run is above this many cents. Works with or without `--price`.                              |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/2-video.mp4 --provider deepgram=nova-3 --split
```

## Provider Controls

`--diarization` and `--no-diarization` apply to AssemblyAI, Deepgram, Gemini, Gladia, Grok, Mistral, Soniox, Speechmatics, and Together. Together defaults off; `--speaker-count` enables it unless `--no-diarization` is set. `--speaker-count` applies to AssemblyAI, Gladia, and Together, and has no effect while diarization is off. Mistral diarization uses segment timing; turn it off when you need native word timestamps. Together Parakeet word timings can be incomplete. Gemini ignores `--speaker-count`, and its word timestamps can reduce accuracy. Providers that do not support the toggle report that it was ignored. Hide speaker labels in exported captions with `--no-caption-speakers`.

Split transcripts scope speaker labels as `chunk-N/speaker-ID`; matching IDs across chunks do not establish the same person. Use the [speaker reconciliation workflow](workflows/timing/overview.md#reconcile-speakers-across-chunks-or-channels) to apply reviewed identities. `resume` rejects a diarization, speaker-count, response-format, or verbatim change that would reuse incompatible results.

`--native-subtitles` saves provider subtitle files from the same job: AssemblyAI SRT/VTT, Gladia SRT/VTT, Speechmatics SRT, and whisperfile SRT/VTT/LRC when supported by the installed executable. Single-file exports are named `transcription.native.srt`, `.vtt`, or `.lrc`; split exports use segment-specific paths and provider-relative timestamps. Export the combined `result.json` for a full-recording timeline. Hosted exports may draw on provider quota. A failed export preserves the transcript, and resume keeps completed targets; export any missed captions locally from the saved result.

DeepInfra defaults to verbose JSON; native word timing depends on the model. `--stt-response-format deepinfra=srt` or `deepinfra=vtt` selects a subtitle response instead. Prefer a model with native word timing and verbose JSON plus local caption export when you need word-level evidence.

`--stt-verbatim grok=true` turns off display formatting and requests filler words. Diarization, native subtitles, Grok verbatim, and the DeepInfra response format are stored with the STT configuration and applied again by `resume`.

## Workflows

- [Captions](workflows/captions/overview.md): export saved evidence, format subtitles, and embed tracks in video containers.
- [Timing and speakers](workflows/timing/overview.md): compare timing, force-align text, calibrate Whisper, split or merge channels, and reconcile speaker labels.
- [Transcript review](workflows/transcript-review/overview.md): export review packets and apply source-bound text edits offline.
- [Transcript videos](workflows/transcript-video/overview.md): render video from saved transcripts and audio.

## STT Pricing

Per-model hourly estimates are in each subgroup capability table. `--price` prints this invocation's estimate and exits.

AssemblyAI estimates include a diarization add-on that `--no-diarization` removes; Deepgram Nova-3 includes diarization at the same rate. See [AssemblyAI pricing](https://www.assemblyai.com/pricing) and [Deepgram pricing](https://deepgram.com/pricing).

Estimates use media duration and the selected model's rate, including applicable minimum billing. Gemini's final cost uses token usage when available.

## STT Notes

- A single provider writes `transcription.txt` and `result.json` in the run directory. Several providers write each target under `providers/<service>-<model>/`.
- Batch runs write `manifest.json` with each item's status.
- Fill in missing STT outputs with [`resume`](../../00-setup-and-utilities/resume.md).
