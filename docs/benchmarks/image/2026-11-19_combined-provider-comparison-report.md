# Combined image provider comparison

Fresh runs of the two removed 2026-05-21 image benchmark prompts across every image model the CLI supports after the 2026-11-19 catalog change: Gemini Nano Banana 2.1, GPT Image 2.6 Flare and Sunburst, and Grok Imagine Image 2.0. Cost and speed use the mean of the two runs, grouped by provider/model identity. No quality claim or judgment is made.

Each prompt ran once with `bun autoshow image "<prompt>" --all-providers` and CLI defaults (Gemini 1K, Grok 1K low, OpenAI `auto` size and quality). All eight targets completed in one attempt with no retries, and every artifact passed full local decoding. Recorded spend was 41.053¢ against a 32.108¢ preflight estimate: OpenAI `auto` chose its own dimensions (1024×1536, 1230×1278, 1402×1122 and 1536×1024) and used 1,372–2,916 output tokens instead of the planned 1,449. OpenAI and Grok costs are provider-reported usage; Gemini returned no usage, so its cost is the registry rate. None of these receipts is reconciled against an invoice.

The 2026-05-21 runs of these prompts covered 24 models, all since retired or removed, and their reports were deleted on 2026-09-16; they are not compared here. Media is Git-ignored; per-run SHA-256 hashes are in each `consensus-evaluation.txt`.

## Sources

- [2026-11-19_21-52-24-776_image-gen](./2026-11-19_21-52-24-776_image-gen/provider-comparison-report.md): technical pipeline infographic
- [2026-11-19_21-53-20-135_image-gen](./2026-11-19_21-53-20-135_image-gen/provider-comparison-report.md): recursive pencil drawing

## Cost

| Rank | Provider/model                | Coverage |     Mean |
| ---: | ----------------------------- | -------: | -------: |
|    1 | gemini/gemini-nano-banana-2.1 |      2/2 | $0.03360 |
|    2 | grok/grok-imagine-image-2.0   |      2/2 | $0.04000 |
|    3 | openai/gpt-image-2.6-sunburst |      2/2 | $0.05060 |
|    4 | openai/gpt-image-2.6-flare    |      2/2 | $0.08106 |

## Processing time

| Rank | Provider/model                | Coverage |     Mean |
| ---: | ----------------------------- | -------: | -------: |
|    1 | grok/grok-imagine-image-2.0   |      2/2 | 12.243 s |
|    2 | gemini/gemini-nano-banana-2.1 |      2/2 | 13.955 s |
|    3 | openai/gpt-image-2.6-flare    |      2/2 | 17.925 s |
|    4 | openai/gpt-image-2.6-sunburst |      2/2 | 34.867 s |

## Quality

Unavailable: retained evidence contains no eligible automated or human quality scores. Dimensions, file size, cost and speed are not quality proxies.
