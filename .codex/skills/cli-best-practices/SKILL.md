---
name: cli-best-practices
description: Practical, high-impact guidelines for designing CLIs. Focus on usability, predictability, and scriptability.
---

# CLI Best Practices (Pragmatic)

Use this skill when building, modifying, or reviewing command-line tools.
The goal is a CLI that is easy to discover, safe to automate, and pleasant for humans.
These guidelines are intentionally general; adapt to the product, audience, and constraints.

## Core Principles

- Optimize for the common path first.
- Keep behavior predictable and easy to explain.
- Make automation safe and boring.
- Provide fast feedback and clear errors.
- Be consistent across commands and releases.
- Prefer clarity over cleverness.
- Reduce surprise, even if it costs a few extra keystrokes.

## Primary Users And Use Cases

- Decide whether humans, scripts, or both are the primary users.
- Design defaults for humans and provide clear machine options.
- If automation is a major use case, prioritize stable output and flags.
- If interactivity is a major use case, prioritize help, prompts, and examples.

## Pipelines And Composition

- Make it easy to chain commands together.
- Keep one record per line in plain output when possible.
- Avoid banners or headers in machine modes.
- Provide `--json` for structured pipelines.
- Keep errors on stderr so pipelines can keep stdout clean.
- Avoid interleaving progress with data.
- Consider `--no-header` for tabular output.

Example pipeline:

```bash
myapp list --plain --no-header | grep error | wc -l
```

## Command Shape

- Prefer a single primary command with clear subcommands.
- Keep command names short and meaningful.
- Use nouns for resources and verbs for actions where possible.
- Avoid deep nesting unless the domain demands it.
- Keep the “happy path” short to type.
- Provide a top-level `help` command.
- Keep subcommand groups consistent across domains.

Examples:

```bash
myapp init
myapp status
myapp deploy --env prod
```

## Naming

- Pick one term for a concept and use it everywhere.
- Avoid both `remove` and `delete` for the same action.
- Prefer familiar verbs: `list`, `get`, `create`, `update`, `delete`.
- Avoid jargon unless your users expect it.
- Keep abbreviations obvious (`cfg` is risky, `config` is better).

## Flags And Arguments

- Use long flags for clarity and short flags for frequent use.
- Keep short flags consistent across commands.
- Use `--dry-run` for safe previews.
- Use `--force` for destructive actions.
- Avoid flags that change meaning by surprise.
- Prefer `--flag value` over positional arguments for optional inputs.
- Avoid positional arguments with ambiguous meaning.
- Use positional args for required, ordered items only.
- Keep defaults sensible and documented.
- Avoid surprising defaults that do hidden work.

Common patterns:

```bash
myapp fetch --limit 50 --format json
myapp delete --force --id 123
```

## Flag Conventions

- Use `--all` to operate on everything.
- Use `--no-<feature>` to disable a default feature.
- Prefer `--output <path>` to control file output.
- Prefer `--format <name>` to control output format.
- Provide `--config <path>` for config overrides.
- Keep mutually exclusive flags clearly documented.
- Avoid making a flag both a boolean and a value.

## Global Vs Command Flags

- Use global flags sparingly.
- Keep global flags consistent across commands.
- Avoid global flags that change subcommand meaning.
- Prefer command-specific flags for behavior changes.
- Document which flags are global vs local.

Example:

```bash
myapp --config ./myapp.toml status
myapp deploy --env prod
```

## Argument Parsing And Validation

- Validate required args early.
- Provide clear errors for missing or invalid values.
- Accept common synonyms for inputs if it reduces friction.
- Normalize paths and case when appropriate.
- Reject ambiguous inputs rather than guessing.
- Provide `--help` output on parsing errors.

## Subcommands

- Group related actions into subcommands.
- Keep the number of top-level commands manageable.
- Provide a list of subcommands in help output.
- Keep subcommands stable across releases.
- Avoid hidden subcommands unless they are truly internal.

## Help And Discoverability

- Always support `-h` and `--help`.
- Provide a short synopsis and a couple of examples.
- Put common options near the top.
- Make help text scannable with short lines.
- Include a pointer to docs or support.
- Provide help for subcommands at `cmd help` and `cmd sub --help`.
- Show help when arguments are missing or invalid.
- Consider suggesting similar commands for typos.

Minimal help skeleton:

```text
myapp - syncs local data to the server

Usage:
  myapp <command> [options]

Examples:
  myapp sync --all
  myapp status

For more help: myapp help <command>
```

## Documentation

- Provide online docs if the tool is used beyond a single team.
- Keep CLI help in sync with docs.
- Provide a quickstart section for new users.
- Keep examples up to date.
- Consider a man page if your audience expects it.

## Examples And Recipes

