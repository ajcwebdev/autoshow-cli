# TTS benchmarks — 2026-09-12

> **Eleven v3 controls defect:** User listening review found that the emotion recording speaks instruction prose (“as if sharing a private secret”). Its API success and valid WAV do not mean the benchmark passed. The timing case uses the same long-prose tag construction and is unverified. Recorded costs remain included.

Seven benchmark groups cover nine currently implemented models: 45 completed text-example recordings and 16 completed detailed-controls recordings, for 61 recordings total. Their combined render-record estimate is $1.75817; these are planned costs, not provider-confirmed charges. Summary tables include only models present in the current TTS registry.

## Benchmarks

- [00-tts-shortest](./2026-09-12_01-10-41-232_00-tts-shortest/benchmark-report.md) — nine implemented models.
- [01-tts-short](./2026-09-12_01-10-41-232_01-tts-short/benchmark-report.md) — nine implemented models.
- [02-tts-hard](./2026-09-12_01-10-41-232_02-tts-hard/benchmark-report.md) — nine implemented models.
- [03-tts-harder](./2026-09-12_01-10-41-232_03-tts-harder/benchmark-report.md) — nine implemented models.
- [04-tts-dialogue](./2026-09-12_01-10-41-232_04-tts-dialogue/benchmark-report.md) — nine implemented models.
- [05 — Emotion, delivery and detailed instructions](./2026-09-12_detailed-instructions/2026-09-12_05-tts-emotion/benchmark-report.md) — 5 cases; [listen](./2026-09-12_detailed-instructions/2026-09-12_05-tts-emotion/listen.html).
- [06 — Speeds and pauses with detailed instructions](./2026-09-12_detailed-instructions/2026-09-12_06-tts-speed-pauses/benchmark-report.md) — 11 cases; [listen](./2026-09-12_detailed-instructions/2026-09-12_06-tts-speed-pauses/listen.html).

## Command and scope

The five text examples used the following approved command when the input directory contained exactly those files:

```bash
bun autoshow tts input/examples/tts --all-providers --tts-ref-audio mistral=input/examples/audio/anthony-voice.mp3
```

Default provider voices were used, with the approved reference recording for Mistral. All five examples, including dialogue, used single-voice synthesis. The original batch elapsed time was 76.64 seconds; this historical wall time includes targets subsequently removed from the implementation and is not a timing estimate for the filtered model set. The retained 45 recordings have a render-record estimate of $1.34979. Removing models from this summary does not refund historical spending.

The two detailed-controls suites were rerun with explicit provider/model selections:

```bash
bun src/tools/tts-controls-benchmark.ts --suite all --run --approved-budget-cents 101
```

The approved fresh run completed all 16 cases in 52 requests. Its preflight estimate was $0.40863 and its render-record estimate is $0.40838. The cumulative controls-work estimate is $1.00302, including earlier controls runs; it is separate from the five-input batch and must not be added again to this report's recording total. Each case has five simple, self-describing spoken lines. Free-form descriptions or natural-language tags are expanded where supported. Emotion and timing remain separate; nonverbal cues are excluded. OpenAI mini TTS and Speechify remain implemented and appear in the text-example results, but are excluded from both controls suites at the user's request. Mistral has no controls case because validated reference-conditioned fixtures were not prepared.

## Third-party service models

### Text-example price ranking

Sorted by total render-record estimate across the same five inputs. Processing times include any scheduler waiting inside each target and are not isolated provider latency measurements. Summed target times can exceed batch wall time because work overlaps.

