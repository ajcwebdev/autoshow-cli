# CLI Usage

Shared command syntax, help, and output controls. See the [command guide](../../../README.md#command-guide) to choose a command, or [setup](setup.md#setting-defaults-and-configuration) to save defaults.

## Command Syntax and Help

```bash
bun autoshow <command> [input] [flags]
bun autoshow help <command>
bun autoshow <command> --help
bun autoshow --version
```

`bun as <command>` is a shorter equivalent. Put flags after the command. Inputs depend on the command: source commands accept URLs and files, `write` and `tts` accept local text, and generation commands accept prompts or their documented media inputs. Prefix a filename that begins with `-` with `./` so it is not parsed as a flag.

Full help lists available topics. Use `--help-topic` to view one topic without supplying an input or executing the command:

```bash
bun autoshow extract --help-topic documents
bun autoshow video --help-topic provider:grok
bun autoshow resume --help-topic concurrency
```

## Logging

Human-readable text is the default. Each event occupies one physical line with a local `[HH:MM:SS.MMM]` timestamp.

| Flag | Effect |
| --- | --- |
| `--quiet` | Suppress non-error diagnostics. |
| `--verbose` | Include debug diagnostics. |
| `--log-level <level>` | Set the minimum level: `debug`, `info`, `success`, `warn`, or `error`. |
| `--json` | Emit structured diagnostics and a terminal result for scripts. |
| `--json=false` | Select text output explicitly. |
| `--color` / `--no-color` | Enable or disable terminal color. |

Color is enabled on a TTY. `NO_COLOR` disables it; a non-empty, non-zero `FORCE_COLOR` takes precedence and can enable color in redirected output. Explicit color flags override both environment variables. JSON output is uncolored.

## JSON Output

`--json` writes versioned diagnostic records to stderr and exactly one terminal `type: "result"` record to stdout. Diagnostic filters do not suppress that result. Secrets are redacted.

```bash
bun autoshow setup --show --json 2>diagnostics.jsonl | jq '.data'
```

Keep stdout and stderr separate when consuming the result in a script. Output artifacts remain in the command's run directory; the terminal result describes the completed or failed invocation.
