# ADR-005: Reduce the Environment-Variable Surface Area

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-13
- **Date Updated:** 2026-07-23
- **Verification Status:** Passed

<!-- This record synthesizes four sequential passes over the env-var surface. All
     four are Accepted and implemented. Each Decision sub-part carries its own state
     tag, and the Keep table reflects the FINAL state with notes on where an earlier
     "keep" was later removed. -->

## Context

The project's environment-variable surface had accumulated waste, and a series of audits (the now-retired `env-vars-*` reports) drove four passes that each used a **different removal technique**. They are recorded together here as one progression rather than four restarts, because the interesting story is how the surface shrank — and where a var one pass deliberately *kept* a later pass was able to remove once a new technique or finding was in hand.

The operative goal across all four passes is constant: keep only env vars with a clear, defensible reason to exist — a production override with no CLI equivalent, a deliberate security boundary, a credential channel, or a load-bearing test-injection seam — and remove the rest. Functional test-harness infrastructure exercised by the contract suite is intentionally left in place.

The four passes, by technique:

1. **Delete dead / redundant / decorative keys** (and fix one var that was the *opposite* of dead).
2. **Change mechanisms** so a var's job survives without an env var at all (env→argv, env→OS API, self-set flag→parameter, drop defensive inbound reads), plus dead-doc cleanup and two correctness/security fixes.
3. **Remove test-only over-parameterization** and **consolidate** six per-tool binary overrides into one directory override.
4. **Eliminate the base-URL override family** by converting env reads into typed parameters, which makes the trust gate dead code and removes it too.

A recurring constraint shaped the binary-override decisions specifically: on macOS the resolver never consults `PATH` (`resolveRuntimeToolInfo` returns `undefined` on `darwin` when the managed binary is absent), so an `AUTOSHOW_*_BIN`-style override is the only way to point at a non-managed binary; and several contract suites inject fake binaries purely by setting these vars across a spawned-CLI boundary. That is why pass 3 *consolidated* rather than deleted them.

Why now: the configuration audit exposed dead knobs, misleading documentation, and inconsistent provider-endpoint handling that made the runtime surface harder to understand and secure.

## Options Considered

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| Leave the surface as-is | Zero work | `.env.example` keeps documenting non-functional vars; bugs persist | Rejected each round |
| **Pass 1: full prune across both namespaces + fix `SCRAPECREATORS_BASE_URL`** | Smallest honest surface; aligns `.env.example` with behavior; preserves seams/security knobs | Touches production + test + docs; removes some escape hatches and Docker guards | Chosen; removes 17, fixes 1 |
| **Pass 2: mechanism-change prune + doc cleanup + two fixes** | Converts env IPC/reads to argv/OS-API/parameters; closes a trust-gate gap | Touches production + Python + docs; drops the macOS custom-build-flag hatch | Chosen; removes ~9 reads, deletes 5 doc entries, fixes 2 |
| **Pass 3: prune test-only cruft + consolidate 6 binary vars → 1 `AUTOSHOW_BIN_DIR`** | Smallest surface short of breaking seams; one injection mechanism; preserves the macOS hatch | Updates five contract suites + doctor labels | Chosen; removes ~14 reads, 6→1 binary vars (net −5) |
| **Pass 4: base-URL env reads → typed `baseUrl` params, then delete the dead trust gate** | Largest cut; every seam preserved as a typed param; deletes a whole security module guarding nothing reachable | Drops runtime proxy/self-host repointing; ~17 providers + ~10 suites edited | Chosen; removes ~19 names |
| Wholesale / maximal removal (incl. test infra, `AUTOSHOW_OUTPUT_DIR`, the seams) | Maximally small | Breaks contract tests and injection seams for marginal gain | Rejected each round |
| Delete binary overrides outright (rely on managed + `PATH`) | Maximally small | Breaks five suites; removes the only non-managed binary path on macOS | Rejected (pass 3) |
| Remove base-URL family but keep the trust gate | Preserves defense-in-depth | The gate then exists only to satisfy tests; the override var configures nothing in production | Rejected (pass 4) |

## Decision

### Pass 1 — delete dead/redundant/decorative vars; fix the one inconsistent override *(Accepted)*

