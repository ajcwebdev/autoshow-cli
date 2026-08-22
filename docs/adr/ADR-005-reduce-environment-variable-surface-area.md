# ADR-005: Reduce the Environment-Variable Surface Area

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-13
- **Date Updated:** 2026-08-21
- **Verification Status:** Passed
- **Supersession:** The removed container-detection interface and its runtime consequences moved to [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md). This record remains accepted authority for the environment-variable surface.

## Context

The environment-variable surface had accumulated dead keys, misleading `.env.example` entries, phantom help text, inconsistent provider-endpoint overrides, duplicated provider-to-credential registries, missing-key failures that differed by provider, an advisory-only doctor command, and full parent-environment inheritance into child processes.

Keep only variables with a defensible reason to exist: credentials, production overrides with no CLI equivalent, deliberate security boundaries, or load-bearing child-process seams. Everything else becomes a CLI flag, a typed parameter, an OS API, or a fixed constant.

Why now: a configuration audit exposed dead knobs, misleading documentation, inconsistent provider endpoints, duplicated credential registries, and child-process credential leakage.

## Options Considered

**Option 1 (selected)**

- **Option:** Shrink the environment-variable surface to credentials, standard system variables, and unavoidable child-process seams; replace everything else with CLI flags, typed parameters, OS APIs, or trusted defaults; keep one credential specification, one missing-key error, a `setup --doctor --strict` gate, and an allowlisted child environment
- **Pros:** Honest `.env.example`; `--bin-dir` instead of per-tool overrides; trusted default endpoints; one missing-key contract; a usable CI readiness gate; spawned tools stop inheriting unrelated credentials
- **Cons:** Removes ad-hoc environment escape hatches; missing-credential paths that used to exit 1 now exit 2
- **Quantitative Notes:** 37 credentials remain as the inbound channel; six per-tool binary variables became `--bin-dir`; missing-key failures use exit code 2 per [ADR-006](ADR-006-unify-the-logging-and-error-handling-vocabulary.md)

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

- **Option:** Remove runtime base-URL overrides but keep a test-only endpoint trust gate
- **Pros:** Preserves a secondary defense-in-depth gate
- **Cons:** The gate would exist solely for tests; the override variable configures nothing in production
- **Quantitative Notes:** n/a

**Option 5**

- **Option:** Keep independent credential registries and spot-fix inconsistencies as they surface
- **Pros:** No migration risk; each fix is small and independently verifiable
- **Cons:** Rejected; the surfaces drifted into dead entries and divergent error contracts, and every new provider re-pays a multi-edit tax
- **Quantitative Notes:** n/a

**Option 6**

- **Option:** Replace inbound environment credentials with a credential-file or OS-keychain resolver
- **Pros:** Removes credentials from the environment entirely, making subprocess inheritance moot
- **Cons:** Rejected; environment variables are the standard credential channel, every deployment guide and the Docker credential boundary ([ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md)) assume them, and an allowlist fixes the actual exposure (full-environment inheritance)
- **Quantitative Notes:** Would require migrating all 37 operator secrets plus Docker and CI documentation

## Decision

Keep only environment variables that carry credentials, pass state into spawned child processes, follow a standard system convention, or have no CLI equivalent. Everything else is a CLI flag, a typed parameter, an OS API, or a fixed constant.

Provider credentials stay on the environment-variable channel and are documented in `.env.example`. One credential specification drives missing-key hints, `setup --doctor` rows, and TTS admission. Missing credentials fail with one error that names the variable, includes a hint URL, and exits 2. `setup --doctor` stays advisory; `setup --doctor --strict` exits non-zero when a credential required by configured defaults is missing. Spawned children receive `PATH`, `HOME`, terminal controls, and values they explicitly need — not the full credential set. Binary location overrides use `--bin-dir`. Provider clients use trusted default endpoints; runtime base-URL environment overrides are not supported.

This applies to:

- Runtime environment variables, `.env.example`, binary tool overrides, and provider endpoint configuration.
- User-visible readiness and failure behavior: `setup --doctor --strict`, missing-credential errors, and what spawned children inherit.

It does not apply to:

- Required provider credential keys, which continue to arrive via environment variables.
- Intentional runner-to-child test IPC.
- Standard system variables (`PATH`, `NO_COLOR`, `FORCE_COLOR`).
- The error class vocabulary and rendering pipeline — the missing-credential contract slots into the `AppError` taxonomy that [ADR-006](ADR-006-unify-the-logging-and-error-handling-vocabulary.md) owns.
- Docker credential delivery (`--env-file`, `-e`, mounted `/app/.env`) — [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md) owns the container credential boundary.

