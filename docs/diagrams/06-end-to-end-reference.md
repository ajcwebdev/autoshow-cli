# End-to-End Execution Reference

A walkthrough of one `write` command from invocation through the files it leaves on disk.

## Outline

- [Example Trace](#example-trace)
- [Expected Artifacts](#expected-artifacts)
- [Credentials and Runtime](#credentials-and-runtime)

## Example Trace

Example command:

```bash
bun autoshow write "https://youtube.com/watch?v=abc123" --stt whisper=small --rendered-text --prompt-md
```

```
write command
  |
  +--> parse flags and merge config defaults
  +--> apply logging, output, and yt-dlp cookie settings
  +--> validate STT and LLM selections
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
  +--> manifest.json
```

This example is a single media target. Directory, input-list, and source-backed batches follow the same steps per item; see [Input Routing & Batch Orchestration](02-input-routing-batch.md). Document, article, and text-input write routes skip or replace Steps 1-2; see [Processing Pipelines](03-processing-pipelines.md).

## Expected Artifacts

```
output/YYYY-MM-DD_HH-MM-SS-mmm_<title-slug>/
  <publish-date>-<title-slug>.(mp3|m4a|ogg|flac)
  transcription.txt
  result.json
  prompt.md
  prompt-md.md
  text.json
  text.md
  show-note.md
  manifest.json
```

With more than one STT or LLM selection, provider-specific files move under `providers/<provider-model>/` or use `text-<model>.json` / `text-<model>.md` names. The full layout and `manifest.json` shape are in [Types, Metadata & Output Layout](05-types-and-output.md).

## Credentials and Runtime

Hosted provider API keys are listed in [Providers, Models & Setup](04-providers-and-setup.md#hosted-provider-env-checks). This example uses local Whisper, so it needs no STT key; Step 3 still requires a configured LLM key.

Runtime settings come from flags and `config/autoshow.json`. The CLI reads environment variables only for provider API keys and `NO_COLOR` / `FORCE_COLOR`. `--color` / `--no-color` override those color variables.
