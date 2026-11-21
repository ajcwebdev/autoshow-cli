#!/usr/bin/env bun

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { loadCanonicalRunRecord } from "../shared/pipeline_manifest";
import { resolveRepoRelativePath } from "../shared/portable_paths";
import type { PipelineProviderState } from "../shared/pipeline_manifest";

export interface Segment {
  start: number;
  end: number;
  speaker: string;
  text: string;
  rawStart: string;
  rawEnd: string;
}

export interface ProviderRun {
  directoryName: string;
  provider: string;
  model: string;
  providerKey: string;
  /** Stable sorted non-default settings label ("audioProfile=lossless,speakerCount=2"), or null for defaults. */
  settingsLabel: string | null;
  /** Directory name plus the bracketed settings label, used as the report display name. */
  displayName: string;
  resultPath: string;
  transcriptionPath: string | null;
  segments: Segment[];
  text: string;
  tokenCount: number | null;
  processingTimeMs: number | null;
  actualCostCents: number | null;
  timingQuality: string | null;
  hasSpeakerLabels: boolean | null;
  rawResponse: unknown;
}

interface RunStepCostEntry {
  provider?: string;
  model?: string;
  cost?: number;
}

interface RunStepTimingEntry {
  provider?: string;
  model?: string;
  processingTimeMs?: number;
}

interface SttManifestRecord {
  providers: PipelineProviderState[];
  metadata: {
    step1?: {
      duration?: string;
      durationSeconds?: number;
    };
    cost?: {
      actual?: {
        steps?: RunStepCostEntry[];
      };
    };
    timing?: {
      actual?: {
        steps?: RunStepTimingEntry[];
      };
    };
  };
}

interface SttProviderResult {
  text?: string;
  segments?: Array<{
    start?: string;
    end?: string;
    speaker?: string;
    text?: string;
  }>;
  evidence?: {
    timingQuality?: string;
    capabilities?: {
      hasSpeakerLabels?: boolean;
    };
    rawResponse?: unknown;
  };
}

interface SttProviderMetadata {
  tokenCount?: number;
  processingTime?: number;
}

const TRANSCRIPT_LINE_RE = /^\[(?<start>[^\]]+)\]\s+\[(?<speaker>[^\]]+)\]\s+(?<text>.+)$/;
const TOKEN_RE = /[a-z0-9]+(?:[‘’][a-z0-9]+)?/gi;
const PUNCT_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\u2018/g, "’"],
  [/\u2019/g, "’"],
  [/\u201c/g, '"'],
  [/\u201d/g, '"'],
  [/\u2013/g, "-"],
  [/\u2014/g, "-"],
  [/\u2026/g, "..."],
];

const CONTRACTIONS = new Map<string, string>([
  ["i’m", "i am"],
  ["i’ve", "i have"],
  ["i’ll", "i will"],
  ["i’d", "i would"],
  ["you’re", "you are"],
  ["you’ve", "you have"],
  ["you’ll", "you will"],
  ["you’d", "you would"],
  ["he’s", "he is"],
  ["she’s", "she is"],
  ["it’s", "it is"],
  ["we’re", "we are"],
  ["we’ve", "we have"],
  ["we’ll", "we will"],
  ["we’d", "we would"],
  ["they’re", "they are"],
  ["they’ve", "they have"],
  ["they’ll", "they will"],
  ["they’d", "they would"],
  ["that’s", "that is"],
  ["who’s", "who is"],
  ["what’s", "what is"],
  ["there’s", "there is"],
  ["here’s", "here is"],
  ["where’s", "where is"],
  ["how’s", "how is"],
  ["can’t", "cannot"],
  ["won’t", "will not"],
  ["don’t", "do not"],
  ["doesn’t", "does not"],
  ["didn’t", "did not"],
  ["isn’t", "is not"],
  ["aren’t", "are not"],
  ["wasn’t", "was not"],
  ["weren’t", "were not"],
  ["haven’t", "have not"],
  ["hasn’t", "has not"],
  ["hadn’t", "had not"],
  ["couldn’t", "could not"],
  ["wouldn’t", "would not"],
  ["shouldn’t", "should not"],
  ["let’s", "let us"],
]);

const ABBREVIATIONS = new Map<string, string>([
  ["mr.", "mister"],
  ["mrs.", "missus"],
  ["ms.", "miss"],
  ["dr.", "doctor"],
  ["prof.", "professor"],
  ["vs.", "versus"],
  ["etc.", "etcetera"],
  ["st.", "saint"],
  ["jr.", "junior"],
  ["sr.", "senior"],
]);

const CURRENCY_PATTERNS: Array<[RegExp, string]> = [
  [/\$(\d[\d,.]*)/g, "$1 dollars"],
  [/(\d[\d,.]*)%/g, "$1 percent"],
  [/[£](\d[\d,.]*)/g, "$1 pounds"],
  [/[€](\d[\d,.]*)/g, "$1 euros"],
  [/#(\d+)/g, "number $1"],
];

const FILLER_WORDS = new Set(["um", "uh", "hmm", "mhm", "ah", "er"]);

export function parseClock(value: string): number {
  const trimmed = value.trim();
  const numericSeconds = Number(trimmed);
  if (Number.isFinite(numericSeconds)) {
    return numericSeconds;
  }

  const parts = trimmed.split(":");
  if (parts.length !== 2 && parts.length !== 3) {
    throw new Error(`Unsupported timestamp or duration: ${value}`);
  }
  const seconds = Number(parts.at(-1));
  const minutes = Number(parts.at(-2));
  const hours = parts.length === 3 ? Number(parts[0]) : 0;
  return hours * 3600 + minutes * 60 + seconds;
}

export function formatClock(seconds: number): string {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const wholeSeconds = safe % 60;
  if (Math.abs(wholeSeconds - Math.round(wholeSeconds)) < 1e-9) {
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${Math.round(wholeSeconds).toString().padStart(2, "0")}`;
  }
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${wholeSeconds.toFixed(3).padStart(6, "0")}`;
}

export interface ProviderSegmentStats {
  segmentCount: number;
  timedSegmentCount: number;
  zeroDurationSegmentCount: number;
  negativeDurationSegmentCount: number;
  monotonicStarts: boolean;
  firstStartSeconds: number | null;
  lastEndSeconds: number | null;
  totalSegmentDurationSeconds: number;
  coverageSeconds: number | null;
  durationCoverageRatio: number | null;
  timingQuality: string | null;
  hasSpeakerLabels: boolean | null;
}

export function computeProviderSegmentStats(
  provider: ProviderRun,
  runDurationSeconds: number,
): ProviderSegmentStats {
  let timedSegmentCount = 0;
  let zeroDurationSegmentCount = 0;
  let negativeDurationSegmentCount = 0;
  let monotonicStarts = true;
  let firstStartSeconds: number | null = null;
  let lastEndSeconds: number | null = null;
  let previousStartSeconds: number | null = null;
  let totalSegmentDurationSeconds = 0;

  for (const segment of provider.segments) {
    timedSegmentCount += 1;
    if (previousStartSeconds !== null && segment.start < previousStartSeconds) {
      monotonicStarts = false;
    }
    previousStartSeconds = segment.start;
    firstStartSeconds = firstStartSeconds === null ? segment.start : Math.min(firstStartSeconds, segment.start);
    lastEndSeconds = lastEndSeconds === null ? segment.end : Math.max(lastEndSeconds, segment.end);
    const durationSeconds = segment.end - segment.start;
    if (durationSeconds < 0) {
      negativeDurationSegmentCount += 1;
    } else {
      if (durationSeconds === 0) {
        zeroDurationSegmentCount += 1;
      }
      totalSegmentDurationSeconds += durationSeconds;
    }
  }

  const coverageSeconds = firstStartSeconds !== null && lastEndSeconds !== null
    ? Math.max(0, lastEndSeconds - firstStartSeconds)
    : null;

  return {
    segmentCount: provider.segments.length,
    timedSegmentCount,
    zeroDurationSegmentCount,
    negativeDurationSegmentCount,
    monotonicStarts,
    firstStartSeconds,
    lastEndSeconds,
    totalSegmentDurationSeconds,
    coverageSeconds,
    durationCoverageRatio: coverageSeconds !== null && runDurationSeconds > 0 ? coverageSeconds / runDurationSeconds : null,
    timingQuality: provider.timingQuality,
    hasSpeakerLabels: provider.hasSpeakerLabels,
  };
}

export function normalizeText(text: string): string {
  let normalized = text.toLowerCase();
  for (const [pattern, replacement] of PUNCT_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }
  for (const [abbr, expansion] of ABBREVIATIONS) {
    normalized = normalized.replaceAll(abbr, expansion);
  }
  for (const [pattern, replacement] of CURRENCY_PATTERNS) {
    normalized = normalized.replace(pattern, replacement);
  }
  for (const [contraction, expansion] of CONTRACTIONS) {
    normalized = normalized.replaceAll(contraction, expansion);
  }
  normalized = normalized.replace(/[^\p{L}\p{N}\s]/gu, " ");
  return normalized.trim().replace(/\s+/g, " ");
}

export function stripFillerTokens(tokens: string[]): string[] {
  return tokens.filter((token) => !FILLER_WORDS.has(token));
}

export function tokenize(text: string): string[] {
  return normalizeText(text).match(TOKEN_RE) ?? [];
}

export interface WerBreakdown {
  distance: number;
  substitutions: number;
  deletions: number;
  insertions: number;
}

export function levenshteinDistance(left: string[], right: string[]): number {
  if (left.length === 0) {
    return right.length;
  }
  if (right.length === 0) {
    return left.length;
  }
  if (left.length < right.length) {
    return levenshteinDistance(right, left);
  }
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const current = [leftIndex + 1];
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const insertion = current[rightIndex]! + 1;
      const deletion = previous[rightIndex + 1]! + 1;
      const substitution = previous[rightIndex]! + Number(left[leftIndex] !== right[rightIndex]);
      current.push(Math.min(insertion, deletion, substitution));
    }
    previous = current;
  }
  return previous.at(-1) ?? 0;
}

