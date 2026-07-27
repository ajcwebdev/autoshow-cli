import type { AudioProperties, TtsMetadataBase } from '~/types'

export type VoiceQualityReportMode = "local" | "full";

export type ContentType = "narration" | "news" | "conversational" | "technical" | "default";

export interface VoiceQualityReportOptions {
  runDir: string;
  inputTextPath?: string;
  inputText?: string;
  inputTextLabel?: string;
  mode: VoiceQualityReportMode;
  allowPaid: boolean;
  metricFixturesPath: string | null;
  roundtripDir: string | null;
  markdownOut: string | null;
  jsonOut: string | null;
  keepTemp: boolean;
  audioJudgeModel: string;
  contentType?: ContentType;
}

export interface ComponentScore {
  score: number | null;
  weight: number;
  status: "scored" | "missing" | "warning";
  source: string;
  note: string;
  mos?: number;
  details?: Record<string, unknown>;
}

export interface ScoreCoverage {
  availableWeight: number;
  totalWeight: number;
}

interface SignalMetrics {
  durationSeconds: number;
  peakDbfs: number;
  rmsDbfs: number;
  clippingRatio: number;
  silenceRatio: number;
  loudnessRangeDb: number;
  abruptDiscontinuitiesPerSecond: number;
  dcOffset: number;
  initialSilenceSeconds: number;
  finalSilenceSeconds: number;
  pauseCount: number;
  medianPauseSeconds: number | null;
  maxPauseSeconds: number | null;
}

export interface HeuristicResult {
  prosodyHeuristicScore: number;
  signalHygieneScore: number;
  signalMetrics: SignalMetrics;
  prosodyMetrics: Record<string, number | null>;
  warnings: string[];
}

export interface MetricFixtureProvider {
  utmosv2Mos?: number;
  nisqaNaturalnessMos?: number;
  nisqaTtsNaturalnessMos?: number;
  nisqaQualityMos?: number;
  dnsmosMos?: number;
  dnsmosOverallMos?: number;
  paidAudioJudgeScore?: number;
  paidAudioJudge?: {
    score?: number;
    naturalnessScore?: number;
    speechQualityScore?: number;
    confidence?: number;
    notes?: string;
  };
  nisqa?: {
    naturalnessMos?: number;
    qualityMos?: number;
    noisinessMos?: number;
    colorationMos?: number;
    discontinuityMos?: number;
    loudnessMos?: number;
  };
  dnsmos?: {
    overallMos?: number;
    signalMos?: number;
    backgroundMos?: number;
    p808Mos?: number;
  };
  stt?: Record<string, string | { text?: string; transcript?: string }>;
  roundtripTranscripts?: Record<string, string | { text?: string; transcript?: string }>;
}

export interface MetricFixtures {
  providers?: Record<string, MetricFixtureProvider>;
}

export interface RoundtripEngineResult {
  engine: string;
  transcript: string;
  wer: number;
}

export interface PaidFailurePolicy {
  strict: boolean;
  providerKey: string;
  warnings: string[];
}

export interface ProviderVoiceQualityEntry extends Pick<TtsMetadataBase, 'ttsService' | 'ttsModel' | 'audioFileName' | 'audioFileSize'> {
  rank: number;
  providerKey: string;
  group: "local" | "cloud";
  speaker: string | null;
  audioExists: boolean;
  originalAudioProperties: AudioProperties | null;
  naturalnessScore: number | null;
  speechQualityScore: number | null;
  humanSpeechScore: number | null;
  scoreCoverage: {
    naturalness: ScoreCoverage;
    speechQuality: ScoreCoverage;
    humanSpeech: ScoreCoverage;
  };
  componentScores: {
    naturalness: Record<string, ComponentScore>;
    speechQuality: Record<string, ComponentScore>;
  };
  metricDetails: {
    signalMetrics: SignalMetrics | null;
    prosodyMetrics: Record<string, number | null> | null;
    roundtripStt: {
      medianWer: number | null;
      engines: RoundtripEngineResult[];
    };
  };
  missingMetrics: string[];
  warnings: string[];
}

export interface Pcm16Wav {
  sampleRate: number;
  samples: Float64Array;
}
