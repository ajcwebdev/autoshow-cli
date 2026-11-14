# image

Generate or edit images with Gemini, OpenAI, or Grok. Configure `GEMINI_API_KEY`, `OPENAI_API_KEY`, or `XAI_API_KEY` for the selected provider; `bun autoshow setup --doctor` checks readiness.

## Usage

```bash
bun autoshow image "a panoramic harbor at dawn" --provider gemini=gemini-nano-banana-2.1 --size 4K --aspect-ratio 8:1 --price
bun autoshow image "a serene mountain lake at dawn" --all-providers --max-model-cents 5 --price
```

Select a provider explicitly, use `--all-providers`, or save `defaults.image`. Bare providers select their cheapest eligible model; repeat `--provider` for multiple targets. Explicit flags override saved controls. Unsupported provider/control combinations fail locally, so a shared flag need not work with every selected target.

`--price` estimates without generation. `--max-model-cents` filters targets by estimated total, not actual billed cost. Reference and prompt charges can exceed estimates. See [shared usage](../../00-setup-and-utilities/usage.md) and `bun autoshow image --help` for global flags and complete choices.

## Shared Image Options

`image` and `resume` share these short names; saved controls use matching keys under `defaults.image`.

| Flag                                           | Purpose                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------ |
| `--provider`, `--all-providers`                | Select provider/model targets.                                                 |
| `--provider-concurrency`, `--concurrency-mode` | Target cap (default 7); ramp by default, or start at the cap with `immediate`. |
| `--size`, `--aspect-ratio`, `--quality`        | Provider-specific dimensions and quality.                                      |
| `--input`                                      | Repeatable local path or URL for reference/edit images.                        |
| `--mask`                                       | OpenAI PNG mask; requires an input image.                                      |
| `--count`                                      | OpenAI/Grok images per request, 1–10; omit for Gemini.                         |
| `--format`, `--background`, `--compression`    | OpenAI encoding, transparency, and JPEG/WebP compression.                      |
| `--response-mode`                              | Gemini `image` (default) or `text-image`.                                      |
| `--price`, `--max-model-cents`                 | Preview estimates or filter expensive targets.                                 |
| `--output-dir`                                 | Pin a run directory instead of `output/<timestamp>_image-gen/`.                |

## Image Services

### Gemini

- Models: `gemini-3.1-flash-lite-image` (bare default) and `gemini-nano-banana-2.1`.
- Lite supports `1K`; Nano Banana supports `1K`, `2K`, and `4K`. Omitted size uses provider sizing and a 1K estimate.
- Both accept ten standard aspect ratios; Nano Banana also supports `1:4`, `4:1`, `1:8`, and `8:1`.
- Up to 14 ordered references and one image per request. Omit `--count`, even for one image. Masks, quality, format, background, and compression controls are unsupported.
- `--response-mode text-image` requests text alongside the image. Image-only estimates exclude input tokens and text/thinking output; this command enables no grounding, thinking controls, video/PDF references, or conversational sessions.

```bash
bun autoshow image "restyle this mug as a harbor travel poster; preserve the cream badge" --provider gemini=gemini-3.1-flash-lite-image --input input/examples/image/harborlight-mug.png --price
```

### OpenAI

- Models: `gpt-image-2.5-flare` (bare default) and `gpt-image-2.5-sunburst`.
- Use `--size auto`, a standard size, or `WIDTHxHEIGHT`; `--aspect-ratio` is unsupported. Custom dimensions require multiples of 16, edge ≤3840, aspect ratio ≤3:1, and 655,360–8,294,400 total pixels.
- Quality: `low`, `medium`, `high`, `xhigh`, `max`, or `auto`. Format: `png` (default), `jpeg`, or `webp`. Background: `auto`, `opaque`, or `transparent`; transparency requires PNG/WebP.
- Up to 16 ordered references, an optional PNG mask, and 1–10 outputs. `--compression 0-100` requires JPEG/WebP.
- Omitted/auto size and quality are estimated as 1024×1024 medium. Reference estimates use 1,000 tokens per input per output; prompt tokens and cache discounts are excluded.

### Grok

- Model: `grok-imagine-image-2.0`; size `1K` (default) or `2K`, with 16 aspect-ratio choices.
- Quality: `low`, `medium`, or `auto`; omitted/auto resolves to low for generation and medium for editing.
- Up to five PNG/JPEG references, 1–10 outputs, and JPEG output. Each reference is estimated once per request, independently of output count.
- Format, background, masks, compression, and response-mode controls are unsupported.

```bash
bun autoshow image "a futuristic observatory at sunset" --provider grok=grok-imagine-image-2.0 --aspect-ratio 16:9 --size 1K --count 4 --price
```

## Generate then edit

Estimate the entire sequence, including billable retries, before dispatch. The [bundled mug and mask](../../../../input/examples/harborlight-README.md) let you estimate an edit before purchasing a base; recheck against the actual base afterward.

```bash
bun autoshow image "a teal camping mug with a cream badge on white seamless" --provider openai=gpt-image-2.5-flare --count 1 --size 1024x1024 --quality medium --format png --price
bun autoshow image "make only the mug matte black; preserve the badge, camera, lighting, and background" --provider openai=gpt-image-2.5-sunburst --input input/examples/image/harborlight-mug.png --size 1024x1024 --quality xhigh --format webp --compression 80 --price
```

After accepting the combined estimate, generate and verify the base. Use new output directories or resume compatible work; preserve purchased outputs.

```bash
(
  set -e
  bun autoshow image "a teal camping mug with a cream badge on white seamless" --provider openai=gpt-image-2.5-flare --count 1 --size 1024x1024 --quality medium --format png --output-dir output/mug-base
  bun --no-env-file src/tools/verify-image-artifact.ts output/mug-base/generated-image.png --size 1024x1024
  bun autoshow image "make only the mug matte black; preserve the badge, camera, lighting, and background" --provider openai=gpt-image-2.5-sunburst --input output/mug-base/generated-image.png --size 1024x1024 --quality xhigh --format webp --compression 80 --price
)
```

Review the revised quote and image, then purchase the edit:

```bash
(
  set -e
  bun --no-env-file src/tools/verify-image-artifact.ts output/mug-base/generated-image.png --size 1024x1024
  bun autoshow image "make only the mug matte black; preserve the badge, camera, lighting, and background" --provider openai=gpt-image-2.5-sunburst --input output/mug-base/generated-image.png --size 1024x1024 --quality xhigh --format webp --compression 80 --output-dir output/mug-edit
  bun --no-env-file src/tools/verify-image-artifact.ts output/mug-edit/generated-image.webp --size 1024x1024
)
```

The verifier needs FFmpeg/ffprobe and checks encoding, dimensions, and decoding locally. It does not assess the requested appearance. To edit the fixture directly, use it as `--input` without base generation; the hosted edit remains billable.

## Output

One target writes `generated-image.<ext>`; extra images add `-2`, `-3`, etc. Multiple targets include `-<provider>-<model>`, even within one provider. JPEG uses `.jpg`. The canonical `manifest.json` records filenames, provider/model, costs, and timing; inspect it before adapting dependent workflows. Saved bytes alone do not prove a valid or faithful image.
