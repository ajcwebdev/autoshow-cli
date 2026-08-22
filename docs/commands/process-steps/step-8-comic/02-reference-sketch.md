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

| Flag                                   | Description                                                                                                                              | Default                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| `--character <key>`                    | Catalog character key (mutually exclusive with `--location`)                                                                             | required (or `--location`)  |
| `--location <key>`                     | Canonical location key (mutually exclusive with `--character`)                                                                           | required (or `--character`) |
| `--view <view>`                        | Location camera view: `establishing`, `reverse`, or `side`                                                                               | `establishing`              |
| `-r, --revise`                         | Revise existing sketches using the source image and existing sketch refs                                                                 | `false`                     |
| `--notes <text>`                       | Revision instructions; required with `--revise`                                                                                          | none                        |
| `--concurrency <n>`                    | Number of character sheet views to generate in parallel, and the hosted request cap for location work                                    | `7`                         |
| `--concurrency-mode <ramp\|immediate>` | Approach hosted LLM, image, and QA work from one request per provider/account lane (`ramp`) or start at the configured cap (`immediate`) | `ramp`                      |
| `--qa` / `--no-qa`                     | Enable or disable strict location view QA; `--character` runs have no QA stage                                                           | enabled                     |
| `--max-repairs <n>`                    | Maximum location repair attempts after the initial view                                                                                  | `2`                         |
| `--price`                              | Estimate generation costs without making API calls                                                                                       | `false`                     |

### Advanced Options

| Flag                    | Description                                                                                                  | Default                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `--image-model <model>` | Use exactly one supported image model (see [Supported Models](./00-comic-overview.md#supported-models))      | `gpt-image-2`                                               |
| `--size <size>`         | Image size: `1536x1024`, `1024x1024`, `1024x1536`, `auto`, or a custom `WIDTHxHEIGHT` size for `gpt-image-2` | `1024x1536` for `--character`; `1536x1024` for `--location` |
| `--quality <quality>`   | `low`, `medium`, `high`, or `auto`; Gemini ignores this compatibility flag                                   | `medium` for `--character`; `high` for `--location`         |
| `--llm-model <model>`   | Text model that aggregates the canonical location specification                                              | `gpt-5.6-sol`                                               |
| `--qa-model <model>`    | Vision judge model for location views; QA requires an OpenAI vision-capable LLM                              | `gpt-5.6-sol`                                               |

### Examples

```bash
bun autoshow comic reference-sketch --character hero
bun autoshow comic reference-sketch --character sidekick --price
bun autoshow comic reference-sketch --character hero --revise --notes "Correct the eye shape"
bun autoshow comic reference-sketch --location cargo-bay
bun autoshow comic reference-sketch --location cargo-bay --view reverse
```

### Behavior

- The first establishing location run reads matching scripts and uses `--llm-model` to capture stable location facts. Reverse and side views require that establishing view.
- An already registered location view no-ops unless `--revise --notes` is supplied. Fresh `--character` generation replaces the registered sheet. `--revise` never falls back to fresh generation.
- For a new prose-defined character, set catalog `image` and `outlineSheet` to the same missing destination, `generationReference` to an existing style image, and optional `generationInstructions`.
- `--character` writes the composed three-view sheet only after every view succeeds. Location views are judged against the canonical specification, existing views, and the style reference, then repaired up to `--max-repairs` times. Only a passing view is registered.
- `--price` estimates specification, image, and repair calls for the selected flags. A validated existing location view reports zero provider calls.
- After updating character or location sketches, rerun `draft-scenes --only panel-prompts` for affected scenes.

Next: [generate-images](./03-generate-images.md).
