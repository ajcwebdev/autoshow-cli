# image

Generate images from a text prompt with hosted image providers.

## Outline

- [Setup](#setup)
  - [Environment](#environment)
- [Usage](#usage)
- [Shared Image Options](#shared-image-options)
- [Image Services](#image-services)
  - [Gemini](#gemini)
  - [OpenAI](#openai)
  - [Grok](#grok)
  - [BFL](#bfl)
  - [Replicate](#replicate)
  - [Luma Labs](#luma-labs)
  - [fal.ai](#falai)
- [Output](#output)
- [Notes](#notes)
- [Provider Capabilities](#provider-capabilities)
  - [Reference Images](#reference-images)
  - [1–5 Reference Images](#15-reference-images)

## Setup

Image providers are hosted API services.

```bash
bun autoshow setup --doctor
```

### Environment

```bash
OPENAI_API_KEY=...
GEMINI_API_KEY=...
XAI_API_KEY=...
BFL_API_KEY=...
REPLICATE_API_TOKEN=...
LUMA_AGENTS_API_KEY=...
FAL_API_KEY=...
```

## Usage

```bash
bun autoshow image <prompt> [flags]
```

Bare `--provider` flags without a model value resolve to the cheapest supported model. Model selection flags are repeatable.

## Shared Image Options

The standalone `image` command uses `--size` instead of `--image-size` (which carries the prefix on `config` and `resume` to avoid collisions per [ADR-002](../../../adr/ADR-002-pipeline-state-resume-and-dry-run-planning.md)).

| Flag                                   | Description                                                                                                                                                                       |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--all-providers`                      | Select every supported image provider/model                                                                                                                                       |
| `--provider-concurrency <n>`           | Hosted image providers/models to run concurrently per item; default `7`                                                                                                           |
| `--concurrency-mode <ramp\|immediate>` | Start each hosted provider/account lane at one request and add one slot every five seconds while demand is queued (`ramp`, default), or start at its configured cap (`immediate`) |
| `--aspect-ratio <ratio>`               | Provider-dependent aspect ratio control                                                                                                                                           |
| `--size <size>`                        | Provider-dependent size or resolution control                                                                                                                                     |
| `--quality <q>`                        | OpenAI quality: `low`, `medium`, `high`, or `auto`                                                                                                                                |
| `--format <fmt>`                       | Output format: `png`, `jpeg`, or `webp` depending on provider                                                                                                                     |
| `--background <bg>`                    | OpenAI background mode: `transparent`, `opaque`, or `auto`                                                                                                                        |
| `--count <n>`                          | Number of images per request (OpenAI/Grok: `1-10`, Replicate Wan/fal.ai: `1-4`)                                                                                                   |
| `--input <path-or-url>`                | Repeatable source/reference image for edits or image-to-image workflows                                                                                                           |
| `--mask <path>`                        | OpenAI mask image for inpainting                                                                                                                                                  |
| `--compression <0-100>`                | OpenAI JPEG/WebP output compression                                                                                                                                               |
| `--response-mode <image\|text-image>`  | Native Gemini response mode                                                                                                                                                       |
| `--search-grounding`                   | Enable native Gemini search grounding metadata                                                                                                                                    |
| `--price`                              | Show the aggregated estimate and exit                                                                                                                                             |
| `--output-dir <dir>`                   | Global flag: pin output directory instead of `output/<timestamp>_image-gen/`                                                                                                      |

See [Provider Capabilities](#provider-capabilities) for the per-model reference, resolution, aspect-ratio, count, and format matrix.

```bash
bun autoshow image "a clean studio product photo of a red enamel camping mug on white seamless" --provider openai=gpt-image-2 --size 1024x1024 --format png --output-dir output/mug-base
bun autoshow image "make the mug matte black, keep the same camera angle, and place it on a walnut desk" --provider openai=gpt-image-2 --input output/mug-base/generated-image.png --format webp --compression 80 --output-dir output/mug-edit
bun autoshow image "a serene mountain lake at dawn" --all-providers --price
```

## Image Services

### Gemini

| Option       | Value                                                                                                                              |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Selector     | `--provider gemini[=<model>]`                                                                                                      |
| Models       | `gemini-3.1-flash-lite-image`, `gemini-3.1-flash-image`, `gemini-3-pro-image`                                                      |
| Size         | `1K` (`gemini-3.1-flash-lite-image`); `1K\|2K\|4K` (other models)                                                                  |
| Aspect ratio | `1:1`, `2:3`, `3:2`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, `21:9` (`gemini-3.1-flash-image` adds `1:4`, `4:1`, `1:8`, `8:1`) |
| Count        | 1 image per request                                                                                                                |
| References   | Repeatable `--input` (up to 14 images)                                                                                             |

```bash
bun autoshow image "a serene mountain lake at dawn" --provider gemini=gemini-3.1-flash-lite-image --size 1K --aspect-ratio 16:9
bun autoshow image "restyle this product image as a 1960s travel poster" --provider gemini=gemini-3.1-flash-lite-image --input input/reference.png --output-dir output/travel-poster
bun autoshow image "a detailed editorial data visualization" --provider gemini=gemini-3-pro-image --size 4K --search-grounding
```

### OpenAI

| Option            | Value                                                                   |
| ----------------- | ----------------------------------------------------------------------- |
| Selector          | `--provider openai[=<model>]`                                           |
| Models            | `gpt-image-2`                                                           |
| Size              | `auto`, `1024x1024`, `1536x1024`, `1024x1536`, or custom `WIDTHxHEIGHT` |
| Quality           | `--quality low\|medium\|high\|auto`                                     |
| Format/background | `--format png\|jpeg\|webp`, `--background transparent\|opaque\|auto`    |
| Count             | `--count 1-10`                                                          |
| Edit/reference    | `--input` with optional `--mask`                                        |

```bash
bun autoshow image "a clean studio product photo of a red enamel camping mug on white seamless" --provider openai=gpt-image-2 --size 1024x1024 --format png
bun autoshow image "a product sketch of the same travel mug concept" --provider openai=gpt-image-2 --size 1024x1024 --quality low
bun autoshow image "replace the background with a sunlit forest" --provider openai=gpt-image-2 --input input/product.png --mask input/mask.png --format webp
```

### Grok

| Option         | Value                                                                                                       |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| Selector       | `--provider grok[=<model>]`                                                                                 |
| Models         | `grok-imagine-image-quality`                                                                                |
| Size           | `--size 1K\|2K`                                                                                             |
| Aspect ratio   | `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `3:2`, `2:3`, `2:1`, `1:2`, `19.5:9`, `9:19.5`, `20:9`, `9:20`, `auto` |
| Count          | `--count 1-10`                                                                                              |
| Edit/reference | Up to 3 `--input` images with `grok-imagine-image-quality`                                                  |

```bash
bun autoshow image "a futuristic observatory at sunset" --provider grok=grok-imagine-image-quality --aspect-ratio 16:9 --size 1K --count 4
bun autoshow image "turn the reference into a glossy magazine ad on a warm kitchen counter" --provider grok=grok-imagine-image-quality --input input/reference.jpg --size 1K
```

### BFL

| Option     | Value                                                                           |
| ---------- | ------------------------------------------------------------------------------- |
| Selector   | `--provider bfl[=<model>]`                                                      |
| Models     | `flux-2-klein-4b`, `flux-2-klein-9b`, `flux-2-pro`, `flux-2-max`, `flux-2-flex` |
| Size       | `--size WIDTHxHEIGHT`                                                           |
| Format     | `--format jpeg\|png\|webp`                                                      |
| References | Repeatable `--input` (up to 4 images for Klein, 8 for Pro/Max/Flex)             |

```bash
bun autoshow image "a handmade ceramic espresso cup on a marble counter" --provider bfl=flux-2-klein-4b --size 1024x1024 --format webp
bun autoshow image "place the subject in a cozy cabin kitchen" --provider bfl=flux-2-pro --input input/subject.png --size 1024x1024
```

### Replicate

| Option       | Value                                                                                                                                                                                                      |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Selector     | `--provider replicate[=<model>]`                                                                                                                                                                           |
| Models       | `bytedance/seedream-4.5`, `bytedance/seedream-5-lite`, `bytedance/seedream-5-pro`, `qwen/qwen-image-2-pro`, `qwen/qwen-image-2`, `wan-video/wan-2.7-image-pro`, `wan-video/wan-2.7-image`                  |
| Size         | Seedream 4.5 `2K`/`4K`/`WIDTHxHEIGHT`; Seedream 5 Lite `2K`/`3K`; Seedream 5 Pro `1K`/`2K`; Wan `1K`/`2K`/`WIDTHxHEIGHT` (`4K` on `wan-video/wan-2.7-image-pro` text-to-image only); not supported by Qwen |
| Aspect ratio | Seedream and Qwen models only                                                                                                                                                                              |
| Count        | `--count 1-4` (Wan models); 1 image per request for others                                                                                                                                                 |
| Format       | `--format png\|jpeg` (Seedream 5 models)                                                                                                                                                                   |
| References   | Repeatable `--input` (up to 14 for Seedream 4.5/5-Lite, 10 for Seedream 5-Pro, 1 for Qwen, 9 for Wan)                                                                                                      |

```bash
bun autoshow image "a polished launch poster for a sci-fi audio drama" --provider replicate=wan-video/wan-2.7-image --size 2K --count 2
bun autoshow image "place the subject on a rustic breakfast table" --provider replicate=bytedance/seedream-4.5 --input input/subject.jpg --aspect-ratio 1:1
```

### Luma Labs

| Option       | Value                                                           |
| ------------ | --------------------------------------------------------------- |
| Selector     | `--provider lumalabs[=<model>]`                                 |
| Models       | `uni-1`, `uni-1-max`                                            |
| Aspect ratio | `16:9`, `4:3`, `3:2`, `1:1`, `2:3`, `3:4`, `9:16`, `2:1`, `1:2` |
| Format       | `--format png\|jpeg`; default `png`                             |
| References   | Repeatable `--input` (up to 9 images)                           |

```bash
bun autoshow image "a glass of iced coffee on a marble countertop in morning light" --provider lumalabs=uni-1 --aspect-ratio 16:9 --format png
bun autoshow image "a serene mountain lake at dawn" --provider lumalabs=uni-1-max --aspect-ratio 16:9
bun autoshow image "make the subject matte black and keep the same camera angle" --provider lumalabs=uni-1 --input input/subject.png
```

### fal.ai

| Option     | Value                                                         |
| ---------- | ------------------------------------------------------------- |
| Selector   | `--provider fal[=<model>]`                                    |
| Models     | `fal-ai/hidream-o1-image`, `alibaba/qwen-image-3`, `reve/2.1` |
| Count      | `--count 1-4`; default `1`                                    |
| Format     | `--format png\|jpeg\|webp`; default `png`                     |
| References | HiDream (up to 9), Qwen (up to 3), Reve (1)                   |

```bash
bun autoshow image "a technical cutaway illustration of a lunar greenhouse" --provider fal=fal-ai/hidream-o1-image --size 1024x1024
bun autoshow image "a launch poster with crisp typography" --provider fal=alibaba/qwen-image-3 --count 2
bun autoshow image "turn this into a dusk scene" --provider fal=reve/2.1 --input input/scene.png --aspect-ratio 16:9
```

## Output

- Single-provider runs write `generated-image.<ext>` (plus numbered variants for `--count > 1`) and `manifest.json`.
- Multi-provider runs write `generated-image-<provider>-<sanitized-model>.<ext>` per provider/model target and `manifest.json`.
- `--output-dir` controls the destination directory.
- `manifest.json` records single-run item metadata including `image` targets array, `cost`, and `timing`.

## Notes

- **OpenAI Latency**: Low quality is fastest; JPEG output is faster than PNG.
- **Pricing & Estimates**: Use `--price` to check estimated cost before running.

## Provider Capabilities

Marks match the [TTS capability tables](../step-4-tts/text-to-speech-and-voice.md#provider-capabilities): ✅ supported, ⚠️ partial or qualified, ❌ not exposed. Released dates are provider announcement or snapshot dates. Recency marks follow the TTS convention: current-year GA is ✅, older still-current snapshots are ⚠️, and pre-2026 engines are ❌. Rows are newest first. References use ✅ 8 or more, ⚠️ 1–7, and ❌ none. Max resolution uses ✅ 4K or 4MP and above, ⚠️ 2K/3K or about 2MP, and ❌ 1K-only or unpublished. Count uses ✅ 4 or more and ❌ 1. Formats use ✅ png/jpeg/webp, ⚠️ two formats, and ❌ a single format. Pricing is the AutoShow registry per-image rate. Cost rank orders models cheapest-first within each table (1 = cheapest) and ties share a rank; combined rows list prices and ranks in the same order as the models.

### Reference Images

| Provider                                        | Released      | References  | Max resolution        | Aspect ratio    | Count   | Formats                                | Pricing                         | Cost rank            |
| ----------------------------------------------- | ------------- | ----------- | --------------------- | --------------- | ------- | -------------------------------------- | ------------------------------- | -------------------- |
| Replicate `bytedance/seedream-5-pro`            | ✅ 2026-07-08 | ✅ Up to 10 | ⚠️ 2K                 | ✅ 9 ratios     | ❌ 1    | ⚠️ png/jpeg                            | $0.045/image                    | 9/15                 |
| Gemini `gemini-3.1-flash-lite-image`            | ✅ 2026-06-30 | ✅ Up to 14 | ❌ 1K                 | ✅ 10 ratios    | ❌ 1    | ❌ PNG                                 | $0.0336/image                   | 5/15                 |
| Gemini `gemini-3.1-flash-image`                 | ✅ 2026-05-28 | ✅ Up to 14 | ✅ 4K                 | ✅ 14 ratios    | ❌ 1    | ❌ PNG                                 | $0.067/image                    | 12/15                |
| Gemini `gemini-3-pro-image`                     | ✅ 2026-05-28 | ✅ Up to 14 | ✅ 4K                 | ✅ 10 ratios    | ❌ 1    | ❌ PNG                                 | $0.134/image                    | 15/15                |
| fal.ai `fal-ai/hidream-o1-image`                | ✅ 2026-05-09 | ✅ Up to 9  | ⚠️ Custom 256–2048    | ❌ Use `--size` | ✅ 1–4  | ✅ png/jpeg/webp                       | $0.01/image                     | 1/15                 |
| Luma Labs `uni-1` / `uni-1-max`                 | ✅ 2026-05-05 | ✅ Up to 9  | ❌ Unpublished        | ✅ 9 ratios     | ❌ 1    | ⚠️ png/jpeg                            | $0.0404 / $0.10 per image       | 8/15 / 14/15         |
| OpenAI `gpt-image-2`                            | ✅ 2026-04-21 | ✅ Up to 16 | ✅ Custom ≤3840       | ❌ Use `--size` | ✅ 1–10 | ⚠️ png/jpeg/webp; transparent rejected | $0.053/image                    | 10/15                |
| Replicate `wan-video/wan-2.7-image-pro`         | ✅ 2026-04-01 | ✅ Up to 9  | ✅ 4K text-to-image   | ❌ Use `--size` | ✅ 1–4  | ❌ PNG                                 | $0.03/image                     | 2/15                 |
| Replicate `wan-video/wan-2.7-image`             | ✅ 2026-04-01 | ✅ Up to 9  | ⚠️ 2K                 | ❌ Use `--size` | ✅ 1–4  | ❌ PNG                                 | $0.03/image                     | 2/15                 |
| Replicate `bytedance/seedream-5-lite`           | ✅ 2026-02-24 | ✅ Up to 14 | ⚠️ 3K                 | ✅ 9 ratios     | ❌ 1    | ⚠️ png/jpeg                            | $0.035/image                    | 6/15                 |
| Replicate `bytedance/seedream-4.5`              | ⚠️ 2025-12-03 | ✅ Up to 14 | ✅ 4K                 | ✅ 9 ratios     | ❌ 1    | ❌ JPEG                                | $0.04/image                     | 7/15                 |
| BFL `flux-2-pro` / `flux-2-max` / `flux-2-flex` | ⚠️ 2025-11-25 | ✅ Up to 8  | ⚠️ Custom WxH, min 64 | ❌ Use `--size` | ❌ 1    | ✅ jpeg/png/webp                       | $0.03 / $0.07 / $0.06 per image | 2/15 / 13/15 / 11/15 |

### 1–5 Reference Images

| Provider                                           | Released      | References | Max resolution           | Aspect ratio    | Count   | Formats          | Pricing                   | Cost rank |
| -------------------------------------------------- | ------------- | ---------- | ------------------------ | --------------- | ------- | ---------------- | ------------------------- | --------- |
| fal.ai `alibaba/qwen-image-3`                      | ✅ 2026-07-21 | ⚠️ Up to 3 | ⚠️ 2048 text / 1440 edit | ❌ Use `--size` | ✅ 1–4  | ✅ png/jpeg/webp | $0.0051/image             | 1/7       |
| fal.ai `reve/2.1`                                  | ✅ 2026-07-09 | ⚠️ 1       | ❌ Unpublished           | ✅ 18 ratios    | ✅ 1–4  | ✅ png/jpeg/webp | $0.25/image               | 7/7       |
| Grok `grok-imagine-image-quality`                  | ✅ 2026-04-03 | ⚠️ Up to 3 | ⚠️ 2K                    | ✅ 14 ratios    | ✅ 1–10 | ❌ JPEG          | $0.05/image               | 5/7       |
| Replicate `qwen/qwen-image-2-pro` / `qwen-image-2` | ✅ 2026-03-04 | ⚠️ 1       | ❌ Unpublished           | ✅ 9 ratios     | ❌ 1    | ❌ PNG           | $0.075 / $0.035 per image | 6/7 / 4/7 |
| BFL `flux-2-klein-4b` / `flux-2-klein-9b`          | ✅ 2026-01-15 | ⚠️ Up to 4 | ⚠️ Custom WxH, min 64    | ❌ Use `--size` | ❌ 1    | ✅ jpeg/png/webp | $0.014 / $0.015 per image | 2/7 / 3/7 |

Every listed model is text-to-image. OpenAI is the only engine that accepts `--mask`. Gemini Flash Image adds extra ultra-wide ratios (`1:4`, `4:1`, `1:8`, `8:1`) and search grounding; Flash Lite rejects `--search-grounding`. OpenAI `gpt-image-2` rejects `--background transparent`. BFL does not publish a maximum custom size. Wan 2.7 Pro 4K is text-to-image only.

Image test coverage is documented in [Step 5 Service Tests: Image](image-tests.md).
