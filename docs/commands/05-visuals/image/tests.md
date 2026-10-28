# Image Service Tests

Live image generation for the `image` command: Gemini, Grok, and OpenAI, alongside local usage-error checks. Live tests verify image decoding, aspect ratio where specified, and model metadata; they do not assess prompt fidelity or perceptual quality. Commands that run live tests may call paid or quota-limited providers.

## Quick Start

```bash
bun t test/test-cases/e2e/service/visuals/image/
```

## Provider Env Vars

Live image generation tests need a configured provider key: `GEMINI_API_KEY`, `OPENAI_API_KEY`, or `XAI_API_KEY`.

## Price Preflight

Estimate mapped generation commands without running the tests:

```bash
bun t test/test-cases/e2e/service/visuals/image/ --price
```

Run tests with a 25¢ estimated-cost threshold per test key. This filters eligible tests rather than capping total spending:

```bash
bun t test/test-cases/e2e/service/visuals/image/ --budget 2500
```

## Related Docs

- [Testing Overview](../../testing.md)
- [Image Command](overview.md)
