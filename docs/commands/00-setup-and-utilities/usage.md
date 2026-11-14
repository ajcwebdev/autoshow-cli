# CLI Usage

Choose a command from the [command guide](../../../README.md#command-guide). `bun as` is equivalent to `bun autoshow`.

## Command Syntax and Help

```bash
bun autoshow <command> [input] [flags]
bun autoshow help <command>
bun autoshow <command> --help
bun autoshow extract --help-topic documents
bun autoshow --help-topic globals
bun autoshow --version
```

`--help-topic` prints focused help without input or execution; `--help` lists topics. Prefix filenames beginning with `-` with `./`. Unknown flags fail before execution; `--` ends option parsing where positional/passthrough input is supported.

## Global Flags

Each command's help lists the globals it accepts. `--config-path` selects saved defaults; `--output-root` changes the timestamped-output base, while `--output-dir` pins a run directory on commands that create one. `--characters-root` applies only to voice/comic. `--bin-dir` overrides tool lookup; see [setup](setup.md).

`--allow-over-budget` bypasses the configured estimate limit for one invocation, is never saved, and cannot bypass shared-budget enforcement. Actual charges can differ from estimates.

## Logging

Text diagnostics are one line per event. `--quiet` suppresses non-errors, `--verbose` enables debug, and `--log-level` selects `debug`, `info`, `success`, `warn`, or `error`.

Color follows TTY detection. Any `NO_COLOR` disables it; nonempty/nonzero `FORCE_COLOR` takes precedence. `--color` / `--no-color` override both.

## JSON Output

`--json` emits redacted diagnostics on stderr and exactly one terminal result on stdout, including help, parse failures, and fatal errors. Logging filters never suppress the result. `--no-json` or `--json=false` selects text output.

```bash
bun autoshow setup --show --json 2>diagnostics.jsonl | jq '.data'
bun autoshow setup --show --json --quiet --result-file output/results/setup-result.json
```

`--result-file` requires JSON. It saves the complete sanitized envelope and emits a summary of at most 8 KiB, marked `resultMode: "summary"`, with status, exit code, run ID, bounded previews, and `artifact: { path, bytes, sha256 }`. Read the artifact for full nested data and exact prices; verify bytes/checksum across storage boundaries.

Paths resolve from the working directory. Creation precedes command execution, uses `0600` files and `0700` new parents, and rejects existing files/symlinks. Choose a fresh path each time. Creation/write failures fail the command; raw standalone payload output cannot bypass compact mode. Result artifacts are projections, not replacements for canonical manifests or provider evidence.

## Shared Runtime Budget

Related processes can share one cumulative admission ledger:

```bash
mkdir -p output/budgets
export AUTOSHOW_BUDGET_LEDGER=output/budgets/selected-batch.json
export AUTOSHOW_BUDGET_CENTS=100
export AUTOSHOW_BUDGET_RESERVE_CENTS=25
bun autoshow write notes.md --provider openai=gpt-6.1-sol --prompt shortSummary --json --require-shared-budget
```

Require all three variables: positive safe-integer cap/allocation in cents, allocation no larger than cap, and an existing ledger-parent directory. Every related worker/retry must use the same ledger and immutable cap; preserve it with resumable state. `--require-shared-budget` also makes older CLI images fail instead of ignoring the scope.

Before handlers, reserve the allocation; before paid dispatch, require a complete accepted estimate within it. Unknown/skipped prices and `--allow-over-budget` cannot bypass this gate. Execution supports `write`, `extract`, `download`, `tts`, `image`, `video`, and `music`; configured `comic`, `voice`, and `resume` execution fail before handlers. Valid price-only commands and help/version consume no reservation.

Success books the entire allocation. Failures retain uncertain holds; killed processes leave durable reservations. This is command-admission accounting, not an invoice cap: actual charges may differ, external clients do not participate, and [project spending approval](../../../AGENTS.md#paid-providers) still applies.

Inspect the latest twenty receipts or a specific reservation:

```bash
bun src/tools/spending-ledger-command.ts status output/budgets/selected-batch.json
bun src/tools/spending-ledger-command.ts status output/budgets/selected-batch.json --id <reservation-id>
```

Stop all participating processes and resolve outstanding provider requests before reducing a hold. Reconcile provider records, round the charge up to integer cents, and explicitly confirm stopped state:

```bash
bun src/tools/spending-ledger-command.ts reconcile output/budgets/selected-batch.json --budget-cents 100 --id <reservation-id> --charged-cents 3 --evidence "Provider usage export confirms the interrupted request charged three cents." --confirm-stopped
```

Only outstanding/uncertain receipts can be reconciled. Completed allocations and breaches cannot be silently refunded/cleared. Charges above a reservation record a fatal state blocking admission. Lock acquisition is bounded; stale locks are never automatically removed. Preserve and investigate accounting instead of rewriting it manually.

Docker wrappers must forward all three variables, mount the ledger parent writable at a stable path shared by workers, and pass `--require-shared-budget` for execution/pricing. The scope itself authorizes no provider charge.
