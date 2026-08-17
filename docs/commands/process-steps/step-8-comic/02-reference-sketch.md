# comic reference-sketch

`reference-sketch --character` manages 3-view character outline sheets. `reference-sketch --location` targets a single camera view: `establishing` by default, or `--view reverse|side`.

See the [`comic` overview](./00-comic-overview.md) for catalogs, runtime paths, and the full walkthrough.

## Outline

- [reference-sketch](#reference-sketch)
  - [Character sheets](#character-sheets)
  - [Options](#options)
  - [Advanced Options](#advanced-options)
  - [Examples](#examples)
  - [Behavior](#behavior)

## reference-sketch

The first establishing location run scans matching scripts and asks the configured text model (`gpt-5.6-sol` by default) for stable location facts; reverse and side require an existing establishing view. Successful views are promoted and atomically registered. Existing targets no-op unless `--revise --notes` is supplied.

Location `--price` preflight estimates initial and repair calls matching generation flags. Validated existing views report zero provider calls.

### Character sheets

`reference-sketch --character` generates an immutable three-view version and automatically composes its reference sheet.

For a new prose-defined character with no source image, set `image` and `outlineSheet` to the same missing canonical destination, point `generationReference` at an existing style image under the character root, and provide rendering rules in `generationInstructions`.

### Options

| Flag                                   | Description                                                                                                                              | Default                     |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `--character <key>`                    | Catalog character key (mutually exclusive with `--location`)                                                                             | required (or `--location`)  |
| `--location <key>`                     | Canonical location key (mutually exclusive with `--character`)                                                                           | required (or `--character`) |
| `--view <view>`                        | Location camera view: `establishing`, `reverse`, or `side`                                                                               | `establishing`              |
| `-r, --revise`                         | Revise existing sketches using the source image and existing sketch refs                                                                 | `false`                     |
| `--notes <text>`                       | Revision instructions; required with `--revise`                                                                                          | none                        |
| `--concurrency <n>`                    | Number of sketch views to generate in parallel                                                                                           | `7`                         |
| `--concurrency-mode <ramp\|immediate>` | Approach hosted LLM, image, and QA work from one request per provider/account lane (`ramp`) or start at the configured cap (`immediate`) | `ramp`                      |
| `--price`                              | Estimate image-generation costs without making API calls                                                                                 | `false`                     |

### Advanced Options

| Flag                    | Description                                                                       | Default       |
| ----------------------- | --------------------------------------------------------------------------------- | ------------- |
| `--image-model <model>` | Use exactly one supported image model (see [Supported Models](./00-comic-overview.md#supported-models)) | `gpt-image-2` |
| `--size <size>`         | Image size such as `1024x1536`, `1024x1024`, `1536x1024`, or `auto`               | `1024x1536`   |
| `--quality <quality>`   | `low`, `medium`, `high`, or `auto`; Gemini ignores this compatibility flag        | `medium`      |

### Examples

```bash
bun autoshow comic reference-sketch --character hero
bun autoshow comic reference-sketch --character sidekick --price
bun autoshow comic reference-sketch --character hero --revise --notes "Correct the eye shape"
bun autoshow comic reference-sketch --location cargo-bay
bun autoshow comic reference-sketch --location cargo-bay --view reverse
```

### Behavior

- The three generated views and composed sheet remain in temporary storage until all views succeed; only the flat catalog `outlineSheet` is persisted.
- Fresh generation replaces the registered reference by default. Revision never falls back to fresh generation.
- The sheet and its entry in `character-sketches.json` are promoted together with rollback protection. Source and sheet SHA-256 checksums detect stale or tampered registrations.
- Default generation parameters are `gpt-image-2`, `1024x1536`, `medium`.
- After updating character sketch references, rerun `draft-scenes --only panel-prompts` for affected scenes to stage the new references.

Next: [generate-images](./03-generate-images.md).
