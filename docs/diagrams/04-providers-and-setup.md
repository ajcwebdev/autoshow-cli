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
  +------------------------------+------------------------------+
  | hosted pool                  | local pool                   |
  | concurrency: llmProvider...  | concurrency: llmLocal...     |
  | default 10                   | default 10                   |
  +------------------------------+------------------------------+
  | openai                       | llama.cpp                    |
  | groq                         | llamafile                    |
  | gemini                       |                              |
  | anthropic                    |                              |
  | minimax                      |                              |
  | grok                         |                              |
  | glm                          |                              |
  | kimi                         |                              |
  | together                     |                              |
  | cerebras                     |                              |
  +------------------------------+------------------------------+
          |
          v
text.json or text-<model>.json
Step3Metadata in run.json
```

Current LLM models:

| Provider | Models |
|----------|--------|
| `openai` | `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`, `gpt-5.5`, `gpt-5.4-mini`, `gpt-5.4-nano` |
| `groq` | `openai/gpt-oss-20b`, `openai/gpt-oss-120b` |
| `gemini` | `gemini-3.1-pro-preview`, `gemini-3.1-flash-lite`, `gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-3.5-flash-lite` |
| `anthropic` | `claude-fable-5`, `claude-opus-4-8`, `claude-sonnet-5`, `claude-sonnet-4-6`, `claude-haiku-4-5`, `claude-opus-5` |
| `minimax` | `MiniMax-M3` |
| `grok` | `grok-4.3`, `grok-4.5` |
| `glm` | `glm-5.1` |
| `kimi` | `kimi-k2.6`, `kimi-k3` |
| `together` | `kimi-k2.6`, `glm-5.1` |
| `cerebras` | `gpt-oss-120b`, `zai-glm-4.7` |
| `llama` | `ggml-org/gemma-3-270m-it-GGUF`, `ggml-org/Qwen3-0.6B-GGUF`, or another Hugging Face repo/model configured for llama.cpp |
| `llamafile` | `Qwen3.5-0.8B-Q8_0`, `Qwen3.5-2B-Q8_0`, `Qwen3.5-4B-Q5_K_S` (prebuilt single-file llamafiles; downloaded on demand) |

## Selector Conventions

Provider selectors use `provider[=model]`. Repeating a selector creates a multi-provider run.

| Surface | Selector flags |
|---------|----------------|
| `extract`, `resume`, standalone `tts`/`image`/`video`/`music` | `--provider`, `--all-providers`, `--all-local`, `--provider-concurrency`, `--local-concurrency` |
| `write`, `config` | `--stt`, `--ocr`, `--llm`, `--tts`, `--image`, `--video`, `--music`, plus `--all-providers <step>` and `--all-local <step>` |

Current hosted/local provider families:

| Step | Providers |
|------|-----------|
| STT | Local: `whisper`, `whisperfile`, `reverb`. Hosted: `deepinfra`, `deepgram`, `soniox`, `speechmatics`, `rev`, `groq`, `grok`, `mistral`, `assemblyai`, `gladia`, `happyscribe`, `supadata`, `scrapecreators`, `gemini`, `together`. |
| OCR | Local/native: `tesseract` plus native document extractors. Hosted: `mistral`, `glm`, `kimi`, `openai`, `grok`, `anthropic`, `gemini`, `deepinfra`, `unstructured`. |
| URL | Local: `defuddle`. Hosted: `firecrawl`, `glm-reader`, `spider`, `supadata`, `zyte`. |
| TTS | Local: `kitten`. Hosted: `elevenlabs`, `minimax`, `groq`, `grok`, `mistral`, `openai`, `gemini`, `deepgram`, `speechify`, `hume`, `cartesia`. |
| Image | `gemini`, `openai`, `grok`, `bfl`, `recraft`, `replicate`, `lumalabs`, `fal`. |
| Video | `gemini`, `minimax`, `glm`, `grok`, `runway`, `ltx`, `replicate`, `lumalabs`, `fal`. |
| Music | `elevenlabs`, `minimax`, `gemini`. |

Image model examples include Gemini `gemini-3.1-flash-lite-image`/`gemini-3.1-flash-image`/`gemini-3-pro-image`, OpenAI `gpt-image-2`, Grok `grok-imagine-image-quality` and `grok-imagine-image`, BFL `flux-2-klein-4b`/`flux-2-klein-9b`/`flux-2-pro`/`flux-2-max`/`flux-2-flex`, Recraft `recraftv4_1*` variants, Replicate `bytedance/seedream-4.5`, `qwen/qwen-image-2`, and `wan-video/wan-2.7-image` families, and Luma Labs `uni-1`/`uni-1-max`.

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
  +--> runLlamaSetup()            llama.cpp server binary
  +--> ensureLlamaModelDownloaded(default)
  +--> setupReverb()              Reverb ASR Python env and assets
  +--> setupCalibreDocumentTools()
  +--> setupTesseractOcr()
  +--> setupKittenTts() + default Kitten model
  |
  v
validate whisper-cli --help and llama-server --version
  |
  v
log setup summary (local tools, local models, hosted providers)
```

Step-specific setup commands reuse those pieces:

| Setup step | Work performed |
|------------|----------------|
| transcription | Whisper/Reverb readiness, `large-v3-turbo` model, hosted STT env checks. |
| whisperfile | Download the default whisperfile model (`tiny`) into `runtime/bin/whisperfile/`. |
| write | llama.cpp setup, supported llama model downloads, hosted LLM env checks. |
| llamafile | Download the default llamafile bundle (`Qwen3.5-0.8B-Q8_0`) into `runtime/bin/llamafile/`. |
| tts | Kitten TTS setup, all Kitten models, hosted TTS env checks. |
| image | Hosted image env checks. |
| video | Hosted video env checks. |
| music | Hosted music env checks plus ffmpeg/ffprobe, ASS/Pango/ImageMagick render helpers, Whisper `large-v3-turbo`. |

