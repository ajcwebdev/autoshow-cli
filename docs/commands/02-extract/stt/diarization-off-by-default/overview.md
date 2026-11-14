# Diarization Off by Default

Together supports opt-in diarization; Cloudflare, DeepInfra, and OpenAI do not expose it through these configured models. See [shared controls](../overview.md#provider-controls) and the [STT guide](../overview.md).

## Providers

### Cloudflare

Models: `@cf/openai/whisper-large-v3-turbo`, `@cf/openai/whisper`, and default `@cf/openai/whisper-tiny-en`. Set both `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

```bash
bun autoshow extract input/examples/audio/1-audio.mp3 --provider cloudflare=@cf/openai/whisper-large-v3-turbo --price
```

The configured tiny-English estimate uses measured Neuron usage rather than a published model rate. Optional `CLOUDFLARE_AI_GATEWAY_ID` routes through that configured gateway; payment terms and fees remain provider-controlled. An inference estimate establishes neither account eligibility nor billing setup.

### DeepInfra

Default `openai/whisper-large-v3-turbo`. Other models: `openai/whisper-large-v3`, `Qwen/Qwen3-ASR-0.6B`, `Qwen/Qwen3-ASR-1.7B`, `mistralai/Voxtral-Mini-3B-2507`, `mistralai/Voxtral-Small-24B-2507`, and `nvidia/Nemotron-3.5-ASR-Streaming-Multilingual-0.6b`.

```bash
bun autoshow extract input/examples/audio/1-audio.mp3 --provider deepinfra=Qwen/Qwen3-ASR-1.7B --captions --price
```

Verbose JSON is the default; the two Voxtral models return text without native words. `--stt-response-format deepinfra=srt|vtt` selects subtitle text instead.

### Together

Models: default `nvidia/parakeet-tdt-0.6b-v3` and `openai/whisper-large-v3`. `--diarization` enables speaker labels; `--speaker-count N` also enables them unless `--no-diarization` is explicit. Parakeet word coverage can be incomplete. AutoShow splits uploads at 20 MiB. WebSocket-only Nemotron models are not available on this batch route.

### OpenAI

Default/only model `gpt-transcribe`, returning text without native words. `--provider openai` on document/image inputs instead selects [OCR](../../ocr/overview.md).

## Provider Capabilities

Cloudflare, Together, and supported DeepInfra models retain native words where available; SRT/VTT and text-only responses do not establish acoustic word boundaries. Consult saved timing provenance before exporting word captions. Configured limits trigger splitting; absent limits do not guarantee provider acceptance. Use `--price` for current duration-based estimates rather than fixed hourly tables.
