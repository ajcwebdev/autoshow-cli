# TTS Voice Quality Report

## Summary

- Input text: `0-tts-short.txt` (16 characters, 3 words)
- Total providers: 16 (0 local, 16 cloud)
- Mode: full
- Human speech score: 55% naturalnessScore + 45% speechQualityScore
- Naturalness score target weights: 45% UTMOSv2 MOS, 25% NISQA-TTS naturalness MOS, 20% paid audio-judge rubric, 10% prosody heuristics
- Speech quality score target weights: 35% NISQA quality MOS, 25% DNSMOS, 25% roundtrip STT intelligibility, 15% signal hygiene

## Method

- Audio files are normalized to temporary 16 kHz mono WAV for scoring. Original files are not modified.
- Silence threshold is computed adaptively from the audio noise floor.
- MOS-style 1-5 metrics are converted with `(mos - 1) / 4 * 100`.
- Missing components are omitted from that score's denominator and listed per provider.
- Cost, provider processing speed, and provider latency are not included in human-speech scoring.
- Full mode treats attempted paid scoring failures as fatal when credentials are configured.
- Local mode never starts paid STT or audio-judge calls.
- Confidence: High (>80% coverage), Medium (40-80%), Low (<40%). Low-coverage scores are preliminary.

## Overall Ranking

| Rank | Provider | Group | Human / 100 | Naturalness | Speech Quality | Confidence | Nat/Qual Coverage | Missing Metrics |
| ---: | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| 1 | `openai/tts-1-hd` | cloud | 91.75 | 85.00 | 100.00 | Low | 30% / 40% | naturalness.utmosv2Mos, naturalness.nisqaTtsNaturalnessMos, speechQuality.nisqaQualityMos, speechQuality.dnsmos |
| 2 | `speechify/simba-english` | cloud | 91.72 | 84.94 | 100.00 | Low | 30% / 40% | naturalness.utmosv2Mos, naturalness.nisqaTtsNaturalnessMos, speechQuality.nisqaQualityMos, speechQuality.dnsmos |
| 3 | `hume/octave-2` | cloud | 91.35 | 86.85 | 96.86 | Low | 30% / 40% | naturalness.utmosv2Mos, naturalness.nisqaTtsNaturalnessMos, speechQuality.nisqaQualityMos, speechQuality.dnsmos |
| 4 | `minimax/speech-2.8-turbo` | cloud | 90.71 | 83.44 | 99.61 | Low | 30% / 40% | naturalness.utmosv2Mos, naturalness.nisqaTtsNaturalnessMos, speechQuality.nisqaQualityMos, speechQuality.dnsmos |
| 5 | `deepgram/aura-2-thalia-en` | cloud | 89.08 | 80.94 | 99.02 | Low | 30% / 40% | naturalness.utmosv2Mos, naturalness.nisqaTtsNaturalnessMos, speechQuality.nisqaQualityMos, speechQuality.dnsmos |
| 6 | `openai/tts-1` | cloud | 88.96 | 84.54 | 94.37 | Low | 30% / 40% | naturalness.utmosv2Mos, naturalness.nisqaTtsNaturalnessMos, speechQuality.nisqaQualityMos, speechQuality.dnsmos |
| 7 | `minimax/speech-2.8-hd` | cloud | 87.64 | 78.54 | 98.76 | Low | 30% / 40% | naturalness.utmosv2Mos, naturalness.nisqaTtsNaturalnessMos, speechQuality.nisqaQualityMos, speechQuality.dnsmos |
| 8 | `grok/grok-tts` | cloud | 85.83 | 77.97 | 95.43 | Low | 30% / 40% | naturalness.utmosv2Mos, naturalness.nisqaTtsNaturalnessMos, speechQuality.nisqaQualityMos, speechQuality.dnsmos |
| 9 | `groq/canopylabs/orpheus-v1-english` | cloud | 84.50 | 75.28 | 95.78 | Low | 30% / 40% | naturalness.utmosv2Mos, naturalness.nisqaTtsNaturalnessMos, speechQuality.nisqaQualityMos, speechQuality.dnsmos |
| 10 | `elevenlabs/eleven_v3` | cloud | 84.17 | 76.64 | 93.37 | Low | 30% / 40% | naturalness.utmosv2Mos, naturalness.nisqaTtsNaturalnessMos, speechQuality.nisqaQualityMos, speechQuality.dnsmos |
| 11 | `gemini/gemini-3.1-flash-tts-preview` | cloud | 83.31 | 77.29 | 90.66 | Low | 30% / 40% | naturalness.utmosv2Mos, naturalness.nisqaTtsNaturalnessMos, speechQuality.nisqaQualityMos, speechQuality.dnsmos |
| 12 | `cartesia/sonic-3.5` | cloud | 82.68 | 74.99 | 92.07 | Low | 30% / 40% | naturalness.utmosv2Mos, naturalness.nisqaTtsNaturalnessMos, speechQuality.nisqaQualityMos, speechQuality.dnsmos |
| 13 | `cartesia/sonic-3` | cloud | 80.15 | 83.70 | 75.81 | Low | 30% / 40% | naturalness.utmosv2Mos, naturalness.nisqaTtsNaturalnessMos, speechQuality.nisqaQualityMos, speechQuality.dnsmos |
| 14 | `openai/gpt-4o-mini-tts` | cloud | 77.78 | 68.41 | 89.23 | Low | 30% / 40% | naturalness.utmosv2Mos, naturalness.nisqaTtsNaturalnessMos, speechQuality.nisqaQualityMos, speechQuality.dnsmos |
| 15 | `mistral/voxtral-mini-tts-2603` | cloud | 75.84 | 75.29 | 76.51 | Low | 30% / 40% | naturalness.utmosv2Mos, naturalness.nisqaTtsNaturalnessMos, speechQuality.nisqaQualityMos, speechQuality.dnsmos |

