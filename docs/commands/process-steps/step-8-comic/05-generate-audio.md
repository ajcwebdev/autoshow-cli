# comic generate-audio

`generate-audio` consumes an existing compatible scene run and approved current voice registrations. It never creates, clones, approves, or deletes voices during synthesis.

See the [`comic` overview](./00-comic-overview.md) for catalogs, runtime paths, and the full walkthrough.

## Outline

- [generate-audio](#generate-audio)
  - [Options](#options)
  - [Examples](#examples)
  - [Behavior](#behavior)

## generate-audio

### Options

| Flag                                   | Description                                                                                                                                                                 | Default         |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| `--provider <provider[=model]>`        | Select a TTS provider/model; repeatable                                                                                                                                     | cheapest hosted |
| `--sfx-provider <provider=model>`      | Select the dedicated authored sound-effect target; accepts `elevenlabs=eleven_text_to_sound_v2`, `replicate=sepal/audiogen@<pinned-version>`, or `stability=stable-audio-3` | none            |
| `--sfx-license-use <classification>`   | Declare intended use for license-restricted SFX targets: `noncommercial`, `commercial`, or `unknown`; required for AudioGen and never inferred from model selection         | none            |
| `--sfx-concurrency <count>`            | Bound parallel sound-effect requests independently from dialogue generation                                                                                                 | `2`             |
| `--concurrency-mode <ramp\|immediate>` | Approach hosted dialogue and sound-effect caps from one request per provider/account lane (`ramp`) or start at the configured caps (`immediate`)                            | `ramp`          |
| `--soundscape-timing-policy <policy>`  | Resolve inline text offsets with exact evidence (`strict`) or recorded canonical-offset interpolation (`proportional`)                                                      | `strict`        |
| `--all-providers`                      | Select every hosted TTS target                                                                                                                                              | `false`         |
| `--profile <key>`                      | Select the approved registration profile for every subject/target                                                                                                           | `default`       |
| `--mode <mode>`                        | `auto`, strict `native`, or `segmented`                                                                                                                                     | `auto`          |
| `--delivery-policy <policy>`           | `strict` rejects unsupported authored delivery; `best-effort` records unsupported intent and continues                                                                      | `strict`        |
| `--pacing-profile <profile>`           | `none` or deterministic `loose-comedy` authored-pause/interturn pacing                                                                                                      | `none`          |
| `--max-generation-slots <count>`       | Admit at most this many unresolved segmented-render slots, persist a resumable checkpoint, and exit without publishing a final WAV                                          | none            |
| `--allow-ambiguous-redispatch`         | Explicitly authorize bounded in-process retries and later repurchase of an unresolved slot whose provider admission cannot be reconciled to retained audio                  | `false`         |
| `--role <label=subject>`               | Resolve an uncatalogued or compound label to `role:key` or `voice:key`; repeatable                                                                                          | none            |
| `--price`                              | Plan source identity, casting, strategy, generation slots, and cost without calls or writes                                                                                 | `false`         |

### Examples

```bash
bun autoshow comic generate-audio 01-01 --provider gemini=gemini-3.1-flash-tts-preview --profile default
bun autoshow comic generate-audio 01-01 --provider mistral=voxtral-mini-tts-2603 --mode segmented
bun autoshow comic generate-audio 01-01 --provider minimax=speech-2.8-hd --mode segmented
bun autoshow comic generate-audio 01-01 --provider cartesia=sonic-3.5-2026-05-04 --mode auto
bun autoshow comic generate-audio 01-01 --provider speechify=simba-3.2 --mode auto
bun autoshow comic generate-audio 07-04 --provider hume=octave-1 --provider hume=octave-2 --provider elevenlabs=eleven_v3 --profile ep07-comparison --mode segmented --delivery-policy best-effort --pacing-profile loose-comedy
bun autoshow comic generate-audio 01-01 --provider gemini --role "SHIP COMPUTER=role:computer"
bun autoshow comic generate-audio 01-01 --all-providers --price
```

### Behavior

- With `--output-dir`, the command validates that exact existing directory. Without it, the command scans matching timestamped scene directories newest-first and finds an exact source-path, source-byte, manifest, structured-script, and checksum match.
- Every speakable source segment becomes one provider-neutral dialogue node. Inline authored timing is retained as a turn cue. The `loose-comedy` profile maps `beat`, `pause`/`moment`, and `long`/`heavy` cues to deterministic silences and adds a short interturn gap, recorded in the mix ledger and final timeline. Compound speech remains an explicit overlap unless `--role` casts the label to one subject.
- Casting is all-target and profile-qualified. Every speaking subject must have one approved registration for each selected provider/model/profile in an aggregate immutable scene snapshot. Once created, corrective invocations may select any contained subset of targets without recasting.
- The shared TTS subsystem manages provider readiness, plans, generation slots, admission evidence, render results, audio runs, timing, mix/transform ledgers, final timelines, and resume safety. Comic writes provider projections under `comicAudio`.
- `--max-generation-slots` sets an execution limit for segmented renders, selecting unresolved slots in plan order, forcing sequential dispatch, writing slot evidence, and leaving the run resumable without publishing `audio/final/`.
- `--price` is resume-aware and read-only. It validates retained render evidence, subtracts promoted slots from the estimate, and prices only unresolved work. When all slots are retained, it reports zero spend with local finalization.
- Provider-admitted or ambiguous work without valid retained audio is blocked from automatic repurchase. `--allow-ambiguous-redispatch` explicitly authorizes duplicate spend for bounded in-process retries and checkpoint resume. DeepInfra permits up to eight attempts per slot with exponential backoff.
- Failed synthesis runs report a recovery checkpoint with retained, unresolved, and blocked slots. Rerunning resumes using verified completed segments.
- Provider capabilities: Gemini native dialogue supports exactly two distinct speakers. ElevenLabs `eleven_v3` uses turn-safe Text-to-Dialogue with recognized model audio tags. Hume `octave-1` accepts authored delivery as prompt descriptions; Hume `octave-2` uses ordered native utterances with per-turn speed/silence controls (`--delivery-policy best-effort` records unsupported direction). MiniMax, Cartesia, and Speechify use segmented rendering in `auto` mode. Mistral consumes approved saved voices or protected request-reference registrations.
- Cartesia and Speechify approved voices participate through the same provider-qualified snapshot via `voice` / `comic reference-voice`. `generate-audio` does not invoke clone or design actions during synthesis.
- Authored overlap nodes and local voice-effect filters (radio/intercom/telephone/computer) force segmented rendering and are recorded in the mix ledger and timeline.
- Authored `**SFX:**`, `**VOCAL SFX:**`, `**AMBIENCE:**`, `[[SFX: ...]]`, and `[[VOCAL SFX: ...]]` directives populate the soundscape plan. Directives are required unless prefixed with `OPTIONAL`; optional `{duration: 2.5s, gain: -3dB, pan: -0.4}` envelopes specify synthesis duration and mix parameters.
- Inline text offsets default to strict timing. `--soundscape-timing-policy proportional` maps offsets across turn ranges and records its algorithm and error bound.
- Scenes with zero speakable turns complete locally with an empty dialogue plan.
- Final mastering produces a 48 kHz stereo 24-bit PCM WAV.
- On success, dialogue compact writes `audio/<target-key>/render.json`, `audio/<target-key>/timeline.json`, and `audio/slots/<slotHash>.wav`, then hardlinks `audio/final/<target-key>.wav`.

Next: [generate-slideshow](./06-generate-slideshow.md).
