---
name: cli-agent-readiness
description: Evaluate, design, and improve command-line tools for agent consumers using a seven-principle rubric focused on non-interactive operation, structured output, actionable errors, safe retries, progressive help, composable stdin/stdout behavior, and bounded responses. Use when Codex needs to review CLI source code, specs, plans, or help text for agent-first readiness, propose implementation changes, or generate tests for automation-heavy, CI, or subagent-driven workflows.
---

# CLI Agent Readiness

## Overview

Use this skill to review or design CLIs that agents will call directly.
Optimize for commands that must run without human intervention, survive retries, and return data cheaply enough for model context windows.

## Workflow

Classify the command surface before scoring it.

- Treat read/query commands, mutating commands, bootstrap/setup flows, and streaming commands differently.
- Judge each principle by the command's purpose instead of demanding every principle equally everywhere.

Inspect the command surface the way an agent does.

- Start with top-level help, then subcommand help, then examples.
- Inspect parsing, prompt handling, stdout/stderr separation, exit codes, and machine-output modes.
- Read [rubric.md](./references/rubric.md) when you need the detailed seven-principle rubric, examples, or test ideas.

Record findings by severity.

- Use `Blocker` when the CLI cannot be used reliably by an agent.
- Use `Friction` when the CLI is usable but wastes tokens, retries, or tool calls.
- Use `Optimization` when the CLI already works and the change is mainly about speed, cost, or robustness.

Make findings concrete.

- Name the affected command, flag, or output surface.
- Explain the agent failure mode, not just the general UX issue.
- Recommend the smallest contract change that fixes the problem.
- Include a validation idea or regression test for every `Blocker` and `Friction` finding.

Prefer implementation-ready guidance.

- Ask for `--no-input`, `--yes`, `--json`, `--dry-run`, stable exit codes, clean stderr separation, or narrowing flags when they directly remove the failure mode.
- Avoid generic "improve UX" advice unless you convert it into a specific CLI behavior.

## Design Rules

- Make automatable commands non-interactive by default when stdin is not a TTY.
- Treat machine-readable output as an API surface.
- Fail early with errors that tell the next retry exactly what to change.
- Make retry behavior safe or explicitly detectable on mutating commands.
- Keep help layered: top-level discovery, subcommand shape, concrete examples.
- Preserve consistent naming and stdin/stdout conventions across sibling commands.
- Bound default output and teach the next narrowing step when truncating.

## Expected Output

Present findings first and order them by severity.

For each finding, include:

- Principle
- Severity
- Evidence: file/line or command example
- Why it breaks or slows agents
- Recommended change
- Suggested test

Keep summaries short. The value of this skill is the prioritized evidence and the concrete fix path.

## Reference

Use [rubric.md](./references/rubric.md) for the full seven principles, command-type-aware severity guidance, fictional `blog-cli` examples, and generic test recipes.
