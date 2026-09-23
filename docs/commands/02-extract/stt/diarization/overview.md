# Diarization

These providers return speaker labels by default. Toggle support and word timing differ by provider; see [provider controls](../overview.md#provider-controls).

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
Bare `--provider assemblyai` defaults to `universal-3-5-pro`.

### Gemini STT

| Option   | Value                         |
| -------- | ----------------------------- |
| Selector | `--provider gemini[=<model>]` |
| Models   | `gemini-3.5-transcribe`       |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider gemini
```
Bare `--provider gemini` defaults to `gemini-3.5-transcribe`. Diarization and word timestamps are on by default. `--no-diarization` keeps word timestamps. `--speaker-count` is ignored.

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
Bare `--provider gladia` selects `solaria-3`. `solaria-3` is English, French, German, Spanish, and Italian only.

### Grok STT

| Option   | Value                       |
| -------- | --------------------------- |
| Selector | `--provider grok[=<model>]` |
| Models   | `speech-to-text`            |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider grok=speech-to-text
```
### Happy Scribe

| Option       | Value                                    |
| ------------ | ---------------------------------------- |
| Selector     | `--provider happyscribe[=<model>]`       |
| Models       | `auto`                                   |
| Organization | `--stt-organization-id happyscribe=<id>` |
| Language     | Fixed to `en-US`                         |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider happyscribe=auto
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider happyscribe --stt-organization-id happyscribe=org_123
```
Organization resolution order: CLI `--stt-organization-id`, saved `setup` default, then auto-select if the API key accesses exactly one organization.

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
Bare `--provider speechmatics` selects `melia-1` (multilingual).

## Provider Capabilities

Rows are newest first. Pricing is the AutoShow per-hour estimate.

| Provider                       | Released   | Speaker count     | Word timestamps                  | Transcript cleanup               | Duration           | File size         | Pricing   |
| ------------------------------ | ---------- | ----------------- | -------------------------------- | -------------------------------- | ------------------ | ----------------- | --------- |
| Gemini `gemini-3.5-transcribe` | 2026-08-26 | No                | Native words                     | Verbatim default                 | 30 minutes         | 2 GiB upload      | $0.30/hr  |
| AssemblyAI `universal-3-5-pro` | 2026-07-07 | `--speaker-count` | Native words                     | None                             | 10 hours           | 2.2 GiB upload    | $0.23/hr  |
| Speechmatics `melia-1`         | 2026-06-17 | No                | Native words                     | Punctuation included             | No documented cap  | 1 GiB             | $0.129/hr |
| Soniox `stt-async-v5`          | 2026-06-11 | No                | Native words                     | Smart formatting included        | 5 hours            | 500 MiB           | $0.10/hr  |
| Gladia `solaria-3`             | 2026-06-10 | `--speaker-count` | Native words                     | None                             | 2 hours 15 minutes | 1000 MiB          | $0.61/hr  |
| Grok `speech-to-text`          | 2026-04-17 | No                | Native words                     | Formatting                       | No documented cap  | 500 MiB           | $0.10/hr  |
| Mistral `voxtral-mini-2602`    | 2026-02-04 | No                | Native words without diarization | None                             | ~3 hours           | 500 MiB           | $0.18/hr  |
| Deepgram `nova-3`              | 2025-02-12 | No                | Native words                     | Punctuation and smart formatting | No documented cap  | 2 GiB             | $0.258/hr |
| Happy Scribe `auto`            | 2017       | No                | Words when available             | None                             | No documented cap  | No documented cap | $0.60/hr  |
