# config

View or set persistent CLI defaults saved to `config/autoshow.json`.

`bun autoshow` is the canonical command used throughout this guide. `bun as` is an equivalent shorthand, so `bun as config --help` and `bun autoshow config --help` invoke the same command.

## Outline

- [Usage](#usage)
- [Config File Location](#config-file-location)
- [Setting Defaults](#setting-defaults)
- [Config Schema](#config-schema)
- [Persisted Defaults](#persisted-defaults)
- [Precedence](#precedence)
- [Pricing And Budgets](#pricing-and-budgets)
- [Recommended Configs](#recommended-configs)
- [Flags](#flags)

## Usage

```bash
bun autoshow config [flags]
bun autoshow config --show
bun autoshow config --reset
```

No input argument is required. Flags explicitly passed to `config` are persisted to `config/autoshow.json` when they map to reusable defaults.

Runtime-only options (such as `--show`, `--reset`, `--config-path`, budget overrides, input file passwords, custom-voice creation audio, and one-shot image/video references) are never persisted.

## Config File Location

Default path: `config/autoshow.json` in the project root, located by walking up to the nearest `package.json`.

Override with `--config-path <path>`:

```bash
bun autoshow config --show --config-path ./input/my-autoshow.json
bun autoshow write input/examples/audio/1-audio.mp3 --config-path ./input/my-autoshow.json
```

## Setting Defaults

```bash
bun autoshow config --llm openai=gpt-5.4-mini
bun autoshow config --llm glm=glm-5.1
bun autoshow config --llm kimi=kimi-k2.6
bun autoshow config --stt whisper=large-v3-turbo
bun autoshow config --stt happyscribe=auto --stt-happyscribe-organization-id org_123
bun autoshow config --stt supadata=auto --stt-supadata-lang en
bun autoshow config --ocr tesseract
bun autoshow config --ocr mistral=mistral-ocr-2512 --ocr-language eng --ocr-dpi 300
bun autoshow config --tts elevenlabs=eleven_v3 --elevenlabs-voice voice_123
bun autoshow config --tts minimax=speech-2.8-hd --minimax-tts-language-boost English --tts-speed 1.15
bun autoshow config --tts grok=grok-tts --tts-language auto --tts-text-normalization true
bun autoshow config --tts mistral=voxtral-mini-tts-2603 --mistral-tts-voice voice_existing
bun autoshow config --tts openai=gpt-4o-mini-tts-2025-12-15 --tts-instructions "Warm documentary narration" --tts-speed 1.1
bun autoshow config --tts deepgram=aura-2-thalia-en --deepgram-tts-container wav --deepgram-tts-sample-rate 24000
bun autoshow config --tts speechify=simba-3.2 --tts-voice george --tts-output-format mp3 --tts-language en-US
bun autoshow config --tts hume=octave-2 --tts-voice "Male English Actor"
bun autoshow config --tts cartesia=sonic-3.5-2026-05-04 --tts-voice f786b574-daa5-4673-aa0c-cbe3e8534c02
bun autoshow config --tts gemini=gemini-3.1-flash-tts-preview --tts-speaker Host=Kore --tts-speaker Guest=Puck --tts-chunk-concurrency 3
bun autoshow config --image recraft=recraftv4_1 --image-size 1024x1024 --image-count 2
bun autoshow config --video ltx=ltx-2-3-fast --video-duration 8 --video-resolution 1080p
bun autoshow config --batch-limit 20 --batch-order oldest --batch-concurrency 2
bun autoshow config --concurrency-mode immediate
bun autoshow config --prompt shortSummary --prompt longChapters
bun autoshow config --chapters --length 50 --pdf-chapter-mode auto
bun autoshow config --max-cents 100
bun autoshow config --cookies-from-browser chrome
bun autoshow config --cookies /absolute/path/to/runtime/auth/youtube.cookies.txt
```

Model selector flags are repeatable. Repeating a provider selector saves all selected models in first-seen order:

```bash
bun autoshow config --stt deepinfra=openai/whisper-large-v3 --stt deepinfra=openai/whisper-large-v3-turbo
bun autoshow config --llm openai=gpt-5.5 --llm openai=gpt-5.4-mini
```

## Config Schema

Representative JSON shape:

```json
{
  "defaults": {
    "concurrency": {
      "mode": "ramp"
    },
    "extract": {
      "stt": {
        "whisper": ["large-v3-turbo"],
        "youtubeCaptions": true,
        "deepinfraStt": ["openai/whisper-large-v3-turbo"],
        "groqStt": ["whisper-large-v3-turbo"],
        "grokStt": ["speech-to-text"],
        "deepgramStt": ["nova-3"],
        "sonioxStt": ["stt-async-v5"],
        "speechmaticsStt": ["enhanced"],
        "revStt": ["machine"],
        "mistralStt": ["voxtral-mini-2602"],
        "assemblyaiStt": ["universal-3-5-pro"],
        "gladiaStt": ["solaria-1"],
        "happyscribeStt": ["auto"],
        "supadataStt": ["auto"],
        "scrapecreatorsStt": ["youtube-transcript"],
        "geminiStt": ["gemini-3.6-flash"],
        "happyscribeOrganizationId": "org_123",
        "supadataLang": "en",
        "scrapecreatorsLang": "en",
        "speakerCount": 2,
        "split": true,
        "providerConcurrency": 2,
        "localConcurrency": 1,
        "segmentConcurrency": 2,
        "preflightConcurrency": 4
      },
      "ocr": {
        "lang": "eng",
        "out": "text",
        "tesseract": true,
        "dpi": 300,
        "mistralOcr": ["mistral-ocr-2512"],
        "glmOcr": ["glm-ocr"],
        "kimiOcr": ["kimi-k2.6"],
        "openaiOcr": ["gpt-5.4-nano"],
        "grokOcr": ["grok-4.3"],
        "anthropicOcr": ["claude-haiku-4-5"],
        "geminiOcr": ["gemini-3.5-flash-lite"],
        "deepinfraOcr": ["Qwen/Qwen3-VL-30B-A3B-Instruct"],
        "replicateOcr": ["datalab-to/ocr"],
        "falOcr": ["fal-ai/got-ocr/v2"],
        "chapters": true,
        "length": 50,
        "pdfChapterMode": "auto"
      }
    },
    "llm": {
      "openai": ["gpt-5.5", "gpt-5.4-mini"],
      "groq": ["openai/gpt-oss-20b"],
      "gemini": ["gemini-3.5-flash-lite"],
      "anthropic": ["claude-haiku-4-5"],
      "minimax": ["MiniMax-M3"],
      "grok": ["grok-4.3"],
      "glm": ["glm-5.1"],
      "kimi": ["kimi-k2.6"],
      "together": ["kimi-k2.6"],
      "cerebras": ["gpt-oss-120b"],
      "providerConcurrency": 2,
      "localConcurrency": 1
    },
    "post": {
      "tts": {
        "elevenlabsTts": ["eleven_v3"],
        "minimaxTts": ["speech-2.8-turbo"],
        "minimaxTtsLanguageBoost": "English",
        "minimaxTtsSpeed": 1.1,
        "minimaxTtsEnglishNormalization": true,
        "groqTts": ["canopylabs/orpheus-v1-english"],
        "groqVoice": "troy",
        "grokTts": ["grok-tts"],
        "grokTtsLanguage": "auto",
        "grokTtsTextNormalization": true,
        "mistralTts": ["voxtral-mini-tts-2603"],
        "mistralTtsVoice": "voice_existing",
        "ttsDialogueFormat": "screenplay",
        "ttsSpeakers": ["Host=Kore", "Guest=Puck"],
        "openaiTts": ["gpt-4o-mini-tts-2025-12-15"],
        "openaiTtsInstructions": "Warm documentary narration",
        "openaiTtsSpeed": 1.1,
        "geminiTts": ["gemini-3.1-flash-tts-preview"],
        "geminiVoice": "Kore",
        "deepgramTts": ["aura-2-thalia-en"],
        "deepgramTtsContainer": "wav",
        "deepgramTtsSampleRate": 24000,
        "speechifyTts": ["simba-3.2"],
        "speechifyVoice": "george",
        "speechifyTtsAudioFormat": "mp3",
        "speechifyTtsLanguage": "en-US",
        "humeTts": ["octave-2"],
        "humeTtsVoice": "Male English Actor",
        "humeTtsVoiceProvider": "HUME_AI",
        "cartesiaTts": ["sonic-3.5-2026-05-04"],
        "cartesiaTtsVoice": "f786b574-daa5-4673-aa0c-cbe3e8534c02",
        "cartesiaTtsLanguage": "en",
        "fishTts": ["s2.1-pro"],
        "inworldTts": ["realtime-tts-2"],
        "deepinfraTts": ["ResembleAI/chatterbox-turbo"],
        "replicateTts": ["jaaari/kokoro-82m"],
        "falTts": ["fal-ai/bytedance/seed-speech/tts/v2"],
        "providerConcurrency": 2,
        "localConcurrency": 1,
        "chunkConcurrency": 3
      },
      "image": {
        "geminiImage": ["gemini-3.1-flash-lite-image"],
        "openaiImage": ["gpt-image-2"],
        "grokImage": ["grok-imagine-image"],
        "bflImage": ["flux-2-pro"],
        "recraftImage": ["recraftv4_1"],
        "falImage": ["fal-ai/hidream-o1-image"],
        "imageAspectRatio": "16:9",
        "imageSize": "1024x1024",
        "imageQuality": "low",
        "imageFormat": "png",
        "imageBackground": "auto",
        "imageCount": 1,
        "providerConcurrency": 2,
        "localConcurrency": 1
      },
      "video": {
        "geminiVideo": ["veo-3.1-fast-generate-preview"],
        "minimaxVideo": ["MiniMax-Hailuo-2.3"],
        "glmVideo": ["cogvideox-3"],
        "grokVideo": ["grok-imagine-video"],
        "runwayVideo": ["gen4.5"],
        "ltxVideo": ["ltx-2-3-fast"],
        "falVideo": ["minimax/h3"],
        "videoDuration": 8,
        "videoSize": "1280x720",
        "videoAspectRatio": "16:9",
        "videoResolution": "720p",
        "videoMode": "text",
        "videoInputImage": "input/reference.png",
        "videoLastFrame": "input/last-frame.png",
        "videoReferenceImages": ["input/reference-1.png"],
        "videoInputVideo": "input/source.mp4",
        "grokVideoStorageFilename": "autoshow-source.mp4",
        "grokVideoStorageExpiresAfter": 86400,
        "providerConcurrency": 2,
        "localConcurrency": 1
      },
      "music": {
        "elevenlabsMusic": ["music_v1"],
        "minimaxMusic": ["music-3.0"],
        "geminiMusic": ["lyria-3-clip-preview"],
        "musicDuration": 30,
        "providerConcurrency": 2,
        "localConcurrency": 1
      }
    },
    "batch": {
      "limit": 5,
      "order": "newest",
      "concurrency": 1
    },
    "prompts": ["shortSummary", "longChapters"]
  },
  "pricing": {
    "maxCents": 100
  },
  "auth": {
    "cookies": "/absolute/path/to/runtime/auth/youtube.cookies.txt",
    "cookiesFromBrowser": "chrome"
  }
}
```

## Persisted Defaults

Model-selecting fields are arrays of models, not single strings.

### defaults.concurrency

| Field | Flag |
|-------|------|
| `mode` | `--concurrency-mode ramp\|immediate` |

The default mode is `ramp`. It starts each hosted provider/account lane at one logical request and adds one slot every five seconds while queued demand exists. `immediate` starts at the applicable configured cap. Both modes retain rate-limit pressure recovery, and neither mode changes local provider, rendering, preparation, or preflight scheduling.

### defaults.extract.stt

| Field | Flag |
|-------|------|
| `whisper` and hosted STT model fields | `--stt provider[=model]` |
| `youtubeCaptions` | `--youtube-captions` |
| `happyscribeOrganizationId`, `supadataLang`, `scrapecreatorsLang` | `--stt-happyscribe-organization-id`, `--stt-supadata-lang`, `--stt-scrapecreators-lang` |
| `speakerCount`, `split` | `--speaker-count`, `--split` |
| `providerConcurrency`, `localConcurrency` | `--provider-concurrency`, `--local-concurrency` |
| `segmentConcurrency`, `preflightConcurrency` | `--stt-segment-concurrency`, `--stt-preflight-concurrency` |

### defaults.extract.ocr

| Field | Flag |
|-------|------|
| Local OCR engine field | `--ocr tesseract` |
| Hosted OCR model fields | `--ocr provider[=model]` |
| `lang`, `out`, `dpi` | `--ocr-language`, `--format`, `--ocr-dpi` |
| `pageConcurrency` | `--ocr-concurrency` |
| `providerConcurrency`, `localConcurrency` | `--provider-concurrency`, `--local-concurrency` |
| `chapters`, `length`, `pdfChapterMode` | `--chapters`, `--length`, `--pdf-chapter-mode` |

### defaults.extract.url

| Field | Flag |
|-------|------|
| `provider` | `--url-provider defuddle\|firecrawl\|glm-reader\|spider\|supadata\|zyte` |

### defaults.llm

| Field | Flag |
|-------|------|
| `openai`, `groq`, `gemini`, `anthropic`, `minimax`, `grok`, `glm`, `kimi`, `together`, `cerebras` | `--llm provider[=model]` |
| `providerConcurrency`, `localConcurrency` | `--provider-concurrency`, `--local-concurrency` |

### defaults.post.tts

| Field | Flag |
|-------|------|
| `elevenlabsTts`, `minimaxTts`, `groqTts`, `grokTts`, `mistralTts`, `openaiTts`, `geminiTts`, `deepgramTts`, `speechifyTts`, `humeTts`, `cartesiaTts`, `fishTts`, `inworldTts`, `deepinfraTts`, `replicateTts`, `falTts` | `--tts provider[=model]` |
| `ttsSpeaker`, `groqVoice`, `grokTtsVoice`, `grokTtsLanguage`, `grokTtsTextNormalization`, `mistralTtsVoice` | generic `--tts-*` voice flags or matching provider-specific controls |
| `ttsDialogueFormat`, `ttsSpeakers` | `--tts-dialogue-format`, `--tts-speaker` |
| `openaiVoice`, `openaiTtsInstructions`, `openaiTtsSpeed` | generic `--tts-*` flags |
| `geminiVoice` | Gemini voice flag |
| `elevenlabsVoice`, `elevenlabsTtsOutputFormat`, `elevenlabsTtsLanguageCode`, `elevenlabsTtsStability`, `elevenlabsTtsSimilarityBoost`, `elevenlabsTtsStyle`, `elevenlabsTtsUseSpeakerBoost`, `elevenlabsTtsSpeed`, `elevenlabsTtsSeed`, `elevenlabsTtsTextNormalization`, `elevenlabsTtsPronunciationDictionaryLocators`, `elevenlabsTtsOptimizeStreamingLatency` | ElevenLabs existing-voice and synthesis flags |
| `minimaxTtsVoice`, `minimaxTtsLanguageBoost`, `minimaxTtsSpeed`, `minimaxTtsVolume`, `minimaxTtsPitch`, `minimaxTtsEmotion`, `minimaxTtsEnglishNormalization`, `minimaxTtsPronunciations` | MiniMax voice and synthesis control flags |
| `deepgramVoice`, `deepgramTtsEncoding`, `deepgramTtsContainer`, `deepgramTtsBitRate`, `deepgramTtsSampleRate`, `deepgramTtsSpeed`, `speechifyVoice`, `speechifyTtsAudioFormat`, `speechifyTtsLanguage`, `humeTtsVoice`, `humeTtsVoiceProvider`, `cartesiaTtsVoice`, `cartesiaTtsLanguage` | provider voice, output, and reusable synthesis flags |
| `providerConcurrency`, `localConcurrency`, `chunkConcurrency` | `--provider-concurrency`, `--local-concurrency`, `--tts-chunk-concurrency` |

One-off custom-voice provisioning and clone creation audio files are runtime-only options managed via `voice` and cannot be persisted as defaults. Synthesis defaults require an existing provider voice ID.

`ttsSpeakers` is what selects multi-speaker TTS, so a saved `ttsDialogueFormat` with no saved `ttsSpeakers` is inert: runs that inherit it log a warning and continue as single-speaker.

### defaults.post.image

| Field | Flag |
|-------|------|
| `geminiImage`, `openaiImage`, `grokImage`, `bflImage`, `recraftImage`, `replicateImage`, `lumalabsImage`, `falImage` | `--image provider[=model]` |
| `imageAspectRatio`, `imageSize`, `imageQuality`, `imageFormat`, `imageBackground`, `imageCount` | matching reusable image option flags |
| `providerConcurrency`, `localConcurrency` | `--provider-concurrency`, `--local-concurrency` |

One-shot image inputs, masks, and edit controls are per-generation flags accepted by processing commands and rejected by `config`.

### defaults.post.video

| Field | Flag |
|-------|------|
| `geminiVideo`, `minimaxVideo`, `glmVideo`, `grokVideo`, `runwayVideo`, `ltxVideo`, `replicateVideo`, `lumalabsVideo`, `falVideo` | `--video provider[=model]` |
| `videoDuration`, `videoSize`, `videoAspectRatio`, `videoResolution`, `videoMode`, `videoInputImage`, `videoLastFrame`, `videoReferenceImages`, `videoInputVideo`, `grokVideoStorageFilename`, `grokVideoStorageExpiresAfter` | matching video option flags |
| `replicateVideoSeed`, `replicateVideoGenerateAudio`, `replicateVideoReferenceVideos`, `replicateVideoReferenceAudios`, `replicateVideoNegativePrompt`, `replicateVideoAudio`, `replicateVideoPromptExpansion` | `--replicate-video-*` option flags |
| `falVideoGenerateAudio`, `falVideoReferenceVideos`, `falVideoReferenceAudios` | `--fal-video-*` option flags |
| `providerConcurrency`, `localConcurrency` | `--provider-concurrency`, `--local-concurrency` |

### defaults.post.music

| Field | Flag |
|-------|------|
| `elevenlabsMusic`, `minimaxMusic`, `geminiMusic` | `--music provider[=model]` |
| `musicDuration` | `--music-duration` |
| `providerConcurrency`, `localConcurrency` | `--provider-concurrency`, `--local-concurrency` |

One-shot lyrics files and instrumental switches describe single generations and are not persisted defaults.

### defaults.batch, defaults.prompts, pricing, auth

| Field | Flag |
|-------|------|
| `defaults.batch.limit`, `defaults.batch.order`, `defaults.batch.concurrency` | `--batch-limit`, `--batch-order`, `--batch-concurrency` |
| `defaults.prompts` | repeated `--prompt` |
| `pricing.maxCents` | `--max-cents` |
| `auth.cookies` | `--cookies` |
| `auth.cookiesFromBrowser` | `--cookies-from-browser` |

Cookie auth persists the cookies file path or browser name only. Do not copy cookie-file contents into `config/autoshow.json`.

`default` prompt expansion is `shortSummary + longSummary + longChapters`.

## Precedence

```text
Explicit CLI flags > config file defaults > native CLI defaults
```

Only flags explicitly typed on the command line override config values. Native CLI defaults do not overwrite saved config defaults.

For hosted concurrency, an explicit `--concurrency-mode` overrides `defaults.concurrency.mode`; otherwise the saved value overrides the native `ramp` default. `config --reset` removes the persisted value with the rest of the config.

If you type any provider/model selector for a step family at runtime, configured provider selections for that family are replaced instead of merged. For example, passing `--llm openai=...` on `write` suppresses configured `defaults.llm.gemini` and `defaults.llm.groq` entries for that run.

## Pricing And Budgets

Hosted or mixed-provider process and generation commands run cost preflight before execution.

To show the estimate and exit:

```bash
bun autoshow write input/examples/audio/1-audio.mp3 --price
```

Set a hard budget:

```bash
bun autoshow config --max-cents 50
```

When the estimate exceeds the limit, the command fails before execution. Use `--allow-over-budget` for a one-off runtime override; it is never persisted.

## Recommended Configs

### All-local

```bash
bun autoshow config \
  --stt whisper=tiny \
  --ocr tesseract
```

Write has no local LLM. TTS, image, video, and hosted music generation have no local provider defaults.

### Low-cost hosted defaults

```bash
bun autoshow config \
  --stt groq=whisper-large-v3-turbo \
  --llm groq=openai/gpt-oss-20b \
  --tts minimax=speech-2.8-turbo \
  --image openai=gpt-image-2 --image-quality low \
  --video minimax=MiniMax-Hailuo-2.3 \
  --music minimax=music-3.0
```

## Flags

`bun autoshow config --help` is the authoritative generated flag list for this command. It includes config controls, pricing controls, YouTube cookie auth, batch defaults, Step 2 STT/OCR defaults, Step 3 LLM defaults, and post-processing defaults for TTS, image, video, and music.

Command flags:

| Flag | Description |
|------|-------------|
| `--show` | Print resolved config path and effective config |
| `--reset` | Clear the config file |

Global flags:

| Flag | Description |
|------|-------------|
| `--config-path` | Path to config file |
| `--verbose`, `--quiet`, `--json` | Runtime-only logging controls |
