# ADR-005: Reduce the Environment-Variable Surface Area

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-13
- **Date Updated:** 2026-08-21
- **Verification Status:** Passed
- **Supersession:** The removed container-detection interface and its runtime consequences moved to [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md). This record remains accepted authority for the environment-variable surface.

## Context

The environment-variable surface had accumulated dead keys, misleading `.env.example` entries, phantom help text, and inconsistent provider-endpoint handling. A later audit found the same problem on the credential side: provider-to-credential knowledge duplicated across registries, missing-key failures that differed by provider, an advisory-only doctor command, full parent-environment inheritance into child processes, and unsalted credential fingerprints in retained artifacts.

The retention rule: keep only variables with a defensible reason to exist — production overrides with no CLI equivalent, deliberate security boundaries, credential channels, or load-bearing test-injection seams — and remove the rest.

On macOS, managed binaries do not fall back to `PATH`, so a directory override remains necessary when contract suites inject mock binaries across spawned CLI boundaries. That capability is the typed `--bin-dir` option, not an ambient process interface.

Why now: a configuration audit exposed dead knobs, misleading documentation, inconsistent provider endpoints, duplicated credential registries, and child-process credential leakage.

## Options Considered

**Option 1 (selected)**

- **Option:** Sequential reduction: delete dead keys, move remaining jobs to flags, parameters, or OS APIs, consolidate binary overrides, pin provider endpoints to trusted defaults, then unify the credential specification
- **Pros:** Shrinks the documented surface; typed parameters for test seams; trusted default endpoints; one credential spec and missing-key contract
- **Cons:** Edits runtime code, provider clients, contract tests, and documentation; missing-credential paths that used to exit 1 now exit 2
- **Quantitative Notes:** Removed ~57 environment reads; 6 binary vars consolidated into `--bin-dir`; 1 unused trust gate deleted; 37 credentials remain as the inbound channel

**Option 2**

- **Option:** Leave the environment-variable surface as-is
- **Pros:** Zero implementation effort
- **Cons:** `.env.example` documents non-functional vars; phantom help text and inconsistent base-URL overrides persist
- **Quantitative Notes:** n/a

**Option 3**

- **Option:** Wholesale removal including test infrastructure and injection seams
- **Pros:** Maximally small runtime surface
- **Cons:** Breaks contract test execution and cross-process runner IPC for marginal gain
- **Quantitative Notes:** n/a

**Option 4**

- **Option:** Remove the base-URL family but retain the provider trust gate
- **Pros:** Preserves a secondary defense-in-depth gate
- **Cons:** The trust gate would exist solely for tests; the override variable configures nothing in production
- **Quantitative Notes:** n/a

**Option 5 (selected)**

- **Option:** One provider-credential specification as the source of truth, one missing-credential error and exit code, a `doctor --strict` gate, a child-process environment allowlist, and salted account-scope identifiers
- **Pros:** One registration per provider; every missing-key failure looks and exits the same; readiness becomes a usable CI gate; spawned tools stop inheriting credentials; contract artifacts stop persisting offline-attackable key digests
- **Cons:** Missing-credential paths that used to fail at exit 1 now fail at exit 2; salting invalidates existing `accountScopeHash` values in retained contract artifacts
- **Quantitative Notes:** 37 managed credentials; missing-key failures use exit code 2 per [ADR-006](ADR-006-unify-the-logging-and-error-handling-vocabulary.md)

**Option 6**

- **Option:** Keep the independent credential registries and continue spot-fixing inconsistencies as they surface
- **Pros:** No migration risk; each fix is small and independently verifiable
- **Cons:** Rejected; discipline alone does not hold — the surfaces drifted into dead entries and divergent error contracts, and every new provider re-pays a multi-edit tax
- **Quantitative Notes:** n/a

**Option 7**

- **Option:** Replace inbound environment credentials with a credential-file or OS-keychain resolver
- **Pros:** Removes credentials from the environment entirely, making subprocess inheritance moot
- **Cons:** Rejected; environment variables are the standard credential channel, every deployment guide and the Docker credential boundary ([ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md)) assume them, and the exposure root cause is full-environment inheritance, which an allowlist fixes
- **Quantitative Notes:** Would require migrating all 37 operator secrets plus Docker and CI documentation

## Decision

Keep only environment variables that carry credentials, pass state into spawned child processes, follow a standard system convention, or serve a binary-injection seam with no in-process equivalent. Everything else moves to a CLI flag, a typed parameter, subprocess argv, an OS API, or a fixed constant.

This applies to:

