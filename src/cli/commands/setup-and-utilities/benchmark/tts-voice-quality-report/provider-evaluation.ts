import { join } from "node:path"
import { isLocalService, makeProviderKey, makeTtsBenchmarkKey, probeAudio } from '../tts-eval-lib'
import type { loadTtsManifestMetadata } from '../tts-eval-lib'
import type { AudioProperties, ComponentScore, ContentType, HeuristicResult, MetricFixtures, PaidFailurePolicy, ProviderVoiceQualityEntry, VoiceQualityReportMode } from '~/types'
import { readEnv } from '~/utils/validate/env-utils'
import { computeHeuristics, normalizeAudio, readPcm16MonoWav } from './audio-heuristics'
import { HUMAN_SPEECH_WEIGHTS, NATURALNESS_WEIGHTS, SPEECH_QUALITY_WEIGHTS } from './voice-quality-report-constants'
import { aggregateComponents, componentFromMos, missingComponent, nisqaQualityMos, paidJudgeScoreFromFixture, roundtripComponent, scoredComponent } from './score-components'
import { roundtripFromFixture, readRoundtripDir, runPaidStt } from './roundtrip-stt'
import { runPaidAudioJudge } from './openai-audio-judge'
import { aggregateWeightedScore } from '~/utils/voice-quality-scoring'
import { finiteNumber, fixtureForProvider, median, recordPaidFailure, strictPaidFailures } from './shared'

