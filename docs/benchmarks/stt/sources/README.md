# Canonical STT Recordings

Three Git-ignored MP3s supply the benchmark runs. Transfer their exact bytes separately from Git; a historical URL is not a verified replacement.

| Recording           | Filename                                           |
| ------------------- | -------------------------------------------------- |
| Widgets / FSJam     | `2022-09-30-widgets-fsjam-40-minutes.mp3`          |
| Qwik / Misko Hevery | `2023-03-15-jsjam-qwik-misko-hevery.mp3`           |
| React Miami         | `2023-04-05-jsjam-react-miami-2023-10-minutes.mp3` |

[catalog.json](catalog.json) binds each source's SHA-256, bytes, historical duration, retired copies, and consuming runs. Manifests reference the canonical source through repository-relative `metadata.step1.url`; `audioFileName` resolves here from the run directory. Prompt front matter uses the same path. Original URLs, provider results, transcripts, timing, and costs remain preserved.

Verify source bytes and all catalogued manifest/prompt relationships locally:

```bash
bun src/tools/verify-stt-benchmark-sources.ts
```

Restore the exact recordings and complete run directories first, including the catalogued ignored Cloudflare run under `output/`. Missing/changed sources, mismatched identities, divergent prompt URLs, or broken audio resolution fail verification. The check proves identity and path relationships, not transcription or perceptual quality.
