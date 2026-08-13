# video

Generate a video from a text prompt or input image with one or more hosted video providers and models.

## Outline

- [Usage](#usage)
- [Environment](#environment)
- [Shared Video Options](#shared-video-options)
- [Video Services](#video-services)
  - [Gemini Veo](#gemini-veo)
  - [MiniMax](#minimax)
  - [Z.AI GLM](#zai-glm)
  - [Grok](#grok)
  - [Runway](#runway)
  - [LTX](#ltx)
  - [Replicate](#replicate)
  - [Luma Labs](#luma-labs)
  - [fal.ai](#falai)
- [Output](#output)
- [Notes](#notes)

## Usage

```bash
bun autoshow video <input> [flags]
```

The positional input is a text prompt or an image path, URL, or data URL. A positional image input infers `--mode image-to-video` and cannot be combined with the media-input flags. One or more provider flags can be specified. Repeating the same provider flag runs each selected model independently and produces its own output file. When no provider is specified, a text prompt runs the cheapest default text-to-video target and a positional image input runs every supported provider.

## Environment

There are no local video-generation models in this project.

```bash
GEMINI_API_KEY=...
MINIMAX_API_KEY=...
GLM_API_KEY=...
XAI_API_KEY=...
RUNWAYML_API_SECRET=...
LTXV_API_KEY=...
REPLICATE_API_TOKEN=...
LUMA_AGENTS_API_KEY=...
FAL_API_KEY=...
```

## Shared Video Options

The standalone `video` command drops the `video-` prefix these options carry everywhere else: `--size` here is `--video-size` on `write`, `config`, and `resume`. One resume flag set serves image, video, music, and OCR, where the short names would collide, so [ADR-002](../../../adr/ADR-002-pipeline-state-resume-and-dry-run-planning.md) keeps the prefixes on those surfaces.

| Flag | Description |
|------|-------------|
| `--all-providers` | Run every supported video provider/model |
| `--provider-concurrency <n>` | Hosted video providers/models to run concurrently per item; default `10` |
| `--duration <seconds>` | Requested video duration |
| `--size <size>` | Provider-dependent size control |
| `--aspect-ratio <ratio>` | Provider-dependent aspect ratio |
| `--resolution <res>` | Provider-dependent resolution control |
| `--mode <mode>` | `text`, `image-to-video`, `reference-to-video`, `interpolate`, `extend`, or `edit`; default `text` |
| `--input-image <path-or-url>` | Input image for `image-to-video`; first frame for `interpolate` |
| `--last-frame <path-or-url>` | Last-frame image for `interpolate` |
| `--reference-image <path-or-url>` | Reference image for `reference-to-video`; repeat up to 3 times (Replicate Seedance/Happy Horse accepts up to 9; fal.ai MiniMax H3 accepts up to 9; fal.ai PixVerse C1 accepts up to 7) |
| `--input-video <path-or-url>` | Input MP4 for `extend` or `edit` |
| `--grok-video-storage-filename <name>` | xAI/Grok storage filename |
| `--grok-video-storage-expires-after <seconds>` | xAI/Grok storage expiration, max 30 days |
| `--price` | Show the estimate and exit |
| `--output-dir <dir>` | Global flag: pin an exact run directory instead of `output/<timestamp>_video-gen/` |

```bash
bun autoshow video "a rainy neon city street, slow camera pan" --provider gemini=veo-3.1-fast-generate-preview --provider minimax=MiniMax-Hailuo-2.3 --provider runway=gen4.5 --provider ltx=ltx-2-3-fast
bun autoshow video "a rainy neon city street, slow camera pan" --all-providers --price
```

Media-input modes are explicit. Passing media flags without `--mode` is rejected because the default mode is text-to-video; the one exception is a positional image input, which infers `--mode image-to-video`. Run workflow blocks from top to bottom: commands with `--output-dir` write deterministic paths that later commands read.

| Mode | Providers | Required inputs | Notes |
|------|-----------|-----------------|-------|
| `text` | All video providers | none | Default mode |
| `image-to-video` | Gemini, GLM, MiniMax, Grok, LTX, Replicate Happy Horse/Seedance/Kling/PixVerse, Luma Labs, fal.ai | `--input-image` | Animates the input image |
| `reference-to-video` | Gemini standard/Fast, GLM Vidu 2 reference, MiniMax S2V, Grok, Replicate Happy Horse/Seedance/Kling Omni, fal.ai | `--reference-image` | Up to 3 references; MiniMax S2V accepts one; Replicate Seedance/Happy Horse accepts up to 9; fal.ai H3 accepts up to 12 combined references |
| `interpolate` | Gemini, GLM, LTX 2.3, Replicate Seedance/Kling/PixVerse, fal.ai | `--input-image`, `--last-frame` | First/last-frame transition |
| `extend` | Gemini standard/Fast, Grok, LTX Pro, Replicate Seedance | `--input-video` | Gemini extension requests force `720p`; LTX uses end extension |
| `edit` | Grok, Replicate Seedance/Kling Omni/Aleph 2 | `--input-video` | Grok rejects duration, aspect, and resolution overrides |

Create reusable image inputs:

```bash
bun autoshow image "a clean studio product photo of a red enamel camping mug on white seamless" --provider gemini=gemini-3.1-flash-lite-image --output-dir output/video-demo-product
bun autoshow image "the same red enamel camping mug on a moonlit blue studio background" --provider gemini=gemini-3.1-flash-lite-image --output-dir output/video-demo-product-night
bun autoshow image "a high-fashion crimson jacket on a mannequin, plain white background" --provider gemini=gemini-3.1-flash-lite-image --output-dir output/video-demo-jacket
bun autoshow image "pink heart-shaped sunglasses on a plain white background" --provider gemini=gemini-3.1-flash-lite-image --output-dir output/video-demo-sunglasses
```

Animate an image, then reuse that generated video for extension and editing:

```bash
bun autoshow video "animate this product on a slow turntable, glossy highlights, camera locked off" --provider gemini=veo-3.1-fast-generate-preview --mode image-to-video --input-image output/video-demo-product/generated-image.png --output-dir output/video-demo-image-to-video
bun autoshow video "continue the turntable move as the mug rotates toward a warm kitchen window" --provider gemini=veo-3.1-fast-generate-preview --mode extend --input-video output/video-demo-image-to-video/generated-video.mp4 --output-dir output/video-demo-extend
bun autoshow video "make the lighting moonlit blue while keeping the mug motion intact" --provider grok=grok-imagine-video --mode edit --input-video output/video-demo-image-to-video/generated-video.mp4 --output-dir output/video-demo-edit
```

Use multiple generated images as video constraints:

```bash
bun autoshow video "transition from the white studio product shot into the moonlit blue studio shot" --provider gemini=veo-3.1-generate-preview --mode interpolate --input-image output/video-demo-product/generated-image.png --last-frame output/video-demo-product-night/generated-image.png --output-dir output/video-demo-interpolate
bun autoshow video "a model walks through a shallow turquoise lagoon wearing the jacket and sunglasses" --provider grok=grok-imagine-video --mode reference-to-video --reference-image output/video-demo-jacket/generated-image.png --reference-image output/video-demo-sunglasses/generated-image.png --output-dir output/video-demo-reference-video
bun autoshow video "animate the jacket with a slow showroom camera push" --provider minimax=I2V-01 --mode image-to-video --input-image output/video-demo-jacket/generated-image.png --output-dir output/video-demo-minimax-i2v
bun autoshow video "keep this character consistent while walking into a studio set" --provider glm=vidu2-reference --mode reference-to-video --reference-image output/video-demo-jacket/generated-image.png --output-dir output/video-demo-glm-reference
```

## Video Services

### Gemini Veo

| Option | Value |
|--------|-------|
| Selector | `--provider gemini[=<model>]` |
| Models | `veo-3.1-generate-preview`, `veo-3.1-fast-generate-preview`, `veo-3.1-lite-generate-preview` |
| Duration | `--duration <seconds>`, normalized to `4`, `6`, or `8` |
| Resolution | `--resolution 720p\|1080p\|4k`; `4k` is standard/Fast only |
| Aspect ratio | `--aspect-ratio <ratio>`; forwarded to the Veo API without local validation |

```bash
bun autoshow video "a rainy neon city street, slow camera pan" --provider gemini=veo-3.1-fast-generate-preview
bun autoshow video "a rainy neon city street, slow camera pan" --provider gemini=veo-3.1-generate-preview --duration 8 --aspect-ratio 16:9 --resolution 1080p
bun autoshow video "a sweeping Grand Canyon drone shot at sunset" --provider gemini=veo-3.1-generate-preview --resolution 4k
bun autoshow video "a rainy neon city street, slow camera pan" --provider gemini=veo-3.1-lite-generate-preview --duration 4 --resolution 720p
bun autoshow video "a sunset timelapse" --provider gemini=veo-3.1-fast-generate-preview --duration 8 --price
```

Gemini Veo price estimates use normalized billed duration and current per-second Gemini API pricing:

| Model | 720p | 1080p | 4k estimate | CLI timing estimate |
|-------|------|-------|-------------|---------------------|
| `veo-3.1-generate-preview` | 40.0000¢/s | 40.0000¢/s | 60.0000¢/s fallback | 10543 ms/s |
| `veo-3.1-fast-generate-preview` | 10.0000¢/s | 12.0000¢/s | 30.0000¢/s fallback | 10000 ms/s |
| `veo-3.1-lite-generate-preview` | 5.0000¢/s | 8.0000¢/s | not supported | 8000 ms/s |

The timing values are CLI planning heuristics, not provider SLAs. Google documents Veo request latency as roughly 11 seconds to 6 minutes, with higher resolutions generally taking longer. Gemini `1080p`, `4k`, reference-image, and extension requests are normalized to `8` seconds before price estimates and API requests. `4k` is accepted for `veo-3.1-generate-preview` and `veo-3.1-fast-generate-preview`; 4K price estimates use approximate fallback per-second rates. Veo 3.1 Lite does not support `4k`, reference-image generation, or video extension.

### MiniMax

| Option | Value |
|--------|-------|
| Selector | `--provider minimax[=<model>]` |
| Models | `MiniMax-Hailuo-2.3`, `MiniMax-Hailuo-2.3-Fast`, `T2V-01-Director`, `T2V-01`, `I2V-01-Director`, `I2V-01-live`, `I2V-01`, `S2V-01` |
| Duration/resolution | `--duration 6\|10`, `--resolution 720p\|1080p` on Hailuo models; other models are fixed at `6` seconds and `720p` |
| Aspect ratio | Not supported; MiniMax has no aspect-ratio control |

```bash
bun autoshow video "a rainy neon city street, slow camera pan" --provider minimax=MiniMax-Hailuo-2.3 --duration 10 --resolution 720p
bun autoshow video "a rainy neon city street, slow camera pan" --provider minimax=T2V-01
bun autoshow video "animate the product photo with a slow dolly move" --provider minimax=I2V-01 --mode image-to-video --input-image output/video-demo-product/generated-image.png
bun autoshow video "a person in this reference walks through a softly lit studio" --provider minimax=S2V-01 --mode reference-to-video --reference-image output/video-demo-jacket/generated-image.png
bun autoshow video "a sunset timelapse" --provider minimax=MiniMax-Hailuo-2.3 --duration 10 --price
```

MiniMax text models use the existing text-to-video request body. Image-to-video models send `first_frame_image`, and `S2V-01` maps one reference image to `subject_reference` with `type: "character"`. MiniMax durations are normalized to the provider-supported values for the selected model and resolution.

### Z.AI GLM

| Option | Value |
|--------|-------|
| Selector | `--provider glm[=<model>]` |
| Models | `cogvideox-3`, `viduq1-text`, `vidu2-image`, `vidu2-start-end`, `vidu2-reference` |
| Duration | `--duration 5\|10` on CogVideoX; Vidu Q1 is fixed at `5` and Vidu 2 at `4` |
| Size/aspect ratio | `--size` accepts CogVideoX sizes (`1280x720`, `720x1280`, `1024x1024`, `1920x1080`, `1080x1920`, `2048x1080`, `3840x2160`) or Vidu 2 sizes (`720x480`, `1280x720`); `--aspect-ratio 16:9\|9:16\|1:1\|4:3\|3:4` |

```bash
bun autoshow video "a cat playing with yarn" --provider glm=cogvideox-3 --duration 10 --size 1920x1080
bun autoshow video "an anime character dancing" --provider glm=viduq1-text --aspect-ratio 16:9
bun autoshow video "animate the product photo with a subtle tabletop slide" --provider glm=vidu2-image --mode image-to-video --input-image output/video-demo-product/generated-image.png
bun autoshow video "transition between the two studio frames" --provider glm=vidu2-start-end --mode interpolate --input-image output/video-demo-product/generated-image.png --last-frame output/video-demo-product-night/generated-image.png
bun autoshow video "keep these references consistent in the generated shot" --provider glm=vidu2-reference --mode reference-to-video --reference-image output/video-demo-jacket/generated-image.png --reference-image output/video-demo-sunglasses/generated-image.png
bun autoshow video "a sunset timelapse" --provider glm=cogvideox-3 --price
```

GLM `cogvideox-3` supports text, image-to-video, and interpolation with `image_url`. Vidu Q1 text requests are fixed at `5` seconds. Vidu 2 media models default to 4-second 720p requests. GLM prompts are capped at 512 characters.

### Grok

| Option | Value |
|--------|-------|
| Selector | `--provider grok[=<model>]` |
| Models | `grok-imagine-video`, `grok-imagine-video-1.5` |
| Duration/resolution | `--duration <seconds>`, `--resolution 480p\|720p`; Video 1.5 also supports `1080p` for text and image generation |
| Storage | `--grok-video-storage-filename`, `--grok-video-storage-expires-after` |

```bash
bun autoshow video "a cat playing piano" --provider grok=grok-imagine-video --duration 8 --resolution 720p
bun autoshow video "a cinematic moonlit coastline" --provider grok=grok-imagine-video-1.5 --duration 8 --resolution 1080p
bun autoshow video "a sunset timelapse" --provider grok=grok-imagine-video --price
bun autoshow image "a close product photo of a red enamel camping mug on white seamless" --provider gemini=gemini-3.1-flash-lite-image --output-dir output/grok-video-input-image
bun autoshow video "animate the mug with a slow tabletop camera slide" --provider grok=grok-imagine-video --mode image-to-video --input-image output/grok-video-input-image/generated-image.png --output-dir output/grok-video-base
bun autoshow video "extend with a wider camera reveal of the tabletop set" --provider grok=grok-imagine-video --mode extend --input-video output/grok-video-base/generated-video.mp4 --duration 6 --output-dir output/grok-video-extended
```

Grok text, image-to-video, and reference-to-video durations are clamped to `1` through `15` seconds and default to `8`. `grok-imagine-video-1.5` supports text, image, and reference generation; reference generation is capped at 720p. The retained `grok-imagine-video` selector also supports editing and extension, whose durations clamp to `1` through `10` seconds and default to `6`. Grok estimates include the published input image/reference-image fee when image inputs are selected, and include input-video seconds when local input duration can be probed. When xAI returns `usage.cost_in_usd_ticks`, the run metadata uses that provider cost for actual-cost reporting.

### Runway

| Option | Value |
|--------|-------|
| Selector | `--provider runway[=<model>]` |
| Models | `gen4.5` |
| Duration | `--duration <seconds>` |
| Aspect ratio | `--aspect-ratio 16:9\|9:16`; mapped to `1280:720` or `720:1280` |

```bash
bun autoshow video "a cinematic mountain sunrise" --provider runway=gen4.5 --duration 5 --aspect-ratio 16:9
bun autoshow video "a sunset timelapse" --provider runway=gen4.5 --duration 5 --price
```

Runway `gen4.5` durations are clamped to `2` through `10` seconds and default to `5`; prompts are capped at 1000 UTF-16 code units.

### LTX

| Option | Value |
|--------|-------|
| Selector | `--provider ltx[=<model>]` |
| Models | `ltx-2-3-fast`, `ltx-2-3-pro` |
| Duration | Default `8`; Fast `1920x1080` generations use even seconds from `6` through `20`; Pro and other Fast sizes use `6`, `8`, or `10`; extension clamps to `2` through `20` |
| Size/resolution | `--size` accepts `1920x1080`, `1080x1920`, `2560x1440`, `1440x2560`, `3840x2160`, or `2160x3840`; otherwise `--resolution 1080p\|4k` derives size from aspect ratio |
| Aspect ratio | `16:9` or `9:16` |

```bash
bun autoshow video "a clean product reveal shot on a white sweep" --provider ltx=ltx-2-3-fast --duration 8 --resolution 1080p
bun autoshow video "animate the product photo with a slow tabletop camera slide" --provider ltx=ltx-2-3-fast --mode image-to-video --input-image output/video-demo-product/generated-image.png --aspect-ratio 9:16 --resolution 4k
bun autoshow video "transition between the two studio frames" --provider ltx=ltx-2-3-pro --mode interpolate --input-image output/video-demo-product/generated-image.png --last-frame output/video-demo-product-night/generated-image.png --size 1440x2560
bun autoshow video "continue the move from the end of this clip" --provider ltx=ltx-2-3-pro --mode extend --input-video output/video-demo-image-to-video/generated-video.mp4 --duration 6
bun autoshow video "a sunset timelapse" --provider ltx=ltx-2-3-fast --duration 8 --price
```

LTX text and image generation estimates use per-second 1080p pricing, with 1440p at 2x and 4K at 4x. Extension is estimated at 10.0000 cents per second for Pro models; LTX may also bill context frames from the input video.

### Replicate

| Option | Value |
|--------|-------|
| Selector | `--provider replicate[=<model>]` |
| Models | `alibaba/happyhorse-1.1`, `bytedance/seedance-2.0`, `bytedance/seedance-2.0-fast`, `kwaivgi/kling-v3-video`, `kwaivgi/kling-v3-omni-video`, `pixverse/pixverse-v6`, `runwayml/aleph-2`, `wan-video/wan-2.7-t2v` |
| Duration | `--duration <seconds>`; Happy Horse and Kling `3` through `15`, PixVerse `5\|8\|10\|15`, Seedance `-1` through `15`, Wan `2` through `15`; default `5`. Aleph uses the input clip duration. |
| Resolution | `--resolution`; Kling `720p\|1080p\|4k`, PixVerse `360p\|540p\|720p\|1080p`, Happy Horse and Wan `720p\|1080p`, Seedance `480p\|720p\|1080p`, Seedance Fast `480p\|720p`; default `720p` |
| Aspect ratio | Happy Horse `16:9`, `9:16`, `1:1`, `4:3`, `3:4`; Kling and PixVerse `16:9`, `9:16`, `1:1`; Seedance additionally supports `21:9`, `9:21`, and `adaptive`; default `16:9` |

```bash
bun autoshow video "a cinematic mountain sunrise" --provider replicate=wan-video/wan-2.7-t2v
bun autoshow video "animate the product photo with a slow dolly move" --provider replicate=bytedance/seedance-2.0 --mode image-to-video --input-image output/video-demo-product/generated-image.png
bun autoshow video "keep these references consistent in the generated shot" --provider replicate=bytedance/seedance-2.0 --mode reference-to-video --reference-image output/video-demo-jacket/generated-image.png --reference-image output/video-demo-sunglasses/generated-image.png
bun autoshow video "a sunset timelapse" --provider replicate=bytedance/seedance-2.0-fast --price
bun autoshow video "a three-shot product launch" --provider replicate=kwaivgi/kling-v3-video --duration 8 --resolution 1080p --replicate-video-generate-audio --replicate-video-multi-prompt '[{"prompt":"macro product detail","duration":3},{"prompt":"wide studio reveal","duration":5}]'
bun autoshow video "add moonlit lighting while preserving the action" --provider replicate=runwayml/aleph-2 --mode edit --input-video output/source/generated-video.mp4
```

Happy Horse 1.1 supports text, image, and up to nine reference images. Kling Video 3.0 supports text, image, first/last-frame interpolation, optional native audio, negative prompts, and up to six JSON-defined shots through `--replicate-video-multi-prompt`. Kling Video 3.0 Omni adds reference images, reference video, and prompt-driven video editing. PixVerse V6 supports text, image, first/last-frame transitions, native audio, negative prompts, and `--replicate-video-multi-clip`. Aleph 2.0 is edit-only and requires `--input-video`; input clips must be 2–30 seconds and under 16MB. Seedance models support text, image-to-video, interpolation, reference-to-video, extension, and editing. Wan remains text-only. All Replicate models accept `--replicate-video-seed`. Estimates use the published model-, resolution-, audio-, and video-input-aware rates.

### Luma Labs

| Option | Value |
|--------|-------|
| Selector | `--provider lumalabs[=<model>]` |
| Models | `ray-3.2` |
| Duration | `--duration <seconds>`; normalized to `5s` (`<8`) or `10s` (`>=8`) |
| Resolution | `--resolution 540p\|720p\|1080p`; default `720p` |
| Aspect ratio | `9:16`, `3:4`, `1:1`, `4:3`, `16:9`, or `21:9`; default `16:9` |

```bash
bun autoshow video "a slow dolly through a misty greenhouse at sunrise" --provider lumalabs=ray-3.2 --duration 5 --resolution 720p
bun autoshow video "gentle camera push-in" --provider lumalabs=ray-3.2 --mode image-to-video --input-image output/video-demo-product/generated-image.png
bun autoshow video "a sunset timelapse" --provider lumalabs=ray-3.2 --duration 5 --price
```

Luma Labs `ray-3.2` runs against the Luma Agents API (`POST /v1/generations`, polled until `completed`). It supports `text` and `image-to-video` (via `video.start_frame`). Standard dynamic range generation is priced per clip by resolution and duration: 720p is $0.30 for 5s and $0.90 for 10s.

### fal.ai

| Option | Value |
|--------|-------|
| Selector | `--provider fal[=<model>]` |
| Models | `minimax/h3`, `fal-ai/pixverse/c1` |
| Modes | Both support `text`, `image-to-video`, `reference-to-video`, and `interpolate` |
| Duration | H3 `5-15`; PixVerse C1 `1-15`; default `5` |
| Resolution | H3 `768p\|2k`; PixVerse C1 `360p\|540p\|720p\|1080p` |

```bash
bun autoshow video "a rain-soaked detective enters a neon diner" --provider fal=minimax/h3 --duration 5 --resolution 2k
bun autoshow video "a controlled product turntable shot" --provider fal=fal-ai/pixverse/c1 --mode image-to-video --input-image output/mug-base/generated-image.png --fal-video-generate-audio
bun autoshow video "preserve the subject and camera language" --provider fal=minimax/h3 --mode reference-to-video --reference-image output/mug-base/generated-image.png --fal-video-reference-video input/reference.mp4
```

fal.ai uses `FAL_API_KEY` and mode-specific queued endpoints. MiniMax H3 accepts up to nine image, three video, and three audio references, with at most twelve combined references; audio references require an image or video reference. PixVerse C1 accepts up to seven image references and supports `--fal-video-generate-audio`; its interpolation mode routes the first and last frames through the transition endpoint. Local estimates use fal.ai's published per-second rates.

```bash
# Same provider, multiple models
bun autoshow video "a rainy neon city street, slow camera pan" --provider gemini=veo-3.1-fast-generate-preview --provider gemini=veo-3.1-generate-preview --provider gemini=veo-3.1-lite-generate-preview

# Write pipeline
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --llm gemini=gemini-3.5-flash-lite --video gemini=veo-3.1-fast-generate-preview
bun autoshow write https://ajc.pics/autoshow/examples/1-audio.mp3 --video gemini=veo-3.1-fast-generate-preview --video minimax=MiniMax-Hailuo-2.3 --video glm=cogvideox-3 --video ltx=ltx-2-3-fast --price
```

## Output

Single-provider runs write:

```text
output/YYYY-MM-DD_HH-mm-ss_video-gen/
  generated-video.mp4
  manifest.json
```

Multi-provider runs write one file per provider:

```text
output/YYYY-MM-DD_HH-mm-ss_video-gen/
  generated-video-gemini-veo-3.1-fast-generate-preview.mp4
  generated-video-minimax-MiniMax-Hailuo-2.3.mp4
  generated-video-glm-cogvideox-3.mp4
  generated-video-grok-grok-imagine-video.mp4
  generated-video-runway-gen4.5.mp4
  generated-video-ltx-ltx-2-3-fast.mp4
  manifest.json
```

`manifest.json` uses the canonical single-run shape. Its sole item's metadata includes `video`, `cost`, and `timing`; `video` is always an array, even when only one provider succeeds.

`--output-dir` controls the run directory; generated file names remain provider-dependent and deterministic inside that directory.

## Notes

- When multiple providers are specified, each generates independently. A failure from one provider does not cancel the others; a warning is logged and the run succeeds if at least one provider succeeds.
- Video generation tests cover validation and `--price`; live provider-generation tests require the relevant API keys. See [Step 6 Service Tests: Video](../../../tests/step-6-service-tests-video.md).
