# ADR-017: Govern All Documentation Command Examples as Executable Contracts

## Status

- **Decision Status:** Proposed
- **Date Created:** 2026-08-13
- **Date Updated:** 2026-08-13
- **Verification Status:** Pending

## Context

Every command printed in project documentation is a product promise. That includes the curated root `README.md`, detailed command references, setup and service-test guides, Docker instructions, release notes, diagrams, ADRs, generated benchmark reports, generated analysis reports, and report templates. A reader cannot reliably distinguish a maintained copy-and-paste example from stale historical evidence, expected output, a deliberately invalid example, a placeholder, or a paid service command unless the repository makes that distinction explicit.

The original ADR scoped this contract to the 53 concrete AutoShow invocations in the root README. That scope was too narrow. The command-reference documents contain the majority of examples, repeat many commands with different provider, model, input, and output combinations, and expose substantially more missing-fixture, route, price, network, state, and option-drift defects than the README alone. Architecture and operational documents also contain commands that can mutate configuration, install software, build images, contact third parties, execute paid providers, or change Git state. Generated and historical documents may quote commands that should remain preserved as evidence but must not silently become current executable guidance.

This decision therefore governs literally every shell-like command occurrence in the root README and every Markdown file beneath `docs/`. It does not treat every occurrence as safe to execute. Instead, it requires exhaustive extraction, explicit occurrence-level classification, and a verification policy appropriate to the command's intent and risk.

Why now: a point-in-time whole-documentation audit found 1,455 shell-like candidate occurrences in 164 Markdown files. The root README accounts for only 75 of those candidates, and its 53 concrete AutoShow invocations account for less than seven percent of the 785 concrete AutoShow occurrences across the governed corpus. README-only enforcement would leave the main command-reference surface and every operational, architectural, generated, and historical document outside the contract.

## Audit Corpus and Method

### Literal corpus boundary

The audit snapshot was taken before this repository-wide revision of ADR-017 so the ADR's own evidence does not recursively change the audited totals. The corpus contained:

- The root `README.md`.
- Every `*.md` file recursively beneath `docs/`, including ignored or untracked Markdown present in the working tree at audit time.
- All fenced `bash`, `sh`, `shell`, `zsh`, and `console` statements, including continued commands.
- All command-looking inline code spans and indented shell examples.
- Every occurrence independently, even when the same command string appeared in more than one file or more than once in the same file.

The corpus intentionally excludes `AGENTS.md`, because it is agent policy rather than product documentation, and Markdown fixtures beneath `input/`, because they are workflow inputs rather than documentation beneath the governed `README.md` and `docs/` surfaces. If either category becomes user-facing documentation, it must be added deliberately rather than entering through an ambiguous glob.

### Safety boundary

The audit did not execute any paid or quota-limited provider. It did not execute setup, config, links, benchmark, resume, version, help, deliberately invalid, generic placeholder, Docker, Git mutation, package-install, service/e2e, or arbitrary external-tool commands. Those occurrences were inventoried and classified for a future static or targeted contract.

Concrete AutoShow workflows with a supported price route were deduplicated by exact command string, run once with `--price`, and mapped back to every documentation occurrence. Runs used an isolated temporary config, outbound HTTP and HTTPS proxies pointed at a closed local endpoint, no provider credentials were required, and each process had a bounded timeout. The repository config remained byte-for-byte unchanged, and no recent files appeared beneath the normal input, output, project, or config paths.

This audit used a temporary extractor to establish the decision evidence. The accepted implementation must replace it with a committed Markdown-aware extractor, typed inventory, and deterministic test; the snapshot numbers are evidence, not the long-term source of truth.

## Current Audit Evidence

### Documentation surface

All 164 Markdown files were scanned, including files with no command candidates.