## Best By Group

- Best local model: n/a
- Best cloud service: `openai/tts-1-hd` (91.75/100)

## Recommendations

- **Best overall**: `openai/tts-1-hd` (91.75/100)
- **Best cloud**: `openai/tts-1-hd` (91.75/100)
- 16 provider(s) have low score coverage. Full mode already ran; remaining low coverage usually means external MOS/DNS metrics are missing (`utmosv2Mos`, `nisqaTtsNaturalnessMos`, `nisqaQualityMos`, `dnsmosMos`). Supply `--tts-metric-fixtures` from external scorers for higher confidence.

## Provider Details

### 1. `openai/tts-1-hd` (cloud)

| Metric | Score |
| --- | ---: |
| Human Speech | 91.75 |
| Naturalness | 85.00 |
| Speech Quality | 100.00 |
| Confidence | Low |

**Naturalness Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| utmosv2Mos | n/a | 45% | utmosv2 |
| nisqaTtsNaturalnessMos | n/a | 25% | nisqa-tts |
| paidAudioJudgeRubric | 85.00 | 20% | openai/gpt-audio |
| prosodyHeuristics | 85.00 | 10% | ffmpeg-pcm-heuristics |

**Speech Quality Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| nisqaQualityMos | n/a | 35% | nisqa |
| dnsmos | n/a | 25% | dnsmos |
| roundtripSttIntelligibility | 100.00 | 25% | median-roundtrip-wer |
| signalHygiene | 99.99 | 15% | ffmpeg-pcm-heuristics |

**Signal Metrics**

- Duration: 0.97s
- Peak: -4.3 dBFS, RMS: -20.1 dBFS
- Clipping: 0.000%, Silence: 28.0%
- Loudness range: 14.1 dB
- Pauses: 0

**Prosody Metrics**

- Speaking rate: 185 WPM
- Characters/sec: 16.4
- Detected pauses: 0 (expected ~1)

**Roundtrip STT**

| Engine | WER |
| --- | ---: |
| assemblyai/universal-3-pro | 0.00% |
| **Median** | **0.00%** |

---

### 2. `speechify/simba-english` (cloud)

| Metric | Score |
| --- | ---: |
| Human Speech | 91.72 |
| Naturalness | 84.94 |
| Speech Quality | 100.00 |
| Confidence | Low |

