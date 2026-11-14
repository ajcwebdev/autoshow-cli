# write

Generate structured LLM text from local `.md` / `.txt` files or directories. `write` does not extract sources, browse, or generate media. Run `extract` first for URLs, recordings, documents, or X Spaces.

## Setup

Configure the selected hosted provider's key: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, or `XAI_API_KEY`. There is no local LLM backend. Use [setup and doctor](../00-setup-and-utilities/setup.md) to inspect configuration.

## Usage

```bash
bun autoshow write input/examples/document/harborlight-field-notes.md --provider openai=gpt-6.1-sol --prompt shortSummary --price
bun autoshow write input/examples/document/harborlight-field-notes.md --provider openai=gpt-6.1-sol --prompt shortSummary longSummary --rendered-text
```

Review the estimate and [spending rules](../../../AGENTS.md#paid-providers) before execution. Extraction and writing remain separate:

```bash
bun autoshow extract input/examples/video/01-two-speaker-speech.mp4 --provider deepgram --output-dir output/write-transcript
bun autoshow write output/write-transcript/transcription.txt --provider openai --prompt shortSummary --rendered-text
```

See the [video fixture provenance](../../../input/examples/video/README.md). Empty text and directly supplied input-list files are rejected. A file looks like an input list when at least half its nonblank, non-comment lines identify URLs, X Space IDs, or existing paths. Directories are scanned recursively for text files.

## Selection and Cost

Repeat `--provider provider[=model]` for multiple targets, or use `--all-providers` for every active hosted write model. `--llm` is a compatibility alias; do not combine the two spellings. Saved write selections apply before automatic defaults. With no configured or explicit selection, the current cheapest default is `anthropic=claude-haiku-5-5`.

A bare provider selects its cheapest eligible model:

| Provider  | Current default    |
| --------- | ------------------ |
| OpenAI    | `gpt-6-luna`       |
| Anthropic | `claude-haiku-5-5` |
| Gemini    | `gemini-3.8-flash` |
| Grok      | `grok-4.7`         |

Use `bun autoshow write --help-topic providers` for current selectors. The [model catalog](../../../src/cli/commands/setup-and-utilities/models/llm-config.json) owns exact capabilities, context/output limits, dated tariffs, and pricing qualifications. Retired selectors fail locally without silently replacing a model.

`--price` estimates the selected source, prompts, and reasoning policy without generation; `--json` exposes structured estimates. Registry tariffs are static, may conservatively exceed introductory prices, and do not automatically change with the date. Cache rates are metadata rather than requested explicit caching; estimates are not invoice totals, and unmeasured timing remains provisional.

`--max-model-cents N` filters each model's estimated total across all selected inputs; it is not a command-wide spending cap. Only retained targets execute. Configure a combined limit with `setup --max-cents` when needed.

## Shared Write Options

| Option                               | Effect                                                        |
| ------------------------------------ | ------------------------------------------------------------- |
| `--batch-limit N\|all`               | Select up to N files; default 5.                              |
| `--batch-order newest\|oldest`       | Filename order, or reverse order; default `newest`.           |
| `--batch-concurrency N`              | Items in flight; default 7.                                   |
| `--provider-concurrency N`           | Hosted targets per item; default 7.                           |
| `--concurrency-mode ramp\|immediate` | Gradually admit requests or start at the cap; default `ramp`. |
| `--prompt NAME...`                   | Named presets; default `default`.                             |
| `--prompt-file FILE`                 | Custom instructions or a JSON leaf prompt.                    |
| `--rendered-text`                    | Save rendered Markdown in the run directory.                  |
| `--rendered-out-dir DIR`             | Also save source-named Markdown externally.                   |
| `--track-list FILE`                  | Read numbered track titles for rendered headings.             |
| `--prompt-md`                        | Save Markdown prompt examples as `prompt-md.md`.              |

### Project Lyric Drafts

A project target named `text/`, or a text file beneath it, adopts its parent's `prompt.md`, optional `tracks.md`, and sibling `lyrics/` output directory. This mode requires the adjacent prompt or an explicit `--prompt-file`. Explicit prompt, track-list, and rendered-output flags override those defaults.

```bash
bun autoshow write input/examples/tts/harborlight-chapters --prompt rockSong --price
```

## Provider Capabilities

All active write models request native JSON-schema output without web-search tools. `--reasoning-effort` accepts the shared vocabulary `default|disabled|minimal|low|medium|high|xhigh|max`, but each model rejects unsupported values before dispatch. Omission and `default` delegate to the write adapter/provider policy.

- **OpenAI:** Astra, Sol, Terra, and Luna accept `low` through `max`, excluding `minimal`. Only Terra and Luna allow `disabled`, mapped to native `none`; Astra and Sol require reasoning. Responses API structured output is used.
- **Anthropic:** Active models accept `low` through `max`, excluding `minimal`. Only Haiku permits `disabled`; Sonnet's optional reasoning classification does not make disabling legal. AutoShow limits thinking plus text to 16,000 tokens. Fable's bundled restrictions include 30-day retention unless ZDR is expressly authorized, and unavailable native structured output in CMEK organizations; errors are preserved without schema/model fallback.
- **Gemini:** Active models accept `low`, `medium`, and `high`; disabling and the remaining effort levels are unsupported. Gemini 4 uses direct non-streaming REST with a 32,768 combined thinking/output limit, not the larger limits of other invocation modes. Truncation, continuation, missing candidates, and thinking-only responses fail without automatic continuation.
- **Grok:** `grok-4.7` accepts `low`, `medium`, `high`, and `xhigh`; reasoning cannot be disabled. Its visible-output allowance is separate from reasoning tokens.

Context windows and provider output maxima are separate from application budgets. In particular, Astra/Terra's 1,050,000-token context retains a separate 922,000-token input ceiling. Check the catalog before sending large inputs.

## Prompts

List presets with `bun autoshow write --help-topic prompts`. Presets cover summaries, chapters, research, marketing/social content, lyrics, and creative writing. `default` combines `shortSummary`, `longSummary`, and `longChapters`. All selected tasks share one input; a single leaf task returns its object, while multiple resolved tasks are keyed by prompt name.

`--prompt-file` prepends plaintext instructions to named presets. With no named preset, plaintext instructions use a JSON `{ "content": "..." }` envelope instead of adding the default task. A `.json` prompt file must follow the leaf-prompt format used in `src/prompts/entries/`; its instruction, examples, and structured preset participate in schema resolution.

### Research

`sources` extracts identifiable works/accounts with their stated creator, location, context, and confidence. `literatureReview` synthesizes the supplied evidence, limitations, and gaps. Neither browses, verifies outside references, or invents missing citation details.

```bash
bun autoshow write input/examples/document/harborlight-field-notes.md --prompt sources literatureReview --price
```

### Song Explainer

`songExplainer` accepts source text, lyrics, or both. Label paired lyrics and source in one input file. It produces background, a glossary, ordered lyric annotations where lyrics exist, and uncertainties, distinguishing supplied evidence from interpretation. Source-only input does not invent lyrics; lyrics-only input does not invent source connections. It does not browse or verify external facts.

To explain generated lyrics, pass the saved output to a second `write` invocation; selecting both prompts in one run does not feed one prompt's output into another.

```bash
bun autoshow write input/examples/document/harborlight-field-notes.md --prompt songExplainer --rendered-text --price
```

## Output

Runs save `manifest.json`, `prompt.md`, `text.json`, and readable `show-note.md`. Multiple requested targets use `text-<model>.json` and `show-note-<model>.md`, adding the provider when IDs collide. `--rendered-text` adds `text.md` or matching model-specific Markdown. `--prompt-md` adds `prompt-md.md`; external rendered output uses source-based names and applicable track headers.

Raw provider responses and validation failures remain available for diagnosis. JSON transport or a saved artifact does not by itself prove that requested content passed schema validation or is factually correct. [Resume](../00-setup-and-utilities/resume.md) can execute selected write targets while validating retained prompt settings.

## Generate Media from Write Output

Pass rendered text to independent generation commands; lyric drafts can use `music --lyrics-file`:

```bash
bun autoshow tts output/<write-run>/text.md --provider elevenlabs
bun autoshow music output/<write-run>/text.md --provider elevenlabs
bun autoshow image "$(cat output/<write-run>/text.md)" --provider openai
bun autoshow video "$(cat output/<write-run>/text.md)" --provider grok
```

See [write tests](tests.md) for local checks and separately authorized provider coverage.
