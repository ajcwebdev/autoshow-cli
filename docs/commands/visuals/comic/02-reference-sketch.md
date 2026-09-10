# comic reference-sketch

`reference-sketch --character` generates a 3-view character outline sheet. `reference-sketch --location` generates one camera view: `establishing` by default, or `--view reverse|side`.

See the [`comic` overview](./00-comic-overview.md) for catalogs, runtime paths, and the full walkthrough.

## Outline

- [reference-sketch](#reference-sketch)
  - [Options](#options)
  - [Advanced Options](#advanced-options)
  - [Examples](#examples)
  - [Behavior](#behavior)
  - [Reviewed location geometry](#reviewed-location-geometry)
  - [Snapshot layout](#snapshot-layout)
  - [Lineage](#lineage)
  - [Price](#price)

## reference-sketch

### Options

| Flag                                   | Description                                                                                    | Default                     |
| -------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------- |
| `--character <key>`                    | Catalog character key (mutually exclusive with `--location`)                                   | required (or `--location`)  |
| `--location <key>`                     | Canonical location key (mutually exclusive with `--character`)                                 | required (or `--character`) |
| `--view <view>`                        | Location camera view: `establishing`, `reverse`, or `side`                                     | `establishing`              |
| `-r, --revise`                         | Revise an existing registered sketch                                                           | `false`                     |
| `--notes <text>`                       | Revision instructions; required with `--revise`                                                | none                        |
| `--concurrency <n>`                    | Number of character sheet views to generate in parallel, and the request cap for location work | `7`                         |
| `--concurrency-mode <ramp\|immediate>` | Ramp from one request (`ramp`) or start at the configured cap (`immediate`)                    | `ramp`                      |
| `--qa` / `--no-qa`                     | Enable or disable location view QA; `--character` runs have no QA stage                        | enabled                     |
| `--max-repairs <n>`                    | Maximum location repair attempts after the initial view                                        | `2`                         |
| `--price`                              | Estimate generation costs without making API calls                                             | `false`                     |

### Advanced Options

| Flag                    | Description                                                                                                  | Default                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| `--image-model <model>` | Use exactly one supported image model (see [Supported Models](./00-comic-overview.md#supported-models))      | `gpt-image-2`                                               |
| `--size <size>`         | Image size: `1536x1024`, `1024x1024`, `1024x1536`, `auto`, or a custom `WIDTHxHEIGHT` size for `gpt-image-2` | `1024x1536` for `--character`; `1536x1024` for `--location` |
| `--quality <quality>`   | `low`, `medium`, `high`, or `auto`; only OpenAI applies it, and other providers use their own defaults       | `medium` for `--character`; `high` for `--location`         |
| `--llm-model <model>`   | Text model for the first establishing location specification                                                 | `gpt-5.6-sol`                                               |
| `--qa-model <model>`    | QA model for location views; QA requires an OpenAI vision-capable LLM                                        | `gpt-5.6-sol`                                               |

### Examples

```bash
bun autoshow comic reference-sketch --character hero
bun autoshow comic reference-sketch --character sidekick --price
bun autoshow comic reference-sketch --character hero --revise --notes "Correct the eye shape"
bun autoshow comic reference-sketch --location cargo-bay
bun autoshow comic reference-sketch --location cargo-bay --view reverse
```

### Behavior

- The first establishing location run uses `--llm-model` to write a location specification from matching scripts. Reverse and side views require that establishing view.
- A registered location view is left unchanged unless `--revise --notes` is supplied, and `--price` reports zero provider calls for that case. Fresh `--character` generation replaces the registered sheet. `--revise` never falls back to fresh generation.
- `--character` writes the three-view sheet only after every view succeeds. Location QA, enabled by default, repairs a view up to `--max-repairs` times and registers only a passing view.
- After updating character or location sketches, rerun `draft-scenes --only panel-prompts` for affected scenes.

### Reviewed location geometry

`input/locations/location-plans.json` is an optional hand-reviewed floor plan per location. It is read by `reference-sketch --location`, by the `draft-scenes` blocking stage, and by the blocking plan validator; an absent file is read as `{ "schemaVersion": 1, "plans": [] }`.

```jsonc
{ "schemaVersion": 1, "plans": [ { "locationKey": "cargo-bay", "reviewStatus": "provisional" | "reviewed", "reviewedBy": string | null, "reviewedAt": string | null, "drawing": { "path": "plans/cargo-bay--floor-plan.png", "sha256": "..." } | null, "roomExtent": { "width": 10, "depth": 14 }, "anchors": [ { "key": "loading door", "position": { "x": 0, "y": 12 }, "footprint": { "width": 4, "depth": 0.3 } | null, "wall": "left" | "right" | "rear" | "front" | "floor" | "ceiling" | null, "facingDeg": number | null, "longAxis": "x" | "y" | null } ], "cameraCells": [ { "id": "door", "position": { "x": 0, "y": 13 }, "heightM": 1.6 } ], "geometrySha256": "..." } ] }
```

- Coordinates are meters in the location frame: the origin is the establishing camera's ground point, `+x` is screen-right in the canonical establishing image, `+y` is depth away from that camera, and `facingDeg` is 0 facing `+y`, 90 facing `+x`, 180 facing `−y`, 270 facing `−x`.
- Every `locationKey` must exist in `locations-reference.json`, and every anchor key must appear in that location's specification as a case-insensitive substring after collapsing whitespace. A camera cell may not sit inside an anchor footprint.
- `geometrySha256` is the SHA-256 of the canonical JSON of the plan entry without that field, so editing geometry never marks a registered view stale; `specificationSha256` in `location-sketches.json` continues to track the specification alone.
- `drawing.path` is resolved under `input/locations/`, must exist, and must match its recorded `sha256`.

When a plan entry exists, a `--view reverse|side` run puts the chosen camera cell (its id, position, height, heading, and aim point) and the projection of every reviewed anchor from that cell into both the image prompt and the view judge, alongside the same anchors as the establishing camera sees them. This stops the model from collapsing an alternate view back onto the establishing axis. When no reviewed cell faces the requested way, one is synthesized from `roomExtent` and labeled as synthesized in the prompt.

### Snapshot layout

`draft-scenes` writes location snapshots at `assets/location-references.json` with `schemaVersion` 3. Every registered view is copied separately, with no image composition and no ImageMagick dependency:

```
assets/
  location-references.json
  location-references/
    <snapshot-id>/
      <location-key>--establishing.png
      <location-key>--reverse.png
```

Each snapshot entry carries `views: [{ view, generationId, imageSha256, path, label }]`. Readers accept `schemaVersion` 2 (a single composed reference sheet) and 3; new snapshots are always written as 3. When a single-panel bundle carries a blocking camera, the view nearest that camera's heading becomes the required location reference for the panel and the establishing view becomes an optional trimmable extra reference that can never displace a required one.

### Lineage

A location view generated from an `existing-canonical-art` establishing view is mixed lineage. Both `--price` and the paid run log `Lineage: establishing view for <key> is existing-canonical-art; a <view> view generated from it is mixed lineage`, and the registered view in `location-sketches.json` records `lineage: "clean" | "mixed"` so catalogs can report it.

### Price

`--price` for `--location` reports the image calls and the judge calls together: one initial image, up to `--max-repairs` additional images, one initial judge call, and up to `--max-repairs` additional judge calls at the `--qa-model` rate, plus the specification aggregation call on the first establishing run. Two images and two judge calls at the registry rates model to roughly 45 cents.

Next: [generate-images](./03-generate-images.md).
