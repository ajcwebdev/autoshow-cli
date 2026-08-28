# Providers, Models & Setup

Hosted and local provider families, LLM fan-out, setup flow, and API-key requirements.

## Outline

- [LLM Provider Fan-Out](#llm-provider-fan-out)
- [Provider Families](#provider-families)
- [Setup Pipeline](#setup-pipeline)
- [Hosted Provider Env Checks](#hosted-provider-env-checks)
- [Setup Dependencies](#setup-dependencies)

## LLM Provider Fan-Out

`write` runs each `--llm` selection (plus config defaults) through the hosted LLM pool. `--provider-concurrency` caps how many models run at once (default `7`). One model writes `text.json`; more than one writes `text-<model>.json`.

```
write --llm
  |
  v
hosted LLM pool
concurrency: --provider-concurrency
  |
  v
text.json or text-<model>.json
```

Current model IDs are listed in command help.

## Provider Families

Selectors use `provider[=model]`. Repeat a flag to run more than one provider. Flags by command are in [System Overview](01-system-overview-cli.md#flag-system).

| Step  | Providers                                                                                                                                                                                                                |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| STT   | Local: `whisper`, `whisperfile`. Hosted: `deepinfra`, `deepgram`, `soniox`, `speechmatics`, `rev`, `groq`, `grok`, `mistral`, `assemblyai`, `gladia`, `happyscribe`, `supadata`, `scrapecreators`, `gemini`, `together`. |
| OCR   | Local/native: `tesseract` plus native document extractors. Hosted: `mistral`, `glm`, `kimi`, `openai`, `grok`, `anthropic`, `gemini`, `deepinfra`, `fal`, `replicate`.                                                   |
| URL   | Local: `defuddle`. Hosted: `firecrawl`, `glm-reader`, `spider`, `supadata`, `zyte`.                                                                                                                                      |
| LLM   | Hosted: `openai`, `groq`, `gemini`, `anthropic`, `minimax`, `grok`, `glm`, `kimi`, `together`, `cerebras`. Write has no local LLM.                                                                                       |
| TTS   | Hosted: `elevenlabs`, `minimax`, `groq`, `grok`, `mistral`, `openai`, `gemini`, `deepgram`, `speechify`, `hume`, `cartesia`, `fish`, `inworld`, `deepinfra`, `replicate`, `fal`.                                         |
| Image | `gemini`, `openai`, `grok`, `bfl`, `replicate`, `lumalabs`, `fal`.                                                                                                                                                       |
| Video | `gemini`, `grok`, `ltx`, `replicate`, `lumalabs`, `fal`.                                                                                                                                                                 |
| Music | `elevenlabs`, `minimax`, `gemini`.                                                                                                                                                                                       |

## Setup Pipeline

`bun autoshow setup` installs local tools and reports hosted provider API-key readiness:

```
report which hosted API keys are set
  |
  v
install local tools in parallel
  |
  +--> ffmpeg, ffprobe, yt-dlp
  +--> Defuddle
  +--> Whisper binary and models (tiny, large-v3-turbo)
  +--> mutool, qpdf, ebook-convert
  +--> Tesseract
  |
  v
print setup summary
```

`--step` runs one of `yt-dlp`, `defuddle`, `whisper-binary`, `whisper-model`, `whisperfile`, `calibre`, `transcription`, or `music` in isolation.

## Hosted Provider Env Checks

Hosted commands require the matching environment variable:

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
| `FAL_API_KEY`            | fal.ai image/video/TTS                     |
| `STABILITY_API_KEY`      | Stability AI sound effects                 |
| `REPLICATE_API_TOKEN`    | Replicate image/video/TTS                  |
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
| `TOGETHER_API_KEY`       | Together write/STT                         |
| `HAPPYSCRIBE_API_KEY`    | Happy Scribe STT                           |
| `SUPADATA_API_KEY`       | Supadata STT/URL                           |
| `SCRAPECREATORS_API_KEY` | ScrapeCreators STT                         |
| `FIRECRAWL_API_KEY`      | Firecrawl URL                              |
| `SPIDER_API_KEY`         | Spider URL                                 |
| `ZYTE_API_KEY`           | Zyte URL                                   |
| `X_BEARER_TOKEN`         | X Spaces metadata and download lookup      |

## Setup Dependencies

| Command/route                | Local dependencies                                              | Hosted/config dependencies      |
| ---------------------------- | --------------------------------------------------------------- | ------------------------------- |
| `metadata` media             | ffprobe for local files, yt-dlp for streaming URLs              | Cookies when needed             |
| `metadata` X Space           | none                                                            | `X_BEARER_TOKEN`                |
| `download` media             | ffmpeg/ffprobe, yt-dlp                                          | Cookies when needed             |
| `download` X Space           | ffmpeg/ffprobe, yt-dlp                                          | `X_BEARER_TOKEN`; cookies when needed |
| `extract` media              | ffmpeg/ffprobe, yt-dlp, plus Whisper or whisperfile for local STT | Selected hosted STT key       |
| `extract` document OCR       | mutool and Tesseract when selected; Calibre for conversion      | Selected hosted OCR key         |
| `extract` article            | Defuddle                                                        | Selected hosted URL key         |
| `extract` X Space            | none                                                            | `X_BEARER_TOKEN`                |
| `extract --transcript-video` | ffmpeg plus source audio and transcript files                   | none                            |
| `write`                      | local `.md`/`.txt` files                                        | Selected hosted LLM key         |
| `tts`                        | none                                                            | Selected hosted TTS key         |
| `image`                      | none                                                            | Selected hosted image key       |
| `video`                      | source image or video when required                             | Selected hosted video key       |
| `music` hosted               | none                                                            | Selected hosted music key       |
| `music --audio`/`--batch`    | ffmpeg, ffprobe, and local Whisper `large-v3-turbo`             | none                            |
