# Caption Export

See the [STT overview](../../overview.md) for provider selection and shared options.

Generate captions from an audio or video file with `--captions`. Transcription runs once at the provider's normal price; the caption files are written locally from that transcript and add no provider call. The export writes `captions.srt`, `captions.vtt`, and `captions.json` beside `result.json`. Each provider's captions stay in that provider's directory. The same export works for media URLs, media batches, split transcription, and [YouTube caption fallback](../../../url/overview.md#youtube-caption-fallback). `--price` estimates transcription without running it.

```bash
bun autoshow extract audio.mp3 --provider deepinfra --captions
bun autoshow extract video.mp4 --provider deepinfra --captions --caption-mode word --output-dir output/video-captions
bun autoshow extract interview.mp4 --provider deepgram=nova-3 --diarization --captions --caption-format vtt
```
Invalid caption options fail before transcription. If caption generation fails, the transcript remains. Export again from the saved result to change the layout without paying for transcription again.

Export from a saved `result.json`, or from a directory that contains that file. This path needs no audio, model, API credentials, or video rendering. Use a new `--output-dir` for each layout; existing caption files are not overwritten. Aligned and reconciled results from [local timing and speaker workflows](../timing/overview.md#local-timing-and-speaker-workflows) use this same export.

```bash
bun autoshow extract output/<run>/providers/<provider-model>/result.json --captions --output-dir output/captions-phrases
bun autoshow extract --captions --transcript-result output/<run>/providers/<provider-model>/result.json --caption-mode word --caption-format vtt --no-caption-speakers --output-dir output/captions-words
```
| Flag                                                   | Behavior                                                                                                                                                                                                 |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--caption-format srt\|vtt\|ass\|ttml\|lrc\|both\|all` | Defaults to SRT and VTT (`both`). `all` writes all five formats.                                                                                                                                         |
| `--caption-mode phrase\|word`                          | Defaults to phrases. Word mode puts one timed word on each cue. A timed span that already contains several words stays one cue.                                                                          |
| `--caption-speakers`, `--no-caption-speakers`          | Include or hide speaker prefixes. The default includes them.                                                                                                                                             |
| `--caption-max-words`, `--caption-max-characters`      | Phrase grouping limits. Defaults are 10 words and 58 characters. A single word can exceed the character limit.                                                                                           |
| `--caption-max-duration`, `--caption-break-gap`        | Cue length and silence-gap limits in seconds. Defaults are 5 and 0.9. Word times stay as measured.                                                                                                       |
| `--caption-line-width`, `--caption-max-lines`          | Defaults are 42 characters and 2 lines. A long word or speaker prefix can exceed those limits.                                                                                                           |
| `--caption-max-cps`                                    | Reading-speed warning threshold, default 20 characters/second. Warnings are listed in `captions.json`; word times stay as measured.                                                                      |
| `--caption-offset <seconds>`                           | Shift cue times onto the source video timeline. Saved-result export defaults to 0. Fresh embedding uses the source audio start, records it in `captions.json`, and a later export needs the same offset. |

`captions.json` lists cue boundaries, layout warnings, and counts of inferred or invalid words. A transcript with only segment timing can still export word-mode cues, using estimated word times. Export fails when the transcript has no timed words or segments.

ASS and LRC store centiseconds, and LRC stores cue starts without end times. `captions.json` keeps the full time ranges. ASS rejects literal braces or ASS control sequences in the transcript; use SRT, VTT, or TTML for that text.

## Container options and compatibility

Use `--captions --embed-captions` with a local video to transcribe once, keep standalone SRT and VTT, and embed an English subtitle track in a separate video. `--caption-container mp4|mkv|both` defaults to MP4 for an MP4 source and MKV otherwise. Video and audio are copied without re-encoding, and the source file is left unchanged. The English track is selectable and is not forced on. Other containers are not supported.

To embed an existing transcript with no provider call:

```bash
bun autoshow extract video.mp4 --captions --transcript-result consensus/result.json --embed-captions --caption-container both --no-caption-speakers --output-dir output/captioned-episode
```
The output is `captioned.mp4` (mov_text), `captioned.mkv` (SubRip), `captions.srt`, `captions.vtt`, `captions.json`, and `caption-embedding.json`. Embedding keeps standalone SRT and VTT, so omit `--caption-format` or select `both` or `all`.

Chapters, metadata, and compatible existing subtitle tracks are kept. Incompatible tracks are reported before transcription. An MP4 mov_text track cannot be copied into MKV, and an MKV ASS track cannot be copied into MP4. Choose a compatible container, or start from a source that already matches it.

If embedding fails after a container is written, that container and the transcript remain. Retry from the saved result into a new output directory.
