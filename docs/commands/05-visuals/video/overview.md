# video

Generate video from text or images with Gemini and Grok. Configure `GEMINI_API_KEY` or `XAI_API_KEY` and check local readiness with `bun autoshow setup --doctor`.

## Usage

```bash
bun autoshow video "a red kite above a field" --provider grok=grok-imagine-video-1.5-lite --duration 5 --resolution 720p --price
bun autoshow video input/examples/image/harborlight-mug.png --provider gemini=gemini-omni-1.1-flash --price
bun autoshow video "a rainy neon street, slow camera pan" --all-providers --max-model-cents 100 --price
```

The positional input is a text prompt or image path, URL, or data URL. An image infers `image-to-video` and rejects other media-input flags or an incompatible explicit mode. Saved `defaults.video` applies unless overridden. Without a selected/saved provider, text mode selects the cheapest default target; positional images select all supported video models. Use an explicit target to limit cost.

`--provider` is repeatable; bare providers select their cheapest eligible model. `--all-providers` includes only models supporting the selected mode. `--price` previews without generation; `--max-model-cents` filters estimates, not billed spending. See [shared usage](../../00-setup-and-utilities/usage.md) for global controls.

## Modes

Media flags require an explicit/saved mode, except positional images. Media references accept local files, URLs, or data URLs.

| Mode                 | Targets               | Required inputs                                                     |
| -------------------- | --------------------- | ------------------------------------------------------------------- |
| `text`               | All                   | Prompt; no media flags.                                             |
| `image-to-video`     | All                   | Positional image or `--input-image`.                                |
| `reference-to-video` | Gemini; Grok full 1.5 | `--reference-image`; Gemini also accepts `--reference-video`.       |
| `interpolate`        | Gemini                | `--input-image` and `--last-frame`.                                 |
| `edit`               | Gemini                | Exactly one `--previous-interaction-id` or `--input-video`.         |
| `extend`             | Gemini                | Same as edit; uploaded-video extension may add `--reference-image`. |

`--input-video` supplies an edit/extend source, while `--reference-video` supplies reference material. Grok rejects video references; select Gemini explicitly for them. Stored-interaction extension does not forward added reference images; use an uploaded source for that combination. Audio references and voice editing have no CLI surface.

```bash
bun autoshow video "transition this campsite from dusk to night" --provider gemini=gemini-omni-1.1-flash --mode interpolate --input-image input/examples/video/harborlight-start.png --last-frame input/examples/video/harborlight-end.png --aspect-ratio 9:16 --price
bun autoshow video "an explorer in the teal jacket and gold glasses walks beside the harbor" --provider grok=grok-imagine-video-1.5 --mode reference-to-video --reference-image input/examples/video/harborlight-jacket.png --reference-image input/examples/video/harborlight-glasses.png --price
```

The [bundled fixtures](../../../../input/examples/harborlight-README.md) include the mug, distinct 1080×1920 campsite frames, and wardrobe references. The latter do not establish character identity; decoded media does not establish motion or reference fidelity.

## Shared Video Options

`video` and `resume` share short option names; saved settings use matching `defaults.video` keys.

| Flag                                           | Purpose                                                     |
| ---------------------------------------------- | ----------------------------------------------------------- |
| `--provider`, `--all-providers`                | Select targets supporting the mode.                         |
| `--mode`                                       | One of the modes above; default `text`.                     |
| `--duration`, `--resolution`, `--aspect-ratio` | Provider-specific generation controls.                      |
| `--input-image`, `--last-frame`                | Initial/final frames.                                       |
| `--reference-image`, `--reference-video`       | Repeatable reference inputs.                                |
| `--input-video`, `--previous-interaction-id`   | Gemini edit/extend source or stored interaction.            |
| `--provider-concurrency`, `--concurrency-mode` | Target cap (default 7); default `ramp`, or `immediate`.     |
| `--price`, `--max-model-cents`                 | Preview or filter estimated costs.                          |
| `--output-dir`                                 | Pin a directory instead of `output/<timestamp>_video-gen/`. |

## Video Services

### Gemini Omni

`gemini-omni-1.1-flash` supports all modes. Explicit duration must be an integer from 3–10 seconds; omission leaves duration to the provider and estimates 10 seconds. Resolution is `360p`, `720p` (default), `1080p`, or `4k`; aspect ratio is `16:9` (default) or `9:16`. Higher resolutions are described as upscaled in the registry.

Gemini reference videos are limited to three MP4s of at most three seconds each; uploaded edit/extend sources must be at most ten seconds. These differ from reusable generated interaction IDs. Confirm project access, retention, and regional eligibility in the [Omni documentation](https://ai.google.dev/gemini-api/docs/omni) before spending; CLI validation does not prove live account eligibility. The CLI exposes no audio toggle. Estimates omit input/context and thinking/text charges; review the complete sequence, including retries, rather than treating output estimates as caps.

#### Generate a base, then edit it

Keep the same Gemini API project/key for every turn. Preflight the base and planned edit/extension together. After authorization, run the base command without `--price`, using a new directory or compatible saved work:

```bash
bun autoshow video "a teal camping mug beside a glowing lantern, slow camera orbit" --provider gemini=gemini-omni-1.1-flash --duration 3 --resolution 720p --aspect-ratio 16:9 --output-dir output/gemini-omni-base --price
```

A price-only run creates no interaction ID. Read one from the completed base manifest with this local guard; it checks recorded completion and identity, not remote retention or access:

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

Preview the edit, then remove `--price` only within the approved sequence:

```bash
bun autoshow video "change the lantern glow to amber; preserve the mug and camera movement" --provider gemini=gemini-omni-1.1-flash --mode edit --previous-interaction-id "${GEMINI_INTERACTION_ID:?Read the completed base interaction first}" --duration 3 --resolution 720p --aspect-ratio 16:9 --output-dir output/gemini-omni-edit --price
```

`--mode extend` appends another 3–10 seconds and is another purchase. Reusing the base ID branches from the base; to extend the edit, read its new `providerRequestId`. Deleted/expired interactions cannot be reused, and a local MP4 is not an interaction ID. The bundled 24-second dialogue clip exceeds the uploaded-source limit.

### Grok

`grok-imagine-video-1.5-lite` is the bare-provider and omitted-provider text default; `grok-imagine-video-1.5` adds image-reference mode. Both accept text/image generation, default to 8 seconds/480p, floor/clamp supplied duration to 1–15 seconds, and support `480p`, `720p`, and `1080p`. See command help for the nine aspect ratios; omitted or unrecognized ratios resolve to `16:9`.

Full 1.5 accepts up to five reference images, capped at 720p. Lite rejects references, interpolation, editing, and extension; its 1080p is upscaled from 720p. Image-to-video follows the source image's aspect ratio upstream. Neither exposes an audio toggle or voice references. Grok input images add a per-image estimate; no Batch discount is assumed. Downloaded Grok outputs must decode locally with FFmpeg before success.

## Output

One target writes `generated-video.mp4`; multiple targets add `-<provider>-<model>`. `manifest.json` records filenames, targets, costs, timing, and Gemini `providerRequestId` values in `items[0].metadata.video[]`.

Targets run independently. If at least one succeeds, successful outputs are retained and the command completes with warnings for failures; the manifest remains `incomplete` when requested targets are missing. If none succeeds, the command fails. Inspect the manifest rather than treating one playable output as full completion, and use [resume](../../00-setup-and-utilities/resume.md) for compatible missing work.
