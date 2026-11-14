# Diarization

These configured engines enable diarization by default. Select a model with `--provider provider=model`; omit `=model` to use the default listed below. Shared [controls](../overview.md#provider-controls), credentials, and pricing are in the [STT guide](../overview.md).

## Providers

### AssemblyAI

Default `universal-3-5-pro`; supports `--speaker-count N`.

```bash
bun autoshow extract input/examples/audio/1-audio.mp3 --provider assemblyai=universal-3-5-pro --diarization --speaker-count 2 --price
```

### Gemini STT

Default `gemini-3.5-transcribe`. The Interactions API adapter retains native word annotations even with `--no-diarization`; speaker-count hints are ignored. Attribution for three or more speakers remains experimental in the configured model notes.

### Deepgram

Default `nova-3`; no speaker-count hint.

### Gladia

Default `solaria-3`; supports `--speaker-count N`. The configured model supports English, French, German, Spanish, and Italian.

### Grok STT

Default `grok-voice-transcribe-2.0`; `--stt-verbatim grok=true` requests fillers without display formatting.

### Mistral

Default `voxtral-mini-2602`; diarization supplies segment timing. Use `--no-diarization` for native words.

### Soniox

Default `stt-async-v5`; no speaker-count hint.

### Speechmatics

Default `melia-1`; no speaker-count hint.

## Provider Capabilities

All listed engines expose word evidence except Mistral with diarization. Native timestamps and provider speaker labels are evidence, not independent correctness or identity verification. AutoShow splits requests according to model limits. Use `--price` for the selected audio/options rather than a copied hourly-rate table; AssemblyAI includes a removable diarization add-on, and Soniox's duration estimate approximates token billing.