Remove 17 vars. `AUTOSHOW_`-prefixed dead `.env.example` keys (7): `AUTOSHOW_LOG_FORMAT`, `AUTOSHOW_LOG_LEVEL`, `AUTOSHOW_MEDIA_GENERATION_TIMEOUT_MS`, `AUTOSHOW_LLM_REQUEST_TIMEOUT_MS`, `AUTOSHOW_OCR_REQUEST_TIMEOUT_MS`, `AUTOSHOW_OCR_POLL_DEADLINE_MS`, `AUTOSHOW_LINKS_FETCH_TIMEOUT_MS` (logger format comes from `NODE_ENV` + CLI flags; `timeouts.ts` exports fixed constants). Redundant/dead (2): `AUTOSHOW_GENERATION_RESOURCE_CAPACITY` (capacity derives from the concurrency flags), `AUTOSHOW_TEST_BUDGET_HUNDREDTH_CENTS` (set/forwarded but read by nothing). Unused binary overrides (3): `AUTOSHOW_TESSERACT_BIN`, `AUTOSHOW_OCRMYPDF_BIN`, `AUTOSHOW_TESSDATA_PREFIX`. Non-prefixed (5): `NODE_ENV` (logging only), `HOSTNAME`/`HOST` (logging decoration), `ENV_FILE` (always `.env`), `DOCKER_CONTAINER` (drop the Docker skip-guards), `AGENT` (dead test fixture). **Fix, not remove:** wire `SCRAPECREATORS_BASE_URL` to the universal `readEnv(...) ?? DEFAULT` pattern so production honors the override (and its contract test passes). Operative rule for binary overrides: **keep iff it is a common tool OR a test seam.**

### Pass 2 — change mechanisms; clean dead docs; two fixes *(Accepted)*

Remove ~9 env reads by changing the mechanism, not deleting a dead key: `AUTOSHOW_PADDLE_OCR_MAX_SIDE`/`AUTOSHOW_PADDLE_OCR_MODEL_PROFILE` (env→subprocess argv; Python reads `sys.argv`), `HOME` *read* (env→`os.homedir()`; also fixes Windows), `AUTOSHOW_COMPACT_SETUP` (self-set env flag→in-process parameter), and the inbound *reads* of `PKG_CONFIG_PATH`/`LDFLAGS`/`CPPFLAGS`/`DYLD_LIBRARY_PATH` (drop the trailing `process.env[X] ?? ''`; build purely from managed dirs — these vars are still *written* into the build subprocess, only the inbound read is dropped). Delete 5 misleading doc entries: the `.env.example` yt-dlp block (`YTDLP_COOKIES`, `YTDLP_COOKIES_FROM_BROWSER`, `YTDLP_EXTRACTOR_ARGS` — flag-driven, never env-read) and the phantom `AUTOSHOW_URL_REQUEST_TIMEOUT_MS`/`AUTOSHOW_URL_REQUEST_ATTEMPTS` "env …" help text. **Fix, not remove (2):** rename `.env.example` `HF_TOKEN` → `HUGGINGFACE_TOKEN` (all code reads the latter, so the documented name silently disabled Reverb); route the benchmark roundtrip's `ASSEMBLYAI_BASE_URL`/`OPENAI_BASE_URL` reads through `base-urls.ts`
+ the trust gate (closing a gate gap on an already-tested seam).

### Pass 3 — remove test-only over-parameterization; consolidate binary overrides *(Accepted — implemented)*

