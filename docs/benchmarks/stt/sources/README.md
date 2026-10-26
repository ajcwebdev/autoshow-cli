# Canonical STT recordings

These three unchanged MP3 recordings replace nine byte-identical run-local copies. They occupy 117,552,569 bytes; removing the six redundant copies saved 235,105,138 bytes. MP3 media remains Git-ignored and must be transferred separately from Git.

| Recording                   | Filename                                           | Bytes      |
| --------------------------- | -------------------------------------------------- | ---------: |
| Widgets / FSJam, 40 minutes | `2022-09-30-widgets-fsjam-40-minutes.mp3`          | 29,077,151 |
| Qwik / Misko Hevery         | `2023-03-15-jsjam-qwik-misko-hevery.mp3`           | 81,274,797 |
| React Miami, 10 minutes     | `2023-04-05-jsjam-react-miami-2023-10-minutes.mp3` | 7,200,621  |

`catalog.json` is the source identity and run-binding catalog. Every recording has an exact SHA-256, byte count, historical duration and list of consuming runs. `retiredCopies` records the former media locations; each run binding preserves its original source URL and audio filename. Provider responses, transcripts, costs and timing records remain unchanged.

The nine consuming manifests use repository-relative canonical paths in `metadata.step1.url`. Their `audioFileName` fields resolve from each run directory to this directory, preserving the existing transcript-video audio inference without symlinks or duplicate files. Their prompt front matter references the canonical path too.

Check all three source identities and all nine manifest/prompt bindings locally, without provider calls:

```bash
bun src/tools/verify-stt-benchmark-sources.ts
```

The check fails if audio or catalogued run metadata is missing, its bytes change, a run resolves to another file, or its prompt URL diverges. It verifies file identity and path resolution; it does not assess transcription or perceptual quality. After a checkout or external archive transfer, restore these exact three recordings here and the complete run directories named in the catalog before running the check. The Cloudflare run under `output/` is ignored and must be transferred separately too. A historical source URL alone is not a verified replacement.