- Include examples for the top 3 workflows.
- Use real filenames and outputs in examples.
- Show both the command and the resulting output when helpful.
- Keep examples short enough to scan quickly.

Example:

```text
$ myapp sync ./data.json
Synced ./data.json (42 items) in 3.2s
```

## Output Basics

- Send primary output to `stdout`.
- Send logs, warnings, and progress to `stderr`.
- Keep default output short and human-readable.
- Provide `--json` when structured output is useful.
- Provide `--plain` or `--quiet` to reduce formatting.
- Detect TTY to decide whether to use color or formatting.
- Avoid mixing logs with structured output.

Example split:

```bash
$ myapp list --json > out.json
# progress and warnings go to stderr
```

## Output Formats

- Use line-oriented output for simple lists.
- Use tables for human lists when TTY is present.
- Ensure `--json` is valid JSON and stable in shape.
- Avoid changing field names without a clear migration path.
- Keep numeric units consistent and explicit.
- Use ISO timestamps where possible.
- Avoid printing byte counts without units.

Example:

```text
NAME     STATUS   UPDATED
alpha    ready    2026-02-15T13:04:00Z
beta     error    2026-02-15T12:59:00Z
```

## Output For Scripts

- Provide a stable format for machine parsing.
- Avoid changing default output in patch releases.
- Offer explicit format flags to reduce ambiguity.
- Keep output deterministic when possible.
- Avoid adding extra lines in machine modes.

## Output As An API

- Treat output formats as part of your public contract.
- Version formats if you expect changes.
- Keep field names short but explicit.
- Prefer consistent ordering in human output.
- Avoid locale-dependent formatting in machine output.
- Provide a way to select only needed fields if output is large.

Example:

```bash
myapp list --json --fields name,status
```

## Exit Codes

- Exit `0` on success.
- Use non-zero on error.
- Keep exit codes stable over time.
- Document meaningful non-zero codes if you expose them.
- Consider distinct exit codes for different failure classes.

## Errors And Messaging

- Show errors in plain language first.
- Include the failing input or context.
- Suggest the next action.
- Avoid stack traces by default.
- Offer `--verbose` or `--debug` for deeper details.
- Keep error messages single-line when possible.
- Avoid blaming the user; focus on what to do next.

Example:

```text
Error: unable to read config file at ./myapp.toml
Tip: run `myapp init` to create a default config
```

## Input Sources

- Accept input from arguments, files, and stdin where it makes sense.
- Use `-` to mean stdin when a filename is expected.
- If stdin is a TTY and input is required, show help instead of hanging.
- Clearly document when stdin is expected.
- Avoid surprising reads from stdin without documentation.

Examples:

```bash
cat data.json | myapp import -
myapp import ./data.json
```

## File Handling

- Avoid overwriting files unless asked.
- Provide `--output` to control output paths.
- Create directories only when necessary.
- Confirm before overwriting, or provide `--force`.
- Use predictable default filenames.

## Interactivity

- Prompt only when attached to a TTY.
- Provide `--yes` or `--no` to bypass prompts.
- Make prompts explicit about consequences.
- Avoid progress spinners in non-interactive mode.
- Prefer simple confirmations over complex menus.
- Keep prompts short and actionable.

Example:

```text
$ myapp delete 123
Delete item 123? [y/N]:

$ myapp delete 123 --yes
Deleted 123
```

## Progress And Long Tasks

- Show progress for long-running actions.
- Allow turning it off (`--quiet` or `--no-progress`).
- Use clear stages when work has phases.
- For streaming output, keep it line-based and stable.
- Consider an estimated time if you can compute it.

Example:

```text
$ myapp sync
Downloading...
Processing...
Completed in 12.4s
```

## Colors And Styling

- Use color to help scanning, not to convey meaning alone.
- Detect `NO_COLOR` and disable color when set.
- Avoid fancy Unicode when piping.
- Keep color palettes simple and readable.
- Prefer plain ASCII separators in machine modes.

## Accessibility And Readability

- Keep line lengths reasonable in help output.
- Avoid requiring color to understand results.
- Use clear contrast when color is enabled.
- Prefer readable symbols over dense glyphs.
- Keep output friendly to screen readers.

## Configuration

- Support configuration via flags, env vars, and optional config files.
- Be clear about precedence.
- Keep config file format simple and editable.
- Store config in a predictable location.
- Provide `--config` to point to custom config.
- Allow environment variables for CI and scripts.

Typical precedence:

1. Command flags
2. Environment variables
3. Config file
4. Defaults

Example:

```bash
MYAPP_FORMAT=json myapp list --format plain
```

## Configuration Locations

- Follow platform conventions for config paths.
- Keep a single primary config file when possible.
- Avoid scattering config across multiple files.
- Provide a command to show active config paths if useful.

Example locations:

