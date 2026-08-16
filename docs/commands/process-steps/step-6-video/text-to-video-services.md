# video

Generate a video from a text prompt or input image with one or more hosted video providers and models.

## Outline

- [Setup](#setup)
  - [Environment](#environment)
- [Usage](#usage)
- [Modes](#modes)
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
- [Provider Capabilities](#provider-capabilities)

## Setup

Video providers are hosted API services.

```bash
bun autoshow setup --step video
```

### Environment

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

## Usage

```bash
bun autoshow video <input> [flags]
```

The positional input is a text prompt or an image path, URL, or data URL. A positional image input infers `--mode image-to-video` and cannot be combined with media-input flags. Repeating a provider flag runs each selected model independently. When no provider is specified, a text prompt runs the cheapest default text-to-video target and a positional image input runs every supported provider.

## Modes

Media-input modes are explicit. Passing media flags without `--mode` is rejected because the default mode is text-to-video; positional image inputs infer `--mode image-to-video`.

| Mode                 | Providers                                                     | Required inputs                 | Notes                                                                                    |
| -------------------- | ------------------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------- |
| `text`               | All video providers                                           | none                            | Default mode                                                                             |
| `image-to-video`     | Gemini, GLM, MiniMax, Grok, LTX, Replicate, Luma Labs, fal.ai | `--input-image`                 | Animates the input image                                                                 |
| `reference-to-video` | Gemini, GLM, MiniMax S2V, Grok, Replicate, fal.ai             | `--reference-image`             | Up to 3 references (Replicate Seedance/Happy Horse up to 9; fal.ai H3 up to 12 combined) |
| `interpolate`        | Gemini, GLM, LTX 2.3, Replicate, fal.ai                       | `--input-image`, `--last-frame` | First/last-frame transition                                                              |
| `extend`             | Gemini, Grok, LTX Pro, Replicate Seedance                     | `--input-video`                 | Gemini extensions force 720p; LTX uses end extension                                     |
| `edit`               | Grok, Replicate Seedance/Kling Omni/Aleph 2                   | `--input-video`                 | Grok rejects duration, aspect, and resolution overrides                                  |

```bash
# Image animation, extension, and edit workflow
bun autoshow video "animate product on a slow turntable" --provider gemini=veo-3.1-fast-generate-preview --mode image-to-video --input-image input/product.png --output-dir output/v-base
bun autoshow video "continue turntable rotation towards window" --provider gemini=veo-3.1-fast-generate-preview --mode extend --input-video output/v-base/generated-video.mp4 --output-dir output/v-ext
bun autoshow video "change lighting to blue moonlight" --provider grok=grok-imagine-video --mode edit --input-video output/v-base/generated-video.mp4 --output-dir output/v-edit

# Interpolation and multi-reference examples
bun autoshow video "transition between frames" --provider gemini=veo-3.1-generate-preview --mode interpolate --input-image input/start.png --last-frame input/end.png
bun autoshow video "character walking through lagoon" --provider grok=grok-imagine-video --mode reference-to-video --reference-image input/jacket.png --reference-image input/glasses.png
```

## Shared Video Options

The standalone `video` command drops the `video-` prefix these options carry elsewhere (e.g. `--size` here is `--video-size` on `write`, `config`, and `resume`). See [ADR-002](../../../adr/ADR-002-pipeline-state-resume-and-dry-run-planning.md).

| Flag                                           | Description                                                                                                                                                                            |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--provider provider[=model]`                  | Hosted video provider/model selector; repeat to run multiple targets                                                                                                                   |
| `--all-providers`                              | Run every supported video provider/model                                                                                                                                               |
| `--provider-concurrency <n>`                   | Hosted video providers/models to run concurrently per item; default `7`                                                                                                                |
| `--concurrency-mode <ramp\|immediate>`         | Start each hosted provider/account lane at one request and add one slot every five seconds while demand is queued (`ramp`, default), or start at its configured cap (`immediate`)      |
| `--duration <seconds>`                         | Requested video duration                                                                                                                                                               |
| `--size <size>`                                | Provider-dependent size control                                                                                                                                                        |
| `--aspect-ratio <ratio>`                       | Provider-dependent aspect ratio                                                                                                                                                        |
| `--resolution <res>`                           | Provider-dependent resolution control                                                                                                                                                  |
| `--mode <mode>`                                | `text`, `image-to-video`, `reference-to-video`, `interpolate`, `extend`, or `edit`; default `text`                                                                                     |
| `--input-image <path-or-url>`                  | Input image for `image-to-video`; first frame for `interpolate`                                                                                                                        |
| `--last-frame <path-or-url>`                   | Last-frame image for `interpolate`                                                                                                                                                     |
| `--reference-image <path-or-url>`              | Reference image for `reference-to-video`; repeat up to 3 times (Replicate Seedance/Happy Horse accepts up to 9; fal.ai MiniMax H3 accepts up to 9; fal.ai PixVerse C1 accepts up to 7) |
| `--input-video <path-or-url>`                  | Input MP4 for `extend` or `edit`                                                                                                                                                       |
| `--grok-video-storage-filename <name>`         | xAI/Grok storage filename                                                                                                                                                              |
| `--grok-video-storage-expires-after <seconds>` | xAI/Grok storage expiration, max 30 days                                                                                                                                               |
| `--price`                                      | Show the estimate and exit                                                                                                                                                             |
| `--output-dir <dir>`                           | Global flag: pin an exact run directory instead of `output/<timestamp>_video-gen/`                                                                                                     |

See [Provider Capabilities](#provider-capabilities) for the per-model release date, text-to-video, image-to-video, reference-to-video, interpolate, edit, extend, duration, resolution, aspect-ratio, audio, and reference matrix.

```bash
bun autoshow video "a rainy neon city street, slow camera pan" --provider gemini=veo-3.1-fast-generate-preview --provider minimax=MiniMax-Hailuo-2.3 --provider runway=gen4.5 --provider ltx=ltx-2-3-fast
bun autoshow video "a rainy neon city street, slow camera pan" --all-providers --price
```

## Video Services

### Gemini Veo

| Option       | Value                                                                                        |
| ------------ | -------------------------------------------------------------------------------------------- |
| Selector     | `--provider gemini[=<model>]`                                                                |
| Models       | `veo-3.1-generate-preview`, `veo-3.1-fast-generate-preview`, `veo-3.1-lite-generate-preview` |
| Duration     | `--duration <seconds>`, normalized to `4`, `6`, or `8`                                       |
| Resolution   | `--resolution 720p\|1080p\|4k`; `4k` is standard/Fast only                                   |
| Aspect ratio | `--aspect-ratio <ratio>`; forwarded to the Veo API                                           |

```bash
bun autoshow video "a rainy neon city street, slow camera pan" --provider gemini=veo-3.1-fast-generate-preview
bun autoshow video "a sweeping Grand Canyon drone shot" --provider gemini=veo-3.1-generate-preview --duration 8 --aspect-ratio 16:9 --resolution 4k
```

- Gemini `1080p`, `4k`, reference-image, and extension requests are normalized to 8 seconds.
- Veo 3.1 Lite does not support `4k`, reference-image generation, or video extension.

### MiniMax

| Option              | Value                                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Selector            | `--provider minimax[=<model>]`                                                                                                     |
| Models              | `MiniMax-Hailuo-2.3`, `MiniMax-Hailuo-2.3-Fast`, `T2V-01-Director`, `T2V-01`, `I2V-01-Director`, `I2V-01-live`, `I2V-01`, `S2V-01` |
| Duration/resolution | `--duration 6\|10`, `--resolution 720p\|1080p` on Hailuo models; other models fixed at `6`s / `720p`                               |
| Aspect ratio        | Not supported                                                                                                                      |

```bash
bun autoshow video "a rainy neon city street" --provider minimax=MiniMax-Hailuo-2.3 --duration 10 --resolution 720p
bun autoshow video "animate product photo" --provider minimax=I2V-01 --mode image-to-video --input-image input/product.png
bun autoshow video "person walking through studio" --provider minimax=S2V-01 --mode reference-to-video --reference-image input/person.png
```

### Z.AI GLM

| Option            | Value                                                                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Selector          | `--provider glm[=<model>]`                                                                                                                     |
| Models            | `cogvideox-3`, `viduq1-text`, `vidu2-image`, `vidu2-start-end`, `vidu2-reference`                                                              |
| Duration          | `--duration 5\|10` on CogVideoX; Vidu Q1 fixed at `5`s and Vidu 2 at `4`s                                                                      |
| Size/aspect ratio | `--size` accepts CogVideoX sizes (`1280x720`..`3840x2160`) or Vidu 2 sizes (`720x480`, `1280x720`); `--aspect-ratio 16:9\|9:16\|1:1\|4:3\|3:4` |

```bash
bun autoshow video "a cat playing with yarn" --provider glm=cogvideox-3 --duration 10 --size 1920x1080
bun autoshow video "animate product photo" --provider glm=vidu2-image --mode image-to-video --input-image input/product.png
```

GLM prompts are capped at 512 characters.

### Grok

| Option              | Value                                                                              |
| ------------------- | ---------------------------------------------------------------------------------- |
| Selector            | `--provider grok[=<model>]`                                                        |
| Models              | `grok-imagine-video`, `grok-imagine-video-1.5`                                     |
| Duration/resolution | `--duration <seconds>`, `--resolution 480p\|720p`; Video 1.5 also supports `1080p` |
| Storage             | `--grok-video-storage-filename`, `--grok-video-storage-expires-after`              |

```bash
bun autoshow video "a cat playing piano" --provider grok=grok-imagine-video --duration 8 --resolution 720p
bun autoshow video "cinematic moonlit coastline" --provider grok=grok-imagine-video-1.5 --duration 8 --resolution 1080p
bun autoshow video "extend clip" --provider grok=grok-imagine-video --mode extend --input-video input/clip.mp4 --duration 6
```

- Text/image/reference durations clamp to 1–15 seconds (default 8). Reference generation is capped at 720p.
- Edit/extend durations clamp to 1–10 seconds (default 6).

### Runway

| Option       | Value                                                 |
| ------------ | ----------------------------------------------------- |
| Selector     | `--provider runway[=<model>]`                         |
| Models       | `gen4.5`                                              |
| Duration     | `--duration <seconds>` (clamped to 2–10s, default 5s) |
| Aspect ratio | `--aspect-ratio 16:9\|9:16`                           |

```bash
bun autoshow video "a cinematic mountain sunrise" --provider runway=gen4.5 --duration 5 --aspect-ratio 16:9
```

Prompts are capped at 1000 UTF-16 code units.

### LTX

| Option          | Value                                                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Selector        | `--provider ltx[=<model>]`                                                                                                  |
| Models          | `ltx-2-3-fast`, `ltx-2-3-pro`                                                                                               |
| Duration        | Default `8`s; Fast `1920x1080` uses even seconds `6`–`20`; Pro/other Fast use `6`, `8`, or `10`; extend clamps to `2`–`20`s |
| Size/resolution | `--size` accepts `1920x1080`, `1080x1920`, `2560x1440`, `1440x2560`, `3840x2160`, `2160x3840`; or `--resolution 1080p\|4k`  |
| Aspect ratio    | `16:9` or `9:16`                                                                                                            |

```bash
bun autoshow video "clean product reveal shot" --provider ltx=ltx-2-3-fast --duration 8 --resolution 1080p
bun autoshow video "transition between studio frames" --provider ltx=ltx-2-3-pro --mode interpolate --input-image input/start.png --last-frame input/end.png --size 1440x2560
```

### Replicate

| Option       | Value                                                                                                                                                                                                           |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Selector     | `--provider replicate[=<model>]`                                                                                                                                                                                |
| Models       | `alibaba/happyhorse-1.1`, `bytedance/seedance-2.0`, `bytedance/seedance-2.0-fast`, `kwaivgi/kling-v3-video`, `kwaivgi/kling-v3-omni-video`, `pixverse/pixverse-v6`, `runwayml/aleph-2`, `wan-video/wan-2.7-t2v` |
| Duration     | Happy Horse/Kling `3`–`15`s, PixVerse `5\|8\|10\|15`s, Seedance `-1`–`15`s, Wan `2`–`15`s (default `5`s); Aleph uses input clip duration                                                                        |
| Resolution   | Kling `720p\|1080p\|4k`, PixVerse `360p\|540p\|720p\|1080p`, Happy Horse/Wan `720p\|1080p`, Seedance `480p\|720p\|1080p`, Seedance Fast `480p\|720p` (default `720p`)                                           |
| Aspect ratio | Happy Horse `16:9`, `9:16`, `1:1`, `4:3`, `3:4`; Kling/PixVerse `16:9`, `9:16`, `1:1`; Seedance adds `21:9`, `9:21`, `adaptive` (default `16:9`)                                                                |

```bash
bun autoshow video "cinematic mountain sunrise" --provider replicate=wan-video/wan-2.7-t2v
bun autoshow video "multi-shot launch" --provider replicate=kwaivgi/kling-v3-video --duration 8 --resolution 1080p --replicate-video-generate-audio --replicate-video-multi-prompt '[{"prompt":"macro detail","duration":3},{"prompt":"wide reveal","duration":5}]'
bun autoshow video "edit lighting" --provider replicate=runwayml/aleph-2 --mode edit --input-video input/source.mp4
```

- Kling Video 3.0 supports multi-shot prompts via `--replicate-video-multi-prompt`. Kling Omni adds reference images, video, and editing.
- PixVerse V6 supports native audio and `--replicate-video-multi-clip`.
- Aleph 2.0 is edit-only (`--input-video`, 2–30s clip <16MB).
- All Replicate models accept `--replicate-video-seed`.

### Luma Labs

| Option       | Value                                                              |
| ------------ | ------------------------------------------------------------------ |
| Selector     | `--provider lumalabs[=<model>]`                                    |
| Models       | `ray-3.2`                                                          |
| Duration     | `--duration <seconds>`; normalized to `5s` (`<8`) or `10s` (`>=8`) |
| Resolution   | `--resolution 540p\|720p\|1080p`; default `720p`                   |
| Aspect ratio | `9:16`, `3:4`, `1:1`, `4:3`, `16:9`, or `21:9`; default `16:9`     |

```bash
bun autoshow video "slow dolly through misty greenhouse" --provider lumalabs=ray-3.2 --duration 5 --resolution 720p
```

Supports `text` and `image-to-video` modes.

### fal.ai

| Option     | Value                                                                          |
| ---------- | ------------------------------------------------------------------------------ |
| Selector   | `--provider fal[=<model>]`                                                     |
| Models     | `minimax/h3`, `fal-ai/pixverse/c1`                                             |
| Modes      | Both support `text`, `image-to-video`, `reference-to-video`, and `interpolate` |
| Duration   | H3 `5-15`s; PixVerse C1 `1-15`s; default `5`s                                  |
| Resolution | H3 `768p\|2k`; PixVerse C1 `360p\|540p\|720p\|1080p`                           |

```bash
bun autoshow video "rain-soaked detective enters diner" --provider fal=minimax/h3 --duration 5 --resolution 2k
bun autoshow video "product turntable" --provider fal=fal-ai/pixverse/c1 --mode image-to-video --input-image input/product.png --fal-video-generate-audio
```

- MiniMax H3 accepts up to 9 image, 3 video, and 3 audio references (max 12 combined).
- PixVerse C1 accepts up to 7 image references and supports `--fal-video-generate-audio`.

## Output

- **Single-provider runs**: write `output/<timestamp>_video-gen/generated-video.mp4` and `manifest.json`.
- **Multi-provider runs**: write `generated-video-<service>-<sanitized-model>.mp4` for each successful provider and `manifest.json`.
- **`manifest.json`**: records metadata including `video`, `cost`, and `timing`; `video` is always an array.
- **`--output-dir`**: pins an exact output directory; generated file names remain provider-deterministic inside that directory.

## Notes

- When multiple providers are specified, each generates independently. A failure from one provider does not cancel the others; a warning is logged and the run succeeds if at least one provider succeeds.
- Video generation tests cover validation and `--price`; live provider-generation tests require API keys. See [Step 6 Service Tests: Video](video-tests.md).

## Provider Capabilities

Marks match the [TTS capability tables](../step-4-tts/text-to-speech-and-voice.md#provider-capabilities): ✅ supported, ⚠️ partial or qualified, ❌ not exposed. Released dates are provider announcement or snapshot dates. Recency marks follow the TTS convention: current-year GA is ✅, older still-current snapshots are ⚠️, and pre-2026 engines are ❌. Rows are newest first. Mode columns use ✅ supported and ❌ not exposed. Duration uses ✅ 15 seconds or longer, ⚠️ 8–10 seconds, and ❌ 6 seconds or less. Max resolution uses ✅ 4K, ⚠️ 1080p or 2K, and ❌ 720p or below. References use ✅ 7 or more, ⚠️ 1–5, and ❌ none. Pricing is the AutoShow registry rate. Cost rank orders models cheapest-first (1 = cheapest) and ties share a rank, comparing effective price per second at 720p or the nearest supported tier and converting block, per-clip, and per-job prices by the clip length they buy (6-second MiniMax blocks, 5-second Luma, CogVideoX, and Vidu Q1 clips, 4-second Vidu 2 jobs).

| Provider                                                            | Released      | text-to-video | image-to-video | reference-to-video | interpolate | edit | extend | Duration               | Max resolution | Aspect ratio    | Native audio                          | References | Pricing                                                    | Cost rank     |
| ------------------------------------------------------------------- | ------------- | ------------- | -------------- | ------------------ | ----------- | ---- | ------ | ---------------------- | -------------- | --------------- | ------------------------------------- | ---------- | ---------------------------------------------------------- | ------------- |
| fal.ai `minimax/h3`                                                 | ✅ 2026-07-31 | ✅            | ✅             | ✅                 | ✅          | ❌   | ❌     | ✅ 5–15s               | ⚠️ 2K          | ✅ 6 ratios     | ⚠️ Always on                          | ✅ Up to 9 | $0.26/s                                                    | 30/32         |
| Replicate `alibaba/happyhorse-1.1`                                  | ✅ 2026-06-22 | ✅            | ✅             | ✅                 | ❌          | ❌   | ❌     | ✅ 3–15s               | ⚠️ 1080p       | ✅ 5 ratios     | ❌ No                                 | ✅ Up to 9 | $0.14/s at 720p ($0.18 at 1080p)                           | 24/32         |
| Luma Labs `ray-3.2`                                                 | ✅ 2026-06-09 | ✅            | ✅             | ❌                 | ❌          | ❌   | ❌     | ⚠️ 5s or 10s           | ⚠️ 1080p       | ✅ 6 ratios     | ❌ No                                 | ❌ No      | $0.30 per 5s 720p clip ($0.06–$3.60 by tier)               | 15/32         |
| Grok `grok-imagine-video-1.5`                                       | ✅ 2026-05-30 | ✅            | ✅             | ✅                 | ❌          | ❌   | ❌     | ✅ 1–15s               | ⚠️ 1080p       | ✅ 7 ratios     | ❌ No                                 | ⚠️ Up to 5 | $0.14/s at 720p ($0.08 at 480p, $0.25 at 1080p)            | 24/32         |
| Replicate `runwayml/aleph-2`                                        | ✅ 2026-05-21 | ❌            | ❌             | ❌                 | ❌          | ✅   | ❌     | ✅ Clip 2–30s          | ⚠️ Source      | ❌ No           | ❌ No                                 | ❌ No      | $0.336/s                                                   | 31/32         |
| Replicate `pixverse/pixverse-v6`                                    | ✅ 2026-04-22 | ✅            | ✅             | ❌                 | ✅          | ❌   | ❌     | ✅ 5–15s               | ⚠️ 1080p       | ✅ 3 ratios     | ✅ `--replicate-video-generate-audio` | ❌ No      | $0.09/s at 720p ($0.05–$0.18 by resolution)                | 19/32         |
| Gemini `veo-3.1-lite-generate-preview`                              | ✅ 2026-04-02 | ✅            | ✅             | ❌                 | ✅          | ❌   | ❌     | ⚠️ 4 / 6 / 8s          | ⚠️ 1080p       | ✅ Forwarded    | ❌ No                                 | ❌ No      | $0.05/s at 720p ($0.08 at 1080p)                           | 11/32         |
| Replicate `wan-video/wan-2.7-t2v`                                   | ✅ 2026-04-01 | ✅            | ❌             | ❌                 | ❌          | ❌   | ❌     | ✅ 2–15s               | ⚠️ 1080p       | ✅ 5 ratios     | ❌ No                                 | ❌ No      | $0.10/s                                                    | 20/32         |
| Replicate `kwaivgi/kling-v3-video`                                  | ✅ 2026-02-16 | ✅            | ✅             | ❌                 | ✅          | ❌   | ❌     | ✅ 3–15s               | ✅ 4K          | ✅ 3 ratios     | ✅ `--replicate-video-generate-audio` | ❌ No      | $0.168/s at 720p ($0.224 at 1080p, $0.42 at 4K)            | 27/32         |
| Replicate `kwaivgi/kling-v3-omni-video`                             | ✅ 2026-02-16 | ✅            | ✅             | ✅                 | ✅          | ✅   | ❌     | ✅ 3–15s               | ✅ 4K          | ✅ 3 ratios     | ✅ `--replicate-video-generate-audio` | ✅ Up to 7 | $0.168/s at 720p ($0.224 at 1080p, $0.42 at 4K)            | 27/32         |
| Replicate `bytedance/seedance-2.0`                                  | ✅ 2026-02-12 | ✅            | ✅             | ✅                 | ✅          | ✅   | ✅     | ✅ −1–15s              | ⚠️ 1080p       | ✅ 8 ratios     | ✅ `--replicate-video-generate-audio` | ✅ Up to 9 | $0.18/s at 720p ($0.08 at 480p, $0.45 at 1080p)            | 29/32         |
| Replicate `bytedance/seedance-2.0-fast`                             | ✅ 2026-02-12 | ✅            | ✅             | ✅                 | ✅          | ✅   | ✅     | ✅ −1–15s              | ❌ 720p        | ✅ 8 ratios     | ✅ `--replicate-video-generate-audio` | ✅ Up to 9 | $0.15/s at 720p ($0.07 at 480p)                            | 26/32         |
| Grok `grok-imagine-video`                                           | ✅ 2026-01    | ✅            | ✅             | ✅                 | ❌          | ✅   | ✅     | ✅ 1–15s               | ❌ 720p        | ✅ 7 ratios     | ❌ No                                 | ⚠️ Up to 3 | $0.05/s                                                    | 11/32         |
| LTX `ltx-2-3-fast`                                                  | ✅ 2026       | ✅            | ✅             | ❌                 | ✅          | ❌   | ❌     | ✅ 6–20s               | ✅ 4K          | ✅ 16:9 or 9:16 | ❌ No                                 | ❌ No      | $0.06/s at 1080p (2x at 1440p, 4x at 4K)                   | 15/32         |
| LTX `ltx-2-3-pro`                                                   | ✅ 2026       | ✅            | ✅             | ❌                 | ✅          | ❌   | ✅     | ⚠️ 6–10s; extend 2–20s | ✅ 4K          | ✅ 16:9 or 9:16 | ❌ No                                 | ❌ No      | $0.08/s at 1080p (2x at 1440p, 4x at 4K)                   | 17/32         |
| fal.ai `fal-ai/pixverse/c1`                                         | ✅ 2026       | ✅            | ✅             | ✅                 | ✅          | ❌   | ❌     | ✅ 1–15s               | ⚠️ 1080p       | ✅ 8 ratios     | ✅ `--fal-video-generate-audio`       | ✅ Up to 7 | $0.005/s                                                   | 1/32          |
| Runway `gen4.5`                                                     | ⚠️ 2025-12-01 | ✅            | ❌             | ❌                 | ❌          | ❌   | ❌     | ⚠️ 2–10s               | ❌ 720p        | ✅ 16:9 or 9:16 | ❌ No                                 | ❌ No      | $0.12/s                                                    | 23/32         |
| MiniMax `MiniMax-Hailuo-2.3`                                        | ⚠️ 2025-10-28 | ✅            | ✅             | ❌                 | ❌          | ❌   | ❌     | ⚠️ 6–10s               | ⚠️ 1080p       | ❌ No           | ❌ No                                 | ❌ No      | $0.28 per 6s 720p block ($0.49 at 1080p)                   | 10/32         |
| MiniMax `MiniMax-Hailuo-2.3-Fast`                                   | ⚠️ 2025-10-28 | ❌            | ✅             | ❌                 | ❌          | ❌   | ❌     | ⚠️ 6–10s               | ⚠️ 1080p       | ❌ No           | ❌ No                                 | ❌ No      | $0.19 per 6s 720p clip ($0.32 for 10s, $0.33 for 6s 1080p) | 2/32          |
| Gemini `veo-3.1-generate-preview` / `veo-3.1-fast-generate-preview` | ⚠️ 2025-10-15 | ✅            | ✅             | ✅                 | ✅          | ❌   | ✅     | ⚠️ 4 / 6 / 8s          | ✅ 4K          | ✅ Forwarded    | ❌ No                                 | ⚠️ Up to 3 | $0.40/s / $0.10/s at 720p                                  | 32/32 / 20/32 |
| GLM `cogvideox-3`                                                   | ⚠️ 2025       | ✅            | ✅             | ❌                 | ✅          | ❌   | ❌     | ⚠️ 5–10s               | ✅ 4K          | ✅ 5 ratios     | ❌ Off                                | ❌ No      | $0.20/job                                                  | 9/32          |
| GLM `viduq1-text`                                                   | ⚠️ 2025       | ✅            | ❌             | ❌                 | ❌          | ❌   | ❌     | ❌ 5s                  | ⚠️ 1080p       | ✅ 5 ratios     | ❌ No                                 | ❌ No      | $0.40/job                                                  | 17/32         |
| MiniMax `T2V-01` / `T2V-01-Director`                                | ⚠️ 2025-01    | ✅            | ❌             | ❌                 | ❌          | ❌   | ❌     | ❌ 6s                  | ❌ 720p        | ❌ No           | ❌ No                                 | ❌ No      | $0.19 per 6s 720p block                                    | 2/32          |
| MiniMax `I2V-01` / `I2V-01-Director` / `I2V-01-live`                | ⚠️ 2025-01    | ❌            | ✅             | ❌                 | ❌          | ❌   | ❌     | ❌ 6s                  | ❌ 720p        | ❌ No           | ❌ No                                 | ❌ No      | $0.19 per 6s 720p block                                    | 2/32          |
| MiniMax `S2V-01`                                                    | ⚠️ 2025-01    | ❌            | ❌             | ✅                 | ❌          | ❌   | ❌     | ❌ 6s                  | ❌ 720p        | ❌ No           | ❌ No                                 | ⚠️ 1       | $0.19 per 6s 720p block                                    | 2/32          |
| GLM `vidu2-image`                                                   | ❌ 2024-11    | ❌            | ✅             | ❌                 | ❌          | ❌   | ❌     | ❌ 4s                  | ❌ 720p        | ✅ 5 ratios     | ❌ No                                 | ❌ No      | $0.20/job                                                  | 11/32         |
| GLM `vidu2-start-end`                                               | ❌ 2024-11    | ❌            | ❌             | ❌                 | ✅          | ❌   | ❌     | ❌ 4s                  | ❌ 720p        | ✅ 5 ratios     | ❌ No                                 | ❌ No      | $0.20/job                                                  | 11/32         |
| GLM `vidu2-reference`                                               | ❌ 2024-11    | ❌            | ❌             | ✅                 | ❌          | ❌   | ❌     | ❌ 4s                  | ❌ 720p        | ✅ 5 ratios     | ❌ Off                                | ⚠️ Up to 3 | $0.40/job                                                  | 20/32         |

Gemini 1080p, 4K, reference-to-video, and extend requests are forced to 8 seconds; extend also forces 720p. Veo 3.1 Lite has no 4K, references, or extend. Hailuo 1080p is 6 seconds only. Grok text/image/reference is 1–15 seconds; edit/extend is 1–10 seconds and rejects aspect/resolution overrides. Grok 1.5 reference-to-video is capped at 720p. Seedance `−1` is intelligent duration, billed as 5 seconds. Aleph 2 is edit-only for a 2–30 second clip under 16 MB. MiniMax H3 audio is always on and also accepts up to 3 video and 3 audio references (12 combined). GLM prompts are capped at 512 characters. Runway prompts are capped at 1000 UTF-16 code units.
