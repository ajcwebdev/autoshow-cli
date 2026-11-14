# Testing

Default verification is `bun run check`, `bun t --price`, and targeted local behavioral tests. Full-suite execution requires explicit authorization, including fixture mode. Paid batches follow [repository spending rules](../../AGENTS.md): known cumulative totals below $1 USD are authorized within the task; unknown totals or $1 and above need command/cost-specific approval. Include minimum billing, add-ons, and billable retries.

`bun t` loads `.env` and forwards configured hosted credentials. `bun t:local <paths>` forwards none and skips live service tests, but fixture mode does not block network downloads or tool installation. Normal `bun autoshow` commands load `.env`.

## Local Quick Start

No-provider CLI smoke checks:

```bash
bun test test/test-cases/validation/cli/cli-help-contracts.test.ts
bun test test/test-cases/validation/cli/cli-usage-errors/
bun test test/test-cases/validation/cli/option-resolution-contracts/
```

Select local extraction/rendering tests only when their tools, models, and fixtures are installed:

```bash
bun t:local test/test-cases/e2e/local/sources/download/download-input-types-local-file.test.ts
```

Types and price preflight do not replace functional verification. Distinguish transport, decoded integrity, spoken/text correctness, and perceptual quality; mocks do not prove the latter two.

## Service Quick Start

After estimating and authorizing the selected batch, export its required credentials:

```bash
AUTOSHOW_TEST_CREDENTIAL_KEYS='["OPENAI_API_KEY"]' \
  bun --no-env-file run t:provider --budget 50 test/test-cases/e2e/service/audio/tts/
```

`t:provider` uses exported credentials without loading `.env`. Its optional JSON credential-name list restricts forwarding; missing/unlisted credentials skip their tests. Direct `bun test` does not authorize hosted calls: budgeted live tests fail closed without runner evidence. Network download tests need no hosted AI credentials but are not offline.

## Command Test Pages

- [Download](01-sources/download/tests.md)
- [STT](02-extract/stt/tests.md)
- [OCR](02-extract/ocr/tests.md)
- [URL](02-extract/url/tests.md)
- [Write](03-write/tests.md)
- [TTS](04-audio/tts/tests.md)
- [Image](05-visuals/image/tests.md)
- [Video](05-visuals/video/tests.md)
- [Music](04-audio/music/tests.md)

## Shared Runner Behavior

Select file/directory paths under `test/test-cases/`. Bun filters such as `--grep`, `--changed`, `--only-failures`, and `--path-ignore-patterns` pass through after path resolution. Sharding requires a curated selection already known to be local and free; timing balance does not classify provider cost.

### Output and concurrency

- Per-test console output is discarded on success and attached on failure; hooks/direct stream writes remain outside capture.
- `bun t` shows a failure-first digest, skips, slow tests, and calibration recommendations. It reports progress after 10 quiet seconds. Full output stays in `runner.log`; `--verbose` streams it. Cost/timing recommendations exclude local-engine timing and do not establish media quality or [word-timing accuracy](02-extract/stt/workflows/timing/overview.md).
- `--max-concurrency` controls per-file concurrency; `--parallel` controls isolated file workers. Both default to available logical CPUs, except E2E-only file parallelism defaults to 32. Override with `=N`; `--concurrency` and `--retry` are rejected. Tests are not automatically repeated.
- `--no-isolate` is a temporary isolation/preload diagnostic escape hatch. `--no-adaptive-concurrency` disables adaptive provider lanes. Interruptions terminate local descendants.

### Artifacts and cleanup

Runs write under `output/test-output/YYYY-MM-DD_HH-MM-SS_test-run/`. Successful test runs remove their current directory only without protected TTS/audio evidence; price runs retain theirs. Failed/interrupted runs and earlier runs remain. `--no-cleanup` preserves the current run; explicit `--cleanup` additionally prunes only earlier confirmed-successful runner artifacts. Active, failed, interrupted, legacy, unknown, and TTS/audio artifacts stay. The last cleanup flag wins.

