# extract STT

Transcribe media with hosted or local speech-to-text engines. Saved results support caption export, transcript review, and local timing and speaker workflows.

## Outline

- [STT Environment](#stt-environment)
- [Shared STT Options](#shared-stt-options)
- [Caption Export](#caption-export)
- [Local Timing and Speaker Workflows](#local-timing-and-speaker-workflows)
  - [Compare saved word timing](#compare-saved-word-timing)
  - [Force-align supplied text locally](#force-align-supplied-text-locally)
  - [Calibrate installed Whisper timing](#calibrate-installed-whisper-timing)
  - [Preserve and transcribe separate channels](#preserve-and-transcribe-separate-channels)
  - [Reconcile speakers across chunks or channels](#reconcile-speakers-across-chunks-or-channels)
- [Transcript Videos](#transcript-videos)
- [STT Services](#stt-services)
  - [AssemblyAI](#assemblyai)
  - [Deepgram](#deepgram)
  - [DeepInfra](#deepinfra)
  - [Gemini STT](#gemini-stt)
  - [Gladia](#gladia)
  - [Grok STT](#grok-stt)
  - [Happy Scribe](#happy-scribe)
  - [Mistral](#mistral)
  - [ScrapeCreators](#scrapecreators)
  - [Soniox](#soniox)
  - [Speechmatics](#speechmatics)
  - [Supadata](#supadata)
  - [Together](#together)
- [STT Pricing](#stt-pricing)
- [STT Notes](#stt-notes)
- [Provider Capabilities](#provider-capabilities)
  - [Diarization](#diarization)
  - [Diarization Off by Default](#diarization-off-by-default)
  - [Direct URL](#direct-url)

See the [`extract` overview](./01-extract.md) for input routing and default media transcription. Hosted STT is selected with `--provider`.

`--provider` selectors accept an omitted model value and then resolve to the cheapest or default supported model. Model-selecting selectors are repeatable, including repeated selectors from the same provider.

On `extract` and `resume`, pass `--provider provider[=model]`. On `config`, pass `--stt provider[=model]`.

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

## Caption Export

Generate captions directly from an audio or video file with `--captions`. The selected STT model runs once; caption export uses its saved timing evidence and writes `captions.srt`, `captions.vtt`, and `captions.json` beside `result.json`. Multiple providers each get captions in their own provider directory. This also works with media URLs, media batches, split transcription, and the YouTube caption-first path. Normal provider pricing applies to transcription; local caption generation adds no provider call. `--price` estimates transcription without running it.

```bash
bun autoshow extract audio.mp3 --provider deepinfra --captions
bun autoshow extract video.mp4 --provider deepinfra --captions --caption-mode word --output-dir output/video-captions
bun autoshow extract interview.mp4 --provider deepgram=nova-3 --diarization --captions --caption-format vtt
```

Caption formatting is validated before transcription. If caption generation fails, the completed transcript and evidence remain available; retry the saved-result command below to adjust captions without paying for transcription again.

Export locally from a provider's saved `result.json`, or a directory containing that file. This path needs no audio, model, API credentials, or video rendering. Use a new `--output-dir` for each layout; existing caption files are protected from overwrite.

```bash
bun autoshow extract output/<run>/providers/<provider-model>/result.json --captions --output-dir output/captions-phrases
bun autoshow extract --captions --transcript-result output/<run>/providers/<provider-model>/result.json --caption-mode word --caption-format vtt --no-caption-speakers --output-dir output/captions-words
```

| Flag | Behavior |
| --- | --- |
| `--caption-format srt\|vtt\|both\|ass\|ttml\|lrc\|all` | Defaults to SRT and VTT (`both`). `all` writes all five formats. |
| `--caption-mode phrase\|word` | Defaults to readable phrases. Word mode emits one evidence word/token span per cue. A provider-formatted multiword span retains its original bounds. |
| `--no-caption-speakers` | Hides speaker prefixes in the exported files without changing provider evidence. |
| `--caption-max-words`, `--caption-max-characters` | Phrase grouping budgets; defaults are 10 words and 58 characters. Indivisible words can exceed a character budget. |
| `--caption-max-duration`, `--caption-break-gap` | Cue-duration and silence-gap budgets in seconds; defaults are 5 and 0.9. Native word boundaries are preserved. |
| `--caption-line-width`, `--caption-max-lines` | Defaults are 42 characters and 2 lines. Long words and added speaker prefixes can exceed these layout budgets. |
| `--caption-max-cps` | Reading-speed threshold, default 20 characters/second. Violations are recorded without moving measured word timing. |

The export includes `captions.json` with timing quality, inferred-word counts, invalid-word counts, layout warnings, and cue boundaries. Partial word evidence falls back only for uncovered timed text. Text with no usable timed word or segment causes an actionable error. Segment-only providers can produce word-mode cues through explicit interpolation, reported as estimated timing. Gemini timing remains generated; YouTube inline timestamps remain caption spans. Millisecond serialization does not establish millisecond acoustic accuracy.

ASS and LRC store centiseconds; LRC stores cue starts without ends. The JSON sidecar retains full ranges and records those format limits. TTML preserves millisecond ranges, Unicode text, and explicit line breaks. ASS rejects literal braces or ASS control sequences in transcript text because they cannot be safely preserved as plain display text; choose SRT, VTT, or TTML for those transcripts. Every format uses the same coverage-checked timeline, and exports preserve existing files. [TTML specification](https://www.w3.org/TR/ttml1/), [ASS format guide](https://github.com/libass/libass/wiki/ASS-File-Format-Guide).

### Export aligned or reconciled captions

Use the saved `result.json` from [local alignment or speaker reconciliation](#local-timing-and-speaker-workflows) with the same caption exporter. Confidence-related provenance remains in the source result.

```bash
bun autoshow extract output/aligned/result.json --captions --caption-mode word --caption-format all --output-dir output/aligned-captions --json
```

### Provider controls

`--diarization` and `--no-diarization` control AssemblyAI, Deepgram, Gladia, Grok, Mistral, Soniox, Speechmatics, and Together. Defaults remain provider-specific; Together is off unless enabled or given a speaker count. `--speaker-count` is supported by AssemblyAI, Gladia, and Together and is ignored when diarization is explicitly disabled. Together sends matching minimum/maximum speaker bounds. Capability resolution is model-aware: Together Whisper has documented diarization, and Parakeet's diarization was live-tested on a two-speaker sample on 2026-09-10. That Parakeet response contained 24 speaker-labeled word entries, including 12 zero-length intervals; caption export preserved all text and reported 12 inferred timings. This confirms endpoint compatibility, not acoustic accuracy or uniformly usable native boundaries. Mistral warns that diarization uses segment timing; disable diarization for native words. Gemini supports optional generated speaker hypotheses; these are not acoustically aligned speaker measurements. Unsupported providers, including Happy Scribe's undocumented off switch, report the ignored toggle. Hide their labels at export with `--no-caption-speakers`.

Chunked diarized results scope speaker labels as `chunk-N/speaker-ID`. The same numeric speaker in two independently transcribed chunks is not assumed to be the same person. Raw chunk evidence and source offsets survive save/load. Resume rejects changes to transcription-affecting settings instead of silently reusing incompatible results.

`--native-subtitles` opts into native artifacts from the same inference or completed job: AssemblyAI SRT/VTT; Gladia SRT/VTT; Happy Scribe SRT/VTT; Speechmatics SRT; whisper.cpp/whisperfile SRT/VTT/LRC. Local engines probe their installed help before enabling optional flags and save invocation/model/help provenance in `transcription.engine.json`. Native artifacts are named `transcription.native.srt/vtt` (with segment suffixes for split jobs) and retain provider-relative timestamps within split chunks. Use local export of the combined `result.json` for a full-recording timeline. Hosted exports may consume requests, quota, or provider credits. Export failures create separate error artifacts and retain structured transcription evidence. Adding this option when resuming an already successful target does not trigger another transcription or retroactively fetch exports; use local re-export for those results.

DeepInfra defaults to verbose JSON with words and segments. `--deepinfra-stt-response-format srt|vtt` explicitly selects a native text response in one inference request, preserving subtitle cue timing instead of word evidence. It never retranscribes simply to fetch a second format. Prefer verbose JSON plus local export when precise word evidence matters.

Grok's `--stt-grok-verbatim` disables display formatting and requests filler words. Supadata's `--stt-supadata-chunk-size <characters>` controls chunk readability; it does not add word alignment. These options, diarization, native subtitles, and DeepInfra response format are supported in persistent STT configuration and resume.

## Local Timing and Speaker Workflows

These `extract` operations work with local audio and saved `result.json` files. They never submit a hosted provider request. Each operation supports `--json`, `--output-dir`, and zero-provider-cost `--price`; run operations separately and use a fresh output directory. Provider and caption options are rejected on timing operations. Failed operations preserve completed artifacts and working files for inspection.

### Compare saved word timing

```bash
bun autoshow extract output/candidate/result.json --timing-reference output/reference/result.json --output-dir output/timing-comparison --json
```

`timing-comparison.json` records ordered lexical matches, reference and candidate coverage, unmatched word indices, absolute start/end differences (median, p95, maximum), the fraction of matched words with both boundaries within 50/100/250 ms, signed drift by minute, timing provenance, and exact canonical speaker-label agreement. Coverage uses all words; boundary statistics use matched words. These tolerance bands are evaluation settings, not accuracy promises. Empty or invalid word intervals are rejected rather than interpolated for measurement.

Compare matching excerpts when transcripts diverge substantially. Lexical matching preserves order and repeated words but does not infer where an excerpt belongs in a longer candidate. Divergent comparisons are bounded to 20 million alignment cells; identical text uses a linear path. Speaker scores require matching canonical labels, so reconcile reviewed identities first when providers or chunks use different labels.

The report preserves the reference's provenance and identifies references lacking provenance as unverified. It measures agreement with that reference. Automatic alignment, provider confidence, or millisecond timestamp storage cannot independently establish acoustic accuracy. A manually verified reference is still needed for a defensible acoustic accuracy claim.

### Force-align supplied text locally

The optional backend uses a local Wav2Vec2 CTC model. The verified setup below uses the English `facebook/wav2vec2-base-960h` model and 16 kHz mono audio. Model inference and alignment run locally; explicit setup downloads public packages and model weights. The transcription command never downloads a model or executes remote model code. [Official model card](https://huggingface.co/facebook/wav2vec2-base-960h).

Run setup once if the runtime is absent:

```bash
uv venv --python 3.12 runtime/venvs/stt-alignment
uv pip install --python runtime/venvs/stt-alignment/bin/python -r scripts/stt-alignment-requirements.txt
runtime/venvs/stt-alignment/bin/python - <<'PY'
from huggingface_hub import snapshot_download
snapshot_download(
    repo_id="facebook/wav2vec2-base-960h",
    revision="22aad52d435eb6dbaf354bdad9b0da84ce7d6156",
    local_dir="runtime/models/alignment/wav2vec2-base-960h",
    allow_patterns=["*.json", "model.safetensors"],
    token=False,
)
PY
```

Supply a saved transcript whose segments cover its complete text. Each segment must have a positive, non-overlapping range of at most 30 seconds in the input audio's timeline. A minimal transcript has this shape:

```json
{
  "text": "Hello there.",
  "segments": [
    { "start": "00:00:01.000", "end": "00:00:02.500", "text": "Hello there.", "speaker": "Host" }
  ]
}
```

```bash
bun autoshow extract audio.wav --align-transcript output/reviewed/result.json --alignment-model runtime/models/alignment/wav2vec2-base-960h --alignment-python runtime/venvs/stt-alignment/bin/python --output-dir output/aligned --json
```

The command decodes each supplied segment from the first audio stream to mono PCM16 at 16 kHz, computes CTC log probabilities, and finds a monotonic alignment with blank transitions between repeated labels. Word ranges derive from occupied acoustic frames. Original spelling and punctuation remain display text, including standalone punctuation attached to an adjacent word; unsupported letters or numerals fail explicitly. Spell numbers as spoken in the supplied text when the vocabulary cannot represent digits. Do not omit unheard or unsupported words merely to obtain a successful alignment. Other languages require an appropriate locally installed character-vocabulary CTC model and their own validation; this setup establishes English support only. [CTC alignment method](https://github.com/pytorch/audio/blob/main/examples/tutorials/forced_alignment_tutorial.py).

The aligner cannot restore missing transcript content, adjudicate wording, separate overlapping mono speech, or infer speakers. Edit the transcript from the recording when needed; separate channels before alignment when different voices have isolated channels. Speaker labels are inherited from the supplied segments. Timing is relative to the supplied audio, with each segment offset applied once. A source video's additional audio offset must be handled separately when exporting captions.

`--alignment-min-confidence` defaults to `0.1`. A word below the requested threshold prevents publication of `result.json`; `alignment.json` and `alignment-work/` remain available. Confidence summarizes model emission scores and is not a calibrated probability that the word or boundary is correct. Exploratory automatic references can explicitly lower the threshold; all words below `0.1` remain listed as low-confidence even when accepted. A high score does not turn an automatic reference into verified ground truth.

Successful output contains `result.json`, `alignment.json`, and retained clips/emissions under `alignment-work/`. Source transcript and audio SHA-256 fingerprints, model-file hashes, runtime version, preprocessing, and confidence decisions are recorded. Original provider evidence is retained as chunk evidence. New timing is marked `aligned`, with `hasNativeWordTiming: false` and `referenceProvenance.manuallyVerified: false`.

### Calibrate installed Whisper timing

```bash
bun autoshow extract audio.wav --calibrate-whisper --timing-reference output/aligned/result.json --whisper-engine whisper --whisper-calibration-model tiny --output-dir output/whisper-calibration --json
bun autoshow extract audio.wav --calibrate-whisper --timing-reference output/aligned/result.json --whisper-engine whisperfile --whisper-calibration-model tiny --output-dir output/whisperfile-calibration --json
```

The engine defaults to `whisper` and the model to `tiny`. Both must already be installed. Calibration runs standard timing and, when the executable advertises support, the model's DTW preset. A recorded reference audio fingerprint must match the input. Each variant retains raw JSON, normalized results, native subtitle artifacts supported by that executable, and command/model/help provenance. Unsupported DTW is recorded without turning a successful standard run into a failure. Invalid word boundaries or DTW centers exclude that variant from ranking and are recorded under `rejectedVariants`; remaining variants can still be measured. If none can be measured, the command saves its diagnostics and fails. It never repairs an invalid standard interval merely to produce a score.

Whisper DTW returns token centers, expressed in native centiseconds. The comparison derives intervals from adjacent-center midpoints and marks those word boundaries `repaired`; they are not native measured word start/end pairs. `calibration.json` ranks variants by lexical coverage, then combined median start/end difference, and records elapsed local runtime. It never changes transcription defaults, and it makes no recommendation when no words match. A result applies only to the selected reference, engine, model, and executable version. [Whisper CLI implementation](https://github.com/ggml-org/whisper.cpp/blob/master/examples/cli/cli.cpp).

### Preserve and transcribe separate channels

```bash
bun autoshow extract stereo.wav --split-channels --output-dir output/channels --json
```

Every audio stream is inspected. Inputs must contain at least two channels in total, with at most 16 channels per stream. Each channel is saved as float32 PCM WAV at its original sample rate. Decoded sample SHA-256 verification checks that extraction preserved that channel exactly. `channels.json` records stream/channel identity, source offsets, and hashes; `channel-results.json` is a template for associating completed transcripts with those channels.

Audio channel identity is not speaker identity. Stereo channels may contain the same mix, as in the existing one-minute example recording, and cannot then separate people. No general mono speaker-clustering capability is implied.

Transcribe the separated files with an already installed local engine:

```bash
bun autoshow extract output/channels/stream-0-channel-1.wav --provider whisper=tiny --output-dir output/channel-1 --json
bun autoshow extract output/channels/stream-0-channel-2.wav --provider whisper=tiny --output-dir output/channel-2 --json
```

Fill each template entry's `result` with that channel's saved `result.json` path. Absolute paths are accepted; relative paths resolve from the manifest directory. Keep `offsetSeconds` from extraction unless you have independently established another source timeline. Then merge:

```bash
bun autoshow extract output/channels/channel-results.json --merge-channel-results --output-dir output/channel-merge --json
```

The merge validates full text coverage and usable timing, applies each channel's source offset once, sorts events chronologically while preserving overlaps, and scopes speaker labels by channel. Original raw evidence, per-channel source fingerprints, and applied offsets remain available. Already merged channel results are rejected to prevent accidental repeated offset application. Each original channel should appear only once; duplicate audio or cross-talk is not automatically deduplicated.

### Reconcile speakers across chunks or channels

```bash
bun autoshow extract output/channel-merge/result.json --speaker-map-template --output-dir output/speaker-review --json
```

Edit the generated `speaker-map.json`: keep `schemaVersion` and `sourceSha256`, give `reason` a nonempty review explanation, and map exact existing labels to canonical labels. For example, reviewed evidence may justify mapping `chunk-1/speaker-0` and `chunk-2/speaker-1` to the same `Host` label. Matching numeric IDs, chronology, or similar wording alone does not establish that identity. Leave uncertain labels separate.

```bash
bun autoshow extract output/channel-merge/result.json --speaker-map output/speaker-review/speaker-map.json --output-dir output/reconciled --json
```

The source fingerprint prevents applying a map to a different result. Unknown source labels and empty targets are rejected. Only explicitly mapped labels change in normalized words, segments, and applicable chunk evidence; original raw responses and the source file remain unchanged. `speaker-reconciliation.json` records the map, source, and review reason. This is explicit reconciliation, not automatic acoustic speaker identification.

Use [caption export](#export-aligned-or-reconciled-captions) to turn the aligned or reconciled result into subtitle files.

## Transcript Videos

`extract --transcript-video` renders a 1920x1080 MP4 from existing STT artifacts without calling an STT provider. Pass a completed media extract directory, or explicit `--audio` with `--transcript-result` or `--transcript-text`. Cues use per-word timings when available, otherwise segment timestamps or speaker lines.

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
| Models      | `universal-3-5-pro`                      |
| Diarization | Supported; accepts `--speaker-count <n>` |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider assemblyai
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider assemblyai=universal-3-5-pro --speaker-count 2
```

Bare `--provider assemblyai` defaults to `universal-3-5-pro`.

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

Gemini 3.8 Flash is available as `gemini-3.8-flash` for writing/OCR (`gemini`) and prompted audio extraction (`gemini-stt`), with existing selectors and defaults preserved. Writing and OCR support low/medium/high reasoning; minimal and disabled are rejected. STT uses the provider default thinking level (medium), without a reasoning override. Requests omit legacy sampling controls; the transport rejects incompatible 3.8 settings before dispatch. Audio timestamps remain generated, with no native word alignment claim.

Pricing checked 2026-09-08: introductory $0.75/$3.75 per million input/output tokens through 2026-12-31, then $1.50/$7.50 starting 2027-01-01. AutoShow follows its existing conservative policy and uses the standard rates for estimates and usage-based cost calculations even during the introductory window. Automatic date transitions are unsupported; recheck the tariff and refresh all three price paths by 2027-01-01. STT uses a $0.1728/hour audio-input baseline (32 tokens/second), then accounts for prompt, candidate and thinking tokens from returned usage. OCR page and writing/STT latency heuristics are reused and provisional; caching and discounted service tiers are excluded.

Sources: [model specification](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash), [migration guide](https://ai.google.dev/gemini-api/docs/latest-model?hl=en), [pricing](https://ai.google.dev/gemini-api/docs/pricing).

| Option   | Value                         |
| -------- | ----------------------------- |
| Selector | `--provider gemini[=<model>]` |
| Models   | `gemini-3.8-flash`, `gemini-3.6-flash`            |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider gemini
```

### Gladia

| Option      | Value                                    |
| ----------- | ---------------------------------------- |
| Selector    | `--provider gladia[=<model>]`            |
| Models      | `solaria-3`                              |
| Diarization | Supported; accepts `--speaker-count <n>` |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider gladia=solaria-3
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider gladia --speaker-count 2
```

Bare `--provider gladia` selects `solaria-3`. `solaria-3` is English, French, German, Spanish, and Italian only. Enterprise plans can raise duration to 4 hours 15 minutes.

### Grok STT

| Option      | Value                       |
| ----------- | --------------------------- |
| Selector    | `--provider grok[=<model>]` |
| Models      | `speech-to-text`            |
| Diarization | Enabled by default          |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider grok=speech-to-text
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

Voxtral Mini Transcribe 2 supports up to 500 MB and ~3 hours of audio per request.

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

Retrieves existing YouTube transcripts.

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
| Models      | `melia-1`                           |
| Diarization | Enabled by default                  |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider speechmatics=melia-1
```

Bare `--provider speechmatics` selects `melia-1` (multilingual).

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

Bare `--provider together` defaults to `nvidia/parakeet-tdt-0.6b-v3`.

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
- Backfill existing STT outputs with top-level [`resume`](../../setup-and-utilities/resume/resume.md).

## Provider Capabilities

Marks: ✅ supported, ⚠️ partial or qualified, ❌ not exposed. Released dates are provider announcement or model-origin dates. Recency marks: current-year GA is ✅, older still-current snapshots are ⚠️, and pre-2026 engines are ❌. Rows are newest first.

Duration uses the same marks: under 2 hours is ❌, 2–4 hours is ⚠️, 5+ hours or no documented cap is ✅. File size uses ❌ under 100 MiB, ⚠️ 100 MiB to under 1 GiB, and ✅ 1 GiB or no cap.

Pricing is the AutoShow estimate rate. Cost rank orders models cheapest-first within each table (1 = cheapest) and ties share a rank. Hosted tables rank on the per-hour rate; the Direct URL table ranks on per-request retrieval cost.

### Diarization

| Provider                       | Released      | Diarization            | Speaker count        | Word timestamps            | Transcript cleanup                  | Duration              | File size            | Pricing   | Cost rank |
| ------------------------------ | ------------- | ---------------------- | -------------------- | -------------------------- | ----------------------------------- | --------------------- | -------------------- | --------- | --------- |
| AssemblyAI `universal-3-5-pro` | ✅ 2026-07-07 | ✅ Speaker labels      | ✅ `--speaker-count` | ✅ Native words            | ❌ None                             | ✅ 10 hours           | ✅ 2.2 GiB upload    | $0.23/hr  | 5/8       |
| Speechmatics `melia-1`         | ✅ 2026-06-17 | ✅ Speaker diarization | ❌ Not exposed       | ✅ Native words            | ⚠️ Punctuation included             | ✅ No documented cap  | ✅ 1 GiB             | $0.129/hr | 3/8       |
| Soniox `stt-async-v5`          | ✅ 2026-06-11 | ✅ Speaker diarization | ❌ Not exposed       | ✅ Native words            | ⚠️ Smart formatting included        | ✅ 5 hours            | ⚠️ 500 MiB           | $0.10/hr  | 1/8       |
| Gladia `solaria-3`             | ✅ 2026-06-10 | ✅ Speaker labels      | ✅ `--speaker-count` | ✅ Native words            | ❌ None                             | ⚠️ 2 hours 15 minutes | ⚠️ 1000 MiB          | $0.61/hr  | 8/8       |
| Grok `speech-to-text`          | ✅ 2026-05    | ✅ Speaker diarization | ❌ Not exposed       | ✅ Native words            | ✅ Formatting                       | ✅ No documented cap  | ⚠️ 500 MiB           | $0.10/hr  | 1/8       |
| Mistral `voxtral-mini-2602`    | ✅ 2026-02-04 | ✅ Speaker diarization | ❌ Not exposed       | ✅ Native words without diarization | ❌ None                             | ⚠️ ~3 hours           | ⚠️ 500 MiB           | $0.12/hr  | 2/8       |
| Deepgram `nova-3`              | ⚠️ 2025-02-12 | ✅ Speaker diarization | ❌ Not exposed       | ✅ Native words            | ✅ Punctuation and smart formatting | ✅ No documented cap  | ✅ 2 GiB             | $0.258/hr | 6/8       |
| Happy Scribe `auto`            | ❌ 2017       | ✅ Speaker labels      | ❌ Not exposed       | ⚠️ Words when available    | ❌ None                             | ✅ No documented cap  | ✅ No documented cap | $0.60/hr  | 7/8       |

### Diarization Off by Default

| Provider                                  | Released      | Word timestamps            | Duration             | File size                 | Pricing   | Cost rank |
| ----------------------------------------- | ------------- | -------------------------- | -------------------- | ------------------------- | --------- | --------- |
| Gemini `gemini-3.6-flash`                 | ✅ 2026-07    | ❌ Segment timestamps only | ✅ No documented cap | ❌ 20 MiB / 2 GiB         | $0.173/hr | 5/5       |
| Together `nvidia/parakeet-tdt-0.6b-v3`    | ⚠️ 2025-08-14 | ✅ Native words | ⚠️ 4 hours           | ⚠️ 500 MiB                | $0.09/hr  | 3/5       |
| DeepInfra `openai/whisper-large-v3-turbo` | ❌ 2024-09    | ✅ Native words | ✅ No documented cap | ✅ No documented cap      | $0.012/hr | 1/5       |
| DeepInfra `openai/whisper-large-v3`       | ❌ 2023-11    | ✅ Native words | ✅ No documented cap | ✅ No documented cap      | $0.027/hr | 2/5       |
| Together `openai/whisper-large-v3`        | ❌ 2023-11    | ✅ Native words | ⚠️ 4 hours           | ❌ 20 MiB                 | $0.09/hr  | 3/5       |

### Direct URL

Supadata and ScrapeCreators transcribe from the original public source URL.

| Provider                            | Released   | YouTube | Other page URLs                                      | Word timestamps       | Transcript cleanup                | Duration             | File size           | Pricing                                   | Cost rank |
| ----------------------------------- | ---------- | ------- | ---------------------------------------------------- | --------------------- | --------------------------------- | -------------------- | ------------------- | ----------------------------------------- | --------- |
| Supadata `auto`                     | ❌ 2024-08 | ✅ Yes  | ✅ TikTok, Instagram, X/Twitter, Facebook, media URL | ❌ Chunk offsets only | ⚠️ Native transcript or generated | ✅ No documented cap | ✅ 1 GiB remote URL | $0.01/request native; $0.02/min generated | 2/2       |
| ScrapeCreators `youtube-transcript` | ❌ 2024-06 | ✅ Yes  | ❌ YouTube only                                      | ❌ Cue times only     | ⚠️ Retrieves existing captions    | ✅ No documented cap | ✅ No upload        | $0.00188/request                          | 1/2       |

Use `--split` for long files. AutoShow also splits automatically when a provider duration or size cap would be exceeded.

### Reproducible transcription, review, and caption workflow

Use the CLI for audio preparation, provider execution, review packets, applying approved edits, caption generation, and container verification. Human or agent review supplies editorial decisions by editing JSON data; no custom executable script is needed. The review/apply commands are entirely offline and do not invoke an LLM or STT provider.

```bash
# Paid transcription: run once after approving the provider and estimate.
bun autoshow extract "input/video.mp4" --provider assemblyai=universal-3-5-pro --diarization --stt-audio-profile lossless --output-dir output/episode/raw --json

# Offline: export words with stable indices and a source-bound edit template.
bun autoshow extract output/episode/raw/result.json --transcript-review --output-dir output/episode/review --json

# Review transcript-review.json and edit only the edits array in edits.json.
bun autoshow extract output/episode/raw/result.json --transcript-edits output/episode/review/edits.json --output-dir output/episode/reviewed --json

# Offline: use audioToVideoOffsetSeconds from raw/source-timeline.json (0 in this example).
bun autoshow extract "input/video.mp4" --captions --transcript-result output/episode/reviewed/result.json --caption-offset 0 --no-caption-speakers --embed-captions --caption-container both --output-dir output/episode/final --json
```

`--stt-audio-profile lossless` decodes the first audio stream to float32 PCM WAV at its original sample rate and channel count. Before submission, the CLI verifies that the source and prepared audio decode to identical samples. It retains the prepared audio and `source-timeline.json`, including the original audio start offset. This preserves decoded audio; it cannot recover information already lost in the source codec. The default profile continues to use the existing provider-oriented audio preparation. The profile can also be configured as `defaults.extract.stt.audioProfile`.

Each entry in the template's `edits` array has this shape (indices and text below are illustrative):

```json
{
  "startWord": 12,
  "deleteCount": 1,
  "expectedText": "Helo,",
  "replacement": "Hello,",
  "reason": "Correct a spelling error without changing the spoken word."
}
```

Keep the template's `schemaVersion` and `sourceSha256`. Indices are zero-based and always address the original review packet. The CLI rejects stale source hashes, unexpected original text, overlapping edits, replacements crossing source segments or speakers, and existing output artifacts. Equal-count substitutions retain each original word's boundaries; changed word counts interpolate explicitly within the selected span. Unselected words retain their timing. An empty replacement explicitly deletes the selected words and may span speakers or remove entire segments; removed segments are retained in the provenance sidecar. Review packets expose invalid source timing and invalid review word indices so malformed repetition can be inspected and explicitly removed offline. Apply rejects any invalid word timing remaining in the reviewed result. `transcript-edits.json` records reasons, original and replacement words, timing decisions, removed segments, and the source evidence path. The source result remains unmodified. Review uncertain wording against the recording; contextual plausibility alone does not establish what was spoken.

For multiple videos, repeat these commands with a distinct episode directory. Embedding currently takes one local video per invocation. If caption formatting or embedding fails, use the saved result in an offline command; do not resubmit transcription. A failed or ambiguous provider submission requires reconciliation before any paid retry.

Embedding validates the extracted subtitle text and millisecond cue timings, audio/video stream payload hashes, every audio/video packet's presentation time within container precision, and retained chapters before publishing each completed video. `caption-embedding.json` records the checks. These automated checks establish faithful packaging, not acoustic alignment accuracy or visual playback quality; playback remains a separate review step.

### Container options and compatibility

Use `--captions --embed-captions` with a local video to transcribe once, retain standalone SRT/VTT, and embed an English subtitle track into a separate video. `--caption-container mp4|mkv|both` defaults to MP4 for an MP4 source and MKV otherwise. Video and audio streams are copied without re-encoding. The source remains untouched. Use a player that supports standard selectable MP4/MKV subtitle tracks; select English in its subtitle menu. Captions are not forced. Other output containers are not supported.

To embed an existing transcript with zero provider calls:

```bash
bun autoshow extract video.mp4 --captions --transcript-result consensus/result.json --embed-captions --caption-container both --no-caption-speakers --output-dir output/captioned-episode
```

This produces `captioned.mp4` (mov_text), `captioned.mkv` (SubRip), `captions.srt`, `captions.vtt`, `captions.json`, and `caption-embedding.json`. Terminal JSON includes the video paths. Phrase grouping and two lines per cue are the defaults; `--no-caption-speakers` hides generic speaker labels while retaining identities in transcript evidence. Embedding requires both standalone formats, so omit `--caption-format` or select `both` or `all`.

Chapters, metadata, and compatible existing subtitle tracks are retained. MP4 chapter data is represented as container chapters, with that mapping recorded in `caption-embedding.json`. Unsupported streams are reported before fresh transcription: for example, an existing MP4 mov_text track cannot be copied directly to MKV, and an MKV ASS track cannot be copied directly to MP4. Choose a compatible container or prepare a separate compatible source. No arbitrary data streams are silently discarded.

Each container is written to a temporary file, probed, and its new subtitle track extracted to verify cue text and timings before exclusive publication. Existing outputs are never overwritten. A later failure can leave an earlier completed container and the transcription artifacts intact; retry from the saved result into a new output directory to avoid repeating transcription.

Saved word boundaries should already use the source video timeline; otherwise pass `--caption-offset <seconds>` to shift exported cues without modifying evidence. Fresh embedding defaults to the source audio start offset and records the applied value in `captions.json`; offline retries from its original result need that same offset. When transcribing separately extracted audio, record and apply its start offset exactly once during consensus alignment. `alignConsensusWords` aligns adjudicated words against ordered, canonically labeled provider words, uses median boundaries only when all supporting timings agree within 150 ms, and flags missing or conflicting evidence in its decisions sidecar. Interpolation and timestamp serialization precision do not establish acoustic alignment accuracy.

Mistral diarization uses segment timestamps: the API rejects diarization with word timestamps even with `stream=true`. With diarization disabled, Mistral returns native word timestamps. Segment spans are never labeled as native word evidence. Obtaining both requires separately authorized requests and local alignment of the two results. Mistral requests and fresh asynchronous STT polling allow 30 minutes.