**Naturalness Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| utmosv2Mos | n/a | 45% | utmosv2 |
| nisqaTtsNaturalnessMos | n/a | 25% | nisqa-tts |
| paidAudioJudgeRubric | 85.00 | 20% | openai/gpt-audio |
| prosodyHeuristics | 84.83 | 10% | ffmpeg-pcm-heuristics |

**Speech Quality Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| nisqaQualityMos | n/a | 35% | nisqa |
| dnsmos | n/a | 25% | dnsmos |
| roundtripSttIntelligibility | 100.00 | 25% | median-roundtrip-wer |
| signalHygiene | 99.99 | 15% | ffmpeg-pcm-heuristics |

**Signal Metrics**

- Duration: 1.27s
- Peak: -4.3 dBFS, RMS: -20.3 dBFS
- Clipping: 0.000%, Silence: 28.2%
- Loudness range: 14.9 dB
- Pauses: 0

**Prosody Metrics**

- Speaking rate: 142 WPM
- Characters/sec: 12.6
- Detected pauses: 0 (expected ~1)

**Roundtrip STT**

| Engine | WER |
| --- | ---: |
| assemblyai/universal-3-pro | 0.00% |
| **Median** | **0.00%** |

---

### 3. `hume/octave-2` (cloud)

| Metric | Score |
| --- | ---: |
| Human Speech | 91.35 |
| Naturalness | 86.85 |
| Speech Quality | 96.86 |
| Confidence | Low |

**Naturalness Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| utmosv2Mos | n/a | 45% | utmosv2 |
| nisqaTtsNaturalnessMos | n/a | 25% | nisqa-tts |
| paidAudioJudgeRubric | 85.00 | 20% | openai/gpt-audio |
| prosodyHeuristics | 90.56 | 10% | ffmpeg-pcm-heuristics |

**Speech Quality Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| nisqaQualityMos | n/a | 35% | nisqa |
| dnsmos | n/a | 25% | dnsmos |
| roundtripSttIntelligibility | 100.00 | 25% | median-roundtrip-wer |
| signalHygiene | 91.62 | 15% | ffmpeg-pcm-heuristics |

**Signal Metrics**

- Duration: 1.44s
- Peak: -2.3 dBFS, RMS: -20.6 dBFS
- Clipping: 0.000%, Silence: 38.2%
- Loudness range: 9.9 dB
- Pauses: 1 (median 0.31s)

**Prosody Metrics**

- Speaking rate: 125 WPM
- Characters/sec: 11.1
- Detected pauses: 1 (expected ~1)

**Roundtrip STT**

| Engine | WER |
| --- | ---: |
| assemblyai/universal-3-pro | 0.00% |
| **Median** | **0.00%** |

**Warnings**

- Abrupt waveform discontinuities detected

---

### 4. `minimax/speech-2.8-turbo` (cloud)

| Metric | Score |
| --- | ---: |
| Human Speech | 90.71 |
| Naturalness | 83.44 |
| Speech Quality | 99.61 |
| Confidence | Low |

**Naturalness Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| utmosv2Mos | n/a | 45% | utmosv2 |
| nisqaTtsNaturalnessMos | n/a | 25% | nisqa-tts |
| paidAudioJudgeRubric | 85.00 | 20% | openai/gpt-audio |
| prosodyHeuristics | 80.31 | 10% | ffmpeg-pcm-heuristics |

**Speech Quality Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| nisqaQualityMos | n/a | 35% | nisqa |
| dnsmos | n/a | 25% | dnsmos |
| roundtripSttIntelligibility | 100.00 | 25% | median-roundtrip-wer |
| signalHygiene | 98.95 | 15% | ffmpeg-pcm-heuristics |

**Signal Metrics**

- Duration: 1.62s
- Peak: -2.6 dBFS, RMS: -18.2 dBFS
- Clipping: 0.000%, Silence: 36.6%
- Loudness range: 19.6 dB
- Pauses: 2 (median 0.19s)

**Prosody Metrics**

- Speaking rate: 111 WPM
- Characters/sec: 9.9
- Detected pauses: 2 (expected ~1)

**Roundtrip STT**

| Engine | WER |
| --- | ---: |
| assemblyai/universal-3-pro | 0.00% |
| **Median** | **0.00%** |

---

### 5. `deepgram/aura-2-thalia-en` (cloud)

