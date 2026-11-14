# extract STT

Transcribe media with hosted or local engines, then reuse saved evidence for captions, transcript review, timing, and speaker workflows. See [extract routing](../overview.md) for inputs.

Use `--provider provider[=model]` on `extract`/`resume`, or `setup --stt provider[=model]` for saved defaults. Omission of a model uses the provider's resolved default. Repeat selectors for multiple providers or models.

```bash
bun autoshow extract input/examples/audio/1-audio.mp3 --provider whisperfile=tiny
bun autoshow extract input/examples/audio/1-audio.mp3 --provider assemblyai=universal-3-5-pro --diarization --price
```

## Provider Capabilities

- [Local](local/overview.md): Whisperfile.
- [Diarization enabled by default](diarization/overview.md): AssemblyAI, Deepgram, Gemini, Gladia, Grok, Mistral, Soniox, Speechmatics.
- [Diarization off/unavailable by default](diarization-off-by-default/overview.md): Cloudflare, DeepInfra, OpenAI, Together.

These guides describe configured CLI support, not live account entitlement or measured transcription accuracy. [URL extraction](../url/overview.md#public-media-url-transcripts) covers ScrapeCreators and YouTube caption fallback.

## STT Environment

Hosted engines require their corresponding key:

- `ASSEMBLYAI_API_KEY`, `DEEPGRAM_API_KEY`, `DEEPINFRA_API_KEY`, `GEMINI_API_KEY`, `GLADIA_API_KEY`, `XAI_API_KEY`.
- `MISTRAL_API_KEY`, `OPENAI_API_KEY`, `SONIOX_API_KEY`, `SPEECHMATICS_API_KEY`, `TOGETHER_API_KEY`.
- Cloudflare: both `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

## Shared STT Options

- `--all-providers`: broadly applicable hosted models for the input; `--all-local`: local engines.
- `--stt-audio-profile default|lossless`: provider compression by default, or verified float32 WAV retaining original channels/rate.
- `--split`: segments up to 30 minutes; provider limits can shorten them, and oversized inputs split automatically.
- `--batch-limit N|all`, `--batch-order newest|oldest`, `--batch-concurrency N`: defaults `5`, `newest`, `7`.
- `--provider-concurrency N`: hosted targets per item, default `7`; `--local-concurrency N` caps local targets.
- `--step-concurrency stt-segment=N` and `stt-preflight=N`: segment and duration-probe caps, default `7`; local/Mistral segment work stays at `1`.
- `--concurrency-mode ramp|immediate`: default ramp starts at one hosted request and increases while work waits.
- `--price`: aggregate estimate without transcription; `--max-model-cents N`: omit targets above the per-model estimate ceiling, with or without `--price`.
- `--youtube-captions`: try English captions before STT; see [fallback behavior](../url/overview.md#youtube-caption-fallback).

New asynchronous jobs have duration-scaled completion deadlines of 30 minutes to 2 hours. Timeouts preserve known jobs for `resume`.

## Provider Controls

`--diarization`/`--no-diarization` toggle supported engines. Together defaults off; `--speaker-count N` enables it unless explicitly disabled. The count hint applies only to AssemblyAI, Gladia, and Together, and only while diarization is on. Unsupported toggles are reported as ignored.

Mistral returns segments with diarization and native words without it. Together Parakeet may return incomplete words. Gemini ignores speaker-count hints; requesting words can affect accuracy. Speaker IDs from different chunks are scoped `chunk-N/speaker-ID`, not verified identities; apply a [reviewed map](workflows/timing/overview.md#reconcile-speakers-across-chunks-or-channels) before treating them as the same person.

`--native-subtitles` reuses the current job/inference: AssemblyAI and Gladia SRT/VTT, Speechmatics SRT, installed Whisperfile SRT/VTT/LRC. Files use `transcription.native.*`; split exports have segment-relative times. Provider exports may consume quota. Export failures retain transcription; recover locally from combined `result.json` rather than retranscribing.

`--stt-response-format deepinfra=srt|vtt` chooses subtitle responses instead of default verbose JSON, losing native-word evidence. `--stt-verbatim grok=true` requests fillers without display formatting. Resume retains these controls, diarization, and subtitle configuration, rejecting incompatible changes to reusable work.

## Workflows

- [Captions](workflows/captions/overview.md): local export and video-track embedding.
- [Timing and speakers](workflows/timing/overview.md): alignment, comparison, calibration, channels, and reviewed speaker maps.
- [Transcript review](workflows/transcript-review/overview.md): source-bound text edits.
- [Transcript videos](workflows/transcript-video/overview.md): local rendering from saved audio/transcripts.

## STT Pricing

Use `--price` for current selected models, duration, minimum billing, and options. Estimates are not invoices. AssemblyAI's diarization add-on is removed with `--no-diarization`; Deepgram's configured rate includes it. Gemini records usage-based cost when returned.

## STT Notes

Single-provider runs write `transcription.txt` and `result.json` at the run root; multi-provider targets use `providers/<service>-<model>/`. Canonical manifests record item/provider state. Use [resume](../../00-setup-and-utilities/resume.md) to fill missing outputs without discarding purchased results.