Remove the adaptive-concurrency *tuning* knobs (10 reads: `AUTOSHOW_TEST_ADAPTIVE_MAX_ATTEMPTS`, `…_INITIAL_PROVIDER_LIMIT`, `…_GROUP_INITIAL_LIMITS`, `…_RATE_LIMIT_COOLDOWN_MS`, `…_TRANSIENT_COOLDOWN_MS`, `…_SUCCESS_STREAK_TO_INCREASE`, `…_ACQUIRE_POLL_MS`, `…_LOCK_WAIT_MS`, `…_LOCK_STALE_MS`, `…_STATE_DIR`) — as implemented, the env reads are removed and the parser's second parameter is **retyped** from an env `Record<string,string>` to a typed `Partial<Omit<AdaptiveConcurrencyConfig,'stateDir'>>` merged over the `DEFAULT_*` constants, with `runCommand` gaining typed `adaptiveStateDir`/`adaptiveConfig` options so contract tests configure the scheduler in code, not via env (keeping `…_STATE_DIR`'s path *derivation* from `AUTOSHOW_TEST_ARTIFACTS_DIR`). Inline the never-set `AUTOSHOW_TEST_RUN_ID` (permanently `'local'`). Rename the three throwaway fixture key-strings (`AUTOSHOW_SERVICE_TEST_SYNC_ENV_KEY`/`…_DOTENV_KEY`/`…_MISSING_KEY`) off the `AUTOSHOW_` prefix. **Consolidate** the six per-tool binary overrides (`AUTOSHOW_FFMPEG_BIN`, `AUTOSHOW_FFPROBE_BIN`, `AUTOSHOW_YTDLP_BIN`, `AUTOSHOW_MUTOOL_BIN`, `AUTOSHOW_EBOOK_CONVERT_BIN`, `AUTOSHOW_DEFUDDLE_BIN`) into one `AUTOSHOW_BIN_DIR` directory override checked before the managed path — per-tool granularity preserved by file *presence* in the directory; route the non-`runtime-paths` readers (`shared-yt-dlp-binary.ts`, `dl-document.ts`, the defuddle resolver) and the doctor labels through it. Keep the two genuine runner→child master switches (`AUTOSHOW_TEST_ADAPTIVE_CONCURRENCY`, `…_ADAPTIVE_E2E_SELECTION`).

### Pass 4 — eliminate the base-URL override family and the trust gate *(Accepted — implemented)*

Convert each `readEnv('X_BASE_URL') ?? X_DEFAULT_BASE_URL` read into a typed `baseUrl` **parameter** defaulting to the `base-urls.ts` constant (the constants stay as the new defaults). The resolved URL already threads from each provider's resolver into its fetch helper; only the *source* changes. Production never passes the param (so runtime proxy/self-host repointing — undocumented, no E2E coverage — is dropped); contract suites pass it directly, and since every injection is **in-process** (set env + `installMockFetch`
+ call the provider function — no test spawns the CLI with a base-URL env), the typed param does the seam's whole job. 18 names removed across gated providers (`OPENAI_BASE_URL`, `ANTHROPIC_BASE_URL`, `MISTRAL_BASE_URL`, `XAI_BASE_URL`, `CEREBRAS_BASE_URL`, `TOGETHER_BASE_URL`) and ungated direct-fetch providers (`ZAI_BASE_URL`, `SUPADATA_BASE_URL`, `BFL_BASE_URL`, `REVE_BASE_URL`, `RECRAFT_BASE_URL`, `REPLICATE_BASE_URL`, `SCRAPECREATORS_BASE_URL`, `FIRECRAWL_API_URL`, `SPIDER_API_URL`, `ZYTE_API_URL`, `UNSTRUCTURED_API_URL`), plus the benchmark-only `ASSEMBLYAI_BASE_URL` (pass 2 had routed it through the gate; here it reverts to the plain default). With no runtime path able to produce a non-default host, the trust gate `assertProviderBaseUrlTrusted()` guards nothing reachable: **delete** `provider-url-policy.ts` in full, every call site (`openai-client.ts`, `anthropic-client.ts`, `mistral-client.ts`, `replicate-prediction.ts`'s `assertReplicateUrlTrusted`, `gemini-rest.ts`), and the override var `AUTOSHOW_ALLOW_UNTRUSTED_PROVIDER_BASE_URLS`. Migrate the in-process contract seams to the typed param (drop the base-URL keys from `snapshotEnv`/`restoreEnv` and the `…ALLOW_UNTRUSTED…` `beforeEach`; `installMockFetch` and the `call.url` routing assertions are unchanged).

### Keep (with rationale) — final state

This reflects what survives after all four passes. Where a var was kept by an earlier pass and removed by a later one, that is noted rather than implied.

