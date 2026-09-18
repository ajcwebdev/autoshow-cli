# AutoShow CLI Architecture Diagrams

Architecture diagrams covering the system in six grouped views.

## Diagrams

1. [System Overview & CLI Surface](diagrams/01-system-overview-cli.md) - Command surface, routing, global flags, and provider selectors
2. [Input Routing & Batch Orchestration](diagrams/02-input-routing-batch.md) - How targets become single runs or batches
3. [Processing Pipelines](diagrams/03-processing-pipelines.md) - Media, document, article, text writing, transcript-video, and lyric-video flows
4. [Providers, Models & Setup](diagrams/04-providers-and-setup.md) - Hosted and local provider families, LLM fan-out, setup flow, and API-key requirements
5. [Types, Metadata & Output Layout](diagrams/05-types-and-output.md) - Public output artifacts, the pipeline manifest, runtime directories, and metadata fields
6. [End-to-End Execution Reference](diagrams/06-end-to-end-reference.md) - A walkthrough of `extract` then `write` from invocation through the files they leave on disk
