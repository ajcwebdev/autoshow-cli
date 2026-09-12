# Diarization

These providers return speaker labels by default. Toggle support and word timing differ by provider; see [provider controls](../overview.md#provider-controls).

See the [STT overview](../overview.md) for shared options, environment variables, pricing, and workflows.

## Providers

### AssemblyAI

| Option      | Value                                    |
| ----------- | ---------------------------------------- |
| Selector    | `--provider assemblyai[=<model>]`        |
| Models      | `universal-3-5-pro`                      |
| Diarization | Supported; accepts `--speaker-count <n>` |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider assemblyai
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider assemblyai=universal-3-5-pro --speaker-count 2
```

Bare `--provider assemblyai` defaults to `universal-3-5-pro`.

### Deepgram

| Option      | Value                           |
| ----------- | ------------------------------- |
| Selector    | `--provider deepgram[=<model>]` |
| Models      | `nova-3`                        |
| Diarization | Enabled by default              |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider deepgram=nova-3
```

### Gladia

| Option      | Value                                    |
| ----------- | ---------------------------------------- |
| Selector    | `--provider gladia[=<model>]`            |
| Models      | `solaria-3`                              |
| Diarization | Supported; accepts `--speaker-count <n>` |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider gladia=solaria-3
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider gladia --speaker-count 2
```

Bare `--provider gladia` selects `solaria-3`. `solaria-3` is English, French, German, Spanish, and Italian only. Enterprise plans can raise duration to 4 hours 15 minutes.

### Grok STT

| Option      | Value                       |
| ----------- | --------------------------- |
| Selector    | `--provider grok[=<model>]` |
| Models      | `speech-to-text`            |
| Diarization | Enabled by default          |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider grok=speech-to-text
```

### Happy Scribe

| Option       | Value                                    |
| ------------ | ---------------------------------------- |
| Selector     | `--provider happyscribe[=<model>]`       |
| Models       | `auto`                                   |
| Organization | `--stt-happyscribe-organization-id <id>` |
| Language     | Fixed to `en-US`                         |
| Diarization  | Enabled by default                       |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider happyscribe=auto
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider happyscribe --stt-happyscribe-organization-id org_123
```

Organization resolution order: CLI `--stt-happyscribe-organization-id`, config default, then auto-select if the API key accesses exactly one organization.

### Mistral

| Option   | Value                          |
| -------- | ------------------------------ |
| Selector | `--provider mistral[=<model>]` |
| Models   | `voxtral-mini-2602`            |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider mistral
```

Voxtral Mini Transcribe 2 supports up to 500 MB and ~3 hours of audio per request.

### Soniox

| Option      | Value                         |
| ----------- | ----------------------------- |
| Selector    | `--provider soniox[=<model>]` |
| Models      | `stt-async-v5`                |
| Diarization | Enabled by default            |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider soniox
```

### Speechmatics

| Option      | Value                               |
| ----------- | ----------------------------------- |
| Selector    | `--provider speechmatics[=<model>]` |
| Models      | `melia-1`                           |
| Diarization | Enabled by default                  |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider speechmatics=melia-1
```

Bare `--provider speechmatics` selects `melia-1` (multilingual).

## Provider Capabilities

Marks: ✅ supported, ⚠️ partial or qualified, ❌ not exposed. Released dates are provider announcement or model-origin dates. Recency marks: current-year GA is ✅, older still-current snapshots are ⚠️, and pre-2026 engines are ❌. Rows are newest first.

Duration uses the same marks: under 2 hours is ❌, 2–4 hours is ⚠️, 5+ hours or no documented cap is ✅. File size uses ❌ under 100 MiB, ⚠️ 100 MiB to under 1 GiB, and ✅ 1 GiB or no cap.

Pricing is the AutoShow estimate rate. Cost rank orders models cheapest-first within each table (1 = cheapest) and ties share a rank. Hosted tables rank on the per-hour rate; the Direct URL table ranks on per-request retrieval cost.

| Provider                       | Released      | Diarization            | Speaker count        | Word timestamps            | Transcript cleanup                  | Duration              | File size            | Pricing   | Cost rank |
| ------------------------------ | ------------- | ---------------------- | -------------------- | -------------------------- | ----------------------------------- | --------------------- | -------------------- | --------- | --------- |
| AssemblyAI `universal-3-5-pro` | ✅ 2026-07-07 | ✅ Speaker labels      | ✅ `--speaker-count` | ✅ Native words            | ❌ None                             | ✅ 10 hours           | ✅ 2.2 GiB upload    | $0.23/hr  | 5/8       |
| Speechmatics `melia-1`         | ✅ 2026-06-17 | ✅ Speaker diarization | ❌ Not exposed       | ✅ Native words            | ⚠️ Punctuation included             | ✅ No documented cap  | ✅ 1 GiB             | $0.129/hr | 3/8       |
| Soniox `stt-async-v5`          | ✅ 2026-06-11 | ✅ Speaker diarization | ❌ Not exposed       | ✅ Native words            | ⚠️ Smart formatting included        | ✅ 5 hours            | ⚠️ 500 MiB           | $0.10/hr  | 1/8       |
| Gladia `solaria-3`             | ✅ 2026-06-10 | ✅ Speaker labels      | ✅ `--speaker-count` | ✅ Native words            | ❌ None                             | ⚠️ 2 hours 15 minutes | ⚠️ 1000 MiB          | $0.61/hr  | 8/8       |
| Grok `speech-to-text`          | ✅ 2026-05    | ✅ Speaker diarization | ❌ Not exposed       | ✅ Native words            | ✅ Formatting                       | ✅ No documented cap  | ⚠️ 500 MiB           | $0.10/hr  | 1/8       |
| Mistral `voxtral-mini-2602`    | ✅ 2026-02-04 | ✅ Speaker diarization | ❌ Not exposed       | ✅ Native words without diarization | ❌ None                             | ⚠️ ~3 hours           | ⚠️ 500 MiB           | $0.12/hr  | 2/8       |
| Deepgram `nova-3`              | ⚠️ 2025-02-12 | ✅ Speaker diarization | ❌ Not exposed       | ✅ Native words            | ✅ Punctuation and smart formatting | ✅ No documented cap  | ✅ 2 GiB             | $0.258/hr | 6/8       |
| Happy Scribe `auto`            | ❌ 2017       | ✅ Speaker labels      | ❌ Not exposed       | ⚠️ Words when available    | ❌ None                             | ✅ No documented cap  | ✅ No documented cap | $0.60/hr  | 7/8       |
