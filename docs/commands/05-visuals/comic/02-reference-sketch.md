# comic reference-sketch

Generate a three-view character sheet, or one registered location view. The [Harborlight setup](./00-comic-overview.md#setup) already supplies usable drawings; these are optional hosted replacements.

## Options

Choose exactly one `--character <key>` or `--location <key>` and one image `--provider provider[=model]` (default `openai=gpt-image-2.5-flare`). Character defaults are `1024x1536`, medium quality; location defaults are `1536x1024`, high quality. Size/quality support follows the [image model](../image/overview.md).

`--revise --notes <text>` requires an existing registered asset; it never falls back to fresh generation. `--view establishing|reverse|side`, `--llm-provider`, `--qa`/`--no-qa`, `--qa-provider`, and `--max-repairs` apply only to locations. Defaults: establishing view, text/QA `gpt-6.1-sol`, QA enabled, two repairs. Shared request concurrency defaults to 7 and hosted mode to `ramp`.

## Examples

Use a separate unused reference workspace so the main walkthrough's drawings remain intact:

```bash
bun --no-env-file src/tools/prepare-harborlight-comic.ts --root runtime/examples/harborlight-comic-references
ROOT=runtime/examples/harborlight-comic-references
CAST="$ROOT/characters"
RUN="$ROOT/run"
CONFIG="$ROOT/empty-config.json"
bun --no-env-file autoshow comic reference-sketch --character papa-bear --provider openai=gpt-image-2.5-flare --price --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic reference-sketch --location harborlight-camp --view reverse --provider openai=gpt-image-2.5-flare --price --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

Estimate the accepted calls with QA/retries before removing `--price`. A registered location view is reused at zero provider cost; replacing it requires revision:

```bash
bun --no-env-file autoshow comic reference-sketch --location harborlight-camp --revise --notes "Preserve the fire ring, bench, north path, and two pine trees; keep the campsite empty" --provider openai=gpt-image-2.5-flare --price --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

Inspect replacements before use, then restore the main walkthrough's variables.

## Behavior

- Fresh character generation replaces the registered sheet only after all three views succeed; character work has no QA stage.
- A missing location specification is drafted from matching script sluglines using `--llm-provider`. Reverse/side views require an establishing reference. With QA enabled, only a passing view is registered.
- Generation and QA use current canonical references directly; reference-only updates need no rebuilt panel prompts.

## Location plans

Optional `location-plans.json` under the locations root stores floor plans; drawings live under `plans/`. Coordinates are meters, with origin at the establishing camera's ground point, `+x` screen-right, and `+y` depth. Blocking, reverse/side prompts, and location QA use this geometry. A missing facing camera cell does not block reference generation; plan edits do not replace already registered views.

## Price

`--price` makes no provider calls. Location estimates include the initial image, enabled QA, and up to `--max-repairs` image/judge pairs; `--no-qa` removes repairs and judging. A missing specification adds its drafting call. Existing compatible location views cost zero unless revised.
