# Diarization Off by Default

These providers leave diarization off by default. Gemini retains optional generated speaker hypotheses, and Together retains optional diarization and speaker-count controls. See [provider controls](../overview.md#provider-controls) for model-specific behavior.

See the [STT overview](../overview.md) for shared options, environment variables, pricing, and workflows.

## Providers

### DeepInfra

| Option   | Value                                                      |
| -------- | ---------------------------------------------------------- |
| Selector | `--provider deepinfra[=<model>]`                           |
| Models   | `openai/whisper-large-v3-turbo`, `openai/whisper-large-v3` |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider deepinfra
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider deepinfra=openai/whisper-large-v3
```

### Gemini STT

| Option   | Value                                  |
| -------- | -------------------------------------- |
| Selector | `--provider gemini[=<model>]`          |
| Models   | `gemini-3.8-flash`, `gemini-3.6-flash` |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider gemini
```

Bare `--provider gemini` defaults to `gemini-3.6-flash`.

### Together

| Option   | Value                                                    |
| -------- | -------------------------------------------------------- |
| Selector | `--provider together[=<model>]`                          |
| Models   | `nvidia/parakeet-tdt-0.6b-v3`, `openai/whisper-large-v3` |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider together
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider together=openai/whisper-large-v3
```

Bare `--provider together` defaults to `nvidia/parakeet-tdt-0.6b-v3`.

## Provider Capabilities

Marks: ✅ supported, ⚠️ partial or qualified, ❌ not exposed. Released dates are provider announcement or model-origin dates. Recency marks: ✅ 2026-04-01 or later, ⚠️ 2026-01-01 through 2026-03-31, ❌ before 2026-01-01. Rows are newest first.

Duration uses the same marks: under 2 hours is ❌, 2–4 hours is ⚠️, 5+ hours or no documented cap is ✅. File size uses ❌ under 100 MiB, ⚠️ 100 MiB to under 1 GiB, and ✅ 1 GiB or no cap.

Pricing is the AutoShow estimate rate. Pricing: ✅ cheapest third, ⚠️ middle third, ❌ most expensive third. Cost rank orders models cheapest-first within each table (1 = cheapest) and ties share a rank. Hosted tables rank on the per-hour rate.

| Provider                                  | Released      | Word timestamps            | Duration             | File size            | Pricing      | Cost rank |
| ----------------------------------------- | ------------- | -------------------------- | -------------------- | -------------------- | ------------ | --------- |
| Gemini `gemini-3.8-flash`                 | ✅ 2026-09    | ❌ Segment timestamps only | ✅ 9.5 hours         | ❌ 20 MiB / 2 GiB    | ❌ $0.173/hr | 5/6       |
| Gemini `gemini-3.6-flash`                 | ✅ 2026-07    | ❌ Segment timestamps only | ✅ 9.5 hours         | ❌ 20 MiB / 2 GiB    | ❌ $0.173/hr | 5/6       |
| Together `nvidia/parakeet-tdt-0.6b-v3`    | ❌ 2025-08-14 | ✅ Native words            | ⚠️ 4 hours           | ⚠️ 500 MiB           | ⚠️ $0.09/hr  | 3/6       |
| DeepInfra `openai/whisper-large-v3-turbo` | ❌ 2024-09    | ✅ Native words            | ✅ No documented cap | ✅ No documented cap | ✅ $0.012/hr | 1/6       |
| DeepInfra `openai/whisper-large-v3`       | ❌ 2023-11    | ✅ Native words            | ✅ No documented cap | ✅ No documented cap | ✅ $0.027/hr | 2/6       |
| Together `openai/whisper-large-v3`        | ❌ 2023-11    | ✅ Native words            | ⚠️ 4 hours           | ❌ 20 MiB            | ⚠️ $0.09/hr  | 3/6       |
