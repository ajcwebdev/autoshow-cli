# ADR-005: Reduce the Environment-Variable Surface Area

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-13
- **Date Updated:** 2026-08-21
- **Verification Status:** Passed
- **Supersession:** The removed container-detection interface and its runtime consequences moved to [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md) on 2026-08-13. This record remains authoritative for the environment-variable cleanup passes below. Passes 1–5 are implemented and verified; ADR-006 owns the shared missing-credential error vocabulary used by Pass 5.

## Context

The environment-variable surface had accumulated dead keys, misleading `.env.example` entries, phantom help text, and inconsistent provider-endpoint handling. Sequential passes shrink it, each using a different technique:

1. Delete dead, redundant, or decorative keys.
2. Change mechanisms so a variable's job survives without an environment variable (env→argv, env→OS API, self-set flag→parameter, drop defensive inbound reads).
3. Remove test-only over-parameterization and consolidate six per-tool binary overrides into one directory override.
4. Eliminate the base-URL override family by converting env reads into typed parameters, making the provider trust gate dead code.
5. Unify the provider-credential specification and missing-credential semantics, add strict readiness validation, isolate child-process environments, and replace raw credential digests in retained artifacts.

The retention test across all passes: keep only variables with a defensible reason to exist — production overrides with no CLI equivalent, deliberate security boundaries, credential channels, or load-bearing test-injection seams — and remove the rest.

On macOS, the binary resolver never consults `PATH` (`resolveRuntimeToolInfo` returns `undefined` on `darwin` when a managed binary is absent), making an override necessary to point at non-managed binaries when contract suites inject mock binaries across spawned CLI boundaries. Pass 3 retained that capability through the typed `--bin-dir` option rather than an ambient process interface.

Why now: a configuration audit exposed dead knobs, misleading documentation, and inconsistent provider-endpoint handling that made the runtime surface harder to understand and secure.

The 2026-08-21 audit motivating Pass 5 found provider-to-credential knowledge duplicated across the hosted-provider registry, TTS preflight, bootstrap handlers, hint construction, and provider-specific guard functions. It also found divergent missing-key error behavior, an advisory-only doctor command, full parent-environment inheritance at child-process boundaries, and durable unsalted credential fingerprints in advanced TTS artifacts. Pass 5 now makes `HOSTED_PROVIDER_ENV_CHECKS` the typed specification for all 37 managed credentials, derives hints and TTS admission metadata from it, routes throwing and observational checks through one resolver, removes unreachable bootstrap entries, adds `setup --doctor --strict`, uses an explicit `childEnv` allowlist at spawn boundaries, and derives account-scope identifiers with a versioned installation-keyed HMAC. Existing artifacts reconcile by re-deriving under the version-2 domain instead of silently accepting the former digest.

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

- **Option:** Make `HOSTED_PROVIDER_ENV_CHECKS` the single provider-credential specification and derive everything else from it, pair it with one missing-credential error contract and a fixed exit code, add a `doctor --strict` gate, introduce a `childEnv` allowlist for spawns, and salt the `accountScopeHash` derivation
- **Pros:** One registration per provider; every missing-key failure looks and exits the same; readiness becomes a usable CI gate; spawned tools stop inheriting credentials; contract artifacts stop persisting offline-attackable key digests
- **Cons:** Touches ~100 provider service files over time; changes the exit code of the missing-credential paths that used to fail at exit 1; salting invalidates existing `accountScopeHash` values in retained contract artifacts
- **Quantitative Notes:** Deletes one 16-entry table, 14 dead broker entries, and 37 free-standing thunks; unifies 4 error shapes and 2 exit codes into 1 each (the error-contract half is implemented; see ADR-006)

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

Remove the 16 unused logging, capacity, budget, tool-path, and host-name interfaces identified by the original audit. Align `.env.example` with runtime CLI flags and fixed constants in `timeouts.ts`.

### Pass 2 — Replace environment variables with typed mechanisms

Migrate approximately nine environment reads to direct mechanisms: subprocess argv for local tool settings, `os.homedir()` for portable home directory resolution, in-process parameters for setup flags, and managed directory paths. Prune misleading `.env.example` entries and correct the supported Hugging Face credential name.

### Pass 3 — Prune test-only tuning knobs and consolidate binary overrides

Remove ten adaptive-concurrency environment tuning knobs in favor of typed configuration options on `runCommand`. Replace the six per-tool binary override variables with the typed `--bin-dir` option, checked before managed paths.

### Pass 4 — Eliminate base-URL environment overrides and provider trust gate

Convert the 18 provider base-URL environment overrides into typed `baseUrl` function parameters defaulting to `base-urls.ts` constants. Because test seams inject endpoints in-process, production callers never pass these parameters. Delete the unneeded provider trust gate and its override interface.