| Documentation family | Markdown files | Shell-like candidate occurrences |
|---|---:|---:|
| Root README | 1 | 75 |
| Command references (`docs/commands.md` and `docs/commands/**`) | 18 | 776 |
| Architecture and diagrams (`docs/adr/**` and `docs/diagrams/**`) | 26 | 236 |
| Test and service guides (`docs/tests/**`) | 11 | 89 |
| Generated benchmark evidence (`docs/benchmarks/**`) | 94 | 0 |
| Generated reports (`docs/reports/**`) | 6 | 188 |
| Report templates (`docs/templates/**`) | 3 | 8 |
| Other operator guides at `docs/*.md` | 4 | 83 |
| **Total** | **164** | **1,455** |

The zero candidate count in generated benchmark evidence is still a verified result: those 94 files are inside the corpus and cannot acquire an unclassified command in a future regeneration.

### Candidate command surfaces

Candidate extraction is intentionally broader than executable-command classification. Filenames, expected output, environment assignments, historical quotations, and command-like prose may be candidates that the inventory must explicitly reject or classify rather than silently ignore.

| Candidate surface | Occurrences | Current concrete candidates |
|---|---:|---:|
| AutoShow (`bun autoshow`, `bun as`, and canonical bare form) | 881 | 785 |
| Other Bun commands | 231 | 229 |
| Docker commands | 20 | 13 |
| External tools such as `curl`, `ffmpeg`, `yt-dlp`, package managers, and runtimes | 92 | 91 |
| Git and GitHub commands | 11 | 11 |
| Other shell statements, assignments, builtins, and command-like candidates | 220 | 151 |
| **Total** | **1,455** | **1,280** |

The 175 non-concrete candidates contain explicit placeholders or template syntax. They still require inventory entries because a placeholder that becomes concrete must change verification policy in the same documentation change.

### Concrete AutoShow outcomes

The 785 concrete AutoShow occurrences represent 545 distinct exact command strings. Of those, 259 occurrences were utilities, help/version behavior, or commands whose normal behavior is not a price workflow; two were invalid or expected-output examples. The remaining 524 priceable occurrences represent 397 distinct command strings that were evaluated once and mapped back to every occurrence.

| Outcome | Occurrences | Distinct command strings | Cost represented |
|---|---:|---:|---:|
| Numeric zero estimate | 124 | 74 | 0.000 cents |
| Numeric nonzero estimate | 237 | 196 | 5,877.901 cents occurrence-based |
| Exit 0 without a numeric total | 45 | 28 | Unknown or unreported |
| Nonzero failure | 90 | 75 | Unknown or not applicable |
| Bounded timeout during network or preflight work | 28 | 24 | Unknown |
| Utility or non-price behavior | 259 | 146 | Not priceable |
| Invalid example or expected output misidentified as a command | 2 | 2 | Not applicable |
| **Total** | **785** | **545** | **5,877.901 cents directly reported by occurrence** |

The occurrence-based directly reported subtotal is 5,877.901 cents ($58.77901). Deduplicating identical command strings produces 5,759.181 cents ($57.59181), but that figure does not represent the documented user journey because repeated occurrences are separately visible promises. Neither subtotal is a complete cost for all documentation: 163 priceable occurrences failed, timed out, or returned no numeric total and cannot be silently treated as free.

### Outcomes by documentation family

| Documentation family | Concrete AutoShow occurrences | Numeric nonzero | Numeric zero | Exit 0 without total | Failure | Timeout | Utility | Invalid/output |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Root README | 53 | 12 | 16 | 4 | 5 | 0 | 16 | 0 |
| Architecture and diagrams | 73 | 12 | 16 | 4 | 7 | 1 | 32 | 1 |
| Command references | 628 | 211 | 86 | 37 | 74 | 25 | 195 | 0 |
| Other operator guides | 31 | 2 | 6 | 0 | 4 | 2 | 16 | 1 |
| **Total** | **785** | **237** | **124** | **45** | **90** | **28** | **259** | **2** |

The command references are the dominant contract surface and contain 136 of the 163 incomplete priceable outcomes. Restricting enforcement to the README would therefore verify the smallest and comparatively cleanest part of the documentation while leaving the largest source of user-facing drift unchecked.

### Outcomes by AutoShow command

