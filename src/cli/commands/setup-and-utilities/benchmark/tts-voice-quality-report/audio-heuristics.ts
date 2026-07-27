import { readFileSync } from "node:fs"
import type { ContentType, HeuristicResult, Pcm16Wav, SpeakingRateParams } from '~/types'
import { clampPercentScore } from '~/utils/voice-quality-scoring'
import { computeSpeakingRate } from '../tts-eval-lib'
import { amplitudeToDbfs, median, percentile, runProcess } from './shared'
import { InfraError, ValidationError } from '~/utils/error-handler'

export async function normalizeAudio(inputPath: string, outputPath: string): Promise<void> {
  const result = await runProcess([
    "ffmpeg",
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    inputPath,
    "-ac",
    "1",
    "-ar",
    "16000",
    "-c:a",
    "pcm_s16le",
    outputPath,
  ]);
  if (result.exitCode !== 0) {
    throw InfraError(`ffmpeg normalization failed: ${result.stderr.trim() || result.stdout.trim()}`, { stage: 'tts:voice-quality' });
  }
}

function readChunkId(buffer: Buffer, offset: number): string {
  return buffer.toString("ascii", offset, offset + 4);
}

export function readPcm16MonoWav(path: string): Pcm16Wav {
  const buffer = readFileSync(path);
  if (readChunkId(buffer, 0) !== "RIFF" || readChunkId(buffer, 8) !== "WAVE") {
    throw ValidationError(`Unsupported WAV container for ${path}`, { stage: 'tts:voice-quality' });
  }

  let offset = 12;
  let audioFormat: number | null = null;
  let channels: number | null = null;
  let sampleRate: number | null = null;
  let bitsPerSample: number | null = null;
  let dataOffset: number | null = null;
  let dataSize: number | null = null;

  while (offset + 8 <= buffer.length) {
    const chunkId = readChunkId(buffer, offset);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkDataOffset = offset + 8;
    if (chunkId === "fmt ") {
      audioFormat = buffer.readUInt16LE(chunkDataOffset);
      channels = buffer.readUInt16LE(chunkDataOffset + 2);
      sampleRate = buffer.readUInt32LE(chunkDataOffset + 4);
      bitsPerSample = buffer.readUInt16LE(chunkDataOffset + 14);
    } else if (chunkId === "data") {
      dataOffset = chunkDataOffset;
      dataSize = chunkSize;
      break;
    }
    offset = chunkDataOffset + chunkSize + (chunkSize % 2);
  }

  if (audioFormat !== 1 || channels !== 1 || bitsPerSample !== 16 || sampleRate === null || dataOffset === null || dataSize === null) {
    throw ValidationError(`Expected normalized 16-bit PCM mono WAV for ${path}`, { stage: 'tts:voice-quality' });
  }

  const sampleCount = Math.floor(dataSize / 2);
  const samples = new Float64Array(sampleCount);
  for (let index = 0; index < sampleCount; index += 1) {
    samples[index] = buffer.readInt16LE(dataOffset + index * 2) / 32768;
  }

  return { sampleRate, samples };
}

function scoreNearRange(value: number, idealMin: number, idealMax: number, hardMin: number, hardMax: number): number {
  if (value >= idealMin && value <= idealMax) return 100;
  if (value < hardMin || value > hardMax) return 0;
  if (value < idealMin) {
    return clampPercentScore(((value - hardMin) / (idealMin - hardMin)) * 100);
  }
  return clampPercentScore(((hardMax - value) / (hardMax - idealMax)) * 100);
}

function scoreCentered(value: number, ideal: number, goodDeviation: number, hardDeviation: number): number {
  const deviation = Math.abs(value - ideal);
  if (deviation <= goodDeviation) return 100;
  if (deviation >= hardDeviation) return 0;
  return clampPercentScore(100 * (1 - (deviation - goodDeviation) / (hardDeviation - goodDeviation)));
}

function computePauseRuns(samples: Float64Array, sampleRate: number, threshold: number): number[] {
  const pauses: number[] = [];
  let run = 0;
  const minPauseSamples = Math.floor(sampleRate * 0.15);
  for (const sample of samples) {
    if (Math.abs(sample) <= threshold) {
      run += 1;
    } else {
      if (run >= minPauseSamples) pauses.push(run / sampleRate);
      run = 0;
    }
  }
  if (run >= minPauseSamples) pauses.push(run / sampleRate);
  return pauses;
}

