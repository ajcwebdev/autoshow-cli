# Comic example scripts

Durable, self-contained example scripts for exercising the `comic` command without
needing the private `input/uss` episode scripts.

`01-registry-check.md` is a single original USS Acampo scene that uses canonical
character names (Paddy, Bishop, GeeBee, and `CHAT` — an alias for `HR Hologram`),
so it parses and validates against the comic schemas.

## Dry-run cost estimate (no API keys, no calls)

Exercises `--llm-model` resolution and pricing against the central LLM registry
(`src/cli/commands/setup-and-utilities/models/llm-config.json`):

```bash
bun as comic draft-scenes input/examples/comic/01-registry-check.md --only structure --llm-model gpt-5.5 --price
bun as comic draft-scenes input/examples/comic/01-registry-check.md --only structure --llm-model grok-4.3 --price
bun as comic draft-scenes input/examples/comic/01-registry-check.md --only structure --llm-model claude-opus-4-8 --price
```

Any model id in `llm-config.json` works; an unknown id is rejected against the registry.

## Real run (needs the provider's API key)

Drop `--price` to run the structured-script review through the shared LLM dispatch:

```bash
OPENAI_API_KEY=... bun as comic draft-scenes input/examples/comic/01-registry-check.md --only structure --llm-model gpt-5.5
```