| Command | Occurrences | Numeric nonzero | Numeric zero | Exit 0 without total | Failure | Timeout | Utility/invalid |
|---|---:|---:|---:|---:|---:|---:|---:|
| `metadata` | 20 | 0 | 19 | 0 | 0 | 1 | 0 |
| `download` | 24 | 0 | 14 | 0 | 0 | 10 | 0 |
| `extract` | 147 | 70 | 46 | 0 | 15 | 16 | 0 |
| `write` | 81 | 45 | 28 | 3 | 4 | 1 | 0 |
| `tts` | 55 | 42 | 6 | 0 | 6 | 0 | 1 |
| `image` | 48 | 30 | 0 | 0 | 18 | 0 | 0 |
| `video` | 47 | 29 | 0 | 0 | 18 | 0 | 0 |
| `music` | 32 | 21 | 11 | 0 | 0 | 0 | 0 |
| `comic` | 55 | 0 | 0 | 32 | 23 | 0 | 0 |
| `voice` | 16 | 0 | 0 | 10 | 6 | 0 | 0 |
| `config` | 66 | 0 | 0 | 0 | 0 | 0 | 66 |
| `setup` | 87 | 0 | 0 | 0 | 0 | 0 | 87 |
| `links` | 53 | 0 | 0 | 0 | 0 | 0 | 53 |
| `benchmark` | 13 | 0 | 0 | 0 | 0 | 0 | 13 |
| `resume` | 22 | 0 | 0 | 0 | 0 | 0 | 22 |
| Bare CLI, help, version, and invalid/output candidates | 19 | 0 | 0 | 0 | 0 | 0 | 19 |
| **Total** | **785** | **237** | **124** | **45** | **90** | **28** | **261** |

The final column combines 259 utilities with two invalid or expected-output candidates so the command rows reconcile to the corpus total.

### Defect clusters exposed by whole-documentation coverage

The expanded audit confirms the original README defects and adds broader classes that were invisible at README scope:

- Price safety is not universal. `config --price` can mutate persistent state, some voice subcommands reject `--price`, quiet mode can suppress the requested result, and successful voice/comic price paths frequently omit numeric totals.
- Network-free determinism is incomplete. Ten download occurrences, sixteen extract occurrences, one metadata occurrence, and one write occurrence did not settle within the bounded offline audit because URL, playlist, caption, or media preflight still depended on remote work.
- Staged media documentation is not clean-checkout reproducible. Eighteen image occurrences and eighteen video occurrences reference generated or example inputs that do not exist before an earlier normal execution creates them, but price mode correctly creates no such artifact.
- Comic documentation has no successful numeric price path in the current corpus. Thirty-two occurrences exit 0 without a total, while 23 fail on absent scripts, scene bundles, panel prompts, character catalogs, dialogue plans, or shorthand project directories.
- Voice documentation has no numeric price path in the current corpus. Ten occurrences exit 0 without a total, while six fail on absent voice catalogs, registrations, candidates, consent assets, or unsupported price flags.
- Extract documentation mixes missing fixture paths, route-incompatible providers, hosted EPUB pricing without normalized page counts, transcript-derived video inputs that do not exist, fake remote URLs, and commands requiring live network discovery.
- TTS documentation contains missing local inputs, outdated cloning flags, ambiguous multi-provider voice selection, and provider-specific authorization prerequisites.
- Command synopsis and historical output can look executable. Generic bracket forms, release-version output, quoted failure commands, and ADR audit evidence need explicit `template`, `expected-output`, `historical`, or `invalid-example` classification.
- Non-AutoShow docs include package installation, Docker builds and runs, Git operations, external downloads, media tools, API-key assignments, and service/e2e commands. A generic execute-everything harness would be unsafe even though exhaustive inventory is required.
- Duplicate command strings occur across the README, command references, ADR evidence, release notes, and reports. Executing unique strings is efficient, but coverage and cost reporting must remain occurrence-based so removal, duplication, and context drift are visible.

## Options Considered

