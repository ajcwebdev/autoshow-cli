# CLI Surface

## System Layers

```text
native parser / help
        |
        v
config + target planning
        |
        v
command-specific workflow
        |
        +--> local tools
        +--> hosted provider/account admission --> provider adapter
        |
        v
canonical manifest + artifacts + terminal result
```

Commands select the steps they need; `write` does not automatically attach extraction or media generation.

## Dispatch

```text
argv --> native command tree --> validate flags / values
                 |                        |
                 +--> help / version      v
                                apply runtime/configuration
                                          |
                                          v
                                price plan or execution
                                          |
                                          v
                                   terminal result
```

Unknown commands/flags and missing arguments fail before dispatch. `--json` sends diagnostics to stderr and one terminal result to stdout. `--json --result-file <new-path>` stores the complete sanitized result and emits a bounded artifact summary. Quiet logging never suppresses the result.

Output, character-root, and budget flags are accepted only where applicable. `--require-shared-budget` requires configured budget enforcement; unsupported execution roots fail closed. See [global usage](../commands/00-setup-and-utilities/usage.md).

## Command Surface

```text
setup / config   install or inspect tools; read/write defaults
links            fetch selected documentation
resume           recover recorded pipeline/comic work
metadata         inspect and expand sources
download         acquire media and metadata
extract          STT, OCR, articles, X Spaces; local transcript workflows
write            LLM generation from local Markdown/plaintext
tts / voice      speech synthesis / voice lifecycle
image / video    standalone visual generation
music            hosted music or local lyric-video
comic            script, scene, reference, image, audio, presentation, review
```

## Flag System

Execution commands use `--provider provider[=model]`; multi-target workflows support repeated selections and `--all-providers`. Extract additionally supports `--all-local`. Write retains the mutually exclusive `--llm` alias. Setup uses domain flags such as `--stt`, `--ocr`, and `--tts` to persist defaults.

Extract resolves selectors by route: media → STT, documents → OCR, articles → URL backends. Resume resolves them against the recorded command; comic recovery restores recorded choices and rejects overrides.

Provider/account admission is shared within a run. `--provider-concurrency`, `--local-concurrency`, and command-scoped `--step-concurrency <scope>=N` bound different work; they are not a simple product. [ADR-007](../adr/ADR-007-decompose-work-into-chunks-and-concurrency-lanes.md) defines scheduling and recovery.
