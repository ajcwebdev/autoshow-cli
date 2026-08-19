# ADR-005: Reduce the Environment-Variable Surface Area

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-13
- **Date Updated:** 2026-08-19
- **Verification Status:** Passed
- **Supersession:** The `DOCKER_CONTAINER` removal and its container-runtime consequences moved to [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md) on 2026-08-13. This record remains authoritative for the environment-variable cleanup passes below. Passes 1–4 are implemented and verified; Pass 5 (added 2026-08-19) is decided but not yet implemented — its work is tracked in Follow-up Actions.

## Context

The environment-variable surface had accumulated dead keys, misleading `.env.example` entries, phantom help text, and inconsistent provider-endpoint handling. Sequential passes shrink it, each using a different technique:

1. Delete dead, redundant, or decorative keys.
2. Change mechanisms so a variable's job survives without an environment variable (env→argv, env→OS API, self-set flag→parameter, drop defensive inbound reads).
3. Remove test-only over-parameterization and consolidate six per-tool binary overrides into one directory override.
4. Eliminate the base-URL override family by converting env reads into typed parameters, making the provider trust gate dead code.
5. Unify the provider-credential specification and missing-credential semantics (added 2026-08-19, pending implementation).

The retention test across all passes: keep only variables with a defensible reason to exist — production overrides with no CLI equivalent, deliberate security boundaries, credential channels, or load-bearing test-injection seams — and remove the rest.

On macOS, the binary resolver never consults `PATH` (`resolveRuntimeToolInfo` returns `undefined` on `darwin` when a managed binary is absent), making an override necessary to point at non-managed binaries when contract suites inject mock binaries across spawned CLI boundaries. Pass 3 consolidated these overrides into `AUTOSHOW_BIN_DIR` rather than deleting them.

Why now: a configuration audit exposed dead knobs, misleading documentation, and inconsistent provider-endpoint handling that made the runtime surface harder to understand and secure.

The 2026-08-19 audit (`docs/reports/00-env-vars-report-2026-08-19.md`) motivating Pass 5 found that provider→credential knowledge lives in three independent registries plus free-standing constants: `HOSTED_PROVIDER_ENV_CHECKS` (37 entries, `src/cli/commands/setup-and-utilities/setup/hosted-provider-config.ts`), the TTS `HOSTED_TTS_CREDENTIALS` preflight table (16 entries, `src/cli/commands/process-steps/step-4-tts/tts-targets/execution-preflight.ts`), the STT `bootstrap-broker` handler map (carrying roughly 19 unreachable OCR/TTS entries because only STT and lyrics-video route through `ensureProviderReady`), and ~38 free-standing `ensureApiKeySetup` thunks, so adding a provider takes 3–4 edits and the surfaces drift. The same missing-key condition produces different error shapes and exit codes depending on the provider (`InternalError` with hint at exit 1, hint-less `ValidationError` at exit 1, `CLIUsageError` at exit 2 for X Spaces and Fish advanced-provider paths, and non-throwing "blocked" preflight observations). Readiness checks never gate: `setup --doctor` always exits 0 and `setup` health ignores credentials, so neither works as a CI or deployment gate. Two exposure findings sit alongside: every spawned subprocess inherits the full parent environment including all 37 credentials, and the TTS advanced-provider contract system persists an unsalted SHA-256 of the raw credential as `accountScopeHash` in artifacts under `output/` — a durable, offline-attackable fingerprint of every configured TTS key. The audit's mechanical gaps were fixed the same day without waiting for this pass: `MISSING_ENV_HINTS` covers all 37 managed variables and is pinned to the registry and `.env.example` by `test/test-cases/validation/setup/env-example-drift-contracts.test.ts`, the five `process.env[...] ?? ''` TTS target-collector bypasses now call `requireApiKey` (closing the Fish empty-credential hole), GLM/Kimi ensure helpers take their stage from the call site, the doctor-only `loadEnvFile` precedence inversion was deleted in favor of Bun's uniform `.env` auto-load, and the Supadata URL path routes through `requireHostedUrlProviderApiKey`. Pass 5 covers the remaining structural work.

## Options Considered

**Option 1 (selected)**

- **Option:** Systematic 4-pass reduction strategy (prune dead keys, migrate mechanisms to flags/params/OS APIs, consolidate binary overrides, eliminate base-URL overrides and dead trust gate)
- **Pros:** Prunes ~57 redundant/dead env reads; enforces typed parameters for test seams; guarantees provider endpoints hit trusted defaults; retains load-bearing IPC
- **Cons:** Edits runtime code, provider clients, contract test suites, and documentation
- **Quantitative Notes:** Removed ~57 environment variable reads/keys; 6 binary vars consolidated into 1; 1 trust gate deleted