| Option | Pros | Cons | Quantitative notes |
|---|---|---|---|
| **Govern every command occurrence in the root README and all Markdown beneath `docs/` through one classified inventory and policy-aware harness** | Matches the literal user-facing surface, catches cross-document drift, makes unsafe examples explicit, supports deduplicated execution with occurrence-based reporting, and covers generated/historical material without executing it | Requires a Markdown-aware extractor, a larger inventory, risk-specific policies, stable fixtures, and generated-report integration | Covers 164 files, 1,455 candidates, and 785 concrete AutoShow occurrences in the current snapshot |
| Govern only the README | Smallest implementation and fastest test | Leaves 732 concrete AutoShow occurrences outside the contract and misses the majority of observed failures | Covers 53 of 785 concrete AutoShow occurrences |
| Govern README plus primary command references, excluding ADRs, reports, diagrams, templates, and test guides | Covers most current usage docs with less classification work | Still permits stale or unsafe commands in user-visible operational, architectural, generated, and historical documents; violates the literal all-docs boundary | Omits 110 concrete AutoShow occurrences and 679 other shell-like candidates from non-command-reference surfaces |
| Parse and execute every shell-looking candidate indiscriminately | Minimal policy design and superficially broad runtime coverage | Can install software, mutate config or Git state, build or run containers, contact paid providers, execute service suites, follow stale historical commands, and mistake output for input | The corpus includes 674 non-AutoShow candidates plus 259 non-price AutoShow utility occurrences |
| Rely on manual documentation review and occasional price audits | No committed inventory or harness | Drift recurs, occurrence coverage is not reproducible, safety depends on reviewer memory, and aggregate costs cannot be trusted | The point-in-time audit required command-specific classification and bounded offline execution of 397 distinct priceable strings |

## Decision

Govern every shell-like command occurrence in the root `README.md` and every Markdown document recursively beneath `docs/` through a single typed inventory and a targeted, local-only documentation contract test.

The extractor must be Markdown-aware. It must inspect supported shell fences, console prompts, line continuations, indented code, and command-looking inline code while preserving file, section, source kind, occurrence ordinal, and normalized command text. It must emit broad candidates rather than silently guessing intent. Every extracted occurrence must match exactly one inventory entry, and every inventory entry must match a current occurrence. A new candidate, removed command, changed command, duplicate occurrence, or stale entry must fail locally.

Each inventory entry must record at least:

- Stable occurrence identity, document family, file, section, source kind, and exact authored command text.
- Primary classification: `priceable`, `local-runnable`, `utility`, `stateful`, `paid-execution`, `staged`, `template`, `invalid-example`, `historical`, `generated-evidence`, `expected-output`, or `external-tool`.
- Execution policy: `price`, `local-execute`, `parse-only`, `help-only`, `stubbed`, `generated-source`, or `never-execute`.
- Prerequisites, fixture substitutions, expected route, expected exit behavior, warnings, network allowance, provider-call allowance, mutation allowance, artifact allowance, timeout class, and price expectation.
- Whether identical command strings may share one execution result and how the result maps back to every occurrence.
- Ownership and source-of-truth metadata for generated docs so a regenerated command is corrected at its generator rather than patched only in output.

Priceable AutoShow examples must run with structured price output, make zero provider calls, use isolated temporary configuration and output roots, produce a numeric total including explicit zero for free work, and leave the checkout and user configuration unchanged. Remote metadata required for pricing must come from committed fixtures or a stubbed acquisition boundary; a documentation contract may not depend on live URLs.

Local-runnable commands may execute only when they are deterministic, targeted, no-cost, non-destructive, and explicitly allowlisted. Stateful commands must use isolated temporary roots or parse-only validation. Paid-execution and service/e2e examples must never execute in the documentation contract; they must be syntax-checked and associated with a price-only counterpart or an explicit manual-approval policy. Docker, package-manager, Git mutation, network download, credential, and arbitrary external-tool commands default to parse-only or never-execute unless a dedicated local contract safely stubs their effects.

Historical, generated-evidence, expected-output, template, placeholder, and deliberately invalid examples remain in exhaustive coverage but are never promoted to runnable instructions by inference. Their acceptance criteria verify classification and surrounding labels. Generated documents must be checked through both the generated occurrence and the source template or generator contract where one exists.