Root summaries and `.test-cache/` survive cleanup. `latest.log` retains diagnostics, and test-mode runs regenerate `latest-model-calibration.json` from retained metadata. Validation-only runs can produce no model recommendations.

Preserve interrupted TTS directories and temporary audio. Before `--allow-ambiguous-redispatch`, reconcile retained evidence and estimate possible duplicate billing: cached completed audio is reused, but missing audio may already have been purchased.

### Pricing and budgets

`--price` runs mapped estimate commands, never tests. With no paths it selects all mappings. Credential skips and Bun passthrough filters such as `--grep` do not narrow this map; most validation paths have no mappings and report zero estimated cost. Price children receive no provider credentials and disable `.env` loading.

`--budget` is a per-test-key filter in whole-number hundredths of a cent: `--budget 100` means 1 cent. It is neither an aggregate cap nor spending authorization. Without it, live tests have no price filter; with it, unmapped/unevaluated hosted tests fail locally. It can skip every selected test. Local engine tests need no hosted price evidence but still honor skip keys.

## No-Cost CI Gate

`bun run check` runs structure, names, native TypeScript, and documentation checks without `.env`. `bun run check:types:tsc` cross-checks with the reference compiler.

### Documentation examples

`bun run check:docs` parses concrete `bun autoshow`/`bun as` examples in `README.md`, `docs/docker.md`, and `docs/commands/`, including continuations. It checks commands, flags, and explicit provider/model selectors; it excludes templates/shell expressions and never executes handlers, reads example inputs, or calls providers.

The verification job on PRs and pushes to `main` runs repository checks and price preflight, plus selected local contracts when the diff can affect them. Benchmark/report/todo/diagram-only changes and root Markdown other than README skip that contract step; unknown diff bases run it. This job supplies no provider credentials and runs neither the full suite nor provider-backed commands.

For retained timings, use `bun src/tools/ci-run-timings.ts price <metrics.ndjson>` or `run <run-id>`; `--json-file` reads a saved run payload.

## Package Review

The package-hygiene job audits/deduplicates dependencies, cross-checks types, records production licenses, and retains dry-run cleanup reviews. Package-manager commands may load `.env` despite `--no-env-file`; use clean CI or a checkout without that file.

For dependency or lockfile changes:

1. Run `bun pm diff <package>` for changed direct packages and retain the review.
2. Inspect the complete `bun.lock` diff, including transitive movement, sources, scripts, native addons, patches, overrides, catalogs, workspaces, and non-registry resolutions.
3. Run `bun install --frozen-lockfile`, `bun audit`, `bun dedupe --check`, and `bun pm licenses --prod --json`, then default verification.
4. Use `bun audit fix --dry-run` for review only. Never auto-apply audit fixes.
5. Review `bun prune --dry-run`; apply removals only when install residue is confirmed unreachable.

Docker therefore keeps the frozen production install without an additional prune layer.

## Profiling

No-provider recipes inherit only `HOME`/`PATH` and write ignored diagnostics under `runtime/profiling/bun-runtime/`:

- `bun profile:cpu`: CLI-help startup and price planning; compare profiles and recorded durations.
- `bun profile:heap`: synthetic XML and OCR-style normalization without source-book content.
- `bun profile:tokenizer`: cache load/evict/reconstruct heap profiles and token-ID hashes; reconstructed hashes must match.
- `bun profile:bundle`: CLI bundle metafiles and inventory.
- `bun profile:all`: all recipes in one timestamped directory.

Direct `src/tools/bun-profile.ts` invocation accepts `--output-dir`; profiling runs no test cases or paid providers.

## Cross-Cutting Coverage

Local/mocked contracts cover [provider selection](../../test/test-cases/validation/providers/provider-selection-contracts/), [option resolution](../../test/test-cases/validation/cli/option-resolution-contracts/), [price mode](../../test/test-cases/validation/reports-pricing/price-mode-contracts/), [provider adapters](../../test/test-cases/validation/providers/), and [resume](../../test/test-cases/validation/resume-manifests/). Command pages identify narrower behavior tests and exact live price examples.
