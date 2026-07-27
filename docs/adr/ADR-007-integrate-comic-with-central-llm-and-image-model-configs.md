# ADR-007: Integrate the Comic Command with the Central LLM and Image Model Configs

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-17
- **Date Updated:** 2026-07-23
- **Verification Status:** Passed

## Context

The comic command (`src/cli/commands/process-steps/step-8-comic/`) generates two kinds of model output: **text** (structured scene scripts and panel prompts) and **images** (panels, pages, sketches, and composed grids). It does both through a model system it maintains entirely on its own, parallel to — and far smaller than — the one the rest of the project already uses.

Comic's private model system consists of:

- **A duplicated registry.** `step-8-comic/comic-models/` (`openai-models.ts`, `gemini-models.ts`, `grok-models.ts`, `model-registry.ts`) hardcodes the model id arrays *and* their pricing tables. `LLM_MODELS` is `[...OPENAI_LLM_MODELS, ...GEMINI_LLM_MODELS, ...GROK_LLM_MODELS]` and `IMAGE_MODELS` is `[...OPENAI_IMAGE_MODELS, ...GEMINI_IMAGE_MODELS]`, with `DEFAULT_LLM_MODEL = 'gpt-5.5'` and `DEFAULT_IMAGE_MODEL = 'gpt-image-2'`. In total comic supports **3 LLM providers** (OpenAI, Gemini, Grok ≈ 6 models) and **2 image providers** (OpenAI, Gemini ≈ 2 models).
- **Exhaustive, non-extensible dispatch.** Provider routing is a chain of type-guard `if`/`else` branches that throw on any unrecognized model: `comic-utils/structured-script-utils/llm-review.ts` (`createStructuredScriptReviewOpenAI` / `…Gemini` / `…Grok` behind `isOpenAiLlmModel` / `isGeminiLlmModel` / `isGrokLlmModel`), `comic-commands/draft-scenes/generate-scene-json.ts` (`createSceneResponseOpenAI` / `…Gemini` / `…Grok`), and `comic-image-services/comic-image-targets.ts` (`getImageRequestTarget` → `createImageWithRunners`). Adding a provider means editing every chain.
- **Private clients.** `comic-utils/comic-openai-client.ts`, `comic-utils/gemini-client.ts`, and `comic-utils/grok-client.ts` each re-implement API-key reading and base-URL resolution that the central provider clients already perform.
- **Types derived from the hardcoded arrays.** `src/types/comic-workflow/comic-types.ts` defines `LlmModel` and `ImageGenerationModel` as `typeof` the comic-local arrays, so the type surface is bound to comic's private model lists.

Meanwhile, the project already maintains a central, runtime-loaded model configuration that steps 3 (write) and 5 (image) consume:

- `getModelRegistry()` (`src/cli/commands/setup-and-utilities/models/model-loader/registry.ts`), backed by `llm-config.json` and `image-config.json`, is the single source of truth for available models plus their pricing and cost-estimation metadata.
- `collectLlmTargets(options: LLMOptions): LLMTarget[]` (`src/cli/commands/process-steps/step-3-write/run-llm.ts`) builds dispatch targets for **12 LLM providers** (OpenAI, Groq, Gemini, Anthropic, MiniMax, Grok, GLM, Kimi, Together, Cerebras, llama.cpp, Llamafile), each carrying a `.run()` closure.
- `runLlmTargetsForStructuredPrompt(...)` (same file) already performs per-provider structured-JSON output, schema validation, and retry/fallback — the exact behavior comic re-implements per provider for its scene scripts.
- `collectImageTargets(options: ImageGenOptions): ImageTarget[]` (`src/cli/commands/process-steps/step-5-image/image-generation-targets/image-target-collect.ts`) builds dispatch targets for **8 image providers** (Gemini, OpenAI, Grok, BFL, Reve, Recraft, Replicate, Lumalabs), with reference-image (`imageInputs`) and mask (`imageMask`) support.

Comic therefore reaches a small, hand-maintained subset of the project's model catalog and duplicates the registry, dispatch, structured-output handling, and client plumbing that already exist a few directories away.

Why now: the `todo/comic.md` item asks to "extract the limited LLM and image generation logic in `comic` and integrate the `llm` and `image` model configs so any available model in the project can be used to generate text or images." Every model added to the central registry today silently bypasses comic, and comic's pricing tables drift from the central ones as provider prices change. Deciding the integration direction now, before comic's private registry grows further, bounds the migration and stops the drift.

