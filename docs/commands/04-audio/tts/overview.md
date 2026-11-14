# tts

Generate speech from local `.md`/`.txt` files or a directory of text files. Synthesis uses existing voices; [`voice`](../voice/00-voice-overview.md) handles discovery, design, cloning, consent, and approval.

```bash
bun autoshow tts input/examples/tts/01-tts-short.md --provider openai=gpt-4o-mini-tts-2025-12-15 --tts-voice alloy --price
```

Remove `--price` to synthesize after reviewing the estimate and [spending rules](../../../../AGENTS.md#paid-providers). Price inspection makes no provider calls or artifact writes; it cannot establish voice ownership, account entitlement, or output quality.

## Setup

Run `bun autoshow setup` to install local tools and `bun autoshow setup --doctor` to check readiness. Mastering and export require FFmpeg/ffprobe.

### Environment

Set the selected provider's credential: `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`, `SONIOX_API_KEY`, `XAI_API_KEY`, `OPENAI_API_KEY`, or `INWORLD_API_KEY`.

## Usage

```bash
bun autoshow tts <input> [flags]
bun autoshow tts --help
bun autoshow tts --help-topic provider:soniox
```

Without `--provider`, use the saved selection or the cheapest hosted target. Explicit selections replace the saved selection. Repeat `--provider provider[=model]` for multiple targets, use `--model` with exactly one provider, or select `--all-providers`.

## Shared TTS Options

- Speech controls use `--tts-voice`, `--tts-speed`, `--tts-language`, `--tts-text-normalization`, and `--tts-instructions` where supported. Use a bare value with one selected provider or `provider=value` with several. Controls apply to every selected model of that provider; unsupported controls fail locally. Provider sections below describe the differences.
- Dialogue requires repeatable `--tts-speaker SPEAKER=VOICE`, `--tts-dialogue-format screenplay|labeled`, and exactly one provider. Supply existing voice IDs, not reference-audio paths. Speaker mappings cannot be combined with `--tts-voice`. Eligible Gemini and ElevenLabs casts use native dialogue; other requests synthesize turns independently and assemble locally.
- `--provider-concurrency` caps targets for single-file runs (default seven). Directory runs share synthesis-request limits across files; `--batch-concurrency` affects timing estimates, not active hosted-file admission.
- `--step-concurrency tts-chunk=N` caps requests per provider across files: default 30, all-provider shortcut two, Grok-only 50, with Soniox always capped at three. `--concurrency-mode ramp` starts with one request and grows toward the cap; `immediate` starts at the cap.
- `--max-model-cents` removes targets whose summed estimate across all inputs exceeds that per-model ceiling. Saved `maxCents` instead gates the combined estimate; inspect either plan with `--price`.
- `--output-dir` pins the run directory. Keep partial outputs and use `resume` after failure. Add `--allow-ambiguous-redispatch` only when reconciliation cannot recover admitted work: it can purchase an unresolved request again.

```bash
bun autoshow tts input/examples/tts/01-tts-short.md --all-providers --max-model-cents 400 --price
```

## Audio Mastering and Export

Profiles determine local assembly; `--tts-response-format` separately controls provider source encoding where supported.

| Profile      | Audio                       | Loudness / edge silence                    |
| ------------ | --------------------------- | ------------------------------------------ |
| `native`     | Provider rate/channels      | Off; no added lead-in/out                  |
| `audiobook`  | 44.1 kHz mono               | −19 LUFS, −3 dBTP; 500/1000 ms lead-in/out |
| `legacy-16k` | 16 kHz mono legacy assembly | No mastering overrides or derived exports  |

Select with `--tts-audio-profile` (default `native`). For mastered profiles:

- `--tts-sample-rate`: `16000`, `22050`, `24000`, `32000`, `44100`, or `48000`; `--tts-channels`: `1` or `2`.
- `--tts-loudness`: `-40` to `-5` LUFS or `off`; `--tts-true-peak`: `-9` to `0` dBTP, requiring loudness normalization.
- `--tts-trim-silence on|off` (default off), `--tts-paragraph-pause`, `--tts-sentence-pause`, `--tts-lead-in`, and `--tts-lead-out`; silence values are `0–10000` ms.
- `--tts-export-format wav|flac|mp3|m4a|m4b` defaults to WAV. Non-WAV exports sit beside the WAV master. `--tts-bitrate 32–320` applies to MP3/M4A/M4B; defaults are 192 kbps for MP3 and 96 for M4A/M4B.
- Repeatable `--tts-metadata key=value` and `--tts-cover <jpg|jpeg|png>` require a non-WAV export. Metadata keys: `title`, `artist`, `album`, `album_artist`, `composer`, `date`, `genre`, `comment`, `track`, `copyright`.
- Directory-only `--tts-book` also assembles a book with one chapter per input, in numeric filename order. Chapter titles come from filenames.

Most delivery options can be saved with `setup`; metadata, cover, book assembly, and local pronunciation files are run-scoped.

### Chunking and seams

Smart chunking balances requests and prefers paragraph, sentence, clause, then word boundaries while protecting inline tags, abbreviations, and initials. `--tts-chunk-size 100–100000` lowers the request ceiling but cannot exceed provider/model limits. Dispatch, estimates, and joins share the resolved plan; resume preserves purchased request text.

Both `native` and `audiobook` preserve provider silence with no added join padding by default. Paragraph pause adds silence at paragraph and speaker-turn chunk joins; sentence pause affects sentence joins only. These controls neither change pauses inside a request nor shorten provider pauses. Trimming removes only confidently detected outer silence, preserving internal pauses and ambiguous/all-silent clips.

Requests do not share voice state across chunks. For ElevenLabs, fixed `--tts-seed` and moderate stability may reduce variation; continuity still needs listening review.

`--tts-pronunciations <file>` applies a local JSON alias lexicon before billing and chunking, with case-sensitive whole-word matching by default. Earliest matches win, ties prefer the earlier rule, and replacements are not rescanned. Avoid matching dialogue speaker labels.

```json
[
  { "match": "UN", "alias": "United Nations" },
  { "match": "dr.", "alias": "Doctor", "caseSensitive": false, "wordBoundary": false }
]
```

`--tts-text-preflight on` rejects unsupported SSML for ElevenLabs, permits Inworld's supported breaks, and warns for unverified providers or long bracketed prose. It does not translate free-form instructions into delivery tags.

### Audiobook workflow

Estimate the two-file `harborlight-chapters` fixture first, then synthesize chapter M4Bs and `book.m4b`:

```bash
bun autoshow tts input/examples/tts/harborlight-chapters --provider elevenlabs=eleven_v3 --price

bun autoshow tts input/examples/tts/harborlight-chapters \
  --provider elevenlabs=eleven_v3 --tts-stability 0.5 --tts-seed 12345 \
  --tts-audio-profile audiobook --tts-export-format m4b --tts-book \
  --tts-metadata "title=Harborlight Field Notes" --output-dir output/harborlight-book
```

Substitute your chapter directory and existing voice as needed. Cover art and lexicon options require real local files. M4B chapter support is generally more portable than MP3 chapter support.

### Existing output directories

Choose chunking and mastering on the first run. Completed directory reruns skip chapter synthesis/mastering and rebuild only exports, tags, cover art, and the book. Single-file runs cannot attach to an existing directory.

`resume` restores retained delivery, chunking, pronunciation, and provider controls. Explicit chunking/mastering changes must match the retained plan. Canonical runs created before delivery mastering adopt their legacy plan when no override is explicit.

Completed runs losslessly bundle purchased clips in `slots/audio.zip`, or `items/<stem>/slots/audio.zip` for directory inputs. Keep those archives with manifests, render/timeline records, and final audio: metadata alone cannot recreate purchased speech. Price inspection validates archives without extraction; local reassembly restores only needed clips. Failed/interrupted runs retain working audio and reconciliation journals. See [benchmark retention](../../../benchmarks/tts/README.md).

## TTS Services

### Gemini

Models: `gemini-3.8-flash-tts` and bare-provider default `gemini-3.8-flash-lite-tts`; default voice `Kore`. Both detect language automatically. `--tts-instructions` becomes separate speech-style metadata; inline pronunciation/pause notation stays in speech text. Numeric speed, forced language, seed, stability, provider dictionaries, and direct reference-audio synthesis are unsupported.

Unary mode defaults to 24 kHz WAV. `--tts-response-format wav|pcm|mulaw|alaw` changes source encoding; `--gemini-tts-mode stream` buffers streaming audio and defaults to PCM. Two eligible stock voices support native dialogue; custom voices, larger casts, and incompatible controls use segmented rendering. Native takes have no invented word/turn timestamps.

```bash
bun autoshow tts input/examples/tts/01-tts-short.md --provider gemini --gemini-tts-mode stream --tts-instructions "Calm narration." --price
bun autoshow tts input/examples/tts/01-tts-short.md --provider gemini --gemini-tts-mode batch --gemini-tts-batch-wait-seconds 0 --price
```

Directory batching is local. Remote `--gemini-tts-mode batch` requires explicit Gemini selection and rejects `--all-providers`. It submits jobs using WAV, waits up to 86,400 seconds by default, or submits/returns with wait `0`. Other explicitly selected providers run concurrently in a separate directory; mixed runs require `--output-root` rather than `--output-dir`. Both plans are validated/priced first; the configured budget covers their combined bound.

Resume the printed directory with `resume <output-dir> --provider-job-action status|wait|cancel` (default `wait`). Stopping local waiting leaves jobs running; cancellation retains completed results. Recovery reconciles jobs/audio before resubmitting, and unresolved submission blocks automatic repurchase.

The pricing resolver applies the registered effective-date schedule, half-rate Batch pricing, and the January 2027 increase. Jobs that can cross a rate boundary reserve the higher schedule. Token/duration estimates and authorization bounds are not invoices. See [Gemini speech controls](https://ai.google.dev/gemini-api/docs/speech-generation) and [voice lifecycle](../voice/00-voice-overview.md) for custom voices.

### ElevenLabs

Models: `eleven_v3` (bare-provider default) and `eleven_v4`; default voice `hpp4J3VqNfWAUOO0d1Us`. Single-voice limits are 5,000 and 10,000 characters respectively; native dialogue supports up to ten voices and 2,000 total submitted characters.

Both accept `--tts-language`, stability `0–1`, seed `0–4294967295`, normalization `auto|on|off`, pronunciation dictionary locators (`dictionary_id[:version_id]`, repeatable), and response formats. V4 also accepts `--tts-similarity 0–1`; v3 rejects it. Both reject numeric speed, style, speaker boost, and SSML `<break>`/`<phoneme>` tags. Use documented inline cues rather than arbitrary instruction prose; dialogue also puts tags inside speech text.

The default source format is `mp3_44100_128`. Alternatives `mp3_44100_192`, `wav_44100`, and `wav_48000` depend on account entitlement; rejected formats are not silently replaced. V3 remains the default to preserve existing voice characterization; compare accent-dependent output before moving to v4.

```bash
bun autoshow tts input/examples/tts/01-tts-short.md --provider elevenlabs=eleven_v4 --tts-stability 0.5 --tts-similarity 0.7 --price
```

### Soniox

Model `tts-rt-v2` defaults to voice `Adrian`, language `en`, and speed `1`. Voice names/cloned IDs are case-sensitive, 1–50 characters, and checked by Soniox. `--tts-language` requires a supported code (`auto` is rejected); `--tts-speed` accepts `0.7–1.3`.

Native emotion/delivery/pause tags stay inline, for example `[warm] Hello. [pause] Welcome.` Free-form instructions, source-format overrides, reference audio, and voice creation are not exposed. Multi-speaker input uses local turn assembly.

Chunks include at most 500 characters, preserving tags/Unicode; a smaller chunk override can lower that ceiling. Limits are three concurrent requests and 100 starts/minute across files, speakers, and retries. Source audio is 24 kHz WAV. Retained responses must decode and remain below 119 seconds, guarding the provider's two-minute cap; this does not prove every word was spoken. Invalid successful requests require reconciliation before repurchase.

Pricing is estimated from text and audio duration because REST provides no authoritative token counts. Local inserted silence is excluded from generated-audio duration. Resume restores retained voice, language, speed, speakers, and chunk settings.

```bash
bun autoshow tts input/examples/tts/01-tts-short.md --provider soniox --tts-voice Adrian --tts-language en --tts-speed 1 --price
```

### Grok

Model `grok-tts` defaults to voice `eve` and language `auto`. Select stock voices or an account-owned eight-character custom voice ID with `--tts-voice`; local validation does not establish ownership. Supports speed `0.7–1.5`, language codes, boolean text normalization, and native inline speech/pause tags. Free-form `--tts-instructions` is unsupported.

```bash
bun autoshow tts input/examples/tts/01-tts-short.md --provider grok=grok-tts --tts-voice eve --tts-language en --tts-speed 1.1 --price
```

### OpenAI

Model `gpt-4o-mini-tts-2025-12-15` defaults to `alloy`; eligible custom IDs begin with `voice_`. Supports separate `--tts-instructions` and numeric speed `0.25–4`, with local turn assembly for dialogue.

Input is limited to 2,000 tokens; speech text and instructions each also have 4,096-character API limits. The conservative local budget counts instructions and Unicode, so long inputs may need smaller chunks. Estimates account for text/audio tokens, repeated instructions, and speed; binary WAV responses do not provide authoritative usage.

```bash
bun autoshow tts input/examples/tts/01-tts-short.md --provider openai=gpt-4o-mini-tts-2025-12-15 --tts-instructions "Warm documentary narration" --tts-speed 1.1 --price
```

### Inworld

Model `realtime-tts-2` defaults to `voice_inworld_standard_en`. Supports separate `--tts-instructions`, numeric speed `0.5–1.5`, timed SSML breaks, and native inline steering tags. Language overrides and native multi-speaker requests are not exposed; dialogue uses local turn assembly.

```bash
bun autoshow tts input/examples/tts/01-tts-short.md --provider inworld=realtime-tts-2 --tts-instructions "Sound reassuring" --price
```

## Output

Single-target runs write `speech.wav`; multiple targets use `speech-<service>-<sanitized-model>.wav`. Non-WAV exports share the master stem. Directory books use `book.<format>`, or `book-<service>-<sanitized-model>.<format>` for multiple targets.

The canonical `manifest.json` retains targets, voice bindings, settings, cost/timing, and links to dialogue/render/timeline records and purchased clips. Output filenames remain deterministic when a directory is pinned.

## Provider Capabilities

Spoken text, inline delivery tags, and dedicated instruction fields are different inputs. Gemini, OpenAI, and Inworld accept request-level instructions; ElevenLabs, Grok, and Soniox use inline cues. Qualitative cues do not promise exact pacing or silence. Use local chunk-join gaps for explicit inter-chunk timing.

Every provider supports existing voices and segmented dialogue. Native dialogue is limited to eligible Gemini stock-voice casts and ElevenLabs v3/v4. Design/clone/import capabilities differ by provider; consult the [voice guides](../voice/00-voice-overview.md) and provider help instead of assuming a generic flag is universally supported.

Use `--price` for the current registered estimate for your text and controls. Source encoding, decoding, request success, and mocked contracts do not establish spoken-text correctness or perceptual quality. See [TTS tests](tests.md) for verification scope.
