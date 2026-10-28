# Diarization

AutoShow enables diarization by default for these providers. Word timing and speaker-count controls differ by provider; see [provider controls](../overview.md#provider-controls). The model listed for each provider is its default when no model is specified.

See the [STT overview](../overview.md) for shared options, environment variables, pricing, and workflows.

## Providers

### AssemblyAI

| Option        | Value                             |
| ------------- | --------------------------------- |
| Selector      | `--provider assemblyai[=<model>]` |
| Models        | `universal-3-5-pro`               |
| Speaker count | `--speaker-count <n>`             |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider assemblyai
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider assemblyai=universal-3-5-pro --speaker-count 2
```

### Gemini STT

| Option   | Value                         |
| -------- | ----------------------------- |
| Selector | `--provider gemini[=<model>]` |
| Models   | `gemini-3.5-transcribe`       |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider gemini
```

Word timestamps are on by default. `--no-diarization` keeps word timestamps. `--speaker-count` is ignored. Speaker attribution for three or more speakers is experimental.

### Deepgram

| Option   | Value                           |
| -------- | ------------------------------- |
| Selector | `--provider deepgram[=<model>]` |
| Models   | `nova-3`                        |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider deepgram=nova-3
```

### Gladia

| Option        | Value                         |
| ------------- | ----------------------------- |
| Selector      | `--provider gladia[=<model>]` |
| Models        | `solaria-3`                   |
| Speaker count | `--speaker-count <n>`         |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider gladia=solaria-3
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider gladia --speaker-count 2
```

`solaria-3` supports English, French, German, Spanish, and Italian only.

### Grok STT

| Option   | Value                       |
| -------- | --------------------------- |
| Selector | `--provider grok[=<model>]` |
| Models   | `grok-voice-transcribe-2.0` |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider grok=grok-voice-transcribe-2.0
```

### Mistral

| Option   | Value                          |
| -------- | ------------------------------ |
| Selector | `--provider mistral[=<model>]` |
| Models   | `voxtral-mini-2602`            |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider mistral
```

### Soniox

| Option   | Value                         |
| -------- | ----------------------------- |
| Selector | `--provider soniox[=<model>]` |
| Models   | `stt-async-v5`                |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider soniox
```

### Speechmatics

| Option   | Value                               |
| -------- | ----------------------------------- |
| Selector | `--provider speechmatics[=<model>]` |
| Models   | `melia-1`                           |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider speechmatics=melia-1
```

`melia-1` supports multilingual transcription.

## Provider Capabilities

Pricing is the nominal AutoShow per-hour estimate; use `--price` for the selected audio and options. AssemblyAI's rate includes its diarization add-on. Soniox's hourly figure estimates token-based billing. Mistral returns segment timing with diarization; use `--no-diarization` for native word timestamps.

| Provider                         | Speaker-count hint | Word timestamps                  | Duration           | File size      | Pricing   |
| -------------------------------- | ------------------ | -------------------------------- | ------------------ | -------------- | --------- |
| Grok `grok-voice-transcribe-2.0` | No                 | Native words                     | No documented cap  | 500 MiB        | $0.10/hr  |
| Gemini `gemini-3.5-transcribe`   | No                 | Native words                     | 30 minutes         | 2 GiB upload   | $0.30/hr  |
| AssemblyAI `universal-3-5-pro`   | `--speaker-count`  | Native words                     | 10 hours           | 2.2 GiB upload | $0.23/hr  |
| Speechmatics `melia-1`           | No                 | Native words                     | No documented cap  | 1 GiB          | $0.129/hr |
| Soniox `stt-async-v5`            | No                 | Native words                     | 5 hours            | 500 MiB        | $0.10/hr  |
| Gladia `solaria-3`               | `--speaker-count`  | Native words                     | 2 hours 15 minutes | 1000 MiB       | $0.61/hr  |
| Mistral `voxtral-mini-2602`      | No                 | Native words without diarization | ~3 hours           | 500 MiB        | $0.18/hr  |
| Deepgram `nova-3`                | No                 | Native words                     | No documented cap  | 2 GiB          | $0.258/hr |
