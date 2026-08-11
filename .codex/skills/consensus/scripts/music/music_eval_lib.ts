#!/usr/bin/env bun

import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadCanonicalRunRecord } from "../shared/pipeline_manifest";

export interface MusicEntryMetadata {
  musicService: string;
  musicModel: string;
  processingTime?: number;
  musicFileName: string;
  musicFileSize?: number;
  musicDurationMs?: number;
  lyricsSource?: string;
  audioMimeType?: string;
  audioSampleRate?: number;
  audioChannelCount?: number;
  audioBitrate?: number;
  outputFormat?: string;
}

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

export interface MusicManifestRecord {
  metadata: {
    music: MusicEntryMetadata[];
    input?: string;
    requestedProviders?: Array<{ service: string; model: string }>;
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

export interface MusicProviderEvidence {
  providerKey: string;
  musicService: string;
  musicModel: string;
  musicFileName: string;
  musicPath: string;
  musicExists: boolean;
  artifactFileSize: number | null;
  metadataFileSize: number | null;
  musicDurationMs: number | null;
  lyricsSource: string | null;
  audioMimeType: string | null;
  audioSampleRate: number | null;
  audioChannelCount: number | null;
  audioBitrate: number | null;
  outputFormat: string | null;
  processingTimeMs: number | null;
  costCents: number | null;
}

export function loadMusicManifestRecord(runDir: string): MusicManifestRecord {
  const metadata = loadCanonicalRunRecord(runDir, "music").metadata;
  if (!Array.isArray(metadata.music) || metadata.music.length === 0) {
    throw new Error("Canonical music manifest item metadata.music is missing or empty");
  }
  return { metadata: metadata as MusicManifestRecord["metadata"] };
}

export function makeProviderKey(service: string, model: string): string {
  return `${service}/${model}`;
}

export function discoverMusicFiles(
  runDir: string,
  musicEntries: MusicEntryMetadata[],
): { found: Map<string, string>; missing: string[] } {
  const found = new Map<string, string>();
  const missing: string[] = [];
  for (const entry of musicEntries) {
    const musicPath = join(runDir, entry.musicFileName);
    if (existsSync(musicPath)) {
      found.set(makeProviderKey(entry.musicService, entry.musicModel), musicPath);
    } else {
      missing.push(entry.musicFileName);
    }
  }
  return { found, missing };
}

export function buildCostLookup(manifestRecord: MusicManifestRecord): Map<string, number> {
  const lookup = new Map<string, number>();
  const estimatedSteps = manifestRecord.metadata.cost?.estimated?.steps ?? [];
  const actualSteps = manifestRecord.metadata.cost?.actual?.steps ?? [];
  for (const step of estimatedSteps) {
    if (step.provider && step.model && step.cost !== undefined) {
      lookup.set(makeProviderKey(step.provider, step.model), Number(step.cost));
    }
  }
  for (const step of actualSteps) {
    if (step.provider && step.model && step.cost !== undefined) {
      lookup.set(makeProviderKey(step.provider, step.model), Number(step.cost));
    }
  }
  return lookup;
}

export function buildTimingLookup(manifestRecord: MusicManifestRecord): Map<string, number> {
  const lookup = new Map<string, number>();
  const estimatedSteps = manifestRecord.metadata.timing?.estimated?.steps ?? [];
  const actualSteps = manifestRecord.metadata.timing?.actual?.steps ?? [];
  for (const step of estimatedSteps) {
    if (step.provider && step.model && step.processingTimeMs !== undefined) {
      lookup.set(makeProviderKey(step.provider, step.model), Number(step.processingTimeMs));
    }
  }
  for (const step of actualSteps) {
    if (step.provider && step.model && step.processingTimeMs !== undefined) {
      lookup.set(makeProviderKey(step.provider, step.model), Number(step.processingTimeMs));
    }
  }
  return lookup;
}

export function entryProcessingTime(entry: Pick<MusicEntryMetadata, "processingTime">): number | null {
  return typeof entry.processingTime === "number" ? entry.processingTime : null;
}

export function nullableNumber(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function normalizeLowerIsBetter(value: number | null, availableValues: number[]): number {
  if (!isFiniteNumber(value)) {
    return 50;
  }
  const finiteValues = availableValues.filter(isFiniteNumber);
  if (finiteValues.length === 0) {
    return 50;
  }
  const min = Math.min(...finiteValues);
  const max = Math.max(...finiteValues);
  if (min === max) {
    return 100;
  }
  return Math.max(0, Math.min(100, 100 * (1 - (value - min) / (max - min))));
}

export function formatCents(cents: number | null): string {
  if (cents === null) {
    return "n/a";
  }
  return `${cents.toFixed(4)}\u00A2 ($${(cents / 100).toFixed(4)})`;
}

export function formatProcessingSeconds(milliseconds: number | null): string {
  if (milliseconds === null) {
    return "n/a";
  }
  return `${(milliseconds / 1000).toFixed(2)}s`;
}

export function formatDurationMs(milliseconds: number | null): string {
  if (milliseconds === null) {
    return "n/a";
  }
  return `${(milliseconds / 1000).toFixed(2)}s`;
}

export function formatFileSize(bytes: number | null): string {
  if (bytes === null) {
    return "n/a";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