Execution may be deduplicated by exact normalized command plus execution policy, fixture set, environment, and expected route. Coverage, failure reporting, and aggregate cost must remain occurrence-based. One result shared by several occurrences must identify every affected file and section.

## Required Corrections

Priorities are ordered from P0 (critical safety or unintended side effects) through P3 (lower-risk completeness and reporting). Rows within each priority are ordered by implementation dependency.

| Priority | Issue | Recommended correction | Acceptance criterion |
|---|---|---|---|
| P0 | A whole-docs harness could execute paid or quota-limited service examples | Default every extracted command to `never-execute`; require an explicit allowlisted execution policy, suppress provider calls at the dispatcher boundary, remove provider credentials, and block outbound network during contracts | No documentation test can reach a provider adapter or third-party network; paid and service/e2e examples are syntax-checked only and require no credentials |
| P0 | `config --price` can mutate persistent state | Reject `--price` before any config read-modify-write path and classify config examples as stateful utilities rather than priceable workflows | A byte-for-byte hash of both the real and isolated config remains unchanged after every config-plus-price validation |
| P0 | Stateful, install, Docker, Git mutation, download, and arbitrary shell examples are unsafe under generic execution | Add risk flags and policy-specific runners; use parse-only validation by default and dedicated stubs or temporary roots for explicitly approved local contracts | No test installs software, builds or runs a container, changes Git state, downloads external content, changes user files, or writes normal artifacts |
| P0 | Parallel audits can race through configuration, output, runtime, cache, and project state | Give every executable inventory case isolated config, input overlays, output, project, cache, runtime, and temporary paths; serialize cases that cannot be fully isolated | Repeated parallel and serial runs produce identical results and leave all real repository and user paths unchanged |
| P0 | Provider-call safety currently depends on every command honoring `--price` correctly | Add a process-wide test guard beneath command routing that rejects any provider request while the documentation harness is active and records attempted calls as failures | Every executable result reports `providerCalls: 0`, and an intentionally injected adapter call proves the guard fails closed |
| P1 | No authoritative inventory covers all documentation command occurrences | Add a typed repository-wide inventory consumed by one documentation contract test and compare it against all candidates extracted from `README.md` and `docs/**/*.md` | All 1,455 snapshot candidates are classified exactly once or intentionally superseded by documented source changes; unclassified additions, duplicate matches, and stale entries fail locally |
| P1 | Regex-only extraction cannot reliably distinguish Markdown commands, output, templates, continuations, and embedded languages | Implement a Markdown-aware extractor with shell-fence, console-prompt, continuation, inline-code, indented-code, source-location, and occurrence-ordinal support | Fixture tests cover every observed source shape, including expected output and deliberately invalid examples, without interpreting JSON, Mermaid, prose, or filenames as runnable commands |
| P1 | Price output is inconsistent across AutoShow workflows | Standardize priceable output on a structured envelope containing `dryRun`, `providerCalls`, status, and numeric `totalEstimatedCostCents` | Every complete priceable occurrence exits 0 with a numeric total, including zero; incomplete planning returns a typed non-success status rather than an empty success |
| P1 | URL, playlist, caption, metadata, download, and media preflight can depend on live network access | Add committed acquisition metadata fixtures or stub the acquisition boundary for documentation cases; include network access in the result envelope and fail closed when live access is attempted | All 28 current timeout occurrences settle deterministically offline with numeric, utility, or explicit incomplete results and `networkCalls: 0` |
| P1 | Command references contain staged image and video examples whose inputs exist only after normal paid generation | Add committed minimal image and video fixtures for edit, extend, interpolation, reference, and image-to-video planning; separate narrative execution order from price-fixture dependencies | All 36 currently failing staged image/video occurrences reach their intended planners in a clean checkout without running generation first |
| P1 | Comic examples have no numeric result and depend on absent project state | Add minimal scripts, character/location catalogs, reviewed scene and panel bundles, panel prompts, dialogue plans, and shorthand project fixtures covering every documented route | All 55 comic occurrences produce their classified numeric, explicit incomplete, validation, or utility outcome in a clean checkout; no missing prerequisite exits 0 without a typed status |
| P1 | Voice examples have no numeric result, depend on absent state, and have inconsistent price support | Add committed voice catalogs, registrations, candidates, consent/provenance fixtures, and protected-store stubs; define price behavior for every voice subcommand | All 16 concrete voice occurrences return their classified structured result, and no subcommand silently ignores or unexpectedly rejects an otherwise supported price policy |
| P1 | Multiple docs reference absent or route-incompatible extract, transcript, TTS, article, batch, and media inputs | Replace illustrative missing paths with committed minimal fixtures or classify them explicitly as templates; assert route compatibility before pricing | Every current instruction resolves its documented route without unexpected warnings, while every template is visibly labeled and parse-only |
| P1 | `--quiet --price` suppresses the requested result | Let quiet mode suppress diagnostics but never the requested result payload; structured mode must remain structured | Quiet price mode emits exactly one parseable result containing a numeric total or explicit incomplete status |
| P1 | Dash-leading write inputs reject standard `--` syntax | Make end-of-options handling command-neutral and separate it from download-only passthrough semantics | The documented dash-leading write occurrence treats the dash-leading token as input and reaches normal validation or planning |
| P1 | Hosted EPUB OCR cannot determine price from the documented EPUB input | Run the same local normalization used by execution during price preflight and estimate from the normalized page set without retaining normal artifacts | Every hosted EPUB occurrence returns a numeric estimate whose page basis matches execution planning |
| P1 | Article examples can route through media/STT planning instead of the intended URL extractor | Use stable article fixtures or stubbed controlled URLs and assert the planned acquisition route | Every article occurrence resolves through its documented URL extractor and never through Whisper or other media/STT pricing |
| P2 | Utilities, help, version output, bare CLI behavior, and invalid examples are mixed with priceable workflows | Give each occurrence an explicit utility, expected-output, template, or invalid classification and validate only its supported parse/help behavior | Utility and invalid entries appear as intentional non-price outcomes rather than failures or artificial zero-cost provider plans |
| P2 | Generated reports and ADR evidence can duplicate or fossilize obsolete commands | Record generated-source and historical classifications, link generated output to its template or generator, and require intentional snapshot updates | Regeneration cannot introduce an unclassified command, and historical evidence is never executed as current guidance |
| P2 | Identical command strings can have different meaning because of surrounding prose, prerequisites, or document family | Key inventory entries by occurrence identity and context while deduplicating execution only when policy, fixtures, route, and expectations are identical | Shared execution results list every occurrence, and a context-only change forces review even when command text is unchanged |
| P2 | Non-AutoShow Bun, Docker, Git, package-manager, external-tool, environment, and shell examples lack a common verification policy | Add syntax validators and explicit risk policies for each command family, with targeted stubs only where local semantic verification adds value | All 674 non-AutoShow candidate occurrences have a classification and deterministic parse-only, local, generated-source, or never-execute result |
| P2 | API-key assignments and credential examples can be mistaken for runnable secrets or inherit real values | Require placeholder-secret classification, scrub the child environment, and verify that examples use non-secret placeholder notation | Documentation contracts expose no secret values and fail if a credential-looking example contains a repository or environment secret |
| P2 | Directory and batch examples can succeed with unexpected missing-file warnings | Add clean committed batch directories and URL-list fixtures or classify intentionally partial examples | Every current batch instruction returns only its declared warnings and estimate; unexpected missing-file warnings fail |
| P2 | TTS examples contain stale cloning flags, ambiguous multi-provider voice flags, missing inputs, and authorization prerequisites | Update examples or add fixtures to match the current provider-neutral voice contract and assert provider-specific option resolution | All TTS occurrences reach their documented planner or an intentional validation result with no stale option spelling or hidden prerequisite |
| P2 | Documentation can drift from generated CLI help, model registries, and option resolution | Cross-check documented commands against the parser and current provider/model registries without executing providers | Removed commands, flags, providers, models, invalid flag placement, and help-synopsis drift fail the targeted contract |
| P3 | Aggregate cost is manually calculated and incomplete outcomes are easy to overlook | Generate occurrence-based and deduplicated reports from structured results, preserving zero, conditional, incomplete, utility, historical, and never-execute categories | The report prints direct subtotal, deduplicated subtotal, zero-cost count, all incomplete categories, affected occurrences, and a dated snapshot; registry changes require intentional updates |
| P3 | The initial corpus boundary is encoded only in prose | Centralize include and exclude globs with tests for root README, nested docs, ignored/untracked working-tree docs, generated outputs, templates, and excluded agent/input Markdown | A boundary fixture proves that every governed Markdown path is scanned and every excluded category is deliberate |
| P3 | Manual priority interpretation can drift as issues are fixed or new classes appear | Store priority and owner on every inventory exception and fail when a correction has no priority | Every open correction and exceptional occurrence is ranked P0 through P3 and appears in a generated backlog grouped by priority |