- Runtime environment variables, `.env.example` documentation, binary tool overrides, test IPC seams, and provider endpoint configuration.
- User-visible readiness and failure behavior: `setup --doctor --strict`, missing-credential errors, and what spawned children inherit.

It does not apply to:

- Required provider credential keys, which continue to arrive via environment variables.
- Intentional runner-to-child test IPC and fake-binary seams.
- Standard system variables (`PATH`, `NO_COLOR`, `FORCE_COLOR`).
- The error class vocabulary and rendering pipeline — the missing-credential contract slots into the `AppError` taxonomy that [ADR-006](ADR-006-unify-the-logging-and-error-handling-vocabulary.md) owns.
- Docker credential delivery (`--env-file`, `-e`, mounted `/app/.env`) — [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md) owns the container credential boundary.

### Pass 1 — Delete dead, redundant, and decorative variables

Remove unused logging, capacity, budget, tool-path, and host-name interfaces. Keep `.env.example` aligned with runtime CLI flags and fixed timeout constants.

### Pass 2 — Replace environment variables with typed mechanisms

Move remaining environment reads to direct mechanisms: subprocess argv for local tool settings, the OS home directory for portable path resolution, in-process parameters for setup flags, and managed directory paths. Correct the supported Hugging Face credential name.

### Pass 3 — Prune test-only tuning knobs and consolidate binary overrides

Replace adaptive-concurrency environment knobs with typed configuration. Replace the six per-tool binary override variables with `--bin-dir`, checked before managed paths.

### Pass 4 — Eliminate base-URL environment overrides

Provider clients use trusted default endpoints. Runtime base-URL environment overrides are gone; test seams inject endpoints in-process instead.

### Pass 5 — Unify provider credential specification and missing-credential semantics

One credential specification drives hints, doctor rows, and TTS admission. Every throwing missing-credential failure uses one error contract carrying the environment-variable name, hint URL, and exit code 2. `setup --doctor --strict` exits non-zero when a credential referenced by configured defaults is missing; the default doctor mode stays advisory. Spawned children receive only `PATH`, `HOME`, terminal controls, and explicitly required values rather than all 37 credentials. Account-scope identifiers in retained artifacts use a versioned installation-keyed hash so existing artifacts re-derive instead of mismatching.

## Rationale

- Pass 1's targets were dead, inert, or duplicated by flags.
- Pass 2's targets were unnecessary environment reads: argv carries subprocess tuning, the OS home directory is portable, and parameters replace self-set flags.
- Pass 3 eliminated over-parameterization while preserving macOS binary injection through `--bin-dir`.
- Pass 4 retired base-URL overrides because test seams operate in-process, so production callers always hit trusted default endpoints.
- Credential, IPC, master-switch, binary, and standard variables remain because they have no cleaner alternative.
- One credential spec stops registries from drifting; one error contract makes missing-key behavior predictable for scripts (exit 2, a user-fixable configuration mistake). `--strict` adds a deployment gate without changing default doctor behavior. Allowlisting child environments fixes credential leakage without changing the inbound channel. Salting `accountScopeHash` keeps artifact identity without persisting an offline-attackable fingerprint.

## Consequences

Positive outcomes:

- `.env.example` documents only functional variables.
- Portable path resolution across operating systems including Windows.
- One binary injection mechanism (`--bin-dir`) and typed adaptive concurrency configuration.
- Provider clients target trusted default endpoints by construction.
- Adding a provider is one registry entry. Missing-credential failures share one shape and exit code. `setup --doctor --strict` is a real CI readiness gate. Spawned tools stop receiving unrelated credentials. Contract artifacts stop persisting attackable key digests.

Negative outcomes:

- Ad-hoc environment-variable escape hatches are gone (per-tool binary overrides, build flags, runtime base-URL repointing).
- Missing-credential paths that used to fail at exit 1 now fail at exit 2, a behavior change for scripts that pinned the old code.
- Re-deriving `accountScopeHash` under a new schema version can invalidate resume comparisons for in-flight advanced-provider contracts.
- Per-tool child-environment allowlists must stay accurate; an overly narrow list can break a tool that legitimately reads an ambient variable.

## Trade-offs

**Trade-off 1**

- **Gain:** Smaller, honest config surface
- **Sacrifice:** Rarely used override escape hatches; implicit behaviors become fixed

**Trade-off 2**

- **Gain:** Many environment reads converted to argv, OS APIs, or typed parameters
- **Sacrifice:** Ambient configuration points become explicit code paths

**Trade-off 3**

