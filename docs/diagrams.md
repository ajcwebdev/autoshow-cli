# AutoShow CLI Architecture Diagrams

Architecture diagrams covering the system in six broad, naturally grouped views.

## Outline

- [Diagrams](#diagrams)

## Diagrams

1. [System Overview & CLI Surface](diagrams/01-system-overview-cli.md) - High-level architecture, the 14-command native CLI surface, native dispatch and command routing, provider selectors, and global runtime flags such as config and model path
2. [Input Routing & Batch Orchestration](diagrams/02-input-routing-batch.md) - Target classification, single-item routing, command/input matrix, mixed batch flows, route-aware extract batch manifests, and source-backed batch entry points
3. [Processing Pipelines](diagrams/03-processing-pipelines.md) - Media, document, article, transcript-video, lyric-video, write, and generation paths from download/detect through extraction/transcription and optional LLM/generation steps
4. [Providers, Models & Setup](diagrams/04-providers-and-setup.md) - Current provider registries and setup requirements across STT, OCR, URL, LLM, TTS, image, video, and music, including hosted provider env checks and setup dependencies
5. [Types, Metadata & Output Layout](diagrams/05-types-and-output.md) - The one unversioned canonical manifest, item/provider metadata, raw domain result artifacts, output directory structure, and domain option slices
6. [End-to-End Execution Reference](diagrams/06-end-to-end-reference.md) - Full command trace, global runtime flag flow, provider API key reference, flag-driven runtime configuration, and output artifact reference
