# image

Generate images from a text prompt with the hosted image providers.

## Outline

- [Setup](#setup)
  - [Environment](#environment)
- [Usage](#usage)
- [Shared Image Options](#shared-image-options)
- [Workflow: Generate, Then Edit](#workflow-generate-then-edit)
- [Image Services](#image-services)
  - [Gemini](#gemini)
  - [OpenAI](#openai)
  - [Grok](#grok)
  - [BFL](#bfl)
  - [Reve](#reve)
  - [Recraft](#recraft)
  - [Replicate](#replicate)
  - [Luma Labs](#luma-labs)
- [Output](#output)
- [Notes](#notes)

## Setup

There are no local image-generation models in this project.

```bash
# hosted provider readiness check; image providers are API-based
bun autoshow setup --step image
```


### Environment

```bash
OPENAI_API_KEY=...
GEMINI_API_KEY=...
XAI_API_KEY=...
BFL_API_KEY=...
REVE_API_KEY=...
RECRAFT_API_TOKEN=...
REPLICATE_API_TOKEN=...
LUMA_AGENTS_API_KEY=...
```

## Usage

```bash
bun autoshow image <prompt> [flags]
```

`--provider` selectors accept an omitted model value and then resolve to the cheapest supported model. Model-selecting flags are repeatable, including repeated flags from the same provider.

## Shared Image Options

| Flag | Description |
|------|-------------|
| `--all-providers` | Select every supported image provider/model |
| `--provider-concurrency <n>` | Hosted image providers/models to run concurrently per item; default `10` |
| `--local-concurrency <n>` | Local image providers to run concurrently per item; default `10` |
| `--aspect-ratio <ratio>` | Provider-dependent aspect ratio control; Recraft sends this as its `size` value when `--size` is absent |
| `--size <size>` | Provider-dependent size or resolution control; Reve treats `WIDTHxHEIGHT` as a fit-within postprocess; Recraft sends this as its `size` value |
| `--quality <q>` | OpenAI quality: `low`, `medium`, `high`, or `auto` |
| `--format <fmt>` | OpenAI/BFL/Reve output format: `png`, `jpeg`, or `webp`; Replicate `seedream-5-lite` accepts `png` or `jpeg` |
| `--background <bg>` | OpenAI background mode: `transparent`, `opaque`, or `auto` |
| `--count <n>` | Number of images in one request for OpenAI/Grok `1-10`, Recraft `1-6`, or Replicate Wan `1-4` |
| `--input <path-or-url>` | Repeatable source/reference image for OpenAI, Grok, native Gemini, BFL, Reve, or Replicate edits/references |
| `--mask <path>` | OpenAI mask image for inpainting/edit workflows |
| `--compression <0-100>` | OpenAI JPEG/WebP output compression |
| `--response-mode <image\|text-image>` | Native Gemini response mode |
| `--search-grounding` | Enable native Gemini search grounding metadata |
| `--price` | Show the aggregated estimate and exit |
| `--output-dir <dir>` | Global flag: pin an exact run directory instead of `output/<timestamp>_image-gen/` |

```bash
bun autoshow image "a clean studio product photo of a red enamel camping mug on white seamless" --provider openai=gpt-image-2 --size 1024x1024 --format png --output-dir output/mug-base
bun autoshow image "turn this into a premium catalog product photo with a soft gray background and subtle shadow" --provider openai=gpt-image-2 --input output/mug-base/generated-image.png --format webp --compression 80 --output-dir output/mug-catalog
```

## Workflow: Generate, Then Edit

Image runs write their files under `output/<timestamp>_image-gen/` unless you pass `--output-dir <dir>`. Run the commands in this block in order: the later commands read the file created by the first command.

```bash
# 1. Generate the base image.
bun autoshow image "a clean studio product photo of a red enamel camping mug on white seamless" --provider openai=gpt-image-2 --size 1024x1024 --format png --output-dir output/mug-base

# 2. Edit the generated image.
bun autoshow image "make the mug matte black, keep the same camera angle, and place it on a walnut desk" --provider openai=gpt-image-2 --input output/mug-base/generated-image.png --format webp --compression 80 --output-dir output/mug-edit
```

The same generated file can also be used as a reference input for native Gemini, Grok, BFL, Reve, or Replicate workflows:

```bash
bun autoshow image "restyle this product image as a 1960s travel poster" --provider gemini=gemini-3.1-flash-image-preview --input output/mug-base/generated-image.png --output-dir output/mug-gemini
bun autoshow image "turn this into a glossy magazine ad on a warm kitchen counter" --provider grok=grok-imagine-image-quality --input output/mug-base/generated-image.png --size 1K --output-dir output/mug-grok
bun autoshow image "place the same mug on a rustic breakfast table" --provider bfl=flux-2-pro --input output/mug-base/generated-image.png --size 1024x1024 --output-dir output/mug-bfl
bun autoshow image "place the same mug in a minimalist editorial product scene" --provider reve=latest --input output/mug-base/generated-image.png --size 1024x1024 --output-dir output/mug-reve
bun autoshow image "place the same mug on a rustic breakfast table" --provider replicate=bytedance/seedream-4.5 --input output/mug-base/generated-image.png --output-dir output/mug-replicate
```

## Image Services

Each service example below that edits or references an image first generates the base image into `output/mug-base/`, so the blocks are self-contained. Run the commands in each block in order: the edit and reference commands read the file created by the generate command above them. Note the generated file name is provider-dependent (for example, Grok writes `generated-image.jpg`).

### Gemini

| Option | Value |
|--------|-------|
| Selector | `--provider gemini[=<model>]` |
| Models | `gemini-3.1-flash-image-preview` |
| Size | `--size 1K\|2K\|4K` |
| Aspect ratio | `1:1`, `2:3`, `3:2`, `3:4`, `4:3`, `9:16`, `16:9`, or `21:9` |
| Count | Native Gemini returns one image per request |
| References | `--input` |

```bash
bun autoshow image "a serene mountain lake at dawn" --provider gemini=gemini-3.1-flash-image-preview --size 1K --aspect-ratio 16:9
bun autoshow image "a clean studio product photo of a red enamel camping mug on white seamless" --provider gemini=gemini-3.1-flash-image-preview --output-dir output/mug-base
bun autoshow image "restyle the generated mug as a 1960s travel poster" --provider gemini=gemini-3.1-flash-image-preview --input output/mug-base/generated-image.png --output-dir output/mug-gemini-edit
```

### OpenAI

| Option | Value |
|--------|-------|
| Selector | `--provider openai[=<model>]` |
| Models | `gpt-image-2` |
| Size | `auto`, `1024x1024`, `1536x1024`, `1024x1536`; `gpt-image-2` also accepts constrained `WIDTHxHEIGHT` values |
| Quality | `--quality low\|medium\|high\|auto` |
| Format/background | `--format png\|jpeg\|webp`, `--background transparent\|opaque\|auto` |
| Count | `--count 1-10` |
| Edit/reference | `--input` and optional `--mask` with `gpt-image-2` |

```bash
bun autoshow image "a clean studio product photo of a red enamel camping mug on white seamless" --provider openai=gpt-image-2 --size 1024x1024 --format png --output-dir output/mug-base
bun autoshow image "make the mug matte black, keep the same camera angle, and place it on a walnut desk" --provider openai=gpt-image-2 --input output/mug-base/generated-image.png --format webp --compression 80 --output-dir output/mug-edit
bun autoshow image "a product sketch of the same travel mug concept" --provider openai=gpt-image-2 --size 1024x1024 --quality low
```

`gpt-image-2` accepts `auto` or `WIDTHxHEIGHT` when max edge is 3840 or less, both edges are multiples of 16, aspect ratio is at most 3:1, and total pixels are 655,360 through 8,294,400. It rejects `--background transparent`.

### Grok

| Option | Value |
|--------|-------|
| Selector | `--provider grok[=<model>]` |
| Models | `grok-imagine-image-quality`, `grok-imagine-image` |
| Size | `--size 1K\|2K` |
| Aspect ratio | `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `3:2`, `2:3`, `2:1`, `1:2`, `19.5:9`, `9:19.5`, `20:9`, `9:20`, or `auto` |
| Count | `--count 1-10` |
| Edit/reference | Up to three `--input` values with `grok-imagine-image-quality` |

```bash
bun autoshow image "a clean studio product photo of a red enamel camping mug on white seamless" --provider grok=grok-imagine-image-quality --size 1K --output-dir output/mug-base
bun autoshow image "turn the generated mug into a glossy magazine ad on a warm kitchen counter" --provider grok=grok-imagine-image-quality --input output/mug-base/generated-image.jpg --size 1K --output-dir output/mug-grok
bun autoshow image "a futuristic observatory at sunset" --provider grok=grok-imagine-image-quality --aspect-ratio 16:9 --size 1K --count 4
```

Grok responses include provider-reported billed cost when available, and that actual value is used in `run.json`.

### BFL

| Option | Value |
|--------|-------|
| Selector | `--provider bfl[=<model>]` |
| Models | `flux-2-pro`, `flux-2-max`, `flux-2-flex` |
| Size | `--size WIDTHxHEIGHT` |
| Format | `--format jpeg\|png\|webp` |
| References | Repeatable `--input`; up to eight images |

```bash
bun autoshow image "a cinematic product photo of a red enamel camping mug" --provider bfl=flux-2-pro --size 1024x1024 --format png --output-dir output/mug-base
bun autoshow image "place the same mug in a cozy cabin kitchen" --provider bfl=flux-2-pro --input output/mug-base/generated-image.png --size 1024x1024 --output-dir output/mug-bfl
```

BFL rejects `--aspect-ratio`, `--quality`, `--background`, `--mask`, and `--count`.

### Reve

| Option | Value |
|--------|-------|
| Selector | `--provider reve[=<model>]` |
| Models | `latest`, `reve-create@20250915` |
| Aspect ratio | `16:9`, `9:16`, `3:2`, `2:3`, `4:3`, `3:4`, or `1:1` |
| Size | `--size WIDTHxHEIGHT` as a fit-within resize after generation |
| Format | `--format png\|jpeg\|webp`; default `png` |
| References | one PNG/JPEG/WebP `--input` uses edit; two to six inputs use remix |

```bash
bun autoshow image "a quiet editorial product photo of a red enamel camping mug" --provider reve=latest --aspect-ratio 1:1 --format png --output-dir output/mug-base
bun autoshow image "make the mug matte black and keep the same camera angle" --provider reve=latest --input output/mug-base/generated-image.png --format webp --output-dir output/mug-reve-edit
bun autoshow image "combine the mug shape with the lighting and surface from these references" --provider reve=latest --input output/mug-base/generated-image.png --input input/examples/document/1-document.png --size 1024x1024 --output-dir output/mug-reve-remix
```

`--provider reve` with no model resolves to `latest`. `reve-create@20250915` is create-only in this command and rejects `--input`; use `--provider reve=latest` for edit or remix workflows. Reve rejects `--count`, `--quality`, `--background`, `--mask`, `--compression`, `--response-mode`, and `--search-grounding`. When Reve returns usage headers, AutoShow records provider-reported credits as cost at `$10 / 7500 credits`.

### Recraft

| Option | Value |
|--------|-------|
| Selector | `--provider recraft[=<model>]` |
| Models | `recraftv4_1`, `recraftv4_1_vector`, `recraftv4_1_pro`, `recraftv4_1_pro_vector`, `recraftv4_1_utility`, `recraftv4_1_utility_vector`, `recraftv4_1_utility_pro`, `recraftv4_1_utility_pro_vector` |
| Count | `--count 1-6`; default `1` |
| Size/aspect | Use either `--size <Recraft size>` or `--aspect-ratio <ratio>`, not both |
| Output | Raster models write PNG; vector models write SVG |

```bash
bun autoshow image "a clean editorial vector mark for a mountain guide service" --provider recraft=recraftv4_1_vector --aspect-ratio 1:1
bun autoshow image "a premium product photo of a red enamel camping mug on white seamless" --provider recraft=recraftv4_1 --size 1024x1024 --count 3
bun autoshow image "a compact illustrated travel postcard of a desert observatory" --provider recraft --aspect-ratio 16:9
```

`--provider recraft` with no model resolves to `recraftv4_1`, the lowest-cost remaining Recraft raster generation model in the local pricing table. Recraft generation maps both `--size` and `--aspect-ratio` to the API `size` field, so AutoShow rejects using both in one request.

Supported aspect ratios are `1:1`, `2:1`, `1:2`, `3:2`, `2:3`, `4:3`, `3:4`, `5:4`, `4:5`, `6:10`, `14:10`, `10:14`, `16:9`, and `9:16`. Vector models accept only those aspect ratios. Raster exact sizes depend on model family: standard V4.1 models accept 1MP sizes such as `1024x1024`, `1536x768`, and `1280x832`; Pro V4.1 models accept the corresponding 4MP sizes such as `2048x2048`, `3072x1536`, and `2560x1664`.

This command intentionally uses Recraft generation only. It does not expose Recraft style creation, prompt enhancement, vectorization, background removal, upscale, inpaint/outpaint, or image-to-image controls. Recraft rejects `--input`, `--mask`, `--quality`, `--format`, `--background`, `--compression`, `--response-mode`, and `--search-grounding`.

### Replicate

| Option | Value |
|--------|-------|
| Selector | `--provider replicate[=<model>]` |
| Models | `bytedance/seedream-4.5`, `bytedance/seedream-5-lite`, `qwen/qwen-image-2-pro`, `qwen/qwen-image-2`, `wan-video/wan-2.7-image-pro`, `wan-video/wan-2.7-image` |
| Size | Seedream and Wan models only; model-family-dependent values (see below) |
| Aspect ratio | Seedream and Qwen models only; model-family-dependent values (see below) |
| Count | `--count 1-4` with Wan models; other families return one image per request |
| Format | `--format png\|jpeg` with `bytedance/seedream-5-lite` only |
| References | Repeatable `--input`; up to fourteen images for Seedream, one for Qwen, or nine for Wan |

```bash
bun autoshow image "a polished launch poster for a sci-fi audio drama" --provider replicate=wan-video/wan-2.7-image --size 2K --count 2
bun autoshow image "a clean studio product photo of a red enamel camping mug on white seamless" --provider replicate=bytedance/seedream-4.5 --aspect-ratio 1:1 --output-dir output/mug-base
bun autoshow image "place the same mug on a rustic breakfast table" --provider replicate=bytedance/seedream-4.5 --input output/mug-base/generated-image.jpg --output-dir output/mug-replicate
```

`--provider replicate` with no model resolves to `wan-video/wan-2.7-image`, the lowest-cost Replicate image model in the local pricing table. Option support varies by model family. Seedream accepts `--size` (`2K`, `4K`, or `WIDTHxHEIGHT` with each edge 1024 through 4096 pixels on `seedream-4.5`; `2K` or `3K` on `seedream-5-lite`) and `--aspect-ratio` `1:1`, `4:3`, `3:4`, `16:9`, `9:16`, `3:2`, `2:3`, `21:9`, or `match_input_image`. Qwen rejects `--size` and accepts `--aspect-ratio` `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `3:2`, `2:3`, `2:1`, or `1:2`. Wan rejects `--aspect-ratio` and accepts `--size` `1K`, `2K`, or `WIDTHxHEIGHT` with each edge 256 through 4096 pixels; `--size 4K` works only for `wan-2.7-image-pro` text-to-image requests without `--input`. Replicate rejects `--quality`, `--background`, `--mask`, `--compression`, `--response-mode`, and `--search-grounding`. Local estimates use the per-image registry rate for each model and are recorded in `run.json` as a registry fallback.

### Luma Labs

| Option | Value |
|--------|-------|
| Selector | `--provider lumalabs[=<model>]` |
| Models | `uni-1`, `uni-1-max` |
| Aspect ratio | `16:9`, `4:3`, `3:2`, `1:1`, `2:3`, `3:4`, `9:16`, `2:1`, or `1:2` |
| Format | `--format png\|jpeg`; default `png` |
| References | Repeatable `--input`; up to nine images |

```bash
bun autoshow image "a quiet editorial product photo of a red enamel camping mug" --provider lumalabs=uni-1 --aspect-ratio 1:1 --format png --output-dir output/mug-base
bun autoshow image "make the mug matte black and keep the same camera angle" --provider lumalabs=uni-1 --input output/mug-base/generated-image.png --output-dir output/mug-lumalabs-edit
bun autoshow image "a serene mountain lake at dawn" --provider lumalabs=uni-1-max --aspect-ratio 16:9
```

Luma Labs runs against the Luma Agents API (`POST /v1/generations`, polled until `completed`). With no `--input`, the request is a text-to-image generation; with one `--input`, it is an image edit whose source is that reference, and any additional `--input` values are passed as extra image references. `--provider lumalabs` with no model resolves to `uni-1`, the lower-cost model. Luma Labs rejects `--size`, `--quality`, `--background`, `--count`, `--mask`, `--response-mode`, `--search-grounding`, and `--compression`. Local estimates use the per-image text-to-image rate (`uni-1` at `$0.0404`, `uni-1-max` at `$0.10`); provider billing should override when available.

## Output

- Standalone `image` runs always write `run.json`.
- Gemini writes `generated-image.png`.
- OpenAI writes `generated-image.<format>`, plus numbered variants for `--count`.
- Grok writes `generated-image.jpg`, plus numbered variants for `--count`.
- BFL writes `generated-image.jpg`, `generated-image.png`, or `generated-image.webp`.
- Reve writes `generated-image.png`, `generated-image.jpg`, or `generated-image.webp`.
- Recraft writes `generated-image.png` for raster models or `generated-image.svg` for vector models, plus numbered variants for `--count`.
- Replicate writes `generated-image.jpg` for `seedream-4.5`, `generated-image.png` or `generated-image.jpg` for `seedream-5-lite`, and `generated-image.png` for Qwen and Wan models, plus numbered variants for Wan `--count`.
- Luma Labs writes `generated-image.png` or `generated-image.jpg`.
- Multi-provider runs rename outputs to include the provider and model, such as `generated-image-openai-gpt-image-2.png`; slashes in Replicate model names become dashes, such as `generated-image-replicate-wan-video-wan-2.7-image.png`.
- `--output-dir` controls the run directory; generated file names remain provider-dependent and deterministic inside that directory.
- `run.json` includes `image`, `cost`, and `timing` sections. The `image` field is always an array, and each entry includes `imageFileNames`.

## Notes

- OpenAI documents these latency caveats for GPT Image models: low quality is fastest, square images are typically fastest, JPEG is faster than PNG, and complex prompts can take up to about 2 minutes.
- `gpt-image-2` estimate table: `1024x1024` costs about `0.6¢` low, `5.3¢` medium, `21.1¢` high; `1024x1536` and `1536x1024` cost about `0.5¢` low, `4.1¢` medium, `16.5¢` high. `auto` estimates as `1024x1024` medium; other valid flexible sizes use the `5.3¢` fallback and should be checked with OpenAI's calculator.
- Reve `--size WIDTHxHEIGHT` uses Reve's `fit_image` postprocessor, so it constrains the output within the requested bounds rather than guaranteeing an exact canvas size.
- Recraft prices are per generated image and vary by raster/vector generation and model family; use `--price` to inspect the local estimate before running.
