# Diarization Off by Default

These providers leave diarization off by default. Together retains optional diarization and speaker-count controls. See [provider controls](../overview.md#provider-controls) for model-specific behavior.

See the [STT overview](../overview.md) for shared options, environment variables, pricing, and workflows.

## Providers

### DeepInfra

| Option   | Value                                                                                                                                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Selector | `--provider deepinfra[=<model>]`                                                                                                                                                                                                      |
| Models   | `openai/whisper-large-v3-turbo`, `openai/whisper-large-v3`, `Qwen/Qwen3-ASR-0.6B`, `Qwen/Qwen3-ASR-1.7B`, `mistralai/Voxtral-Mini-3B-2507`, `mistralai/Voxtral-Small-24B-2507`, `nvidia/Nemotron-3.5-ASR-Streaming-Multilingual-0.6b` |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider deepinfra
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider deepinfra=openai/whisper-large-v3
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider deepinfra=Qwen/Qwen3-ASR-1.7B
```

Bare `--provider deepinfra` defaults to `openai/whisper-large-v3-turbo`. Every model runs on the same OpenAI-compatible `/v1/audio/transcriptions` route. Both Voxtral deployments return transcript text with null `words` and null `segments`, so AutoShow records one whole-request segment and no native word timing for them. `nvidia/Nemotron-3.5-ASR-Streaming-Multilingual-0.6b` is a streaming architecture upstream, but DeepInfra serves it on the batch file route; its released date below is the Nemotron 3.5 ASR streaming family origin because the multilingual weights are not publicly dated.

### Together

| Option   | Value                                                    |
| -------- | -------------------------------------------------------- |
| Selector | `--provider together[=<model>]`                          |
| Models   | `nvidia/parakeet-tdt-0.6b-v3`, `openai/whisper-large-v3` |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider together
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider together=openai/whisper-large-v3
```

Bare `--provider together` defaults to `nvidia/parakeet-tdt-0.6b-v3`. Together's `nvidia/nemotron-3-asr-streaming-0.6b` and `nvidia/nemotron-3.5-asr-streaming-0.6b` are not selectable: the batch transcription endpoint rejects file uploads for both with `This model only supports WebSocket streaming.`

### OpenAI

| Option   | Value                         |
| -------- | ----------------------------- |
| Selector | `--provider openai[=<model>]` |
| Models   | `gpt-transcribe`              |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider openai
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider openai=gpt-transcribe
```

`gpt-transcribe` rejects `response_format` `verbose_json`, `srt`, and `vtt`, so AutoShow requests `json` and records one whole-request segment with no native word timing. `whisper-1`, `gpt-4o-transcribe`, `gpt-4o-mini-transcribe`, and `gpt-4o-transcribe-diarize` are deprecated with a 2027-02-26 shutdown and are not selectable, and streaming-only `gpt-live-transcribe` is outside the batch route. On document and image inputs `--provider openai` still routes to [OpenAI OCR](../../ocr/overview.md).

## Provider Capabilities

Marks: ✅ supported, ⚠️ partial or qualified, ❌ not exposed. Released dates are provider announcement or model-origin dates. Recency marks: ✅ 2026-04-01 or later, ⚠️ 2026-01-01 through 2026-03-31, ❌ before 2026-01-01. Rows are newest first.

Duration uses the same marks: under 2 hours is ❌, 2–4 hours is ⚠️, 5+ hours or no documented cap is ✅. File size uses ❌ under 100 MiB, ⚠️ 100 MiB to under 1 GiB, and ✅ 1 GiB or no cap.

Pricing is the AutoShow estimate rate. Pricing: ✅ cheapest third, ⚠️ middle third, ❌ most expensive third. Cost rank orders models cheapest-first within each table (1 = cheapest) and ties share a rank. Hosted tables rank on the per-hour rate.

| Provider                                                        | Released      | Word timestamps | Duration             | File size            | Pricing      | Cost rank |
| --------------------------------------------------------------- | ------------- | --------------- | -------------------- | -------------------- | ------------ | --------- |
| OpenAI `gpt-transcribe`                                         | ✅ 2026-07-28 | ❌ Text only    | ✅ No documented cap | ❌ 25 MB             | ❌ $0.27/hr  | 10/10     |
| DeepInfra `nvidia/Nemotron-3.5-ASR-Streaming-Multilingual-0.6b` | ✅ 2026-05-15 | ✅ Native words | ✅ No documented cap | ✅ No documented cap | ✅ $0.012/hr | 1/10      |
| DeepInfra `Qwen/Qwen3-ASR-1.7B`                                 | ⚠️ 2026-01-28 | ✅ Native words | ✅ No documented cap | ✅ No documented cap | ✅ $0.027/hr | 4/10      |
| DeepInfra `Qwen/Qwen3-ASR-0.6B`                                 | ⚠️ 2026-01-28 | ✅ Native words | ✅ No documented cap | ✅ No documented cap | ✅ $0.012/hr | 1/10      |
| Together `nvidia/parakeet-tdt-0.6b-v3`                          | ❌ 2025-08-14 | ✅ Native words | ⚠️ 4 hours           | ⚠️ 500 MiB           | ⚠️ $0.09/hr  | 7/10      |
| DeepInfra `mistralai/Voxtral-Small-24B-2507`                    | ❌ 2025-07-01 | ❌ Text only    | ✅ No documented cap | ✅ No documented cap | ❌ $0.18/hr  | 9/10      |
| DeepInfra `mistralai/Voxtral-Mini-3B-2507`                      | ❌ 2025-07-01 | ❌ Text only    | ✅ No documented cap | ✅ No documented cap | ⚠️ $0.06/hr  | 6/10      |
| DeepInfra `openai/whisper-large-v3-turbo`                       | ❌ 2024-09    | ✅ Native words | ✅ No documented cap | ✅ No documented cap | ✅ $0.012/hr | 1/10      |
| DeepInfra `openai/whisper-large-v3`                             | ❌ 2023-11    | ✅ Native words | ✅ No documented cap | ✅ No documented cap | ✅ $0.027/hr | 4/10      |
| Together `openai/whisper-large-v3`                              | ❌ 2023-11    | ✅ Native words | ⚠️ 4 hours           | ❌ 20 MiB            | ⚠️ $0.09/hr  | 7/10      |