### Pass 5 — Unify provider credential specification and missing-credential semantics

Each `HOSTED_PROVIDER_ENV_CHECKS` entry now carries `{providerId, envVar, label, configPaths, hintUrl, stages, ttsPreflight?, liveProbe?}` and every other credential surface derives from it. Every throwing missing-credential failure uses one error contract carrying the environment-variable name, hint URL, and exit code 2; the same resolver provides non-throwing observations for readiness reporting.

This pass applies to:

- Spec-derived `requireProviderKey` and `ensureProvider` helpers plus a generated `MISSING_ENV_HINTS` map, with the drift contract pinning `.env.example` to the specification.
- Spec-derived TTS preflight and live-probe metadata plus removal of the 14 unreachable OCR/TTS bootstrap entries.
- Convergence of hosted URL, X Spaces, TTS, and advanced-provider guards on the unified resolver and exit code.
- A `doctor --strict` mode that exits non-zero when a credential referenced by configured defaults is missing, making doctor usable as a CI/deployment gate while the default mode stays advisory.
- A `childEnv({allow, set})` helper for generic execution, setup, Defuddle, bare spawns, and test runners so children receive only `PATH`, `HOME`, terminal controls, and explicitly required values rather than all 37 credentials.
- Version-2 HMAC derivation of `accountScopeHash` with a random installation key stored outside public artifacts, so existing artifacts re-derive instead of mismatching silently.

It does not apply to:

