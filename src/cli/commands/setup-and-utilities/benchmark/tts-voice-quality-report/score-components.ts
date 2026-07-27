import { aggregateWeightedScore, clampPercentScore, mosToPercentScore } from '~/utils/voice-quality-scoring'
import type { ComponentScore, MetricFixtureProvider, RoundtripEngineResult, ScoreCoverage, VoiceQualityScoreInput } from '~/types'
import { NATURALNESS_WEIGHTS, SPEECH_QUALITY_WEIGHTS } from './voice-quality-report-constants'
import { finiteNumber, median } from './shared'

export function componentFromMos(
  mos: number | null,
  weight: number,
  source: string,
  missingNote: string,
): ComponentScore {
  const mosValue = typeof mos === "number" && Number.isFinite(mos) ? mos : null;
  const score = mosToPercentScore(mosValue);
  if (score === null || mosValue === null) {
    return {
      score: null,
      weight,
      status: "missing",
      source,
      note: missingNote,
    };
  }
  return {
    score,
    weight,
    status: "scored",
    source,
    note: `MOS ${mosValue.toFixed(3)} converted with (mos - 1) / 4 * 100.`,
    mos: mosValue,
  };
}

export function scoredComponent(score: number, weight: number, source: string, note: string, details?: Record<string, unknown>): ComponentScore {
  return {
    score: clampPercentScore(score),
    weight,
    status: "scored",
    source,
    note,
    ...(details ? { details } : {}),
  };
}

export function missingComponent(weight: number, source: string, note: string): ComponentScore {
  return {
    score: null,
    weight,
    status: "missing",
    source,
    note,
  };
}

export function nisqaQualityMos(fixture: MetricFixtureProvider | null): number | null {
  const direct = finiteNumber(fixture?.nisqaQualityMos) ?? finiteNumber(fixture?.nisqa?.qualityMos);
  if (direct !== null) return direct;
  const dimensions = [
    finiteNumber(fixture?.nisqa?.noisinessMos),
    finiteNumber(fixture?.nisqa?.colorationMos),
    finiteNumber(fixture?.nisqa?.discontinuityMos),
    finiteNumber(fixture?.nisqa?.loudnessMos),
  ].filter((value): value is number => value !== null);
  if (dimensions.length === 0) return null;
  return dimensions.reduce((sum, value) => sum + value, 0) / dimensions.length;
}

export function paidJudgeScoreFromFixture(fixture: MetricFixtureProvider | null): ComponentScore | null {
  const score = finiteNumber(fixture?.paidAudioJudgeScore) ??
    finiteNumber(fixture?.paidAudioJudge?.naturalnessScore) ??
    finiteNumber(fixture?.paidAudioJudge?.score);
  if (score === null) return null;
  return scoredComponent(
    score,
    NATURALNESS_WEIGHTS.paidAudioJudgeRubric,
    "metric-fixtures",
    "Paid audio-judge rubric score supplied by fixture.",
    {
      confidence: finiteNumber(fixture?.paidAudioJudge?.confidence),
      notes: fixture?.paidAudioJudge?.notes ?? null,
    },
  );
}

export function roundtripComponent(results: RoundtripEngineResult[]): ComponentScore {
  const medianWer = median(results.map((result) => result.wer));
  if (medianWer === null) {
    return missingComponent(
      SPEECH_QUALITY_WEIGHTS.roundtripSttIntelligibility,
      "roundtrip-stt",
      "No roundtrip STT transcripts were available.",
    );
  }
  return scoredComponent(
    Math.max(0, 100 * (1 - medianWer)),
    SPEECH_QUALITY_WEIGHTS.roundtripSttIntelligibility,
    "median-roundtrip-wer",
    "Intelligibility score from median WER across available STT engines.",
    {
      medianWer,
      engines: results.map((result) => ({ engine: result.engine, wer: result.wer })),
    },
  );
}

export function aggregateComponents(components: Record<string, ComponentScore>): {
  score: number | null;
  coverage: ScoreCoverage;
  missing: string[];
} {
  const inputs: VoiceQualityScoreInput[] = Object.entries(components).map(([key, component]) => ({
    key,
    score: component.score,
    weight: component.weight,
  }));
  const aggregate = aggregateWeightedScore(inputs);
  return {
    score: aggregate.score,
    coverage: {
      availableWeight: aggregate.availableWeight,
      totalWeight: aggregate.totalWeight,
    },
    missing: aggregate.missingKeys,
  };
}
