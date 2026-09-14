# Local STT

Whisperfile runs locally without provider API credentials and is the default STT provider. Ordinary transcription uses `tiny`; music lyric-video transcription uses `small.en`. See the [STT overview](../overview.md) for shared options and [setup](../../../00-setup-and-utilities/setup.md) for installation.

```bash
bun autoshow extract audio.mp3
bun autoshow extract audio.mp3 --provider whisperfile
bun autoshow extract audio.mp3 --provider whisperfile=small.en
bun autoshow setup --step whisperfile
bun autoshow setup --models tiny --models tiny.en --models small --models whisperfile:small.en
```

The full supported catalog is `tiny`, `tiny.en`, `small`, `small.en`, `medium`, `medium.en`, `large-v2`, and `large-v3`. Default setup installs only `tiny`. Larger models download with `--models` or automatically when selected for transcription.

Whisperfile emits word timestamps and optional native SRT/VTT/LRC artifacts. It does not support diarization or `--speaker-count`. See [local timing and speaker workflows](../workflows/timing/overview.md#local-timing-and-speaker-workflows).

Quality and speed comparisons are in [`docs/benchmarks/stt-local`](../../../../benchmarks/stt-local/).
