# comic reference-sketch

`reference-sketch --character` generates a 3-view character outline sheet. `reference-sketch --location` generates one camera view: `establishing` by default, or `--view reverse|side`.

See the [`comic` overview](./00-comic-overview.md) for catalogs, runtime paths, and the full walkthrough.

## Outline

- [reference-sketch](#reference-sketch)
  - [Options](#options)
  - [Advanced Options](#advanced-options)
  - [Examples](#examples)
  - [Behavior](#behavior)

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

Next: [generate-images](./03-generate-images.md).
