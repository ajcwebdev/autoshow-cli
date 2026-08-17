# System Overview & CLI Surface

Architecture overview for the native CLI, command routing, global flags, provider selectors, and current process command surface.

## Outline

- [System Layers](#system-layers)
- [Native Dispatch](#native-dispatch)
- [Command Surface](#command-surface)
- [Flag System](#flag-system)
- [Provider Selectors](#provider-selectors)

## System Layers

```
bun autoshow <command> [<subcommand>] <target> [flags]
            |
            v
+------------------+     +------------------+     +------------------+     +------------------+
| CLI layer        | --> | Target layer     | --> | Processing layer | --> | Output layer     |
| native parser    |     | plan + routing   |     | steps 0-8        |     | manifest + files |
+------------------+     +------------------+     +------------------+     +------------------+
```

1. CLI layer: `src/cli/create-cli.ts` registers the root definition, global flags, command groups, and per-command definitions. `src/cli/native/*` parses argv, renders help/version output, rejects unknown flags where appropriate, and builds the command context.
2. Target layer: `handleProcessTarget()` resolves the target, merges config defaults, normalizes selectors, composes only the domain option slices required by the selected command, calls `resolveProcessTargetPlan()`, and for single extract/write items calls `resolveInputRoutingForCommand()`.
3. Processing layer: Step 0 metadata, Step 1 download/detect, Step 2 STT/OCR/article/X extraction, Step 3 LLM writing, Steps 4-7 TTS/image/video/music generation, and Step 8 comic utilities.
4. Output layer: every run or batch root owns one unversioned `manifest.json` with the same canonical shape. Provider lifecycle state is stored in that manifest through the serialized atomic writer; provider directories contain generated artifacts and optional raw domain `result.json` payloads, never another control artifact.

## Native Dispatch

```
src/cli/create-cli.ts
        |
        v
dispatchNativeCli(argv, root, commands)
        |
        v
parseNativeCli()
        |
        +--> one registered subcommand level? -> resolve the final command definition once
        +--> help?    -> renderRootHelp() or renderCommandHelp()
        +--> version? -> print package version
        |
        v
unknown global/command flags?
        |
        +--> reject through the native usage-error path
        |
        v
apply global runtime settings
        |
        +--> --verbose / --quiet / --json / --log-level / --log-format -> logger
        +--> --output-root                -> base output directory
        +--> --output-dir                 -> pinned run directory for this invocation
        +--> --characters-root            -> comic/voice character reference directory
        +--> --bin-dir                    -> external tool binary lookup
         +--> --color / --no-color         -> ANSI color handling
         +--> config auth.cookies / auth.cookiesFromBrowser -> yt-dlp auth
         |
         v
run command handler under log context
        |
        v
debug log elapsed time
```

Global flags:

| Flag                    | Effect                                                                                                                                                                                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--help`, `-h`          | Show root or command help.                                                                                                                                                                                                                                                                              |
| `--version`, `-v`       | Print CLI version.                                                                                                                                                                                                                                                                                      |
| `--config-path`         | Use a config file other than `config/autoshow.json`.                                                                                                                                                                                                                                                    |
| `--output-root`         | Base output directory under which per-step subdirectories are created.                                                                                                                                                                                                                                  |
| `--output-dir`          | Pin the run directory for this invocation instead of a timestamped `output/<timestamp>_<slug>` directory. On a batch run it becomes the batch root and per-item directories keep their slug names inside it. Rejected by `config`, `setup`, `links`, and `resume`, which do not create run directories. |
| `--characters-root`     | Directory of comic character reference images and `characters-reference.json`. Accepted on `voice` and `comic` only.                                                                                                                                                                                    |
| `--bin-dir`             | Directory of external tool binaries checked before the managed install and PATH.                                                                                                                                                                                                                        |
| `--allow-over-budget`   | Continue after cost preflight exceeds the configured budget.                                                                                                                                                                                                                                            |
| `--verbose`             | Enable debug logging.                                                                                                                                                                                                                                                                                   |
| `--quiet`, `-q`         | Suppress non-error output.                                                                                                                                                                                                                                                                              |
| `--json`                | Emit logs as JSON.                                                                                                                                                                                                                                                                                      |
| `--log-level`           | Minimum log level: `debug`, `info`, `success`, `warn`, or `error`.                                                                                                                                                                                                                                      |
| `--log-format`          | Log output format: `human`, `json`, or `both`.                                                                                                                                                                                                                                                          |
| `--color`, `--no-color` | Force ANSI colors on or off instead of auto-detecting the TTY.                                                                                                                                                                                                                                          |

Comic's public `draft-scenes`, `generate-images`, `generate-audio`, `generate-slideshow`, `reference-sketch`, and `reference-voice` commands are first-class children of `comicCommand`; dispatch, global flags, parameter cardinality, and both help forms use the native command tree. Links registers every provider selector as a real hidden flag, then assigns the native parser's ordered positional metadata to provider scopes without reparsing raw argv.

## Command Surface

```
Core:
  help/version behavior is native to the root parser.

Setup and utilities:
  config    read/write persisted defaults
  setup     install local tools and report provider env readiness
  links     provider documentation/reference link lookup
  resume    rerun missing or failed providers from existing output

Processing and generation:
  metadata  Step 0/1 metadata only
  download  Step 1 download/detect only
  extract   Step 1 + Step 2 extraction
  write     Step 1 + Step 2 + Step 3, optionally Steps 4-7
  tts       standalone TTS for .md/.txt files or directories
  voice     standalone voice registration and lifecycle management
  image     standalone image generation
  video     standalone video generation
  music     standalone music generation or local lyric-video rendering
  comic     nested draft-scenes, generate-images, generate-audio, generate-slideshow, reference-sketch, and reference-voice workflows
```

Process commands enter the shared target layer except for special standalone generation modes. `extract --transcript-video` is handled before normal target processing and renders a captioned video from an existing extract run or from explicit `--audio` plus `--transcript-result`/`--transcript-text`.

## Flag System

Command groups share the same normalized selector model but expose it through different flags:

```
extract/resume
  --provider provider[=model]
  --all-providers
  --all-local
  --provider-concurrency N
  --local-concurrency N

standalone generation
  --provider provider[=model]
  --all-providers
  --provider-concurrency N
  --local-concurrency N

write/config pipeline defaults
  --stt provider[=model]
  --ocr provider[=model]
  --llm provider[=model]
  --tts provider[=model]
  --image provider[=model]
  --video provider[=model]
  --music provider[=model]
   --all-providers stt|ocr|url|llm|tts|image|video|music
   --all-local stt|ocr|url
```

Flag/config resolution is command-neutral, but processing is not built around an all-command option bag. STT, OCR, URL, LLM, TTS, image, video, music, batch, and pricing consumers accept their own option slices plus explicitly named shared controls. Only the full media/document write path composes the slices it actually runs.

`extract --provider` is route-aware. A media item maps it to STT providers, a document/image item maps it to OCR providers, and an article route uses URL backend selection. Mixed extract batches are partitioned by route so generic selections are normalized before execution.

## Provider Selectors

Current selector families:

| Step        | Providers                                                                                                                                                                                                                                                         |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| STT         | `whisper`, `whisperfile`, `deepinfra`, `deepgram`, `soniox`, `speechmatics`, `rev`, `groq`, `grok`, `mistral`, `assemblyai`, `gladia`, `happyscribe`, `supadata`, `scrapecreators`, `gemini`, `together`; `youtube-captions` is a special caption-backed service. |
| OCR         | `tesseract`, `mistral`, `glm`, `kimi`, `openai`, `grok`, `anthropic`, `gemini`, `deepinfra`, `replicate`, `fal`.                                                                                                                                                  |
| URL article | `defuddle`, `firecrawl`, `glm-reader`, `spider`, `supadata`, `zyte`.                                                                                                                                                                                              |
| LLM         | `openai`, `groq`, `gemini`, `anthropic`, `minimax`, `grok`, `glm`, `kimi`, `together`, `cerebras`.                                                                                                                                                                |
| TTS         | `elevenlabs`, `minimax`, `groq`, `grok`, `mistral`, `openai`, `gemini`, `deepgram`, `speechify`, `hume`, `cartesia`, `fish`, `inworld`, `deepinfra`, `replicate`, `fal`.                                                                                          |
| Image       | `gemini`, `openai`, `grok`, `bfl`, `replicate`, `lumalabs`, `fal`.                                                                                                                                                                                                |
| Video       | `gemini`, `minimax`, `grok`, `ltx`, `replicate`, `lumalabs`, `fal`; MiniMax remains parseable only to provide replacement guidance for retired direct-video selectors.                                                                                         |
| Music       | `elevenlabs`, `minimax`, `gemini`.                                                                                                                                                                                                                                |

Command-to-flag mapping:

| Command                       | Primary flags                                                                                                                          |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `metadata`                    | `--save`, document password, URL backend, batch flags.                                                                                 |
| `download`                    | download/media flags, URL backend, batch flags.                                                                                        |
| `extract`                     | STT/OCR/URL selectors, advanced OCR flags, `--youtube-captions`, batch flags, `--price`, `--transcript-video`.                         |
| `write`                       | Step selectors for STT/OCR/URL/LLM/TTS/image/video/music, prompt/text-input flags, rendered text flags, batch flags, generation flags. |
| `resume`                      | target-aware provider selectors for missing or failed providers.                                                                       |
| `tts`/`image`/`video`/`music` | standalone generation flags and provider selectors.                                                                                    |
| `voice`                       | standalone voice registration, audition, approval, consent, discovery, and deletion flags.                                             |
| `comic`                       | comic drafting, panel image generation, audio rendering, local slideshow presentation, and reference flags.                            |
| `config`                      | persisted defaults for supported selectors and options; runtime-only flags are ignored.                                                |
