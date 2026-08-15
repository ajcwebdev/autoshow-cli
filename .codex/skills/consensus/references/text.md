# Text Consensus

Use this category for existing AutoShow `write` runs with canonical `manifest.json` metadata. It is metadata-only and does not call LLM providers.

## Packet

```bash
bun scripts/run.ts text build-packet "$RUN_DIR" --out "$TMP_PACKET"
```

The packet records each `metadata.step3` provider/model, token counts, output file presence, cost evidence, and timing evidence. It may include a short output preview for orientation, but the workflow does not ask an LLM judge to score text quality.

## Report

```bash
bun scripts/run.ts text build-report "$RUN_DIR"
```

Reports expose full `price`, `speed`, `automatedQuality`, and `humanQuality` ranking surfaces for service providers. Write has no local LLM group. Price uses actual or estimated `manifest.json` cost steps. Speed prefers normalized `msPerUnit` timing when present and otherwise uses wall-clock processing time.

Text quality is not inferred from length, speed, cost, output existence, schema validity, subjective judgment, token count, or model family. Automated and human quality rankings remain unavailable unless explicit future text quality fields are present.
