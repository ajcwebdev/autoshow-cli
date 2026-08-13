# ADR-005: Reduce the Environment-Variable Surface Area

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-13
- **Date Updated:** 2026-08-13
- **Verification Status:** Passed
- **Supersession:** The `DOCKER_CONTAINER` removal and its container-runtime consequences moved to [ADR-015](ADR-015-distribute-the-cli-as-a-docker-image.md) on 2026-08-13. This record remains authoritative for the four environment-variable cleanup passes below.

## Context

The environment-variable surface had accumulated dead keys, misleading `.env.example` entries, phantom help text, and inconsistent provider-endpoint handling. Four sequential passes shrank it, each using a different removal technique:

1. Delete dead, redundant, or decorative keys.
2. Change mechanisms so a variable's job survives without an environment variable (env→argv, env→OS API, self-set flag→parameter, drop defensive inbound reads).
3. Remove test-only over-parameterization and consolidate six per-tool binary overrides into one directory override.
4. Eliminate the base-URL override family by converting env reads into typed parameters, making the provider trust gate dead code.

The retention test across all passes: keep only variables with a defensible reason to exist — production overrides with no CLI equivalent, deliberate security boundaries, credential channels, or load-bearing test-injection seams — and remove the rest.

On macOS, the binary resolver never consults `PATH` (`resolveRuntimeToolInfo` returns `undefined` on `darwin` when a managed binary is absent), making an override necessary to point at non-managed binaries when contract suites inject mock binaries across spawned CLI boundaries. Pass 3 consolidated these overrides into `AUTOSHOW_BIN_DIR` rather than deleting them.

Why now: a configuration audit exposed dead knobs, misleading documentation, and inconsistent provider-endpoint handling that made the runtime surface harder to understand and secure.

## Options Considered

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **Systematic 4-pass reduction strategy (prune dead keys, migrate mechanisms to flags/params/OS APIs, consolidate binary overrides, eliminate base-URL overrides and dead trust gate)** | Prunes ~57 redundant/dead env reads; enforces typed parameters for test seams; guarantees provider endpoints hit trusted defaults; retains load-bearing IPC | Edits runtime code, provider clients, contract test suites, and documentation | Removed ~57 environment variable reads/keys; 6 binary vars consolidated into 1; 1 trust gate deleted |
| Leave environment variable surface as-is | Zero implementation effort | `.env.example` documents non-functional vars; phantom help text and inconsistent base-URL overrides persist | Rejected |
| Wholesale removal including test infra and injection seams | Maximally small runtime surface | Breaks contract test execution and cross-process runner IPC for marginal gain | Rejected |
| Remove base-URL family but retain provider trust gate | Preserves secondary defense-in-depth gate | Trust gate would exist solely for tests; override variable configures nothing in production | Rejected |

## Decision

Keep only environment variables that carry credentials, pass state into spawned child processes, follow a standard system convention, or serve a binary-injection seam with no in-process equivalent. Everything else moves to a CLI flag, a typed parameter, subprocess argv, an OS API, or a fixed constant.

This applies to:

- Runtime environment variables, `.env.example` documentation, binary tool overrides, test IPC seams, and provider endpoint configuration.
- It does not apply to required provider credential keys, intentional runner-to-child test IPC, standard system variables, or typed in-process test seams.

### Pass 1 — Delete dead, redundant, and decorative variables; fix inconsistent override

Remove 16 unused/decorative keys (`AUTOSHOW_LOG_FORMAT`, `AUTOSHOW_LOG_LEVEL`, timeout knobs, `AUTOSHOW_GENERATION_RESOURCE_CAPACITY`, `AUTOSHOW_TEST_BUDGET_HUNDREDTH_CENTS`, unused binary overrides `AUTOSHOW_TESSERACT_BIN`/`AUTOSHOW_OCRMYPDF_BIN`/`AUTOSHOW_TESSDATA_PREFIX`, and non-prefixed keys `NODE_ENV`/`HOSTNAME`/`HOST`). Align `.env.example` with runtime CLI flags and fixed constants in `timeouts.ts`. Wire `SCRAPECREATORS_BASE_URL` to standard `readEnv(...) ?? DEFAULT` fallback handling.

### Pass 2 — Replace environment variables with typed mechanisms

Migrate ~9 environment reads to direct mechanisms: subprocess argv for PaddleOCR settings, `os.homedir()` for portable home directory resolution, in-process parameters for setup flags, and managed build directory paths. Prune misleading `.env.example` entries (`yt-dlp` cookie env vars, phantom timeout help text) and correct `HF_TOKEN` to `HUGGINGFACE_TOKEN`.

### Pass 3 — Prune test-only tuning knobs and consolidate binary overrides

Remove 10 adaptive-concurrency environment tuning knobs in favor of typed configuration options on `runCommand`. Consolidate six per-tool binary override variables (`AUTOSHOW_FFMPEG_BIN`, `AUTOSHOW_FFPROBE_BIN`, `AUTOSHOW_YTDLP_BIN`, `AUTOSHOW_MUTOOL_BIN`, `AUTOSHOW_EBOOK_CONVERT_BIN`, `AUTOSHOW_DEFUDDLE_BIN`) into a single `AUTOSHOW_BIN_DIR` directory override checked before managed paths.

