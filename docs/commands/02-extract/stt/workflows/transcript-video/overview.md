# Transcript Videos

See the [STT overview](../../overview.md) for provider selection and shared options.

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