## Rationale

- Dead, inert, or flag-duplicated variables should not appear in `.env.example` or help text as if they work.
- `--bin-dir` is the user-facing binary override; per-tool environment variables were a second, hidden interface for the same job.
- Production callers should always hit trusted default endpoints, so runtime base-URL environment overrides are not part of the config surface.
- Environment variables remain the standard credential channel. Changing that would break deployment guides and the Docker credential boundary in [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md).
- One credential specification stops registries from drifting. One error contract makes missing-key behavior predictable for scripts: exit 2, a user-fixable configuration mistake.
- `setup --doctor --strict` adds a deployment gate without changing default advisory doctor behavior.
- Allowlisting child environments stops credential leakage without changing how callers supply keys.

## Consequences

Positive outcomes:

- `.env.example` documents only functional variables.
- `--bin-dir` is the single binary override, checked before managed paths and `PATH`.
- Provider clients target trusted default endpoints.
- Missing-credential failures share one shape and exit code 2. `setup --doctor --strict` is a real CI readiness gate. Spawned tools stop receiving unrelated credentials. Retained artifacts do not persist fingerprints of raw credentials.

Negative outcomes:

- Ad-hoc environment-variable escape hatches are gone: per-tool binary overrides, build flags, and runtime base-URL repointing.
- Missing-credential paths that used to fail at exit 1 now fail at exit 2, a behavior change for scripts that pinned the old code.
- Per-tool child-environment allowlists must stay accurate; an overly narrow list can break a tool that legitimately reads an ambient variable.

## Trade-offs

**Trade-off 1**

- **Gain:** Smaller, honest config surface
- **Sacrifice:** Rarely used override escape hatches; implicit behaviors become fixed

**Trade-off 2**

- **Gain:** Providers target trusted default endpoints
- **Sacrifice:** Runtime proxy and self-host repointing require a local proxy or a code change

**Trade-off 3**

- **Gain:** One missing-credential error shape and exit code
- **Sacrifice:** Scripts that pinned exit 1 on missing keys must follow the ADR-006 contract (exit 2)

**Trade-off 4**

- **Gain:** Credential exposure limited to the process that needs each key
- **Sacrifice:** Curating per-tool allowlists, plus the risk of omitting variables third-party tools read implicitly

## Implementation Note

The reduced surface is in place. `.env.example` lists only functional credential variables. `--bin-dir` is the binary override. Provider clients use trusted default endpoints. The hosted-provider registry is the credential specification for hints, doctor rows, and TTS admission. Missing-credential failures use the [ADR-006](ADR-006-unify-the-logging-and-error-handling-vocabulary.md) contract. `setup --doctor --strict` and child-environment allowlisting are in place.

Carrying files include `src/utils/base-urls.ts`, `src/utils/runtime-paths.ts`, `src/cli/commands/setup-and-utilities/setup/hosted-provider-config.ts`, and `src/utils/validate/env-utils.ts`.

## Keep (with rationale)

**Keep 1**

- **Var(s):** Provider API keys (~37)
- **Reason kept:** Credentials must enter the process; environment variables are the standard channel. Child-process leakage is fixed by allowlisting what children inherit, not by changing the inbound channel.

**Keep 2**

- **Var(s):** Runner-to-child test IPC
- **Reason kept:** Environment variables are the correct mechanism for passing state into spawned child processes.

**Keep 3**

- **Var(s):** `FORCE_COLOR`, `NO_COLOR`, `PATH`
- **Reason kept:** Standard terminal and system conventions.

## Test Plan

```bash
bun run check
bun test test/test-cases/validation/cli/option-resolution-contracts/
```

1. Type check and lint report no dangling references to removed variables.
2. `--bin-dir` overrides tool resolution; `--json` controls JSON logs; providers target trusted default endpoints.
3. Missing credentials fail with one error shape and exit code 2; `setup --doctor --strict` fails closed on configured defaults; spawned children do not inherit the full parent credential set.

## References

- Related ADR: [ADR-006](ADR-006-unify-the-logging-and-error-handling-vocabulary.md)
- Related ADR: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)
- Related ADR: [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md)
- `.env.example`
- `src/utils/base-urls.ts`
- `src/utils/runtime-paths.ts`
- `src/cli/commands/setup-and-utilities/setup/hosted-provider-config.ts`
- `src/utils/validate/env-utils.ts`
