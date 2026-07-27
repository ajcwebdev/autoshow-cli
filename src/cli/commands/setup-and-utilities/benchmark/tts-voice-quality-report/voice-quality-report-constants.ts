export const NATURALNESS_WEIGHTS = {
  utmosv2Mos: 0.45,
  nisqaTtsNaturalnessMos: 0.25,
  paidAudioJudgeRubric: 0.20,
  prosodyHeuristics: 0.10,
} as const;

export const SPEECH_QUALITY_WEIGHTS = {
  nisqaQualityMos: 0.35,
  dnsmos: 0.25,
  roundtripSttIntelligibility: 0.25,
  signalHygiene: 0.15,
} as const;

export const HUMAN_SPEECH_WEIGHTS = {
  naturalness: 0.55,
  speechQuality: 0.45,
} as const;

export const PAID_STT_ENGINES = [
  { key: "assemblyai/universal-3-pro", service: "assemblyai", model: "universal-3-pro" },
] as const;