## Rationale

- The detailed command references, not the README, contain most user-facing commands and most current defects.
- Exhaustive extraction and selective execution are compatible: inventory breadth does not authorize unsafe runtime behavior.
- Occurrence identity matters because identical strings can be current guidance in one file, historical evidence in another, and expected output in a third.
- Structured price, network, provider-call, mutation, and artifact evidence makes safety testable instead of inferred from exit codes.
- Committed fixtures turn staged examples into clean-checkout contracts without requiring paid generation or live URLs.
- Generated and historical Markdown remain part of the user-visible repository and therefore require explicit classification even when they must never run.
- Occurrence-based aggregation answers what the documentation currently promises if each displayed workflow is followed once; deduplicated aggregation is an implementation optimization and secondary diagnostic.

## Consequences

Positive outcomes:

- Every user-visible command has an explicit intent and safety policy.
- The README, command references, operational guides, ADRs, diagrams, reports, templates, and generated evidence cannot drift independently without detection.
- Paid, stateful, destructive, networked, historical, and generated commands remain covered without being indiscriminately executed.
- Price totals, free workflows, incomplete plans, expected validation failures, and utilities become distinguishable and aggregatable.
- Missing fixtures, wrong routes, stale options, unsupported providers/models, unexpected warnings, and output masquerading as commands fail close to the documentation change.