```text
macOS:   ~/Library/Application Support/myapp/config.toml
Linux:   ~/.config/myapp/config.toml
Windows: %APPDATA%\myapp\config.toml
```

## Environment Variables

- Use env vars for secrets and tokens.
- Keep env var names consistent across tools.
- Document env vars in help or docs.
- Avoid requiring env vars for simple commands.

## Logs And Verbosity

- Default to minimal logs.
- Add `--verbose` or `--debug` to increase detail.
- Keep debug output clearly labeled.
- Avoid mixing logs with machine output.
- Consider `--log-level` for long-running tools.

## Diagnostics

- Provide a `doctor` or `diagnose` command if useful.
- Include versions and config paths in diagnostics.
- Make diagnostic output safe to share.
- Avoid including secrets in diagnostics.

Example:

```text
$ myapp doctor
OK: config at ~/.config/myapp/config.toml
OK: network connectivity
```

## Performance

- Optimize startup time for common commands.
- Defer expensive work until needed.
- Cache results when appropriate.
- Avoid blocking the UI without feedback.
- Prefer lazy loading of heavy modules.

## Resource Usage

- Keep memory use reasonable for small tasks.
- Avoid holding large datasets when streaming works.
- Provide limits or paging for large outputs.
- Make network concurrency configurable when heavy.

## Reliability

- Validate inputs early.
- Fail fast on missing prerequisites.
- Retries should be explicit and bounded.
- Provide timeouts for network calls.
- Make errors reproducible when possible.

## Safety

- Be conservative with destructive operations.
- Require explicit confirmation or `--force`.
- Support `--dry-run` when possible.
- Avoid writing to unexpected locations.
- Respect read-only environments.

## Security

- Never print secrets by default.
- Redact sensitive values in logs.
- Respect file permissions.
- Be careful with shell execution.
- Avoid insecure defaults for network or file access.

## Cross-Platform Behavior

- Avoid assumptions about paths or shells.
- Use platform-appropriate config locations.
- Keep line endings and encodings consistent.
- Document platform-specific differences when unavoidable.
- Avoid reliance on system-specific utilities when possible.

## Internationalization And Locale

- Avoid hard-coded locale assumptions.
- Use consistent decimal separators in machine output.
- Keep human output readable in common locales.
- Consider localized messages only if you can support them well.

## Shell Completion

- Provide shell completion if the CLI is complex.
- Keep completions aligned with actual flags and commands.
- Document how to install completions.

## Extensibility

- Keep the CLI surface stable for plugins or extensions.
- Provide a clear way to list available extensions.
- Document extension points if they exist.

## Versioning And Updates

- Provide `--version`.
- Use semantic versioning when possible.
- Highlight breaking changes in release notes.
- Keep help text in sync with behavior.
- Avoid silent behavior changes in patch releases.

## Compatibility And Stability

- Keep defaults stable across minor releases.
- Deprecate before removing major flags.
- Provide clear migration guidance for breaking changes.
- Consider feature flags for risky changes.
- Keep automation paths backward compatible when possible.

## Telemetry (If Applicable)

- Be transparent about usage data.
- Provide a clear opt-out.
- Keep telemetry minimal and privacy-safe.

## Testing

- Test the CLI surface, not just the underlying functions.
- Include tests for help output and error messages.
- Add golden tests for `--json` formats.
- Cover common flags and edge cases.
- Include tests for non-interactive mode.

## UX Polish

- Keep error messages short and actionable.
- Provide examples that match real workflows.
- Keep output aligned and easy to scan.
- Use consistent terminology across docs and output.
- Avoid noisy banners or ASCII art in default output.

## Common Anti-Patterns

- Silent failure with exit code 0.
- Hiding important errors behind `--verbose` only.
- Changing output format between patch releases.
- Prompts that block scripts.
- Using color to convey essential meaning.
- Logs mixed into structured output.
- Defaulting to destructive actions.

## Good Defaults Checklist

- `--help` and `-h` show help.
- `--version` prints a version.
- `--json` outputs structured data when useful.
- `--plain` or `--quiet` reduces chatter.
- `--verbose` increases detail.
- `--dry-run` previews changes.
- `--force` is required for destructive actions.
- `-` means stdin when a file is expected.
- Output is cleanly split between stdout and stderr.
- Errors are clear and actionable.

## Minimal CLI Quality Bar

If you only do a few things, do these:

1. Provide clear help and examples.
2. Make output predictable and scriptable.
3. Separate stdout and stderr.
4. Use correct exit codes.
5. Provide safe flags for destructive actions.
6. Offer `--json` or `--plain` for automation.
7. Make errors actionable.

## Notes On Scope

These guidelines are intentionally general.
Consistency and clarity matter more than any single rule.
Apply them with judgment.
