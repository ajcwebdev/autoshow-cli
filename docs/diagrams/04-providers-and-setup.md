# Providers, Models & Setup

Provider selection, LLM fan-out, setup flow, and dependency/env readiness reference.

## Outline

- [LLM Provider Fan-Out](#llm-provider-fan-out)
- [Selector Conventions](#selector-conventions)
- [Setup Pipeline](#setup-pipeline)
- [Hosted Provider Env Checks](#hosted-provider-env-checks)
- [Setup Dependencies](#setup-dependencies)

## LLM Provider Fan-Out

```
runLLM()
  |
  v
collectLlmTargets(--llm and defaults)
  |
  v
runLlmProviderTargetPools()
   |
   v
   hosted pool
   concurrency: llmProvider...
   default 10
   |
   +--> openai
   +--> groq
   +--> gemini
   +--> anthropic
   +--> minimax
   +--> grok
   +--> glm
   +--> kimi
   +--> together
   +--> cerebras
   |
   v
text.json or text-<model>.json
Step3Metadata in items[].metadata
```

Current LLM models:

| Provider    | Models                                                                                                           |
| ----------- | ---------------------------------------------------------------------------------------------------------------- |
| `openai`    | `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`, `gpt-5.5`, `gpt-5.4-mini`, `gpt-5.4-nano`                        |
| `groq`      | `openai/gpt-oss-20b`, `openai/gpt-oss-120b`                                                                      |
| `gemini`    | `gemini-3.1-pro-preview`, `gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-3.5-flash-lite`                        |
| `anthropic` | `claude-fable-5`, `claude-opus-4-8`, `claude-sonnet-5`, `claude-sonnet-4-6`, `claude-haiku-4-5`, `claude-opus-5` |
| `minimax`   | `MiniMax-M3`                                                                                                     |
| `grok`      | `grok-4.3`, `grok-4.5`                                                                                           |
| `glm`       | `glm-5.1`                                                                                                        |
| `kimi`      | `kimi-k2.6`, `kimi-k3`                                                                                           |
| `together`  | `kimi-k2.6`, `glm-5.1`                                                                                           |
| `cerebras`  | `gpt-oss-120b`, `zai-glm-4.7`                                                                                    |

## Selector Conventions

Provider selectors use `provider[=model]`. Repeating a selector creates a multi-provider run.

| Surface                                  | Selector flags                                                                                                                   |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `extract`, `resume`                      | `--provider`, `--all-providers`, `--all-local`, `--provider-concurrency`, `--local-concurrency`                                  |
| standalone `tts`/`image`/`video`/`music` | `--provider`, `--all-providers`, `--provider-concurrency`, `--local-concurrency`                                                 |
| `write`, `config`                        | `--stt`, `--ocr`, `--llm`, `--tts`, `--image`, `--video`, `--music`, plus `--all-providers <step>` and `--all-local stt|ocr|url` |

Current hosted/local provider families:

| Step  | Providers                                                                                                                                                                                                                |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| STT   | Local: `whisper`, `whisperfile`. Hosted: `deepinfra`, `deepgram`, `soniox`, `speechmatics`, `rev`, `groq`, `grok`, `mistral`, `assemblyai`, `gladia`, `happyscribe`, `supadata`, `scrapecreators`, `gemini`, `together`. |
| OCR   | Local/native: `tesseract` plus native document extractors. Hosted: `mistral`, `glm`, `kimi`, `openai`, `grok`, `anthropic`, `gemini`, `deepinfra`, `fal`, `replicate`.                                                   |
| URL   | Local: `defuddle`. Hosted: `firecrawl`, `glm-reader`, `spider`, `supadata`, `zyte`.                                                                                                                                      |
| LLM   | Hosted: `openai`, `groq`, `gemini`, `anthropic`, `minimax`, `grok`, `glm`, `kimi`, `together`, `cerebras`. Write has no local LLM.                                                                                       |
| TTS   | Hosted: `elevenlabs`, `minimax`, `groq`, `grok`, `mistral`, `openai`, `gemini`, `deepgram`, `speechify`, `hume`, `cartesia`, `fish`, `inworld`, `deepinfra`, `replicate`, `fal`.                                         |
| Image | `gemini`, `openai`, `grok`, `bfl`, `replicate`, `lumalabs`, `fal`.                                                                                                                                                       |
| Video | `gemini`, `minimax`, `grok`, `ltx`, `replicate`, `lumalabs`, `fal`; MiniMax remains parseable only to provide replacement guidance for retired direct-video selectors.                                                                    |
| Music | `elevenlabs`, `minimax`, `gemini`.                                                                                                                                                                                       |

## Setup Pipeline

`bun autoshow setup` runs `runCompleteSetup()`:

```
log pinned versions, ensure runtime directories
  |
  v
log hosted provider configuration
  |
  v
concurrent setup tasks
  |
  +--> setupYtDependencies()      ffmpeg, ffprobe, yt-dlp
  +--> setupDefuddleCli()         HTML/article extraction helper
   +--> setupWhisper()             whisper.cpp binary
   +--> downloadWhisperModel()     tiny and large-v3-turbo models
   +--> setupWhisperfile()         default whisperfile model
   +--> setupCalibreDocumentTools()
   +--> setupTesseractOcr()
   |
   v
   validate whisper-cli --help
  |
  v
log setup summary (local tools, local models, hosted providers)
```

Step-specific setup commands reuse those pieces:

| Setup step    | Work performed                                                                   |
| ------------- | -------------------------------------------------------------------------------- |
| transcription | Whisper readiness, `large-v3-turbo` model, hosted STT env checks.                |
| whisperfile   | Download the default whisperfile model (`tiny`) into `runtime/bin/whisperfile/`. |
| write         | Hosted LLM env checks.                                                           |
| tts           | Hosted TTS env checks.                                                           |
| image         | Hosted image env checks.                                                         |
| video         | Hosted video env checks.                                                         |
| music         | Hosted music env checks plus ffmpeg/ffprobe, Whisper `large-v3-turbo`.           |

## Hosted Provider Env Checks

These checks come from `HOSTED_PROVIDER_ENV_CHECKS`:

| Env var                  | Provider coverage                          |
| ------------------------ | ------------------------------------------ |
| `OPENAI_API_KEY`         | OpenAI write/OCR/TTS/image                 |
| `XAI_API_KEY`            | Grok write/STT/OCR/TTS/image/video         |
| `GEMINI_API_KEY`         | Gemini write/STT/OCR/TTS/image/video/music |
| `GLM_API_KEY`            | GLM write/OCR                              |
| `KIMI_API_KEY`           | Kimi write/OCR                             |
| `CEREBRAS_API_KEY`       | Cerebras write                             |
| `LTXV_API_KEY`           | LTX video                                  |
| `MISTRAL_API_KEY`        | Mistral STT/OCR/TTS                        |
| `BFL_API_KEY`            | BFL image                                  |
| `LUMA_AGENTS_API_KEY`    | Luma Labs image/video                      |
| `FAL_API_KEY`            | fal.ai image/video/TTS/OCR                 |
| `STABILITY_API_KEY`      | Stability AI sound effects                 |
| `REPLICATE_API_TOKEN`    | Replicate OCR/image/video/TTS              |
| `ANTHROPIC_API_KEY`      | Anthropic write/OCR                        |
| `GROQ_API_KEY`           | Groq write/STT/TTS                         |
| `DEEPINFRA_API_KEY`      | DeepInfra STT/OCR/TTS                      |
| `MINIMAX_API_KEY`        | MiniMax write/TTS/music                    |
| `ELEVENLABS_API_KEY`     | ElevenLabs TTS/music                       |
| `ASSEMBLYAI_API_KEY`     | AssemblyAI STT                             |
| `GLADIA_API_KEY`         | Gladia STT                                 |
| `DEEPGRAM_API_KEY`       | Deepgram STT/TTS                           |
| `SPEECHIFY_API_KEY`      | Speechify TTS                              |
| `HUME_API_KEY`           | Hume TTS                                   |
| `CARTESIA_API_KEY`       | Cartesia TTS                               |
| `FISH_API_KEY`           | Fish Audio TTS                             |
| `INWORLD_API_KEY`        | Inworld AI TTS                             |
| `SONIOX_API_KEY`         | Soniox STT                                 |
| `SPEECHMATICS_API_KEY`   | Speechmatics STT                           |
| `REVAI_ACCESS_TOKEN`     | Rev STT                                    |
| `TOGETHER_API_KEY`       | Together write/STT                         |
| `HAPPYSCRIBE_API_KEY`    | Happy Scribe STT                           |
| `SUPADATA_API_KEY`       | Supadata STT/URL                           |
| `SCRAPECREATORS_API_KEY` | ScrapeCreators STT                         |
| `FIRECRAWL_API_KEY`      | Firecrawl URL                              |
| `SPIDER_API_KEY`         | Spider URL                                 |
| `ZYTE_API_KEY`           | Zyte URL                                   |
| `X_BEARER_TOKEN`         | X Spaces metadata and download lookup      |

## Setup Dependencies

| Command/route                | Local dependencies                                                                           | Hosted/config dependencies                                                                                                                                                |
| ---------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `metadata` media             | ffprobe for local files, yt-dlp metadata for streaming URLs.                                 | Configured cookies for authenticated downloads when needed.                                                                                                               |
| `metadata` X Space           | none beyond normal runtime.                                                                  | `X_BEARER_TOKEN`.                                                                                                                                                         |
| `download` media             | ffmpeg/ffprobe, yt-dlp.                                                                      | Same auth/cookies support.                                                                                                                                                |
| `download` X Space           | ffmpeg/ffprobe, yt-dlp.                                                                      | `X_BEARER_TOKEN` for post URL lookup; same auth/cookies support for playback when needed.                                                                                 |
| `extract` media              | ffmpeg/ffprobe, yt-dlp, `whisper-cli` for `whisper`, prebuilt whisperfile for `whisperfile`. | Selected hosted STT key.                                                                                                                                                  |
| `extract` document OCR       | MuPDF/Tesseract as selected; Calibre/native extractors for conversion/native routes.         | Selected hosted OCR key.                                                                                                                                                  |
| `extract` article            | Defuddle for local/default article extraction.                                               | Firecrawl, GLM, Spider, Supadata, or Zyte keys for hosted URL backends.                                                                                                   |
| `extract` X Space            | none beyond normal runtime.                                                                  | `X_BEARER_TOKEN`.                                                                                                                                                         |
| `extract --transcript-video` | ffmpeg render stack and source audio/result files.                                           | No provider call when using existing results/text.                                                                                                                        |
| `write`                      | Route-specific extract dependencies. Write has no local LLM.                                 | Selected hosted LLM key.                                                                                                                                                  |
| `write --text-input`         | local `.md`/`.txt` files.                                                                    | Selected hosted LLM/generation keys.                                                                                                                                      |
| `tts`                        | none for hosted-only providers.                                                              | Selected hosted TTS key.                                                                                                                                                  |
| `image`                      | none for hosted-only providers.                                                              | `GEMINI_API_KEY`, `OPENAI_API_KEY`, `XAI_API_KEY`, `BFL_API_KEY`, `FAL_API_KEY`, `REPLICATE_API_TOKEN`, or `LUMA_AGENTS_API_KEY`.                                         |
| `video`                      | local input media/image validation where used.                                               | `GEMINI_API_KEY`, `XAI_API_KEY`, `LTXV_API_KEY`, `FAL_API_KEY`, `REPLICATE_API_TOKEN`, or `LUMA_AGENTS_API_KEY`. |
| `music` hosted               | none for hosted-only generation.                                                             | `ELEVENLABS_API_KEY`, `MINIMAX_API_KEY`, or `GEMINI_API_KEY`.                                                                                                             |
| `music --audio`/`--batch`    | ffmpeg, ffprobe, `whisper-cli`, local Whisper `large-v3-turbo`.                              | No hosted music key required for local lyric-video rendering.                                                                                                             |
