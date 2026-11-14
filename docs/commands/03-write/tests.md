# Write Tests

Local contracts cover structured output, prompts, rendered artifacts, provider settings, and request construction without paid calls:

```bash
bun test test/test-cases/validation/text/write/
```

For hosted OpenAI, Anthropic, Gemini, and Grok coverage, estimate the selected service tests first:

```bash
bun t test/test-cases/e2e/service/text/write/ --price
```

Live execution needs the matching `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, or `XAI_API_KEY` and the [repository spending authorization](../../../AGENTS.md#paid-providers). Add `--budget 2500` to a live test command to filter test keys above an estimated 25¢ each; this is neither a cumulative cap nor spending approval. Full-suite execution separately requires explicit authorization.

See the [testing guide](../testing.md) and [write guide](overview.md). Mocked contracts do not establish generated-text quality or live entitlement.
