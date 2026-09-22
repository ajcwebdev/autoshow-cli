# ADR-005: Reduce the Environment-Variable Surface Area

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-13
- **Date Updated:** 2026-09-22
- **Verification Status:** Passed
- **Supersession:** The removed container-detection interface and its runtime consequences moved to [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md). This record remains accepted authority for the environment-variable surface.

## Context

The environment-variable surface had accumulated dead keys, `.env.example` entries and help text for variables that do nothing, inconsistent provider-endpoint overrides, duplicated credential lists, missing-key failures that differed by provider, an advisory-only doctor command, and full parent-environment inheritance into child processes.

Keep a variable only when it carries a credential, is a production override with no CLI equivalent, marks a security boundary, or must be passed into a spawned process. Everything else is a CLI flag, a typed parameter, an OS API, or a fixed constant.

Why now: a configuration audit showed the surface was documenting and inheriting variables the CLI does not use.

## Options Considered

**Option 1 (selected)**

- **Option:** Shrink the environment-variable surface to credentials, standard system variables, and values spawned processes must receive; replace everything else with CLI flags, typed parameters, OS APIs, or trusted defaults; keep one credential list, one missing-key error, a `setup --doctor --strict` gate, and an allowlisted child environment
- **Pros:** `.env.example` matches behavior; `--bin-dir` replaces per-tool overrides; trusted default endpoints; one missing-key contract; a CI readiness gate; spawned tools stop inheriting unrelated credentials
- **Cons:** Removes ad-hoc environment escape hatches; missing-credential paths that used to exit 1 now exit 2
- **Quantitative Notes:** Six per-tool binary variables became `--bin-dir`; missing-key failures use exit code 2 per [ADR-006](ADR-006-unify-the-logging-and-error-handling-vocabulary.md)

**Option 2**

- **Option:** Leave the environment-variable surface as-is
- **Pros:** Zero implementation effort
- **Cons:** `.env.example` documents variables that do nothing; help text and base-URL overrides stay inconsistent
- **Quantitative Notes:** n/a

**Option 3**

- **Option:** Remove every non-credential variable, including values passed into spawned processes
- **Pros:** Smallest runtime surface
- **Cons:** Breaks child processes that must receive explicit state, for little further gain
- **Quantitative Notes:** n/a

**Option 4**

- **Option:** Remove runtime base-URL overrides but keep a switch that exists only so tests can repoint endpoints
- **Pros:** Leaves a second check in front of the trusted defaults
- **Cons:** The switch would configure nothing a user can set
- **Quantitative Notes:** n/a

**Option 5**

- **Option:** Keep separate credential lists and fix inconsistencies as they surface
- **Pros:** No migration; each fix is small
- **Cons:** Rejected; the lists had already drifted into dead entries and different errors, and every new provider repeats that drift
- **Quantitative Notes:** n/a

**Option 6**

- **Option:** Replace environment credentials with a credential file or OS keychain
- **Pros:** Removes credentials from the environment, so child processes cannot inherit them
- **Cons:** Rejected; environment variables are the standard credential channel, deployment guides and the Docker credential boundary ([ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md)) assume them, and an allowlist stops the actual exposure of full-environment inheritance
- **Quantitative Notes:** Would require migrating every operator secret plus Docker and CI documentation

## Decision

Keep only environment variables that carry credentials, pass state into spawned child processes, follow a standard system convention, or have no CLI equivalent. Everything else is a CLI flag, a typed parameter, an OS API, or a fixed constant.

Provider credentials stay environment variables and are listed in `.env.example`. One credential list drives missing-key hints and `setup --doctor`. A missing credential fails with one error that names the variable, includes a hint URL, and exits 2. `setup --doctor` stays advisory. `setup --doctor --strict` exits non-zero when configured defaults lack credentials, configuration is invalid, configured cookies are unreadable, or a required runtime or model asset is unavailable. Spawned children receive `PATH`, `HOME`, terminal controls, and values they explicitly need. They do not receive the parent credential set. Saved run output does not store raw credential values. Binary location overrides use `--bin-dir`, checked before managed paths and `PATH`. Provider clients use trusted default endpoints. Runtime base-URL environment overrides are not supported.

This applies to:

