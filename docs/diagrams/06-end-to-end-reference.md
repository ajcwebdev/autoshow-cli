# End-to-End Execution Reference

A walkthrough of `extract` then `write` from invocation through the files they leave on disk.

## Outline

- [Example Trace](#example-trace)
- [Expected Artifacts](#expected-artifacts)
- [Credentials and Runtime](#credentials-and-runtime)

## Example Trace

Example commands:

```bash
bun autoshow extract "https://youtube.com/watch?v=abc123" --provider whisper=small
bun autoshow write output/<extract-run>/transcription.txt --llm openai --rendered-text --prompt-md
```

```
extract command
  |
  +--> parse flags and merge config defaults
  +--> apply logging, output, and yt-dlp cookie settings
  +--> validate STT selection from --provider
  |
  v
classify the URL as streaming media
  |
  v
Step 1: metadata and download
  +--> extract source metadata
  +--> create the run output directory
  +--> download and stage media
  +--> prepare audio for transcription
  |
  v
Step 2: transcription
  +--> run local Whisper `small`
  +--> write transcription.txt and result.json
  +--> write extract manifest.json
  |
  v
write command
  |
  +--> parse flags and merge config defaults
  +--> reject URLs, media, documents, HTML, and X Spaces
  +--> treat the .txt file as source text
  +--> validate LLM selection from --llm
  |
  v
Step 3: LLM writing
  +--> use the configured `--llm` default unless `--llm` is passed
  +--> write prompt.md
  +--> write prompt-md.md because --prompt-md is set
  +--> write text.json
  |
  v
rendered artifacts
  +--> text.md because --rendered-text is set
  +--> show-note.md
  +--> write manifest.json
```

This example is a single media extract followed by a text write. Directory, input-list, and source-backed batches follow the same extract steps per item; see [Input Routing & Batch Orchestration](02-input-routing-batch.md). Document and article routes replace Steps 1-2 on `extract`; `write` always starts at Step 3; see [Processing Pipelines](03-processing-pipelines.md).

## Expected Artifacts

```
output/<extract-run>/
  <publish-date>-<title-slug>.(mp3|m4a|ogg|flac)
  transcription.txt
  result.json
  manifest.json

output/<write-run>/
  prompt.md
  prompt-md.md
  text.json
  text.md
  show-note.md
  manifest.json
```

With more than one STT selection, extract provider-specific files move under `providers/<provider-model>/`. With more than one LLM selection, write uses `text-<model>.json` / `text-<model>.md` names. The full layout and `manifest.json` shape are in [Types, Metadata & Output Layout](05-types-and-output.md).

## Credentials and Runtime

Hosted provider API keys are listed in [Providers, Models & Setup](04-providers-and-setup.md#hosted-provider-env-checks). This extract example uses local Whisper, so it needs no STT key; `write` still requires a configured LLM key.

Runtime settings come from flags and `config/autoshow.json`. The CLI reads environment variables only for provider API keys and `NO_COLOR` / `FORCE_COLOR`. `NO_COLOR` disables color whenever the variable is present, including when its value is an empty string; a non-empty, non-zero `FORCE_COLOR` takes precedence. `--color` / `--no-color` override both color variables.