## Hosted Provider Env Checks

These checks come from `HOSTED_PROVIDER_ENV_CHECKS`:

| Env var | Provider coverage |
|---------|-------------------|
| `OPENAI_API_KEY` | OpenAI write/OCR/TTS/image |
| `XAI_API_KEY` | Grok write/STT/OCR/TTS/image/video |
| `GEMINI_API_KEY` | Gemini write/STT/OCR/TTS/image/video/music |
| `GLM_API_KEY` | GLM write/OCR/video |
| `KIMI_API_KEY` | Kimi write/OCR |
| `RUNWAYML_API_SECRET` | Runway video |
| `LTXV_API_KEY` | LTX video |
| `MISTRAL_API_KEY` | Mistral STT/OCR/TTS |
| `UNSTRUCTURED_API_KEY` | Unstructured OCR |
| `BFL_API_KEY` | BFL image |
| `RECRAFT_API_TOKEN` | Recraft image |
| `REPLICATE_API_TOKEN` | Replicate image/video |
| `LUMA_AGENTS_API_KEY` | Luma Labs image/video |
| `ANTHROPIC_API_KEY` | Anthropic write/OCR |
| `GROQ_API_KEY` | Groq write/STT/TTS |
| `DEEPINFRA_API_KEY` | DeepInfra STT/OCR |
| `MINIMAX_API_KEY` | MiniMax write/TTS/video/music |
| `ELEVENLABS_API_KEY` | ElevenLabs TTS/music |
| `ASSEMBLYAI_API_KEY` | AssemblyAI STT |
| `GLADIA_API_KEY` | Gladia STT |
| `DEEPGRAM_API_KEY` | Deepgram STT/TTS |
| `SPEECHIFY_API_KEY` | Speechify TTS |
| `HUME_API_KEY` | Hume TTS |
| `CARTESIA_API_KEY` | Cartesia TTS |
| `SONIOX_API_KEY` | Soniox STT |
| `SPEECHMATICS_API_KEY` | Speechmatics STT |
| `REVAI_ACCESS_TOKEN` | Rev STT |
| `TOGETHER_API_KEY` | Together write/STT |
| `CEREBRAS_API_KEY` | Cerebras write |
| `HAPPYSCRIBE_API_KEY` | Happy Scribe STT |
| `SUPADATA_API_KEY` | Supadata STT/URL |
| `SCRAPECREATORS_API_KEY` | ScrapeCreators STT |
| `FIRECRAWL_API_KEY` | Firecrawl URL |
| `SPIDER_API_KEY` | Spider URL |
| `ZYTE_API_KEY` | Zyte URL |
| `X_BEARER_TOKEN` | X Space metadata, extraction, and post-to-Space download lookup |
| `HUGGINGFACE_TOKEN` | Hugging Face Reverb assets |

## Setup Dependencies

| Command/route | Local dependencies | Hosted/config dependencies |
|---------------|--------------------|----------------------------|
| `metadata` media | ffprobe for local files, yt-dlp metadata for streaming URLs. | Cookies flags/env for authenticated downloads when needed. |
| `metadata` X Space | none beyond normal runtime. | `X_BEARER_TOKEN`. |
| `download` media | ffmpeg/ffprobe, yt-dlp. | Same auth/cookies support. |
| `download` X Space | ffmpeg/ffprobe, yt-dlp. | `X_BEARER_TOKEN` for post URL lookup; same auth/cookies support for playback when needed. |
| `extract` media | ffmpeg/ffprobe, yt-dlp, `whisper-cli` for `whisper`, prebuilt whisperfile for `whisperfile`, Reverb env for `reverb`. | Selected hosted STT key. |
| `extract` document OCR | MuPDF/Tesseract as selected; Calibre/native extractors for conversion/native routes. | Selected hosted OCR key. |
| `extract` article | Defuddle for local/default article extraction. | Firecrawl, GLM, Spider, Supadata, or Zyte keys for hosted URL backends. |
| `extract` X Space | none beyond normal runtime. | `X_BEARER_TOKEN`. |
| `extract --transcript-video` | ffmpeg render stack and source audio/result files. | No provider call when using existing results/text. |
| `write` | Route-specific extract dependencies plus llama.cpp or llamafile for local LLM. | Selected hosted LLM key. |
| `write --text-input` | local `.md`/`.txt` files; llama.cpp or llamafile if using local LLM. | Selected hosted LLM/generation keys. |
| `tts --provider kitten` | Kitten TTS Python env and models. | Hosted TTS key for hosted providers. |
| `image` | none for hosted-only providers. | `GEMINI_API_KEY`, `OPENAI_API_KEY`, `XAI_API_KEY`, `BFL_API_KEY`, `RECRAFT_API_TOKEN`, `REPLICATE_API_TOKEN`, or `LUMA_AGENTS_API_KEY`. |
| `video` | local input media/image validation where used. | `GEMINI_API_KEY`, `MINIMAX_API_KEY`, `GLM_API_KEY`, `XAI_API_KEY`, `RUNWAYML_API_SECRET`, `LTXV_API_KEY`, `REPLICATE_API_TOKEN`, or `LUMA_AGENTS_API_KEY`. |
| `music` hosted | none for hosted-only generation. | `ELEVENLABS_API_KEY`, `MINIMAX_API_KEY`, or `GEMINI_API_KEY`. |
| `music --audio`/`--batch` | ffmpeg, ffprobe, subtitle render helpers, `whisper-cli`, local Whisper `large-v3-turbo`. | No hosted music key required for local lyric-video rendering. |
