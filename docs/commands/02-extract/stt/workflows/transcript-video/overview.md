# Transcript Videos

See the [STT overview](../../overview.md) for shared options.

`extract --transcript-video` renders a 1920x1080 MP4 from saved transcripts and audio without calling an STT provider. Pass a completed media extract directory, or `--audio` with `--transcript-result` or `--transcript-text`. Timestamped text files use `[HH:MM:SS]` lines, with an optional `[speaker]` label.

```bash
bun autoshow extract output/transcript-demo --transcript-video --output-dir output/transcript-demo-video

bun autoshow extract --transcript-video --audio input/examples/audio/1-audio.mp3 --transcript-result output/transcript-demo/result.json

bun autoshow extract --transcript-video --audio input/examples/audio/1-audio.mp3 --transcript-text output/transcript-demo/transcription.txt

bun autoshow extract output/transcript-multi --transcript-video --transcript-result output/transcript-multi/providers/soniox-stt-async-v5/result.json
```
The output contains `<stem>.mp4`, `<stem>.vtt`, `<stem>.srt`, and `manifest.json`. Use `--font <family>` to change the overlay font (default `DejaVu Sans`). Use `--keep-tmp` to retain the per-run `.transcript-video-tmp` workspace in the output directory.
