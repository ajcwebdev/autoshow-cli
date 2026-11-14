# Caption Export

`extract --captions` formats completed transcript evidence locally. Fresh media transcription still requires the selected provider and may be billable; export itself adds no provider call. Defaults are `captions.srt`, `captions.vtt`, and timing/layout metadata in `captions.json` beside each target's `result.json`.

```bash
bun autoshow extract input/examples/audio/1-audio.mp3 --provider deepinfra --captions --price
bun autoshow extract input/examples/video/01-two-speaker-speech.transcript.json --captions --output-dir output/captions-fixture
```

The second example is local and needs no audio, model, credentials, or renderer. The [bundled transcript](../../../../../../input/examples/video/README.md) uses published subtitle spans, not measured word boundaries. Saved `result.json` files or directories containing one also support export, including [aligned/reconciled results](../timing/overview.md#local-timing-and-speaker-workflows).

Choose a fresh output directory: existing caption files are not overwritten. Invalid options fail before transcription. Export failure preserves the transcript, allowing another layout without repurchasing inference.

## Caption options

- `--caption-format srt|vtt|ass|ttml|lrc|both|all`: default `both` means SRT/VTT; `all` writes all five.
- `--caption-mode phrase|word`: default `phrase`. Word mode preserves indivisible multiword timed spans.
- `--no-caption-speakers`: hide default speaker prefixes.
- `--caption-max-words`, `--caption-max-characters`: phrase limits, default `10` and `58`.
- `--caption-max-duration`, `--caption-break-gap`: defaults `5` and `0.9` seconds.
- `--caption-line-width`, `--caption-max-lines`: defaults `42` characters and `2` lines. Indivisible words/prefixes can exceed layout limits.
- `--caption-max-cps`: reading-speed warning threshold, default `20` characters/second; warnings never retime cues.
- `--caption-offset`: finite seconds to add to the source timeline. Saved export defaults to `0`; fresh embedding uses the audio start offset recorded in `captions.json`. Preserve that offset on later exports.

Usable timing must cover the full transcript. Segment-only results can produce estimated word cues; `captions.json` records inferred/invalid word counts and warnings. Repair missing coverage before retrying. ASS/LRC round to centiseconds; LRC omits end times. ASS rejects literal braces/control sequences; use SRT, VTT, or TTML instead.

## Container options and compatibility

Embedding copies local video/audio and compatible subtitle tracks into a separate MP4/MKV without re-encoding or changing the source. The new English track is selectable, not forced. `--caption-container mp4|mkv|both` defaults to MP4 for MP4 input and MKV otherwise.

```bash
bun autoshow extract input/examples/video/01-two-speaker-speech.mp4 --captions --transcript-result input/examples/video/01-two-speaker-speech.transcript.json --embed-captions --caption-container both --no-caption-speakers --output-dir output/captioned-fixture
```

This local example writes `captioned.mp4` (mov_text), `captioned.mkv` (SubRip), standalone SRT/VTT, `captions.json`, and `caption-embedding.json`. Embedding requires `--caption-format both` or `all` (or omission).

Chapters/metadata and compatible existing subtitles are retained. Incompatible tracks fail before transcription: MP4 mov_text cannot copy into MKV, nor MKV ASS into MP4. If partial embedding fails, preserve completed containers/transcripts and retry from the saved result into a fresh directory. See the [STT guide](../../overview.md) for transcription and [review](../transcript-review/overview.md) for text repair.
