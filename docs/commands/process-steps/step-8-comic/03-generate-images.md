# comic generate-images

`generate-images` turns reviewed panel prompt bundles into optional black-and-white review sketches and final comic panel images.

See the [`comic` overview](./00-comic-overview.md) for catalogs, runtime paths, and the full walkthrough.

## Outline

- [generate-images](#generate-images)
  - [Options](#options)
  - [Advanced Options](#advanced-options)
  - [Examples](#examples)
  - [Behavior](#behavior)

## generate-images

### Options

| Flag                                   | Description                                                                                                                                    | Default       |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `--target <target>`                    | `images`, `sketches`, or `both`                                                                                                                | `images`      |
| `--panels <all\|range\|list>`          | Panels to process: `all`, a range like `1-8`, a list like `1,3,7`, or mixed like `1-4,9`; overlong contiguous ranges clamp to available panels | `all`         |
| `--concurrency <n>`                    | Number of image requests (across panels, pages, models, and variations) to run in parallel                                                     | `7`           |
| `--concurrency-mode <ramp\|immediate>` | Approach hosted image and QA work from one request per provider/account lane (`ramp`) or start at the configured cap (`immediate`)             | `ramp`        |
| `-f, --force`                          | Regenerate image outputs only; never rewrite reviewed scene or prompt artifacts                                                                | `false`       |
| `--qa` / `--no-qa`                     | Enable or disable strict final-image QA                                                                                                        | enabled       |
| `--qa-model <model>`                   | Vision judge model; QA requires an OpenAI vision-capable LLM                                                                                   | `gpt-5.6-sol` |
| `--max-repairs <n>`                    | Maximum repair attempts after the initial image; repeated failures may restart once or stop early                                              | `2`           |
| `--price`                              | Estimate image-generation costs without making API calls                                                                                       | `false`       |

### Advanced Options

| Flag                               | Description                                                                                                                            | Default                 |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `--image-model <model[,model...]>` | Use one or more supported image models (see [Supported Models](./00-comic-overview.md#supported-models))                               | `gpt-image-2`           |
| `--variation <name[,name...]>`     | Generate final images with one or more prompt variations: `canonical`, `animation-polish`, `cinematic-depth`                           | none                    |
| `--size <size>`                    | Image size: `1536x1024`, `1024x1024`, `1024x1536`, `auto`, or a custom `WIDTHxHEIGHT` size for `gpt-image-2`                           | `1536x1024`             |
| `--quality <quality>`              | `low`, `medium`, `high`, or `auto`; only OpenAI applies it, and other providers use their own defaults                                 | `high`                  |
| `--panels-per-image <n>`           | Number of ordered panels per generated image                                                                                           | final `1`; sketches `6` |
| `--grid <columns>x<rows>`          | Compose generated individual final panels into local page grids, such as `2x3`; requires `--panels-per-image 1` and `--size 1536x1024` | none                    |

### Examples

```bash
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target sketches
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target both
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images --panels 1,3,7
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images --panels 1-16 --panels-per-image 1 --grid 2x3
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target sketches --panels 5-8
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images --image-model gpt-image-2,gemini-3.1-flash-lite-image
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images --variation animation-polish,cinematic-depth
```

### Behavior

- New runs require reviewed scene JSON and panel prompt bundles from `draft-scenes`. `--force` regenerates image outputs only.
- `--panels` applies to `images`, `sketches`, and `both`. Overlong contiguous ranges clamp to the available overlap. Sketch selections must be contiguous; use `--target images` for non-contiguous lists such as `1,3,7`.
- Final images default to one panel per file; review sketches default to six panels per chunk. `--panels-per-image` above 1 writes grouped pages under `pages/` and uses the same QA and repair loop as individual panels.
- Generation includes canonical character, location, and declared design reference images.
- `--grid` generates individual final panel PNGs, then composes them locally into white-backed page grids under `pages/`. `--grid 2x3 --size 1536x1024` writes 3072x3072 page PNGs and leaves trailing cells blank on a partial last page.
- Variation and multi-model runs nest outputs under the scene directory as `panels/<run-id>/<variation>/<model>/`, `pages/<run-id>/<variation>/<model>/`, and `sketches/<run-id>/<model>/`.
- With `--qa` (the default), each image is judged by `--qa-model` and repaired up to `--max-repairs` times. Only passing attempts are promoted.
- `--price` reports estimated initial and maximum repair calls with no provider calls or writes.

Next: [reference-voice](./04-reference-voice.md).
