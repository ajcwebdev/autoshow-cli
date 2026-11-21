# Comic example scripts

Durable, self-contained example scripts for exercising the `comic` command without needing the private `input/uss` episode scripts.

`01-registry-check.md` is a single original USS Acampo scene that uses canonical character names (Paddy, Bishop, GeeBee, and `CHAT` — an alias for `HR Hologram`), so it parses and validates against the comic schemas.

## Local preparation (no API keys, no calls)

`--only prepare` parses the script and builds the draft prompt locally. With `--price` it is free and writes nothing; it rejects an explicit `--provider`:

```bash
bun as comic draft-scenes input/examples/comic/01-registry-check.md --only prepare --price
bun as comic draft-scenes input/examples/comic/01-registry-check.md --only prepare
```

## Scene drafting estimate

Scene drafting is the hosted stage. Its estimate resolves the selected model against the central LLM registry (`src/cli/commands/setup-and-utilities/models/llm-config.json`) and needs the prepared run:

```bash
bun as comic draft-scenes input/examples/comic/01-registry-check.md --only scene --provider openai=gpt-6.1-sol --price --output-dir <prepared-run>
```

Any registered text model works; an unknown model is rejected against the registry. Drop `--price` (with the provider's API key exported) to draft the scene.
