# AutoShow CLI Architecture Diagrams

Architecture diagrams covering the system in six grouped views.

## Diagrams

1. [System Overview & CLI Surface](diagrams/01-system-overview-cli.md) - Commands, routing, provider selectors, and global flags
2. [Input Routing & Batch Orchestration](diagrams/02-input-routing-batch.md) - How targets become single runs or batches
3. [Processing Pipelines](diagrams/03-processing-pipelines.md) - Media, document, article, write, transcript-video, and lyric-video paths
4. [Providers, Models & Setup](diagrams/04-providers-and-setup.md) - Provider catalog, setup steps, and API-key requirements
5. [Types, Metadata & Output Layout](diagrams/05-types-and-output.md) - Manifest shape, artifacts, and output directories
6. [End-to-End Execution Reference](diagrams/06-end-to-end-reference.md) - Example `write` command from invocation through files on disk