Negative outcomes:

- The inventory is materially larger than a README-only sidecar and requires contextual occurrence identities rather than a set of unique strings.
- Command changes in generated reports or historical evidence may require source classification or intentional snapshot updates even when the runtime is unaffected.
- Stable fixtures for document, media, comic, voice, transcript, batch, and staged generation workflows add repository maintenance cost.
- Parser, registry, route, fixture, or price changes can legitimately update many occurrence results at once.
- Some commands can only receive static or stubbed validation, so the report must make validation depth visible rather than presenting all green results as equivalent.

## Trade-offs

| Gains | Sacrifices |
|---|---|
| Literal all-documentation coverage | A larger typed inventory and Markdown-aware extractor |
| Safe handling of paid and destructive examples | Multiple execution policies instead of one universal runner |
| Deterministic offline price evidence | Committed acquisition and staged-workflow fixtures |
| Cross-document drift detection | Context-aware occurrence maintenance for duplicated commands |
| Accurate occurrence-based costs | Intentional snapshots and explicit incomplete categories |
| Coverage of generated and historical material | Generator/source metadata and non-executable classifications |

## Test Plan

Implementation verification must remain local and no-cost:

1. Add `test/test-cases/validation/cli/documentation-command-examples.test.ts` and a typed inventory covering the root `README.md` and every `docs/**/*.md` file.
2. Test Markdown extraction independently with fenced shell, console prompts, continuations, inline code, indented code, placeholders, expected output, historical quotations, generated content, JSON, Mermaid, and duplicate occurrences.
3. Assert bidirectional exhaustiveness: every extracted candidate has exactly one inventory entry and every inventory entry resolves to exactly one current occurrence.
4. Run only allowlisted priceable or local-runnable cases. Deduplicate execution only by command, policy, fixtures, environment, and expected route, then map the result to every occurrence.
5. For priceable cases, assert structured status, intended route, declared warnings, `providerCalls: 0`, `networkCalls: 0`, `dryRun: true`, and numeric `totalEstimatedCostCents` for complete plans.
6. Run with isolated config, input overlays, output, project, cache, runtime, and temporary paths; hash real configuration and relevant checkout paths before and after; assert no normal artifacts or user-state changes.
7. Parse-check utilities, paid-execution examples, Docker, Git, installers, external tools, and stateful commands without executing their effects. Test any deeper behavior only through dedicated local stubs.
8. Assert generated-source links and ensure report/template regeneration cannot add an unclassified occurrence.
9. Generate occurrence-based and deduplicated totals, zero-cost counts, utility counts, validation-only counts, and complete lists of nonnumeric, failed, timed-out, conditional, historical, generated, and never-execute entries.
10. Run `bun run check`, `bun t --price`, `bun test test/test-cases/validation/cli/documentation-command-examples.test.ts`, the repository-approved targeted CLI smoke tests, and `git diff --check`.

