# Diarization Off by Default

Together leaves diarization off by default and supports `--diarization` and `--speaker-count`. Cloudflare, DeepInfra, and OpenAI do not provide diarization through these models. See [provider controls](../overview.md#provider-controls) for model-specific behavior.

See the [STT overview](../overview.md) for shared options, environment variables, pricing, and workflows.

## Providers

### Cloudflare

| Option   | Value                                                                                   |
| -------- | --------------------------------------------------------------------------------------- |
| Selector | `--provider cloudflare[=<model>]`                                                       |
| Models   | `@cf/openai/whisper-large-v3-turbo`, `@cf/openai/whisper`, `@cf/openai/whisper-tiny-en` |

```bash
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider cloudflare
bun autoshow extract https://ajc.pics/autoshow/examples/1-audio.mp3 --provider cloudflare=@cf/openai/whisper-large-v3-turbo
```

Bare `--provider cloudflare` defaults to the cheapest model, `@cf/openai/whisper-tiny-en`. Set both `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. `@cf/openai/whisper-tiny-en` is an English-only beta model with no published price; its estimate uses measured Neuron usage rather than a published model rate.

For prepaid usage, create an authenticated AI Gateway, select **Unified billing** in its Workers AI billing settings, load prepaid credits, and set `CLOUDFLARE_AI_GATEWAY_ID` to that gateway's ID. The gateway's billing setting controls payment; the environment variable alone does not change it. Without a gateway, Workers Free has a daily allowance and additional usage requires Workers Paid. Cloudflare adds a 5% credit-purchase fee that AutoShow's inference estimates exclude, along with taxes, free allowances, and discounts. See [Unified Billing](https://developers.cloudflare.com/ai-gateway/features/unified-billing/) and [gateway billing setup](https://developers.cloudflare.com/ai-gateway/configuration/manage-gateway/#configure-workers-ai-billing).

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

Bare `--provider together` defaults to `nvidia/parakeet-tdt-0.6b-v3`. AutoShow splits uploads at 20 MiB for both models, below the provider's 80 MB direct-upload limit.

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

Pricing is the AutoShow per-hour estimate. Limits apply to each request; AutoShow splits larger inputs. "No configured cap" means AutoShow has no fixed limit for that dimension; the provider may still reject the request.

| Provider                                                        | Word timestamps | Duration          | File size         | Pricing    |
| --------------------------------------------------------------- | --------------- | ----------------- | ----------------- | ---------- |
| OpenAI `gpt-transcribe`                                         | Text only       | No configured cap | 25 MiB            | $0.27/hr   |
| DeepInfra `nvidia/Nemotron-3.5-ASR-Streaming-Multilingual-0.6b` | Native words    | 15 minutes        | No configured cap | $0.012/hr  |
| DeepInfra `Qwen/Qwen3-ASR-1.7B`                                 | Native words    | 30 minutes        | No configured cap | $0.027/hr  |
| DeepInfra `Qwen/Qwen3-ASR-0.6B`                                 | Native words    | 30 minutes        | No configured cap | $0.012/hr  |
| Together `nvidia/parakeet-tdt-0.6b-v3`                          | Native words    | 4 hours           | 20 MiB            | $0.09/hr   |
| DeepInfra `mistralai/Voxtral-Small-24B-2507`                    | Text only       | 30 minutes        | No configured cap | $0.18/hr   |
| DeepInfra `mistralai/Voxtral-Mini-3B-2507`                      | Text only       | 30 minutes        | No configured cap | $0.06/hr   |
| Cloudflare `@cf/openai/whisper-large-v3-turbo`                  | Native words    | No configured cap | 8 MiB             | $0.031/hr  |
| DeepInfra `openai/whisper-large-v3-turbo`                       | Native words    | No configured cap | No configured cap | $0.012/hr  |
| DeepInfra `openai/whisper-large-v3`                             | Native words    | No configured cap | No configured cap | $0.027/hr  |
| Together `openai/whisper-large-v3`                              | Native words    | 4 hours           | 20 MiB            | $0.09/hr   |
| Cloudflare `@cf/openai/whisper`                                 | Native words    | No configured cap | 4 MiB             | $0.027/hr  |
| Cloudflare `@cf/openai/whisper-tiny-en`                         | Native words    | No configured cap | 4 MiB             | $0.0004/hr |