| Var(s) | Reason kept |
|---|---|
| Provider API keys (~37) | Credentials must enter the process somehow; env is the standard channel with no better alternative |
| Runner→child IPC vars (`AUTOSHOW_OUTPUT_DIR`, `…_TEST_ARTIFACTS_DIR`, `…_COMMAND_LOG`, `…_METRICS_LOG`, `…_PRESERVE_ARTIFACTS`, `…_BUDGET_SKIP_KEYS`, `…_BUDGET_EVALUATED_KEYS`, `…_PROCESS_LOCK_DIR`/`LOCK_ROOT`, `…_E2E_TEST_TIMEOUT_MS`) | Env is the correct mechanism for passing state into spawned child processes |
| `AUTOSHOW_TEST_ADAPTIVE_CONCURRENCY`, `…_ADAPTIVE_E2E_SELECTION` | Genuine runner→child master switches, not tuning knobs (pass 3) |
| Defuddle fake-binary mocks (`AUTOSHOW_DEFUDDLE_ARGS_LOG`, `…_FAKE_DEFUDDLE_MODE`, `…_FAKE_DEFUDDLE_STDERR`) | Cross-process IPC into the spawned fake binary |
| `AUTOSHOW_BIN_DIR` | The consolidated binary override / macOS non-managed escape hatch and cross-process test seam (pass 3, replacing the six per-tool `AUTOSHOW_*_BIN` vars kept in pass 1) |
| `FORCE_COLOR`, `NO_COLOR`, `PATH` | Standard terminal/system conventions |

> Removed despite earlier "keep": the six per-tool `AUTOSHOW_*_BIN` overrides (kept in pass 1 as common-tool/test seams) were consolidated into `AUTOSHOW_BIN_DIR` in pass 3; the 18 `*_BASE_URL`/`*_API_URL` overrides and `AUTOSHOW_ALLOW_UNTRUSTED_PROVIDER_BASE_URLS` (kept through passes 1–3 as injection seams + a security knob) were removed in pass 4 once the seams proved to be entirely in-process.

This applies to:

- Runtime and documented environment variables, binary overrides, test IPC seams, and provider endpoint configuration.
- No required credential variables, intentional runner-to-child IPC, standard system variables, or typed in-process test seams.

## Rationale

Each pass applied a from-scratch retention test with a sharper tool than the last. Pass 1's targets were *dead* — inert, duplicated by a flag, or pure logging decoration. Pass 2's were *unnecessary* rather than dead: each one's job survives a mechanism change (argv carries PaddleOCR tuning more legibly than env, `os.homedir()` is a more correct source than `$HOME`, a parameter is the honest form of a flag the process sets for itself, managed build dirs suffice on their own). Pass 3 attacked *over-parameterization*: nine scheduler dials nothing ever set, a read-but-never-written run-id, and three test literals wearing the `AUTOSHOW_` prefix — while recognizing that deleting the binary overrides was wrong (macOS never consults `PATH`; five suites depend on them) so one `AUTOSHOW_BIN_DIR` carries every seam with a cleaner contract. Pass 4 retired the base-URL family on the finding that every seam is in-process, so a typed parameter does the seam's whole job and a default constant does production's; the trust gate follows by construction, guarding nothing a production caller can reach. The credential, IPC, master-switch, binary, and standard vars are kept throughout on the same grounds: load-bearing, with no better mechanism.

## Consequences

Positive outcomes:
- A much smaller, honest config surface: `.env.example` documents only functional vars; log format is driven solely by `--json`, generation capacity solely by the concurrency flags; Reverb activates from the documented token; phantom knobs are gone.
- Fewer env reads to reason about during debugging/onboarding (pass 2 alone ~9; pass 3 ~14 plus 5 fewer binary names); PaddleOCR's TS→Python contract is self-documenting in argv; `process-lock` resolves its cache dir portably (works on Windows).
- One obvious binary-injection mechanism (`AUTOSHOW_BIN_DIR`); the adaptive config is a static typed object; the `AUTOSHOW_` audit stops counting test literals.
- Every provider resolves to its real, trusted endpoint by construction — "which host does this provider call?" has one answer (the `base-urls.ts` constant). A whole security module and its override var are **deleted**, not merely documented; contract seams keep routing assertions via a typed param, immune to cross-test env leakage.

Negative outcomes:
- Removes user escape hatches: tesseract/ocrmypdf binary paths and the tessdata dir (pass 1), custom macOS build flags (pass 2), per-tool `AUTOSHOW_*_BIN` (pass 3 → place the binary in an `AUTOSHOW_BIN_DIR` directory), and runtime proxy/self-host repointing via `X_BASE_URL` (pass 4 → run a local proxy presenting the default host, or restore the seam in a fork).
- Dropping the Docker guards means Linux always runs the install/health paths; container builds must tolerate them. The PaddleOCR argv change requires TS and Python to agree on argument order (a mismatch is a runtime error, caught fast). Refactor-wide misses (binary seams, ~17 providers + ~10 suites) surface as typecheck/test failures (CI), not silent misses.

## Trade-offs

