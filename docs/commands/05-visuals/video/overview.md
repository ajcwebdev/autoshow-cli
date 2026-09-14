# video

Generate a video from a text prompt or input image with one or more hosted video providers and models.

## Outline

- [Setup](#setup)
  - [Environment](#environment)
- [Usage](#usage)
- [Modes](#modes)
- [Shared Video Options](#shared-video-options)
- [Video Services](#video-services)
  - [Gemini Omni](#gemini-omni)
  - [Grok](#grok)
  - [LTX](#ltx)
  - [Replicate](#replicate)
  - [Luma Labs](#luma-labs)
  - [fal.ai](#falai)
- [Output](#output)
- [Notes](#notes)
- [Provider Capabilities](#provider-capabilities)

## Setup

```bash
bun autoshow setup --doctor
```

### Environment

```bash
GEMINI_API_KEY=...
XAI_API_KEY=...
LTXV_API_KEY=...
REPLICATE_API_TOKEN=...
LUMA_AGENTS_API_KEY=...
FAL_API_KEY=...
```

## Usage

```bash
bun autoshow video <input> [flags]
```

The positional input is a text prompt or an image path, URL, or data URL. A positional image input infers `--mode image-to-video` and cannot be combined with media-input flags. When no provider is specified, a text prompt runs the cheapest default text-to-video target and a positional image input runs every supported provider.

## Modes

Passing media flags without `--mode` is rejected because the default mode is text-to-video.

| Mode                 | Providers                                       | Required inputs                                                              | Notes                                      |
| -------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------ |
| `text`               | All video providers                             | none                                                                         | Default mode                               |
| `image-to-video`     | Gemini, Grok, LTX, Replicate, Luma Labs, fal.ai | `--input-image`                                                              | Animates the input image                   |
| `reference-to-video` | Gemini, Grok, Replicate, fal.ai                 | `--reference-image` and/or `--reference-video`                               | Style or subject references                |
| `interpolate`        | Gemini, LTX 2.5, Replicate, fal.ai              | `--input-image`, `--last-frame`                                              | First/last-frame transition                |
| `edit`               | Gemini Omni                                     | `--previous-interaction-id` or `--input-video`                               | Conversational or uploaded-video edit      |
| `extend`             | Gemini Omni                                     | `--previous-interaction-id` or `--input-video`; optional `--reference-image` | Append-only continuation, 3–10s per extend |

`--input-video` is a video reference for `reference-to-video` on other providers. For Gemini Omni it is the source clip for `edit` and `extend`.

```bash
# Image animation
bun autoshow video "animate product on a slow turntable" --provider gemini=gemini-omni-1.1-flash --mode image-to-video --input-image input/product.png --output-dir output/v-base

# Interpolation and multi-reference examples
bun autoshow video "transition between frames" --provider gemini=gemini-omni-1.1-flash --mode interpolate --input-image input/start.png --last-frame input/end.png
bun autoshow video "character walking through lagoon" --provider grok=grok-imagine-video-1.5 --mode reference-to-video --reference-image input/jacket.png --reference-image input/glasses.png
```

## Shared Video Options

The `video` and `resume` commands use the same short option names, including `--duration`. Saved configuration uses the matching namespaced key, such as `defaults.video.duration`.

| Flag                                   | Description                                                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `--provider provider[=model]`          | Hosted video provider/model selector; repeat to run multiple targets                                                      |
| `--all-providers`                      | Run every supported video provider/model                                                                                  |
| `--provider-concurrency <n>`           | Hosted video providers/models to run concurrently; default `7`                                                            |
| `--concurrency-mode <ramp\|immediate>` | Ramp from one request (`ramp`, default) or start at the configured cap (`immediate`)                                      |
| `--duration <seconds>`                 | Requested video duration                                                                                                  |
| `--aspect-ratio <ratio>`               | Provider-dependent aspect ratio                                                                                           |
| `--resolution <res>`                   | Provider-dependent resolution control                                                                                     |
| `--mode <mode>`                        | `text`, `image-to-video`, `reference-to-video`, `interpolate`, `edit`, or `extend`; default `text`                        |
| `--input-image <path-or-url>`          | Input image for `image-to-video`; first frame for `interpolate`                                                           |
| `--last-frame <path-or-url>`           | Last-frame image for `interpolate`                                                                                        |
| `--reference-image <path-or-url>`      | Reference image for `reference-to-video` or Gemini Omni `extend`; repeatable                                              |
| `--reference-video <path-or-url>`      | Reference MP4 for Gemini Omni (up to 3, 3s each), Replicate Seedance, and fal.ai MiniMax H3/Seedance 2.5; repeatable      |
| `--reference-audio <path-or-url>`      | Reference audio for Replicate Seedance and fal.ai MiniMax H3/Seedance 2.5; repeatable                                     |
| `--input-video <path-or-url>`          | Input MP4 video reference for `reference-to-video`, or Gemini Omni `edit`/`extend` source (uploaded sources ≤10s)         |
| `--previous-interaction-id <id>`       | Gemini Omni prior interaction id from `providerRequestId`; use with `edit` or `extend` instead of re-uploading            |
| `--generate-audio`                     | Native audio where supported (Replicate Seedance/PixVerse, fal.ai Seedance 2.5)                                           |
| `--price`                              | Show the estimate and exit                                                                                                |
| `--max-model-cents <n>`                | Exclude each provider/model whose estimated total exceeds the per-model ceiling in cents; works with or without `--price` |
| `--output-dir <dir>`                   | Global flag: pin an exact run directory instead of `output/<timestamp>_video-gen/`                                        |

See [Provider Capabilities](#provider-capabilities) for the per-model matrix.

```bash
bun autoshow video "a rainy neon city street, slow camera pan" --provider gemini=gemini-omni-1.1-flash --provider grok=grok-imagine-video-1.5 --provider ltx=ltx-2-5-fast
bun autoshow video "a rainy neon city street, slow camera pan" --all-providers --price
bun autoshow video "a rainy neon city street, slow camera pan" --all-providers --max-model-cents 100 --price
```

## Video Services

### Gemini Omni

| Option       | Value                                                       |
| ------------ | ----------------------------------------------------------- |
| Selector     | `--provider gemini[=<model>]`                               |
| Models       | `gemini-omni-1.1-flash` (bare default)                      |
| Duration     | `--duration <seconds>`; accepted values `3` through `10`    |
| Resolution   | `--resolution 360p\|720p\|1080p\|4k`; default `720p`        |
| Aspect ratio | `--aspect-ratio 16:9\|9:16`; default `16:9`                 |

```bash
bun autoshow video "a rainy neon city street, slow camera pan" --provider gemini=gemini-omni-1.1-flash
bun autoshow video "a sweeping Grand Canyon drone shot" --provider gemini=gemini-omni-1.1-flash --duration 8 --aspect-ratio 16:9 --resolution 1080p
bun autoshow video "make the violin invisible" --provider gemini=gemini-omni-1.1-flash --mode edit --previous-interaction-id v1_abc
bun autoshow video "continue the scene" --provider gemini=gemini-omni-1.1-flash --mode extend --input-video input/examples/video/2-video.mp4
```

- Native audio is always on. 1080p and 4K are upscaled. Unspecified duration is estimated at 10 seconds.
- `edit` and `extend` take either `--previous-interaction-id` (from a prior manifest `providerRequestId`) or an uploaded `--input-video` of 10 seconds or less. Extension is append-only.
- Uploaded edit/extend is not available in the EEA, Switzerland, or the United Kingdom. Audio references and voice editing are not supported.
- [Omni docs](https://ai.google.dev/gemini-api/docs/omni), [pricing](https://ai.google.dev/gemini-api/docs/pricing)

### Grok

| Option              | Value                                                    |
| ------------------- | -------------------------------------------------------- |
| Selector            | `--provider grok[=<model>]`                              |
| Models              | `grok-imagine-video-1.5` (bare default)                  |
| Duration/resolution | `--duration <seconds>`, `--resolution 480p\|720p\|1080p` |

```bash
bun autoshow video "cinematic moonlit coastline" --provider grok=grok-imagine-video-1.5 --duration 8 --resolution 1080p
bun autoshow video "character walking through lagoon" --provider grok=grok-imagine-video-1.5 --mode reference-to-video --reference-image input/jacket.png --reference-image input/glasses.png
```

- Text, image, and reference durations are 1–15 seconds (default 8). Reference generation is capped at 720p.

### LTX

| Option       | Value                                        |
| ------------ | -------------------------------------------- |
| Selector     | `--provider ltx[=<model>]`                   |
| Models       | `ltx-2-5-fast` (bare default), `ltx-2-5-pro` |
| Resolution   | `720p\|1080p\|1440p\|4k`; default `1080p`    |
| Aspect ratio | `--aspect-ratio 16:9\|9:16`                  |

Default duration is `8`s. 2.5 Fast accepts even seconds `6`–`20` at 720p/1080p, and `6`, `8`, or `10` at 1440p/4K. 2.5 Pro accepts `6`, `8`, or `10` at every resolution. Unsupported values are rejected. [LTX 2.5](https://docs.ltx.io/models/ltx-2-5), [pricing](https://docs.ltx.io/pricing)

```bash
bun autoshow video "a lighthouse beam sweeps across calm water" --provider ltx=ltx-2-5-fast --duration 20 --resolution 720p --aspect-ratio 9:16
bun autoshow video "clean product reveal shot" --provider ltx=ltx-2-5-fast --duration 8 --resolution 1080p
bun autoshow video "transition between studio frames" --provider ltx=ltx-2-5-pro --mode interpolate --input-image input/start.png --last-frame input/end.png --resolution 1080p --aspect-ratio 9:16
```

### Replicate

| Option       | Value                                                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Selector     | `--provider replicate[=<model>]`                                                                                                                        |
| Models       | `alibaba/happyhorse-1.1`, `bytedance/seedance-2.5`, `pixverse/pixverse-v6`                                                                              |
| Duration     | Happy Horse `3`–`15`s, PixVerse `5\|8\|10\|15`s, Seedance 2.5 `4`–`30`s or `-1` (default `5`s)                                                          |
| Aspect ratio | Happy Horse `16:9`, `9:16`, `1:1`, `4:3`, `3:4`; PixVerse `16:9`, `9:16`, `1:1`; Seedance 2.5 adds `21:9`, `adaptive` and omits `9:21` (default `16:9`) |

```bash
bun autoshow video "cinematic mountain sunrise" --provider replicate=bytedance/seedance-2.5
bun autoshow video "multi-shot launch" --provider replicate=pixverse/pixverse-v6 --duration 8 --resolution 1080p --generate-audio --replicate-video-multi-clip
bun autoshow video "a lighthouse at dusk" --provider replicate=bytedance/seedance-2.5 --duration 10 --resolution 720p --price
```

- PixVerse V6 supports `--generate-audio`, `--replicate-video-multi-clip`, and `--replicate-video-negative-prompt`.
- `--duration -1` lets Seedance choose duration. `--price` estimates 30 seconds for Seedance 2.5.
- Seedance 2.5 image-to-video and interpolate require `adaptive` aspect ratio (the default when omitted) and cannot be combined with reference media. References: 30 images, 10 videos, and 10 audios, with 30 seconds combined per timed modality. Audio references require an image or video. Native audio is on by default. Rates are $0.1028/$0.2312 per output second at 480p/720p without video references, and $0.4304/$0.9676 with video references. [Seedance 2.5](https://replicate.com/bytedance/seedance-2.5)
- All Replicate models accept `--replicate-video-seed`.

### Luma Labs

| Option       | Value                                                                  |
| ------------ | ---------------------------------------------------------------------- |
| Selector     | `--provider lumalabs[=<model>]`                                        |
| Models       | `ray-3.2`                                                              |
| Duration     | `--duration <seconds>`; rounds to `5s` (under 8) or `10s` (8 and over) |
| Resolution   | `--resolution 540p\|720p\|1080p`; default `720p`                       |
| Aspect ratio | `9:16`, `3:4`, `1:1`, `4:3`, `16:9`, or `21:9`; default `16:9`         |

```bash
bun autoshow video "slow dolly through misty greenhouse" --provider lumalabs=ray-3.2 --duration 5 --resolution 720p
```

### fal.ai

| Option     | Value                                                                         |
| ---------- | ----------------------------------------------------------------------------- |
| Selector   | `--provider fal[=<model>]`                                                    |
| Models     | `minimax/h3`, plus the Seedance 2.5 and H3 Max routes below                   |
| Modes      | H3 supports `text`, `image-to-video`, `reference-to-video`, and `interpolate` |
| Duration   | H3 `5-15`s; default `5`s                                                      |
| Resolution | H3 `768p\|2k`                                                                 |

Seedance 2.5 and H3 Max require the exact route that matches `--mode`:

| Models/routes                                                          | Modes                           | Duration             | Resolution        |
| ---------------------------------------------------------------------- | ------------------------------- | -------------------- | ----------------- |
| `bytedance/seedance-2.5/text-to-video`                                 | `text`                          | 4–30 seconds or `-1` | 480p, 720p, 1080p |
| `bytedance/seedance-2.5/image-to-video`                                | `image-to-video`, `interpolate` | 4–30 seconds or `-1` | 480p, 720p, 1080p |
| `bytedance/seedance-2.5/reference-to-video`                            | `reference-to-video`            | 4–30 seconds or `-1` | 480p, 720p, 1080p |
| `minimax/h3-max/text-to-video`, `minimax/h3-max-turbo/text-to-video`   | `text`                          | 5–15 seconds         | 480p, 768p, 1080p |
| `minimax/h3-max/image-to-video`, `minimax/h3-max-turbo/image-to-video` | `image-to-video`, `interpolate` | 5–15 seconds         | 480p, 768p, 1080p |

```bash
bun autoshow video "rain-soaked detective enters diner" --provider fal=minimax/h3 --duration 5 --resolution 2k
bun autoshow video "a lighthouse at dusk" --provider fal=minimax/h3-max-turbo/text-to-video --duration 5 --resolution 768p --price
```

- MiniMax H3 accepts up to 9 `--reference-image`, 3 `--reference-video`, and 3 `--reference-audio` inputs (12 combined). Native audio is always on.
- fal Seedance accepts 30 images, 10 videos, and 10 audios. Timed references must be 1.8–30.2 seconds each and total at most 30.2 seconds per modality. Image routes keep the input frame's aspect ratio. [fal Seedance](https://fal.ai/models/bytedance/seedance-2.5/reference-to-video)
- H3 Max has native audio and no audio toggle. Rates are $0.05/$0.08/$0.16 per output second at 480p/768p/1080p; Turbo is half. [fal H3 Max](https://fal.ai/minimax-h3-max)

## Output

- Single-provider runs write `generated-video.mp4` and `manifest.json`.
- Multi-provider runs write `generated-video-<provider>-<model>.mp4` per target and `manifest.json`.
- `--output-dir` pins the destination directory.
- `manifest.json` records `video`, `cost`, and `timing`; `video` is an array.

## Notes

- When multiple providers are specified, each generates independently. A failure from one provider does not cancel the others; the run succeeds if at least one provider succeeds.

## Provider Capabilities

All models support text-to-video and image-to-video.

✅ supported, ❌ not supported. Max resolution: ✅ 2K/4K, ⚠️ 1080p, ❌ 720p. Duration: ✅ 15s+, ⚠️ max 10s, ❌ max 8s. Aspect ratio: ✅ any/7+, ⚠️ 5–6, ❌ 3 or fewer. References: ❌ none, ⚠️ up to 3, ✅ 4 or more. Rows are newest first. Released dates are provider announcement or model-origin dates. Recency marks: ✅ 2026-04-01 or later, ⚠️ 2026-01-01 through 2026-03-31, ❌ before 2026-01-01. Pricing is the per-second estimate. Pricing: ✅ cheapest third, ⚠️ middle third, ❌ most expensive third. Cost rank is cheapest first.

| Provider                               | Released      | reference-to-video | interpolate | Duration                                  | Max resolution | Aspect ratio    | Native audio       | References  | Pricing                                                      | Cost rank |
| -------------------------------------- | ------------- | ------------------ | ----------- | ----------------------------------------- | -------------- | --------------- | ------------------ | ----------- | ------------------------------------------------------------ | --------- |
| Gemini `gemini-omni-1.1-flash`         | ✅ 2026-08     | ✅                  | ✅           | ⚠️ 3–10s                                  | ✅ 4K           | ❌ 16:9 or 9:16  | Always on          | ⚠️ Up to 3   | ⚠️ $0.10/s                                                   | 3/9       |
| LTX `ltx-2-5-fast`                     | ✅ 2026-08     | ❌                  | ✅           | ✅ 6–20s at 720p/1080p; 6–10s at 1440p/4K  | ✅ 4K           | ❌ 16:9 or 9:16  | Always on          | ❌ No        | ⚠️ $0.09/$0.13/$0.19/$0.30 per second at 720p/1080p/1440p/4K | 4/9       |
| LTX `ltx-2-5-pro`                      | ✅ 2026-08     | ❌                  | ✅           | ⚠️ 6–10s                                  | ✅ 4K           | ❌ 16:9 or 9:16  | Always on          | ❌ No        | ❌ $0.12/$0.17/$0.25/$0.39 per second at 720p/1080p/1440p/4K  | 7/9       |
| fal.ai `minimax/h3`                    | ✅ 2026-07-31  | ✅                  | ✅           | ✅ 5–15s                                   | ✅ 2K           | ⚠️ 6 ratios     | Always on          | ✅ Up to 9   | ❌ $0.26/s                                                    | 9/9       |
| Replicate `bytedance/seedance-2.5`     | ✅ 2026-07-31  | ✅                  | ✅           | ✅ 4–30s or −1                             | ❌ 720p         | ✅ 7 ratios      | Always on          | ✅ Up to 30  | ❌ $0.1028/$0.2312 per second at 480p/720p                    | 8/9       |
| Replicate `alibaba/happyhorse-1.1`     | ✅ 2026-06-22  | ✅                  | ❌           | ✅ 3–15s                                   | ⚠️ 1080p       | ⚠️ 5 ratios     | No                 | ✅ Up to 9   | ⚠️ $0.14/s at 720p ($0.18 at 1080p)                          | 5/9       |
| Luma Labs `ray-3.2`                    | ✅ 2026-06-09  | ❌                  | ❌           | ⚠️ 5s or 10s                              | ⚠️ 1080p       | ⚠️ 6 ratios     | No                 | ❌ No        | ✅ $0.30 per 5s 720p clip ($0.06–$3.60 by tier)               | 1/9       |
| Grok `grok-imagine-video-1.5`          | ✅ 2026-05-30  | ✅                  | ❌           | ✅ 1–15s                                   | ⚠️ 1080p       | ✅ 7 ratios      | No                 | ✅ Up to 5   | ⚠️ $0.14/s at 720p ($0.08 at 480p, $0.25 at 1080p)           | 5/9       |
| Replicate `pixverse/pixverse-v6`       | ✅ 2026-04-22  | ❌                  | ✅           | ✅ 5–15s                                   | ⚠️ 1080p       | ❌ 3 ratios      | `--generate-audio` | ❌ No        | ✅ $0.09/s at 720p ($0.05–$0.18 by resolution)                | 2/9       |