/**
 * Exact S/D/I breakdown for transcripts of any length. It delegates to `alignTokens`, whose checkpointed
 * traceback reproduces the full-matrix traceback (same costs, same diagonal > deletion > insertion tie order)
 * in O(n·m) time and O(m·√n) memory, so long recordings no longer fall back to unavailable (-1) counts.
 */
export function levenshteinBreakdown(reference: string[], candidate: string[]): WerBreakdown {
  const alignment = alignTokens(reference, candidate);
  return {
    distance: alignment.distance,
    substitutions: alignment.substitutions,
    deletions: alignment.deletions,
    insertions: alignment.insertions,
  };
}

export type AlignmentOperation = "match" | "sub" | "del" | "ins";

export interface AlignmentStep {
  op: AlignmentOperation;
  /** Reference token index, or -1 for an insertion. */
  referenceIndex: number;
  /** Candidate token index, or -1 for a deletion. */
  candidateIndex: number;
  /** 0 for matches and for deleting/inserting optional (disfluency) tokens, otherwise 1. */
  cost: number;
}

export interface TokenAlignmentOptions {
  /** Reference tokens that may be deleted at zero cost (still matched when the candidate has them). */
  referenceOptional?: ArrayLike<boolean>;
  /** Candidate tokens that may be inserted at zero cost (still matched when the reference has them). */
  candidateOptional?: ArrayLike<boolean>;
  /** Return the full alignment path in `steps`. */
  includeSteps?: boolean;
}

export interface TokenAlignment extends WerBreakdown {
  matches: number;
  /** Optional reference tokens dropped at zero cost (not counted as deletions). */
  optionalDeletions: number;
  /** Optional candidate tokens added at zero cost (not counted as insertions). */
  optionalInsertions: number;
  steps: AlignmentStep[] | null;
}

const DIRECTION_DIAGONAL = 0;
const DIRECTION_DELETE = 1;
const DIRECTION_INSERT = 2;

function encodeTokenPair(reference: string[], candidate: string[]): [Int32Array, Int32Array] {
  const ids = new Map<string, number>();
  const encode = (tokens: string[]) => {
    const encoded = new Int32Array(tokens.length);
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index]!;
      let id = ids.get(token);
      if (id === undefined) {
        id = ids.size;
        ids.set(token, id);
      }
      encoded[index] = id;
    }
    return encoded;
  };
  return [encode(reference), encode(candidate)];
}

function costVector(length: number, optional: ArrayLike<boolean> | undefined): Uint8Array {
  const costs = new Uint8Array(length).fill(1);
  if (optional) {
    for (let index = 0; index < length; index += 1) {
      if (optional[index]) {
        costs[index] = 0;
      }
    }
  }
  return costs;
}

function fillFirstRow(row: Int32Array, insertCosts: Uint8Array, columns: number): void {
  row[0] = 0;
  for (let j = 1; j <= columns; j += 1) {
    row[j] = row[j - 1]! + insertCosts[j - 1]!;
  }
}

/** One DP row over columns 0..columns; ties prefer diagonal, then deletion, then insertion. */
function advanceRow(
  previous: Int32Array,
  current: Int32Array,
  referenceId: number,
  deleteCost: number,
  candidate: Int32Array,
  insertCosts: Uint8Array,
  columns: number,
  directions: Uint8Array | null,
  directionOffset: number,
): void {
  current[0] = previous[0]! + deleteCost;
  if (directions) {
    directions[directionOffset] = DIRECTION_DELETE;
  }
  for (let j = 1; j <= columns; j += 1) {
    const diagonal = previous[j - 1]! + (referenceId === candidate[j - 1] ? 0 : 1);
    const deletion = previous[j]! + deleteCost;
    const insertion = current[j - 1]! + insertCosts[j - 1]!;
    if (diagonal <= deletion && diagonal <= insertion) {
      current[j] = diagonal;
      if (directions) directions[directionOffset + j] = DIRECTION_DIAGONAL;
    } else if (deletion <= insertion) {
      current[j] = deletion;
      if (directions) directions[directionOffset + j] = DIRECTION_DELETE;
    } else {
      current[j] = insertion;
      if (directions) directions[directionOffset + j] = DIRECTION_INSERT;
    }
  }
}

/** Weighted edit cost only (two rolling rows), for ablations that do not need a traceback. */
export function alignmentCost(reference: string[], candidate: string[], options: TokenAlignmentOptions = {}): number {
  const [referenceIds, candidateIds] = encodeTokenPair(reference, candidate);
  const deleteCosts = costVector(reference.length, options.referenceOptional);
  const insertCosts = costVector(candidate.length, options.candidateOptional);
  const columns = candidate.length;
  let previous = new Int32Array(columns + 1);
  let current = new Int32Array(columns + 1);
  fillFirstRow(previous, insertCosts, columns);
  for (let i = 1; i <= reference.length; i += 1) {
    advanceRow(previous, current, referenceIds[i - 1]!, deleteCosts[i - 1]!, candidateIds, insertCosts, columns, null, 0);
    [previous, current] = [current, previous];
  }
  return previous[columns]!;
}

/**
 * Exact minimum-cost alignment with a checkpointed traceback: the forward pass keeps every ⌈√n⌉-th DP row,
 * then each block of rows is recomputed (only up to the current column) to recover directions. The path is
 * identical to a full-matrix traceback with the same tie order, so counts are exact for any transcript length.
 */
export function alignTokens(reference: string[], candidate: string[], options: TokenAlignmentOptions = {}): TokenAlignment {
  const rows = reference.length;
  const columns = candidate.length;
  const [referenceIds, candidateIds] = encodeTokenPair(reference, candidate);
  const deleteCosts = costVector(rows, options.referenceOptional);
  const insertCosts = costVector(columns, options.candidateOptional);
  const blockSize = Math.max(1, Math.ceil(Math.sqrt(rows)));

  const checkpoints = new Map<number, Int32Array>();
  let previous = new Int32Array(columns + 1);
  let current = new Int32Array(columns + 1);
  fillFirstRow(previous, insertCosts, columns);
  checkpoints.set(0, previous.slice());
  for (let i = 1; i <= rows; i += 1) {
    advanceRow(previous, current, referenceIds[i - 1]!, deleteCosts[i - 1]!, candidateIds, insertCosts, columns, null, 0);
    [previous, current] = [current, previous];
    if (i % blockSize === 0 && i < rows) {
      checkpoints.set(i, previous.slice());
    }
  }
  const distance = previous[columns]!;

  const reversedSteps: AlignmentStep[] = [];
  let matches = 0;
  let substitutions = 0;
  let deletions = 0;
  let insertions = 0;
  let optionalDeletions = 0;
  let optionalInsertions = 0;
  const record = (op: AlignmentOperation, referenceIndex: number, candidateIndex: number, cost: number) => {
    if (op === "match") matches += 1;
    else if (op === "sub") substitutions += 1;
    else if (op === "del" && cost === 0) optionalDeletions += 1;
    else if (op === "del") deletions += 1;
    else if (cost === 0) optionalInsertions += 1;
    else insertions += 1;
    if (options.includeSteps) {
      reversedSteps.push({ op, referenceIndex, candidateIndex, cost });
    }
  };

  let i = rows;
  let j = columns;
  while (i > 0) {
    const blockStart = Math.floor((i - 1) / blockSize) * blockSize;
    const blockRows = i - blockStart;
    const width = j + 1;
    const directions = new Uint8Array(blockRows * width);
    let blockPrevious = checkpoints.get(blockStart)!.slice(0, width);
    let blockCurrent = new Int32Array(width);
    for (let row = blockStart + 1; row <= i; row += 1) {
      advanceRow(
        blockPrevious, blockCurrent, referenceIds[row - 1]!, deleteCosts[row - 1]!,
        candidateIds, insertCosts, j, directions, (row - blockStart - 1) * width,
      );
      [blockPrevious, blockCurrent] = [blockCurrent, blockPrevious];
    }
    while (i > blockStart) {
      const direction = j === 0 ? DIRECTION_DELETE : directions[(i - blockStart - 1) * width + j]!;
      if (direction === DIRECTION_DIAGONAL) {
        const same = referenceIds[i - 1] === candidateIds[j - 1];
        record(same ? "match" : "sub", i - 1, j - 1, same ? 0 : 1);
        i -= 1;
        j -= 1;
      } else if (direction === DIRECTION_DELETE) {
        record("del", i - 1, -1, deleteCosts[i - 1]!);
        i -= 1;
      } else {
        record("ins", -1, j - 1, insertCosts[j - 1]!);
        j -= 1;
      }
    }
  }
  while (j > 0) {
    record("ins", -1, j - 1, insertCosts[j - 1]!);
    j -= 1;
  }

  return {
    distance,
    matches,
    substitutions,
    deletions,
    insertions,
    optionalDeletions,
    optionalInsertions,
    steps: options.includeSteps ? reversedSteps.reverse() : null,
  };
}

export function overlapSeconds(left: Segment, right: Segment): number {
  return Math.max(0, Math.min(left.end, right.end) - Math.max(left.start, right.start));
}

export function loadSttManifestRecord(runDir: string): SttManifestRecord {
  const record = loadCanonicalRunRecord(runDir, "extract", "media");
  return {
    providers: record.item.providers,
    metadata: record.metadata as SttManifestRecord["metadata"],
  };
}

