# Local STT

Whisper and Whisperfile run locally without provider API credentials. See the [STT overview](../overview.md) for shared options and [setup](../../setup-and-utilities/setup.md) for installation.

Whisperfile downloads its selected model on first use; to pre-download, run `bun autoshow setup --step whisperfile` (default `tiny`) or `bun autoshow setup --models whisperfile:<model>`.

Neither local engine supports diarization or `--speaker-count`. Both emit word timestamps. See [local timing and speaker workflows](../workflows/timing/overview.md#local-timing-and-speaker-workflows) for reference comparison, forced alignment, Whisper calibration, channel extraction/merge, and reviewed speaker-label mapping.

## Whisper.cpp

| Option   | Value                                               |
| -------- | --------------------------------------------------- |
| Selector | default, or `--provider whisper[=<model>]`          |
| Models   | `tiny`, `base`, `small`, `medium`, `large-v3-turbo` |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider whisper=large-v3-turbo
```

## Whisperfile

| Option   | Value                                                                                 |
| -------- | ------------------------------------------------------------------------------------- |
| Selector | `--provider whisperfile=<model>`                                                      |
| Models   | `tiny`, `tiny.en`, `small`, `small.en`, `medium`, `medium.en`, `large-v2`, `large-v3` |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider whisperfile=tiny
```

Whisperfile requires an explicit model selector. It is included by `--all-local`.

Local engine quality and speed evidence for the 1-minute, 10-minute, and 40-minute without-speakers fixtures lives in [`docs/benchmarks/stt-local`](../../../benchmarks/stt-local/). Use `config/stt-local.json` to select every supported whisper.cpp and whisperfile model at `--local-concurrency 1`.
