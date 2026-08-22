# comic draft-scenes

`draft-scenes` turns episode script Markdown into structured script JSON, a scene-drafting prompt, scene JSON, and panel prompt bundles.

See the [`comic` overview](./00-comic-overview.md) for catalogs, runtime paths, and the full walkthrough.

## Outline

- [draft-scenes](#draft-scenes)
  - [Options](#options)
  - [Advanced Options](#advanced-options)
  - [Examples](#examples)
  - [Behavior](#behavior)

## draft-scenes

### Options

| Flag                                   | Description                                                                                                                | Default                |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `--only <stage>`                       | Run only `structure`, `prompt`, `scene`, or `panel-prompts`                                                                | none (runs all stages) |
| `--concurrency <n>`                    | Number of panels to build prompt bundles for in parallel during `panel-prompts`, and the hosted request cap for LLM stages | `7`                    |
| `--concurrency-mode <ramp\|immediate>` | Approach hosted LLM work from one request per provider/account lane (`ramp`) or start at the configured cap (`immediate`)  | `ramp`                 |
| `--price`                              | Estimate API-backed stages without making API calls                                                                        | `false`                |

### Advanced Options

| Flag                  | Description                                                                                          | Default                             |
| --------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `--llm-model <model>` | Use a supported text model (see [Supported Models](./00-comic-overview.md#supported-models))          | `gpt-5.6-sol` for the `scene` stage |

### Examples

```bash
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md --only structure
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md --only prompt
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md --only scene
bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md --only panel-prompts
```

### Behavior

- The full run executes `structure`, `prompt`, `scene`, and `panel-prompts` in order.
- `--only structure` parses episode Markdown into structured script JSON locally, and adds an LLM review pass only when `--llm-model` is passed explicitly.
- `--only prompt` builds the scene-drafting prompt bundle without calling an API.
- `--only scene` drafts scene JSON from an existing prompt bundle. Invalid model output is saved as `scene.invalid.json` with validation details.
- `--only panel-prompts` builds stable panel prompt bundles from existing scene JSON without calling an API. Register [character and location references](./02-reference-sketch.md) first.
- Script staging, cast, and dialogue take precedence over inferred shot details. Location layout stays the same unless the script changes the set as a story event.
- On-screen character speakers must be visible; offscreen character speakers must not.

Next: [reference-sketch](./02-reference-sketch.md).