export function durationSecondsFromManifest(manifestRecord: SttManifestRecord, providers: ProviderRun[] = []): number {
  const numericDuration = manifestRecord.metadata.step1?.durationSeconds;
  if (typeof numericDuration === "number" && Number.isFinite(numericDuration) && numericDuration > 0) {
    return numericDuration;
  }

  const duration = manifestRecord.metadata.step1?.duration?.trim();
  if (duration && duration.toLowerCase() !== "unknown") {
    return parseClock(duration);
  }

  const fallbackDuration = Math.max(
    0,
    ...providers.flatMap((provider) =>
      provider.segments
        .map((segment) => segment.end)
        .filter((end) => Number.isFinite(end) && end > 0),
    ),
  );
  if (fallbackDuration > 0) {
    return fallbackDuration;
  }

  if (!duration) {
    throw new Error("Canonical STT manifest item is missing metadata.step1.duration and provider segment ends are unavailable");
  }
  throw new Error(`Canonical STT manifest metadata.step1.duration is ${JSON.stringify(duration)} and provider segment ends are unavailable`);
}

function makeProviderLookupKey(provider: string, model: string): string {
  return `${provider}::${model}`;
}

function actualCostLookup(manifestRecord: SttManifestRecord): Map<string, number> {
  const lookup = new Map<string, number>();
  const steps = manifestRecord.metadata.cost?.actual?.steps ?? [];
  for (const step of steps) {
    if (step.provider && step.model && step.cost !== undefined) {
      lookup.set(makeProviderLookupKey(step.provider, step.model), Number(step.cost));
    }
  }
  return lookup;
}

function actualTimingLookup(manifestRecord: SttManifestRecord): Map<string, number> {
  const lookup = new Map<string, number>();
  const steps = manifestRecord.metadata.timing?.actual?.steps ?? [];
  for (const step of steps) {
    if (step.provider && step.model && step.processingTimeMs !== undefined) {
      lookup.set(makeProviderLookupKey(step.provider, step.model), Number(step.processingTimeMs));
    }
  }
  return lookup;
}

export function loadProviderRuns(runDir: string): { providers: ProviderRun[]; warnings: string[] } {
  const manifestRecord = loadSttManifestRecord(runDir);
  const costLookup = actualCostLookup(manifestRecord);
  const timingLookup = actualTimingLookup(manifestRecord);
  const warnings: string[] = [];
  const runVariantLabel = readRunVariantLabel(runDir);

  const providerStates = manifestRecord.providers;
  const expectedDirs = new Set(
    providerStates
      .map((state) => state.artifactDir)
      .filter((artifactDir): artifactDir is string => Boolean(artifactDir))
      .map((artifactDir) => basename(artifactDir)),
  );

  const providersDir = join(runDir, "providers");
  const resultPaths = readdirSync(providersDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(providersDir, entry.name, "result.json"))
    .filter((path) => existsSync(path))
    .sort((left, right) => left.localeCompare(right));
  const discoveredDirs = new Set(resultPaths.map((path) => basename(dirname(path))));

  const missingResultDirs = [...expectedDirs].filter((dir) => !discoveredDirs.has(dir)).sort();
  if (missingResultDirs.length > 0) {
    warnings.push(
      "manifest.json references provider artifact directories that are missing result.json files: " +
        missingResultDirs.join(", "),
    );
  }

  const extraResultDirs = [...discoveredDirs].filter((dir) => !expectedDirs.has(dir)).sort();
  if (extraResultDirs.length > 0) {
    warnings.push(
      "Found provider result.json files not listed in manifest.json provider states: " +
        extraResultDirs.join(", "),
    );
  }

  const providers = resultPaths.flatMap((resultPath) => {
    const directoryName = basename(dirname(resultPath));
    const state = providerStates.find((providerState) => basename(providerState.artifactDir) === directoryName);
    if (!state) {
      return [];
    }
    if (state.status !== "succeeded") {
      return [];
    }
    const provider = state.service;
    const model = state.model;
    if (typeof model !== "string") {
      throw new Error(`${resultPath} has no model identity in manifest.json`);
    }
    const metadata = state.metadata as SttProviderMetadata;
    const result = JSON.parse(readFileSync(resultPath, "utf8")) as SttProviderResult;
    const evidence = result.evidence;
    const segments = (result.segments ?? [])
      .map((item) => {
        const rawStart = String(item.start ?? "0:00");
        const rawEnd = String(item.end ?? rawStart);
        const start = parseClock(rawStart);
        const parsedEnd = parseClock(rawEnd);
        return {
          start,
          end: parsedEnd < start ? start : parsedEnd,
          speaker: String(item.speaker ?? "speaker-unknown"),
          text: String(item.text ?? "").trim(),
          rawStart,
          rawEnd,
        } satisfies Segment;
      })
      .sort((left, right) => {
        if (left.start !== right.start) {
          return left.start - right.start;
        }
        if (left.end !== right.end) {
          return left.end - right.end;
        }
        if (left.speaker !== right.speaker) {
          return left.speaker.localeCompare(right.speaker);
        }
        return left.text.localeCompare(right.text);
      });
    const transcriptionPath = join(dirname(resultPath), "transcription.txt");
    const lookupKey = makeProviderLookupKey(provider, model);
    const settingsLabel = runVariantLabel ?? providerSettingsLabel((state as unknown as { settings?: unknown }).settings);
    return [{
      directoryName,
      provider,
      model,
      providerKey: settingsProviderKey(provider, model, settingsLabel),
      settingsLabel,
      displayName: settingsLabel ? `${directoryName}[${settingsLabel}]` : directoryName,
      resultPath,
      transcriptionPath: existsSync(transcriptionPath) ? transcriptionPath : null,
      segments,
      text: String(result.text ?? "").trim(),
      tokenCount: metadata.tokenCount ?? null,
      processingTimeMs:
        timingLookup.get(lookupKey) ??
        (metadata.processingTime !== undefined ? Number(metadata.processingTime) : null),
      actualCostCents: costLookup.get(lookupKey) ?? null,
      timingQuality: typeof evidence?.timingQuality === "string" ? evidence.timingQuality : null,
      hasSpeakerLabels: typeof evidence?.capabilities?.hasSpeakerLabels === "boolean" ? evidence.capabilities.hasSpeakerLabels : null,
      rawResponse: evidence && "rawResponse" in evidence ? evidence.rawResponse : undefined,
    } satisfies ProviderRun];
  });

  return { providers, warnings };
}

function settingValue(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) return value.join("+") || null;
  return null;
}

/**
 * Settings label for a provider state's `settings` record. Only result-affecting non-default settings are labeled:
 * `request.verbatim` (true), `request.responseFormat`, `request.diarization.*` except `enabled` (e.g. speakerCount),
 * `request.fillerWords` (any boolean), `request.numberFormat`, and `local.audioProfile` other than "default".
 * Defaults produce null, so default runs keep their historical `service/model` key.
 */