function edgeSilenceSeconds(samples: Float64Array, sampleRate: number, threshold: number, fromEnd: boolean): number {
  let count = 0;
  if (fromEnd) {
    for (let index = samples.length - 1; index >= 0; index -= 1) {
      if (Math.abs(samples[index] ?? 0) > threshold) break;
      count += 1;
    }
  } else {
    for (const sample of samples) {
      if (Math.abs(sample) > threshold) break;
      count += 1;
    }
  }
  return count / sampleRate;
}

const SPEAKING_RATE_BY_CONTENT_TYPE: Record<ContentType, SpeakingRateParams> = {
  narration: { ideal: 150, goodDeviation: 20, hardDeviation: 70 },
  news: { ideal: 162, goodDeviation: 25, hardDeviation: 75 },
  conversational: { ideal: 150, goodDeviation: 40, hardDeviation: 100 },
  technical: { ideal: 140, goodDeviation: 20, hardDeviation: 65 },
  default: { ideal: 155, goodDeviation: 30, hardDeviation: 95 },
};

function computeAdaptiveSilenceThreshold(samples: Float64Array): number {
  const absoluteValues = new Float64Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    absoluteValues[i] = Math.abs(samples[i] ?? 0);
  }
  absoluteValues.sort();
  const p5Index = Math.floor(samples.length * 0.05);
  const noiseFloor = absoluteValues[p5Index] ?? 0;
  const computed = noiseFloor * 3;
  const minThreshold = 10 ** (-60 / 20);
  const maxThreshold = 10 ** (-25 / 20);
  if (computed < minThreshold || computed > maxThreshold) {
    return 10 ** (-45 / 20);
  }
  return computed;
}