## Follow-up Actions

| Priority | Action | Owner | Current state |
|---|---|---|---|
| P0 | Add fail-closed provider/network guards and complete filesystem/config isolation for documentation verification | Test and CLI maintainers | Pending |
| P0 | Reject config-plus-price before mutation and add byte-for-byte safety tests | Config maintainers | Pending |
| P1 | Add the Markdown-aware whole-docs extractor, typed occurrence inventory, and exhaustive bidirectional coverage test | Test maintainers | Pending |
| P1 | Standardize structured complete and incomplete price envelopes across AutoShow commands | CLI maintainers | Pending |
| P1 | Add offline acquisition metadata plus document, transcript, batch, image, video, comic, voice, and TTS fixtures | Workflow maintainers | Pending |
| P1 | Correct quiet-price output, command-neutral end-of-options parsing, hosted EPUB planning, and article route selection | CLI and extract maintainers | Pending |
| P2 | Add static risk policies for utilities, service/e2e, Docker, Git, package-manager, external-tool, credential, generated, and historical occurrences | Test and documentation maintainers | Pending |
| P2 | Cross-check commands, flags, providers, and models against current parser/help and registries | CLI and model-registry maintainers | Pending |
| P3 | Generate occurrence and deduplicated cost reports plus a prioritized exception backlog | Test maintainers | Pending |
| P3 | Update documentation examples only after their implementation, fixtures, and classifications satisfy this contract | Documentation maintainers | Pending |

## References

- [`README.md`](../../README.md)
- [`docs/commands.md`](../commands.md)
- [`docs/commands/`](../commands/)
- [`docs/tests/`](../tests/)
- [`docs/docker.md`](../docker.md)
- [`docs/release-v0.1.md`](../release-v0.1.md)
- [`docs/diagrams/`](../diagrams/)
- [`docs/benchmarks/`](../benchmarks/)
- [`docs/reports/`](../reports/)
- [`docs/templates/`](../templates/)
- Related ADR: [ADR-002](ADR-002-pipeline-state-resume-and-dry-run-planning.md)
- Related ADR: [ADR-004](ADR-004-manage-setup-runtime-and-toolchain-lifecycle.md)
- Related ADR: [ADR-006](ADR-006-unify-error-handling-vocabulary.md)
- Related ADR: [ADR-007](ADR-007-integrate-comic-with-central-llm-and-image-model-configs.md)
- Related ADR: [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md)
- Related ADR: [ADR-010](ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md)
- Related ADR: [ADR-012](ADR-012-benchmark-evidence-and-generated-report-architecture.md)
- Related ADR: [ADR-014](ADR-014-add-character-voice-references-and-multi-speaker-script-to-audio.md)
- Related ADR: [ADR-015](ADR-015-distribute-the-cli-as-a-docker-image.md)
- `test/test-runner/price-commands/`
- Proposed `test/test-cases/validation/cli/documentation-command-examples.test.ts`