- Runtime environment variables, `.env.example`, binary tool overrides, and provider endpoint configuration.
- Readiness and failure behavior: `setup --doctor --strict`, missing-credential errors, and what spawned children inherit.

It does not apply to:

- Provider credential keys, which still arrive through environment variables.
- State a process deliberately passes to a spawned child.
- Standard system variables (`PATH`, `HOME`, `NO_COLOR`, `FORCE_COLOR`).
- Error classes and how errors are rendered. The missing-credential contract uses the `AppError` taxonomy that [ADR-006](ADR-006-unify-the-logging-and-error-handling-vocabulary.md) owns.
- Docker credential delivery through Docker's `--env-file` and `-e` options. [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md) owns the container credential boundary; mounted `/app/.env` files are intentionally not loaded.

## Rationale

- A variable that does nothing, or that only duplicates a flag, does not belong in `.env.example` or help text.
- `--bin-dir` is the binary override. Per-tool environment variables were a second interface for the same job.
- Callers use trusted default endpoints, so a runtime base-URL variable is not configuration.
- Environment variables remain the credential channel. Replacing that channel would break deployment guides and the Docker credential boundary in [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md).
- One credential list and exit code 2 make a missing key predictable for scripts.
- `setup --doctor --strict` is the deployment gate. Default doctor stays advisory.
- An allowlist of what children inherit stops credential leakage while callers keep supplying keys the same way.

## Consequences

Positive outcomes:

- `.env.example` lists only variables the CLI reads.
- `--bin-dir` is the only binary override.
- Provider clients use trusted default endpoints.
- Missing credentials share one error and exit code 2.
- `setup --doctor --strict` can gate CI.
- Spawned tools do not receive unrelated credentials, and saved run output does not store raw credential values.

Negative outcomes:

- Per-tool binary overrides, build flags, and runtime base-URL repointing are gone.
- Scripts that treated a missing credential as exit 1 now see exit 2.
- Each tool's child-environment allowlist has to stay accurate. A list that omits a variable the tool reads can break that tool.

## Trade-offs

**Trade-off 1**

- **Gain:** A config surface that matches what the CLI reads
- **Sacrifice:** Rarely used environment overrides

**Trade-off 2**

- **Gain:** Providers target trusted default endpoints
- **Sacrifice:** Pointing a provider at a proxy or a self-hosted endpoint takes a local proxy or a code change

**Trade-off 3**

- **Gain:** One missing-credential error and exit code
- **Sacrifice:** Scripts pinned to exit 1 on a missing key follow the [ADR-006](ADR-006-unify-the-logging-and-error-handling-vocabulary.md) contract and expect exit 2

**Trade-off 4**

- **Gain:** Each credential stays in the process that needs it
- **Sacrifice:** Maintaining per-tool allowlists, including variables third-party tools read on their own

## Implementation Note

`.env.example` lists working credential variables. `--bin-dir` is the binary override. Provider clients use trusted default endpoints. Missing credentials use the [ADR-006](ADR-006-unify-the-logging-and-error-handling-vocabulary.md) error contract. `setup --doctor --strict` and child-environment allowlisting are in place.

### Bun 1.4 Dotenv Compatibility

On 2026-08-31 the local `.env` parsed to the same values under Bun 1.3.14 and Bun 1.4.0. Reproduce that comparison from the [runtime validation instructions](../docker.md#runtime-validation). The comparison must not print credential values.

## Test Plan

```bash
bun run check
bun test test/test-cases/validation/cli/child-env-contracts.test.ts
bun test test/test-cases/validation/setup/setup-doctor-contracts.test.ts
bun test test/test-cases/validation/setup/env-example-drift-contracts.test.ts
```

1. `bun run check` passes against the reduced surface.
2. Child-environment contracts prove a spawned child does not see unrelated provider credentials.
3. Doctor contracts prove `setup --doctor` stays advisory and `setup --doctor --strict` exits 2 for missing configured credentials and other readiness warnings.
4. `.env.example` stays aligned with the credential list.

## References

- Related ADR: [ADR-006](ADR-006-unify-the-logging-and-error-handling-vocabulary.md)
- Related ADR: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)
- Related ADR: [ADR-014](ADR-014-distribute-the-cli-as-a-docker-image.md)
- `.env.example`
- [Setup](../commands/00-setup-and-utilities/setup.md)