| Metric | Score |
| --- | ---: |
| Human Speech | 89.08 |
| Naturalness | 80.94 |
| Speech Quality | 99.02 |
| Confidence | Low |

**Naturalness Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| utmosv2Mos | n/a | 45% | utmosv2 |
| nisqaTtsNaturalnessMos | n/a | 25% | nisqa-tts |
| paidAudioJudgeRubric | 85.00 | 20% | openai/gpt-audio |
| prosodyHeuristics | 72.83 | 10% | ffmpeg-pcm-heuristics |

**Speech Quality Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| nisqaQualityMos | n/a | 35% | nisqa |
| dnsmos | n/a | 25% | dnsmos |
| roundtripSttIntelligibility | 100.00 | 25% | median-roundtrip-wer |
| signalHygiene | 97.37 | 15% | ffmpeg-pcm-heuristics |

**Signal Metrics**

- Duration: 1.30s
- Peak: -6.7 dBFS, RMS: -25.3 dBFS
- Clipping: 0.000%, Silence: 35.9%
- Loudness range: 25.9 dB
- Pauses: 0

**Prosody Metrics**

- Speaking rate: 139 WPM
- Characters/sec: 12.3
- Detected pauses: 0 (expected ~1)

**Roundtrip STT**

| Engine | WER |
| --- | ---: |
| assemblyai/universal-3-pro | 0.00% |
| **Median** | **0.00%** |

---

### 6. `openai/tts-1` (cloud)

| Metric | Score |
| --- | ---: |
| Human Speech | 88.96 |
| Naturalness | 84.54 |
| Speech Quality | 94.37 |
| Confidence | Low |

**Naturalness Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| utmosv2Mos | n/a | 45% | utmosv2 |
| nisqaTtsNaturalnessMos | n/a | 25% | nisqa-tts |
| paidAudioJudgeRubric | 85.00 | 20% | openai/gpt-audio |
| prosodyHeuristics | 83.61 | 10% | ffmpeg-pcm-heuristics |

**Speech Quality Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| nisqaQualityMos | n/a | 35% | nisqa |
| dnsmos | n/a | 25% | dnsmos |
| roundtripSttIntelligibility | 100.00 | 25% | median-roundtrip-wer |
| signalHygiene | 84.99 | 15% | ffmpeg-pcm-heuristics |

**Signal Metrics**

- Duration: 0.96s
- Peak: -4.5 dBFS, RMS: -20.0 dBFS
- Clipping: 0.000%, Silence: 26.9%
- Loudness range: 12.3 dB
- Pauses: 0

**Prosody Metrics**

- Speaking rate: 187 WPM
- Characters/sec: 16.6
- Detected pauses: 0 (expected ~1)

**Roundtrip STT**

| Engine | WER |
| --- | ---: |
| assemblyai/universal-3-pro | 0.00% |
| **Median** | **0.00%** |

**Warnings**

- Abrupt waveform discontinuities detected

---

### 7. `minimax/speech-2.8-hd` (cloud)

| Metric | Score |
| --- | ---: |
| Human Speech | 87.64 |
| Naturalness | 78.54 |
| Speech Quality | 98.76 |
| Confidence | Low |

**Naturalness Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| utmosv2Mos | n/a | 45% | utmosv2 |
| nisqaTtsNaturalnessMos | n/a | 25% | nisqa-tts |
| paidAudioJudgeRubric | 85.00 | 20% | openai/gpt-audio |
| prosodyHeuristics | 65.62 | 10% | ffmpeg-pcm-heuristics |

**Speech Quality Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| nisqaQualityMos | n/a | 35% | nisqa |
| dnsmos | n/a | 25% | dnsmos |
| roundtripSttIntelligibility | 100.00 | 25% | median-roundtrip-wer |
| signalHygiene | 96.69 | 15% | ffmpeg-pcm-heuristics |

**Signal Metrics**

- Duration: 1.87s
- Peak: -0.6 dBFS, RMS: -16.8 dBFS
- Clipping: 0.000%, Silence: 39.9%
- Loudness range: 23.0 dB
- Pauses: 2 (median 0.20s)

**Prosody Metrics**

- Speaking rate: 96 WPM
- Characters/sec: 8.5
- Detected pauses: 2 (expected ~1)

