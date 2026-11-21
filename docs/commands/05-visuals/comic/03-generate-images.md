# comic generate-images

Generate review sketches and final images from reviewed scene JSON, current registered references, and complete panel prompt bundles. Use [Harborlight setup](./00-comic-overview.md#setup) variables and estimate the [related batch](./00-comic-overview.md#cumulative-estimate) before dispatch.

## Options

- `--target images|sketches|both`: default `images`; `both` replaces separate sketch/image invocations.
- `--panels all|range|list`: default `all`; mixed lists such as `1-4,9` work for final images. Sketch selections must be contiguous; overlong ranges clamp.
- `--provider provider[=model]`: one image model per run, default `openai=gpt-image-2.6-flare`. A provider without a model uses that provider's default. Repeating `--provider`, even with the same value, fails before pricing, artifacts, or dispatch; run each model as a separate invocation. `--size` defaults to `1536x1024`, quality to `high`; [model capabilities](../image/overview.md) govern other values.
- `--panels-per-image N`: final default 1, sketch default 6. Values above 1 ask the provider for grouped pages under `pages/<run-id>/`.
- `--grid CxR` locally composes individual final panels into page grids and requires `--panels-per-image 1` and size `1536x1024`. Each panel fits inside its cell at its original aspect ratio, centered with white padding where needed.
- `--provider-concurrency`: default 7 across the run's panels or pages; hosted `--concurrency-mode` defaults to `ramp`.
- `--force`: generate new image candidates even when outputs exist, preserving reviewed scene/prompts and the current selection. `--stop-on-provider-error` stops new work after the first provider error while retaining written attempts.
- `--price`: estimate without provider calls; missing prerequisites can leave the quote incomplete.

## Retired flags

These are rejected before pricing or dispatch: `--variation`, `--credit-preflight`, `--qa`, `--no-qa`, `--qa-provider`, `--max-repairs`, `--qa-only`, `--continuity-qa`, `--continuity-only`, `--labels`, `--trusted-anchor-panel`, `--bloopers`, `--revision-plan`, `--comparison-passes`, `--promote`, `--blocking-hard-keys`, and `--blocking-layout-guide`. Generation makes no judge, comparison, or quality-driven repair calls, and every panel or page uses the one base prompt. Authentication, quota, and rate-limit errors are reported from the actual image requests.

## Examples

After completing local panel prompts, choose the accepted generation mode:

```bash
bun --no-env-file autoshow comic generate-images "$SCRIPT" --target both --provider openai=gpt-image-2.6-flare --price --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic generate-images "$SCRIPT" --target images --panels 1,3 --provider openai=gpt-image-2.6-flare --price --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic generate-images "$SCRIPT" --panels-per-image 2 --provider openai=gpt-image-2.6-flare --price --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
bun --no-env-file autoshow comic generate-images "$SCRIPT" --grid 2x2 --panels-per-image 1 --provider openai=gpt-image-2.6-flare --price --characters-root "$CAST" --output-dir "$RUN" --config-path "$CONFIG"
```

For four panels, `--panels-per-image 2` makes two hosted page requests. `--grid 2x2` makes four individual panel requests and composes one page locally with zero additional provider calls.

## Outputs and selection

Each invocation gets its own run ID. Generated candidates use run-specific directories.

```text
panels/<run-id>/panel-03.png                 # individual final panel candidate
pages/<run-id>/page-01-panels-01-02.png      # provider-generated grouped page or local grid
sketches/<run-id>/panels-01-04.png           # review sketch
panels/panel-03.png                          # selected panel read by review and slideshow
```

As each individual final panel succeeds, it is verified and published to its empty canonical slot `panels/panel-NN.png`, recording the run, model, candidate path, and hash. The run reports each outcome ("Panel 3 selected" or "New version of panel 3 saved. Current selection preserved.") and prints a run-specific preview command when candidates are available. When every requested panel is already selected, the command reports reuse and points to plain `comic review`. A successful subset of an interrupted run is immediately usable. An existing selection, including a canonical panel from an older run with no recorded origin, is never replaced by generation, even with `--force`; adopt a candidate explicitly with [`review --run <image-run-id> --use`](./06-review.md). Only individual final panels fill slots, including panels generated as grid input; sketches, grouped pages, and grids stay separate outputs.

Final panels and provider-generated pages must decode as PNGs before publication. If a staged PNG fails verification, the error identifies the saved `.rejected` file. When reusing a panel, the command checks its bytes against any recorded checksum. Restore the recorded image before retrying a checksum failure.

## Price

Price counts base images only: missing outputs for the selected model and run, grouped by the actual `--panels-per-image` layout. Compatible existing outputs are reused at zero cost, local grid composition adds zero provider calls, and nothing is selected in price mode.

## Recovery and older runs

Recorded interrupted generation uses [`resume`](../../00-setup-and-utilities/resume.md#comic-recovery), which reuses completed images and finishes an interrupted first selection from its verified candidate without buying another image. Missing exact recovery intent blocks older runs.

The CLI summary counts work performed in the current invocation. The manifest's image provider usage includes estimated cost and reported units across attempts of the same run.

Older runs stay readable in place. Multi-model runs keep their `<run-id>/<model>/` directories, and runs made with `--variation` keep `<run-id>/<variation>/<model>/`. Retained QA reports, attempt images, labels, revision ledgers, and blooper copies are left untouched and ignored; a missing or failed verdict never blocks a retained image or triggers new work. For an unfinished multi-model or variation intent, resume identifies the completed candidates and requires an explicit new single-model selection for outstanding work, rather than picking a model or regenerating a finished image.
