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

Full help lists available topics. Use `--help-topic` to view one topic without supplying an input or executing the command:

```bash
bun autoshow extract --help-topic documents
bun autoshow video --help-topic provider:grok
bun autoshow resume --help-topic concurrency
```
## Global Flags

Shared across commands unless a command's help omits them:

| Flag                      | Effect                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------ |
| `--config-path <path>`    | Config file path (default: `config/autoshow.json` in the project root).                                |
| `--output-root <dir>`     | Base directory for timestamped run folders (default: `./output`).                                      |
| `--output-dir <dir>`      | Pin the run directory instead of `output/<timestamp>_<slug>`. Not accepted by `setup`, `resume`, or `voice`. |
| `--characters-root <dir>` | Comic/voice character reference directory (default: `input/characters`). `voice` and `comic` only.     |
| `--bin-dir <dir>`         | Prefer external tool binaries here before the managed install and `PATH`.                              |
| `--allow-over-budget`     | Continue when a cost estimate exceeds the configured `--max-cents` budget (not persisted). Pipeline and generation commands only. |

`bun autoshow --help-topic globals` lists these controls. Each command's `--help` shows only the globals it accepts.

## Logging

Text is the default. Each diagnostic is one line.

| Flag                     | Effect                                                                 |
| ------------------------ | ---------------------------------------------------------------------- |
| `--quiet`, `-q`          | Suppress non-error diagnostics.                                        |
| `--verbose`              | Include debug diagnostics.                                             |
| `--log-level <level>`    | Set the minimum level: `debug`, `info`, `success`, `warn`, or `error`. |
| `--color` / `--no-color` | Enable or disable terminal color.                                      |

Color is enabled on a TTY. `NO_COLOR` disables it; `FORCE_COLOR` can enable it in redirected output. `--color` and `--no-color` override both.

## JSON Output

`--json` writes diagnostic records to stderr and exactly one result record to stdout. `--quiet` and `--log-level` do not suppress that result. Secrets are redacted.

```bash
bun autoshow setup --show --json 2>diagnostics.jsonl | jq '.data'
```
Output artifacts remain in the command's run directory. The terminal result describes the completed or failed invocation.
