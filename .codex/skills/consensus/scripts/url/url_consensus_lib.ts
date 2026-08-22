#!/usr/bin/env bun

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { loadCanonicalRunRecord } from "../shared/pipeline_manifest";
import type { PipelineProviderState } from "../shared/pipeline_manifest";

export interface UrlProviderRun {
  directoryName: string;
  provider: string;
  model: string;
  providerKey: string;
  resultPath: string;
  extractionPath: string | null;
  text: string;
  plainText: string;
  tokenEstimate: number | null;
  processingTimeMs: number | null;
  actualCostCents: number | null;
  sourceUrl: string | null;
  finalUrl: string | null;
  title: string | null;
}

interface UrlProviderResult {
  text?: string;
  pages?: Array<{
    text?: string;
  }>;
}

interface UrlProviderMetadata {
  tokenEstimate?: number;
  processingTime?: number;
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

export interface UrlManifestRecord {
  providers: PipelineProviderState[];
  metadata: {
    step1?: {
      title?: string;
      slug?: string;
      format?: string;
      fileSize?: number;
    };
    source?: {
      url?: string;
      filePath?: string;
    };
    web?: {
      sourceUrl?: string;
      finalUrl?: string;
      title?: string;
    };
    cost?: {
      actual?: { steps?: RunStepCostEntry[] };
    };
    timing?: {
      actual?: { steps?: RunStepTimingEntry[] };
    };
  };
}

const LOCAL_PROVIDERS = new Set(["defuddle"]);
const TOKEN_RE = /[a-z0-9]+(?:[''][a-z0-9]+)?/gi;

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function isLocalUrlProvider(provider: string): boolean {
  return LOCAL_PROVIDERS.has(provider);
}

export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}[-*+]\s+/gm, "")
    .replace(/^\s{0,3}\d+[.)]\s+/gm, "")
    .replace(/[*_~>#|]/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function normalizeText(text: string): string {
  return markdownToPlainText(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'/-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(text: string): string[] {
  return normalizeText(text).match(TOKEN_RE) ?? [];
}

export interface EditBreakdown {
  distance: number;
  substitutions: number;
  deletions: number;
  insertions: number;
}

export const LONG_SEQUENCE_DISTANCE_METHOD = "bounded-wavefront-content-anchors-v2";
export const LONG_SEQUENCE_DISTANCE_NOTE = "WER and CER use exact Levenshtein distance through 10,000 normalized elements; longer sequences trim common edges, use bounded exact wavefront alignment, then order-preserving token or content anchors with exact gap scoring and conservative edit lower bounds.";

const PRIMARY_WAVEFRONT_DISTANCE_LIMIT = 256;
const EXTENDED_WAVEFRONT_DISTANCE_LIMIT = 2_048;
const CONTENT_ANCHOR_GRAM_SIZE = 16;
const EXACT_ANCHOR_GAP_CELL_LIMIT = 1_000_000;

function boundedWavefrontLevenshteinDistance(
  left: string[],
  right: string[],
  maxDistance: number,
): number | null {
  if (Math.abs(left.length - right.length) > maxDistance) return null;

  const unreachable = -1;
  const offset = maxDistance + 1;
  const size = (maxDistance * 2) + 3;
  let previous = new Int32Array(size);
  let current = new Int32Array(size);
  previous.fill(unreachable);

  let initialX = 0;
  while (initialX < left.length && initialX < right.length && left[initialX] === right[initialX]) {
    initialX += 1;
  }
  if (initialX === left.length && initialX === right.length) return 0;
  previous[offset] = initialX;

  for (let score = 1; score <= maxDistance; score += 1) {
    current.fill(unreachable);
    for (let diagonal = -score; diagonal <= score; diagonal += 1) {
      let furthestX = unreachable;

      const substitutionX = previous[offset + diagonal]!;
      if (substitutionX >= 0) {
        const substitutionY = substitutionX - diagonal;
        if (substitutionX < left.length && substitutionY >= 0 && substitutionY < right.length) {
          furthestX = substitutionX + 1;
        }
      }

      const deletionX = previous[offset + diagonal - 1]!;
      if (deletionX >= 0 && deletionX < left.length) {
        furthestX = Math.max(furthestX, deletionX + 1);
      }

      const insertionX = previous[offset + diagonal + 1]!;
      if (insertionX >= 0) {
        const insertionY = insertionX - (diagonal + 1);
        if (insertionY >= 0 && insertionY < right.length) {
          furthestX = Math.max(furthestX, insertionX);
        }
      }

      if (furthestX < 0) continue;
      let furthestY = furthestX - diagonal;
      if (furthestY < 0 || furthestY > right.length) continue;
      while (
        furthestX < left.length
        && furthestY < right.length
        && left[furthestX] === right[furthestY]
      ) {
        furthestX += 1;
        furthestY += 1;
      }
      current[offset + diagonal] = furthestX;
      if (furthestX === left.length && furthestY === right.length) return score;
    }
    [previous, current] = [current, previous];
  }
  return null;
}

function tokenCountDistanceLowerBound(left: string[], right: string[]): number {
  const countDifferences = new Map<string, number>();
  for (const value of left) {
    countDifferences.set(value, (countDifferences.get(value) ?? 0) + 1);
  }
  for (const value of right) {
    countDifferences.set(value, (countDifferences.get(value) ?? 0) - 1);
  }

  let leftSurplus = 0;
  let rightSurplus = 0;
  for (const difference of countDifferences.values()) {
    if (difference > 0) leftSurplus += difference;
    if (difference < 0) rightSurplus -= difference;
  }
  return Math.max(leftSurplus, rightSurplus);
}

function subsequenceDistance(left: string[], right: string[]): number | null {
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  let shorterIndex = 0;
  for (const value of longer) {
    if (value === shorter[shorterIndex]) shorterIndex += 1;
    if (shorterIndex === shorter.length) return longer.length - shorter.length;
  }
  return null;
}

interface SequenceAnchor {
  leftIndex: number;
  rightIndex: number;
}

function longestIncreasingAnchorSubsequence(candidates: SequenceAnchor[]): SequenceAnchor[] {
  const tails: number[] = [];
  const previous = new Array<number>(candidates.length).fill(-1);
  for (let index = 0; index < candidates.length; index += 1) {
    const rightIndex = candidates[index]!.rightIndex;
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (candidates[tails[middle]!]!.rightIndex < rightIndex) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }
    if (low > 0) previous[index] = tails[low - 1]!;
    tails[low] = index;
  }

  const orderedAnchors: SequenceAnchor[] = [];
  let cursor = tails.at(-1) ?? -1;
  while (cursor >= 0) {
    orderedAnchors.push(candidates[cursor]!);
    cursor = previous[cursor]!;
  }
  orderedAnchors.reverse();
  return orderedAnchors;
}

function patienceAnchorDistance(left: string[], right: string[]): number | null {
  const leftOccurrences = new Map<string, { count: number; index: number }>();
  const rightOccurrences = new Map<string, { count: number; index: number }>();
  for (let index = 0; index < left.length; index += 1) {
    const value = left[index]!;
    const occurrence = leftOccurrences.get(value);
    leftOccurrences.set(value, occurrence
      ? { count: occurrence.count + 1, index: occurrence.index }
      : { count: 1, index });
  }
  for (let index = 0; index < right.length; index += 1) {
    const value = right[index]!;
    const occurrence = rightOccurrences.get(value);
    rightOccurrences.set(value, occurrence
      ? { count: occurrence.count + 1, index: occurrence.index }
      : { count: 1, index });
  }

  const candidates: SequenceAnchor[] = [];
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const value = left[leftIndex]!;
    const leftOccurrence = leftOccurrences.get(value);
    const rightOccurrence = rightOccurrences.get(value);
    if (leftOccurrence?.count === 1 && rightOccurrence?.count === 1) {
      candidates.push({ leftIndex, rightIndex: rightOccurrence.index });
    }
  }
  if (candidates.length === 0) return null;

  const orderedAnchors = longestIncreasingAnchorSubsequence(candidates);

  const coverage = orderedAnchors.length / Math.min(left.length, right.length);
  if (coverage < 0.2) return null;

  let distance = 0;
  let leftCursor = 0;
  let rightCursor = 0;
  for (const anchor of orderedAnchors) {
    const gapDistance = exactAnchorGapDistance(
      left.slice(leftCursor, anchor.leftIndex),
      right.slice(rightCursor, anchor.rightIndex),
    );
    distance += gapDistance ?? Math.max(
      anchor.leftIndex - leftCursor,
      anchor.rightIndex - rightCursor,
    );
    leftCursor = anchor.leftIndex + 1;
    rightCursor = anchor.rightIndex + 1;
  }
  const tailDistance = exactAnchorGapDistance(left.slice(leftCursor), right.slice(rightCursor));
  return distance + (tailDistance ?? Math.max(
    left.length - leftCursor,
    right.length - rightCursor,
  ));
}

