# Diarization

These configured engines enable diarization by default. Select a model with `--provider provider=model`; omit `=model` to use the default listed below. Shared [controls](../overview.md#provider-controls), credentials, and pricing are in the [STT guide](../overview.md).

## Providers

### AssemblyAI

Default `assemblyai-stt-3-7`; supports `--speaker-count N`, which AssemblyAI treats as a hard cap on speaker labels rather than a hint. 3.7 requests send `disfluencies: false` and `format_text: true`, so transcripts omit fillers, repetitions and false starts and keep numbers in written form, matching earlier AssemblyAI output. `--stt-filler-words true` sends `disfluencies: true` to keep them, and `--stt-number-format spoken` sends `format_text: false`. Both flags are 3.7-only: `universal-3-5-pro` rejects them before pricing, credentials, and dispatch, so its request is unchanged. Results record the model AssemblyAI reports it ran (`providerModelUsed`) and warn when it differs from the request.

`universal-3-5-pro` is deprecated by AssemblyAI (retirement date to be announced) and stays selectable only by explicit name; it is excluded from the bare default and `--all-stt`. Episode publishing still pins it.

```bash
bun autoshow extract input/examples/audio/1-audio.mp3 --provider assemblyai=assemblyai-stt-3-7 --diarization --speaker-count 2 --price
bun autoshow extract input/examples/audio/1-audio.mp3 --provider assemblyai=universal-3-5-pro --diarization --price
bun autoshow extract input/examples/audio/1-audio.mp3 --provider assemblyai=assemblyai-stt-3-7 --stt-filler-words true --price
bun autoshow extract input/examples/audio/1-audio.mp3 --provider assemblyai=assemblyai-stt-3-7 --stt-number-format spoken --price
```

### Gemini STT

Default `gemini-3.5-transcribe`. The Interactions API adapter retains native word annotations even with `--no-diarization`; speaker-count hints are ignored. Attribution for three or more speakers remains experimental in the configured model notes.

### Deepgram

Default `nova-3`; no speaker-count hint.

### Gladia

Default `solaria-3`; supports `--speaker-count N`. The configured model supports English, French, German, Spanish, and Italian.

### Grok STT

Default `grok-voice-transcribe-2.0`; requests send `format=true` and omit `filler_words`. `--stt-filler-words true|false` sets `filler_words`, and `--stt-number-format written|spoken` sets `format` (`written` is `true`). `--stt-verbatim grok=true` is shorthand for filler words kept and spoken numbers; combining it with `--stt-filler-words false` or `--stt-number-format written` is rejected.

```bash
bun autoshow extract input/examples/audio/1-audio.mp3 --provider grok=grok-voice-transcribe-2.0 --stt-verbatim true --price
bun autoshow extract input/examples/audio/1-audio.mp3 --provider grok=grok-voice-transcribe-2.0 --stt-filler-words true --stt-number-format written --price
```

### Mistral

Default `voxtral-mini-2602`; diarization supplies segment timing. Use `--no-diarization` for native words.

### Soniox

Default `stt-async-v5`; no speaker-count hint.

### Speechmatics

Default `melia-1`; no speaker-count hint.

## Provider Capabilities

All listed engines expose word evidence except Mistral with diarization. Native timestamps and provider speaker labels are evidence, not independent correctness or identity verification. AutoShow splits requests according to model limits. Use `--price` for the selected audio/options rather than a copied hourly-rate table; AssemblyAI includes a removable diarization add-on, and Soniox's duration estimate approximates token billing.
