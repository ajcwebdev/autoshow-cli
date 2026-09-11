# Local STT

Whisperfile runs locally without provider API credentials and is the default STT provider. Ordinary transcription uses `tiny`; music lyric-video transcription uses `small.en`. See the [STT overview](../overview.md) for shared options and [setup](../../setup-and-utilities/setup.md) for installation.

```bash
bun autoshow extract audio.mp3
bun autoshow extract audio.mp3 --provider whisperfile
bun autoshow extract audio.mp3 --provider whisperfile=small.en
bun autoshow setup --step whisperfile
bun autoshow setup --models tiny --models tiny.en --models small --models whisperfile:small.en
```

The full supported catalog is `tiny`, `tiny.en`, `small`, `small.en`, `medium`, `medium.en`, `large-v2`, and `large-v3`. Optional larger bundles can be downloaded explicitly with repeatable `--models` flags or provisioned on demand by an explicit transcription model selection. Default setup installs only `tiny`. Automated native and Docker model coverage and `config/stt-local.json` use only `tiny`, `tiny.en`, `small`, and `small.en`.

Whisperfile emits word timestamps and supports optional native SRT/VTT/LRC artifacts when advertised by the installed bundle. It does not support diarization or `--speaker-count`. See [local timing and speaker workflows](../workflows/timing/overview.md#local-timing-and-speaker-workflows) for reference comparison, forced alignment, whisperfile calibration, channel extraction/merge, and reviewed speaker-label mapping.

Historical local engine quality and speed evidence remains unchanged in [`docs/benchmarks/stt-local`](../../../benchmarks/stt-local/). Those artifacts include the removed whisper.cpp integration; they are not the current provider or automated model catalog.
