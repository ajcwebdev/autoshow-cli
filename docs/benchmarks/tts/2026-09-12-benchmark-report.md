# TTS benchmarks — retained evidence

> **Eleven v3 controls defect:** User listening review found that the emotion recording speaks instruction prose (“as if sharing a private secret”). Its API success and valid WAV do not mean the benchmark passed. The timing case uses the same long-prose tag construction and is unverified. Recorded costs remain included.

Updated 2026-09-25 after the [ADR-010 provider exclusions](../../adr/ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md#excluded-integrations). 36 narration results across 9 models and four inputs, plus 15 controls results, remain selected (51 recordings). Recorded selected costs total $0.74832: narration $0.50770, controls $0.24062. Cost bases include provider usage, computed usage, and estimates; these are not confirmed invoices or total historical spending.

These original aggregate totals retain their earlier precision. The reproducible dashboard now uses the surviving controls table rows, whose rounded costs sum to $0.24060, a $0.00002 difference from the original controls aggregate.

## Benchmarks

- [2026-09-12_01-10-41-232_00-tts-shortest](./2026-09-12_01-10-41-232_00-tts-shortest/benchmark-report.md)
- [2026-09-12_01-10-41-232_01-tts-short](./2026-09-12_01-10-41-232_01-tts-short/benchmark-report.md)
- [2026-09-12_01-10-41-232_02-tts-hard](./2026-09-12_01-10-41-232_02-tts-hard/benchmark-report.md)
- [2026-09-12_01-10-41-232_03-tts-harder](./2026-09-12_01-10-41-232_03-tts-harder/benchmark-report.md)
- [Emotion and delivery](./2026-09-12_detailed-instructions/2026-09-12_05-tts-emotion/benchmark-report.md) — 6 cases.
- [Speed and pauses](./2026-09-12_detailed-instructions/2026-09-12_06-tts-speed-pauses/benchmark-report.md) — 9 cases.

## Third-party service models

### Narration price ranking

| Rank | Provider/model                    | Coverage | $ / 1K input chars | Total cost |
| ---- | --------------------------------- | -------- | ------------------ | ---------- |
| 1    | speechify/simba-3.2               | 4/4      | $0.01000           | $0.02170   |
| 2    | openai/gpt-4o-mini-tts-2025-12-15 | 4/4      | $0.01260           | $0.02734   |
| 3    | gemini/gemini-3.8-flash-lite-tts  | 4/4      | $0.01379           | $0.02992   |
| 4    | grok/grok-tts                     | 4/4      | $0.01500           | $0.03255   |
| 5    | mistral/voxtral-mini-tts-2603     | 4/4      | $0.01600           | $0.03472   |
| 6    | soniox/tts-rt-v2                  | 4/4      | $0.01779           | $0.03860   |
| 7    | gemini/gemini-3.8-flash-tts       | 4/4      | $0.02379           | $0.05162   |
| 8    | inworld/realtime-tts-2            | 4/4      | $0.02500           | $0.05425   |
| 9    | elevenlabs/eleven_v3              | 4/4      | $0.10000           | $0.21700   |

### Narration speed ranking

| Rank | Provider/model                    | Audio / generation time | Timing coverage |
| ---- | --------------------------------- | ----------------------- | --------------- |
| 1    | grok/grok-tts                     | 5.47×                   | 4/4             |
| 2    | mistral/voxtral-mini-tts-2603     | 4.41×                   | 4/4             |
| 3    | openai/gpt-4o-mini-tts-2025-12-15 | 3.66×                   | 4/4             |
| 4    | inworld/realtime-tts-2            | 3.33×                   | 4/4             |
| 5    | speechify/simba-3.2               | 3.11×                   | 4/4             |
| 6    | elevenlabs/eleven_v3              | 2.23×                   | 4/4             |
| 7    | soniox/tts-rt-v2                  | 2.13×                   | 4/4             |
| n/a  | gemini/gemini-3.8-flash-lite-tts  | n/a                     | 1/4             |
| n/a  | gemini/gemini-3.8-flash-tts       | n/a                     | 3/4             |

Speed uses measured final audio duration divided by recorded generation and local assembly time. Local recovery timings are excluded. Full four-input coverage is required. Provider timing retains the original concurrency and machine conditions.

### Controls coverage

Case inputs and mechanisms differ, so this is coverage rather than a cross-provider ranking.

| Provider/model                   | Emotion | Speed/pauses | Recorded cost |
| -------------------------------- | ------- | ------------ | ------------- |
| elevenlabs/eleven_v3             | 1       | 1            | $0.14400      |
| gemini/gemini-3.8-flash-lite-tts | 1       | 1            | $0.01067      |
| gemini/gemini-3.8-flash-tts      | 1       | 1            | $0.01474      |
| grok/grok-tts                    | 1       | 2            | $0.01115      |
| inworld/realtime-tts-2           | 1       | 2            | $0.04780      |
| soniox/tts-rt-v2                 | 1       | 2            | $0.01226      |

### Automated and human quality

Roundtrip accuracy and human listening scores are unavailable. Successful transport, audio decoding, hashes, speed, and cost do not establish spoken-text correctness, audible control effectiveness, or perceptual quality. Existing listening defects remain in the controls reports.

## Local models

No local models were included; local rankings are unavailable.

## Verification and provenance

Original render records and controls manifests were removed. [Dashboard evidence](./dashboard.evidence.zip) preserves byte-identical retained manifests and per-run reports, a checksum manifest, and `dashboard.json` with audio hashes and local ffprobe measurements. Narration audio hashes match the retained manifests; controls hashes record the currently retained files because their original manifests are unavailable. Narration costs and exact timings come from manifests; controls costs and timings retain report precision. No synthesis or new listening assessment was performed. The dashboard can be regenerated with `bun .codex/skills/consensus/scripts/run.ts build-combined-dashboard`, including in a checkout without ignored audio. Playback and rechecking audio hashes require the original recordings.

[Filtered manifest evidence](./2026-09-12-benchmark-report.evidence.zip) contains the retained original batch items and an updated SHA256SUMS manifest. It is a filtered derivative, not the original batch manifest. Its manifest SHA-256 is `7484a803d54f960fe64609cd1ed3cde5cd679b4d46cd4a919320f8acf7473938`. Newer narration results remain in their per-run manifests; controls retain their summary reports. Ignored local audio and runtime outputs were preserved.
