#!/usr/bin/env bun

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadCanonicalRunRecord } from "../shared/pipeline_manifest";

export interface ImageProperties {
  width: number;
  height: number;
  format: string;
  fileSize: number;
  megapixels: number;
  bytesPerPixel: number;
}

export interface ImageEntryMetadata {
  imageService: string;
  imageModel: string;
  processingTime?: number;
  imageFileNames: string[];
  imageCount: number;
  imageFileSize: number;
  imageWidth: number | undefined;
  imageHeight: number | undefined;
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

export interface ImageManifestRecord {
  metadata: {
    image: ImageEntryMetadata[];
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

export interface ImageProviderEvidence {
  providerKey: string;
  imageService: string;
  imageModel: string;
  imageFileNames: string[];
  imageCount: number;
  totalFileSize: number;
  imagePaths: string[];
  allImagesExist: boolean;
  imageProperties: ImageProperties[];
  processingTimeMs: number | null;
  costCents: number | null;
}

export function loadImageManifestRecord(runDir: string): ImageManifestRecord {
  const metadata = loadCanonicalRunRecord(runDir, "image").metadata;
  if (!Array.isArray(metadata.image) || metadata.image.length === 0) {
    throw new Error("Canonical image manifest item metadata.image is missing or empty");
  }
  return { metadata: metadata as ImageManifestRecord["metadata"] };
}

export function makeProviderKey(service: string, model: string): string {
  return `${service}/${model}`;
}

export function discoverImageFiles(
  runDir: string,
  imageEntries: ImageEntryMetadata[],
): { found: Map<string, string[]>; missing: string[] } {
  const found = new Map<string, string[]>();
  const missing: string[] = [];
  for (const entry of imageEntries) {
    const key = makeProviderKey(entry.imageService, entry.imageModel);
    const paths: string[] = [];
    for (const fileName of entry.imageFileNames) {
      const imagePath = join(runDir, fileName);
      if (existsSync(imagePath)) {
        paths.push(imagePath);
      } else {
        missing.push(fileName);
      }
    }
    if (paths.length > 0) {
      found.set(key, paths);
    }
  }
  return { found, missing };
}

function readPngDimensions(buffer: Uint8Array): { width: number; height: number } | null {
  if (
    buffer.length < 24 ||
    buffer[0] !== 0x89 || buffer[1] !== 0x50 || buffer[2] !== 0x4e || buffer[3] !== 0x47
  ) {
    return null;
  }
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  return { width, height };
}

function readJpegDimensions(buffer: Uint8Array): { width: number; height: number } | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let offset = 2;
  while (offset + 4 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (
      marker !== undefined &&
      marker >= 0xc0 && marker <= 0xcf &&
      marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
    ) {
      if (offset + 9 < buffer.length) {
        const height = view.getUint16(offset + 5, false);
        const width = view.getUint16(offset + 7, false);
        return { width, height };
      }
      return null;
    }
    if (offset + 3 < buffer.length) {
      const segmentLength = view.getUint16(offset + 2, false);
      offset += 2 + segmentLength;
    } else {
      break;
    }
  }
  return null;
}

function readWebpDimensions(buffer: Uint8Array): { width: number; height: number } | null {
  if (
    buffer.length < 30 ||
    buffer[0] !== 0x52 || buffer[1] !== 0x49 || buffer[2] !== 0x46 || buffer[3] !== 0x46 ||
    buffer[8] !== 0x57 || buffer[9] !== 0x45 || buffer[10] !== 0x42 || buffer[11] !== 0x50
  ) {
    return null;
  }
  if (buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38 && buffer[15] === 0x20) {
    if (buffer.length >= 30) {
      const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      const width = view.getUint16(26, true) & 0x3fff;
      const height = view.getUint16(28, true) & 0x3fff;
      return { width, height };
    }
  }
  if (buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38 && buffer[15] === 0x4c) {
    if (buffer.length >= 25) {
      const bits = (buffer[21]!) | (buffer[22]! << 8) | (buffer[23]! << 16) | (buffer[24]! << 24);
      const width = (bits & 0x3fff) + 1;
      const height = ((bits >> 14) & 0x3fff) + 1;
      return { width, height };
    }
  }
  return null;
}

function detectFormat(buffer: Uint8Array): string {
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "png";
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    return "jpeg";
  }
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return "webp";
  }
  return "unknown";
}

export async function probeImage(imagePath: string): Promise<ImageProperties> {
  const file = Bun.file(imagePath);
  const fileSize = file.size;
  const headerBytes = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  const format = detectFormat(headerBytes);

  let dimensions: { width: number; height: number } | null = null;
  if (format === "png") {
    dimensions = readPngDimensions(headerBytes);
  } else if (format === "jpeg") {
    dimensions = readJpegDimensions(headerBytes);
  } else if (format === "webp") {
    dimensions = readWebpDimensions(headerBytes);
  }

  const width = dimensions?.width ?? 0;
  const height = dimensions?.height ?? 0;
  const megapixels = (width * height) / 1_000_000;
  const bytesPerPixel = width > 0 && height > 0 ? fileSize / (width * height) : 0;

  return { width, height, format, fileSize, megapixels, bytesPerPixel };
}

export function buildCostLookup(manifestRecord: ImageManifestRecord): Map<string, number> {
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

export function buildTimingLookup(manifestRecord: ImageManifestRecord): Map<string, number> {
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

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatDimensions(width: number, height: number): string {
  if (width === 0 || height === 0) {
    return "unknown";
  }
  return `${width}x${height}`;
}
