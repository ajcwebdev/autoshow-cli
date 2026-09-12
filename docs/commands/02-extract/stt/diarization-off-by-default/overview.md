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

Gemini 3.8 Flash is available as `gemini-3.8-flash` for writing/OCR (`gemini`) and prompted audio extraction (`gemini-stt`), with existing selectors and defaults preserved. Writing and OCR support low/medium/high reasoning; minimal and disabled are rejected. STT uses the provider default thinking level (medium), without a reasoning override. Requests omit legacy sampling controls; the transport rejects incompatible 3.8 settings before dispatch. Audio timestamps remain generated, with no native word alignment claim.

Pricing checked 2026-09-08: introductory $0.75/$3.75 per million input/output tokens through 2026-12-31, then $1.50/$7.50 starting 2027-01-01. AutoShow follows its existing conservative policy and uses the standard rates for estimates and usage-based cost calculations even during the introductory window. Automatic date transitions are unsupported; recheck the tariff and refresh all three price paths by 2027-01-01. STT uses a $0.1728/hour audio-input baseline (32 tokens/second), then accounts for prompt, candidate and thinking tokens from returned usage. OCR page and writing/STT latency heuristics are reused and provisional; caching and discounted service tiers are excluded.

Sources: [model specification](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash), [migration guide](https://ai.google.dev/gemini-api/docs/latest-model?hl=en), [pricing](https://ai.google.dev/gemini-api/docs/pricing).

| Option   | Value                         |
| -------- | ----------------------------- |
| Selector | `--provider gemini[=<model>]` |
| Models   | `gemini-3.8-flash`, `gemini-3.6-flash`            |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider gemini
```

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

Marks: ✅ supported, ⚠️ partial or qualified, ❌ not exposed. Released dates are provider announcement or model-origin dates. Recency marks: current-year GA is ✅, older still-current snapshots are ⚠️, and pre-2026 engines are ❌. Rows are newest first.

Duration uses the same marks: under 2 hours is ❌, 2–4 hours is ⚠️, 5+ hours or no documented cap is ✅. File size uses ❌ under 100 MiB, ⚠️ 100 MiB to under 1 GiB, and ✅ 1 GiB or no cap.

Pricing is the AutoShow estimate rate. Cost rank orders models cheapest-first within each table (1 = cheapest) and ties share a rank. Hosted tables rank on the per-hour rate; the Direct URL table ranks on per-request retrieval cost.

| Provider                                  | Released      | Word timestamps            | Duration             | File size                 | Pricing   | Cost rank |
| ----------------------------------------- | ------------- | -------------------------- | -------------------- | ------------------------- | --------- | --------- |
| Gemini `gemini-3.6-flash`                 | ✅ 2026-07    | ❌ Segment timestamps only | ✅ No documented cap | ❌ 20 MiB / 2 GiB         | $0.173/hr | 5/5       |
| Together `nvidia/parakeet-tdt-0.6b-v3`    | ⚠️ 2025-08-14 | ✅ Native words | ⚠️ 4 hours           | ⚠️ 500 MiB                | $0.09/hr  | 3/5       |
| DeepInfra `openai/whisper-large-v3-turbo` | ❌ 2024-09    | ✅ Native words | ✅ No documented cap | ✅ No documented cap      | $0.012/hr | 1/5       |
| DeepInfra `openai/whisper-large-v3`       | ❌ 2023-11    | ✅ Native words | ✅ No documented cap | ✅ No documented cap      | $0.027/hr | 2/5       |
| Together `openai/whisper-large-v3`        | ❌ 2023-11    | ✅ Native words | ⚠️ 4 hours           | ❌ 20 MiB                 | $0.09/hr  | 3/5       |
