# comic reference-sketch

`reference-sketch --character` generates a 3-view character outline sheet. `reference-sketch --location` generates one camera view: `establishing` by default, or `--view reverse|side`.

See the [`comic` overview](./00-comic-overview.md) for catalogs, runtime paths, and the full walkthrough.

`--view`, `--llm-provider`, `--qa`, `--no-qa`, `--qa-provider`, and `--max-repairs` require `--location`. `--qa-only` is rejected for both reference kinds; use `comic generate-images --qa-only` for existing panel audits.

## Outline

- [reference-sketch](#reference-sketch)
  - [Options](#options)
  - [Advanced Options](#advanced-options)
  - [Examples](#examples)
  - [Behavior](#behavior)
  - [Location plans](#location-plans)
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
| `--provider-concurrency <n>`           | Number of character sheet views to generate in parallel, and the request cap for location work | `7`                         |
| `--concurrency-mode <ramp\|immediate>` | Ramp from one request (`ramp`) or start at the configured cap (`immediate`)                    | `ramp`                      |
| `--qa` / `--no-qa`                     | Enable or disable location view QA; `--character` runs have no QA stage                        | enabled                     |
| `--max-repairs <n>`                    | Maximum location repair attempts after the initial view                                        | `2`                         |
| `--price`                              | Estimate generation costs without making API calls                                             | `false`                     |

### Advanced Options

| Flag                               | Description                                                                                                                                       | Default                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `--provider <provider[=model]>`    | Use exactly one supported image model (see [Supported Models](./00-comic-overview.md#supported-models))                                           | `gpt-image-2`                                               |
| `--size <size>`                    | Image size: `1536x1024`, `1024x1024`, `1024x1536`, `auto`, or a custom `WIDTHxHEIGHT` size for `gpt-image-2` or GPT Image 2.5 (Flare/Sunburst)    | `1024x1536` for `--character`; `1536x1024` for `--location` |
| `--quality <quality>`              | `low`, `medium`, `high`, or `auto`; Image 2.5 also supports `xhigh` and `max`. Only OpenAI applies it, and other providers use their own defaults | `medium` for `--character`; `high` for `--location`         |
| `--provider <provider[=model]>`    | Text model for the first establishing location specification                                                                                      | `gpt-5.6-sol`                                               |
| `--qa-provider <provider[=model]>` | QA model for location views; QA requires an OpenAI or Gemini vision-capable LLM                                                                   | `gpt-5.6-sol`                                               |

### Examples

```bash
bun autoshow comic reference-sketch --character hero
bun autoshow comic reference-sketch --character sidekick --price
bun autoshow comic reference-sketch --character hero --revise --notes "Correct the eye shape"
bun autoshow comic reference-sketch --location cargo-bay
bun autoshow comic reference-sketch --location cargo-bay --view reverse
```

### Behavior

- The first establishing location run uses `--llm-provider` to write a location specification from episode scripts whose slugline matches the location key. Reverse and side views require that establishing view.
- A registered location view is left unchanged unless `--revise --notes` is supplied, and `--price` reports zero provider calls for that case. Fresh `--character` generation replaces the registered sheet. `--revise` never falls back to fresh generation.
- `--character` writes the three-view sheet only after every view succeeds. Location QA, enabled by default, repairs a view up to `--max-repairs` times and registers only a passing view.
- After updating character or location sketches, rerun `draft-scenes --only panel-prompts` for affected scenes.

### Location plans

`input/locations/location-plans.json` is an optional floor plan per location. `reference-sketch --location` and the `draft-scenes` blocking stage read it.

Coordinates are meters. The origin is the establishing camera's ground point, `+x` is screen-right in the establishing image, and `+y` is depth into the room. Each plan names a catalog location, the room size, fixed anchors from that location's specification, and optional camera cells. An optional drawing lives under `input/locations/plans/`.

When a plan exists, `--view reverse` or `--view side` uses a camera cell that faces that way, or infers one from the room size if none does. Editing a plan does not require regenerating registered views.

### Price

`--price` for `--location` reports image and judge calls together: one initial image, up to `--max-repairs` additional images, one initial judge call, and up to `--max-repairs` additional judge calls at the `--qa-provider` rate, plus the specification aggregation call on the first establishing run.

Next: [generate-images](./03-generate-images.md).