**Option 2**

- **Option:** Leave environment variable surface as-is
- **Pros:** Zero implementation effort
- **Cons:** `.env.example` documents non-functional vars; phantom help text and inconsistent base-URL overrides persist
- **Quantitative Notes:** Rejected

**Option 3**

- **Option:** Wholesale removal including test infra and injection seams
- **Pros:** Maximally small runtime surface
- **Cons:** Breaks contract test execution and cross-process runner IPC for marginal gain
- **Quantitative Notes:** Rejected

**Option 4**

- **Option:** Remove base-URL family but retain provider trust gate
- **Pros:** Preserves secondary defense-in-depth gate
- **Cons:** Trust gate would exist solely for tests; override variable configures nothing in production
- **Quantitative Notes:** Rejected

**Pass 5 Option 1 (selected)**

- **Option:** Make `HOSTED_PROVIDER_ENV_CHECKS` the single provider-credential specification and derive everything else from it, pair it with one `MissingCredentialError` contract and a fixed exit code, add a `doctor --strict` gate, introduce a `childEnv` allowlist for spawns, and salt the `accountScopeHash` derivation
- **Pros:** One registration per provider; every missing-key failure looks and exits the same; readiness becomes a usable CI gate; spawned tools stop inheriting credentials; contract artifacts stop persisting offline-attackable key digests
- **Cons:** Touches ~104 provider service files over time; changes the documented exit code for X Spaces missing-token failures; salting invalidates existing `accountScopeHash` values in retained contract artifacts
- **Quantitative Notes:** Deletes one 16-entry table, ~19 dead broker entries, and ~38 free-standing thunks; unifies 4 error shapes and 2 exit codes into 1 each

**Pass 5 Option 2**

- **Option:** Keep the independent registries and continue spot-fixing individual inconsistencies as they surface
- **Pros:** No migration risk; each fix is small and independently verifiable
- **Cons:** Rejected; the audit showed discipline alone does not hold — the surfaces drifted into dead entries, mislabeled stages, and divergent error contracts, and every new provider re-pays the 3–4-edit tax
- **Quantitative Notes:** n/a

**Pass 5 Option 3**

