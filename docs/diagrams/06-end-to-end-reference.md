# End-to-End Execution Reference

A current trace of a write command from native CLI dispatch through output artifacts, plus environment variable references from local config sources.

## Outline

- [Example Trace](#example-trace)
- [Expected Artifacts](#expected-artifacts)
- [Provider API Keys](#provider-api-keys)
- [Base URL Overrides](#base-url-overrides)
- [Provider Defaults and Runtime Env](#provider-defaults-and-runtime-env)

## Example Trace

Example command:

```bash
bun autoshow write "https://youtube.com/watch?v=abc123" --stt whisper=small --llm llama --rendered-text --prompt-md
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
            logger, yt-dlp cookies, llama model path
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
            |    runLLM() through the local llama.cpp pool
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

| Area | Variables |
|------|-----------|
| OpenAI | `OPENAI_API_KEY` for write/OCR/TTS/image. |
| Grok/xAI | `XAI_API_KEY` for write/STT/OCR/TTS/image/video. |
| Gemini | `GEMINI_API_KEY` for write/STT/OCR/TTS/image/video/music. |
| GLM | `GLM_API_KEY` for write/OCR/video. |
| Kimi | `KIMI_API_KEY` for write/OCR. |
| Together | `TOGETHER_API_KEY` for write/STT. |
| Cerebras | `CEREBRAS_API_KEY` for write. |
| Video-only | `RUNWAYML_API_SECRET`, `LTXV_API_KEY`. |
| Luma Labs | `LUMA_AGENTS_API_KEY` for image. |
| Replicate | `REPLICATE_API_TOKEN` for image/video. |
| Mistral | `MISTRAL_API_KEY` for STT/OCR/TTS. |
| Image-only | `BFL_API_KEY`, `RECRAFT_API_TOKEN`. |
| Anthropic | `ANTHROPIC_API_KEY` for write/OCR. |
| Groq | `GROQ_API_KEY` for write/STT/TTS. |
| DeepInfra | `DEEPINFRA_API_KEY` for STT/OCR. |
| MiniMax | `MINIMAX_API_KEY` for write/TTS/video/music. |
| ElevenLabs | `ELEVENLABS_API_KEY` for TTS/music. |
| STT-only | `ASSEMBLYAI_API_KEY`, `GLADIA_API_KEY`, `SONIOX_API_KEY`, `SPEECHMATICS_API_KEY`, `REVAI_ACCESS_TOKEN`, `HAPPYSCRIBE_API_KEY`, `SCRAPECREATORS_API_KEY`. |
| STT/TTS or STT/URL | `DEEPGRAM_API_KEY`, `SUPADATA_API_KEY`. |
| TTS-only | `SPEECHIFY_API_KEY`, `HUME_API_KEY`, `CARTESIA_API_KEY`. |
| URL/X | `FIRECRAWL_API_KEY`, `SPIDER_API_KEY`, `ZYTE_API_KEY`, `X_BEARER_TOKEN`. |
| Hosted asset downloads | `HUGGINGFACE_TOKEN` for Reverb assets. |

## Base URL Overrides

**Removed (ADR-005).** The per-provider base-URL / endpoint override env vars (`OPENAI_BASE_URL`, `ANTHROPIC_BASE_URL`, `GROQ_BASE_URL`, `MISTRAL_BASE_URL`, `XAI_BASE_URL`, `ZAI_BASE_URL`/GLM, `KIMI_BASE_URL`, `TOGETHER_BASE_URL`, `CEREBRAS_BASE_URL`, `MINIMAX_BASE_URL`, `DEEPGRAM_BASE_URL`, `DEEPINFRA_BASE_URL`, `ASSEMBLYAI_BASE_URL`, `GLADIA_BASE_URL`, `SONIOX_BASE_URL`, `SPEECHMATICS_BASE_URL`, `HAPPYSCRIBE_BASE_URL`, `REVAI_BASE_URL`, `SUPADATA_BASE_URL`, `SCRAPECREATORS_BASE_URL`, `ELEVENLABS_BASE_URL`, `CARTESIA_BASE_URL`, `HUME_BASE_URL`, `SPEECHIFY_BASE_URL`, `FIRECRAWL_API_URL`, `SPIDER_API_URL`, `ZYTE_API_URL`, `UNSTRUCTURED_API_URL`, `BFL_BASE_URL`, `REVE_BASE_URL`, `RECRAFT_BASE_URL`, …) are **no longer read.** Every provider resolves to a fixed default endpoint in [`base-urls.ts`](../../src/utils/base-urls.ts); contract tests inject a typed `baseUrl` parameter in-process instead.

Runway and LTX video clients use their provider API endpoints with `RUNWAYML_API_SECRET` and `LTXV_API_KEY`.

## Provider Defaults and Runtime Env

Runtime configuration is **flag-driven**: the shipped CLI reads no `AUTOSHOW_*` runtime-config, base-URL, timeout, or TTS-tuning env vars — they were removed or replaced by flags. The only environment input is provider API keys (above), `HUGGINGFACE_TOKEN`, and the `NO_COLOR` / `FORCE_COLOR` conventions.

| Area | Mechanism |
|------|-----------|
| Local model selection | `--model-path` flag (`configureModelPath`); `HUGGINGFACE_TOKEN` env for gated asset downloads. |
| TTS voices / reference audio / API versions | Per-run flags only (`--tts-voice`, `--tts-ref-audio`, `--hume-tts-voice-provider`, …); defaults are code constants in [`tts-models.ts`](../../src/cli/commands/setup-and-utilities/models/tts-models.ts). The Cartesia `Cartesia-Version` and Hume `version` headers are fixed constants. |
| Output / external binaries | `--output-root`, `--bin-dir` flags. |
| URL backend | `--url-provider` flag. |
| Logging / color | `--log-level`, `--log-format` (plus `--verbose` / `--quiet` / `--json`); `NO_COLOR` / `FORCE_COLOR` honored, with `--color` / `--no-color` taking precedence. |
| Timeouts | Fixed code constants (no env overrides). |
| yt-dlp auth/cookies | `--cookies` and `--cookies-from-browser` flags. |
