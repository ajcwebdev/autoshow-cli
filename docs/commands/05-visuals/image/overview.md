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
  - [Replicate](#replicate)
  - [Luma Labs](#luma-labs)
  - [fal.ai](#falai)
- [Output](#output)
- [Provider Capabilities](#provider-capabilities)

## Setup

```bash
bun autoshow setup --doctor
```

### Environment

```bash
OPENAI_API_KEY=...
GEMINI_API_KEY=...
XAI_API_KEY=...
REPLICATE_API_TOKEN=...
LUMA_AGENTS_API_KEY=...
FAL_API_KEY=...
```

## Usage

```bash
bun autoshow image <prompt> [flags]
```

Bare `--provider` flags without a model value resolve to the cheapest supported model. `--provider` is repeatable.

## Shared Image Options

The `image` and `resume` commands use the same short option names, including `--size`. Saved configuration uses the matching namespaced key, such as `defaults.image.size`.

| Flag                                   | Description                                                                                                                                  |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `--all-providers`                      | Select every supported image provider/model                                                                                                  |
| `--provider-concurrency <n>`           | Image providers/models to run concurrently; default `7`                                                                                      |
| `--concurrency-mode <ramp\|immediate>` | Ramp from one request (`ramp`, default) or start at the configured cap (`immediate`)                                                         |
| `--aspect-ratio <ratio>`               | Provider-dependent aspect ratio control                                                                                                      |
| `--size <size>`                        | Provider-dependent size or resolution control                                                                                                |
| `--quality <q>`                        | OpenAI quality: `low`, `medium`, `high`, or `auto`; GPT Image 2.5 also accepts `xhigh` and `max`. Grok Image 2.0: `low`, `medium`, or `auto` |
| `--format <fmt>`                       | Output format: `png`, `jpeg`, or `webp` depending on provider                                                                                |
| `--background <bg>`                    | OpenAI background mode: `transparent`, `opaque`, or `auto`                                                                                   |
| `--count <n>`                          | Number of images per request (OpenAI/Grok: `1-10`, fal.ai: `1-4`)                                                                            |
| `--input <path-or-url>`                | Repeatable source/reference image for edits or image-to-image workflows                                                                      |
| `--mask <path>`                        | OpenAI mask image for inpainting                                                                                                             |
| `--compression <0-100>`                | OpenAI JPEG/WebP output compression                                                                                                          |
| `--response-mode <image\|text-image>`  | Gemini response mode                                                                                                                         |
| `--price`                              | Show the aggregated estimate and exit                                                                                                        |
| `--max-model-cents <n>`                | Exclude each provider/model whose estimated total exceeds the per-model ceiling in cents; works with or without `--price`                    |
| `--output-dir <dir>`                   | Global flag: pin output directory instead of `output/<timestamp>_image-gen/`                                                                 |

See [Provider Capabilities](#provider-capabilities) for the per-model reference, resolution, aspect-ratio, count, format, and input/output price matrix.

```bash
bun autoshow image "a clean studio product photo of a red enamel camping mug on white seamless" --provider openai=gpt-image-2.5-flare --size 1024x1024 --quality medium --format png --output-dir output/mug-base
bun autoshow image "make only the mug matte black; preserve the logo, camera angle, lighting, and background" --provider openai=gpt-image-2.5-sunburst --input output/mug-base/generated-image.png --quality xhigh --format webp --compression 80 --output-dir output/mug-edit
bun autoshow image "a serene mountain lake at dawn" --all-providers --price
bun autoshow image "a serene mountain lake at dawn" --all-providers --max-model-cents 5 --price
```

## Image Services

### Gemini

| Option       | Value                                                                   |
| ------------ | ----------------------------------------------------------------------- |
| Selector     | `--provider gemini[=<model>]`                                           |
| Models       | `gemini-3.1-flash-lite-image`                                           |
| Size         | `1K`                                                                    |
| Aspect ratio | `1:1`, `2:3`, `3:2`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, `21:9` |
| Count        | 1 image per request                                                     |
| References   | Repeatable `--input` (up to 14 images)                                  |

```bash
bun autoshow image "a serene mountain lake at dawn" --provider gemini=gemini-3.1-flash-lite-image --size 1K --aspect-ratio 16:9
bun autoshow image "restyle this product image as a 1960s travel poster" --provider gemini=gemini-3.1-flash-lite-image --input input/reference.png --output-dir output/travel-poster
```

`gemini-3.1-flash-lite-image` is 1K-only. Gemini does not accept `--search-grounding`. Extra ratios `1:4`, `4:1`, `1:8`, and `8:1` are not available.

### OpenAI

| Option            | Value                                                                                |
| ----------------- | ------------------------------------------------------------------------------------ |
| Selector          | `--provider openai[=<model>]`                                                        |
| Models            | `gpt-image-2.5-flare` (bare default), `gpt-image-2.5-sunburst`, `gpt-image-2`        |
| Size              | `auto`, `1024x1024`, `1536x1024`, `1024x1536`, or custom `WIDTHxHEIGHT`              |
| Quality           | `--quality low\|medium\|high\|xhigh\|max\|auto`; `xhigh` and `max` require Image 2.5 |
| Format/background | `--format png\|jpeg\|webp`, `--background transparent\|opaque\|auto`                 |
| Count             | `--count 1-10`                                                                       |
| Edit/reference    | Up to 16 ordered `--input` references with optional `--mask`                         |

```bash
bun autoshow image "Product concept: enamel travel mug. Composition: centered front view. Style: pencil sketch on white. Preserve: proportions from the reference." --provider openai=gpt-image-2.5-flare --input input/product.png --size 1024x1024 --quality low
bun autoshow image "Change only the mug color to blue. Preserve the logo, lighting, camera angle, and background." --provider openai=gpt-image-2.5-sunburst --input input/product.png --mask input/mask.png --quality xhigh --format webp
bun autoshow image "A clean cutout of a red camping mug with no background" --provider openai=gpt-image-2.5-flare --background transparent --format png --size 1024x1024 --quality medium --price
```

Flare suits rapid drafts and everyday generation; Sunburst suits precise edits and polished assets. For successive edits, pass the previous output back through `--input`, describe the change, and state what should stay consistent.

OpenAI is the only provider that accepts `--mask`. Image 2.5 supports transparency with PNG or WebP; JPEG with transparency is rejected. `gpt-image-2` rejects transparency and the `xhigh` and `max` quality levels. Custom dimensions must be multiples of 16, within a 3:1 aspect ratio, at most 3840 pixels per edge, and between 655,360 and 8,294,400 total pixels.

At 1024×1024, Image 2.5 output estimates are $0.00588 (low), $0.01317 (medium), $0.05268 (high), $0.09366 (xhigh), and $0.21072 (max). Omitted or `auto` size and quality are estimated as 1024×1024 medium.

### Grok

| Option         | Value                                                                                                                      |
| -------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Selector       | `--provider grok[=<model>]`                                                                                                |
| Models         | `grok-imagine-image-2.0` (bare default)                                                                                    |
| Size           | `--size 1K\|2K`                                                                                                            |
| Quality        | `--quality low\|medium\|auto`                                                                                              |
| Aspect ratio   | `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `3:2`, `2:3`, `2:1`, `1:2`, `19.5:9`, `9:19.5`, `20:9`, `9:20`, `21:9`, `5:2`, `auto` |
| Count          | `--count 1-10`                                                                                                             |
| Edit/reference | PNG/JPEG files, data URLs or public URLs: up to 5                                                                          |

Omitted or `auto` quality means `low` for generation and `medium` for editing. Omitted size is `1K`. `high` and sizes outside `1K|2K` are rejected.

```bash
bun autoshow image "a futuristic observatory at sunset" --provider grok=grok-imagine-image-2.0 --aspect-ratio 16:9 --size 1K --count 4
bun autoshow image "turn the reference into a glossy magazine ad on a warm kitchen counter" --provider grok=grok-imagine-image-2.0 --input input/reference.jpg --size 1K
bun autoshow image "a geometric lighthouse poster" --provider grok=grok-imagine-image-2.0 --quality medium --size 2K
```

### Replicate

| Option       | Value                                                                                                       |
| ------------ | ----------------------------------------------------------------------------------------------------------- |
| Selector     | `--provider replicate[=<model>]`                                                                            |
| Models       | `bytedance/seedream-5-lite`, `bytedance/seedream-5-pro`, `alibaba/qwen-image-3`, `alibaba/qwen-image-3-pro` |
| Size         | Seedream 5 Lite `2K`/`3K`; Seedream 5 Pro `1K`/`2K`; not supported by Qwen                                  |
| Aspect ratio | Seedream and Qwen models only                                                                               |
| Count        | 1 image per request                                                                                         |
| Format       | `--format png\|jpeg` (Seedream 5 models)                                                                    |
| References   | Repeatable `--input` (up to 14 for Seedream 5-Lite, 10 for Seedream 5-Pro, 1 for Qwen)                      |

```bash
bun autoshow image "a polished launch poster for a sci-fi audio drama" --provider replicate=bytedance/seedream-5-lite --size 2K --aspect-ratio 16:9
bun autoshow image "place the subject on a rustic breakfast table" --provider replicate=bytedance/seedream-5-pro --input input/subject.jpg --aspect-ratio 1:1
```

Bare `--provider replicate` selects Qwen Image 3. Replicate Qwen Image 3 and 3 Pro support generation and single-image editing with `--input`; editing retains the reference aspect ratio. Use `--aspect-ratio` for generation. Explicit size, count, and output-format controls are unsupported. The identically named fal Qwen 3 has separate pricing and reference limits.

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
bun autoshow image "make the subject matte black and keep the same camera angle" --provider lumalabs=uni-1 --input input/subject.png
```

### fal.ai

| Option     | Value                                             |
| ---------- | ------------------------------------------------- |
| Selector   | `--provider fal[=<model>]`                        |
| Models     | `fal-ai/hidream-o1-image`, `alibaba/qwen-image-3` |
| Count      | `--count 1-4`; default `1`                        |
| Format     | `--format png\|jpeg\|webp`; default `png`         |
| References | HiDream (up to 9), Qwen (up to 3)                 |

```bash
bun autoshow image "a technical cutaway illustration of a lunar greenhouse" --provider fal=fal-ai/hidream-o1-image --size 1024x1024
bun autoshow image "a launch poster with crisp typography" --provider fal=alibaba/qwen-image-3 --count 2
```

## Output

- Single-provider runs write `generated-image.<ext>` (plus numbered variants for `--count > 1`) and `manifest.json`.
- Multi-provider runs write `generated-image-<provider>-<model>.<ext>` per target and `manifest.json`.
- `--output-dir` pins the destination directory.
- `manifest.json` records `image`, `cost`, and `timing`; `image` is an array.

## Provider Capabilities

Outputs are the per-image estimate. Inputs are extra billed reference or edit cost when published separately; `Included` means the published rate is per output image, and `Not estimated` means the provider may bill inputs but AutoShow does not include them in the local estimate. Output pricing: ✅ cheapest third, ⚠️ middle third, ❌ most expensive third. Cost rank is cheapest first (1 = cheapest); ties share a rank. Rows are newest first. Released dates are provider announcement or model-origin dates. Recency marks: ✅ 2026-04-01 or later, ⚠️ 2026-01-01 through 2026-03-31, ❌ before 2026-01-01. References: ❌ none, ⚠️ up to 3, ✅ 4 or more. Max resolution: ✅ 3K/4K/custom, ⚠️ 2K, ❌ 1K/unpublished. Aspect ratio: ✅ size/14+, ⚠️ 10–13, ❌ 9 or fewer. Count: ✅ 1–10, ⚠️ 1–4, ❌ 1. Formats: ✅ png/jpeg/webp, ⚠️ png/jpeg, ❌ single format.

| Provider                              | Released      | References  | Max resolution           | Aspect ratio    | Count   | Formats          | Inputs                    | Outputs                           | Cost rank |
| ------------------------------------- | ------------- | ----------- | ------------------------ | --------------- | ------- | ---------------- | ------------------------- | --------------------------------- | --------- |
| OpenAI `gpt-image-2.5-flare`          | ✅ 2026-09-08 | ✅ Up to 16 | ✅ Custom ≤3840          | ✅ Use `--size` | ✅ 1–10 | ✅ png/jpeg/webp | $5/M text; $8/M image     | ✅ $0.01317 at 1024-square medium | 3/13      |
| OpenAI `gpt-image-2.5-sunburst`       | ✅ 2026-09-08 | ✅ Up to 16 | ✅ Custom ≤3840          | ✅ Use `--size` | ✅ 1–10 | ✅ png/jpeg/webp | $5/M text; $8/M image     | ✅ $0.01317 at 1024-square medium | 3/13      |
| Grok `grok-imagine-image-2.0`         | ✅ 2026-08-07 | ✅ Up to 5  | ⚠️ 2K                    | ✅ 16 ratios    | ✅ 1–10 | ❌ JPEG          | $0.01/image               | ⚠️ $0.04–$0.08                    | 8/13      |
| Replicate `alibaba/qwen-image-3`      | ✅ 2026-07-21 | ⚠️ 1        | ❌ Unpublished           | ❌ 9 ratios     | ❌ 1    | ❌ PNG           | Included                  | ✅ $0.03/image                    | 5/13      |
| Replicate `alibaba/qwen-image-3-pro`  | ✅ 2026-07-21 | ⚠️ 1        | ❌ Unpublished           | ❌ 9 ratios     | ❌ 1    | ❌ PNG           | Included                  | ⚠️ $0.04/image                    | 8/13      |
| fal.ai `alibaba/qwen-image-3`         | ✅ 2026-07-21 | ⚠️ Up to 3  | ⚠️ 2048 text / 1440 edit | ✅ Use `--size` | ⚠️ 1–4  | ✅ png/jpeg/webp | Included                  | ✅ $0.0051/image                  | 1/13      |
| Gemini `gemini-3.1-flash-lite-image`  | ✅ 2026-06-30 | ✅ Up to 14 | ❌ 1K                    | ⚠️ 10 ratios    | ❌ 1    | ❌ PNG           | Not estimated             | ⚠️ $0.0336/image                  | 6/13      |
| Replicate `bytedance/seedream-5-pro`  | ✅ 2026-06-28 | ✅ Up to 10 | ⚠️ 2K                    | ❌ 9 ratios     | ❌ 1    | ⚠️ png/jpeg      | Included                  | ❌ $0.045/image                   | 11/13     |
| fal.ai `fal-ai/hidream-o1-image`      | ✅ 2026-05-08 | ✅ Up to 9  | ⚠️ Custom 256–2048       | ✅ Use `--size` | ⚠️ 1–4  | ✅ png/jpeg/webp | Included                  | ✅ $0.01/image                    | 2/13      |
| OpenAI `gpt-image-2`                  | ✅ 2026-04-21 | ✅ Up to 16 | ✅ Custom ≤3840          | ✅ Use `--size` | ✅ 1–10 | ✅ png/jpeg/webp | Not estimated             | ❌ $0.053/image                   | 12/13     |
| Luma Labs `uni-1`                     | ⚠️ 2026-03-22 | ✅ Up to 9  | ❌ Unpublished           | ❌ 9 ratios     | ❌ 1    | ⚠️ png/jpeg      | ~$0.003/edit or reference | ❌ $0.0404/image                  | 10/13     |
| Luma Labs `uni-1-max`                 | ⚠️ 2026-03-22 | ✅ Up to 9  | ❌ Unpublished           | ❌ 9 ratios     | ❌ 1    | ⚠️ png/jpeg      | ~$0.003/edit or reference | ❌ $0.10/image                    | 13/13     |
| Replicate `bytedance/seedream-5-lite` | ⚠️ 2026-01-28 | ✅ Up to 14 | ✅ 3K                    | ❌ 9 ratios     | ❌ 1    | ⚠️ png/jpeg      | Included                  | ⚠️ $0.035/image                   | 7/13      |