interface GramOccurrence {
  count: number;
  index: number;
}

function tokenHash(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function rollingGramOccurrences(
  sequence: string[],
  gramSize: number,
  tokenHashes: Map<string, number>,
): Map<number, GramOccurrence> {
  const occurrences = new Map<number, GramOccurrence>();
  if (sequence.length < gramSize) return occurrences;

  const hashes = sequence.map((value) => {
    const existing = tokenHashes.get(value);
    if (existing !== undefined) return existing;
    const hash = tokenHash(value);
    tokenHashes.set(value, hash);
    return hash;
  });
  const base = 1_000_003;
  let leadingPower = 1;
  for (let index = 1; index < gramSize; index += 1) {
    leadingPower = Math.imul(leadingPower, base);
  }
  let hash = 0;
  for (let index = 0; index < gramSize; index += 1) {
    hash = (Math.imul(hash, base) + hashes[index]!) >>> 0;
  }

  const recordOccurrence = (index: number): void => {
    const occurrence = occurrences.get(hash);
    occurrences.set(hash, occurrence
      ? { count: occurrence.count + 1, index: occurrence.index }
      : { count: 1, index });
  };
  recordOccurrence(0);
  for (let index = gramSize; index < hashes.length; index += 1) {
    const outgoing = Math.imul(hashes[index - gramSize]!, leadingPower);
    hash = (Math.imul((hash - outgoing) >>> 0, base) + hashes[index]!) >>> 0;
    recordOccurrence(index - gramSize + 1);
  }
  return occurrences;
}

function equalGramAt(
  left: string[],
  right: string[],
  leftIndex: number,
  rightIndex: number,
  gramSize: number,
): boolean {
  for (let offset = 0; offset < gramSize; offset += 1) {
    if (left[leftIndex + offset] !== right[rightIndex + offset]) return false;
  }
  return true;
}

function exactAnchorGapDistance(left: string[], right: string[]): number | null {
  if (left.length === 0 || right.length === 0) return Math.max(left.length, right.length);
  const subsequence = subsequenceDistance(left, right);
  if (subsequence !== null) return subsequence;
  if (left.length * right.length <= EXACT_ANCHOR_GAP_CELL_LIMIT) {
    return levenshteinDistance(left, right);
  }
  return boundedWavefrontLevenshteinDistance(left, right, EXTENDED_WAVEFRONT_DISTANCE_LIMIT);
}

function contentAnchorDistance(left: string[], right: string[]): number | null {
  if (Math.min(left.length, right.length) < CONTENT_ANCHOR_GRAM_SIZE) return null;
  const tokenHashes = new Map<string, number>();
  const leftOccurrences = rollingGramOccurrences(left, CONTENT_ANCHOR_GRAM_SIZE, tokenHashes);
  const rightOccurrences = rollingGramOccurrences(right, CONTENT_ANCHOR_GRAM_SIZE, tokenHashes);
  const candidates: SequenceAnchor[] = [];
  for (const [hash, leftOccurrence] of leftOccurrences) {
    const rightOccurrence = rightOccurrences.get(hash);
    if (
      leftOccurrence.count === 1
      && rightOccurrence?.count === 1
      && equalGramAt(
        left,
        right,
        leftOccurrence.index,
        rightOccurrence.index,
        CONTENT_ANCHOR_GRAM_SIZE,
      )
    ) {
      candidates.push({
        leftIndex: leftOccurrence.index,
        rightIndex: rightOccurrence.index,
      });
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((leftAnchor, rightAnchor) => leftAnchor.leftIndex - rightAnchor.leftIndex);

  const nonOverlappingAnchors: SequenceAnchor[] = [];
  for (const anchor of longestIncreasingAnchorSubsequence(candidates)) {
    const previous = nonOverlappingAnchors.at(-1);
    if (
      !previous
      || (
        anchor.leftIndex >= previous.leftIndex + CONTENT_ANCHOR_GRAM_SIZE
        && anchor.rightIndex >= previous.rightIndex + CONTENT_ANCHOR_GRAM_SIZE
      )
    ) {
      nonOverlappingAnchors.push(anchor);
    }
  }
  const coverage = (nonOverlappingAnchors.length * CONTENT_ANCHOR_GRAM_SIZE)
    / Math.min(left.length, right.length);
  if (coverage < 0.2) return null;

  let distance = 0;
  let leftCursor = 0;
  let rightCursor = 0;
  for (const anchor of nonOverlappingAnchors) {
    const gapDistance = exactAnchorGapDistance(
      left.slice(leftCursor, anchor.leftIndex),
      right.slice(rightCursor, anchor.rightIndex),
    );
    if (gapDistance === null) return null;
    distance += gapDistance;
    leftCursor = anchor.leftIndex + CONTENT_ANCHOR_GRAM_SIZE;
    rightCursor = anchor.rightIndex + CONTENT_ANCHOR_GRAM_SIZE;
  }
  const tailDistance = exactAnchorGapDistance(left.slice(leftCursor), right.slice(rightCursor));
  return tailDistance === null ? null : distance + tailDistance;
}

function symmetricAnchorDistance(
  estimate: (left: string[], right: string[]) => number | null,
  left: string[],
  right: string[],
): number | null {
  const estimates = [estimate(left, right), estimate(right, left)]
    .filter((value): value is number => value !== null);
  return estimates.length === 0 ? null : Math.min(...estimates);
}

function approximateLongSequenceDistance(left: string[], right: string[]): number {
  let prefix = 0;
  while (prefix < left.length && prefix < right.length && left[prefix] === right[prefix]) {
    prefix += 1;
  }

  let leftEnd = left.length;
  let rightEnd = right.length;
  while (leftEnd > prefix && rightEnd > prefix && left[leftEnd - 1] === right[rightEnd - 1]) {
    leftEnd -= 1;
    rightEnd -= 1;
  }

  const leftMiddle = left.slice(prefix, leftEnd);
  const rightMiddle = right.slice(prefix, rightEnd);
  if (leftMiddle.length === 0 || rightMiddle.length === 0) {
    return Math.max(leftMiddle.length, rightMiddle.length);
  }

  const subsequence = subsequenceDistance(leftMiddle, rightMiddle);
  if (subsequence !== null) return subsequence;

  const lengthDifference = Math.abs(leftMiddle.length - rightMiddle.length);
  const primaryExact = boundedWavefrontLevenshteinDistance(
    leftMiddle,
    rightMiddle,
    PRIMARY_WAVEFRONT_DISTANCE_LIMIT,
  );
  if (primaryExact !== null) return primaryExact;

  const extendedExact = boundedWavefrontLevenshteinDistance(
    leftMiddle,
    rightMiddle,
    EXTENDED_WAVEFRONT_DISTANCE_LIMIT,
  );
  if (extendedExact !== null) return extendedExact;

  const sharedLength = Math.min(leftMiddle.length, rightMiddle.length);
  let positionalMismatches = 0;
  for (let index = 0; index < sharedLength; index += 1) {
    positionalMismatches += Number(leftMiddle[index] !== rightMiddle[index]);
  }
  const positionalEstimate = lengthDifference + positionalMismatches;
  const anchorEstimate = symmetricAnchorDistance(
    patienceAnchorDistance,
    leftMiddle,
    rightMiddle,
  );
  if (anchorEstimate !== null) {
    return Math.max(lengthDifference, Math.min(positionalEstimate, anchorEstimate));
  }

  const contentAnchorEstimate = symmetricAnchorDistance(
    contentAnchorDistance,
    leftMiddle,
    rightMiddle,
  );
  if (contentAnchorEstimate !== null) return contentAnchorEstimate;

  const minimumDistance = Math.max(
    EXTENDED_WAVEFRONT_DISTANCE_LIMIT + 1,
    tokenCountDistanceLowerBound(leftMiddle, rightMiddle),
  );
  return leftMiddle.length === rightMiddle.length
    ? Math.max(minimumDistance, positionalEstimate)
    : minimumDistance;
}

export function levenshteinDistance(left: string[], right: string[]): number {
  if (left.length === 0) return right.length;
  if (right.length === 0) return left.length;
  if (left.length < right.length) return levenshteinDistance(right, left);

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

export function levenshteinBreakdown(reference: string[], candidate: string[]): EditBreakdown {
  const n = reference.length;
  const m = candidate.length;
  if (n === 0) return { distance: m, substitutions: 0, deletions: 0, insertions: m };
  if (m === 0) return { distance: n, substitutions: 0, deletions: n, insertions: 0 };
  if (n > 10_000 || m > 10_000) {
    return {
      distance: approximateLongSequenceDistance(reference, candidate),
      substitutions: -1,
      deletions: -1,
      insertions: -1,
    };
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  const ops: Array<Array<"none" | "sub" | "del" | "ins" | "match">> = Array.from(
    { length: n + 1 },
    () => new Array<"none" | "sub" | "del" | "ins" | "match">(m + 1).fill("none"),
  );

  for (let i = 0; i <= n; i += 1) {
    dp[i]![0] = i;
    if (i > 0) ops[i]![0] = "del";
  }
  for (let j = 0; j <= m; j += 1) {
    dp[0]![j] = j;
    if (j > 0) ops[0]![j] = "ins";
  }

  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const matchCost = reference[i - 1] === candidate[j - 1] ? 0 : 1;
      const candidates = [
        { value: dp[i - 1]![j - 1]! + matchCost, op: matchCost === 0 ? "match" as const : "sub" as const },
        { value: dp[i - 1]![j]! + 1, op: "del" as const },
        { value: dp[i]![j - 1]! + 1, op: "ins" as const },
      ].sort((left, right) => left.value - right.value);
      dp[i]![j] = candidates[0]?.value ?? 0;
      ops[i]![j] = candidates[0]?.op ?? "none";
    }
  }

  let substitutions = 0;
  let deletions = 0;
  let insertions = 0;
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const op = ops[i]?.[j] ?? "none";
    if (op === "match") {
      i -= 1;
      j -= 1;
    } else if (op === "sub") {
      substitutions += 1;
      i -= 1;
      j -= 1;
    } else if (op === "del") {
      deletions += 1;
      i -= 1;
    } else if (op === "ins") {
      insertions += 1;
      j -= 1;
    } else {
      break;
    }
  }

  return { distance: dp[n]?.[m] ?? 0, substitutions, deletions, insertions };
}

export function wordErrorRateDetailed(referenceText: string, candidateText: string): EditBreakdown & { rate: number; referenceCount: number } {
  const reference = tokenize(referenceText);
  const candidate = tokenize(candidateText);
  const breakdown = levenshteinBreakdown(reference, candidate);
  return {
    ...breakdown,
    referenceCount: reference.length,
    rate: reference.length === 0 ? (candidate.length === 0 ? 0 : 1) : breakdown.distance / reference.length,
  };
}

export function characterErrorRateDetailed(referenceText: string, candidateText: string): EditBreakdown & { rate: number; referenceCount: number } {
  const reference = Array.from(normalizeText(referenceText).replace(/\s+/g, ""));
  const candidate = Array.from(normalizeText(candidateText).replace(/\s+/g, ""));
  const breakdown = levenshteinBreakdown(reference, candidate);
  return {
    ...breakdown,
    referenceCount: reference.length,
    rate: reference.length === 0 ? (candidate.length === 0 ? 0 : 1) : breakdown.distance / reference.length,
  };
}

export function contentTokenCoverage(referenceText: string, candidateText: string): number {
  const referenceTokens = Array.from(new Set(tokenize(referenceText).filter((token) => token.length > 2)));
  if (referenceTokens.length === 0) return 1;
  const candidateTokens = new Set(tokenize(candidateText));
  const hits = referenceTokens.filter((token) => candidateTokens.has(token)).length;
  return hits / referenceTokens.length;
}

export function selectBaselineProvider(runs: UrlProviderRun[]): UrlProviderRun {
  if (runs.length === 0) {
    throw new Error("No provider result.json files found under providers/");
  }
  return runs
    .slice()
    .sort((left, right) => tokenize(right.text).length - tokenize(left.text).length || left.providerKey.localeCompare(right.providerKey))[0] as UrlProviderRun;
}

function getProviderText(result: UrlProviderResult): string {
  if (typeof result.text === "string" && result.text.trim().length > 0) {
    return result.text;
  }
  const pageText = result.pages
    ?.map((page) => page.text ?? "")
    .filter((text) => text.trim().length > 0)
    .join("\n\n");
  return pageText ?? "";
}

function findManifestProviderState(manifestRecord: UrlManifestRecord, directoryName: string): PipelineProviderState | null {
  return manifestRecord.providers.find((state) => basename(state.artifactDir) === directoryName) ?? null;
}

function findActualCost(manifestRecord: UrlManifestRecord, provider: string, model: string): number | null {
  const step = manifestRecord.metadata.cost?.actual?.steps?.find((entry) => entry.provider === provider && entry.model === model);
  return typeof step?.cost === "number" ? step.cost : null;
}

function findActualTiming(manifestRecord: UrlManifestRecord, provider: string, model: string): number | null {
  const step = manifestRecord.metadata.timing?.actual?.steps?.find((entry) => entry.provider === provider && entry.model === model);
  return typeof step?.processingTimeMs === "number" ? step.processingTimeMs : null;
}

export function loadUrlProviderRuns(runDir: string): UrlProviderRun[] {
  const providersDir = join(runDir, "providers");
  if (!existsSync(providersDir)) {
    throw new Error(`Provider directory not found: ${providersDir}`);
  }

  const canonicalRecord = loadCanonicalRunRecord(runDir, "extract", "article");
  const manifestRecord: UrlManifestRecord = {
    providers: canonicalRecord.item.providers,
    metadata: canonicalRecord.metadata as UrlManifestRecord["metadata"],
  };
  const directories = readdirSync(providersDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  return directories.flatMap((directoryName) => {
    const resultPath = join(providersDir, directoryName, "result.json");
    if (!existsSync(resultPath)) return [];

    const state = findManifestProviderState(manifestRecord, directoryName);
    if (!state || state.status !== "succeeded") return [];
    const provider = state.service;
    const model = typeof state.model === "string" ? state.model : provider;
    const metadata = state.metadata as UrlProviderMetadata;
    const result = readJson<UrlProviderResult>(resultPath);

    const text = getProviderText(result).trim();
    const extractionPath = join(providersDir, directoryName, "extraction.txt");
    const sourceUrl = manifestRecord.metadata.web?.sourceUrl ?? manifestRecord.metadata.source?.url ?? null;
    const finalUrl = manifestRecord.metadata.web?.finalUrl ?? null;
    const title = manifestRecord.metadata.web?.title ?? manifestRecord.metadata.step1?.title ?? null;

    return [{
      directoryName,
      provider,
      model,
      providerKey: model === provider ? provider : `${provider}/${model}`,
      resultPath,
      extractionPath: existsSync(extractionPath) ? extractionPath : null,
      text,
      plainText: markdownToPlainText(text),
      tokenEstimate: typeof metadata.tokenEstimate === "number" ? metadata.tokenEstimate : null,
      processingTimeMs: findActualTiming(manifestRecord, provider, model)
        ?? (typeof metadata.processingTime === "number" ? metadata.processingTime : null),
      actualCostCents: findActualCost(manifestRecord, provider, model),
      sourceUrl,
      finalUrl,
      title,
    }];
  });
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "n/a";
  return `${(value * 100).toFixed(2)}%`;
}

export function formatCents(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return `${value.toFixed(4)}c`;
}

export function formatSeconds(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return `${(value / 1000).toFixed(2)}s`;
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
