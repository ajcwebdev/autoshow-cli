# Caption Export

See the [STT overview](../../overview.md) for provider selection and shared options.

Generate captions from an audio or video file with `--captions`. The selected STT model runs once; caption export uses its saved timing evidence and writes `captions.srt`, `captions.vtt`, and `captions.json` beside `result.json`. Multiple providers each get captions in their own provider directory. This also works with media URLs, media batches, split transcription, and the YouTube caption-first path. Transcription uses normal provider pricing; local caption generation adds no provider call. `--price` estimates transcription without running it.

```bash
bun autoshow extract audio.mp3 --provider deepinfra --captions
bun autoshow extract video.mp4 --provider deepinfra --captions --caption-mode word --output-dir output/video-captions
bun autoshow extract interview.mp4 --provider deepgram=nova-3 --diarization --captions --caption-format vtt
```
Caption flags are validated before transcription. If caption generation fails, the transcript remains available; retry from the saved result below to adjust captions without paying for transcription again.

Export locally from a provider's saved `result.json`, or a directory containing that file. This path needs no audio, model, API credentials, or video rendering. Use a new `--output-dir` for each layout; existing caption files are not overwritten.

```bash
bun autoshow extract output/<run>/providers/<provider-model>/result.json --captions --output-dir output/captions-phrases
bun autoshow extract --captions --transcript-result output/<run>/providers/<provider-model>/result.json --caption-mode word --caption-format vtt --no-caption-speakers --output-dir output/captions-words
```
| Flag                                                   | Behavior                                                                                                                                             |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--caption-format srt\|vtt\|ass\|ttml\|lrc\|both\|all` | Defaults to SRT and VTT (`both`). `all` writes all five formats.                                                                                     |
| `--caption-mode phrase\|word`                          | Defaults to readable phrases. Word mode emits one evidence word/token span per cue. A provider-formatted multiword span retains its original bounds. |
| `--caption-speakers`, `--no-caption-speakers`          | Include or hide speaker prefixes in exported files without changing provider evidence; default includes speakers.                                    |
| `--caption-max-words`, `--caption-max-characters`      | Phrase grouping budgets; defaults are 10 words and 58 characters. Indivisible words can exceed a character budget.                                   |
| `--caption-max-duration`, `--caption-break-gap`        | Cue-duration and silence-gap budgets in seconds; defaults are 5 and 0.9. Native word boundaries are preserved.                                       |
| `--caption-line-width`, `--caption-max-lines`          | Defaults are 42 characters and 2 lines. Long words and added speaker prefixes can exceed these layout budgets.                                       |
| `--caption-max-cps`                                    | Reading-speed threshold, default 20 characters/second. Violations are recorded without moving measured word timing.                                  |
| `--caption-offset <seconds>`                           | Shift cue times without changing saved evidence. Saved-result export defaults to 0; fresh embedding uses the source audio start.                     |

The export includes `captions.json` with timing quality, inferred-word counts, invalid-word counts, layout warnings, and cue boundaries. Text with no usable timed word or segment causes an actionable error. Segment-only providers can produce word-mode cues with estimated timing.

ASS and LRC store centiseconds; LRC stores cue starts without ends. The JSON sidecar retains full ranges and records those format limits. TTML keeps millisecond ranges, Unicode text, and explicit line breaks. ASS rejects literal braces or ASS control sequences in transcript text; choose SRT, VTT, or TTML for those transcripts. [TTML specification](https://www.w3.org/TR/ttml1/), [ASS format guide](https://github.com/libass/libass/wiki/ASS-File-Format-Guide).

### Export aligned or reconciled captions

Use the saved `result.json` from [local alignment or speaker reconciliation](../timing/overview.md#local-timing-and-speaker-workflows) with the same caption exporter.

```bash
bun autoshow extract output/aligned/result.json --captions --caption-mode word --caption-format all --output-dir output/aligned-captions --json
```
## Container options and compatibility

Use `--captions --embed-captions` with a local video to transcribe once, retain standalone SRT/VTT, and embed an English subtitle track into a separate video. `--caption-container mp4|mkv|both` defaults to MP4 for an MP4 source and MKV otherwise. Video and audio streams are copied without re-encoding. The source remains untouched. Use a player that supports standard selectable MP4/MKV subtitle tracks; select English in its subtitle menu. Captions are not forced. Other output containers are not supported.

To embed an existing transcript with zero provider calls:

```bash
bun autoshow extract video.mp4 --captions --transcript-result consensus/result.json --embed-captions --caption-container both --no-caption-speakers --output-dir output/captioned-episode
```
This produces `captioned.mp4` (mov_text), `captioned.mkv` (SubRip), `captions.srt`, `captions.vtt`, `captions.json`, and `caption-embedding.json`. Embedding requires both standalone formats, so omit `--caption-format` or select `both` or `all`.

Chapters, metadata, and compatible existing subtitle tracks are retained. Unsupported streams are reported before fresh transcription: for example, an existing MP4 mov_text track cannot be copied directly to MKV, and an MKV ASS track cannot be copied directly to MP4. Choose a compatible container or prepare a separate compatible source.

If embedding fails after a container is written, that container and the transcription artifacts remain; retry from the saved result into a new output directory.

When saved word boundaries are not already on the source video timeline, pass `--caption-offset <seconds>` to shift exported cues without modifying evidence. Fresh embedding defaults to the source audio start offset and records the applied value in `captions.json`; offline retries from that result need the same offset.