- **Gain:** One binary mechanism with the macOS hatch and test seams preserved
- **Sacrifice:** Per-tool override moves from a variable per tool to a file per tool in one directory

**Trade-off 4**

- **Gain:** Providers target trusted default endpoints
- **Sacrifice:** Runtime proxy and self-host repointing require code changes or local proxying

**Trade-off 5**

- **Gain:** One credential spec and one failure contract
- **Sacrifice:** Every pinned missing-key error shape and exit-code assertion must change with the contract

**Trade-off 6**

- **Gain:** Credential exposure limited to the process that needs each key
- **Sacrifice:** Curating per-tool allowlists, plus the risk of omitting variables third-party tools read implicitly

**Trade-off 7**

- **Gain:** Contract artifacts no longer persist offline-attackable digests of raw keys
- **Sacrifice:** A schema-version bump that breaks `accountScopeHash` continuity for artifacts produced before the change

## Implementation Note

The five-pass cleanup is implemented. `.env.example` matches the remaining functional variables. `--bin-dir` is the binary override. Provider endpoints use trusted defaults. The hosted-provider registry is the credential specification; hints, doctor rows, and TTS admission derive from it; missing-credential failures use the ADR-006 contract; `setup --doctor --strict`, child-environment allowlisting, and version-2 installation-keyed account-scope hashing are in place.

Carrying files include `src/utils/base-urls.ts`, `src/utils/runtime-paths.ts`, `src/utils/process-lock.ts`, `src/cli/commands/setup-and-utilities/setup/hosted-provider-config.ts`, `src/utils/validate/env-utils.ts`, `src/cli/commands/process-steps/step-4-tts/tts-targets/execution-preflight.ts`, and `src/cli/commands/process-steps/step-4-tts/script-to-audio/advanced-provider-contracts.ts`.

## Keep (with rationale)

**Keep 1**

- **Var(s):** Provider API keys (~37)
- **Reason kept:** Credentials must enter the process; environment variables are the standard channel. Child-process leakage is fixed by allowlisting what children inherit, not by changing the inbound channel.

**Keep 2**

- **Var(s):** Runner-to-child IPC (`AUTOSHOW_TEST_OUTPUT_DIR`, `…_TEST_ARTIFACTS_DIR`, `…_TEST_COMMAND_LOG`, `…_TEST_METRICS_LOG`, `…_TEST_PRESERVE_ARTIFACTS`, `…_TEST_BUDGET_SKIP_KEYS`, `…_TEST_BUDGET_EVALUATED_KEYS`, `LOCK_ROOT`)
- **Reason kept:** Environment variables are the correct mechanism for passing state into spawned child processes.

**Keep 3**

- **Var(s):** `AUTOSHOW_TEST_ADAPTIVE_CONCURRENCY`, `…_ADAPTIVE_E2E_SELECTION`
- **Reason kept:** Genuine runner-to-child master switches, not tuning knobs.

**Keep 4**

- **Var(s):** Defuddle fake-binary mocks (`AUTOSHOW_DEFUDDLE_ARGS_LOG`, `…_FAKE_DEFUDDLE_MODE`, `…_FAKE_DEFUDDLE_STDERR`)
- **Reason kept:** Cross-process IPC into the spawned fake binary.

**Keep 5**

- **Var(s):** `FORCE_COLOR`, `NO_COLOR`, `PATH`
- **Reason kept:** Standard terminal and system conventions.

## Test Plan

Run default verification (`bun run check`) and local, no-cost contract validation suites:

```bash
bun run check
bun test test/test-cases/validation/cli/option-resolution-contracts/
```

1. Type check and lint report no dangling references to removed variables or retired helpers.
2. Remaining seams still work: logging, process locking, `--bin-dir`, and adaptive concurrency.
3. `--json` toggles JSON logs, tool resolution works via `--bin-dir` or `PATH`, and providers target trusted defaults.
4. Missing credentials fail with one error shape and exit code 2; `setup --doctor --strict` fails closed on configured defaults; spawned children do not inherit the full parent credential set.

## References

- Related ADR: [ADR-006](ADR-006-unify-the-logging-and-error-handling-vocabulary.md)
- Related ADR: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)
- Related ADR: [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md)
- `src/utils/base-urls.ts`
- `src/utils/runtime-paths.ts`
- `src/utils/process-lock.ts`
- `src/cli/commands/setup-and-utilities/setup/hosted-provider-config.ts`
- `src/utils/validate/env-utils.ts`
- `test/test-runner/adaptive-concurrency.ts`