export function computeHeuristics(
  wav: Pcm16Wav,
  inputText: string,
  inputWordCount: number,
  inputCharCount: number,
  contentType: ContentType = "default",
): HeuristicResult {
  const { samples, sampleRate } = wav;
  const warnings: string[] = [];
  const durationSeconds = samples.length / sampleRate;
  if (durationSeconds <= 0) {
    throw ValidationError("Normalized audio has zero duration", { stage: 'tts:voice-quality' });
  }

  let peak = 0;
  let sumSquares = 0;
  let sum = 0;
  let clipping = 0;
  let silenceSamples = 0;
  let abruptDiscontinuities = 0;
  const silenceThreshold = computeAdaptiveSilenceThreshold(samples);
  let previous = samples[0] ?? 0;

  for (const sample of samples) {
    const abs = Math.abs(sample);
    peak = Math.max(peak, abs);
    sumSquares += sample * sample;
    sum += sample;
    if (abs >= 0.999) clipping += 1;
    if (abs <= silenceThreshold) silenceSamples += 1;
    if (Math.abs(sample - previous) > 0.65) abruptDiscontinuities += 1;
    previous = sample;
  }

  const rms = Math.sqrt(sumSquares / samples.length);
  const dcOffset = sum / samples.length;
  const windowSize = Math.max(1, Math.floor(sampleRate * 0.25));
  const windowDbValues: number[] = [];
  for (let start = 0; start < samples.length; start += windowSize) {
    let windowSumSquares = 0;
    let count = 0;
    const end = Math.min(samples.length, start + windowSize);
    for (let index = start; index < end; index += 1) {
      const sample = samples[index] ?? 0;
      windowSumSquares += sample * sample;
      count += 1;
    }
    const windowRms = Math.sqrt(windowSumSquares / Math.max(1, count));
    const db = amplitudeToDbfs(windowRms);
    if (db > -70) windowDbValues.push(db);
  }

  const p95 = percentile(windowDbValues, 95);
  const p10 = percentile(windowDbValues, 10);
  const loudnessRangeDb = p95 !== null && p10 !== null ? Math.max(0, p95 - p10) : 0;
  const pauses = computePauseRuns(samples, sampleRate, silenceThreshold);
  const speechWpm = inputWordCount > 0 ? (inputWordCount / durationSeconds) * 60 : 0;
  const charsPerSecond = computeSpeakingRate(inputCharCount, durationSeconds) ?? 0;
  const punctuationBreaks = Math.max(1, (inputText.match(/[.,;:!?]/g) ?? []).length);
  const expectedPauseCount = Math.max(1, Math.min(punctuationBreaks, Math.round(inputWordCount / 12)));
  const pauseCountRatio = pauses.length / expectedPauseCount;

  const clippingRatio = clipping / samples.length;
  const silenceRatio = silenceSamples / samples.length;
  const abruptDiscontinuitiesPerSecond = abruptDiscontinuities / durationSeconds;
  const peakDbfs = amplitudeToDbfs(peak);
  const rmsDbfs = amplitudeToDbfs(rms);
  const initialSilenceSeconds = edgeSilenceSeconds(samples, sampleRate, silenceThreshold, false);
  const finalSilenceSeconds = edgeSilenceSeconds(samples, sampleRate, silenceThreshold, true);
  const medianPauseSeconds = median(pauses);
  const maxPauseSeconds = pauses.length > 0 ? Math.max(...pauses) : null;

  if (clippingRatio > 0.001) warnings.push(`Clipping ratio is ${(clippingRatio * 100).toFixed(2)}%`);
  if (rmsDbfs < -34) warnings.push(`RMS loudness is very low at ${rmsDbfs.toFixed(1)} dBFS`);
  if (rmsDbfs > -10) warnings.push(`RMS loudness is very high at ${rmsDbfs.toFixed(1)} dBFS`);
  if (silenceRatio > 0.55) warnings.push(`Silence ratio is high at ${(silenceRatio * 100).toFixed(1)}%`);
  if (abruptDiscontinuitiesPerSecond > 0.5) warnings.push("Abrupt waveform discontinuities detected");

  const clippingScore = clampPercentScore(100 - clippingRatio * 20000 - (peakDbfs > -0.1 ? 10 : 0));
  const rmsScore = scoreNearRange(rmsDbfs, -28, -14, -42, -6);
  const silenceScore = scoreNearRange(silenceRatio, 0.04, 0.35, 0, 0.65);
  const loudnessRangeScore = scoreNearRange(loudnessRangeDb, 4, 24, 0, 38);
  const discontinuityScore = clampPercentScore(100 - abruptDiscontinuitiesPerSecond * 60);
  const dcScore = clampPercentScore(100 - Math.abs(dcOffset) * 2000);

  const signalHygieneScore =
    clippingScore * 0.22 +
    rmsScore * 0.23 +
    silenceScore * 0.20 +
    loudnessRangeScore * 0.15 +
    discontinuityScore * 0.15 +
    dcScore * 0.05;

  const rateParams = SPEAKING_RATE_BY_CONTENT_TYPE[contentType];
  const rateScore = scoreCentered(speechWpm, rateParams.ideal, rateParams.goodDeviation, rateParams.hardDeviation);
  const pauseRatioScore = scoreNearRange(silenceRatio, 0.06, 0.28, 0, 0.55);
  const pauseCountScore = scoreNearRange(pauseCountRatio, 0.5, 1.8, 0, 3.2);
  const prosodyRangeScore = scoreNearRange(loudnessRangeDb, 5, 22, 0, 34);

  const prosodyHeuristicScore =
    rateScore * 0.45 +
    pauseRatioScore * 0.25 +
    pauseCountScore * 0.15 +
    prosodyRangeScore * 0.15;

  return {
    prosodyHeuristicScore: clampPercentScore(prosodyHeuristicScore),
    signalHygieneScore: clampPercentScore(signalHygieneScore),
    signalMetrics: {
      durationSeconds,
      peakDbfs,
      rmsDbfs,
      clippingRatio,
      silenceRatio,
      loudnessRangeDb,
      abruptDiscontinuitiesPerSecond,
      dcOffset,
      initialSilenceSeconds,
      finalSilenceSeconds,
      pauseCount: pauses.length,
      medianPauseSeconds,
      maxPauseSeconds,
    },
    prosodyMetrics: {
      speechWordsPerMinute: speechWpm,
      speakingRateCharsPerSecond: charsPerSecond,
      expectedPauseCount,
      detectedPauseCount: pauses.length,
      pauseCountRatio,
      rateScore,
      pauseRatioScore,
      pauseCountScore,
      loudnessRangeScore: prosodyRangeScore,
    },
    warnings,
  };
}
