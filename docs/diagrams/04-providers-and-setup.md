# Providers and Setup

## LLM Provider Fan-Out

```text
write selections / persisted defaults / cheapest eligible fallback
                         |
                         v
              hosted target pool
          --provider-concurrency cap
                         |
                         v
             shared provider/account lanes
                         |
                         v
              provider adapters --> outputs
```

Targets preserve explicit provider/model identity. Multiple write targets use model-qualified filenames, adding the provider on ID collisions. Model IDs, capabilities, and lifecycle/default eligibility come from the central registries, not this diagram.

## Provider Families

| Workflow | Local                                        | Hosted                                                                                                                             |
| -------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| STT      | Whisperfile                                  | AssemblyAI, Cloudflare, Deepgram, DeepInfra, Gemini, Gladia, Grok, Mistral, OpenAI, ScrapeCreators, Soniox, Speechmatics, Together |
| OCR      | Tesseract; format-specific native extractors | Anthropic, Gemini, Grok, Mistral, OpenAI                                                                                           |
| Articles | Defuddle                                     | Spider, Zyte                                                                                                                       |
| Write    | none                                         | Anthropic, Gemini, Grok, OpenAI                                                                                                    |
| TTS      | none                                         | ElevenLabs, Gemini, Grok, Inworld, OpenAI, Soniox                                                                                  |
| Image    | none                                         | Gemini, Grok, OpenAI                                                                                                               |
| Video    | none                                         | Gemini, Grok                                                                                                                       |
| Music    | local lyric-video only                       | ElevenLabs, Gemini, MiniMax                                                                                                        |

Selectors and controls vary by workflow; provider membership does not imply every model supports every capability. [Registry policy](../adr/ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md) defines eligibility and exclusions; command help supplies current exact selections.

## Setup Pipeline

```text
key-presence snapshot (no secret forwarding)
                 |
                 v
parallel tool setup: media / Defuddle / Whisperfile / documents / OCR
                 |
                 v
host rendering prerequisite checks
                 |
                 v
readiness summary + provenance/timing
```

`setup` installs tools; configuration flags on `setup`/`config` read or write defaults without installation. Full setup installs the default Whisperfile `tiny` bundle; lyric-video setup separately needs `small.en` when local transcription is used.

macOS uses managed installations under `runtime/`; Linux also uses packaged/PATH tools. Resolution is `--bin-dir`, then managed tools, then non-macOS `PATH`. `AUTOSHOW_PROJECT_ROOT` relocates the mutable project/runtime root. `setup --doctor` checks readiness, and `--strict` exits 2 on any warning. See [setup](../commands/00-setup-and-utilities/setup.md) for platform prerequisites and step choices.

## Hosted Provider Env Checks

The [credential registry](../../src/cli/commands/setup-and-utilities/setup/hosted-provider-config.ts) defines required variables and coverage. [.env.example](../../.env.example) lists credentials. Presence is not validity or account entitlement; selected workflows validate their own requirements. Never pass unrelated provider keys to tool subprocesses.

## Setup Dependencies

Media routes use FFmpeg/ffprobe and yt-dlp where needed. Document routes add MuPDF/qpdf, Calibre for ebook conversion, and Tesseract for local OCR. Article extraction uses Defuddle or an explicitly selected hosted backend. Caption video requires FFmpeg `ass` or ImageMagick/Pango plus fonts; merely having FFmpeg is insufficient.

Hosted generation needs its selected provider credentials and any required reference media. X Space lookup uses `X_BEARER_TOKEN`; downloading/transcribing its audio still needs the media toolchain. Protected voice assets and consent live separately from visual character references and generated run outputs.