- The inbound credential channel itself — credentials keep arriving via environment variables (Keep #1 below).
- The error class vocabulary and rendering pipeline — the missing-credential contract slots into the existing `AppError` taxonomy that [ADR-006](ADR-006-unify-the-logging-and-error-handling-vocabulary.md) owns, which is why that record implemented this half of the pass.
- Docker credential delivery (`--env-file`, `-e`, mounted `/app/.env`) — [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md) owns the container credential boundary.
- Runner-to-worker test IPC variables and the fake-binary seams, which the passes above deliberately kept.

## Rationale

- Pass 1's targets were dead, inert, or duplicated by flags.
- Pass 2's targets were unnecessary environment reads: argv carries subprocess tuning, `os.homedir()` is portable across OSes, and parameters replace self-set flags.
- Pass 3 eliminated over-parameterization while preserving macOS binary injection via a single consolidated directory override.
- Pass 4 retired base-URL overrides because test seams operate in-process. Deleting the trust gate followed because production callers always hit trusted default endpoints.
- Credential, IPC, master-switch, binary, and standard variables are retained as load-bearing mechanisms with no cleaner alternative.
- Pass 5's single spec removes the three-registry drift the audit measured; the per-step derivation precedent already exists (`getHostedProviderEnvKeysForConfigPrefix` replaced literal per-step lists for exactly this reason). One error contract makes missing-key behavior predictable for scripts and tests — the exit code used to depend on which provider the user picked, an accident of implementation history, and now settles on 2 because a missing variable is a user-fixable configuration mistake. Presence-only advisory checks satisfy interactive use but cannot gate deployments; `--strict` adds the gate without changing default behavior. Allowlisting child environments fixes the highest-leverage exposure finding at a fraction of the cost of de-env-ing credentials, and salting the `accountScopeHash` preserves the artifact-identity property the hash exists for while removing the offline-attackable fingerprint.

## Keep (with rationale)

**Var(s) 1: Provider API keys (~37)**

- **Var(s):** Provider API keys (~37)
- **Reason kept:** Credentials must enter the process; env is the standard channel with no better alternative. Pass 5 builds on this: keys stay inbound via env, and the exposure problem is fixed by allowlisting what child processes inherit rather than by changing the channel

**Var(s) 2: Runner-to-child IPC vars (`AUTOSHOW_TEST_OUTPUT_DIR`, `…_TEST_ARTIFACTS_DIR`, `…_TEST_COMMAND_LOG`, `…_TEST_METRICS_LOG`, `…_TEST_PRESERVE_ARTIFACTS`, `…_TEST_BUDGET_SKIP_KEYS`, `…_TEST_BUDGET_EVALUATED_KEYS`, `LOCK_ROOT`)**

- **Var(s):** Runner-to-child IPC vars (`AUTOSHOW_TEST_OUTPUT_DIR`, `…_TEST_ARTIFACTS_DIR`, `…_TEST_COMMAND_LOG`, `…_TEST_METRICS_LOG`, `…_TEST_PRESERVE_ARTIFACTS`, `…_TEST_BUDGET_SKIP_KEYS`, `…_TEST_BUDGET_EVALUATED_KEYS`, `LOCK_ROOT`)
- **Reason kept:** Env is the correct mechanism for passing state into spawned child processes; the process-lock directory itself is a typed option with a default in `process-lock.ts`.

**Var(s) 3: `AUTOSHOW_TEST_ADAPTIVE_CONCURRENCY`, `…_ADAPTIVE_E2E_SELECTION`**

- **Var(s):** `AUTOSHOW_TEST_ADAPTIVE_CONCURRENCY`, `…_ADAPTIVE_E2E_SELECTION`
- **Reason kept:** Genuine runner-to-child master switches, not tuning knobs

**Var(s) 4: Defuddle fake-binary mocks (`AUTOSHOW_DEFUDDLE_ARGS_LOG`, `…_FAKE_DEFUDDLE_MODE`, `…_FAKE_DEFUDDLE_STDERR`)**

- **Var(s):** Defuddle fake-binary mocks (`AUTOSHOW_DEFUDDLE_ARGS_LOG`, `…_FAKE_DEFUDDLE_MODE`, `…_FAKE_DEFUDDLE_STDERR`)
- **Reason kept:** Cross-process IPC into the spawned fake binary

**Var(s) 5: `FORCE_COLOR`, `NO_COLOR`, `PATH`**

- **Var(s):** `FORCE_COLOR`, `NO_COLOR`, `PATH`
- **Reason kept:** Standard terminal and system conventions

## Consequences

Positive outcomes:

- A smaller, single-source-of-truth configuration surface where `.env.example` documents only functional variables.
- Portable path resolution (`process-lock`) across operating systems including Windows.
- Consolidated binary injection mechanism and typed adaptive concurrency configuration.
- Provider clients target trusted default endpoints by construction, eliminating an unneeded security validation module and cross-test environment leakage.
- Adding a provider becomes one registry entry (preflight metadata, hints, doctor rows, per-step subsets, and drift tests all follow), missing-credential failures share one shape and exit code, `doctor --strict` gives CI a real readiness gate, spawned tools stop receiving unrelated credentials, and contract artifacts stop persisting attackable key digests.

Negative outcomes:

- Ad-hoc environment variable escape hatches are removed (per-tool binary overrides, build flags, runtime base-URL repointing).
- Subprocess argv contracts and explicit typed parameter threading require discipline across callers and test suites.
- Pass 5 moves the missing-credential paths that used to fail at exit 1 onto the unified exit 2 (a behavior change for scripts that pinned the old code, already observable since ADR-006 landed), re-derives `accountScopeHash` under a new schema version (which can invalidate resume comparisons for in-flight advanced-provider contracts), and requires curating per-tool allowlists where an overly narrow list can break a tool that legitimately reads an ambient variable.

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

- **Gain:** One credential spec and one failure contract across ~100 provider service files
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

- Type check and lint report no dangling references to removed variables, deleted helpers, or the retired provider trust gate.
- Grep sweeps verify zero production references to removed environment variable names, deleted tuning knobs, base-URL overrides, or trust-gate functions.
- Contract suites pass against remaining seams (logging, process locking, binary overrides, adaptive concurrency, provider mocks).
- CLI sanity verification: `--json` flag toggles JSON logs, tool resolution works via `--bin-dir` or `PATH`, and providers target `base-urls.ts` defaults.

## Implementation Note

Pass 5 was completed on 2026-08-21. The hosted-provider registry is the credential specification; TTS admission and hints derive from it; advanced-provider and hosted URL guards use the shared resolver; strict doctor readiness, child environment allowlisting, and version-2 installation-keyed account-scope hashing are implemented. Verification used the default static and pricing passes plus targeted local/no-cost setup, CLI, process-isolation, and TTS contracts; no paid provider calls were made.

## References

- Docker distribution and extracted container-flag decision: [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md)
- Retirement of PaddleOCR and OCRmyPDF engines: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)
- Error vocabulary the missing-credential contract extends, and the record that implemented it: [ADR-006](ADR-006-unify-the-logging-and-error-handling-vocabulary.md)
- Current inventory of record: this record's Context section, from the 2026-08-19 audit (the generated `docs/reports/00-env-vars-report-2026-08-19.md` is gitignored and no longer on disk; it replaced the 2026-08-13 report this record previously cited)
- Key modules: `src/utils/base-urls.ts`, `src/utils/runtime-paths.ts`, `src/utils/process-lock.ts`, `test/test-runner/adaptive-concurrency.ts`
- Pass 5 key modules: `src/cli/commands/setup-and-utilities/setup/hosted-provider-config.ts`, `src/cli/commands/process-steps/step-4-tts/tts-targets/execution-preflight.ts`, `src/utils/validate/env-utils.ts`, `src/cli/commands/process-steps/step-4-tts/script-to-audio/advanced-provider-contracts.ts`