- **Option:** Replace inbound env credentials wholesale with a credential-file or OS-keychain resolver
- **Pros:** Removes credentials from the environment entirely, making subprocess inheritance moot
- **Cons:** Rejected; env is the standard credential channel (Keep #1 below), every deployment guide and the Docker credential boundary (ADR-014) assume it, and the actual exposure root cause is full-env inheritance, which the `childEnv` allowlist fixes while keeping env inbound
- **Quantitative Notes:** Would require migrating all 37 operator secrets plus Docker/CI documentation rework; the audit ranked it lowest-desirability

## Decision

Keep only environment variables that carry credentials, pass state into spawned child processes, follow a standard system convention, or serve a binary-injection seam with no in-process equivalent. Everything else moves to a CLI flag, a typed parameter, subprocess argv, an OS API, or a fixed constant.

This applies to:

- Runtime environment variables, `.env.example` documentation, binary tool overrides, test IPC seams, and provider endpoint configuration.
- It does not apply to required provider credential keys, intentional runner-to-child test IPC, standard system variables, or typed in-process test seams.

### Pass 1 — Delete dead, redundant, and decorative variables

Remove 16 unused/decorative keys (`AUTOSHOW_LOG_FORMAT`, `AUTOSHOW_LOG_LEVEL`, timeout knobs, `AUTOSHOW_GENERATION_RESOURCE_CAPACITY`, `AUTOSHOW_TEST_BUDGET_HUNDREDTH_CENTS`, unused binary overrides `AUTOSHOW_TESSERACT_BIN`/`AUTOSHOW_OCRMYPDF_BIN`/`AUTOSHOW_TESSDATA_PREFIX`, and non-prefixed keys `NODE_ENV`/`HOSTNAME`/`HOST`). Align `.env.example` with runtime CLI flags and fixed constants in `timeouts.ts`.

### Pass 2 — Replace environment variables with typed mechanisms

Migrate ~9 environment reads to direct mechanisms: subprocess argv for local tool settings, `os.homedir()` for portable home directory resolution, in-process parameters for setup flags, and managed directory paths. Prune misleading `.env.example` entries (`yt-dlp` cookie env vars, phantom timeout help text) and correct `HF_TOKEN` to `HUGGINGFACE_TOKEN`.

### Pass 3 — Prune test-only tuning knobs and consolidate binary overrides

Remove 10 adaptive-concurrency environment tuning knobs in favor of typed configuration options on `runCommand`. Consolidate six per-tool binary override variables (`AUTOSHOW_FFMPEG_BIN`, `AUTOSHOW_FFPROBE_BIN`, `AUTOSHOW_YTDLP_BIN`, `AUTOSHOW_MUTOOL_BIN`, `AUTOSHOW_EBOOK_CONVERT_BIN`, `AUTOSHOW_DEFUDDLE_BIN`) into a single `AUTOSHOW_BIN_DIR` directory override checked before managed paths.

### Pass 4 — Eliminate base-URL environment overrides and provider trust gate

Convert 18 provider base-URL environment overrides (`OPENAI_BASE_URL`, `ANTHROPIC_BASE_URL`, `MISTRAL_BASE_URL`, etc.) into typed `baseUrl` function parameters defaulting to `base-urls.ts` constants. Because test seams inject endpoints in-process, production callers never pass these parameters. Delete the unneeded provider trust gate (`provider-url-policy.ts`) and its override variable `AUTOSHOW_ALLOW_UNTRUSTED_PROVIDER_BASE_URLS`.

### Pass 5 — Unify provider credential specification and missing-credential semantics (added 2026-08-19, pending)

Extend each `HOSTED_PROVIDER_ENV_CHECKS` entry to `{envVar, label, configPaths, hintUrl, stages, ttsPreflight?, liveProbe?}` and derive every other credential surface from it; represent every missing-credential failure as a single `MissingCredentialError(provider, stage)` carrying the env-var name, hint URL, and one fixed exit code.

This pass applies to:

- Spec-derived helpers `requireProviderKey(provider, stage)` and `ensureProvider(provider)` replacing the free-standing `ensureApiKeySetup` constants and the `MISSING_ENV_HINTS` literal map (the drift contract keeps pinning `.env.example` to the spec).
- Folding `HOSTED_TTS_CREDENTIALS` (including its live-probe flags) into the spec and deleting the ~19 unreachable `bootstrap-broker` OCR/TTS entries.
- Converging the X Spaces `CLIUsageError` (exit 2), the hint-less `ValidationError` TTS guards, and the advanced-provider contract checks on the unified error and exit code, updating the pinned contract tests in the same change.
- A `doctor --strict` mode that exits non-zero when a credential referenced by configured defaults is missing, making doctor usable as a CI/deployment gate while the default mode stays advisory.
- A `childEnv(allowlist)` helper for the generic exec wrapper and the bare `spawnSync` sites so external tools receive only the variables they need (`PATH`, `HOME`, tool-specific outbound values), not the 37 credentials.
- Salting (or HKDF-deriving) the `accountScopeHash` computation so contract artifacts no longer persist unsalted digests of raw keys, with a schema-version bump so existing artifacts re-derive instead of mismatching silently.

It does not apply to:

- The inbound credential channel itself — credentials keep arriving via environment variables (Keep #1 below).
- The error class vocabulary and rendering pipeline — `MissingCredentialError` slots into the existing `AppError` taxonomy that [ADR-006](ADR-006-unify-error-handling-vocabulary.md) owns.
- Docker credential delivery (`--env-file`, `-e`, mounted `/app/.env`) — [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md) owns the container credential boundary.
- Runner-to-worker test IPC variables and the fake-binary seams, which the passes above deliberately kept.

## Rationale

- Pass 1's targets were dead, inert, or duplicated by flags.
- Pass 2's targets were unnecessary environment reads: argv carries subprocess tuning, `os.homedir()` is portable across OSes, and parameters replace self-set flags.
- Pass 3 eliminated over-parameterization while preserving macOS binary injection via a single consolidated directory override.
- Pass 4 retired base-URL overrides because test seams operate in-process. Deleting the trust gate followed because production callers always hit trusted default endpoints.
- Credential, IPC, master-switch, binary, and standard variables are retained as load-bearing mechanisms with no cleaner alternative.
- Pass 5's single spec removes the three-registry drift the audit measured; the per-step derivation precedent already exists (`getHostedProviderEnvKeysForConfigPrefix` replaced literal per-step lists for exactly this reason). One error contract makes missing-key behavior predictable for scripts and tests — today the exit code depends on which provider the user picked, an accident of implementation history. Presence-only advisory checks satisfy interactive use but cannot gate deployments; `--strict` adds the gate without changing default behavior. Allowlisting child environments fixes the highest-leverage exposure finding at a fraction of the cost of de-env-ing credentials, and salting the `accountScopeHash` preserves the artifact-identity property the hash exists for while removing the offline-attackable fingerprint.

## Keep (with rationale)

**Var(s) 1: Provider API keys (~37)**

- **Var(s):** Provider API keys (~37)
- **Reason kept:** Credentials must enter the process; env is the standard channel with no better alternative. Pass 5 builds on this: keys stay inbound via env, and the exposure problem is fixed by allowlisting what child processes inherit rather than by changing the channel

**Var(s) 2: Runner-to-child IPC vars (`AUTOSHOW_TEST_OUTPUT_DIR`, `…_TEST_ARTIFACTS_DIR`, `…_TEST_COMMAND_LOG`, `…_TEST_METRICS_LOG`, `…_TEST_PRESERVE_ARTIFACTS`, `…_TEST_BUDGET_SKIP_KEYS`, `…_TEST_BUDGET_EVALUATED_KEYS`, `LOCK_ROOT`)**

- **Var(s):** Runner-to-child IPC vars (`AUTOSHOW_TEST_OUTPUT_DIR`, `…_TEST_ARTIFACTS_DIR`, `…_TEST_COMMAND_LOG`, `…_TEST_METRICS_LOG`, `…_TEST_PRESERVE_ARTIFACTS`, `…_TEST_BUDGET_SKIP_KEYS`, `…_TEST_BUDGET_EVALUATED_KEYS`, `LOCK_ROOT`)
- **Reason kept:** Env is the correct mechanism for passing state into spawned child processes. (Correction, 2026-08-19: `AUTOSHOW_PROCESS_LOCK_DIR` was originally listed here but has no occurrences in code — the process-lock directory is a typed option with a default in `process-lock.ts`.)

**Var(s) 3: `AUTOSHOW_TEST_ADAPTIVE_CONCURRENCY`, `…_ADAPTIVE_E2E_SELECTION`**

- **Var(s):** `AUTOSHOW_TEST_ADAPTIVE_CONCURRENCY`, `…_ADAPTIVE_E2E_SELECTION`
- **Reason kept:** Genuine runner-to-child master switches, not tuning knobs

**Var(s) 4: Defuddle fake-binary mocks (`AUTOSHOW_DEFUDDLE_ARGS_LOG`, `…_FAKE_DEFUDDLE_MODE`, `…_FAKE_DEFUDDLE_STDERR`)**

- **Var(s):** Defuddle fake-binary mocks (`AUTOSHOW_DEFUDDLE_ARGS_LOG`, `…_FAKE_DEFUDDLE_MODE`, `…_FAKE_DEFUDDLE_STDERR`)
- **Reason kept:** Cross-process IPC into the spawned fake binary

**Var(s) 5: `AUTOSHOW_BIN_DIR`**

- **Var(s):** `AUTOSHOW_BIN_DIR`
- **Reason kept:** Consolidated binary override used in test helper runner IPC. (Correction, 2026-08-19: `src` never reads this env var — the production override is the `--bin-dir` CLI flag, and the test helper translates `AUTOSHOW_BIN_DIR` from `opts.env` into that flag when spawning the CLI.)

**Var(s) 6: `FORCE_COLOR`, `NO_COLOR`, `PATH`**

- **Var(s):** `FORCE_COLOR`, `NO_COLOR`, `PATH`
- **Reason kept:** Standard terminal and system conventions

## Consequences

Positive outcomes:

- A smaller, single-source-of-truth configuration surface where `.env.example` documents only functional variables.
- Portable path resolution (`process-lock`) across operating systems including Windows.
- Consolidated binary injection mechanism and typed adaptive concurrency configuration.
- Provider clients target trusted default endpoints by construction, eliminating an unneeded security validation module and cross-test environment leakage.
- After Pass 5, adding a provider becomes one registry entry (the preflight table, hints, doctor rows, per-step subsets, and drift tests all follow), missing-credential failures share one shape and exit code, `doctor --strict` gives CI a real readiness gate, spawned tools stop receiving unrelated credentials, and contract artifacts stop persisting attackable key digests.

Negative outcomes:

- Ad-hoc environment variable escape hatches are removed (per-tool binary overrides, build flags, runtime base-URL repointing).
- Subprocess argv contracts and explicit typed parameter threading require discipline across callers and test suites.
- Pass 5 changes the X Spaces missing-token exit code from 2 to the unified code (a documented behavior change for scripts that pinned it), re-derives `accountScopeHash` under a new schema version (which can invalidate resume comparisons for in-flight advanced-provider contracts), and requires curating per-tool allowlists where an overly narrow list can break a tool that legitimately reads an ambient variable.

## Trade-offs

**Trade-off 1**

- **Gain:** Smaller, honest config surface; single source of truth for log format and capacity
- **Sacrifice:** A few rarely-used override escape hatches; implicit behaviors become fixed

**Trade-off 2**

- **Gain:** Many env reads converted to argv, OS APIs, or typed params
- **Sacrifice:** Ambient configuration points become explicit code paths

**Trade-off 3**

- **Gain:** One binary mechanism with macOS hatch and test seams preserved
- **Sacrifice:** Per-tool override moves from a var per tool to a file per tool in one directory

**Trade-off 4**

- **Gain:** Providers target trusted default endpoints; dead trust gate and override deleted
- **Sacrifice:** Runtime proxy and self-host repointing require code changes or local proxying

**Trade-off 5**

- **Gain:** One credential spec and one failure contract across ~104 provider service files
- **Sacrifice:** A wide, mostly mechanical migration that must update every pinned error-shape and exit-code assertion in the contract suites in the same change

**Trade-off 6**

- **Gain:** Credential exposure limited to the process that needs each key
- **Sacrifice:** Curating and maintaining per-tool allowlists, plus the risk of under-allowlisting environment variables third-party tools read implicitly

**Trade-off 7**

- **Gain:** Contract artifacts no longer persist offline-attackable digests of raw keys
- **Sacrifice:** A schema-version bump that invalidates `accountScopeHash` continuity for artifacts produced before the change

## Test Plan

Run default verification (`bun run check`) and local, no-cost contract validation suites:

```bash
bun run check
bun test test/test-cases/validation/cli/option-resolution-contracts/
```

- Type check and lint report no dangling references to removed variables, deleted helpers, or `provider-url-policy.ts`.
- Grep sweeps verify zero production references to removed environment variable names, deleted tuning knobs, base-URL overrides, or trust-gate functions.
- Contract suites pass against remaining seams (logging, process locking, binary overrides, adaptive concurrency, provider mocks).
- CLI sanity verification: `--json` flag toggles JSON logs, tool resolution works via `--bin-dir` or `PATH`, and providers target `base-urls.ts` defaults.

## Follow-up Actions

Pass 5 implementation, in order:

- [ ] Extend `HOSTED_PROVIDER_ENV_CHECKS` entries to the full spec and add spec-derived `requireProviderKey`/`ensureProvider` helpers — Pending
- [ ] Fold `HOSTED_TTS_CREDENTIALS` and the free-standing `ensureApiKeySetup` constants into the spec; delete the unreachable `bootstrap-broker` OCR/TTS entries — Pending
- [ ] Introduce `MissingCredentialError` with a fixed exit code and converge the X Spaces, TTS-guard, and advanced-provider paths on it, updating pinned tests (`input-contracts`, TTS adapter contracts, usage-error suites) — Pending
- [ ] Add `doctor --strict` and align its help text and `docs/commands/setup-and-utilities/setup/setup.md` — Pending
- [ ] Add `childEnv(allowlist)` and adopt it in the generic exec wrapper and the bare `spawnSync` sites — Pending
  Verify each adopted spawn site with the targeted local suite that exercises that tool before moving to the next.
- [ ] Salt or HKDF the `accountScopeHash` derivation with a schema-version bump and a migration note for retained artifacts — Pending
- [ ] Verification pass — Pending
  `bun run check`, `bun test test/test-cases/validation/setup/`, `bun test test/test-cases/validation/cli/cli-usage-errors/`, `bun test test/test-cases/validation/cli/option-resolution-contracts/`, and the TTS validation suites; no paid provider runs.

## References

- Docker distribution and extracted container-flag decision: [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md)
- Retirement of PaddleOCR and OCRmyPDF engines: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)
- Error vocabulary that `MissingCredentialError` extends: [ADR-006](ADR-006-unify-error-handling-vocabulary.md)
- Current inventory of record: `docs/reports/00-env-vars-report-2026-08-19.md` (replaces the 2026-08-13 report this record previously cited)
- Key modules: `src/utils/base-urls.ts`, `src/utils/runtime-paths.ts`, `src/utils/process-lock.ts`, `test/test-runner/adaptive-concurrency.ts`
- Pass 5 key modules: `src/cli/commands/setup-and-utilities/setup/hosted-provider-config.ts`, `src/cli/commands/process-steps/step-4-tts/tts-targets/execution-preflight.ts`, `src/utils/validate/env-utils.ts`, `src/cli/commands/process-steps/step-4-tts/script-to-audio/advanced-provider-contracts.ts`
