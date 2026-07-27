import type { TtsMetadataBase } from '~/types'

export interface AudioProperties {
  durationSeconds: number;
  sampleRate: number | null;
  channels: number | null;
  bitrate: number | null;
  codec: string | null;
}

export interface TtsEntryMetadata extends TtsMetadataBase {}

interface RunStepCostEntry {
  step?: string;
  provider?: string;
  model?: string;
  cost?: number;
  inputMetric?: string;
  inputValue?: number;
}

interface RunStepTimingEntry {
  step?: string;
  provider?: string;
  model?: string;
  processingTimeMs?: number;
  inputMetric?: string;
  inputValue?: number;
}

export interface TtsRunJson {
  schemaVersion?: number;
  kind: string;
  metadata: {
    tts: TtsEntryMetadata[];
    input?: string;
    cost?: {
      estimated?: { totalCost?: number; steps?: RunStepCostEntry[] };
      actual?: { totalCost?: number; steps?: RunStepCostEntry[] };
    };
    timing?: {
      estimated?: { totalProcessingTimeMs?: number; steps?: RunStepTimingEntry[] };
      actual?: { totalProcessingTimeMs?: number; steps?: RunStepTimingEntry[] };
    };
  };
}