## Options Considered

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **Integrate the central registry; reuse `collectLlmTargets` / `collectImageTargets` / `runLlmTargetsForStructuredPrompt`; delete `comic-models/` and the comic clients; keep `--llm-model` / `--image-model` resolving ids against the central registry (Recommended)** | Single source of truth for models and pricing; any project model usable in comic at no extra cost; replaces three `if`/`else` chains with the shared extensible dispatch; reuses the central structured-output + reference-image handling comic re-implements | Comic must map its structured-script, reference-image, and size/quality needs onto the central `LLMOptions` / `ImageGenOptions` shape; couples comic to shared infra changes; one coordinated retype of `comic-types.ts` | Unlocks **12 LLM** + **8 image** providers (from 3 + 2); removes the `comic-models/` directory (4 files) and 3 private clients |
| Extend comic's own `comic-models/` registry to add more providers by hand | No dependency on shared infra; keeps comic self-contained | Perpetuates the duplication; pricing tables keep drifting; every new provider re-edits three dispatch chains | Re-implements work already done 12×/8× centrally |
| Reuse only the central pricing/registry data, keep comic's `if`/`else` dispatch | Smaller diff; removes pricing drift | Half-measure: leaves the non-extensible dispatch and private clients in place; still capped at the providers comic hardcodes | n/a |
| Do nothing | Zero edit risk | Comic stays capped at 3 LLM / 2 image providers and keeps drifting from the central registry | 0 change |

## Decision

Comic adopts the project's central LLM and image model configuration as its single source of truth. Comic resolves model ids against `getModelRegistry()` and routes generation through the shared `collectLlmTargets`, `runLlmTargetsForStructuredPrompt`, and `collectImageTargets` rather than its own registry and dispatch. Comic's private model arrays, pricing tables, `if`/`else` provider dispatch, and private clients are removed.

The `--llm-model` and `--image-model` flags are **kept** as comic's selection interface (comma-separated ids for multi-model runs), but each id is now validated and resolved against the central registry and mapped onto the shared `LLMOptions` / `ImageGenOptions` shape rather than comic's local model sets.

This applies to:

- Text generation in `step-8-comic`: structured-script review (`llm-review.ts`) and scene JSON drafting (`generate-scene-json.ts`).
- Image generation in `step-8-comic`: panel, page, sketch, and grid image creation routed through `comic-image-services/comic-image-targets.ts`.
- The comic model registry (`comic-models/`), the comic provider clients (`comic-utils/*-client.ts`), and the comic model types in `src/types/comic-workflow/`.

It explicitly does **not** cover:

- Comic's prompt construction, JSON schemas, scene/panel workflow, or on-disk output layout — these are unchanged.
- The names of the `--llm-model` / `--image-model` flags — the user-facing selection interface is preserved.
- The central registry's own content or the write/image steps that already consume it.

## Rationale

- One source of truth. `getModelRegistry()` already defines every model and its pricing for the write and image steps; routing comic through it removes the duplicate `comic-models/` tables and the pricing drift between them.
- Breadth for free. Reusing `collectLlmTargets` and `collectImageTargets` immediately makes every centrally-registered provider (12 LLM, 8 image) available to comic without per-provider comic code.
- Extensible dispatch. The shared collectors replace comic's three exhaustive `if`/`else` chains, so a new provider added centrally reaches comic with no comic edits.
- Comic's specialized needs are already covered centrally. `runLlmTargetsForStructuredPrompt` performs the structured-JSON output, schema validation, and retry/fallback that comic re-implements per provider; `collectImageTargets` already carries reference images (`imageInputs`) and masks (`imageMask`) that comic's panel generation relies on.
- Less plumbing. The comic clients (`comic-openai-client.ts`, `gemini-client.ts`, `grok-client.ts`) duplicate API-key/base-URL handling the central clients already do, consistent with the env-var surface reduction in [ADR-005](ADR-005-reduce-environment-variable-surface-area.md).

## Consequences

Positive outcomes:

- Comic can generate text and images with any centrally-registered model — 12 LLM and 8 image providers instead of 3 and 2.
- Model pricing and cost estimation come from one place; comic's tables can no longer drift from the central registry.
- Net code reduction: the `comic-models/` directory, three `if`/`else` dispatch chains, and three private clients are removed in favor of shared collectors.

Negative outcomes:

- Comic must adapt its structured-script, reference-image, and size/quality requirements onto the central `LLMOptions` / `ImageGenOptions` shape, which is a one-time mapping effort.
- Comic becomes coupled to the shared collectors and registry; future changes there can affect comic and require comic-side regression checks.
- The type migration in `src/types/comic-workflow/comic-types.ts` is a single coordinated change touching every importer of `LlmModel` / `ImageGenerationModel`.

## Trade-offs

