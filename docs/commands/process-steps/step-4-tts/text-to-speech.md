# tts

Generate speech audio from a local `.md` or `.txt` file with local or hosted TTS providers.

## Outline

- [Setup](#setup)
  - [Environment](#environment)
- [Usage](#usage)
- [Voice Management](voice-management.md)
- [Shared TTS Options](#shared-tts-options)
- [TTS Services](#tts-services)
  - [Kitten TTS](#kitten-tts)
  - [ElevenLabs](#elevenlabs)
  - [MiniMax](#minimax)
  - [Groq](#groq)
  - [Grok](#grok)
  - [Mistral](#mistral)
  - [OpenAI](#openai)
  - [Gemini](#gemini)
  - [Deepgram](#deepgram)
  - [Speechify](#speechify)
  - [Hume](#hume)
  - [Cartesia](#cartesia)
- [Pricing Notes](#pricing-notes)
- [Output](#output)

## Setup

```bash
# full setup
bun autoshow setup

# install Kitten TTS, download local models, and check hosted TTS readiness
bun autoshow setup --step tts
```

Local TTS runtime pieces:

- Kitten TTS venv under `runtime/bin/kitten-tts/`
- downloaded model cache created by Kitten TTS itself

### Environment

Hosted providers need API keys. The shipped CLI reads **only** these provider keys from the environment — voices, reference audio, output formats, API versions, and every other tuning knob are set per run through flags (see [Shared TTS Options](#shared-tts-options) and each service below):

```bash
OPENAI_API_KEY=...
GEMINI_API_KEY=...
GROQ_API_KEY=...
XAI_API_KEY=...
ELEVENLABS_API_KEY=...
MINIMAX_API_KEY=...
DEEPGRAM_API_KEY=...
MISTRAL_API_KEY=...
SPEECHIFY_API_KEY=...
HUME_API_KEY=...
CARTESIA_API_KEY=...
```

## Usage

```bash
bun autoshow tts <input> [flags]
```

`<input>` must be a local `.md` or `.txt` file. If no engine flag is provided, `tts` defaults to Kitten TTS with `kitten-tts-nano-0.8-int8`.

## Shared TTS Options

| Flag | Description |
|------|-------------|
| `--provider provider[=model]` | TTS provider/model selector; repeat to run multiple targets |
| `--all-providers` | Select the default all-provider TTS target set |
| `--all-local` | Select every local TTS engine |
| `--provider-concurrency <n>` | Hosted TTS providers/models to run concurrently per item; default `10` |
| `--local-concurrency <n>` | Local TTS providers to run concurrently per item; default `10` |
| `--batch-concurrency <n>` | Batch text files to process concurrently; default `10` |
| `--tts-voice <provider=value\|value>` | Generic TTS voice selector |
| `--tts-speed <provider=value\|value>` | Generic TTS speed |
| `--tts-language <provider=value\|value>` | Generic TTS language |
| `--tts-ref-audio <provider=path\|path>` | Explicit one-off Mistral reference input; it crosses protected ingestion and never creates a saved voice |
| `--tts-voice-name`, `--tts-consent-name`, `--tts-consent-email` | Retired synthesis-time creation inputs; rejected with guidance to the `voice` management command |
| `--tts-text-normalization <provider=value\|value>` | Generic text normalization |
| `--tts-instructions <provider=value\|value>` | Generic voice/style instructions |
| `--tts-output-format <provider=value\|value>` | Generic output format |
| `--tts-chunk-concurrency <n>` | Hosted TTS chunk starts allowed in parallel per provider across the current run; default `30`, or `50` for Grok-only hosted TTS |
| `--tts-dialogue-format <screenplay\|labeled>` | Dialogue input format for multi-speaker TTS; requires at least one `--tts-speaker` |
| `--tts-speaker SPEAKER=VOICE\|path` | Multi-speaker voice mapping; repeatable. Selects multi-speaker TTS |
| `--price` | Show the aggregated estimate and exit |
| `--output-dir <dir>` | Global flag: pin an exact run directory instead of a timestamped output directory |

You can combine multiple TTS targets in one run. Each successful target writes its own output file. `--provider` is repeatable, including repeated selectors from the same provider. Shared voice flags apply to every selected model for that provider.

### Dialogue and Voice-Management Capabilities

| Provider | Multi-speaker render | Catalog/design/clone management |
|---|---|---|
| Gemini | Native only for exactly two speakers when the plan is representable; otherwise segmented | Existing voice names only |
| ElevenLabs | Native `eleven_v3` Text-to-Dialogue when eligible; otherwise segmented | Account/shared catalogs, design, remix, instant clone, Professional Voice Clone state, inspect/delete |
| Hume | Native Octave 2 utterances when eligible; otherwise segmented | Stock/custom catalogs, Octave 1 design, gated external clone, inspect/delete |
| Mistral | Segmented | Existing/saved voices and protected one-off references; saved-reference lifecycle |
| MiniMax | Segmented; the documented API is single-voice per request | System/account catalog, temporary design, instant clone, inspect/delete |
| Cartesia | Segmented; contexts are not native speaker dialogue | Public/account catalog, instant clone, gated Pro clone, inspect/delete; no text-prompt design |
| Speechify | Segmented; the documented API is single-voice per request | Shared/personal catalog, personal clone, inspect/delete; no text-prompt design |
| Kitten, Groq, Grok, OpenAI, Deepgram | Segmented | Existing/local voice selectors only |

Voice management is separate from synthesis. A catalog, design, or clone capability does not authorize `tts` or `comic generate-audio` to create a remote resource.

AutoShow splits TTS text into 2000-character chunks for every provider except Groq Orpheus, which uses 200-character chunks. Hosted chunked providers synthesize chunks through a provider-wide `--tts-chunk-concurrency` gate shared across the current run, including directory batches. When `--tts-chunk-concurrency` is not set explicitly or by config, Grok-only hosted TTS uses `50`; other hosted TTS selections use `30`. Kitten chunks locally and synthesizes those chunks sequentially.

```bash
bun autoshow tts input/examples/tts/1-tts.md \
  --provider kitten=kitten-tts-mini \
  --provider openai=gpt-4o-mini-tts-2025-12-15 \
  --tts-voice alloy

bun autoshow tts input/examples/tts/1-tts.md --provider elevenlabs=eleven_v3
```

## TTS Services

### Kitten TTS

| Option | Value |
|--------|-------|
| Selector | `--provider kitten[=<model>]` |
| Models | `kitten-tts-mini`, `kitten-tts-micro`, `kitten-tts-nano`, `kitten-tts-nano-0.8-int8` |
| Voice | `--tts-voice <name>`, default `Jasper` |

```bash
bun autoshow tts input/examples/tts/1-tts.md
bun autoshow tts input/examples/tts/1-tts.md --provider kitten=kitten-tts-mini --tts-voice Luna
```

Kitten strips markdown, splits local text into 2000-character chunks, and synthesizes chunks sequentially inside the local Python runtime.

### ElevenLabs

| Option | Value |
|--------|-------|
| Selector | `--provider elevenlabs[=<model>]` |
| Models | `eleven_v3`, `eleven_multilingual_v2`, `eleven_flash_v2_5` |
| Existing voice | `--tts-voice <id>`, default `hpp4J3VqNfWAUOO0d1Us` |
| Output and synthesis controls | `--tts-output-format <format>`, `--tts-language <code>`, `--elevenlabs-tts-stability <0..1>`, `--elevenlabs-tts-similarity-boost <0..1>`, `--elevenlabs-tts-style <0..1>`, `--elevenlabs-tts-use-speaker-boost`, `--tts-speed <0.7..1.2>`, `--elevenlabs-tts-seed <n>`, `--tts-text-normalization auto\|on\|off`, repeatable `--elevenlabs-tts-pronunciation-dictionary-locator <id[:version]>`, `--elevenlabs-tts-optimize-streaming-latency <0..4>` |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider elevenlabs=eleven_v3 --tts-voice hpp4J3VqNfWAUOO0d1Us
```

ElevenLabs synthesis uses existing voices only; voice creation remains under the separate `voice` management command. Single-voice text uses the registered model limit: 5,000 characters for `eleven_v3`, 10,000 for `eleven_multilingual_v2`, and 40,000 for `eleven_flash_v2_5`; each chunk uses the same voice and synthesis controls. Multi-speaker `eleven_v3` uses the timestamped Text-to-Dialogue endpoint when delivery, overlap, effects, and per-turn controls can be represented exactly. Native requests partition only at turn boundaries, conservatively cap prepared text at 2,000 characters, and cap each request at ten distinct voices. Authored delivery is reduced to a bounded allowlist of documented Eleven v3 audio tags; arbitrary stage-direction prose is never placed inside brackets because the model can speak an unrecognized tag aloud. Mapped tags receive an explicit Unicode-scalar source map, unsupported prose remains canonical evidence without entering provider text, and returned alignment is normalized into take and final-audio timing. Other ElevenLabs models and ineligible v3 plans use the shared segmented path.

Use `voice discover` for account/shared catalogs, `voice design` for bounded protected design or eligibility-proved remix candidates, and `voice materialize` for the selected candidate. Synthesis-time clone inputs remain rejected before target collection. Instant-clone creation is implemented by the protected advanced adapter; Professional Voice Clone is represented truthfully as verification-required rather than silently retried or treated as ready. Legacy default-voice expiry on December 31, 2026 is retained in readiness metadata.

### MiniMax

| Option | Value |
|--------|-------|
| Selector | `--provider minimax[=<model>]` |
| Models | `speech-2.8-hd`, `speech-2.8-turbo` |
| Voice | `--tts-voice <id>`, default `English_expressive_narrator` |
| Synthesis controls | `--minimax-tts-language-boost <language>`, `--tts-speed <0.5..2>`, `--minimax-tts-volume <greater-than-0..10>`, `--minimax-tts-pitch <-12..12>`, `--minimax-tts-emotion <emotion>`, `--tts-text-normalization true`, repeatable `--minimax-tts-pronunciation <rule>` |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider minimax=speech-2.8-turbo --tts-voice English_expressive_narrator
bun autoshow tts input/examples/tts/1-tts.md --provider minimax=speech-2.8-hd --minimax-tts-language-boost English --tts-speed 1.15 --minimax-tts-emotion calm
bun autoshow tts input/examples/tts/1-tts.md --provider minimax=speech-2.8-turbo --tts-voice English_expressive_narrator --price
```

MiniMax TTS uses existing/preset voices. Text is split into 2000-character chunks. Use `--tts-voice` to override the voice ID for the selected MiniMax model. `voice discover` reads system or account generated/cloned voices, while `voice design` creates exactly one protected temporary preview candidate for later `voice materialize`. The advanced clone facet accepts one verified mp3/m4a/wav sample from 10 seconds through 5 minutes and no larger than 20 MiB, then records the seven-day pre-activation lifetime. MiniMax does not expose native multi-speaker dialogue, so dialogue uses the segmented renderer.

### Groq

| Option | Value |
|--------|-------|
| Selector | `--provider groq[=<model>]` |
| Models | `canopylabs/orpheus-v1-english`, `canopylabs/orpheus-arabic-saudi` |
| Voice | `--tts-voice <id>`; English voices `autumn`, `diana`, `hannah`, `austin`, `daniel`, `troy` (default `troy`); Saudi Arabic voices `abdullah`, `fahad`, `sultan`, `lulwa`, `noura`, `aisha` (default `abdullah`) |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider groq=canopylabs/orpheus-v1-english --tts-voice troy
```

Groq voices are validated against the selected model. Groq Orpheus English defaults to `troy` and Groq Orpheus Saudi Arabic defaults to `abdullah`. Text is split into 200-character chunks.

### Grok

| Option | Value |
|--------|-------|
| Selector | `--provider grok[=<model>]` |
| Models | `grok-tts` |
| Voice | `--tts-voice <id>`, default `eve`; built-ins `eve`, `ara`, `rex`, `sal`, `leo`, or an 8-character custom voice ID |
| Language | `--tts-language <code>`, default `auto` |
| Text normalization | `--tts-text-normalization true` |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider grok=grok-tts --tts-voice eve
bun autoshow tts input/examples/tts/1-tts.md --provider grok=grok-tts --tts-voice ab12cd34 --tts-language ar-SA --tts-text-normalization true
```

Grok TTS text is split into 2000-character chunks.

### Mistral

| Option | Value |
|--------|-------|
| Selector | `--provider mistral[=<model>]` |
| Models | `voxtral-mini-tts-2603` |
| Voice source | exactly one of an existing `--tts-voice <id>` or an authorized one-off `--tts-ref-audio <path>` |
| Saved reference | create separately with `voice save-reference`, then synthesize with its registered provider ID |
| Dialogue mode | `--tts-dialogue-format screenplay\|labeled` plus repeatable `--tts-speaker SPEAKER=path` |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider mistral=voxtral-mini-tts-2603 --tts-voice voice_abc123
bun autoshow voice save-reference hero --model voxtral-mini-tts-2603 --voice-name AutoShowAnthony --reference-audio input/examples/audio/anthony-voice.mp3 --authorization-ref release:hero --consent-ref protected-consent:v1:STORE:ASSET:SHA256 --provenance-ref project:casting --price
bun autoshow tts input/chat-and-duco.txt \
  --provider mistral=voxtral-mini-tts-2603 \
  --tts-dialogue-format screenplay \
  --tts-speaker DUCO=input/examples/audio/anthony-voice.mp3 \
  --tts-speaker CHAT=https://ajc.pics/autoshow/examples/1-audio.mp3
```

Mistral Voxtral TTS requires one voice source when generating audio: an existing saved/custom voice ID or an authorized one-off local reference file. Named saved-voice creation occurs only under `voice save-reference`, with protected reference bytes, explicit consent/provenance, a durable provisioning journal, and reconciliation state. `--price` performs no provider call and writes no local artifact. The one-off synthesis path converts the raw CLI file into an opaque protected reference before target collection; raw paths and bytes do not enter runtime or run artifacts.

Dialogue mode works with every TTS provider, not just Mistral. `--tts-speaker` mappings are what select it: one or more mappings turn the run into multi-speaker TTS, and that mode then requires `--tts-dialogue-format`. A format on its own selects nothing, so typing `--tts-dialogue-format` with no `--tts-speaker` is rejected up front, while a `ttsDialogueFormat` inherited from config defaults is ignored with a warning and the run continues as single-speaker. `--tts-speaker SPEAKER=VOICE` maps a speaker to an existing provider voice ID for any provider. `SPEAKER=path` is accepted only for one explicitly selected Mistral target and crosses exact per-speaker protected ingestion before target collection; ElevenLabs, Speechify, and every other provider require existing IDs here. A value is read as reference audio when it contains a path separator or ends in a known audio extension (`.mp3`, `.wav`, `.m4a`, `.ogg`, `.opus`, `.flac`, and similar); anything else is read as a voice ID. Per-speaker mappings replace `--tts-voice` and `--tts-ref-audio` for the run, so the `tts` command rejects an explicit `--tts-voice` alongside `--tts-speaker` or `--tts-dialogue-format` rather than silently discarding it; a voice stored in config defaults is still exempt. Gemini, ElevenLabs `eleven_v3`, and Hume `octave-2` select their eligible native dialogue/utterance serializers; all other plans synthesize one segment per turn and concatenate them. `screenplay` mode extracts configured speaker dialogue, strips leading parentheticals, and omits scene/action directions. `labeled` mode expects `SPEAKER: text` lines. Segment-and-concat runs write `dialogue-normalized.txt`, one WAV per turn under `segments/`, the final `speech.wav`, and `manifest.json`; price estimates use the spoken dialogue character count.

### OpenAI

| Option | Value |
|--------|-------|
| Selector | `--provider openai[=<model>]` |
| Models | `gpt-4o-mini-tts-2025-12-15`, `tts-1`, `tts-1-hd` |
| Voice | `--tts-voice <id>`, default `alloy` |
| Synthesis controls | `--tts-instructions <text>` (`gpt-4o-mini-tts-2025-12-15` only; rejected with `tts-1`/`tts-1-hd`), `--tts-speed <0.25..4>` |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider openai=gpt-4o-mini-tts-2025-12-15 --tts-voice alloy
bun autoshow tts input/examples/tts/1-tts.md --provider openai=gpt-4o-mini-tts-2025-12-15 --tts-instructions "Warm documentary narration" --tts-speed 1.1
```

### Gemini

| Option | Value |
|--------|-------|
| Selector | `--provider gemini[=<model>]` |
| Models | `gemini-3.1-flash-tts-preview` |
| Single voice | `--tts-voice <name>`, default `Kore` |
| Multispeaker | `--tts-dialogue-format labeled` plus repeatable `--tts-speaker SPEAKER=VOICE` |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider gemini=gemini-3.1-flash-tts-preview --tts-voice Kore

bun autoshow tts input/examples/tts/tts-dialogue.txt \
  --provider gemini=gemini-3.1-flash-tts-preview \
  --tts-dialogue-format labeled \
  --tts-speaker Host=Kore \
  --tts-speaker Guest=Puck
```

Gemini multispeaker mode is enabled by the generic dialogue flags, the same ones every other provider uses. It uses its native exactly-two-speaker serializer when eligible instead of concatenating per-turn segments. `--tts-voice` is rejected once speaker mappings are present, since those mappings supply every voice. The input text must include explicit speaker labels such as `Host:` and `Guest:` that match the configured speaker names. Inline Gemini-style delivery tags like `[whispers]` or `[excitedly]` stay in the source text and are passed through unchanged.

### Deepgram

| Option | Value |
|--------|-------|
| Selector | `--provider deepgram[=<model>]` |
| Models | Aura 2 voice models listed by `bun autoshow tts --help`; default `aura-2-thalia-en` |
| Voice/model override | `--tts-voice <model>`, default selected model |
| Output controls | `--deepgram-tts-container <container>`, `--deepgram-tts-bit-rate <bps>`, `--deepgram-tts-sample-rate <hz>`, `--tts-speed <0.5..2>` |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider deepgram=aura-2-thalia-en --tts-voice aura-2-andromeda-en
bun autoshow tts input/examples/tts/1-tts.md --provider deepgram=aura-2-thalia-en --deepgram-tts-container wav --deepgram-tts-sample-rate 24000
```

### Speechify

| Option | Value |
|--------|-------|
| Selector | `--provider speechify[=<model>]` |
| Models | `simba-3.2`, `simba-3.0` |
| Voice | `--tts-voice <id>`, default `geffen_32` |
| Audio/language controls | `--tts-output-format mp3\|ogg\|aac\|wav\|pcm`, `--tts-language <tag>` |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider speechify=simba-3.2 --tts-voice geffen_32 --tts-language en-US --tts-output-format mp3
bun autoshow tts input/examples/tts/1-tts.md --provider speechify=simba-3.0 --tts-language fr-FR
bun autoshow tts input/examples/tts/1-tts.md --provider speechify=simba-3.2 --tts-voice speechify_custom_voice_123
bun autoshow config --tts speechify=simba-3.2 --tts-voice speechify_custom_voice_123
```

Speechify TTS sends text chunks to `POST /v1/audio/speech` and requests the selected output format, MP3 by default, before AutoShow converts the final result to `speech.wav`. Simba 3.2 is English-only and accepts the curated built-ins `beatrice_32`, `dominic_32`, `edmund_32`, `geffen_32`, `harper_32`, `hugh_32`, `imogen_32`, and `wyatt_32`; an unknown explicit ID is permitted because it may be a clone that Speechify manually approved. Simba 3.0 supports `en`/`en-*`, `de-DE`, `es-ES`, `es-MX`, `fr-FR`, `it-IT`, and `pt-BR` and accepts the full voice catalog.

Speechify synthesis accepts existing built-in or previously approved custom voice IDs. Reference-audio, voice-name, and consent-contact creation inputs are rejected from synthesis and configuration. `voice discover` reads shared or personal voices. The protected clone facet requires exactly one verified 10–30 second sample no larger than 5 MiB, a full-name/email consent payload, locale, gender, and an idempotency key; none of that PII enters the registration metadata. Speechify exposes no text-prompt design or native multi-speaker dialogue API, so existing IDs are rendered through the segmented path.

### Hume

| Option | Value |
|--------|-------|
| Selector | `--provider hume[=<model>]` |
| Models | `octave-1`, `octave-2` |
| Voice | `--tts-voice <name-or-id>`, default `Male English Actor` |
| Voice provider | `--hume-tts-voice-provider HUME_AI|CUSTOM_VOICE`, default `HUME_AI` for named voices |
| API settings | `HUME_API_KEY` |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider hume=octave-2
bun autoshow tts input/examples/tts/1-tts.md --provider hume=octave-2 --tts-voice "Male English Actor"
bun autoshow tts input/examples/tts/1-tts.md --provider hume=octave-2 --tts-voice 00000000-0000-4000-8000-000000000000
bun autoshow config --tts hume=octave-2 --tts-voice "Studio Voice" --hume-tts-voice-provider CUSTOM_VOICE
```

Single-voice Hume TTS uses Octave 2 through `POST /v0/tts/file`, sends `version: "2"`, requests MP3 chunks, and converts the final output to `speech.wav`. UUID-like voice values are sent as voice IDs unless a provider is explicit; named voices are sent with the selected provider.

Eligible multi-speaker Hume plans use ordered Octave 2 utterances through `POST /v0/tts`, with each voice ID, speed, and trailing silence retained on its own utterance. A request can return one to five independent takes; continuation uses only the deliberately selected prior generation ID and rejects a different Octave version. Word and phoneme timestamps are normalized to source turn IDs. Octave 1-only acting descriptions are never combined with Octave 2-only timing: required acting direction forces a truthful alternative plan instead of being dropped.

Use `voice discover` to inspect Hume stock or custom voices. Voice Design creates Octave 1 candidates and `voice materialize` saves the selected generation for Octave 1/2 synthesis. The documented clone workflow is subscription-gated in the Hume platform, so the clone adapter returns `external-action-required` and the resulting stable custom ID must be imported. Hume deletion requires a fresh unique mutable-name-to-stable-ID proof.

### Cartesia

| Option | Value |
|--------|-------|
| Selector | `--provider cartesia[=<model>]` |
| Models | `sonic-3.5-2026-05-04` |
| Voice | `--tts-voice <voice-id>`, default `f786b574-daa5-4673-aa0c-cbe3e8534c02` |
| Language | `--tts-language <code>` |
| API settings | `CARTESIA_API_KEY` |

```bash
bun autoshow tts input/examples/tts/1-tts.md --provider cartesia=sonic-3.5-2026-05-04 --tts-voice f786b574-daa5-4673-aa0c-cbe3e8534c02
bun autoshow tts input/examples/tts/1-tts.md --provider cartesia=sonic-3.5-2026-05-04 --tts-language en
bun autoshow config --tts cartesia=sonic-3.5-2026-05-04 --tts-voice f786b574-daa5-4673-aa0c-cbe3e8534c02
```

Cartesia TTS uses `POST /tts/bytes`, sends the pinned `2026-03-01` `Cartesia-Version` header, requests 24000 Hz `pcm_s16le` WAV bytes, and converts the final output to `speech.wav`. Text is split into 2000-character chunks. `voice discover` pages through public or account voices, the protected instant-clone facet posts one sample with its required language, and Pro Voice Clone remains a truthful gated dashboard action followed by stable-ID import. Cartesia exposes no text-prompt design or native speaker-dialogue API. Localization, pronunciation dictionaries, speed, volume, and emotion are documented provider features but remain outside the current synthesis option surface.

## Pricing Notes

- ElevenLabs API pricing is 10 cents / 1K characters for `eleven_v3` and `eleven_multilingual_v2`, and 5 cents / 1K characters for `eleven_flash_v2_5`. The two added models use an explicitly provisional 35885 ms / 1K characters timing estimate. Voice creation is priced separately by management and is never folded into synthesis estimates.
- MiniMax synthesis estimates are 6 cents / 1K characters for `speech-2.8-turbo` and 10 cents / 1K characters for `speech-2.8-hd`.
- Groq English Orpheus estimates use $22 / 1M characters, and Saudi Arabic Orpheus estimates use $40 / 1M characters, stored as single character rates to avoid double-counting input text.
- Grok TTS estimates use $15 per 1M characters (1.5 cents / 1K characters).
- Mistral `voxtral-mini-tts-2603` is priced at $0 input and $16 per 1M output characters, equivalent to 1.6 cents per 1K characters. AutoShow uses a 53926 ms / 1K characters timing heuristic.
- OpenAI `gpt-4o-mini-tts-2025-12-15` estimates use 60 cents / 1M input characters plus 1200 cents / 1M output characters, equivalent to 1.26 cents per 1K characters in AutoShow's character estimator. `tts-1` and `tts-1-hd` bill per character at $15 and $30 per 1M characters, equivalent to 1.5 and 3 cents per 1K characters.
- Gemini `gemini-3.1-flash-tts-preview` estimates use $1 / 1M input characters plus $20 / 1M output characters.
- Deepgram's Aura 2 voices use 3 cents / 1K characters and an explicitly provisional 39639 ms / 1K characters timing estimate.
- Speechify Simba estimates use 1 cent / 1K characters for `simba-3.2` and `simba-3.0`, with a 4500 ms / 1K characters timing heuristic. Voice creation is a separate management mutation and is not included in synthesis timing or cost.
- Hume `octave-1` and `octave-2` estimates use the conservative public overage rate of 15 cents / 1K characters.
- Cartesia Sonic estimates use 3.7375 cents / 1K characters for `sonic-3.5-2026-05-04`, with a 3000 ms / 1K characters timing heuristic.

## Output

- If exactly one TTS target succeeds, the run writes `speech.wav` plus `manifest.json`.
- If multiple TTS targets succeed, the run writes `speech-<service>-<sanitized-model>.wav` for each successful target plus `manifest.json`.
- Dialogue runs also write `dialogue-normalized.txt`. Segmented plans retain per-turn WAVs under `segments/`; eligible Gemini, ElevenLabs, and Hume native plans retain native batch/take timing instead of fabricating segment files.
- Existing managed custom voices record their stable selected resource ID as `speaker`; synthesis never records clone contact data or sample paths.
- Hume runs record the selected voice name or ID as `speaker`.
- Cartesia runs record the selected voice ID as `speaker`.
- `manifest.json` uses the canonical single-run shape. Its sole item's metadata includes `tts`, `cost`, and `timing`; `tts` is always an array, even when only one target succeeds.
- Current TTS entries include the operation-scoped `targetKey`, `transport`, and voice/settings/output-aware `renderIdentity` plus result/audio-run identities. Voice-quality benchmarks use those fields and optional registration, snapshot-entry, and character identities, so two voices on the same provider/model remain separate rows. Pre-ADR entries retain an explicit `legacy:service/model` fallback and cannot authorize cache reuse.
- Reference-audio runs store only `speaker: "ref_audio:<basename>"` in item/provider metadata; the full path and reference transcript are not written to `manifest.json`.
- `--output-dir` controls the run directory; generated file names remain provider-dependent and deterministic inside that directory.
