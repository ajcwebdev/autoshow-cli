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

`image` and `resume` share these short names. Save reusable size, quality, format, background, count, and aspect ratio settings under `defaults.image`. Supply input and mask paths for the edit you want to run.

| Flag                                           | Purpose                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------ |
| `--provider`, `--all-providers`                | Select provider/model targets.                                                 |
| `--provider-concurrency`, `--concurrency-mode` | Target cap (default 7); ramp by default, or start at the cap with `immediate`. |
| `--size`, `--aspect-ratio`, `--quality`        | Provider-specific dimensions and quality.                                      |
| `--input`                                      | Repeatable local path or URL for reference/edit images.                        |
| `--mask`                                       | Local OpenAI PNG mask for the first input image.                               |
| `--count`                                      | OpenAI/Grok images per request, 1–10; omit for Gemini.                         |
| `--format`, `--background`, `--compression`    | OpenAI encoding, background, and JPEG/WebP compression.                        |
| `--response-mode`                              | Gemini `image` (default) or `text-image`.                                      |
| `--price`, `--max-model-cents`                 | Preview estimates or filter expensive targets.                                 |
| `--output-dir`                                 | Pin a run directory instead of `output/<timestamp>_image-gen/`.                |

## Image Services

### Gemini

- Model: `gemini-nano-banana-2.1`. `gemini-3.1-flash-lite-image` was retired on 2026-11-19; selecting it fails and names Nano Banana 2.1.
- Size `1K`, `2K`, or `4K`; omitted size uses provider sizing and a 1K estimate.
- Ten standard aspect ratios plus `1:4`, `4:1`, `1:8`, and `8:1`.
- Up to 14 ordered references and one image per request. Omit `--count`, even for one image. Quality, format, background, and compression controls are unsupported.
- `--response-mode text-image` requests text alongside the image. Image-only estimates exclude input tokens and text/thinking output; this command enables no grounding, thinking controls, video/PDF references, or conversational sessions.

```bash
bun autoshow image "restyle this mug as a harbor travel poster; preserve the cream badge" --provider gemini=gemini-nano-banana-2.1 --input input/examples/image/harborlight-mug.png --price
```

### OpenAI

- Models: `gpt-image-2.6-flare` (bare default) and `gpt-image-2.6-sunburst`. `gpt-image-2.5-flare` and `gpt-image-2.5-sunburst` were retired on 2026-11-19; selecting either fails and names its 2.6 counterpart. OpenAI's calculator bills 2.6 output at 4.2× the 2.5 tokens for `low` and 3.3× for `medium` (1024×1024 medium: 4.347¢); `high` and above are unchanged.
- Use `--size auto`, a standard size, or `WIDTHxHEIGHT`; `--aspect-ratio` is unsupported. Custom dimensions require multiples of 16, edge ≤3840, aspect ratio ≤3:1, and 655,360–8,294,400 total pixels.
- Both models accept `low`, `medium`, `high`, `xhigh`, `max`, and `auto` quality. Output formats are `png` (default), `jpeg`, and `webp`. Background defaults to `auto`. Use `opaque` for a solid background or `transparent` with PNG or WebP for a cutout. [OpenAI prompting guide](https://developers.openai.com/api/docs/guides/image-prompting?model=gpt-image-2.6#run-a-complete-example)
- Supply up to 16 ordered references and request 1–10 outputs. For a masked edit, pass a local PNG smaller than 4 MB with the same dimensions as the first input. Fully transparent mask pixels mark the editable area. `--compression 0-100` applies to JPEG and WebP output. [OpenAI image edit reference](https://developers.openai.com/api/reference/python/resources/images/methods/edit)
- Omitted/auto size and quality are estimated as 1024×1024 medium. Reference estimates use 1,000 tokens per input per output; prompt tokens and cache discounts are excluded.

```bash
bun autoshow image "a teal camping mug with a cream badge on white seamless" --provider openai=gpt-image-2.6-flare --size 1024x1024 --quality medium --price
```

### Grok

- Model: `grok-imagine-image-2.0`; size `1K` (default) or `2K`, with 16 aspect-ratio choices.
- Quality: `low`, `medium`, or `auto`; omitted/auto resolves to low for generation and medium for editing.
- Up to five PNG/JPEG references, 1–10 outputs, and JPEG output. Each reference is estimated once per request, independently of output count.
- Format, background, compression, and response-mode controls are unsupported.

```bash
bun autoshow image "a futuristic observatory at sunset" --provider grok=grok-imagine-image-2.0 --aspect-ratio 16:9 --size 1K --count 4 --price
```

## Generate then edit

Estimate the entire sequence, including billable retries, before dispatch. The bundled mug and matching mask let you estimate or run a masked edit directly. For a newly generated base, supply a mask aligned with that image and recheck the estimate. [Bundled fixtures](../../../../input/examples/harborlight-README.md)

```bash
bun autoshow image "a teal camping mug with a cream badge on white seamless" --provider openai=gpt-image-2.6-flare --count 1 --size 1024x1024 --quality medium --format png --price
bun autoshow image "make only the mug matte black; preserve the badge, camera, lighting, and background" --provider openai=gpt-image-2.6-sunburst --input input/examples/image/harborlight-mug.png --mask input/examples/image/harborlight-mug-mask.png --size 1024x1024 --quality xhigh --format webp --compression 80 --price
```

After accepting the combined estimate, generate and verify the base. Use new output directories or resume compatible work; preserve purchased outputs.

```bash
(
  set -e
  bun autoshow image "a teal camping mug with a cream badge on white seamless" --provider openai=gpt-image-2.6-flare --count 1 --size 1024x1024 --quality medium --format png --output-dir output/mug-base
  bun --no-env-file src/tools/verify-image-artifact.ts output/mug-base/generated-image.png --size 1024x1024
  bun autoshow image "make only the mug matte black; preserve the badge, camera, lighting, and background" --provider openai=gpt-image-2.6-sunburst --input output/mug-base/generated-image.png --size 1024x1024 --quality xhigh --format webp --compression 80 --price
)
```

Review the revised quote and image, then purchase the edit:

```bash
(
  set -e
  bun --no-env-file src/tools/verify-image-artifact.ts output/mug-base/generated-image.png --size 1024x1024
  bun autoshow image "make only the mug matte black; preserve the badge, camera, lighting, and background" --provider openai=gpt-image-2.6-sunburst --input output/mug-base/generated-image.png --size 1024x1024 --quality xhigh --format webp --compression 80 --output-dir output/mug-edit
  bun --no-env-file src/tools/verify-image-artifact.ts output/mug-edit/generated-image.webp --size 1024x1024
)
```

The verifier needs FFmpeg/ffprobe and checks encoding, dimensions, and decoding locally. It does not assess the requested appearance. To edit the fixture directly, use it as `--input` without base generation; the hosted edit remains billable.

## Output

One target writes `generated-image.<ext>`; extra images add `-2`, `-3`, etc. Multiple targets include `-<provider>-<model>`, even within one provider. JPEG uses `.jpg`. The canonical `manifest.json` records filenames, provider/model, costs, and timing; inspect it before adapting dependent workflows. Saved bytes alone do not prove a valid or faithful image.
