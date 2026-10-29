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
```

## Usage

```bash
bun autoshow video <input> [flags]
```

The positional input is a text prompt or an image path, URL, or data URL. A positional image input infers `--mode image-to-video` and cannot be combined with media-input flags. Saved `defaults.video` settings apply when not overridden. When no provider is specified or saved, a text prompt in `text` mode runs the cheapest default target and a positional image input runs every supported provider.

## Modes

Without an explicit or saved mode, media flags are rejected under the default `text` mode. A positional image input infers `image-to-video`.

| Mode                 | Providers           | Required media inputs                                                        | Notes                                      |
| -------------------- | ------------------- | ---------------------------------------------------------------------------- | ------------------------------------------ |
| `text`               | All video providers | none                                                                         | Default mode                               |
| `image-to-video`     | Gemini, Grok        | `--input-image`                                                              |                                            |
| `reference-to-video` | Gemini, Grok        | `--reference-image` and/or `--reference-video`                               |                                            |
| `interpolate`        | Gemini              | `--input-image`, `--last-frame`                                              | First/last-frame transition                |
| `edit`               | Gemini Omni         | `--previous-interaction-id` or `--input-video`                               | Conversational or uploaded-video edit      |
| `extend`             | Gemini Omni         | `--previous-interaction-id` or `--input-video`; optional `--reference-image` | Append-only continuation, 3–10s per extend |

`--input-video` is the Gemini Omni source clip for `edit` and `extend`. `reference-to-video` uses `--reference-video`. To add new reference images during `extend`, use `--input-video`; stored-interaction extension currently does not forward them.

```bash
bun autoshow video "animate the teal camping mug illustration with a gentle camera orbit; preserve its cream badge" --provider gemini=gemini-omni-1.1-flash --mode image-to-video --input-image input/examples/image/harborlight-mug.png --output-dir output/v-base
bun autoshow video "transition the same Harborlight campsite from dusk to night; keep the tent and mug consistent" --provider gemini=gemini-omni-1.1-flash --mode interpolate --input-image input/examples/video/harborlight-start.png --last-frame input/examples/video/harborlight-end.png --aspect-ratio 9:16
```

The bundled [Harborlight fixtures](../../../../input/examples/harborlight-README.md) supply the product, two distinct 1080 × 1920 campsite frames, and wardrobe references. Use `9:16` for the campsite interpolation. The jacket and glasses are object references rather than a verified character identity. Local decoding and price checks do not establish motion, reference fidelity, or provider output quality.

## Shared Video Options

The `video` and `resume` commands use the same short option names, including `--duration`. Saved configuration uses the matching namespaced key, such as `defaults.video.duration`.

| Flag                                   | Description                                                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `--provider provider[=model]`          | Hosted video provider/model selector; repeat to run multiple targets                                                      |
| `--all-providers`                      | Run every provider/model supporting the selected mode                                                                     |
| `--provider-concurrency <n>`           | Hosted video providers/models to run concurrently; default `7`                                                            |
| `--concurrency-mode <ramp\|immediate>` | Ramp from one request (`ramp`, default) or start at the configured cap (`immediate`)                                      |
| `--duration <seconds>`                 | Requested video duration                                                                                                  |
| `--aspect-ratio <ratio>`               | Provider-dependent aspect ratio                                                                                           |
| `--resolution <res>`                   | Provider-dependent resolution control                                                                                     |
| `--mode <mode>`                        | `text`, `image-to-video`, `reference-to-video`, `interpolate`, `edit`, or `extend`; default `text`                        |
| `--input-image <path-or-url>`          | Input image for `image-to-video`; first frame for `interpolate`                                                           |
| `--last-frame <path-or-url>`           | Last-frame image for `interpolate`                                                                                        |
| `--reference-image <path-or-url>`      | Reference image for `reference-to-video` or Gemini Omni uploaded-video `extend`; repeatable                               |
| `--reference-video <path-or-url>`      | Reference MP4 for Gemini Omni (up to 3, 3s each); repeatable                                                              |
| `--input-video <path-or-url>`          | Gemini Omni `edit`/`extend` source MP4 (uploaded sources ≤10s)                                                            |
| `--previous-interaction-id <id>`       | Gemini Omni prior interaction id from `providerRequestId`; use with `edit` or `extend` instead of re-uploading            |
| `--price`                              | Show the estimate and exit                                                                                                |
| `--max-model-cents <n>`                | Exclude each provider/model whose estimated total exceeds the per-model ceiling in cents; works with or without `--price` |
| `--output-dir <dir>`                   | Global flag: pin an exact run directory instead of `output/<timestamp>_video-gen/`                                        |

Video models have fixed provider audio behavior. Reference videos are rejected for Grok, whose reference mode accepts images.

See [Provider Capabilities](#provider-capabilities) for the per-model matrix.

```bash
bun autoshow video "a rainy neon city street, slow camera pan" --provider gemini=gemini-omni-1.1-flash --provider grok=grok-imagine-video-1.5
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
```

- Native audio is always on. 1080p and 4K are upscaled. Unspecified duration is estimated at 10 seconds.
- Uploaded edit/extend is not available in the EEA, Switzerland, or the United Kingdom. Audio references and voice editing are not supported.
- [Omni docs](https://ai.google.dev/gemini-api/docs/omni), [pricing](https://ai.google.dev/gemini-api/docs/pricing)

#### Generate a base, then edit it

Use a paid-tier Gemini API project with Omni access and keep `GEMINI_API_KEY` in that same project for every turn. This workflow needs a completed generated base; a price-only run creates no interaction ID. The generated interaction is stored for later editing turns. Deleted or expired interactions cannot be reused. [Stateful editing](https://ai.google.dev/gemini-api/docs/omni#stateful-video-editing), [interaction retention](https://ai.google.dev/gemini-api/docs/interactions-overview#data-storage-and-retention).

Plan the whole sequence before generating the base. At the current CLI estimate of $0.10 per output second, the 3-second base plus one 3-second edit below total **$0.60 estimated output cost**. A separate 3-second extension adds $0.30. Input/context tokens and billable retries are additional and are not fully estimated here; Google's billing uses tokens. Review the complete budget and account eligibility before removing `--price`. [Official pricing](https://ai.google.dev/gemini-api/docs/pricing#gemini-omni-flash).

First preview the base; after reviewing the combined budget, run the same command without `--price`. Choose a new output directory if `output/gemini-omni-base` already contains another run.

```bash
bun autoshow video "a teal camping mug beside a glowing lantern at a Harborlight campsite, slow camera orbit" --provider gemini=gemini-omni-1.1-flash --duration 3 --resolution 720p --aspect-ratio 16:9 --output-dir output/gemini-omni-base --price
```

After that generation completes, read its real interaction ID from `items[0].metadata.video[]` in `manifest.json`. This local command requires one completed Gemini Omni target and its nonempty `providerRequestId`; it does not contact Google or verify that the current API key can still access the stored interaction. Stop if it fails.

```bash
GEMINI_INTERACTION_ID="$(bun --no-env-file -e '
const manifest = await Bun.file(process.argv[1]).json();
const item = manifest.items?.[0];
const videos = Array.isArray(item?.metadata?.video) ? item.metadata.video : [];
const matches = videos.filter(video => video.videoGenService === "gemini" && video.videoGenModel === "gemini-omni-1.1-flash");
const video = matches[0];
const succeeded = item?.providers?.some(provider => provider.service === "gemini" && provider.model === "gemini-omni-1.1-flash" && provider.status === "succeeded");
if (manifest.command !== "video" || manifest.scope !== "single" || manifest.items?.length !== 1 || item?.status !== "full" || !succeeded || matches.length !== 1 || typeof video?.providerRequestId !== "string" || !video.providerRequestId.trim()) {
  throw new Error("Expected one completed Gemini Omni base with a providerRequestId");
}
console.log(video.providerRequestId.trim());
' output/gemini-omni-base/manifest.json)"
```

Preview the edit with that returned ID, then remove `--price` to execute it within the planned budget. The shell guard refuses an empty ID. Keep the same provider, model, project, and output settings; use a separate output directory for the edited result.

```bash
bun autoshow video "change the lantern glow to warm amber; preserve the teal mug and camera movement" --provider gemini=gemini-omni-1.1-flash --mode edit --previous-interaction-id "${GEMINI_INTERACTION_ID:?Read the completed base interaction first}" --duration 3 --resolution 720p --aspect-ratio 16:9 --output-dir output/gemini-omni-edit --price
```

An optional extension can reference the same completed base ID; it is another purchase. To extend the edited result instead, read the new `providerRequestId` from `output/gemini-omni-edit/manifest.json` using the same checks. Reusing the base ID branches from the base, not the edit.

```bash
bun autoshow video "continue the campsite camera orbit beyond the end of the clip" --provider gemini=gemini-omni-1.1-flash --mode extend --previous-interaction-id "${GEMINI_INTERACTION_ID:?Read the completed base interaction first}" --duration 3 --resolution 720p --aspect-ratio 16:9 --output-dir output/gemini-omni-extended --price
```

For uploaded edit/extend instead, supply your own compatible video of at most 10 seconds and check the regional restrictions above. The bundled 24-second dialogue fixture exceeds that upload limit. A local MP4 from another provider is not a Gemini interaction ID.

### Grok

| Option              | Value                                                                  |
| ------------------- | ---------------------------------------------------------------------- |
| Selector            | `--provider grok[=<model>]`                                            |
| Models              | `grok-imagine-video-1.5`, `grok-imagine-video-1.5-lite` (bare default) |
| Duration/resolution | `--duration <seconds>`, `--resolution 480p\|720p\|1080p`               |

```bash
bun autoshow video "a red kite above a field" --provider grok=grok-imagine-video-1.5-lite --duration 5 --resolution 720p
bun autoshow video "cinematic moonlit coastline" --provider grok=grok-imagine-video-1.5 --duration 8 --resolution 1080p
bun autoshow video "an adult explorer wearing the teal jacket and round gold glasses walks along a harbor path" --provider grok=grok-imagine-video-1.5 --mode reference-to-video --reference-image input/examples/video/harborlight-jacket.png --reference-image input/examples/video/harborlight-glasses.png
```

- Both models accept text and image generation from 1–15 seconds (default 8); supplied values are floored and clamped to that range. The default resolution is 480p. Bare `--provider grok`, an explicit Lite selector, and omitted-provider text generation select Lite at 8s/480p when controls are omitted. The cheapest-candidate helper also exposes 1s/480p, but the command retains its 8-second request default.
- Lite reaches 1080p by upscaling 720p and rejects reference, interpolate, edit, and extend modes before pricing or dispatch. Retain full 1.5 for native 1080p and image references (capped at 720p). Both models generate audio by default; the CLI exposes no audio toggle or voice references. Image-to-video follows the input image aspect ratio upstream.
- Published Lite rates checked 2026-10-29: $0.02/s at 480p, $0.03/s at 720p, $0.14/s at 1080p, plus $0.01/input image. No Batch discount is assumed. Downloaded Grok videos must decode with local FFmpeg before success; invalid bytes remain available for recovery. Local fixture checks establish transport and decoding, while visual quality, spoken correctness, and live account access remain unmeasured. See the [Lite model](https://docs.x.ai/developers/models/grok-imagine-video-1.5-lite) and [video guide](https://docs.x.ai/developers/model-capabilities/video/generation).

## Output

- Single-target runs write `generated-video.mp4` and `manifest.json`.
- Multi-target runs write `generated-video-<provider>-<model>.mp4` per successful target and `manifest.json`.
- `items[0].metadata` in the manifest records the `video` array, `cost`, and `timing`.

## Notes

- When multiple providers are specified, each generates independently. A failure from one provider does not cancel the others; the run succeeds if at least one provider succeeds.

## Provider Capabilities

Text-to-video and image-to-video are available on every provider.

Prices are the CLI's default output estimates; input charges are additional where listed. Gemini input/context costs are not fully estimated.

| Model                              | Additional modes                     | Duration | Maximum resolution      | Aspect ratio | Native audio | References                | Output estimate                                | Input charges       |
| ---------------------------------- | ------------------------------------ | -------- | ----------------------- | ------------ | ------------ | ------------------------- | ---------------------------------------------- | ------------------- |
| Gemini `gemini-omni-1.1-flash`     | Reference, interpolate, edit, extend | 3–10s    | 4K (upscaled)           | 16:9 or 9:16 | Always on    | Images and up to 3 videos | $0.10/s                                        | Not fully estimated |
| Grok `grok-imagine-video-1.5`      | Reference                            | 1–15s    | 1080p; references ≤720p | 9 ratios     | Always on    | Up to 5 images            | $0.08/s at 480p; $0.14 at 720p; $0.25 at 1080p | $0.01/image         |
| Grok `grok-imagine-video-1.5-lite` | None                                 | 1–15s    | 1080p (upscaled)        | 9 ratios     | Always on    | Input image only          | $0.02/s at 480p; $0.03 at 720p; $0.14 at 1080p | $0.01/image         |
