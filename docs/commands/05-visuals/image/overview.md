# image

Generate images from a text prompt with hosted image providers.

## Outline

- [Setup](#setup)
  - [Environment](#environment)
- [Usage](#usage)
- [Generate then edit](#generate-then-edit)
- [Shared Image Options](#shared-image-options)
- [Image Services](#image-services)
  - [Gemini](#gemini)
  - [OpenAI](#openai)
  - [Grok](#grok)
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
```

## Usage

```bash
bun autoshow image <prompt> [flags]
```

Bare `--provider` flags without a model value resolve to the cheapest supported model. `--provider` is repeatable.

Saved `defaults.image` selections and controls apply unless explicitly overridden. Without a saved selection, choose `--provider` or `--all-providers`.

Reference examples use the bundled Harborlight mug illustration in PNG or JPEG. Its 1024 × 1024 edit mask opens the mug paint while protecting the badge and background. See [fixture provenance and reproduction](../../../../input/examples/harborlight-README.md).

## Shared Image Options

The `image` and `resume` commands use the same short option names, including `--size`. Saved configuration uses the matching namespaced key, such as `defaults.image.size`.

| Flag                                   | Description                                                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `--all-providers`                      | Select every supported image provider/model                                                                               |
| `--provider-concurrency <n>`           | Image providers/models to run concurrently; default `7`                                                                   |
| `--concurrency-mode <ramp\|immediate>` | Ramp from one request (`ramp`, default) or start at the configured cap (`immediate`)                                      |
| `--aspect-ratio <ratio>`               | Provider-dependent aspect ratio control                                                                                   |
| `--size <size>`                        | Provider-dependent size or resolution control                                                                             |
| `--quality <q>`                        | OpenAI: `low`, `medium`, `high`, `xhigh`, `max`, or `auto`; Grok: `low`, `medium`, or `auto`                              |
| `--format <fmt>`                       | OpenAI output format: `png`, `jpeg`, or `webp`; Gemini and Grok reject this flag                                          |
| `--background <bg>`                    | OpenAI background mode: `transparent`, `opaque`, or `auto`                                                                |
| `--count <n>`                          | Number of images per request (OpenAI/Grok: `1-10`)                                                                        |
| `--input <path-or-url>`                | Repeatable source/reference image for edits or image-to-image workflows                                                   |
| `--mask <path>`                        | Local PNG mask for OpenAI inpainting; requires at least one `--input`                                                     |
| `--compression <0-100>`                | OpenAI JPEG/WebP output compression                                                                                       |
| `--response-mode <image\|text-image>`  | Gemini response mode                                                                                                      |
| `--price`                              | Show the aggregated estimate and exit                                                                                     |
| `--max-model-cents <n>`                | Exclude each provider/model whose estimated total exceeds the per-model ceiling in cents; works with or without `--price` |
| `--output-dir <dir>`                   | Global flag: pin output directory instead of `output/<timestamp>_image-gen/`                                              |

See [Provider Capabilities](#provider-capabilities) for the per-model reference, resolution, aspect-ratio, count, format, and input/output price matrix.

```bash
bun autoshow image "a panoramic harbor at dawn" --provider gemini=gemini-nano-banana-2.1 --size 4K --aspect-ratio 8:1 --price
bun autoshow image "a serene mountain lake at dawn" --all-providers --price
bun autoshow image "a serene mountain lake at dawn" --all-providers --max-model-cents 5 --price
```

## Generate then edit

The edit depends on a successful base-image run. This single-target PNG generation writes `output/mug-base/generated-image.png`; other formats, counts, or target combinations can produce different filenames. Check the manifest and reported filenames before adapting the example.

Estimate both hosted stages together, including planned retries, before dispatch. The bundled mug supplies the edit reference until the generated base exists. Estimates are not invoices or spending caps; recheck the edit estimate against the actual base after generation.

```bash
bun autoshow image "a studio photo of a teal enamel camping mug with a cream compass-and-mountain badge on white seamless" --provider openai=gpt-image-2.5-flare --count 1 --size 1024x1024 --quality medium --format png --price
bun autoshow image "make only the mug matte black; preserve the logo, camera angle, lighting, and background" --provider openai=gpt-image-2.5-sunburst --input input/examples/image/harborlight-mug.png --size 1024x1024 --quality xhigh --format webp --compression 80 --price
```

Configure `OPENAI_API_KEY` and use unused output directories or resume compatible existing work. Install FFmpeg/ffprobe with `setup` if needed; `setup --doctor` only checks them. The local verifier checks the codec, dimensions, and decoded image without a provider call. The subshell stops if generation or verification fails.

```bash
(
  set -e
  bun autoshow image "a studio photo of a teal enamel camping mug with a cream compass-and-mountain badge on white seamless" --provider openai=gpt-image-2.5-flare --count 1 --size 1024x1024 --quality medium --format png --output-dir output/mug-base
  bun --no-env-file src/tools/verify-image-artifact.ts output/mug-base/generated-image.png --size 1024x1024
  bun autoshow image "make only the mug matte black; preserve the logo, camera angle, lighting, and background" --provider openai=gpt-image-2.5-sunburst --input output/mug-base/generated-image.png --size 1024x1024 --quality xhigh --format webp --compression 80 --price
)
```

Review the revised quote and base image before purchasing the edit, including the incurred base cost and planned retries. Recheck the base before dispatch, then verify the edited output:

```bash
(
  set -e
  bun --no-env-file src/tools/verify-image-artifact.ts output/mug-base/generated-image.png --size 1024x1024
  bun autoshow image "make only the mug matte black; preserve the logo, camera angle, lighting, and background" --provider openai=gpt-image-2.5-sunburst --input output/mug-base/generated-image.png --size 1024x1024 --quality xhigh --format webp --compression 80 --output-dir output/mug-edit
  bun --no-env-file src/tools/verify-image-artifact.ts output/mug-edit/generated-image.webp --size 1024x1024
)
```

The edited output is `output/mug-edit/generated-image.webp`. Inspect it to assess the requested appearance; decoding does not prove that the model preserved the badge. To edit the bundled illustration directly, omit base generation and use `input/examples/image/harborlight-mug.png` as the input; the hosted edit remains billable.

## Image Services

### Gemini

| Option       | Value                                                                   |
| ------------ | ----------------------------------------------------------------------- |
| Selector     | `--provider gemini[=<model>]`                                           |
| Models       | `gemini-3.1-flash-lite-image` (bare default), `gemini-nano-banana-2.1`  |
| Size         | Lite: `1K`; Nano Banana 2.1: `1K`, `2K`, `4K`                           |
| Aspect ratio | `1:1`, `2:3`, `3:2`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, `21:9` |
| Extra ratios | Nano Banana 2.1 also accepts `1:4`, `4:1`, `1:8`, `8:1`                 |
| Count        | 1 image per request; omit `--count`                                     |
| References   | Repeatable `--input` (up to 14 images)                                  |

```bash
bun autoshow image "a panoramic harbor at dawn" --provider gemini=gemini-nano-banana-2.1 --size 4K --aspect-ratio 8:1 --price
bun autoshow image "a serene mountain lake at dawn" --provider gemini=gemini-3.1-flash-lite-image --size 1K --aspect-ratio 16:9
bun autoshow image "restyle this teal camping mug illustration as a 1960s harbor travel poster; preserve its cream compass-and-mountain badge" --provider gemini=gemini-3.1-flash-lite-image --input input/examples/image/harborlight-mug.png --output-dir output/travel-poster
```

Nano Banana 2.1 uses the existing GenerateContent endpoint for generation and image-reference editing. Omitted size uses provider sizing (default 1K), and `--response-mode text-image` requests text alongside images. Text and image input ($1.50/M tokens), text/thinking output ($7.50/M tokens), and search grounding are excluded from image-only estimates. This command does not enable grounding or expose thinking controls, video/PDF references, or conversational sessions. The [pricing page](https://ai.google.dev/gemini-api/docs/pricing), checked 2026-10-29, specifies 1,120/1,680/3,780 image tokens at $30/M for 1K/2K/4K: $0.0336/$0.0504/$0.1134. Its 4K tariff takes precedence over the generation guide's conflicting 2,520-token table. These are output estimates, not spending bounds or quality measurements.

### OpenAI

| Option            | Value                                                                   |
| ----------------- | ----------------------------------------------------------------------- |
| Selector          | `--provider openai[=<model>]`                                           |
| Models            | `gpt-image-2.5-flare` (bare default), `gpt-image-2.5-sunburst`          |
| Size              | `auto`, `1024x1024`, `1536x1024`, `1024x1536`, or custom `WIDTHxHEIGHT` |
| Quality           | `--quality low\|medium\|high\|xhigh\|max\|auto`                         |
| Format/background | `--format png\|jpeg\|webp`, `--background transparent\|opaque\|auto`    |
| Count             | `--count 1-10`                                                          |
| Edit/reference    | Up to 16 ordered `--input` references with optional `--mask`            |

```bash
bun autoshow image "Product concept: enamel travel mug. Composition: centered front view. Style: pencil sketch on white. Preserve: proportions from the reference." --provider openai=gpt-image-2.5-flare --input input/examples/image/harborlight-mug.png --size 1024x1024 --quality low
bun autoshow image "Change only the mug color to blue. Preserve the logo, lighting, camera angle, and background." --provider openai=gpt-image-2.5-sunburst --input input/examples/image/harborlight-mug.png --mask input/examples/image/harborlight-mug-mask.png --quality xhigh --format webp
bun autoshow image "A clean cutout of a red camping mug with no background" --provider openai=gpt-image-2.5-flare --background transparent --format png --size 1024x1024 --quality medium --price
```

Flare suits rapid drafts and everyday generation; Sunburst suits precise edits and polished assets. For successive edits, pass the previous output back through `--input`, describe the change, and state what should stay consistent.

Image 2.5 supports transparency with PNG or WebP; JPEG with transparency is rejected. Custom dimensions must be multiples of 16, within a 3:1 aspect ratio, at most 3840 pixels per edge, and between 655,360 and 8,294,400 total pixels. OpenAI uses `--size` rather than `--aspect-ratio`.

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

Omitted or `auto` quality means `low` for generation and `medium` for editing. Omitted size is `1K`.

```bash
bun autoshow image "a futuristic observatory at sunset" --provider grok=grok-imagine-image-2.0 --aspect-ratio 16:9 --size 1K --count 4
bun autoshow image "turn the teal camping mug reference into a magazine ad on a warm kitchen counter; preserve its cream badge" --provider grok=grok-imagine-image-2.0 --input input/examples/image/harborlight-mug.jpg --size 1K
bun autoshow image "a geometric lighthouse poster" --provider grok=grok-imagine-image-2.0 --quality medium --size 2K
```

## Output

- Single-target runs write `generated-image.<ext>`, with `-2`, `-3`, and later suffixes for additional images.
- Multiple selected models use `generated-image-<provider>-<model>.<ext>`, including multiple models from one provider, with numbered suffixes for additional images.
- `manifest.json` records generated filenames, provider/model identity, costs, and timing.

## Provider Capabilities

Output prices are per-image estimates; `M` means one million tokens. Input rates are additional reference or prompt charges. OpenAI estimates references at 1,000 tokens per input per output but omits prompt tokens; Gemini input tokens are not estimated. Grok charges each reference once per request, independently of output count.

| Provider                             | References | Max resolution | Aspect ratio | Count | Formats       | Input rate            | Output estimate                |
| ------------------------------------ | ---------- | -------------- | ------------ | ----- | ------------- | --------------------- | ------------------------------ |
| OpenAI `gpt-image-2.5-flare`         | Up to 16   | Custom ≤3840   | Use `--size` | 1–10  | PNG/JPEG/WebP | $5/M text; $8/M image | $0.01317 at 1024-square medium |
| OpenAI `gpt-image-2.5-sunburst`      | Up to 16   | Custom ≤3840   | Use `--size` | 1–10  | PNG/JPEG/WebP | $5/M text; $8/M image | $0.01317 at 1024-square medium |
| Grok `grok-imagine-image-2.0`        | Up to 5    | 2K             | 16 ratios    | 1–10  | JPEG          | $0.01/image           | $0.04–$0.08                    |
| Gemini `gemini-3.1-flash-lite-image` | Up to 14   | 1K             | 10 ratios    | 1     | PNG           | Not estimated         | $0.0336/image                  |
| Gemini `gemini-nano-banana-2.1`      | Up to 14   | 4K             | 14 ratios    | 1     | PNG/JPEG/WebP | $1.50/M tokens        | $0.0336–$0.1134/image          |
