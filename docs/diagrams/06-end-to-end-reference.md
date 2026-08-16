# End-to-End Execution Reference

A current trace of a write command from native CLI dispatch through output artifacts, plus environment variable references from local config sources.

## Outline

- [Example Trace](#example-trace)
- [Expected Artifacts](#expected-artifacts)
- [Provider API Keys](#provider-api-keys)
- [Provider Defaults and Runtime Environment](#provider-defaults-and-runtime-environment)

## Example Trace

Example command:

```bash
bun autoshow write "https://youtube.com/watch?v=abc123" --stt whisper=small --rendered-text --prompt-md
```

```
user argv
  |
  v
src/cli/create-cli.ts
  |
  +--> dispatchNativeCli(argv, root, commands)
       |
       +--> parseNativeCli()
       +--> apply global flags:
             logger, yt-dlp cookies
       +--> command handler: write
       |
       v
define-write-command.ts
  |
  +--> handleProcessTarget("write", target, flags)
       |
       +--> resolveProcessTargetDoubleDash()
       +--> load config and merge config flags
       +--> normalizeWriteStepSelectorFlags()
       +--> buildOptsFromFlags(skipLLM=false, rawFlags)
       +--> resolveWriteTextProjectDefaults() if relevant
       +--> validate write Step 2 provider selection
       +--> resolveProcessTargetPlan()
            |
            +--> single target plan
            |
            v
       +--> resolveInputRoutingForCommand("write", target, opts)
            |
            +--> classify URL as media/streaming
            +--> resolvedStep2 route: STT
            |
            v
       +--> handleSingleTarget()
            |
            v
processSingleTarget()
  |
  +--> processMediaSingle()
       |
       +--> processVideo()
            |
            +--> Step 1:
            |    extract source metadata
            |    create output directory
            |    download/stage media
            |    prepareSttMedia()
            |
            +--> Step 2:
            |    run selected STT target whisper=small
            |    write transcription.txt and provider result
            |
            +--> Step 3:
            |    buildPrompt()
            |    write prompt.md
            |    write prompt-md.md because --prompt-md is set
             |    runLLM() through the hosted LLM pool
            |    write text.json
            |
            +--> rendered/show-note artifacts:
            |    writeRenderedTextArtifacts() -> text.md
            |    writeShowNoteArtifacts() -> show-note.md
            |
            +--> writeManifest(createManifest("write", "single", items))
```

## Expected Artifacts

```
output/YYYY-MM-DD_HH-MM-SS-mmm_<video-title>/
  audio.(mp3|m4a|ogg|flac)
  transcription.txt
  result.json                 # raw STT domain payload for a single provider
  prompt.md
  prompt-md.md
  text.json
  text.md
  show-note.md
  manifest.json
```

The canonical `manifest.json`:

```json
{
  "command": "write",
  "scope": "single",
  "createdAt": "2026-08-10T12:00:00.000Z",
  "updatedAt": "2026-08-10T12:00:05.000Z",
  "items": [
    {
      "status": "full",
      "metadata": {
        "step1": {},
        "step3": {},
        "cost": {},
        "timing": {}
      },
      "providers": [
        {
          "service": "whisper",
          "model": "small",
          "local": true,
          "artifactDir": ".",
          "status": "succeeded",
          "attempts": 1,
          "options": {},
          "metadata": {},
          "result": {}
        }
      ]
    }
  ]
}
```

For multi-provider STT or LLM selections, provider-specific artifacts move under `providers/<provider-model>/` or receive `text-<model>.json` / `text-<model>.md` names. The manifest stores item status and canonical provider entries; requested, missing, and completion views are computed from that state.

## Provider API Keys

These variables mirror `HOSTED_PROVIDER_ENV_CHECKS`.

| Area          | Variables                                                                                                                                                |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenAI        | `OPENAI_API_KEY` for write/OCR/TTS/image.                                                                                                                |
| Grok/xAI      | `XAI_API_KEY` for write/STT/OCR/TTS/image/video.                                                                                                         |
| Gemini        | `GEMINI_API_KEY` for write/STT/OCR/TTS/image/video/music.                                                                                                |
| GLM           | `GLM_API_KEY` for write/OCR/video.                                                                                                                       |
| Kimi          | `KIMI_API_KEY` for write/OCR.                                                                                                                            |
| Together      | `TOGETHER_API_KEY` for write/STT.                                                                                                                        |
| Cerebras      | `CEREBRAS_API_KEY` for write.                                                                                                                            |
| Anthropic     | `ANTHROPIC_API_KEY` for write/OCR.                                                                                                                       |
| Mistral       | `MISTRAL_API_KEY` for STT/OCR/TTS.                                                                                                                       |
| Groq          | `GROQ_API_KEY` for write/STT/TTS.                                                                                                                        |
| DeepInfra     | `DEEPINFRA_API_KEY` for STT/OCR/TTS.                                                                                                                     |
| MiniMax       | `MINIMAX_API_KEY` for write/TTS/video/music.                                                                                                             |
| ElevenLabs    | `ELEVENLABS_API_KEY` for TTS/music.                                                                                                                      |
| fal.ai        | `FAL_API_KEY` for OCR/image/video/TTS.                                                                                                                   |
| Replicate     | `REPLICATE_API_TOKEN` for OCR/image/video/TTS.                                                                                                           |
| Image-only    | `BFL_API_KEY`, `RECRAFT_API_TOKEN`.                                                                                                                      |
| Image/Video   | `LUMA_AGENTS_API_KEY` for Luma Labs image/video.                                                                                                         |
| Video-only    | `RUNWAYML_API_SECRET`, `LTXV_API_KEY`.                                                                                                                   |
| Sound effects | `STABILITY_API_KEY` for Stability AI sound effects.                                                                                                      |
| STT-only      | `ASSEMBLYAI_API_KEY`, `GLADIA_API_KEY`, `SONIOX_API_KEY`, `SPEECHMATICS_API_KEY`, `REVAI_ACCESS_TOKEN`, `HAPPYSCRIBE_API_KEY`, `SCRAPECREATORS_API_KEY`. |
| STT/TTS       | `DEEPGRAM_API_KEY`.                                                                                                                                      |
| STT/URL       | `SUPADATA_API_KEY`.                                                                                                                                      |
| TTS-only      | `SPEECHIFY_API_KEY`, `HUME_API_KEY`, `CARTESIA_API_KEY`, `FISH_API_KEY`, `INWORLD_API_KEY`.                                                              |
| URL/X         | `FIRECRAWL_API_KEY`, `SPIDER_API_KEY`, `ZYTE_API_KEY`, `X_BEARER_TOKEN`.                                                                                 |

## Provider Defaults and Runtime Environment

Runtime configuration is flag- and config-driven. The CLI reads only provider API keys and standard `NO_COLOR` / `FORCE_COLOR` environment variables at runtime.

| Area                                        | Mechanism                                                                                                                                                                                                                                                                          |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TTS voices / reference audio / API versions | Per-run flags (`--tts-voice`, `--tts-ref-audio`, `--hume-tts-voice-provider`, …); defaults are defined in [`tts-models.ts`](../../src/cli/commands/setup-and-utilities/models/tts-models.ts). Cartesia `Cartesia-Version` and Hume `version` headers are fixed protocol constants. |
| Output / external binaries                  | `--output-root`, `--bin-dir` flags.                                                                                                                                                                                                                                                |
| URL backend                                 | `--url-provider` flag.                                                                                                                                                                                                                                                             |
| Logging / color                             | `--log-level`, `--log-format` (plus `--verbose` / `--quiet` / `--json`); `NO_COLOR` / `FORCE_COLOR` honored, with `--color` / `--no-color` taking precedence.                                                                                                                      |
| Timeouts and base URLs                      | Fixed constants in provider client implementations (`base-urls.ts`).                                                                                                                                                                                                               |
| yt-dlp auth/cookies                         | `bun autoshow config --cookies` and `bun autoshow config --cookies-from-browser`; applied centrally after config load.                                                                                                                                                             |