**Roundtrip STT**

| Engine | WER |
| --- | ---: |
| assemblyai/universal-3-pro | 0.00% |
| **Median** | **0.00%** |

---

### 8. `grok/grok-tts` (cloud)

| Metric | Score |
| --- | ---: |
| Human Speech | 85.83 |
| Naturalness | 77.97 |
| Speech Quality | 95.43 |
| Confidence | Low |

**Naturalness Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| utmosv2Mos | n/a | 45% | utmosv2 |
| nisqaTtsNaturalnessMos | n/a | 25% | nisqa-tts |
| paidAudioJudgeRubric | 85.00 | 20% | openai/gpt-audio |
| prosodyHeuristics | 63.91 | 10% | ffmpeg-pcm-heuristics |

**Speech Quality Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| nisqaQualityMos | n/a | 35% | nisqa |
| dnsmos | n/a | 25% | dnsmos |
| roundtripSttIntelligibility | 100.00 | 25% | median-roundtrip-wer |
| signalHygiene | 87.81 | 15% | ffmpeg-pcm-heuristics |

**Signal Metrics**

- Duration: 1.07s
- Peak: -12.4 dBFS, RMS: -26.6 dBFS
- Clipping: 0.000%, Silence: 39.7%
- Loudness range: 1.6 dB
- Pauses: 0

**Prosody Metrics**

- Speaking rate: 168 WPM
- Characters/sec: 15.0
- Detected pauses: 0 (expected ~1)

**Roundtrip STT**

| Engine | WER |
| --- | ---: |
| assemblyai/universal-3-pro | 0.00% |
| **Median** | **0.00%** |

---

### 9. `groq/canopylabs/orpheus-v1-english` (cloud)

| Metric | Score |
| --- | ---: |
| Human Speech | 84.50 |
| Naturalness | 75.28 |
| Speech Quality | 95.78 |
| Confidence | Low |

**Naturalness Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| utmosv2Mos | n/a | 45% | utmosv2 |
| nisqaTtsNaturalnessMos | n/a | 25% | nisqa-tts |
| paidAudioJudgeRubric | 88.00 | 20% | openai/gpt-audio |
| prosodyHeuristics | 49.85 | 10% | ffmpeg-pcm-heuristics |

**Speech Quality Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| nisqaQualityMos | n/a | 35% | nisqa |
| dnsmos | n/a | 25% | dnsmos |
| roundtripSttIntelligibility | 100.00 | 25% | median-roundtrip-wer |
| signalHygiene | 88.74 | 15% | ffmpeg-pcm-heuristics |

**Signal Metrics**

- Duration: 2.00s
- Peak: -2.0 dBFS, RMS: -19.6 dBFS
- Clipping: 0.000%, Silence: 46.2%
- Loudness range: 27.5 dB
- Pauses: 2 (median 0.32s)

**Prosody Metrics**

- Speaking rate: 90 WPM
- Characters/sec: 8.0
- Detected pauses: 2 (expected ~1)

**Roundtrip STT**

| Engine | WER |
| --- | ---: |
| assemblyai/universal-3-pro | 0.00% |
| **Median** | **0.00%** |

---

### 10. `elevenlabs/eleven_v3` (cloud)

| Metric | Score |
| --- | ---: |
| Human Speech | 84.17 |
| Naturalness | 76.64 |
| Speech Quality | 93.37 |
| Confidence | Low |

**Naturalness Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| utmosv2Mos | n/a | 45% | utmosv2 |
| nisqaTtsNaturalnessMos | n/a | 25% | nisqa-tts |
| paidAudioJudgeRubric | 85.00 | 20% | openai/gpt-audio |
| prosodyHeuristics | 59.91 | 10% | ffmpeg-pcm-heuristics |

**Speech Quality Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| nisqaQualityMos | n/a | 35% | nisqa |
| dnsmos | n/a | 25% | dnsmos |
| roundtripSttIntelligibility | 100.00 | 25% | median-roundtrip-wer |
| signalHygiene | 82.33 | 15% | ffmpeg-pcm-heuristics |

**Signal Metrics**