| Gains | Sacrifices |
|---|---|
| Smaller, honest config surface; single source of truth for log format and capacity | A few rarely-used override escape hatches; implicit behaviors become fixed |
| ~Many env reads converted to argv / OS API / typed params | Several ambient configuration points become explicit code paths |
| One binary mechanism + macOS hatch preserved; all binary seams kept | Per-tool override moves from a var per tool to a file per tool in one directory; five suites + doctor labels updated |
| Providers always hit their trusted default endpoint; dead trust gate + override deleted | Runtime proxy/self-host repointing no longer possible without a code change; ~10 suites + ~17 providers edited |

## Implementation Note

| Action | Owner | Current State |
|---|---|---|
| Pass 1: prune dead configuration and fix the inconsistent `SCRAPECREATORS_BASE_URL` override | CLI maintainers | Implemented across `.env.example`, runtime configuration, setup, test-runner, and provider files |
| Pass 2: replace unnecessary environment mechanisms and correct documentation and credential naming | CLI maintainers | Implemented across PaddleOCR, setup, process locking, CLI help, and benchmark files |
| Pass 3: remove test-only tuning variables and consolidate binary overrides into `AUTOSHOW_BIN_DIR` | CLI and test maintainers | Implemented; six per-tool overrides and adaptive tuning reads removed |
| Pass 4: replace provider base-URL environment reads with typed parameters and remove the dead trust gate | Provider maintainers | Implemented across provider clients, benchmark callers, contract suites, and `.env.example` |

**Verification (per pass):**
1. `bun run typecheck` and lint — no dangling references to removed vars, deleted helpers (`readEnvCapacity`, `resolveE2EChildTimeoutDefaults`), the deleted gate, or `provider-url-policy.ts`.
2. Grep sweeps return **zero** matches for the removed names — the pass-1/2 dead keys (`DOCKER_CONTAINER`, `ENV_FILE`, `AGENT`, `HOSTNAME`/`HOST`/`NODE_ENV`, the yt-dlp + `AUTOSHOW_URL_REQUEST_*` doc names, `HF_TOKEN`), the pass-3 set (`AUTOSHOW_(FFMPEG|FFPROBE|YTDLP|MUTOOL|EBOOK_CONVERT|DEFUDDLE)_BIN`, `AUTOSHOW_TEST_ADAPTIVE_(MAX_ATTEMPTS|INITIAL_PROVIDER_LIMIT|GROUP_INITIAL_LIMITS|RATE_LIMIT_COOLDOWN_MS|TRANSIENT_COOLDOWN_MS|SUCCESS_STREAK|ACQUIRE_POLL_MS|LOCK_WAIT_MS|LOCK_STALE_MS|STATE_DIR)`, `AUTOSHOW_TEST_RUN_ID`, `AUTOSHOW_SERVICE_TEST_`), and the pass-4 base-URL family + `assertProviderBaseUrlTrusted`/`assertReplicateUrlTrusted`.
3. Contract suites pass against the new seams: logging, process-lock (`LOCK_ROOT`), OCR/epub/html-url/links binary seams (via `AUTOSHOW_BIN_DIR`), adaptive-concurrency (typed config), service-test-kit, scrapecreators, voice-quality-report, and the migrated base-URL provider suites (each still asserting the request reached the param-supplied host).
4. Sanity-run the CLI: default → human logs, `--json` → JSON logs; `doctor`/`setup` reports tools via managed/`AUTOSHOW_BIN_DIR`/`PATH` (and as `override` on macOS where `PATH` is never consulted); YouTube cookies via `--cookies-from-browser`; PaddleOCR runs a non-default max-side via argv; Reverb activates with `HUGGINGFACE_TOKEN`; each provider targets its `base-urls.ts` default with no env, and a now-defunct `*_BASE_URL` has no effect.

## References

- Historical inventory of record: the retired `env-vars.md`
- Pass-1 source plans/reports: `project/plans/env-vars-autoshow-plan.md`, `project/plans/env-vars-other-plan.md`; `project/reports/env-vars-autoshow.md`, `project/reports/env-vars-other.md`, `project/reports/env-vars-third-party.md`
- Originating task: `todo/clean.md`
- Key modules: `src/utils/base-urls.ts`, `src/utils/runtime-paths.ts`, `src/utils/process-lock.ts`, `test/test-runner/adaptive-concurrency.ts` (the deleted `src/utils/provider-url-policy.ts` is referenced here as history)