| Gains | Sacrifices |
|---|---|
| Single source of truth for models and pricing | Comic now depends on the shared registry and collectors |
| 12 LLM / 8 image providers available with no comic-specific code | One-time effort to map comic's needs onto `LLMOptions` / `ImageGenOptions` |
| Extensible shared dispatch replaces three `if`/`else` chains | Shared-infra changes can ripple into comic |
| Removes duplicate registry, clients, and structured-output handling | Coordinated retype of `comic-types.ts` and its importers |

## API / Type Impact

- `src/types/comic-workflow/comic-types.ts`: `LlmModel` and `ImageGenerationModel` stop being `typeof` the comic-local model arrays and become the registry-derived model id types (the same ids `getModelRegistry()` exposes). The per-provider unions (`OpenAiLlmModel`, `GeminiLlmModel`, `GrokLlmModel`, `OpenAiImageGenerationModel`, `GeminiImageGenerationModel`) and the comic image-request-target / `ImageServiceRunners` types are removed in favor of the shared `LLMTarget` and `ImageTarget`.
- The comic-local guards `isOpenAiLlmModel` / `isGeminiLlmModel` / `isGrokLlmModel` / `isOpenAiImageModel` / `isGeminiImageModel` (`comic-models/model-registry.ts`) are removed; callers move to registry resolution instead of provider type-guards.

## Implementation Note

| Action | Owner | Current State |
|---|---|---|
| Resolve `--llm-model` / `--image-model` ids against `getModelRegistry()` and build `LLMOptions` / `ImageGenOptions` for comic | Comic maintainers | Done — `findRegistryServiceForModel` resolution in `comic-utils/cli-args.ts`, `comic-utils/image-service.ts`, and the structured-LLM / image adapters |
| Replace the dispatch in `comic-utils/structured-script-utils/llm-review.ts` and `comic-commands/draft-scenes/generate-scene-json.ts` with `collectLlmTargets` + `runLlmTargetsForStructuredPrompt` | Comic maintainers | Done — both route through `comic-utils/structured-script-utils/run-structured-llm.ts` |
| Replace `comic-image-services/comic-image-targets.ts` dispatch with `collectImageTargets`, preserving reference-image and size/quality handling | Comic maintainers | Done — `createImage` builds per-provider `ImageGenOptions` and runs a single `collectImageTargets` target |
| Delete `comic-models/` and `comic-utils/comic-openai-client.ts` / `gemini-client.ts` / `grok-client.ts` | Comic maintainers | Done — directory and clients removed (`grok-client.ts` was already removed in the LLM phase) |
| Retype `src/types/comic-workflow/comic-types.ts` against the central registry and update importers | Comic maintainers | Done — `LlmModel` / `ImageGenerationModel` are registry-id strings; comic-local unions, `ImageServiceRunners`, `ImageUsage`, and `openai-image-service-types.ts` removed |
| Update model validation in `comic-utils/cli-args.ts` to validate against the central registry | Comic maintainers | Done — image ids validate via `findRegistryServiceForModel('image', …)` |
| Update `docs/commands/process-steps/step-8-comic/comic.md` "Supported Models" to reference the central registry instead of the comic-local lists | Comic maintainers | Done — both text and image sections reference the central registries |
| Run `bun run check` after the migration to confirm no broken types or imports | Comic maintainers | Done — `bun run check` passes; comic + affected provider tests pass |

## References

- Related ADR: [ADR-003](ADR-003-type-surface-cleanup-and-architecture-mirroring.md) — precedent for mirroring an architecture that already exists rather than maintaining a parallel one
- Related ADR: [ADR-005](ADR-005-reduce-environment-variable-surface-area.md) — env-var surface reduction; comic's private clients duplicate the key/base-URL handling it removes
- Central model config: `src/cli/commands/setup-and-utilities/models/model-loader/registry.ts` (`getModelRegistry()`), `llm-config.json`, `image-config.json`
- Reusable LLM dispatch: `src/cli/commands/process-steps/step-3-write/run-llm.ts` (`collectLlmTargets`, `runLlmTargetsForStructuredPrompt`)
- Reusable image dispatch: `src/cli/commands/process-steps/step-5-image/image-generation-targets/image-target-collect.ts` (`collectImageTargets`)
- Comic logic to be replaced: `src/cli/commands/process-steps/step-8-comic/comic-models/model-registry.ts`, `src/cli/commands/process-steps/step-8-comic/comic-utils/structured-script-utils/llm-review.ts`, `src/cli/commands/process-steps/step-8-comic/comic-commands/draft-scenes/generate-scene-json.ts`, `src/cli/commands/process-steps/step-8-comic/comic-image-services/comic-image-targets.ts`
- Comic model types: `src/types/comic-workflow/comic-types.ts`
- Task source: `todo/comic.md`
- Verification rule: `bun run check`