- Duration: 1.04s
- Peak: -1.8 dBFS, RMS: -18.7 dBFS
- Clipping: 0.000%, Silence: 38.9%
- Loudness range: 41.7 dB
- Pauses: 0

**Prosody Metrics**

- Speaking rate: 173 WPM
- Characters/sec: 15.4
- Detected pauses: 0 (expected ~1)

**Roundtrip STT**

| Engine | WER |
| --- | ---: |
| assemblyai/universal-3-pro | 0.00% |
| **Median** | **0.00%** |

---

### 11. `gemini/gemini-3.1-flash-tts-preview` (cloud)

| Metric | Score |
| --- | ---: |
| Human Speech | 83.31 |
| Naturalness | 77.29 |
| Speech Quality | 90.66 |
| Confidence | Low |

**Naturalness Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| utmosv2Mos | n/a | 45% | utmosv2 |
| nisqaTtsNaturalnessMos | n/a | 25% | nisqa-tts |
| paidAudioJudgeRubric | 85.00 | 20% | openai/gpt-audio |
| prosodyHeuristics | 61.88 | 10% | ffmpeg-pcm-heuristics |

**Speech Quality Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| nisqaQualityMos | n/a | 35% | nisqa |
| dnsmos | n/a | 25% | dnsmos |
| roundtripSttIntelligibility | 100.00 | 25% | median-roundtrip-wer |
| signalHygiene | 75.09 | 15% | ffmpeg-pcm-heuristics |

**Signal Metrics**

- Duration: 1.76s
- Peak: -3.0 dBFS, RMS: -21.4 dBFS
- Clipping: 0.000%, Silence: 49.9%
- Loudness range: 10.2 dB
- Pauses: 2 (median 0.29s)

**Prosody Metrics**

- Speaking rate: 102 WPM
- Characters/sec: 9.1
- Detected pauses: 2 (expected ~1)

**Roundtrip STT**

| Engine | WER |
| --- | ---: |
| assemblyai/universal-3-pro | 0.00% |
| **Median** | **0.00%** |

**Warnings**

- Abrupt waveform discontinuities detected

---

### 12. `cartesia/sonic-3.5` (cloud)

| Metric | Score |
| --- | ---: |
| Human Speech | 82.68 |
| Naturalness | 74.99 |
| Speech Quality | 92.07 |
| Confidence | Low |

**Naturalness Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| utmosv2Mos | n/a | 45% | utmosv2 |
| nisqaTtsNaturalnessMos | n/a | 25% | nisqa-tts |
| paidAudioJudgeRubric | 85.00 | 20% | openai/gpt-audio |
| prosodyHeuristics | 54.98 | 10% | ffmpeg-pcm-heuristics |

**Speech Quality Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| nisqaQualityMos | n/a | 35% | nisqa |
| dnsmos | n/a | 25% | dnsmos |
| roundtripSttIntelligibility | 100.00 | 25% | median-roundtrip-wer |
| signalHygiene | 78.85 | 15% | ffmpeg-pcm-heuristics |

**Signal Metrics**

- Duration: 1.12s
- Peak: -6.0 dBFS, RMS: -24.0 dBFS
- Clipping: 0.000%, Silence: 44.2%
- Loudness range: 46.4 dB
- Pauses: 0

**Prosody Metrics**

- Speaking rate: 161 WPM
- Characters/sec: 14.3
- Detected pauses: 0 (expected ~1)

**Roundtrip STT**

| Engine | WER |
| --- | ---: |
| assemblyai/universal-3-pro | 0.00% |
| **Median** | **0.00%** |

---

### 13. `cartesia/sonic-3` (cloud)

| Metric | Score |
| --- | ---: |
| Human Speech | 80.15 |
| Naturalness | 83.70 |
| Speech Quality | 75.81 |
| Confidence | Low |

**Naturalness Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| utmosv2Mos | n/a | 45% | utmosv2 |
| nisqaTtsNaturalnessMos | n/a | 25% | nisqa-tts |
| paidAudioJudgeRubric | 85.00 | 20% | openai/gpt-audio |
| prosodyHeuristics | 81.10 | 10% | ffmpeg-pcm-heuristics |

