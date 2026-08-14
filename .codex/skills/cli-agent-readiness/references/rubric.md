# CLI Agent Readiness Rubric

## Table of Contents

- Severity model
- Command-type lens
- Principle 1: Non-interactive by default
- Principle 2: Structured, parseable output
- Principle 3: Fail fast with actionable errors
- Principle 4: Safe retries and explicit mutation boundaries
- Principle 5: Progressive help discovery
- Principle 6: Composable and predictable structure
- Principle 7: Bounded, high-signal responses
- Review checklist
- Test recipes

## Severity Model

Use this rubric as a severity model, not a pass/fail scorecard.

- `Blocker`: Prevent reliable agent use. The command hangs, requires human intervention, or returns output an agent cannot use safely.
- `Friction`: Allow use, but waste retries, tokens, or tool calls. The agent can recover, but only inefficiently or brittly.
- `Optimization`: Improve speed, cost, or robustness without fixing a hard failure.

Adjust severity by command type.

- Read/query commands care most about parseable output, bounded responses, and clean stdout/stderr separation.
- Mutating commands care most about retry safety, explicit destructive boundaries, and actionable failures.
- Bootstrap or wizard flows may keep interactive conveniences, but they still need a non-interactive path for automation.
- Streaming or monitoring commands care less about idempotence and more about line-oriented, predictable output.

Do not apply every principle uniformly. Evaluate the command by what it does.

## Command-Type Lens

Classify the command before reviewing it.

- Read/query: `list`, `get`, `status`, `search`, `inspect`
- Mutating: `create`, `publish`, `update`, `delete`, `deploy`, `apply`
- Bootstrap/setup: `init`, `login`, `configure`, `wizard`
- Streaming/monitoring: `tail`, `logs`, `watch`, `follow`

Use the classification to decide which failures are unacceptable and which are merely polish.

## Principle 1: Non-Interactive by Default

Principle:

- Any command an agent may automate should run without prompts.
- Keep interactive mode as a human convenience layer, not the only path.

Why it matters:

- Background subagents cannot surface prompts back to the user.
- Prompt-driven flows create hangs, retries, and ambiguous menu navigation.

Good contract:

```bash
# Human at a TTY
$ blog-cli publish
? Status? published
? Path to content: my-post.md
Published "My Post" to personal

# Agent or script
$ blog-cli publish --content my-post.md --yes
Published "My Post" to personal (post_id: post_8k3m)
```

Look for:

- TTY detection before prompting
- `--no-input` or `--non-interactive`
- `--yes` or `--force` for confirmations
- Flags, files, or stdin as prompt replacements

Severity guidance:

- `Blocker`: The command hangs or requires input in non-TTY mode.
- `Friction`: Some prompts are bypassable, but behavior varies across subcommands.
- `Optimization`: The CLI already suppresses prompts reliably and exposes a global non-interactive path.

## Principle 2: Structured, Parseable Output

Principle:

- Commands that return data should expose a stable machine-readable representation.

Why it matters:

- Agents need data contracts, not decorative tables or prose.
- ANSI colors, banners, and mixed logs burn tokens and invite brittle scraping.

Good contract:

```bash
$ blog-cli publish --content my-post.md --json
{"title":"My Post","url":"https://personal.blog.dev/my-post","post_id":"post_8k3m","status":"published"}
```

Look for:

- `--json` or another explicit machine mode on data-bearing commands
- Exit code `0` on success and non-zero on failure
- Result data on stdout
- Diagnostics on stderr
- Clean non-TTY output with no color, spinner, or decoration noise

Severity guidance:

- `Blocker`: No machine-readable output exists for data-bearing commands.
- `Friction`: Coverage is inconsistent or stdout/stderr are mixed.
- `Optimization`: Machine mode is stable across the relevant command family.

## Principle 3: Fail Fast With Actionable Errors

Principle:

- Failed commands should teach the agent how to succeed on the next attempt.

Why it matters:

- Agents cannot infer missing context as reliably as humans.
- Vague errors force guesswork, extra tool calls, and unnecessary retries.

Good contract:

```bash
$ blog-cli publish
Error: --content is required.
Usage: blog-cli publish --content <file> [--status <status>]
Available statuses: draft, published, scheduled
Example: blog-cli publish --content my-post.md
```

Look for:

- Early validation before side effects
- Error text that names the exact missing or invalid input
- Usage syntax or the expected invocation shape
- Valid values or examples when the failure is parameter-related
- Human-readable guidance instead of raw tracebacks

Severity guidance:

- `Blocker`: Errors are vague, silent, or traceback-only.
- `Friction`: Errors identify the problem but not the correction path.
- `Optimization`: Errors reliably enable one-shot self-correction.

## Principle 4: Safe Retries and Explicit Mutation Boundaries

Principle:

- Agents retry, resume, and sometimes replay commands.
- Mutating commands should make retries safe when possible, and dangerous mutations should be explicit.

Why it matters:

- Automatic retries can duplicate work or corrupt state unless the CLI returns clear boundaries.

Good contract:

```bash
$ blog-cli publish --content my-post.md
Published "My Post" to personal (post_id: post_8k3m)

$ blog-cli publish --content my-post.md
Already published "My Post" to personal, no changes (post_id: post_8k3m)

$ blog-cli posts delete --slug my-post --confirm
```

Look for:

