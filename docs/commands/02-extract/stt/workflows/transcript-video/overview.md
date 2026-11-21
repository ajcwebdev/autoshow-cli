# Transcript Videos

`extract --transcript-video` locally renders a 1920×1080 MP4 from saved audio/transcripts, with no STT request. Supply a single-media extract directory, or `--audio` with exactly one of `--transcript-result`/`--transcript-text`. Multiple completed transcripts require explicit selection. Text input uses `[HH:MM:SS]` lines with optional `[speaker]` labels.

```bash
bun autoshow extract output/<extract-run-dir> --transcript-video
bun autoshow extract --transcript-video --audio input/audio.mp3 --transcript-result output/<extract-run-dir>/result.json
```

Output: `<stem>.mp4`, `.vtt`, `.srt`, and `manifest.json`. `--font` defaults to `DejaVu Sans`; `--keep-tmp` retains renderer working files.

Rendering uses managed FFmpeg with `ass`, or the supported managed ImageMagick/Pango fallback and private fonts. Provision the complete rendering graph with `bun autoshow setup --step rendering`; see [setup](../../../../00-setup-and-utilities/setup.md) and the [STT guide](../../overview.md).
