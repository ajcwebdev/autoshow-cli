# comic reference-sketch

Generate a three-view character sheet, or one registered location view. The [Harborlight setup](./00-comic-overview.md#setup) already supplies usable drawings; these are optional hosted replacements.

## Options

Choose exactly one `--character <key>` or `--location <key>` and one image `--provider provider[=model]` (default `openai=gpt-image-2.6-flare`). Character defaults are `1024x1536`, medium quality; location defaults are `1536x1024`, high quality. Size/quality support follows the [image model](../image/overview.md).

`--revise --notes <text>` requires an existing registered asset; it never falls back to fresh generation. `--view establishing|reverse|side` and `--llm-provider` apply only to locations. Defaults: establishing view, text `gpt-6.1-sol`. The retired `--qa`, `--no-qa`, `--qa-provider`, and `--max-repairs` flags are rejected; no reference image is judged. Shared request concurrency defaults to 7 and hosted mode to `ramp`.

## Examples

Use a separate unused reference workspace so the main walkthrough's drawings remain intact:

```bash
bun --no-env-file src/tools/prepare-harborlight-comic.ts --root runtime/examples/harborlight-comic-references
ROOT=runtime/examples/harborlight-comic-references
CAST="$ROOT/characters"
RUN="$ROOT/run"
CONFIG="$ROOT/empty-config.json"
bun --no-env-file autoshow comic reference-sketch --character papa-bear --provider openai=gpt-image-2.6-flare --price --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic reference-sketch --location harborlight-camp --view reverse --provider openai=gpt-image-2.6-flare --price --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

Estimate the accepted calls before removing `--price`. A registered location view is reused at zero provider cost; replacing it requires revision:

```bash
bun --no-env-file autoshow comic reference-sketch --location harborlight-camp --revise --notes "Preserve the fire ring, bench, north path, and two pine trees; keep the campsite empty" --provider openai=gpt-image-2.6-flare --price --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

Inspect replacements before use, then restore the main walkthrough's variables.

## Behavior

- Fresh character generation replaces the registered sheet only after all three views succeed.
- A missing location specification is drafted from matching script sluglines using `--llm-provider`. Reverse/side views require an establishing reference.
- A new or explicitly revised location view is generated once, validated as a readable image, and then registered with its lineage; there is no vision verdict, repair, or regeneration loop. A failed revision leaves the prior view's bytes and metadata in place.
- Generation uses current canonical references directly; reference-only updates need no rebuilt panel prompts.

## Location plans

`location-plans.json` and its `plans/` drawings are no longer read. If the file exists under the locations root, comic commands warn once, naming its path, and continue; the file and drawings are left in place. Camera direction for reverse and side views comes from ordinary view instructions and the location specification.

## Price

`--price` makes no provider calls. A fresh or revised location view costs one base image, plus one drafting call when the specification is missing. Existing compatible location views cost zero unless revised. Character sheets price their normal views and sheet composition.
