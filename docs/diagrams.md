# AutoShow CLI Architecture Diagrams

Architecture diagrams covering the system in six grouped views.

## Diagrams

1. [System Overview & CLI Surface](diagrams/01-system-overview-cli.md) - High-level architecture, the 14-command CLI surface, command routing, provider selectors, and global runtime flags such as config path and bin dir
2. [Input Routing & Batch Orchestration](diagrams/02-input-routing-batch.md) - Target classification, single-item routing, command/input matrix, mixed batch flows, route-aware extract batch manifests, and source-backed batch entry points
3. [Processing Pipelines](diagrams/03-processing-pipelines.md) - Media, document, article, write, transcript-video, and lyric-video paths from download/detect through extraction/transcription, LLM writing, and local video rendering
4. [Providers, Models & Setup](diagrams/04-providers-and-setup.md) - Provider registries and setup requirements across STT, OCR, URL, LLM, TTS, image, video, and music, including hosted provider env checks and setup dependencies
5. [Types, Metadata & Output Layout](diagrams/05-types-and-output.md) - The canonical manifest, item/provider metadata, raw result artifacts, and output directory structure
6. [End-to-End Execution Reference](diagrams/06-end-to-end-reference.md) - Full command trace, global runtime flag flow, flag-driven runtime configuration, and output artifact reference
