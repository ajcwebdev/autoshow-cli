# TTS Consensus

Use this category for AutoShow text-to-speech runs with canonical `manifest.json` metadata, generated audio files, and the original input text. The loader accepts ordinary `command: "tts"` runs and completed `command: "comic"` audio runs that retain their final outputs in place and expose `metadata.tts` evaluation entries; comic provider cost is recovered from each selected canonical render result without copying or restaging audio.

## Packet

```bash
bun scripts/run.ts tts build-packet "$RUN_DIR" --input-text /path/to/input.txt --out "$TMP_PACKET"
```
The packet verifies audio artifacts and records measurable metadata such as duration, speaking rate, processing time, and cost.

## Evaluation

Write `consensus-evaluation.txt` as plain text. Do not claim to have listened to audio or assessed voice quality unless an explicit voice-quality report already provides that metric.

## Report

```bash
bun scripts/run.ts tts build-report "$RUN_DIR" --input-text /path/to/input.txt
```
With local roundtrip STT transcripts already present:

```bash
bun scripts/run.ts tts build-report "$RUN_DIR" --input-text /path/to/input.txt --roundtrip-dir /path/to/roundtrip
```
TTS reports expose complete local and third-party service rankings for `price`, `speed`, `automatedQuality`, and `humanQuality`. These TTS arrays are not capped at three providers.

Compatibility aliases are preserved:

1. Use `speed` for latency rankings.
2. Use `price` for cost rankings.
3. Use `humanQuality` when human scores are present; otherwise use `automatedQuality`.

Automated quality uses roundtrip WER-derived accuracy when available, including median roundtrip WER from `voice-quality-report.json`. Human quality uses `humanSpeechScore` from `voice-quality-report.json`. Duration, bitrate, file size, and subjective judgment are not quality proxies.

Markdown should use Local Models and Third-Party Service Models sections and should not describe TTS ranking surfaces as “Top 3”. Normalized TTS JSON and markdown omit overall ranking and model-tier output.

## Repository dashboard

From the repository root, refresh the TTS tab and the other benchmark tabs without provider calls:

```bash
bun .codex/skills/consensus/scripts/run.ts build-combined-dashboard
```

The TTS dashboard tab includes narration plus the independent emotion/delivery and speed/pause benchmarks. Narration reads current selected results from direct-child manifests under `docs/benchmarks/tts/`. The other two independently select the newest dated directory ending in `tts-emotion` or `tts-speed-pauses`. The controls runner uses `<YYYY-MM-DD>_05-tts-emotion/` and `<YYYY-MM-DD>_06-tts-speed-pauses/`, dated when the benchmark first runs and pinned in the shared ledger for subsequent reuse. An empty or absent TTS root produces an empty tab with no results or rankings. Complete run archives require verified render and final-audio hashes and local duration/format probes. An optional `dashboard.evidence.zip` can preserve checksummed manifests, reports, audio hashes and probe measurements for reproduction without ignored audio; source changes invalidate it, and locally present audio must match its recorded hash. The archive is read with `unzip`.

Earlier controls revisions and unselected historical audio are excluded. Narration rankings require complete coverage of the common corpus; emotion/delivery and speed/pauses each have their own case table and review notes within the same TTS tab. Their different inputs and mechanisms do not justify cross-provider rankings. Evidence links point to retained manifests or reports, and audio links require the original local files.

Costs prefer observed usage, then the manifest's recorded usage estimate, then the selected render's planned estimate. Historical spending is excluded; Soniox's measured-audio costs remain estimates. Throughput divides total final audio duration by total recorded generation time. Local recovery timings stay visible but are excluded from generation rankings. Existing controls-report listening defects are displayed separately from successful execution. Accuracy and human quality remain unranked without assessment scores; valid audio and measured performance do not establish spoken-text correctness or audible control effectiveness.
