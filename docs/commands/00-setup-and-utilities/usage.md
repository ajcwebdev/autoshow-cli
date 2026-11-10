# CLI Usage

Shared command syntax, help, logging, and JSON output. See the [command guide](../../../README.md#command-guide) to choose a command.

## Command Syntax and Help

```bash
bun autoshow <command> [input] [flags]
bun autoshow help <command>
bun autoshow <command> --help
bun autoshow --version
```

`bun as <command>` is a shorter equivalent. Put flags after the command. Prefix a filename that begins with `-` with `./` so it is not parsed as a flag.

Use `--help-topic` to print one topic without an input and without running the command. `--help` lists the topics.

```bash
bun autoshow extract --help-topic documents
bun autoshow video --help-topic provider:grok
bun autoshow resume --help-topic concurrency
```

## Global Flags

Shared across commands unless a command's help omits them:

| Flag                      | Effect                                                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `--config-path <path>`    | Config file path (default: `config/autoshow.json` in the project root).                                          |
| `--output-root <dir>`     | Base directory for timestamped run folders (default: `./output`).                                                |
| `--output-dir <dir>`      | Pin the run directory instead of `output/<timestamp>_<slug>`. Requires a command that creates one run directory. |
| `--characters-root <dir>` | Comic/voice character reference directory (default: `input/characters`). `voice` and `comic` only.               |
| `--bin-dir <dir>`         | Prefer tool binaries in this directory before installed tools and `PATH`.                                        |
| `--allow-over-budget`     | Continue above the budget set with `config --max-cents`. The override is not saved.                              |
| `--require-shared-budget` | Require a complete shared-budget scope; older CLI images reject this capability flag before execution.           |

`bun autoshow --help-topic globals` lists these controls. Each command's `--help` shows only the globals it accepts.

## Logging

Text is the default. Each diagnostic is one line.

| Flag                     | Effect                                                                 |
| ------------------------ | ---------------------------------------------------------------------- |
| `--quiet`, `-q`          | Suppress non-error diagnostics.                                        |
| `--verbose`              | Include debug diagnostics.                                             |
| `--log-level <level>`    | Set the minimum level: `debug`, `info`, `success`, `warn`, or `error`. |
| `--color` / `--no-color` | Enable or disable terminal color.                                      |

Color is enabled on a TTY. `NO_COLOR` disables color whenever it is set, including an empty value. A non-empty, non-zero `FORCE_COLOR` enables color, including in redirected output, and takes precedence over `NO_COLOR`. `--color` and `--no-color` override both.

## JSON Output

`--json` writes diagnostic records to stderr and exactly one result record to stdout. `--quiet` and `--log-level` do not suppress that result. Diagnostics and errors are redacted.

```bash
bun autoshow setup --show --json 2>diagnostics.jsonl | jq '.data'
```

For agent workflows, add `--result-file <new-path>` to save the complete sanitized terminal result and receive a compact summary on stdout:

```bash
bun autoshow setup --show --json --quiet --result-file .tmp/setup-result.json
```

The summary retains status, exit code, run ID, bounded field/count/error previews and an `artifact` reference containing the file path, byte count and SHA-256. It is marked `resultMode: "summary"` and fits within 8 KiB. Read the artifact's `data` for full results or exact price estimates; the summary is not a replacement pricing contract. Existing `--json` output is unchanged when `--result-file` is absent.

The path resolves from the command's working directory. Missing parent directories are created privately, and the result file is created with mode `0600` before command execution. Existing files and symlinks are rejected rather than overwritten; choose a fresh path for each invocation. Credential fields and sensitive text are redacted without truncating nested result data. A file-creation failure prevents command execution; a later artifact-write failure returns a nonzero failure result. Raw standalone payload output cannot be combined with this mode. Diagnostic stderr follows the existing logging rules; use `--quiet` when only error diagnostics are wanted. Result files are projections, so canonical output files and manifests remain the owning evidence.

## Shared Runtime Budget

Independent operator commands can share one cumulative admission ledger. Give every participating process the same ledger and cap, with an explicit per-invocation allocation:

```bash
mkdir -p output/budgets
export AUTOSHOW_BUDGET_LEDGER=output/budgets/selected-batch.json
export AUTOSHOW_BUDGET_CENTS=100
export AUTOSHOW_BUDGET_RESERVE_CENTS=25
bun autoshow write notes.md --provider openai=gpt-6.1-sol --prompt shortSummary --json --require-shared-budget
```

All three environment values are required together. Cap and allocation are positive safe-integer cents; the allocation cannot exceed the cap. Every invocation reserves before entering its command handler. A new ledger's parent directory must already exist. Reuse the same ledger across related workers and retries; do not replace it or increase its immutable cap to resume the same authorized batch. Retain it with the batch's resumable state rather than treating it as disposable scratch.

The command's complete selected estimate must fit its allocation. Partial batch estimates fail closed, and `--allow-over-budget` cannot bypass this gate. Shared paid-create retry and REST boundaries require accepted pricing. Supported execution roots are `write`, `extract`, `download`, `tts`, `image`, `video`, and `music`. Other execution paths, including `comic`, `voice`, and `resume`, currently reject a configured scope before their handlers. Valid `--price` runs and help/version do not consume reservations. Without the scope, existing command behavior is unchanged.

Successful commands conservatively consume their full declared allocation, even if estimated cost is lower. Failed or interrupted work keeps the full allocation held; a missing response is not proof of no charge. This is cumulative command-admission accounting, not a provider-enforced invoice cap. Provider charges can exceed estimates, and external clients such as OpenCode do not participate. Existing project approval thresholds, credentials, and model policies remain applicable.

Inspect the cap, total held amount, receipt count, and last twenty receipts through the supported local tool:

```bash
bun src/tools/spending-ledger-command.ts status output/budgets/selected-batch.json
bun src/tools/spending-ledger-command.ts status output/budgets/selected-batch.json --id <reservation-id>
```

Stop every participating process and resolve all outstanding provider requests before reducing any hold. A partially observed bill does not establish that an active request is finished. After reconciling provider records, explicitly confirm this stopped state and settle an outstanding receipt with a rounded-up integer-cent charge and billing evidence:

```bash
bun src/tools/spending-ledger-command.ts reconcile output/budgets/selected-batch.json --budget-cents 100 --id <reservation-id> --charged-cents 3 --evidence "Provider usage export confirms the interrupted request charged three cents." --confirm-stopped
```

Reconciliation applies only to outstanding reservations or uncertain holds. It cannot silently refund a completed allocation or clear a recorded breach. An observed charge above its reservation records a fatal ledger state and blocks further admission. Lock acquisition has a deadline; stale locks are never automatically removed. Preserve the ledger, investigate the owner and billing evidence, and stop affected work rather than manually rewriting accounting.

Docker wrappers must explicitly forward the complete scope and mount the ledger's parent directory writable at a stable container path. Every worker must address the same host-backed file. Include `--require-shared-budget` on execution and pricing invocations so an older image fails on the unknown flag instead of silently ignoring the budget variables. The scope is admission state and does not authorize any provider charge by itself.