**Speech Quality Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| nisqaQualityMos | n/a | 35% | nisqa |
| dnsmos | n/a | 25% | dnsmos |
| roundtripSttIntelligibility | 66.67 | 25% | median-roundtrip-wer |
| signalHygiene | 91.04 | 15% | ffmpeg-pcm-heuristics |

**Signal Metrics**

- Duration: 1.07s
- Peak: -7.9 dBFS, RMS: -27.1 dBFS
- Clipping: 0.000%, Silence: 48.4%
- Loudness range: 8.9 dB
- Pauses: 1 (median 0.31s)

**Prosody Metrics**

- Speaking rate: 169 WPM
- Characters/sec: 15.0
- Detected pauses: 1 (expected ~1)

**Roundtrip STT**

| Engine | WER |
| --- | ---: |
| assemblyai/universal-3-pro | 33.33% |
| **Median** | **33.33%** |

---

### 14. `openai/gpt-4o-mini-tts` (cloud)

| Metric | Score |
| --- | ---: |
| Human Speech | 77.78 |
| Naturalness | 68.41 |
| Speech Quality | 89.23 |
| Confidence | Low |

**Naturalness Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| utmosv2Mos | n/a | 45% | utmosv2 |
| nisqaTtsNaturalnessMos | n/a | 25% | nisqa-tts |
| paidAudioJudgeRubric | 85.00 | 20% | openai/gpt-audio |
| prosodyHeuristics | 35.22 | 10% | ffmpeg-pcm-heuristics |

**Speech Quality Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| nisqaQualityMos | n/a | 35% | nisqa |
| dnsmos | n/a | 25% | dnsmos |
| roundtripSttIntelligibility | 100.00 | 25% | median-roundtrip-wer |
| signalHygiene | 71.29 | 15% | ffmpeg-pcm-heuristics |

**Signal Metrics**

- Duration: 1.95s
- Peak: -5.4 dBFS, RMS: -22.5 dBFS
- Clipping: 0.000%, Silence: 55.5%
- Loudness range: 42.8 dB
- Pauses: 2 (median 0.39s)

**Prosody Metrics**

- Speaking rate: 92 WPM
- Characters/sec: 8.2
- Detected pauses: 2 (expected ~1)

**Roundtrip STT**

| Engine | WER |
| --- | ---: |
| assemblyai/universal-3-pro | 0.00% |
| **Median** | **0.00%** |

**Warnings**

- Silence ratio is high at 55.5%

---

### 15. `mistral/voxtral-mini-tts-2603` (cloud)

| Metric | Score |
| --- | ---: |
| Human Speech | 75.84 |
| Naturalness | 75.29 |
| Speech Quality | 76.51 |
| Confidence | Low |

**Naturalness Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| utmosv2Mos | n/a | 45% | utmosv2 |
| nisqaTtsNaturalnessMos | n/a | 25% | nisqa-tts |
| paidAudioJudgeRubric | 85.00 | 20% | openai/gpt-audio |
| prosodyHeuristics | 55.88 | 10% | ffmpeg-pcm-heuristics |

**Speech Quality Components**

| Component | Score | Weight | Source |
| --- | ---: | ---: | --- |
| nisqaQualityMos | n/a | 35% | nisqa |
| dnsmos | n/a | 25% | dnsmos |
| roundtripSttIntelligibility | 66.67 | 25% | median-roundtrip-wer |
| signalHygiene | 92.91 | 15% | ffmpeg-pcm-heuristics |

**Signal Metrics**

- Duration: 2.16s
- Peak: -11.9 dBFS, RMS: -32.3 dBFS
- Clipping: 0.000%, Silence: 14.7%
- Loudness range: 22.2 dB
- Pauses: 0

**Prosody Metrics**

- Speaking rate: 83 WPM
- Characters/sec: 7.4
- Detected pauses: 0 (expected ~1)

**Roundtrip STT**

| Engine | WER |
| --- | ---: |
| assemblyai/universal-3-pro | 33.33% |
| **Median** | **33.33%** |


## Warnings

- openai/gpt-4o-mini-tts: Silence ratio is high at 55.5%
- openai/tts-1: Abrupt waveform discontinuities detected
- gemini/gemini-3.1-flash-tts-preview: Abrupt waveform discontinuities detected
- hume/octave-2: Abrupt waveform discontinuities detected