export async function evaluateProvider(options: {
  runDir: string;
  inputText: string;
  inputCharCount: number;
  inputWordCount: number;
  entry: Awaited<ReturnType<typeof loadTtsManifestMetadata>>["tts"][number];
  audioPath: string | undefined;
  fixtures: MetricFixtures | null;
  roundtripDir: string | null;
  mode: VoiceQualityReportMode;
  allowPaid: boolean;
  audioJudgeModel: string;
  tempDir: string;
  contentType?: ContentType;
}): Promise<Omit<ProviderVoiceQualityEntry, "rank">> {
  const providerKey = makeTtsBenchmarkKey(options.entry);
  const legacyProviderKey = makeProviderKey(options.entry.ttsService, options.entry.ttsModel);
  const warnings: string[] = [];
  const paidFailurePolicy: PaidFailurePolicy = {
    strict: strictPaidFailures(options.mode, options.allowPaid),
    providerKey,
    warnings,
  };
  const fixture = fixtureForProvider(options.fixtures, providerKey, options.entry.audioFileName, legacyProviderKey);
  let originalAudioProperties: AudioProperties | null = null;
  let heuristics: HeuristicResult | null = null;
  let normalizedAudioPath: string | null = null;

  if (options.audioPath) {
    try {
      originalAudioProperties = await probeAudio(options.audioPath);
    } catch (error) {
      warnings.push(`ffprobe failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      normalizedAudioPath = join(options.tempDir, `${options.entry.audioFileName.replace(/[^a-zA-Z0-9._-]/g, "_")}.16k-mono.wav`);
      await normalizeAudio(options.audioPath, normalizedAudioPath);
      const wav = readPcm16MonoWav(normalizedAudioPath);
      heuristics = computeHeuristics(wav, options.inputText, options.inputWordCount, options.inputCharCount, options.contentType);
      warnings.push(...heuristics.warnings);
    } catch (error) {
      warnings.push(`audio heuristics failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    warnings.push("Audio file is missing");
  }

  const utmosMos = finiteNumber(fixture?.utmosv2Mos);
  const nisqaNaturalnessMos = finiteNumber(fixture?.nisqaTtsNaturalnessMos) ??
    finiteNumber(fixture?.nisqaNaturalnessMos) ??
    finiteNumber(fixture?.nisqa?.naturalnessMos);
  const qualityMos = nisqaQualityMos(fixture);
  const dnsmosMos = finiteNumber(fixture?.dnsmosOverallMos) ??
    finiteNumber(fixture?.dnsmosMos) ??
    finiteNumber(fixture?.dnsmos?.overallMos) ??
    finiteNumber(fixture?.dnsmos?.p808Mos);

  let paidJudgeComponent = paidJudgeScoreFromFixture(fixture);
  if (!paidJudgeComponent && options.mode === "full" && options.allowPaid && normalizedAudioPath && readEnv("OPENAI_API_KEY")) {
    try {
      paidJudgeComponent = await runPaidAudioJudge(normalizedAudioPath, options.inputText, options.audioJudgeModel);
    } catch (error) {
      recordPaidFailure(paidFailurePolicy, "OpenAI audio judge", error);
    }
  }

  const roundtripResults = [
    ...roundtripFromFixture(fixture, options.inputText),
    ...readRoundtripDir(options.roundtripDir, options.entry.audioFileName, options.inputText),
  ];
  if (roundtripResults.length === 0 && options.mode === "full" && options.allowPaid && normalizedAudioPath) {
    const paidStt = await runPaidStt(
      normalizedAudioPath,
      options.entry.audioFileName,
      options.runDir,
      options.inputText,
      paidFailurePolicy,
    );
    roundtripResults.push(...paidStt.results);
    warnings.push(...paidStt.warnings);
  }

  const naturalnessComponents: Record<string, ComponentScore> = {
    utmosv2Mos: componentFromMos(
      utmosMos,
      NATURALNESS_WEIGHTS.utmosv2Mos,
      fixture ? "metric-fixtures" : "utmosv2",
      "UTMOSv2 MOS was not available. Provide --metric-fixtures with utmosv2Mos or run a UTMOSv2 scorer externally.",
    ),
    nisqaTtsNaturalnessMos: componentFromMos(
      nisqaNaturalnessMos,
      NATURALNESS_WEIGHTS.nisqaTtsNaturalnessMos,
      fixture ? "metric-fixtures" : "nisqa-tts",
      "NISQA-TTS naturalness MOS was not available. Provide --metric-fixtures with nisqaTtsNaturalnessMos.",
    ),
    paidAudioJudgeRubric: paidJudgeComponent ?? missingComponent(
      NATURALNESS_WEIGHTS.paidAudioJudgeRubric,
      options.mode === "local" ? "paid-audio-judge-omitted" : "paid-audio-judge",
      options.mode === "local"
        ? "Local mode does not call paid audio judging."
        : "Paid audio judge score was not available.",
    ),
    prosodyHeuristics: heuristics
      ? scoredComponent(
        heuristics.prosodyHeuristicScore,
        NATURALNESS_WEIGHTS.prosodyHeuristics,
        "ffmpeg-pcm-heuristics",
        "Prosody heuristic score from speaking rate, pause ratio, pause distribution, and loudness motion.",
        heuristics.prosodyMetrics,
      )
      : missingComponent(
        NATURALNESS_WEIGHTS.prosodyHeuristics,
        "ffmpeg-pcm-heuristics",
        "Prosody heuristics could not be computed.",
      ),
  };

  const speechQualityComponents: Record<string, ComponentScore> = {
    nisqaQualityMos: componentFromMos(
      qualityMos,
      SPEECH_QUALITY_WEIGHTS.nisqaQualityMos,
      fixture ? "metric-fixtures" : "nisqa",
      "NISQA quality MOS was not available. Provide --metric-fixtures with nisqaQualityMos or NISQA dimensions.",
    ),
    dnsmos: componentFromMos(
      dnsmosMos,
      SPEECH_QUALITY_WEIGHTS.dnsmos,
      fixture ? "metric-fixtures" : "dnsmos",
      "DNSMOS was not available. Provide --metric-fixtures with dnsmosMos or dnsmos.overallMos.",
    ),
    roundtripSttIntelligibility: roundtripComponent(roundtripResults),
    signalHygiene: heuristics
      ? scoredComponent(
        heuristics.signalHygieneScore,
        SPEECH_QUALITY_WEIGHTS.signalHygiene,
        "ffmpeg-pcm-heuristics",
        "Signal hygiene score from clipping, loudness, silence ratio, loudness range, discontinuities, and DC offset.",
        heuristics.signalMetrics as unknown as Record<string, unknown>,
      )
      : missingComponent(
        SPEECH_QUALITY_WEIGHTS.signalHygiene,
        "ffmpeg-pcm-heuristics",
        "Signal hygiene could not be computed.",
      ),
  };

  const naturalness = aggregateComponents(naturalnessComponents);
  const speechQuality = aggregateComponents(speechQualityComponents);
  const humanSpeechAggregate = aggregateWeightedScore([
    { key: "naturalness", score: naturalness.score, weight: HUMAN_SPEECH_WEIGHTS.naturalness },
    { key: "speechQuality", score: speechQuality.score, weight: HUMAN_SPEECH_WEIGHTS.speechQuality },
  ]);
  const missingMetrics = [
    ...naturalness.missing.map((metric) => `naturalness.${metric}`),
    ...speechQuality.missing.map((metric) => `speechQuality.${metric}`),
  ];

  return {
    providerKey,
    targetKey: options.entry.targetKey ?? null,
    renderIdentity: options.entry.renderIdentity ?? null,
    registrationId: options.entry.registrationId ?? null,
    snapshotEntryId: options.entry.snapshotEntryId ?? null,
    characterIdentity: options.entry.characterIdentity ?? null,
    ttsService: options.entry.ttsService,
    ttsModel: options.entry.ttsModel,
    speaker: options.entry.speaker ?? null,
    group: isLocalService(options.entry.ttsService) ? "local" : "cloud",
    audioFileName: options.entry.audioFileName,
    audioFileSize: options.entry.audioFileSize,
    audioExists: options.audioPath !== undefined,
    originalAudioProperties,
    naturalnessScore: naturalness.score,
    speechQualityScore: speechQuality.score,
    humanSpeechScore: humanSpeechAggregate.score,
    scoreCoverage: {
      naturalness: naturalness.coverage,
      speechQuality: speechQuality.coverage,
      humanSpeech: {
        availableWeight: humanSpeechAggregate.availableWeight,
        totalWeight: humanSpeechAggregate.totalWeight,
      },
    },
    componentScores: {
      naturalness: naturalnessComponents,
      speechQuality: speechQualityComponents,
    },
    metricDetails: {
      signalMetrics: heuristics?.signalMetrics ?? null,
      prosodyMetrics: heuristics?.prosodyMetrics ?? null,
      roundtripStt: {
        medianWer: median(roundtripResults.map((result) => result.wer)),
        engines: roundtripResults,
      },
    },
    missingMetrics,
    warnings,
  };
}
