# End-to-End Execution Reference

A walkthrough of `extract` then `write` from invocation through the files they leave on disk.

## Outline

- [Example Trace](#example-trace)
- [Expected Artifacts](#expected-artifacts)
- [Credentials and Runtime](#credentials-and-runtime)

## Example Trace

Example commands:

```bash
bun autoshow extract "https://www.youtube.com/watch?v=u1-WHqATSQU" --provider whisperfile=small
bun autoshow write "output/<extract-run>/transcription.txt" --provider openai --rendered-text --prompt-md
```

Replace `<extract-run>` with the directory reported by `extract` before running `write`.

```
extract command
  |
  +--> parse flags
  +--> apply logging, output, and yt-dlp cookie settings
  +--> merge config defaults
  |
  v
classify the URL as a streaming URL and route it as media
  |
  v
validate STT selection from --provider
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
  +--> run local whisperfile `small`
  +--> write transcription.txt and result.json
  +--> write prompt.md
  +--> write extract manifest.json
  |
  v
write command
  |
  +--> parse flags and merge config defaults
  +--> reject non-text inputs
  +--> treat the .txt file as source text
  +--> validate LLM selection from --provider (or --llm alias)
  |
  v
Step 3: LLM writing
  +--> resolve the selected OpenAI model
  +--> write prompt.md
  +--> write prompt-md.md because --prompt-md is set
  +--> write text.json
  |
  v
rendered artifacts
  +--> text.md because --rendered-text is set
  +--> show-note.md
  +--> write source.txt
  +--> write manifest.json
```

Media batches repeat the extract flow per item; see [Input Routing & Batch Orchestration](02-input-routing-batch.md). Document and article routes use their own extraction flow, while `write` always starts from local text; see [Processing Pipelines](03-processing-pipelines.md).

## Expected Artifacts

For successful runs with one STT target and one LLM target, without audio splitting:

```
output/<extract-run>/
  <publish-date>-<title-slug>.(mp3|m4a|ogg|flac)
  transcription.txt
  result.json
  prompt.md
  manifest.json

output/<write-run>/
  prompt.md
  prompt-md.md
  text.json
  text.md
  show-note.md
  source.txt
  manifest.json
```

With more than one STT selection, or a single ScrapeCreators target, provider-specific files are written under `providers/<service>-<model>/`. With more than one LLM selection, write uses `text-<model>.json` / `text-<model>.md` names, and a shared model id includes the provider. The full layout and `manifest.json` shape are in [Types, Metadata & Output Layout](05-types-and-output.md).

## Credentials and Runtime

Hosted provider API keys are listed in [Providers, Models & Setup](04-providers-and-setup.md#hosted-provider-env-checks). This extract example uses local whisperfile, so it needs no STT key; `write` still requires a configured LLM key.

Runtime settings come from flags and `config/autoshow.json`. Terminal and logging controls are in the [usage guide](../commands/00-setup-and-utilities/usage.md).
