# Extraction-to-Writing Example

## Example Trace

```bash
bun autoshow extract "https://www.youtube.com/watch?v=u1-WHqATSQU" --provider whisperfile=small
bun autoshow write "output/<extract-run>/transcription.txt" --provider openai=gpt-6.1-terra --rendered-text --prompt-md
```

Replace `<extract-run>` with the reported directory. The extract command requires the selected local Whisperfile bundle; the write command needs OpenAI credentials. This is an execution example, not a no-cost verification command.

```text
extract argv --> validate/configure --> resolve streaming media
                                      |
                                      v
                           metadata + download + audio prep
                                      |
                                      v
                              local Whisperfile
                                      |
                                      v
                        transcript + evidence + manifest
                                      |
                        explicit local text handoff
                                      |
                                      v
write argv --> validate/configure --> snapshot source + build prompt
                                      |
                                      v
                             selected hosted LLM
                                      |
                                      v
                        JSON + rendered text + show notes
                                      |
                                      v
                                  manifest
```

Configuration merges before work planning, and provider selection is validated before dispatch. `extract` does not invoke `write`; `write` never repeats source acquisition. Use `--price` to inspect applicable estimates before paid work.

## Expected Artifacts

For one STT target and one write target without splitting:

```text
output/<extract-run>/           output/<write-run>/
  <source audio>                 source.txt
  transcription.txt              prompt.md
  result.json                    prompt-md.md
  prompt.md                      text.json
  manifest.json                  text.md
                                 show-note.md
                                 manifest.json
```

Multiple STT targets use provider directories; ScrapeCreators also uses one for a single target. Multiple write targets qualify output stems by model/provider. See [output ownership](05-types-and-output.md) for manifests, batches, and retained provider records.

## Credentials and Runtime

[Setup](04-providers-and-setup.md#hosted-provider-env-checks) documents credential lookup and local tools. Flags and `runtime/autoshow.json` control execution; [usage](../commands/00-setup-and-utilities/usage.md) covers logging, result artifacts, outputs, and budgets. [Processing pipelines](03-processing-pipelines.md) describes document/article extraction and local transcript/lyric-video workflows.
