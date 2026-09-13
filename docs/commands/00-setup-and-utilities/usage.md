# CLI Usage

Shared command syntax, help, and output controls. See the [command guide](../../../README.md#command-guide) to choose a command.

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

## Logging

Text is the default. Each diagnostic is one line with a local timestamp.

| Flag | Effect |
| --- | --- |
| `--quiet` | Suppress non-error diagnostics. |
| `--verbose` | Include debug diagnostics. |
| `--log-level <level>` | Set the minimum level: `debug`, `info`, `success`, `warn`, or `error`. |
| `--color` / `--no-color` | Enable or disable terminal color. |

Color is enabled on a TTY. `NO_COLOR` disables it; `FORCE_COLOR` can enable it in redirected output. `--color` and `--no-color` override both.

## JSON Output

`--json` writes diagnostic records to stderr and exactly one result record to stdout. `--quiet` and `--log-level` do not suppress that result. Secrets are redacted. JSON output is uncolored.

```bash
bun autoshow setup --show --json 2>diagnostics.jsonl | jq '.data'
```

Keep stdout and stderr separate when consuming the result in a script. Output artifacts remain in the command's run directory; the terminal result describes the completed or failed invocation.
