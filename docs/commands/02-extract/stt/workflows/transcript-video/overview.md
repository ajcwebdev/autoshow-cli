# Transcript Videos

See the [STT overview](../../overview.md) for shared options.

`extract --transcript-video` renders a 1920x1080 MP4 from saved transcripts and audio without calling an STT provider. Pass a completed media extract directory, or `--audio` with exactly one of `--transcript-result` or `--transcript-text`. When that directory contains more than one completed transcript, pass `--transcript-result` to choose it. Timestamped text files use `[HH:MM:SS]` lines, with an optional `[speaker]` label.

```bash
bun autoshow extract output/<extract-run-dir> --transcript-video

bun autoshow extract --transcript-video --audio input/audio.mp3 --transcript-result output/<extract-run-dir>/result.json
```
The output contains `<stem>.mp4`, `<stem>.vtt`, `<stem>.srt`, and `manifest.json`. Use `--font <family>` to change the overlay font (default `DejaVu Sans`).