### Pass 4 — Eliminate base-URL environment overrides and provider trust gate

Convert 18 provider base-URL environment overrides (`OPENAI_BASE_URL`, `ANTHROPIC_BASE_URL`, `MISTRAL_BASE_URL`, etc.) into typed `baseUrl` function parameters defaulting to `base-urls.ts` constants. Because test seams inject endpoints in-process, production callers never pass these parameters. Delete the unneeded provider trust gate (`provider-url-policy.ts`) and its override variable `AUTOSHOW_ALLOW_UNTRUSTED_PROVIDER_BASE_URLS`.

## Rationale

- Pass 1's targets were dead, inert, or duplicated by flags.
- Pass 2's targets were unnecessary environment reads: argv carries subprocess tuning, `os.homedir()` is portable across OSes, and parameters replace self-set flags.
- Pass 3 eliminated over-parameterization while preserving macOS binary injection via a single consolidated directory override.
- Pass 4 retired base-URL overrides because test seams operate in-process. Deleting the trust gate followed because production callers always hit trusted default endpoints.
- Credential, IPC, master-switch, binary, and standard variables are retained as load-bearing mechanisms with no cleaner alternative.

## Keep (with rationale)

| Var(s) | Reason kept |
|---|---|
| Provider API keys (~37) | Credentials must enter the process; env is the standard channel with no better alternative |
| Runner-to-child IPC vars (`AUTOSHOW_TEST_OUTPUT_DIR`, `…_TEST_ARTIFACTS_DIR`, `…_TEST_COMMAND_LOG`, `…_TEST_METRICS_LOG`, `…_TEST_PRESERVE_ARTIFACTS`, `…_TEST_BUDGET_SKIP_KEYS`, `…_TEST_BUDGET_EVALUATED_KEYS`, `…_PROCESS_LOCK_DIR`, `LOCK_ROOT`) | Env is the correct mechanism for passing state into spawned child processes |
| `AUTOSHOW_TEST_ADAPTIVE_CONCURRENCY`, `…_ADAPTIVE_E2E_SELECTION` | Genuine runner-to-child master switches, not tuning knobs |
| Defuddle fake-binary mocks (`AUTOSHOW_DEFUDDLE_ARGS_LOG`, `…_FAKE_DEFUDDLE_MODE`, `…_FAKE_DEFUDDLE_STDERR`) | Cross-process IPC into the spawned fake binary |
| `AUTOSHOW_BIN_DIR` | Consolidated binary override used in test helper runner IPC |
| `FORCE_COLOR`, `NO_COLOR`, `PATH` | Standard terminal and system conventions |

## Consequences

Positive outcomes:

- A smaller, single-source-of-truth configuration surface where `.env.example` documents only functional variables.
- Portable path resolution (`process-lock`) across operating systems including Windows.
- Consolidated binary injection mechanism and typed adaptive concurrency configuration.
- Provider clients target trusted default endpoints by construction, eliminating an unneeded security validation module and cross-test environment leakage.

Negative outcomes:

- Ad-hoc environment variable escape hatches are removed (OCR binary paths, custom macOS build flags, per-tool env overrides, runtime base-URL repointing).
- Subprocess argv contracts and explicit typed parameter threading require discipline across callers and test suites.

## Trade-offs

| Gains | Sacrifices |
|---|---|
| Smaller, honest config surface; single source of truth for log format and capacity | A few rarely-used override escape hatches; implicit behaviors become fixed |
| Many env reads converted to argv, OS APIs, or typed params | Ambient configuration points become explicit code paths |
| One binary mechanism with macOS hatch and test seams preserved | Per-tool override moves from a var per tool to a file per tool in one directory |
| Providers target trusted default endpoints; dead trust gate and override deleted | Runtime proxy and self-host repointing require code changes or local proxying |

## Test Plan

Run default verification (`bun run check`) and local, no-cost contract validation suites:

```bash
bun run check
bun test test/test-cases/validation/cli/option-resolution-contracts/
```

- Type check and lint report no dangling references to removed variables, deleted helpers, or `provider-url-policy.ts`.
- Grep sweeps verify zero production references to removed environment variable names, deleted tuning knobs, base-URL overrides, or trust-gate functions.
- Contract suites pass against remaining seams (logging, process locking, binary overrides, adaptive concurrency, provider mocks).
- CLI sanity verification: `--json` flag toggles JSON logs, tool resolution works via `--bin-dir` or `PATH`, `HUGGINGFACE_TOKEN` activates Reverb, and providers target `base-urls.ts` defaults.

## References

- Docker distribution and extracted container-flag decision: [ADR-015](ADR-015-distribute-the-cli-as-a-docker-image.md)
- Retirement of PaddleOCR and OCRmyPDF engines: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)
- Current inventory of record: `docs/reports/00a-env-vars-report-2026-08-13.md`
- Key modules: `src/utils/base-urls.ts`, `src/utils/runtime-paths.ts`, `src/utils/process-lock.ts`, `test/test-runner/adaptive-concurrency.ts`
