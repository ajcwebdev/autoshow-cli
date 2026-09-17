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
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider gemini=gemini-3.5-transcribe
```

Bare `--provider gemini` defaults to `gemini-3.5-transcribe`. Native speaker diarization and word timestamps are on by default in verbatim mode (`--no-diarization` keeps word timestamps). Speaker count is not configurable. Custom vocabulary and smart transcription are incompatible with those features and are not exposed.

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

Organization resolution order: CLI `--stt-organization-id`, config default, then auto-select if the API key accesses exactly one organization.

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

Marks: ✅ supported, ⚠️ partial or qualified, ❌ not exposed. Released dates are provider announcement or model-origin dates. Recency marks: ✅ 2026-04-01 or later, ⚠️ 2026-01-01 through 2026-03-31, ❌ before 2026-01-01. Rows are newest first.

Duration uses the same marks: under 2 hours is ❌, 2–4 hours is ⚠️, 5+ hours or no documented cap is ✅. File size uses ❌ under 100 MiB, ⚠️ 100 MiB to under 1 GiB, and ✅ 1 GiB or no cap.

Pricing is the AutoShow estimate rate. Pricing: ✅ cheapest third, ⚠️ middle third, ❌ most expensive third. Cost rank is cheapest first (1 = cheapest); ties share a rank.

| Provider                       | Released      | Speaker count        | Word timestamps                     | Transcript cleanup                  | Duration              | File size            | Pricing      | Cost rank |
| ------------------------------ | ------------- | -------------------- | ----------------------------------- | ----------------------------------- | --------------------- | -------------------- | ------------ | --------- |
| Gemini `gemini-3.5-transcribe` | ✅ 2026-08    | ❌ Not exposed       | ✅ Native words                     | ❌ Verbatim default                 | ❌ 30 minutes         | ✅ 2 GiB upload      | ⚠️ $0.30/hr  | 7/9       |
| AssemblyAI `universal-3-5-pro` | ✅ 2026-07-07 | ✅ `--speaker-count` | ✅ Native words                     | ❌ None                             | ✅ 10 hours           | ✅ 2.2 GiB upload    | ⚠️ $0.23/hr  | 5/9       |
| Speechmatics `melia-1`         | ✅ 2026-06-17 | ❌ Not exposed       | ✅ Native words                     | ⚠️ Punctuation included             | ✅ No documented cap  | ✅ 1 GiB             | ⚠️ $0.129/hr | 3/9       |
| Soniox `stt-async-v5`          | ✅ 2026-06-11 | ❌ Not exposed       | ✅ Native words                     | ⚠️ Smart formatting included        | ✅ 5 hours            | ⚠️ 500 MiB           | ✅ $0.10/hr  | 1/9       |
| Gladia `solaria-3`             | ✅ 2026-06-10 | ✅ `--speaker-count` | ✅ Native words                     | ❌ None                             | ⚠️ 2 hours 15 minutes | ⚠️ 1000 MiB          | ❌ $0.61/hr  | 9/9       |
| Grok `speech-to-text`          | ✅ 2026-05    | ❌ Not exposed       | ✅ Native words                     | ✅ Formatting                       | ✅ No documented cap  | ⚠️ 500 MiB           | ✅ $0.10/hr  | 1/9       |
| Mistral `voxtral-mini-2602`    | ⚠️ 2026-02-04 | ❌ Not exposed       | ✅ Native words without diarization | ❌ None                             | ⚠️ ~3 hours           | ⚠️ 500 MiB           | ⚠️ $0.18/hr  | 4/9       |
| Deepgram `nova-3`              | ❌ 2025-02-12 | ❌ Not exposed       | ✅ Native words                     | ✅ Punctuation and smart formatting | ✅ No documented cap  | ✅ 2 GiB             | ❌ $0.258/hr | 6/9       |
| Happy Scribe `auto`            | ❌ 2017       | ❌ Not exposed       | ⚠️ Words when available             | ❌ None                             | ✅ No documented cap  | ✅ No documented cap | ❌ $0.60/hr  | 8/9       |
