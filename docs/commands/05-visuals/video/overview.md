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
| `image-to-video`     | Gemini, Grok, LTX, Replicate, Luma Labs, fal.ai | `--input-image`                                                              |                                            |
| `reference-to-video` | Gemini, Grok, Replicate, fal.ai                 | `--reference-image` and/or `--reference-video`                               |                                            |
| `interpolate`        | Gemini, LTX 2.5, Replicate, fal.ai              | `--input-image`, `--last-frame`                                              | First/last-frame transition                |
| `edit`               | Gemini Omni                                     | `--previous-interaction-id` or `--input-video`                               | Conversational or uploaded-video edit      |
| `extend`             | Gemini Omni                                     | `--previous-interaction-id` or `--input-video`; optional `--reference-image` | Append-only continuation, 3–10s per extend |

`--input-video` is the Gemini Omni source clip for `edit` and `extend`. `reference-to-video` uses `--reference-video`.

```bash
bun autoshow video "animate product on a slow turntable" --provider gemini=gemini-omni-1.1-flash --mode image-to-video --input-image input/product.png --output-dir output/v-base
bun autoshow video "transition between frames" --provider gemini=gemini-omni-1.1-flash --mode interpolate --input-image input/start.png --last-frame input/end.png
```
## Shared Video Options

The `video` and `resume` commands use the same short option names, including `--duration`. Saved configuration uses the matching namespaced key, such as `defaults.video.duration`.

| Flag                                       | Description                                                                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `--provider provider[=model]`              | Hosted video provider/model selector; repeat to run multiple targets                                                      |
| `--all-providers`                          | Run every supported video provider/model                                                                                  |
| `--provider-concurrency <n>`               | Hosted video providers/models to run concurrently; default `7`                                                            |
| `--concurrency-mode <ramp\|immediate>`     | Ramp from one request (`ramp`, default) or start at the configured cap (`immediate`)                                      |
| `--duration <seconds>`                     | Requested video duration                                                                                                  |
| `--aspect-ratio <ratio>`                   | Provider-dependent aspect ratio                                                                                           |
| `--resolution <res>`                       | Provider-dependent resolution control                                                                                     |
| `--mode <mode>`                            | `text`, `image-to-video`, `reference-to-video`, `interpolate`, `edit`, or `extend`; default `text`                        |
| `--input-image <path-or-url>`              | Input image for `image-to-video`; first frame for `interpolate`                                                           |
| `--last-frame <path-or-url>`               | Last-frame image for `interpolate`                                                                                        |
| `--reference-image <path-or-url>`          | Reference image for `reference-to-video` or Gemini Omni `extend`; repeatable                                              |
| `--reference-video <path-or-url>`          | Reference MP4 for Gemini Omni (up to 3, 3s each), Replicate Seedance, and fal.ai MiniMax H3/Seedance 2.5; repeatable      |
| `--reference-audio <path-or-url>`          | Reference audio for Replicate Seedance and fal.ai MiniMax H3/Seedance 2.5; repeatable                                     |
| `--input-video <path-or-url>`              | Gemini Omni `edit`/`extend` source MP4 (uploaded sources ≤10s)                                                            |
| `--previous-interaction-id <id>`           | Gemini Omni prior interaction id from `providerRequestId`; use with `edit` or `extend` instead of re-uploading            |
| `--generate-audio`                         | Native audio where supported (Replicate Seedance/PixVerse, fal.ai Seedance 2.5)                                           |
| `--replicate-video-seed <n>`               | Replicate video seed (`0`–`2147483647`)                                                                                   |
| `--replicate-video-negative-prompt <text>` | Replicate PixVerse V6 and Wan 3.0 negative prompt                                                                         |
| `--replicate-video-multi-clip`             | Replicate PixVerse V6 multi-shot generation toggle                                                                        |
| `--price`                                  | Show the estimate and exit                                                                                                |
| `--max-model-cents <n>`                    | Exclude each provider/model whose estimated total exceeds the per-model ceiling in cents; works with or without `--price` |
| `--output-dir <dir>`                       | Global flag: pin an exact run directory instead of `output/<timestamp>_video-gen/`                                        |

