# Local STT

Whisperfile runs locally without provider API credentials and is the default STT provider. Ordinary transcription uses `tiny`. See the [STT overview](../overview.md) for shared options and [setup](../../../00-setup-and-utilities/setup.md) for installation.

```bash
bun autoshow extract audio.mp3
bun autoshow extract audio.mp3 --provider whisperfile
bun autoshow extract audio.mp3 --provider whisperfile=small.en
```

Supported models are `tiny`, `tiny.en`, `small`, `small.en`, `medium`, `medium.en`, `large-v2`, and `large-v3`. Default setup installs only `tiny`. Other models download with `setup --models` or when selected for transcription.

Whisperfile includes word timestamps. `--native-subtitles` can also write SRT, VTT, and LRC. Diarization and `--speaker-count` are not supported. Speaker and timing work that stays on this machine is covered in [local timing and speaker workflows](../workflows/timing/overview.md).