| Provider/model | Success | Estimated USD | Summed processing s | Generated audio s |
| --- | ---: | ---: | ---: | ---: |
| speechify/simba-3.2 | 5/5 | $0.02616 | 66.72 | 175.47 |
| openai/gpt-4o-mini-tts-2025-12-15 | 5/5 | $0.03296 | 59.28 | 189.55 |
| grok/grok-tts | 5/5 | $0.03924 | 47.78 | 204.92 |
| mistral/voxtral-mini-tts-2603 | 5/5 | $0.04186 | 53.17 | 195.89 |
| inworld/realtime-tts-2 | 5/5 | $0.06540 | 73.25 | 182.28 |
| cartesia/sonic-3.6-2026-08-27 | 5/5 | $0.09777 | 75.98 | 182.08 |
| elevenlabs/eleven_v3 | 5/5 | $0.26160 | 108.81 | 207.28 |
| hume/octave-1 | 5/5 | $0.39240 | 163.60 | 243.98 |
| hume/octave-2 | 5/5 | $0.39240 | 131.30 | 210.22 |

### Text-example processing-time ranking

| Rank | Provider/model | Summed processing s |
| ---: | --- | ---: |
| 1 | grok/grok-tts | 47.78 |
| 2 | mistral/voxtral-mini-tts-2603 | 53.17 |
| 3 | openai/gpt-4o-mini-tts-2025-12-15 | 59.28 |
| 4 | speechify/simba-3.2 | 66.72 |
| 5 | inworld/realtime-tts-2 | 73.25 |
| 6 | cartesia/sonic-3.6-2026-08-27 | 75.98 |
| 7 | elevenlabs/eleven_v3 | 108.81 |
| 8 | hume/octave-2 | 131.30 |
| 9 | hume/octave-1 | 163.60 |

### Detailed-controls coverage

Counts and estimates are grouped by model. Each model uses its supported mechanisms, so these unequal case sets are not a cross-model price or speed ranking. Exact instructions, per-case measurements and recordings are linked above.

| Provider/model | Emotion cases | Speed/pause cases | Estimated USD | Generated audio s |
| --- | ---: | ---: | ---: | ---: |
| cartesia/sonic-3.6-2026-08-27 | 1 | 2 | $0.03289 | 66.20 |
| elevenlabs/eleven_v3 | 1 | 1 | $0.14380 | 47.92 |
| grok/grok-tts | 1 | 2 | $0.01111 | 56.95 |
| hume/octave-1 | 1 | 2 | $0.09030 | 66.22 |
| hume/octave-2 | 0 | 2 | $0.08250 | 43.13 |
| inworld/realtime-tts-2 | 1 | 2 | $0.04777 | 67.60 |

### Automated and human quality

Automated quality is unavailable because roundtrip transcripts were not generated. Human quality is unavailable because no listening scores were supplied. Successful decoding, duration, speed and price do not establish pronunciation, voice quality or instruction adherence. The timing suite's whole-turn rate diagnostics are screening measurements rather than proof of a requested multiplier or exact pause duration.

## Local models

No local models were included; local price, speed and quality rankings are unavailable.

## Verification and provenance

- The selected 61 recordings succeeded. Current report generation verified all 61 final-audio hashes and all 61 render-record hashes against their manifests.
- Earlier audio validation fully decoded the original batch's final WAVs and all 16 detailed-controls WAVs locally with ffmpeg. The detailed-controls run also verified 116 archive and cached-slot references.
- Costs and request counts come from each selected archive's render record; processing times come from matching manifest TTS metadata. Registry membership comes from the current configuration under `src/cli/commands/setup-and-utilities/models/tts-config/`.
- The missing fixture references were corrected. The latest default verification passed `bun run check` and all 137 commands in `bun t --price`; 151 targeted local tests passed before the detailed-controls run.
- Report links were checked locally. No provider calls were made to update this summary.

Original batch manifest SHA-256: `b48a5b4e612b7cce2c8fb7e3d473c3f1edbc02398fbd67f76935c6ba0633d58f`.

[Original manifest evidence](./2026-09-12-benchmark-report.evidence.zip) contains the original `manifest.json` bytes and `SHA256SUMS`. Historical per-example records remain unchanged; this summary filters them to implemented models. The two detailed-controls directories contain their exact plans, manifests, audio, request controls and listening pages.