export function providerSettingsLabel(settings: unknown): string | null {
  const record = typeof settings === "object" && settings !== null ? settings as Record<string, unknown> : {};
  const request = typeof record["request"] === "object" && record["request"] !== null ? record["request"] as Record<string, unknown> : {};
  const local = typeof record["local"] === "object" && record["local"] !== null ? record["local"] as Record<string, unknown> : {};
  const entries: Array<[string, string]> = [];
  if (request["verbatim"] === true) entries.push(["verbatim", "true"]);
  const responseFormat = settingValue(request["responseFormat"]);
  if (responseFormat) entries.push(["responseFormat", responseFormat]);
  if (typeof request["diarization"] === "object" && request["diarization"] !== null) {
    for (const [key, value] of Object.entries(request["diarization"] as Record<string, unknown>)) {
      const label = key === "enabled" ? null : settingValue(value);
      if (label) entries.push([key, label]);
    }
  }
  if (typeof request["fillerWords"] === "boolean") entries.push(["fillerWords", String(request["fillerWords"])]);
  const numberFormat = settingValue(request["numberFormat"]);
  if (numberFormat) entries.push(["numberFormat", numberFormat]);
  const audioProfile = settingValue(local["audioProfile"]);
  if (audioProfile && audioProfile !== "default") entries.push(["audioProfile", audioProfile]);
  if (entries.length === 0) return null;
  return entries.sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${key}=${value}`).join(",");
}

export function settingsProviderKey(service: string, model: string, settingsLabel: string | null): string {
  return settingsLabel ? `${service}/${model}[${settingsLabel}]` : `${service}/${model}`;
}

/** Strips a trailing `[settings]` label from a provider key. */
export function baseProviderKey(providerKey: string): string {
  return providerKey.replace(/\[[^\]]*\]$/, "");
}

export const RUN_VARIANT_FILE = "variant.json";

/** Optional run-level `variant.json` ({ variantId, label }); its label replaces the derived settings label. */
export function readRunVariantLabel(runDir: string): string | null {
  const path = join(runDir, RUN_VARIANT_FILE);
  if (!existsSync(path)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${path} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  const record = typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : {};
  if (typeof record["variantId"] !== "string" || typeof record["label"] !== "string") {
    throw new Error(`${path} must contain string "variantId" and "label" fields`);
  }
  const label = record["label"].trim();
  if (label.includes("]")) {
    throw new Error(`${path} label must not contain "]"`);
  }
  return label || null;
}

export function parseReferenceTranscript(path: string, runDurationSeconds: number): Segment[] {
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  const parsed = lines.flatMap((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) {
      return [];
    }
    const match = line.match(TRANSCRIPT_LINE_RE);
    if (!match?.groups) {
      throw new Error(`${path} line ${index + 1} does not match '[HH:MM:SS] [speaker-n] text': ${rawLine}`);
    }
    return [
      {
        start: parseClock(match.groups["start"] ?? ""),
        speaker: (match.groups["speaker"] ?? "").trim(),
        text: (match.groups["text"] ?? "").trim(),
      },
    ];
  });
  if (parsed.length === 0) {
    throw new Error(`${path} does not contain any transcript lines`);
  }

  return parsed.map((segment, index) => {
    const nextStart = index + 1 < parsed.length ? parsed[index + 1]!.start : runDurationSeconds;
    const end = nextStart < segment.start ? segment.start : nextStart;
    return {
      start: segment.start,
      end,
      speaker: segment.speaker,
      text: segment.text,
      rawStart: formatClock(segment.start),
      rawEnd: formatClock(end),
    } satisfies Segment;
  });
}

export function mapProviderSpeakers(
  referenceSegments: Segment[],
  providerSegments: Segment[],
): Record<string, string> {
  const overlapMap = new Map<string, Map<string, number>>();
  for (const providerSegment of providerSegments) {
    const providerBucket = overlapMap.get(providerSegment.speaker) ?? new Map<string, number>();
    overlapMap.set(providerSegment.speaker, providerBucket);
    for (const referenceSegment of referenceSegments) {
      const seconds = overlapSeconds(providerSegment, referenceSegment);
      if (seconds <= 0) {
        continue;
      }
      providerBucket.set(
        referenceSegment.speaker,
        (providerBucket.get(referenceSegment.speaker) ?? 0) + seconds,
      );
    }
  }

  const mapping: Record<string, string> = {};
  for (const [providerSpeaker, speakerTotals] of overlapMap.entries()) {
    const best = [...speakerTotals.entries()].sort((left, right) => {
      if (left[1] !== right[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    })[0];
    if (best) {
      mapping[providerSpeaker] = best[0];
    }
  }
  return mapping;
}

export function overlappingProviderSegments(
  referenceSegment: Segment,
  providerSegments: Segment[],
): Array<[Segment, number]> {
  const overlaps: Array<[Segment, number]> = [];
  for (const providerSegment of providerSegments) {
    const seconds = overlapSeconds(referenceSegment, providerSegment);
    if (seconds > 0) {
      overlaps.push([providerSegment, seconds]);
    }
  }
  return overlaps;
}

export function mergeOverlapText(overlaps: Array<[Segment, number]>): string {
  return overlaps
    .map(([segment]) => segment.text.trim())
    .filter((text) => text.length > 0)
    .join(" ");
}

export function dominantOverlapSpeaker(
  overlaps: Array<[Segment, number]>,
  speakerMap?: Record<string, string>,
): string {
  const totals = new Map<string, number>();
  for (const [segment, seconds] of overlaps) {
    const speaker = speakerMap?.[segment.speaker] ?? segment.speaker;
    totals.set(speaker, (totals.get(speaker) ?? 0) + seconds);
  }
  const best = [...totals.entries()].sort((left, right) => {
    if (left[1] !== right[1]) {
      return right[1] - left[1];
    }
    return left[0].localeCompare(right[0]);
  })[0];
  return best?.[0] ?? "speaker-missing";
}

export function alignProviderToReference(
  referenceSegments: Segment[],
  providerSegments: Segment[],
  speakerMap?: Record<string, string>,
): Segment[] {
  return referenceSegments.map((referenceSegment) => {
    const overlaps = overlappingProviderSegments(referenceSegment, providerSegments);
    return {
      start: referenceSegment.start,
      end: referenceSegment.end,
      speaker: dominantOverlapSpeaker(overlaps, speakerMap),
      text: mergeOverlapText(overlaps),
      rawStart: referenceSegment.rawStart,
      rawEnd: referenceSegment.rawEnd,
    } satisfies Segment;
  });
}

export function segmentWer(
  referenceSegments: Segment[],
  candidateSegments: Segment[],
  includeSpeakers: boolean,
): number {
  if (referenceSegments.length !== candidateSegments.length) {
    throw new Error("Reference and candidate segment lists must have the same length");
  }
  let totalDistance = 0;
  let totalReferenceTokens = 0;
  for (let index = 0; index < referenceSegments.length; index += 1) {
    const referenceSegment = referenceSegments[index]!;
    const candidateSegment = candidateSegments[index]!;
    const referenceTokens = tokenize(referenceSegment.text);
    const candidateTokens = tokenize(candidateSegment.text);
    if (includeSpeakers) {
      referenceTokens.unshift(`<speaker:${referenceSegment.speaker}>`);
      candidateTokens.unshift(`<speaker:${candidateSegment.speaker}>`);
    }
    totalDistance += levenshteinDistance(referenceTokens, candidateTokens);
    totalReferenceTokens += referenceTokens.length;
  }
  return totalReferenceTokens === 0 ? 0 : totalDistance / totalReferenceTokens;
}

export function tokensFromSegments(
  segments: Segment[],
  includeSpeakers: boolean,
  speakerMap?: Record<string, string>,
): string[] {
  const tokens: string[] = [];
  let previousSpeaker: string | null = null;

  for (const segment of segments) {
    const textTokens = tokenize(segment.text);
    if (textTokens.length === 0) {
      continue;
    }

    if (includeSpeakers) {
      const speaker = speakerMap?.[segment.speaker] ?? segment.speaker;
      if (speaker !== previousSpeaker) {
        tokens.push(`<speaker:${speaker}>`);
        previousSpeaker = speaker;
      }
    }

    tokens.push(...textTokens);
  }

  return tokens;
}

export function wordWer(
  referenceSegments: Segment[],
  candidateSegments: Segment[],
  includeSpeakers: boolean,
  speakerMap?: Record<string, string>,
): number {
  const referenceTokens = tokensFromSegments(referenceSegments, includeSpeakers);
  const candidateTokens = tokensFromSegments(candidateSegments, includeSpeakers, speakerMap);
  if (referenceTokens.length === 0) {
    return 0;
  }
  return levenshteinDistance(referenceTokens, candidateTokens) / referenceTokens.length;
}

export interface WerDetailedResult {
  wer: number;
  substitutions: number;
  deletions: number;
  insertions: number;
  referenceWordCount: number;
}

export function wordWerDetailed(
  referenceSegments: Segment[],
  candidateSegments: Segment[],
  includeSpeakers: boolean,
  speakerMap?: Record<string, string>,
  options?: { stripFillers?: boolean },
): WerDetailedResult {
  let referenceTokens = tokensFromSegments(referenceSegments, includeSpeakers);
  let candidateTokens = tokensFromSegments(candidateSegments, includeSpeakers, speakerMap);
  if (options?.stripFillers) {
    referenceTokens = stripFillerTokens(referenceTokens);
    candidateTokens = stripFillerTokens(candidateTokens);
  }
  const referenceWordCount = referenceTokens.length;
  if (referenceWordCount === 0) {
    return { wer: 0, substitutions: 0, deletions: 0, insertions: 0, referenceWordCount: 0 };
  }
  const breakdown = levenshteinBreakdown(referenceTokens, candidateTokens);
  return {
    wer: breakdown.distance / referenceWordCount,
    substitutions: breakdown.substitutions,
    deletions: breakdown.deletions,
    insertions: breakdown.insertions,
    referenceWordCount,
  };
}

export function segmentAlignedSimilarity(
  referenceSegments: Segment[],
  candidateSegments: Segment[],
): number {
  const alignedCandidate = alignProviderToReference(referenceSegments, candidateSegments);
  return Math.max(0, 1 - segmentWer(referenceSegments, alignedCandidate, false));
}

export function meanPairwiseSimilarity(providers: ProviderRun[]): Record<string, number> {
  if (providers.length === 1) {
    return { [providers[0]!.directoryName]: 1 };
  }
  const scores = new Map<string, number[]>(
    providers.map((provider) => [provider.directoryName, []]),
  );
  for (let leftIndex = 0; leftIndex < providers.length; leftIndex += 1) {
    const left = providers[leftIndex]!;
    for (const right of providers.slice(leftIndex + 1)) {
      const forward = segmentAlignedSimilarity(left.segments, right.segments);
      const reverse = segmentAlignedSimilarity(right.segments, left.segments);
      const similarity = (forward + reverse) / 2;
      scores.get(left.directoryName)?.push(similarity);
      scores.get(right.directoryName)?.push(similarity);
    }
  }
  return Object.fromEntries(
    [...scores.entries()].map(([providerName, values]) => [
      providerName,
      values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 1,
    ]),
  );
}

export function chooseBaselineProvider(
  providers: ProviderRun[],
): { baseline: ProviderRun; agreement: Record<string, number> } {
  const agreement = meanPairwiseSimilarity(providers);
  const ranked = [...providers].sort((left, right) => {
    const leftScore = agreement[left.directoryName] ?? 0;
    const rightScore = agreement[right.directoryName] ?? 0;
    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }
    const leftSpeakerCount = new Set(left.segments.map((segment) => segment.speaker)).size;
    const rightSpeakerCount = new Set(right.segments.map((segment) => segment.speaker)).size;
    if (leftSpeakerCount !== rightSpeakerCount) {
      return rightSpeakerCount - leftSpeakerCount;
    }
    const leftTextTokens = tokenize(left.text).length;
    const rightTextTokens = tokenize(right.text).length;
    if (leftTextTokens !== rightTextTokens) {
      return rightTextTokens - leftTextTokens;
    }
    const leftProcessing = left.processingTimeMs ?? Number.POSITIVE_INFINITY;
    const rightProcessing = right.processingTimeMs ?? Number.POSITIVE_INFINITY;
    if (leftProcessing !== rightProcessing) {
      return leftProcessing - rightProcessing;
    }
    return left.directoryName.localeCompare(right.directoryName);
  });
  const baseline = ranked[0];
  if (!baseline) {
    throw new Error("Cannot choose a baseline provider from an empty provider list");
  }
  return { baseline, agreement };
}

export function formatCents(cents: number | null): string {
  if (cents === null) {
    return "n/a";
  }
  return `${cents.toFixed(4)}¢ ($${(cents / 100).toFixed(4)})`;
}

export function formatProcessingSeconds(milliseconds: number | null): string {
  if (milliseconds === null) {
    return "n/a";
  }
  return `${(milliseconds / 1000).toFixed(2)}s`;
}

// ---------------------------------------------------------------------------
// Neutral scoring views (scoring version 2)
//
// Each view is applied identically to the reference and the candidate before alignment. With no views
// enabled the pipeline reproduces the legacy `tokenize` + filler-strip token stream.
// ---------------------------------------------------------------------------

export type NormalizationView = "disfluency-neutral" | "number-neutral" | "orthographic-neutral";

/** Headline views, in the order the error-attribution ablation enables them. */
export const NEUTRAL_VIEWS: readonly NormalizationView[] = ["disfluency-neutral", "orthographic-neutral", "number-neutral"];

export type ViewSet = ReadonlySet<NormalizationView>;

/** Extra filler spellings removed by the disfluency-neutral view, on top of the legacy filler list. */
export const DISFLUENCY_EXTRA_FILLER_WORDS: ReadonlySet<string> = new Set(["umm", "uhm", "uhh", "hm", "hmmm", "mm", "mmm", "erm", "ahh"]);

/** Maximum n-gram length collapsed by `collapseImmediateRepeats`. */
export const MAX_REPEAT_NGRAM = 3;

export interface TextChunk {
  text: string;
  /** True for a false-start fragment that may be dropped at zero cost. */
  optional: boolean;
}

const FALSE_START_WORD_RE = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;
const WORD_CHAR_RE = /[\p{L}\p{N}]/u;
const CLAUSE_BOUNDARY_RE = /[.,;:!?]/g;

function falseStartWords(text: string): string[] {
  return (text.match(FALSE_START_WORD_RE) ?? []).map((word) => word.toLowerCase().replace(/'/g, "’"));
}

/**
 * Disfluency view, pre-tokenization: marks false-start fragments that end in a dash attached to the last word
 * (`—`, `–`, `--`, or `-`). The fragment runs back to the previous clause punctuation or dash. It is optional when
 * it has at most three words and the dash is followed by whitespace/end ("you got fired— you got laid off"), or when
 * the next word restarts the fragment's first word and the fragment has at most eight words ("I—I think").
 * Single `-` and `–` count only when followed by whitespace/end, so compounds and numeric ranges are untouched.
 */
export function splitFalseStartFragments(text: string): TextChunk[] {
  const chunks: TextChunk[] = [];
  const markerRe = /—|–|-{1,2}/g;
  let flushedUntil = 0;
  let clauseStart = 0;
  for (let match = markerRe.exec(text); match; match = markerRe.exec(text)) {
    const marker = match[0];
    const at = match.index;
    const after = at + marker.length;
    if (!WORD_CHAR_RE.test(text[at - 1] ?? "")) {
      continue;
    }
    const nextChar = text[after] ?? "";
    const followedBySpaceOrEnd = nextChar === "" || /\s/.test(nextChar);
    if ((marker === "-" || marker === "–") && !followedBySpaceOrEnd) {
      continue;
    }
    const clause = text.slice(clauseStart, at);
    let fragmentStart = clauseStart;
    for (const boundary of clause.matchAll(CLAUSE_BOUNDARY_RE)) {
      fragmentStart = clauseStart + (boundary.index ?? 0) + 1;
    }
    const fragment = text.slice(fragmentStart, at);
    const fragmentWords = falseStartWords(fragment);
    const nextWord = falseStartWords(text.slice(after, after + 64))[0];
    const restarts = fragmentWords.length > 0 && nextWord === fragmentWords[0];
    const optional = fragmentWords.length > 0
      && ((fragmentWords.length <= 3 && followedBySpaceOrEnd) || (restarts && fragmentWords.length <= 8));
    if (optional) {
      const before = text.slice(flushedUntil, fragmentStart);
      if (before.trim()) {
        chunks.push({ text: before, optional: false });
      }
      chunks.push({ text: fragment, optional: true });
      flushedUntil = after;
    }
    clauseStart = after;
  }
  const rest = text.slice(flushedUntil);
  if (rest.trim() || chunks.length === 0) {
    chunks.push({ text: rest, optional: false });
  }
  return chunks;
}

const UNIT_NUMBER_WORDS: Readonly<Record<string, number>> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS_NUMBER_WORDS: Readonly<Record<string, number>> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const SCALE_NUMBER_WORDS: Readonly<Record<string, number>> = {
  thousand: 1e3, million: 1e6, billion: 1e9, trillion: 1e12,
};
const ORDINAL_UNIT_WORDS: Readonly<Record<string, number>> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
  eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17,
  eighteenth: 18, nineteenth: 19,
};
const ORDINAL_TENS_WORDS: Readonly<Record<string, number>> = {
  twentieth: 20, thirtieth: 30, fortieth: 40, fiftieth: 50, sixtieth: 60, seventieth: 70, eightieth: 80, ninetieth: 90,
};
const ORDINAL_SCALE_WORDS: Readonly<Record<string, number>> = {
  hundredth: 100, thousandth: 1e3, millionth: 1e6, billionth: 1e9,
};

function hasWord(table: Readonly<Record<string, number>>, word: string | undefined): word is string {
  return word !== undefined && Object.hasOwn(table, word);
}

/** True for digit strings and spelled cardinal/ordinal number words (used to keep number words out of compound joins). */
export function isNumberToken(token: string): boolean {
  return /^\d/.test(token)
    || token === "hundred"
    || hasWord(UNIT_NUMBER_WORDS, token)
    || hasWord(TENS_NUMBER_WORDS, token)
    || hasWord(SCALE_NUMBER_WORDS, token)
    || hasWord(ORDINAL_UNIT_WORDS, token)
    || hasWord(ORDINAL_TENS_WORDS, token)
    || hasWord(ORDINAL_SCALE_WORDS, token);
}

/** Canonical ordinal token: the digits plus the English suffix (`3rd`, `21st`, `112th`). */
export function ordinalToken(value: number): string {
  const lastTwo = value % 100;
  const last = value % 10;
  const suffix = lastTwo >= 11 && lastTwo <= 13 ? "th" : last === 1 ? "st" : last === 2 ? "nd" : last === 3 ? "rd" : "th";
  return `${value}${suffix}`;
}

interface ParsedNumber {
  token: string;
  end: number;
  /** Cardinal value parsed from at least one number word (not digits alone); used by the year rule. */
  wordValue: number | null;
  /** The run was a single teen or tens word ("nineteen", "twenty"). */
  singleTwoDigitWord: boolean;
}

function decimalDigitsAt(tokens: string[], start: number): { digits: string; end: number } | null {
  if (/^\d+$/.test(tokens[start] ?? "")) {
    return { digits: tokens[start]!, end: start + 1 };
  }
  let digits = "";
  let index = start;
  while (index < tokens.length && hasWord(UNIT_NUMBER_WORDS, tokens[index]) && UNIT_NUMBER_WORDS[tokens[index]!]! <= 9) {
    digits += String(UNIT_NUMBER_WORDS[tokens[index]!]);
    index += 1;
  }
  return digits ? { digits, end: index } : null;
}

type NumberState = "none" | "digits" | "unit" | "teen" | "tens" | "hundred" | "scale";

/** Parses one spoken/written number starting at `start`, or returns null when no number starts there. */
function parseNumberAt(tokens: string[], start: number): ParsedNumber | null {
  let total = 0;
  let group = 0;
  let state: NumberState = "none";
  let index = start;
  let wordCount = 0;
  let decimalValue: number | null = null;
  const first = tokens[start] ?? "";

  const digitOrdinal = /^(\d+)(st|nd|rd|th)$/.exec(first);
  if (digitOrdinal) {
    return { token: ordinalToken(Number(digitOrdinal[1])), end: start + 1, wordValue: null, singleTwoDigitWord: false };
  }
  const digitDecimal = /^(\d+)point(\d+)$/.exec(first);
  if (/^\d+$/.test(first)) {
    group = Number(first);
    state = "digits";
    index += 1;
  } else if (digitDecimal) {
    decimalValue = Number(`${digitDecimal[1]}.${digitDecimal[2]}`);
    state = "digits";
    index += 1;
  }

  const finish = (token: string): ParsedNumber => ({
    token,
    end: index,
    wordValue: wordCount > 0 && decimalValue === null ? total + group : null,
    singleTwoDigitWord: wordCount === 1 && (state === "teen" || state === "tens") && index === start + 1,
  });

  while (index < tokens.length) {
    const token = tokens[index]!;
    const next = tokens[index + 1];
    if (token === "a" && state === "none" && (next === "hundred" || hasWord(SCALE_NUMBER_WORDS, next))) {
      group = 1;
      state = "unit";
      index += 1;
      wordCount += 1;
      continue;
    }
    if (token === "and" && (state === "hundred" || state === "scale")
      && (hasWord(UNIT_NUMBER_WORDS, next) || hasWord(TENS_NUMBER_WORDS, next) || hasWord(ORDINAL_UNIT_WORDS, next) || hasWord(ORDINAL_TENS_WORDS, next))) {
      index += 1;
      continue;
    }
    const unitAllowed = (value: number) =>
      state === "none" || state === "hundred" || state === "scale" || (state === "tens" && value >= 1 && value <= 9);
    if (decimalValue === null && hasWord(UNIT_NUMBER_WORDS, token)) {
      const value = UNIT_NUMBER_WORDS[token]!;
      if (!unitAllowed(value) || (value === 0 && state !== "none")) break;
      group += value;
      state = value >= 10 ? "teen" : "unit";
    } else if (decimalValue === null && hasWord(TENS_NUMBER_WORDS, token)) {
      if (state !== "none" && state !== "hundred" && state !== "scale") break;
      group += TENS_NUMBER_WORDS[token]!;
      state = "tens";
    } else if (decimalValue === null && token === "hundred") {
      if (!(state === "unit" || state === "teen" || state === "tens" || state === "digits") || group < 1 || group > 99) break;
      group *= 100;
      state = "hundred";
    } else if (hasWord(SCALE_NUMBER_WORDS, token)) {
      if (state === "none" || state === "scale") break;
      const scale = SCALE_NUMBER_WORDS[token]!;
      if (decimalValue !== null) {
        const scaled = decimalValue * scale;
        if (!Number.isInteger(scaled)) break;
        decimalValue = null;
        group = scaled;
        total += group;
        group = 0;
      } else {
        total += group * scale;
        group = 0;
      }
      state = "scale";
    } else if (decimalValue === null && hasWord(ORDINAL_UNIT_WORDS, token)) {
      const value = ORDINAL_UNIT_WORDS[token]!;
      if (!unitAllowed(value) || state === "digits") break;
      index += 1;
      wordCount += 1;
      return { ...finish(ordinalToken(total + group + value)), wordValue: null, singleTwoDigitWord: false };
    } else if (decimalValue === null && hasWord(ORDINAL_TENS_WORDS, token)) {
      if (state !== "none" && state !== "hundred" && state !== "scale") break;
      index += 1;
      wordCount += 1;
      return { ...finish(ordinalToken(total + group + ORDINAL_TENS_WORDS[token]!)), wordValue: null, singleTwoDigitWord: false };
    } else if (decimalValue === null && hasWord(ORDINAL_SCALE_WORDS, token)) {
      if (!(state === "unit" || state === "teen" || state === "tens" || state === "hundred" || state === "digits")) break;
      index += 1;
      wordCount += 1;
      const value = total + (group === 0 ? 1 : group) * ORDINAL_SCALE_WORDS[token]!;
      return { ...finish(ordinalToken(value)), wordValue: null, singleTwoDigitWord: false };
    } else if (decimalValue === null && token === "point" && state !== "none" && state !== "scale") {
      const decimal = decimalDigitsAt(tokens, index + 1);
      if (!decimal) break;
      index = decimal.end;
      wordCount += 1;
      const scaleWord = tokens[index];
      if (total === 0 && hasWord(SCALE_NUMBER_WORDS, scaleWord)) {
        const scaled = Number(`${group}.${decimal.digits}`) * SCALE_NUMBER_WORDS[scaleWord]!;
        if (Number.isInteger(scaled)) {
          index += 1;
          return { ...finish(String(scaled)), wordValue: null, singleTwoDigitWord: false };
        }
      }
      return { ...finish(`${total + group}point${decimal.digits}`), wordValue: null, singleTwoDigitWord: false };
    } else {
      break;
    }
    index += 1;
    wordCount += 1;
  }

  if (state === "none") {
    return null;
  }
  if (decimalValue !== null) {
    return { token: first, end: index, wordValue: null, singleTwoDigitWord: false };
  }
  if (wordCount === 0) {
    // Digits alone keep their original spelling (leading zeros, identifiers).
    return { token: first, end: index, wordValue: null, singleTwoDigitWord: false };
  }
  return finish(String(total + group));
}

/**
 * Number view, token level (one punctuation-delimited phrase at a time): spelled cardinals and compounds
 * ("twenty five", "one thousand two hundred and fifty", "a hundred", "5 million"), ordinals ("third", "twenty
 * first", "3rd" → `3rd`), and spoken decimals ("three point five" → `3point5`) become one canonical token.
 * Years: a lone "eighteen"/"nineteen"/"twenty" followed by a spelled 10–99 or "oh" + digit word is read as a year
 * ("nineteen ninety nine" → `1999`, "twenty twenty three" → `2023`, "twenty oh five" → `2005`).
 */
export function parseSpokenNumbers(tokens: string[]): string[] {
  const output: string[] = [];
  let index = 0;
  while (index < tokens.length) {
    const parsed = parseNumberAt(tokens, index);
    if (!parsed) {
      output.push(tokens[index]!);
      index += 1;
      continue;
    }
    const century = parsed.singleTwoDigitWord ? parsed.wordValue : null;
    if (century !== null && century >= 18 && century <= 20) {
      if (tokens[parsed.end] === "oh" && hasWord(UNIT_NUMBER_WORDS, tokens[parsed.end + 1])) {
        const digit = UNIT_NUMBER_WORDS[tokens[parsed.end + 1]!]!;
        if (digit >= 1 && digit <= 9) {
          output.push(String(century * 100 + digit));
          index = parsed.end + 2;
          continue;
        }
      }
      const following = parseNumberAt(tokens, parsed.end);
      if (following && following.wordValue !== null && following.wordValue >= 10 && following.wordValue <= 99) {
        output.push(String(century * 100 + following.wordValue));
        index = following.end;
        continue;
      }
    }
    output.push(parsed.token);
    index = parsed.end;
  }
  return output;
}

/** Orthographic view, token level: the documented equivalence table. Applied within one phrase. */
export const ORTHOGRAPHIC_UNIGRAMS: Readonly<Record<string, string>> = { ok: "okay" };
export const ORTHOGRAPHIC_BIGRAMS: ReadonlyArray<readonly [string, string, string]> = [
  ["all", "right", "alright"],
  ["o", "k", "okay"],
  ["can", "not", "cannot"],
  ["per", "cent", "percent"],
];

/**
 * Informal reductions expanded to their full two-word form on both sides, so "gonna" and "going to" score alike.
 * The expansion is symmetric: matching full forms still match, and only a form difference is forgiven. A reduced
 * form standing for a different full form ("gotta" for "got a", "wanna" for "want a") becomes the listed one.
 */
export const ORTHOGRAPHIC_REDUCTIONS: Readonly<Record<string, readonly [string, string]>> = {
  gonna: ["going", "to"],
  wanna: ["want", "to"],
  gotta: ["got", "to"],
  kinda: ["kind", "of"],
  sorta: ["sort", "of"],
};

/** Apostrophe-initial "'cause" (ASCII or curly, after quote normalization) is read as "because"; bare "cause" is unchanged. */
const APOSTROPHE_CAUSE_RE = /(?<![\p{L}\p{N}])’cause(?![\p{L}\p{N}’])/gu;

export function applyOrthographicEquivalences(tokens: string[]): string[] {
  const output: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    const bigram = ORTHOGRAPHIC_BIGRAMS.find(([left, right]) => left === token && right === tokens[index + 1]);
    if (bigram) {
      output.push(bigram[2]);
      index += 1;
      continue;
    }
    if (Object.hasOwn(ORTHOGRAPHIC_REDUCTIONS, token)) {
      output.push(...ORTHOGRAPHIC_REDUCTIONS[token]!);
      continue;
    }
    output.push(Object.hasOwn(ORTHOGRAPHIC_UNIGRAMS, token) ? ORTHOGRAPHIC_UNIGRAMS[token]! : token);
  }
  return output;
}

export interface ViewPhrases {
  /** Tokens grouped by punctuation-delimited phrase (phrases bound number parsing). */
  phrases: string[][];
  /** Joined forms of hyphenated compounds seen in this text (orthographic view). */
  hyphenCompounds: string[];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const BOUNDARY_ABBREVIATIONS: Array<[RegExp, string]> = [...ABBREVIATIONS].map(([abbr, expansion]) => [
  new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(abbr)}`, "gu"),
  expansion,
]);
const HYPHEN_CHAIN_RE = /(?<![\p{L}\p{N}])[\p{L}\p{N}]+(?:[-‐‑][\p{L}\p{N}]+)+(?![\p{L}\p{N}]|-)/gu;
const PHRASE_BOUNDARY = "\u0001";
const CURRENCY_NAMES: Readonly<Record<string, string>> = { $: "dollars", "£": "pounds", "€": "euros" };