- Idempotent or duplicate-detecting behavior on create/update/deploy flows
- Stable identifiers in success output
- `--dry-run` for consequential mutations
- Explicit destructive flags for deletes or irreversible actions

Severity guidance:

- `Blocker`: Retries silently duplicate, corrupt, or partially reapply mutations.
- `Friction`: Destructive or consequential mutations are scriptable without clear previews or identifiers.
- `Optimization`: Retry behavior is safe or at least clearly detectable.

## Principle 5: Progressive Help Discovery

Principle:

- Help should support incremental exploration: top-level help, subcommand help, then examples.

Why it matters:

- Agents usually probe the surface in a few calls instead of reading all docs first.

Good contract:

```bash
$ blog-cli --help
Usage: blog-cli <command>

Commands:
  publish     Publish content
  posts       List and manage posts

$ blog-cli publish --help
Publish a markdown file to your blog.

Options:
  --content   Path to markdown file
  --status    Post status (draft, published, scheduled; default: published)
  --yes       Skip confirmation prompt
  --json      Output as JSON
  --dry-run   Preview without publishing

Examples:
  blog-cli publish --content my-post.md
  blog-cli publish --content my-post.md --status draft
```

Look for:

- `--help` and `-h` at the top level and subcommand level
- One-line purpose statements
- Clear invocation patterns
- Required arguments and high-value modifiers
- Concrete examples

Severity guidance:

- `Blocker`: Missing help or undiscoverable subcommands.
- `Friction`: Help exists but omits invocation shape, required flags, or examples.
- `Optimization`: Help is layered, concise, and example-driven.

## Principle 6: Composable and Predictable Structure

Principle:

- Agents solve tasks by chaining commands. Prefer clean stdin/stdout behavior and consistent naming.

Why it matters:

- Agents learn patterns across sibling commands. Exceptions force extra discovery and brittle branching.

Good contract:

```bash
cat posts.json | blog-cli posts import --stdin
blog-cli posts list --json | blog-cli posts validate --stdin
blog-cli posts list --status draft --limit 5 --json | jq -r '.[].title'
```

Look for:

- Flags, files, or stdin as interchangeable input sources where useful
- `-` as a stdin/stdout alias when file paths are involved
- Consistent flag names across resource families
- Stable command shapes across sibling commands

Severity guidance:

- `Blocker`: Commands cannot participate in automation pipelines where that is core to the task.
- `Friction`: Naming and structure vary arbitrarily across related commands.
- `Optimization`: Related commands share predictable patterns and pipeline-friendly I/O.

## Principle 7: Bounded, High-Signal Responses

Principle:

- Large outputs are sometimes necessary, but narrow, relevant responses should be the default.

Why it matters:

- Agents pay context cost for every line.
- Huge default dumps force the model to search, summarize, and retry unnecessarily.

Good contract:

```bash
$ blog-cli posts list --limit 25
Showing 25 of 312 posts
To narrow results: blog-cli posts list --status published --since 7d --limit 10

$ blog-cli posts list --tag javascript --status published --since 30d --limit 10 --json
```

Look for:

- Defaults with limits, pagination, or filtering
- Summary-first responses for broad queries
- Guidance on how to narrow or page when truncation occurs
- Concise and detailed modes when the domain needs both

Severity guidance:

- `Blocker`: Routine queries dump huge output with no narrowing controls.
- `Friction`: Narrowing exists, but defaults are still too broad for common cases.
- `Optimization`: Defaults are bounded and teach the next better query.

## Review Checklist

Use this as a quick pass before writing findings.

- Can every automatable command run to completion with stdin detached?
- Do data-bearing commands expose a stable machine mode?
- Do failures name the exact missing or invalid input and show the next correct shape?
- Can mutating commands be retried safely or at least inspected for duplicate work?
- Can an agent discover the command in two or three `--help` calls?
- Can related commands be piped together without output cleanup?
- Do broad queries default to bounded output with narrowing hints?

## Test Recipes

Adapt these checks to the target CLI and framework.

### Detached stdin smoke test

Use this to catch prompt-related hangs.

```python
import subprocess, sys

cmd = ["blog-cli", "publish", "--content", "my-post.md"]
try:
    result = subprocess.run(
        cmd,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        timeout=10,
    )
    print("exit:", result.returncode)
    print("PASS: command exited without hanging")
except subprocess.TimeoutExpired:
    print("FAIL: command hung waiting for input")
    sys.exit(1)
```

### Machine output validity

Use this to verify JSON mode and stdout cleanliness.

```bash
blog-cli posts list --json > out.json
jq empty out.json
```

### stdout/stderr separation

Use this to confirm data stays parseable.

```bash
blog-cli posts list --json > out.json 2> err.log
test -s out.json
```

### Retry safety

Use this to detect duplicate mutation behavior.

```bash
blog-cli publish --content my-post.md --json
blog-cli publish --content my-post.md --json
```

Expect the second call to be a no-op or clearly marked duplicate with the same identifier.

### Help discovery

Use this to inspect incremental discoverability.

```bash
blog-cli --help
blog-cli publish --help
```

Expect purpose, invocation shape, required inputs, safety flags, and examples.

### Bounded output defaults

Use this to check whether broad queries are expensive by default.

```bash
blog-cli posts list
```

Expect limits, truncation guidance, or narrowing hints instead of unbounded dumps.
