# Providers, Models & Setup

Hosted and local provider families, LLM fan-out, setup flow, and API-key requirements.

## Outline

- [LLM Provider Fan-Out](#llm-provider-fan-out)
- [Provider Families](#provider-families)
- [Setup Pipeline](#setup-pipeline)
- [Hosted Provider Env Checks](#hosted-provider-env-checks)
- [Setup Dependencies](#setup-dependencies)

## LLM Provider Fan-Out

`write` runs each `--provider` / `--llm` selection (plus config defaults) through the hosted LLM pool. With no selection and no saved LLM defaults, the cheapest hosted model is used. `--llm` is a compatibility alias for `--provider`; do not combine the two spellings. `--provider-concurrency` caps how many models run at once (default `7`). One model writes `text.json`. More than one writes `text-<model>.json`, and a shared model id includes the provider in the filename.

```
write --provider / --llm
  |
  v
hosted LLM pool
concurrency: --provider-concurrency
  |
  v
text.json, text-<model>.json, or text-<provider>-<model>.json
```
Current model IDs are listed in command help.

## Provider Families

Selectors use `provider[=model]`. Repeat a flag to run more than one provider. Flags by command are in [System Overview](01-system-overview-cli.md#flag-system).

| Step  | Providers                                                                                                                                                                                                |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| STT   | Local: `whisperfile`. Hosted: `deepinfra`, `deepgram`, `soniox`, `speechmatics`, `grok`, `mistral`, `assemblyai`, `gladia`, `happyscribe`, `supadata`, `scrapecreators`, `gemini`, `together`, `openai`. |
| OCR   | Local/native: `tesseract` plus native document extractors. Hosted: `mistral`, `glm`, `kimi`, `openai`, `grok`, `anthropic`, `gemini`, `deepinfra`.                                                       |
| URL   | Local: `defuddle`. Hosted: `firecrawl`, `glm-reader`, `spider`, `supadata`, `zyte`.                                                                                                                      |
| LLM   | Hosted: `openai`, `gemini`, `anthropic`, `grok`, `glm`, `kimi`, `together`. Write has no local LLM.                                                                                                      |
| TTS   | Hosted: `elevenlabs`, `grok`, `mistral`, `openai`, `speechify`, `inworld`.                                                                                                                               |
| Image | `gemini`, `openai`, `grok`, `replicate`, `lumalabs`, `fal`.                                                                                                                                              |
| Video | `gemini`, `grok`, `ltx`, `replicate`, `lumalabs`, `fal`.                                                                                                                                                 |
| Music | `elevenlabs`, `minimax`, `gemini`.                                                                                                                                                                       |

## Setup Pipeline

`bun autoshow setup` installs local tools and reports hosted provider API-key readiness. Configuration flags on `setup` (and the `config` alias) also read and write `config/autoshow.json` without running installation.

```
report which hosted API keys are set
  |
  v
install local tools in parallel
  |
  +--> ffmpeg, ffprobe, yt-dlp
  +--> Defuddle
  +--> Whisperfile bundle (tiny)
  +--> mutool, qpdf, ebook-convert
  +--> Tesseract
  |
  v
check ImageMagick, Fontconfig with DejaVu Sans, and the ffmpeg ass filter or pango-view
  |
  v
print setup summary
```
`--step` runs one of `yt-dlp`, `defuddle`, `whisperfile`, `calibre`, `transcription`, or `music` in isolation. `all` runs the full pipeline. The default step is `all`.

## Hosted Provider Env Checks

Hosted commands require the matching environment variable:

| Env var                  | Provider coverage                      |
| ------------------------ | -------------------------------------- |
| `OPENAI_API_KEY`         | OpenAI write/STT/OCR/TTS/image         |
| `XAI_API_KEY`            | Grok write/STT/OCR/TTS/image/video     |
| `GEMINI_API_KEY`         | Gemini write/STT/OCR/image/video/music |
| `GLM_API_KEY`            | GLM write/OCR/URL                      |
| `KIMI_API_KEY`           | Kimi write/OCR                         |
| `LTXV_API_KEY`           | LTX video                              |
| `MISTRAL_API_KEY`        | Mistral STT/OCR/TTS                    |
| `LUMA_AGENTS_API_KEY`    | Luma Labs image/video                  |
| `FAL_API_KEY`            | fal.ai image/video                     |
| `STABILITY_API_KEY`      | Stability AI sound effects             |
| `REPLICATE_API_TOKEN`    | Replicate image/video                  |
| `ANTHROPIC_API_KEY`      | Anthropic write/OCR                    |
| `DEEPINFRA_API_KEY`      | DeepInfra STT/OCR                      |
| `MINIMAX_API_KEY`        | MiniMax music                          |
| `ELEVENLABS_API_KEY`     | ElevenLabs TTS/music                   |
| `ASSEMBLYAI_API_KEY`     | AssemblyAI STT                         |
| `GLADIA_API_KEY`         | Gladia STT                             |
| `DEEPGRAM_API_KEY`       | Deepgram STT                           |
| `SPEECHIFY_API_KEY`      | Speechify TTS                          |
| `INWORLD_API_KEY`        | Inworld AI TTS                         |
| `SONIOX_API_KEY`         | Soniox STT                             |
| `SPEECHMATICS_API_KEY`   | Speechmatics STT                       |
| `TOGETHER_API_KEY`       | Together write/STT                     |
| `HAPPYSCRIBE_API_KEY`    | Happy Scribe STT                       |
| `SUPADATA_API_KEY`       | Supadata STT/URL                       |
| `SCRAPECREATORS_API_KEY` | ScrapeCreators STT                     |
| `FIRECRAWL_API_KEY`      | Firecrawl URL                          |
| `SPIDER_API_KEY`         | Spider URL                             |
| `ZYTE_API_KEY`           | Zyte URL                               |
| `X_BEARER_TOKEN`         | X Spaces metadata and download lookup  |

## Setup Dependencies

| Command/route                | Local dependencies                                         | Hosted/config dependencies                            |
| ---------------------------- | ---------------------------------------------------------- | ----------------------------------------------------- |
| `metadata` media             | ffprobe for local files, yt-dlp for streaming URLs         | Cookies when needed                                   |
| `metadata` X Space           | none                                                       | `X_BEARER_TOKEN`                                      |
| `download` media             | ffmpeg/ffprobe, yt-dlp                                     | Cookies when needed                                   |
| `download` X Space           | ffmpeg/ffprobe, yt-dlp                                     | `X_BEARER_TOKEN` for X post URLs; cookies when needed |
| `extract` media              | ffmpeg/ffprobe, yt-dlp, plus whisperfile for local STT     | Selected hosted STT key                               |
| `extract` document OCR       | mutool and Tesseract when selected; Calibre for conversion | Selected hosted OCR key                               |
| `extract` article            | Defuddle                                                   | Selected hosted URL key                               |
| `extract` X Space            | none                                                       | `X_BEARER_TOKEN`                                      |
| `extract --transcript-video` | ffmpeg plus source audio and transcript files              | none                                                  |
| `write`                      | local `.md`/`.txt` files                                   | Selected hosted LLM key                               |
| `tts`                        | none                                                       | Selected hosted TTS key                               |
| `image`                      | none                                                       | Selected hosted image key                             |
| `video`                      | source image or video when required                        | Selected hosted video key                             |
| `music` hosted               | none                                                       | Selected hosted music key                             |
| `music --audio`/`--batch`    | ffmpeg, ffprobe, and local whisperfile `small.en`          | none                                                  |
