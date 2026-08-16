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
| `--qa-model <model>`                   | Vision judge model                                                                                                                             | `gpt-5.6-sol` |
| `--max-repairs <n>`                    | Maximum repair attempts after the initial image; stagnation may restart once or stop early                                                     | `2`           |
| `--price`                              | Estimate image-generation costs without making API calls                                                                                       | `false`       |

### Advanced Options

| Flag                               | Description                                                                                                                            | Default                 |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `--image-model <model[,model...]>` | Use one or more supported image models (see [Supported Models](./00-comic-overview.md#supported-models))                               | `gpt-image-2`           |
| `--variation <name[,name...]>`     | Generate final images with one or more prompt variations: `canonical`, `animation-polish`, `cinematic-depth`                           | none                    |
| `--size <size>`                    | Image size such as `1536x1024`, `1024x1024`, `1024x1536`, or `auto`                                                                    | `1536x1024`             |
| `--quality <quality>`              | `low`, `medium`, `high`, or `auto`; Gemini ignores this compatibility flag                                                             | `high`                  |
| `--panels-per-image <n>`           | Number of ordered panels per generated image; values above one explicitly request grouped generation                                   | final `1`; sketches `6` |
| `--grid <columns>x<rows>`          | Compose generated individual final panels into local page grids, such as `2x3`; requires `--panels-per-image 1` and `--size 1536x1024` | none                    |

### Examples

```bash
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target sketches
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target both
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images --panels 1-16
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images --panels 1,3,7
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images --panels 1-16 --panels-per-image 1 --grid 2x3
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target sketches --panels 5-8
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target sketches --panels-per-image 6 --quality high
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images --image-model gpt-image-2
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images --image-model gpt-image-2,gemini-3.1-flash-lite-image
bun autoshow comic generate-images input/scripts/01-script/01-opening.md --target images --variation animation-polish,cinematic-depth
```

### Behavior

- `generate-images` requires reviewed scene and panel bundles for new runs. `--force` affects images only.
- `--panels` selects which panels to process for any target (`images`, `sketches`, or `both`). Contiguous ranges extending past available panels clamp to the overlap (e.g. `--panels 9-16` on an 11-panel scene processes panels 9–11).
- Review sketch selections must be contiguous because each sketch output corresponds to one panel range; use `--target images` for non-contiguous final panel lists like `1,3,7`.
- Final images default to one panel per image; review sketches default to six panels per chunk. `--panels-per-image >1` enables grouped pages with identical QA and repair behavior.
- Required characters are sent as one canonical image per character ordered by first appearance, followed by distinct canonical location references ordered by first panel appearance. Each location includes its textual specification so generation preserves permanent architecture, fixed furniture, installed equipment, and recurring spatial relationships. Grouped sketches and pages include a prompt legend mapping each sub-panel to its location reference.
- `--grid <columns>x<rows>` generates individual final panel PNGs, then combines them locally into full-size white-backed page grids under `pages/`. For example, `--grid 2x3 --size 1536x1024` writes 3072x3072 page PNGs and leaves trailing cells blank on partial final pages.
- `--variation` outputs are grouped under `pages/<run-id>/<variation>/<model>/` or `panels/<run-id>/<variation>/<model>/` within the scene run directory.
- `--concurrency` sets the hard cap for independent image requests. In default `ramp` mode, each provider/account lane starts at one request and adds one slot every five seconds while demand is queued.
- Multi-model runs write model-specific filenames.
- Before provider dispatch, panel/page/sketch requests are validated against the central registry's reference-image limits. Required character references are never truncated; optional continuity images may be trimmed deterministically.
- Fixed furniture and architecture continuity covers presence and geometry: footprint, silhouette, connectedness, orientation, visible edge structure, and wall relationships survive camera changes.
- Strict QA runs initial generation, vision judgment via `--qa-model`, and up to `--max-repairs` repair attempts. The first repair edits the failed image. If the same hard check persists across two consecutive judgments, the next repair restarts fresh from canonical references instead of chaining edits. Canonical character images and catalog descriptions have highest visual precedence. Set continuity audits canonical anchors as correctly placed, outside crop, missing, relocated, duplicated, mirrored, or redesigned. Harmless typographical substitutions in speech do not fail QA. Attempts and judgments are preserved in attempt QA JSON, and only passing attempts are promoted.
- Named anchor assemblies are audited component by component; a visible desk or console does not excuse omission of its named computer, keyboard, or control unit.
- `--price` makes no provider calls or writes, reporting estimated initial and maximum repair calls.

Next: [reference-voice](./04-reference-voice.md).