See [Provider Capabilities](#provider-capabilities) for the per-model matrix.

```bash
bun autoshow video "a rainy neon city street, slow camera pan" --provider gemini=gemini-omni-1.1-flash --provider grok=grok-imagine-video-1.5 --provider ltx=ltx-2-5-fast
bun autoshow video "a rainy neon city street, slow camera pan" --all-providers --price
bun autoshow video "a rainy neon city street, slow camera pan" --all-providers --max-model-cents 100 --price
```
## Video Services

### Gemini Omni

| Option       | Value                                                    |
| ------------ | -------------------------------------------------------- |
| Selector     | `--provider gemini[=<model>]`                            |
| Models       | `gemini-omni-1.1-flash` (bare default)                   |
| Duration     | `--duration <seconds>`; accepted values `3` through `10` |
| Resolution   | `--resolution 360p\|720p\|1080p\|4k`; default `720p`     |
| Aspect ratio | `--aspect-ratio 16:9\|9:16`; default `16:9`              |

```bash
bun autoshow video "a sweeping Grand Canyon drone shot" --provider gemini=gemini-omni-1.1-flash --duration 8 --aspect-ratio 16:9 --resolution 1080p
bun autoshow video "make the violin invisible" --provider gemini=gemini-omni-1.1-flash --mode edit --previous-interaction-id v1_abc
bun autoshow video "continue the scene" --provider gemini=gemini-omni-1.1-flash --mode extend --input-video input/examples/video/2-video.mp4
```
- Native audio is always on. 1080p and 4K are upscaled. Unspecified duration is estimated at 10 seconds.
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
bun autoshow video "transition between studio frames" --provider ltx=ltx-2-5-pro --mode interpolate --input-image input/start.png --last-frame input/end.png --resolution 1080p --aspect-ratio 9:16
```
### Replicate

| Option       | Value                                                                                                                                                                            |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Selector     | `--provider replicate[=<model>]`                                                                                                                                                 |
| Models       | `alibaba/happyhorse-1.1`, `alibaba/wan-3`, `bytedance/seedance-2.5`, `pixverse/pixverse-v6` (bare default)                                                                       |
| Duration     | Happy Horse `3`–`15`s, PixVerse `5\|8\|10\|15`s, Seedance 2.5 `4`–`30`s or `-1` (default `5`s), Wan 3.0 `2`–`30`s                                                                |
| Aspect ratio | Happy Horse `16:9`, `9:16`, `1:1`, `4:3`, `3:4`; PixVerse `16:9`, `9:16`, `1:1`; Seedance 2.5 adds `21:9`, `adaptive` and omits `9:21` (default `16:9`); Wan 3.0 adds `adaptive` |

```bash
bun autoshow video "cinematic mountain sunrise" --provider replicate=bytedance/seedance-2.5
bun autoshow video "multi-shot launch" --provider replicate=pixverse/pixverse-v6 --duration 8 --resolution 1080p --generate-audio --replicate-video-multi-clip
```
- Wan 3.0 (`alibaba/wan-3`) supports text-to-video and image-to-video at 480p, 720p, and 1080p. Audio generation, interpolate, reference media, and multi-clip are not supported. [Wan 3.0](https://replicate.com/alibaba/wan-3)
- `--duration -1` lets Seedance choose duration. `--price` estimates 30 seconds for Seedance 2.5.
- Seedance 2.5 image-to-video and interpolate require `adaptive` aspect ratio (the default when omitted) and cannot be combined with reference media. References: 30 images, 10 videos, and 10 audios, with 30 seconds combined per timed modality. Audio references require an image or video. Native audio is on by default. [Seedance 2.5](https://replicate.com/bytedance/seedance-2.5)

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
- H3 Max and Turbo have native audio and no `--generate-audio` toggle. [fal H3 Max](https://fal.ai/minimax-h3-max)

## Output

- Single-provider runs write `generated-video.mp4` and `manifest.json`.
- Multi-provider runs write `generated-video-<provider>-<model>.mp4` per target and `manifest.json`.
- `manifest.json` records `video`, `cost`, and `timing`; `video` is an array.

## Notes

- When multiple providers are specified, each generates independently. A failure from one provider does not cancel the others; the run succeeds if at least one provider succeeds.

## Provider Capabilities

Text-to-video and image-to-video are available on every provider. fal Seedance and H3 Max use a separate model id for text, image, and reference modes.

✅ supported, ❌ not supported. Max resolution: ✅ 2K/4K, ⚠️ 1080p, ❌ 720p. Duration: ✅ 15s+, ⚠️ max 10s, ❌ max 8s. Aspect ratio: ✅ any/7+, ⚠️ 5–6, ❌ 3 or fewer / input frame. References: ❌ none, ⚠️ up to 3, ✅ 4 or more. Rows are newest first. Recency marks: ✅ 2026-04-01 or later, ⚠️ 2026-01-01 through 2026-03-31, ❌ before 2026-01-01. Outputs are the default per-second (or per-clip) estimate. Inputs are extra billed reference or token cost when published separately; `Included` means the published rate is per output second. Output pricing: ✅ cheapest third, ⚠️ middle third, ❌ most expensive third. Cost rank is cheapest first on the default billed rate (1 = cheapest); ties share a rank.

| Provider                                           | Released     | reference-to-video | interpolate | edit | extend | Duration                                 | Max resolution | Aspect ratio   | Native audio          | References | Inputs                                                  | Outputs                                                      | Cost rank |
| -------------------------------------------------- | ------------ | ------------------ | ----------- | ---- | ------ | ---------------------------------------- | -------------- | -------------- | --------------------- | ---------- | ------------------------------------------------------- | ------------------------------------------------------------ | --------- |
| fal.ai `minimax/h3-max-turbo/text-to-video`        | ✅ 2026-09    | ❌                  | ❌           | ❌    | ❌      | ✅ 5–15s                                  | ⚠️ 1080p       | ⚠️ 6 ratios    | ✅ Always on           | ❌ No       | Included                                                | ✅ $0.025/$0.04/$0.08 per second at 480p/768p/1080p           | 1/17      |
| fal.ai `minimax/h3-max-turbo/image-to-video`       | ✅ 2026-09    | ❌                  | ✅           | ❌    | ❌      | ✅ 5–15s                                  | ⚠️ 1080p       | ❌ Input frame  | ✅ Always on           | ❌ No       | Included                                                | ✅ $0.025/$0.04/$0.08 per second at 480p/768p/1080p           | 1/17      |
| fal.ai `minimax/h3-max/text-to-video`              | ✅ 2026-09    | ❌                  | ❌           | ❌    | ❌      | ✅ 5–15s                                  | ⚠️ 1080p       | ⚠️ 6 ratios    | ✅ Always on           | ❌ No       | Included                                                | ✅ $0.05/$0.08/$0.16 per second at 480p/768p/1080p            | 4/17      |
| fal.ai `minimax/h3-max/image-to-video`             | ✅ 2026-09    | ❌                  | ✅           | ❌    | ❌      | ✅ 5–15s                                  | ⚠️ 1080p       | ❌ Input frame  | ✅ Always on           | ❌ No       | Included                                                | ✅ $0.05/$0.08/$0.16 per second at 480p/768p/1080p            | 4/17      |
| Gemini `gemini-omni-1.1-flash`                     | ✅ 2026-08    | ✅                  | ✅           | ✅    | ✅      | ⚠️ 3–10s                                 | ✅ 4K           | ❌ 16:9 or 9:16 | ✅ Always on           | ⚠️ Up to 3 | Not estimated                                           | ⚠️ $0.10/s                                                   | 8/17      |
| Replicate `alibaba/wan-3`                          | ✅ 2026-08-24 | ❌                  | ❌           | ❌    | ❌      | ✅ 2–30s                                  | ⚠️ 1080p       | ⚠️ 6 ratios    | ❌ No                  | ❌ No       | Included                                                | ⚠️ $0.05/$0.10/$0.20 per second at 480p/720p/1080p           | 8/17      |
| LTX `ltx-2-5-fast`                                 | ✅ 2026-08    | ❌                  | ✅           | ❌    | ❌      | ✅ 6–20s at 720p/1080p; 6–10s at 1440p/4K | ✅ 4K           | ❌ 16:9 or 9:16 | ✅ Always on           | ❌ No       | Included                                                | ⚠️ $0.09/$0.13/$0.19/$0.30 per second at 720p/1080p/1440p/4K | 10/17     |
| LTX `ltx-2-5-pro`                                  | ✅ 2026-08    | ❌                  | ✅           | ❌    | ❌      | ⚠️ 6–10s                                 | ✅ 4K           | ❌ 16:9 or 9:16 | ✅ Always on           | ❌ No       | Included                                                | ⚠️ $0.12/$0.17/$0.25/$0.39 per second at 720p/1080p/1440p/4K | 12/17     |
| fal.ai `minimax/h3`                                | ✅ 2026-07-31 | ✅                  | ✅           | ❌    | ❌      | ✅ 5–15s                                  | ✅ 2K           | ⚠️ 6 ratios    | ✅ Always on           | ✅ Up to 9  | Included                                                | ❌ $0.26/s                                                    | 14/17     |
| fal.ai `bytedance/seedance-2.5/text-to-video`      | ✅ 2026-07-31 | ❌                  | ❌           | ❌    | ❌      | ✅ 4–30s or −1                            | ⚠️ 1080p       | ✅ 7 ratios     | ⚠️ `--generate-audio` | ❌ No       | Included                                                | ❌ $0.2205/$0.473/$1.164 per second at 480p/720p/1080p        | 15/17     |
| fal.ai `bytedance/seedance-2.5/image-to-video`     | ✅ 2026-07-31 | ❌                  | ✅           | ❌    | ❌      | ✅ 4–30s or −1                            | ⚠️ 1080p       | ❌ Input frame  | ⚠️ `--generate-audio` | ❌ No       | Included                                                | ❌ $0.2205/$0.473/$1.164 per second at 480p/720p/1080p        | 15/17     |
| fal.ai `bytedance/seedance-2.5/reference-to-video` | ✅ 2026-07-31 | ✅                  | ❌           | ❌    | ❌      | ✅ 4–30s or −1                            | ⚠️ 1080p       | ✅ 7 ratios     | ⚠️ `--generate-audio` | ✅ Up to 30 | Video refs at 0.6× rate, input+output seconds           | ❌ $0.2205/$0.473/$1.164 per second at 480p/720p/1080p        | 15/17     |
| Replicate `bytedance/seedance-2.5`                 | ✅ 2026-07-31 | ✅                  | ✅           | ❌    | ❌      | ✅ 4–30s or −1                            | ❌ 720p         | ✅ 7 ratios     | ⚠️ `--generate-audio` | ✅ Up to 30 | $0.4304/$0.9676 per second at 480p/720p with video refs | ❌ $0.1028/$0.2312 per second at 480p/720p                    | 13/17     |
| Replicate `alibaba/happyhorse-1.1`                 | ✅ 2026-06-22 | ✅                  | ❌           | ❌    | ❌      | ✅ 3–15s                                  | ⚠️ 1080p       | ⚠️ 5 ratios    | ❌ No                  | ✅ Up to 9  | Included                                                | ⚠️ $0.14/s at 720p ($0.18 at 1080p)                          | 11/17     |
| Luma Labs `ray-3.2`                                | ✅ 2026-06-09 | ❌                  | ❌           | ❌    | ❌      | ⚠️ 5s or 10s                             | ⚠️ 1080p       | ⚠️ 6 ratios    | ❌ No                  | ❌ No       | Included                                                | ✅ $0.30 per 5s 720p clip ($0.06–$3.60 by tier)               | 3/17      |
| Grok `grok-imagine-video-1.5`                      | ✅ 2026-05-30 | ✅                  | ❌           | ❌    | ❌      | ✅ 1–15s                                  | ⚠️ 1080p       | ✅ 7 ratios     | ❌ No                  | ✅ Up to 5  | $0.01/image                                             | ✅ $0.08/s at 480p ($0.14 at 720p, $0.25 at 1080p)            | 4/17      |
| Replicate `pixverse/pixverse-v6`                   | ✅ 2026-04-22 | ❌                  | ✅           | ❌    | ❌      | ✅ 5–15s                                  | ⚠️ 1080p       | ❌ 3 ratios     | ⚠️ `--generate-audio` | ❌ No       | Included                                                | ⚠️ $0.09/s at 720p ($0.05–$0.18 by resolution)               | 7/17      |
