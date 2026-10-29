# Combined video provider comparison

Reconstructed from retained per-run comparison reports. Historical evaluator judgments were removed; no quality claim or replacement judgment is made. Cost and speed use the mean of available observations, grouped by provider/model identity. Gemini Omni was added to both runs on 2026-10-23 with one request each at its provider-selected length; its cost is the registry rate because the provider returned no usage.

Grok Video 1.5 Lite was added to both saved prompts on 2026-10-29 using additive resume with explicit 8-second, 480p requests. Each returned the exact `grok-imagine-video-1.5-lite` identity and provider-reported cost of $0.16, for $0.32 total; these usage receipts have not been reconciled against an invoice. Each target completed in one attempt. Full local decoding passed for both H.264/AAC outputs at 848×480 with 8.041667-second containers; the provider reports 8 generated seconds. SHA-256 checks confirmed all four earlier Grok/Gemini videos were unchanged. Decoding and transport success do not establish visual quality or spoken correctness.

## Sources

- [2026-05-21_06-50-32-135_video-gen](./2026-05-21_06-50-32-135_video-gen/provider-comparison-report.md)
- [2026-05-21_06-51-12-517_video-gen](./2026-05-21_06-51-12-517_video-gen/provider-comparison-report.md)

## Cost

| Rank | Provider/model                   | Coverage | Mean     |
| ---: | -------------------------------- | -------: | -------: |
| 1    | grok/grok-imagine-video-1.5-lite | 2/2      | $0.16000 |
| 2    | grok/grok-imagine-video-1.5      | 2/2      | $0.64000 |
| 3    | gemini/gemini-omni-1.1-flash     | 2/2      | $1.00000 |

## Processing time

| Rank | Provider/model                   | Coverage | Mean     |
| ---: | -------------------------------- | -------: | -------: |
| 1    | grok/grok-imagine-video-1.5-lite | 2/2      | 22.509 s |
| 2    | grok/grok-imagine-video-1.5      | 2/2      | 32.557 s |
| 3    | gemini/gemini-omni-1.1-flash     | 2/2      | 37.156 s |

## Quality

Unavailable: retained evidence contains no eligible automated or human quality scores.