/**
 * Text normalization shared by all views. With an empty view set this is exactly the legacy `normalizeText` +
 * tokenization (split into phrases). Orthographic view: hyphenated compounds are joined ("e-mail" → `email`;
 * chains containing a number stay split), ASCII apostrophes become ’ so contractions expand, and abbreviations
 * expand only at a word start (legacy `st.` also rewrote "first." / "just."). Number view: comma thousands are
 * joined, decimals become `XpointY`, and currency keeps a trailing scale word ("$5 million" → 5 million dollars).
 */
export function normalizeViewPhrases(text: string, views: ViewSet): ViewPhrases {
  const orthographic = views.has("orthographic-neutral");
  const numbers = views.has("number-neutral");
  const hyphenCompounds: string[] = [];
  let normalized = text.toLowerCase();
  if (orthographic) {
    normalized = normalized.replace(HYPHEN_CHAIN_RE, (chain) => {
      const parts = chain.split(/[-‐‑]/);
      if (parts.some(isNumberToken)) {
        return parts.join(" ");
      }
      const joined = parts.join("");
      hyphenCompounds.push(joined);
      return joined;
    });
  }
  for (const [pattern, replacement] of PUNCT_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }
  if (orthographic) {
    normalized = normalized.replace(/'/g, "’").replace(/(?<![\p{L}\p{N}])o\.\s?k\.?(?![\p{L}\p{N}])/gu, "okay")
      .replace(APOSTROPHE_CAUSE_RE, "because");
  }
  if (orthographic || numbers) {
    for (const [pattern, expansion] of BOUNDARY_ABBREVIATIONS) {
      normalized = normalized.replace(pattern, expansion);
    }
  } else {
    for (const [abbr, expansion] of ABBREVIATIONS) {
      normalized = normalized.replaceAll(abbr, expansion);
    }
  }
  if (numbers) {
    normalized = normalized
      .replace(/(\d),(?=\d{3}(?!\d))/g, "$1")
      .replace(/([$£€])(\d+(?:\.\d+)?)(?:\s+(thousand|million|billion|trillion)\b)?/g, (_match, symbol: string, amount: string, scale?: string) =>
        `${amount}${scale ? ` ${scale}` : ""} ${CURRENCY_NAMES[symbol]}`)
      .replace(/(\d)\.(?=\d)/g, "$1point");
  }
  for (const [pattern, replacement] of CURRENCY_PATTERNS) {
    normalized = normalized.replace(pattern, replacement);
  }
  for (const [contraction, expansion] of CONTRACTIONS) {
    normalized = normalized.replaceAll(contraction, expansion);
  }
  normalized = normalized.replace(/[.,;:!?]/g, ` ${PHRASE_BOUNDARY} `).replace(/[^\p{L}\p{N}\s\u0001]/gu, " ");
  const phrases = normalized
    .split(PHRASE_BOUNDARY)
    .map((phrase) => {
      let tokens: string[] = phrase.match(TOKEN_RE) ?? [];
      if (orthographic) tokens = applyOrthographicEquivalences(tokens);
      if (numbers) tokens = parseSpokenNumbers(tokens);
      return tokens;
    })
    .filter((tokens) => tokens.length > 0);
  return { phrases, hyphenCompounds };
}

export interface ViewToken {
  text: string;
  /** Zero-cost to drop or add (false-start fragments). */
  optional: boolean;
  /** Canonical speaker (reference label, or provider label mapped onto the reference). */
  speaker: string;
}

export interface CompoundVocabulary {
  /** Joined hyphenated compounds seen on either side; split forms of up to four parts merge into them. */
  hyphenated: ReadonlySet<string>;
  /** Every single token on either side; two-part splits with parts of three or more letters merge into them. */
  plain: ReadonlySet<string>;
}

/**
 * Orthographic view, cross-side: merges split compounds within one speaker turn when the joined form is a
 * hyphenated compound on either side ("follow up" ↔ "follow-up", any part length, up to four parts) or a plain
 * token on either side with both parts at least three characters ("web site" ↔ "website"; "in to"/"a way" are
 * never merged). Pure number sequences never merge.
 */
export function mergeSplitCompounds(tokens: ViewToken[], vocabulary: CompoundVocabulary): ViewToken[] {
  const output: ViewToken[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    let merged: ViewToken | null = null;
    for (let parts = 4; parts >= 2 && !merged; parts -= 1) {
      const window = tokens.slice(index, index + parts);
      if (window.length < parts || window.some((token) => token.speaker !== window[0]!.speaker)) continue;
      if (window.every((token) => isNumberToken(token.text))) continue;
      const joined = window.map((token) => token.text).join("");
      const plainEligible = parts === 2 && window.every((token) => token.text.length >= 3 && !isNumberToken(token.text));
      if (vocabulary.hyphenated.has(joined) || (plainEligible && vocabulary.plain.has(joined))) {
        merged = { text: joined, optional: window.every((token) => token.optional), speaker: window[0]!.speaker };
        index += parts - 1;
      }
    }
    output.push(merged ?? tokens[index]!);
  }
  return output;
}

/**
 * Disfluency view, token level: collapses immediately repeated 1–3-token n-grams within one speaker turn
 * ("I I think" → "I think", "you know you know" → "you know"). Legitimate repeats ("very very") collapse too;
 * because both sides are collapsed identically, matching repeats still match.
 */
export function collapseImmediateRepeats(tokens: ViewToken[], maxN = MAX_REPEAT_NGRAM): ViewToken[] {
  const output: ViewToken[] = [];
  for (const token of tokens) {
    output.push({ ...token });
    for (let n = 1; n <= maxN; n += 1) {
      if (output.length < n * 2) break;
      const start = output.length - n * 2;
      let repeated = true;
      for (let offset = 0; offset < n; offset += 1) {
        const left = output[start + offset]!;
        const right = output[start + n + offset]!;
        if (left.text !== right.text || left.speaker !== token.speaker || right.speaker !== token.speaker) {
          repeated = false;
          break;
        }
      }
      if (repeated) {
        const removed = output.splice(output.length - n, n);
        for (let offset = 0; offset < n; offset += 1) {
          const kept = output[start + offset]!;
          kept.optional = kept.optional && removed[offset]!.optional;
        }
        break;
      }
    }
  }
  return output;
}

function segmentViewTokens(
  segments: Segment[],
  views: ViewSet,
  speakerMap?: Record<string, string>,
): { tokens: ViewToken[]; hyphenCompounds: string[] } {
  const tokens: ViewToken[] = [];
  const hyphenCompounds: string[] = [];
  const disfluency = views.has("disfluency-neutral");
  for (const segment of segments) {
    const speaker = speakerMap?.[segment.speaker] ?? segment.speaker;
    const chunks = disfluency ? splitFalseStartFragments(segment.text) : [{ text: segment.text, optional: false }];
    for (const chunk of chunks) {
      const normalized = normalizeViewPhrases(chunk.text, views);
      hyphenCompounds.push(...normalized.hyphenCompounds);
      for (const phrase of normalized.phrases) {
        for (const text of phrase) {
          tokens.push({ text, optional: chunk.optional, speaker });
        }
      }
    }
  }
  return { tokens, hyphenCompounds };
}

export interface ViewTokenStreams {
  reference: ViewToken[];
  candidate: ViewToken[];
}

/**
 * Builds the reference and candidate token streams for a set of views, applying every view identically to both
 * sides. Legacy fillers are always removed (as in the legacy score); the disfluency view also removes the extra
 * filler spellings, marks false starts optional, and collapses immediate repeats.
 */
export function buildViewTokenStreams(
  referenceSegments: Segment[],
  candidateSegments: Segment[],
  views: ViewSet,
  speakerMap?: Record<string, string>,
): ViewTokenStreams {
  const reference = segmentViewTokens(referenceSegments, views);
  const candidate = segmentViewTokens(candidateSegments, views, speakerMap);
  let referenceTokens = reference.tokens;
  let candidateTokens = candidate.tokens;
  if (views.has("orthographic-neutral")) {
    const vocabulary: CompoundVocabulary = {
      hyphenated: new Set([...reference.hyphenCompounds, ...candidate.hyphenCompounds]),
      plain: new Set([...referenceTokens, ...candidateTokens].map((token) => token.text)),
    };
    referenceTokens = mergeSplitCompounds(referenceTokens, vocabulary);
    candidateTokens = mergeSplitCompounds(candidateTokens, vocabulary);
  }
  const disfluency = views.has("disfluency-neutral");
  const isFiller = (token: ViewToken) => FILLER_WORDS.has(token.text) || (disfluency && DISFLUENCY_EXTRA_FILLER_WORDS.has(token.text));
  referenceTokens = referenceTokens.filter((token) => !isFiller(token));
  candidateTokens = candidateTokens.filter((token) => !isFiller(token));
  if (disfluency) {
    referenceTokens = collapseImmediateRepeats(referenceTokens);
    candidateTokens = collapseImmediateRepeats(candidateTokens);
  }
  return { reference: referenceTokens, candidate: candidateTokens };
}

export const SPEAKER_TOKEN_PREFIX = "<speaker:";

/** Inserts a synthetic `<speaker:x>` token at every speaker change (required, never optional). */
export function withSpeakerTokens(tokens: ViewToken[]): ViewToken[] {
  const output: ViewToken[] = [];
  let previousSpeaker: string | null = null;
  for (const token of tokens) {
    if (token.speaker !== previousSpeaker) {
      output.push({ text: `${SPEAKER_TOKEN_PREFIX}${token.speaker}>`, optional: false, speaker: token.speaker });
      previousSpeaker = token.speaker;
    }
    output.push(token);
  }
  return output;
}

export interface ViewAlignment {
  reference: ViewToken[];
  candidate: ViewToken[];
  alignment: TokenAlignment;
  /** Non-optional reference tokens (the WER denominator). */
  referenceWordCount: number;
  wer: number;
}

function alignViewStreams(streams: ViewTokenStreams, includeSpeakers: boolean, includeSteps: boolean): ViewAlignment {
  const reference = includeSpeakers ? withSpeakerTokens(streams.reference) : streams.reference;
  const candidate = includeSpeakers ? withSpeakerTokens(streams.candidate) : streams.candidate;
  const alignment = alignTokens(
    reference.map((token) => token.text),
    candidate.map((token) => token.text),
    {
      referenceOptional: reference.map((token) => token.optional),
      candidateOptional: candidate.map((token) => token.optional),
      includeSteps,
    },
  );
  const referenceWordCount = reference.filter((token) => !token.optional).length;
  return {
    reference,
    candidate,
    alignment,
    referenceWordCount,
    wer: referenceWordCount === 0 ? 0 : alignment.distance / referenceWordCount,
  };
}

/** Speaker-aware or text-only WER under a view set (any subset of `NEUTRAL_VIEWS`). */
export function viewWerDetailed(
  referenceSegments: Segment[],
  candidateSegments: Segment[],
  includeSpeakers: boolean,
  speakerMap: Record<string, string> | undefined,
  views: ViewSet,
): WerDetailedResult {
  const result = alignViewStreams(buildViewTokenStreams(referenceSegments, candidateSegments, views, speakerMap), includeSpeakers, false);
  return {
    wer: result.wer,
    substitutions: result.alignment.substitutions,
    deletions: result.alignment.deletions,
    insertions: result.alignment.insertions,
    referenceWordCount: result.referenceWordCount,
  };
}

export interface ErrorAttribution {
  method: "cumulative-view-ablation-plus-aligned-token-inspection";
  /** Legacy speaker-aware edit count (no views). */
  strictEdits: number;
  /** Headline (all views) speaker-aware edit count. */
  neutralEdits: number;
  /** Edits removed as each view is enabled in order (disfluency, orthographic, number); negative means added. */
  forgivenByView: { disfluency: number; orthographic: number; numberFormat: number };
  /** Classification of the remaining headline edits by inspecting aligned tokens. */
  remaining: { speakerAttribution: number; numberFormat: number; otherLexical: number };
}

export interface WordSpeakerAttribution {
  /** Matched non-optional words in the neutral text-only alignment. */
  matchedWords: number;
  /** Matched words whose mapped provider speaker equals the reference speaker. */
  correctlyAttributedWords: number;
  accuracy: number | null;
}

export interface NeutralScoring {
  textOnly: WerDetailedResult;
  speakerAware: WerDetailedResult;
  attribution: ErrorAttribution;
  wordSpeakerAttribution: WordSpeakerAttribution;
}

function detailFromView(result: ViewAlignment): WerDetailedResult {
  return {
    wer: result.wer,
    substitutions: result.alignment.substitutions,
    deletions: result.alignment.deletions,
    insertions: result.alignment.insertions,
    referenceWordCount: result.referenceWordCount,
  };
}

function isSpeakerToken(token: ViewToken | undefined): boolean {
  return token?.text.startsWith(SPEAKER_TOKEN_PREFIX) ?? false;
}

/**
 * Headline scoring (scoring version 2): text-only and speaker-aware WER with all neutral views, plus error
 * attribution and word-level speaker attribution. `strictSpeakerAwareEdits` is the legacy speaker-aware edit count.
 */
export function scoreNeutralViews(
  referenceSegments: Segment[],
  candidateSegments: Segment[],
  speakerMap: Record<string, string>,
  strictSpeakerAwareEdits: number,
): NeutralScoring {
  const allViews: ViewSet = new Set(NEUTRAL_VIEWS);
  const headlineStreams = buildViewTokenStreams(referenceSegments, candidateSegments, allViews, speakerMap);
  const speakerAware = alignViewStreams(headlineStreams, true, true);
  const textOnly = alignViewStreams(headlineStreams, false, true);

  const cumulativeEdits: number[] = [strictSpeakerAwareEdits];
  for (let count = 1; count < NEUTRAL_VIEWS.length; count += 1) {
    const views: ViewSet = new Set(NEUTRAL_VIEWS.slice(0, count));
    const streams = buildViewTokenStreams(referenceSegments, candidateSegments, views, speakerMap);
    const reference = withSpeakerTokens(streams.reference);
    const candidate = withSpeakerTokens(streams.candidate);
    cumulativeEdits.push(alignmentCost(reference.map((token) => token.text), candidate.map((token) => token.text), {
      referenceOptional: reference.map((token) => token.optional),
      candidateOptional: candidate.map((token) => token.optional),
    }));
  }
  cumulativeEdits.push(speakerAware.alignment.distance);

  const remaining = { speakerAttribution: 0, numberFormat: 0, otherLexical: 0 };
  for (const step of speakerAware.alignment.steps ?? []) {
    if (step.cost === 0) continue;
    const referenceToken = step.referenceIndex >= 0 ? speakerAware.reference[step.referenceIndex] : undefined;
    const candidateToken = step.candidateIndex >= 0 ? speakerAware.candidate[step.candidateIndex] : undefined;
    if (isSpeakerToken(referenceToken) || isSpeakerToken(candidateToken)) {
      remaining.speakerAttribution += 1;
    } else if (step.op === "sub" && (/^\d/.test(referenceToken?.text ?? "") || /^\d/.test(candidateToken?.text ?? ""))) {
      remaining.numberFormat += 1;
    } else {
      remaining.otherLexical += 1;
    }
  }

  let matchedWords = 0;
  let correctlyAttributedWords = 0;
  for (const step of textOnly.alignment.steps ?? []) {
    if (step.op !== "match") continue;
    const referenceToken = textOnly.reference[step.referenceIndex]!;
    if (referenceToken.optional) continue;
    matchedWords += 1;
    if (textOnly.candidate[step.candidateIndex]!.speaker === referenceToken.speaker) {
      correctlyAttributedWords += 1;
    }
  }

  return {
    textOnly: detailFromView(textOnly),
    speakerAware: detailFromView(speakerAware),
    attribution: {
      method: "cumulative-view-ablation-plus-aligned-token-inspection",
      strictEdits: cumulativeEdits[0]!,
      neutralEdits: cumulativeEdits[3]!,
      forgivenByView: {
        disfluency: cumulativeEdits[0]! - cumulativeEdits[1]!,
        orthographic: cumulativeEdits[1]! - cumulativeEdits[2]!,
        numberFormat: cumulativeEdits[2]! - cumulativeEdits[3]!,
      },
      remaining,
    },
    wordSpeakerAttribution: {
      matchedWords,
      correctlyAttributedWords,
      accuracy: matchedWords === 0 ? null : correctlyAttributedWords / matchedWords,
    },
  };
}

/**
 * 2: neutral headline. 2.1: the orthographic view also expands informal reductions (gonna, wanna, gotta, kinda,
 * sorta, 'cause) on both sides, so scores of transcripts using those forms can rise slightly.
 */
export const SCORING_VERSION = 2.1;
export const REFERENCE_SOURCE_FILE = "reference-source.json";
export const SCORING_METHOD = {
  headline: "neutral-speaker-aware-wer",
  scoreFormula: "max(0, 100 * (1 - neutralSpeakerAwareWER))",
  views: ["disfluency-neutral", "orthographic-neutral", "number-neutral"],
  legacyMetric: "speaker-aware-wer (scoring version 1): legacy normalization plus filler removal; retained as legacyScore/legacySpeakerAwareWER/legacyTextOnlyWER",
  description: [
    "Scoring version 2 changes the headline: score, speakerAwareWER, textOnlyWER, and their breakdowns now use the neutral views; scoring-version-1 values are retained as legacyScore, legacySpeakerAwareWER, legacyTextOnlyWER, legacySpeakerAwareBreakdown, and legacyTextOnlyBreakdown.",
    "Every view is applied identically to the reference and the provider transcript before alignment.",
    "Disfluency-neutral: fillers (um, uh, hmm, mhm, ah, er, plus umm, uhm, uhh, hm, hmmm, mm, mmm, erm, ahh) are removed; immediately repeated 1-3-word n-grams within one speaker turn collapse to one copy; false-start fragments ending in a dash attached to the last word (at most three words followed by a space, or a fragment the next word restarts) become optional tokens that cost nothing to omit or include.",
    "Orthographic-neutral: hyphenated compounds are joined (e-mail = email) and split forms of a compound seen on either side merge into it; two-word splits merge into a single word seen on either side only when both parts have at least three letters; ok/O.K. = okay, all right = alright, can not = cannot, per cent = percent; informal reductions expand on both sides (scoring version 2.1: gonna = going to, wanna = want to, gotta = got to, kinda = kind of, sorta = sort of, apostrophe-initial 'cause = because; because both sides are expanded identically, only form differences are forgiven); ASCII apostrophes expand contractions like curly ones; abbreviations expand only at a word start.",
    "Number-neutral: spelled cardinals, compounds, ordinals, decimals, scale words, comma thousands, percent, and currency share one digit form (twenty-five = 25, one thousand two hundred fifty = 1,250 = 1250, third = 3rd, three point five = 3.5, $5 million = five million dollars); spoken years with an eighteen/nineteen/twenty prefix (nineteen ninety nine = 1999, twenty twenty three = 2023) are read as years; plural/singular currency and decades are not normalized.",
    "Error attribution enables the views cumulatively (disfluency, orthographic, number) on speaker-aware edit counts and reports the edits each step removed; remaining headline edits are classified by the aligned tokens as speaker attribution (a speaker-change token is involved), number/format (a substitution with a digit token), or other lexical. Attribution is order-dependent and a view can occasionally add edits (negative values).",
    "Speaker metrics compare distinct provider speaker labels with reference speakers and report word attribution accuracy: the share of matched words in the neutral text-only alignment whose overlap-mapped provider speaker equals the reference speaker.",
    "Alignment is an exact minimum-edit alignment with a checkpointed traceback, so substitution/deletion/insertion counts are exact for transcripts of any length.",
  ],
} as const;

export interface ReferenceSourceRecord {
  schemaVersion: 1;
  path: string;
  sha256: string;
}

/**
 * Resolves the gold reference: an explicit path wins, then the run's own consensus-transcription.txt, then a
 * reference-source.json pointer (repo-relative path + sha256, verified before use).
 */
export function resolveReferenceTranscript(
  runDir: string,
  explicitPath: string | null,
): { referencePath: string; referenceSource: ReferenceSourceRecord | null } {
  if (explicitPath) {
    return { referencePath: explicitPath, referenceSource: null };
  }
  const localPath = resolve(runDir, "consensus-transcription.txt");
  const sourcePath = resolve(runDir, REFERENCE_SOURCE_FILE);
  if (existsSync(localPath) || !existsSync(sourcePath)) {
    return { referencePath: localPath, referenceSource: null };
  }
  const parsed = JSON.parse(readFileSync(sourcePath, "utf8")) as Record<string, unknown>;
  if (parsed["schemaVersion"] !== 1 || typeof parsed["path"] !== "string" || typeof parsed["sha256"] !== "string" || !/^[0-9a-f]{64}$/i.test(parsed["sha256"])) {
    throw new Error(`${sourcePath} must be { "schemaVersion": 1, "path": "<repo-relative path>", "sha256": "<64 hex chars>" }`);
  }
  const referencePath = resolveRepoRelativePath(parsed["path"]);
  if (!existsSync(referencePath)) {
    throw new Error(`${sourcePath} points to a missing reference: ${parsed["path"]}`);
  }
  const actual = new Bun.CryptoHasher("sha256").update(readFileSync(referencePath)).digest("hex");
  if (actual !== parsed["sha256"].toLowerCase()) {
    throw new Error(`${sourcePath} sha256 mismatch for ${parsed["path"]}: expected ${parsed["sha256"].toLowerCase()}, found ${actual}`);
  }
  return { referencePath, referenceSource: { schemaVersion: 1, path: parsed["path"], sha256: actual } };
}
