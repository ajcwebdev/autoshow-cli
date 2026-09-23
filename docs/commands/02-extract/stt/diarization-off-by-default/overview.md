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

Bare `--provider deepinfra` defaults to `openai/whisper-large-v3-turbo`.

### Together

| Option   | Value                                                    |
| -------- | -------------------------------------------------------- |
| Selector | `--provider together[=<model>]`                          |
| Models   | `nvidia/parakeet-tdt-0.6b-v3`, `openai/whisper-large-v3` |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider together
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider together=openai/whisper-large-v3
```

Bare `--provider together` defaults to `nvidia/parakeet-tdt-0.6b-v3`. `nvidia/nemotron-3-asr-streaming-0.6b` and `nvidia/nemotron-3.5-asr-streaming-0.6b` are streaming-only and are not selectable.

### OpenAI

| Option   | Value                         |
| -------- | ----------------------------- |
| Selector | `--provider openai[=<model>]` |
| Models   | `gpt-transcribe`              |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider openai
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider openai=gpt-transcribe
```

Bare `--provider openai` defaults to `gpt-transcribe`. On document and image inputs `--provider openai` still routes to [OpenAI OCR](../../ocr/overview.md).

## Provider Capabilities

Rows are newest first. Pricing is the AutoShow per-hour estimate.

| Provider                                                        | Released   | Word timestamps | Duration          | File size         | Pricing   |
| --------------------------------------------------------------- | ---------- | --------------- | ----------------- | ----------------- | --------- |
| OpenAI `gpt-transcribe`                                         | 2026-07-28 | Text only       | No documented cap | 25 MB             | $0.27/hr  |
| DeepInfra `nvidia/Nemotron-3.5-ASR-Streaming-Multilingual-0.6b` | 2026-06-04 | Native words    | 15 minutes        | No documented cap | $0.012/hr |
| DeepInfra `Qwen/Qwen3-ASR-1.7B`                                 | 2026-01-29 | Native words    | 30 minutes        | No documented cap | $0.027/hr |
| DeepInfra `Qwen/Qwen3-ASR-0.6B`                                 | 2026-01-29 | Native words    | 30 minutes        | No documented cap | $0.012/hr |
| Together `nvidia/parakeet-tdt-0.6b-v3`                          | 2025-08-14 | Native words    | 4 hours           | 500 MiB           | $0.09/hr  |
| DeepInfra `mistralai/Voxtral-Small-24B-2507`                    | 2025-07-15 | Text only       | 30 minutes        | No documented cap | $0.18/hr  |
| DeepInfra `mistralai/Voxtral-Mini-3B-2507`                      | 2025-07-15 | Text only       | 30 minutes        | No documented cap | $0.06/hr  |
| DeepInfra `openai/whisper-large-v3-turbo`                       | 2024-09    | Native words    | No documented cap | No documented cap | $0.012/hr |
| DeepInfra `openai/whisper-large-v3`                             | 2023-11    | Native words    | No documented cap | No documented cap | $0.027/hr |
| Together `openai/whisper-large-v3`                              | 2023-11    | Native words    | 4 hours           | 20 MiB            | $0.09/hr  |
