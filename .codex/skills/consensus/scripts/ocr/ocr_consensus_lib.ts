#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { loadCanonicalRunRecord } from "../shared/pipeline_manifest";
import type { PipelineProviderState } from "../shared/pipeline_manifest";

export interface OcrPage {
  pageNumber: number;
  method: string;
  text: string;
}

export interface OcrProviderRun {
  directoryName: string;
  provider: string;
  model: string;
  providerKey: string;
  resultPath: string;
  extractionPath: string | null;
  pages: OcrPage[];
  text: string;
  tokenEstimate: number | null;
  processingTimeMs: number | null;
  actualCostCents: number | null;
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

export interface OcrManifestRecord {
  providers: PipelineProviderState[];
  metadata: {
    step1?: {
      title?: string;
      slug?: string;
      pageCount?: number;
      format?: string;
      fileSize?: number;
    };
    step2?: Array<{
      extractionMethod?: string;
      totalPages?: number;
      ocrPages?: number;
      textPages?: number;
      processingTime?: number;
      tokenEstimate?: number;
      ocrService?: string;
      ocrModel?: string;
    }>;
    cost?: {
      estimated?: { steps?: RunStepCostEntry[] };
      actual?: { steps?: RunStepCostEntry[] };
    };
    timing?: {
      estimated?: { steps?: RunStepTimingEntry[] };
      actual?: { steps?: RunStepTimingEntry[] };
    };
  };
}

interface OcrProviderResult {
  text?: string;
  pages?: Array<{
    pageNumber?: number;
    method?: string;
    text?: string;
  }>;
  totalPages?: number;
}

interface OcrProviderMetadata {
  tokenEstimate?: number;
  processingTime?: number;
}

const TOKEN_RE = /[a-z0-9]+(?:[''][a-z0-9]+)?/gi;
const PUNCT_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\u2018/g, "'"],
  [/\u2019/g, "'"],
  [/\u201c/g, '"'],
  [/\u201d/g, '"'],
  [/\u2013/g, "-"],
  [/\u2014/g, "-"],
  [/\u2026/g, "..."],
];

const CONTRACTIONS = new Map<string, string>([
  ["i'm", "i am"],
  ["i've", "i have"],
  ["i'll", "i will"],
  ["i'd", "i would"],
  ["you're", "you are"],
  ["you've", "you have"],
  ["you'll", "you will"],
  ["you'd", "you would"],
  ["he's", "he is"],
  ["she's", "she is"],
  ["it's", "it is"],
  ["we're", "we are"],
  ["we've", "we have"],
  ["we'll", "we will"],
  ["we'd", "we would"],
  ["they're", "they are"],
  ["they've", "they have"],
  ["they'll", "they will"],
  ["they'd", "they would"],
  ["that's", "that is"],
  ["who's", "who is"],
  ["what's", "what is"],
  ["there's", "there is"],
  ["here's", "here is"],
  ["where's", "where is"],
  ["how's", "how is"],
  ["can't", "cannot"],
  ["won't", "will not"],
  ["don't", "do not"],
  ["doesn't", "does not"],
  ["didn't", "did not"],
  ["isn't", "is not"],
  ["aren't", "are not"],
  ["wasn't", "was not"],
  ["weren't", "were not"],
  ["haven't", "have not"],
  ["hasn't", "has not"],
  ["hadn't", "had not"],
  ["couldn't", "could not"],
  ["wouldn't", "would not"],
  ["shouldn't", "should not"],
  ["let's", "let us"],
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

const LOCAL_SERVICES = new Set(["tesseract"]);

const PAGE_DELIMITER_RE = /^---\s*Page\s+(\d+)\s*---$/;
const LARGE_EDIT_SEQUENCE_THRESHOLD = 10_000;
const OCR_PAGE_ANALYSIS_THRESHOLDS = {
  majorLengthDrift: 0.3,
  highDisagreementFloor: 0.18,
  highDisagreementIqrMultiplier: 1.5,
  werCerDivergence: 0.16,
  lowConfidence: 0.72,
  repeatedDominantLineShare: 0.5,
  repeatedDominantLineMinimum: 4,
  repeatedTokenWindowSize: 8,
  repeatedTokenWindowMinimum: 6,
  repeatedTokenWindowShare: 0.35,
} as const;

export type OcrMetricProviderGroup = "local" | "thirdPartyService";

export interface OcrPageArtifactFlags {
  blankOutput: boolean;
  repeatedText: boolean;
  majorLengthDrift: boolean;
  werCerDivergence: boolean;
}

export interface OcrPageProviderMetric {
  providerKey: string;
  provider: string;
  model: string;
  directoryName: string;
  group: OcrMetricProviderGroup;
  tokenCount: number;
  charCount: number;
  lengthDrift: number;
  charLengthDrift: number;
  wer: number;
  cer: number;
  meanPairwiseWer: number;
  meanPairwiseCer: number;
  substitutions: number;
  deletions: number;
  insertions: number;
  referenceWords: number;
  artifactFlags: OcrPageArtifactFlags;
  disagreement: number;
  confidence: number;
}

export interface OcrPageMetric {
  pageNumber: number;
  medianTokenCount: number;
  medianCharCount: number;
  pageDisagreement: number;
  selectedProviderKey: string | null;
  selectedDirectoryName: string | null;
  selectedConfidence: number | null;
  selectedLowConfidence: boolean;
  providers: OcrPageProviderMetric[];
}

export interface OcrPageAnalysisThresholds {
  majorLengthDrift: number;
  highDisagreementFloor: number;
  highDisagreementIqrMultiplier: number;
  werCerDivergence: number;
  lowConfidence: number;
  repeatedDominantLineShare: number;
  repeatedDominantLineMinimum: number;
  repeatedTokenWindowSize: number;
  repeatedTokenWindowMinimum: number;
  repeatedTokenWindowShare: number;
  highDisagreement: number;
  pageDisagreementQ1: number;
  pageDisagreementQ3: number;
}

export interface OcrPageMetricsArtifact {
  schemaVersion: 1;
  runDir: string;
  generatedAt: string;
  providerCount: number;
  pageCount: number;
  methodology: {
    successfulProvidersOnly: true;
    providerSelection: string;
    confidenceFormula: string;
    disagreementFormula: string;
    wordBreakdownMethod: string;
    cerMethod: string;
  };
  thresholds: OcrPageAnalysisThresholds;
  providers: Array<{
    providerKey: string;
    directoryName: string;
    group: OcrMetricProviderGroup;
    resultPath: string;
  }>;
  pages: OcrPageMetric[];
}

export interface OcrOutliersArtifact {
  schemaVersion: 1;
  runDir: string;
  thresholds: OcrPageAnalysisThresholds;
  blankOutputPages: Array<{ pageNumber: number; providers: string[] }>;
  repeatedTextPages: Array<{ pageNumber: number; providers: string[] }>;
  majorLengthDriftPages: Array<{
    pageNumber: number;
    providers: Array<{ providerKey: string; lengthDrift: number; tokenCount: number }>;
  }>;
  highDisagreementPages: Array<{
    pageNumber: number;
    pageDisagreement: number;
    selectedProviderKey: string | null;
    selectedConfidence: number | null;
  }>;
  werCerDivergencePages: Array<{
    pageNumber: number;
    providers: Array<{ providerKey: string; wer: number; cer: number }>;
  }>;
  lowConfidencePages: Array<{
    pageNumber: number;
    selectedProviderKey: string | null;
    selectedConfidence: number | null;
    pageDisagreement: number;
  }>;
}

export interface OcrSelectiveAdjudicationArtifact {
  schemaVersion: 1;
  pageCount: number;
  pages: Array<{
    pageNumber: number;
    reason: string[];
    replacedProviderKey: string | null;
    replacedConfidence: number | null;
  }>;
}

export interface OcrVariantDistance {
  referenceVariantId: string;
  candidateVariantId: string;
  wer: number;
  cer: number;
  wordDistance: number;
  wordReferenceCount: number;
  charDistance: number;
  charReferenceCount: number;
}

export interface OcrVariantComparisonSummary {
  schemaVersion: 1;
  runDir: string;
  generatedAt: string;
  pageAligned: boolean;
  variants: Array<{
    variantId: string;
    source: string;
    charCount: number;
    wordCount: number;
    pageCount: number;
    selectedPageSourceCounts?: Record<string, number>;
    lowConfidencePageCount?: number;
    outlierPageCount?: number;
  }>;
  pairwiseDistances: OcrVariantDistance[];
}

export interface OcrPageAnalysisArtifacts {
  pageMetrics: OcrPageMetricsArtifact;
  outliers: OcrOutliersArtifact;
  selectiveAdjudicationPages: OcrSelectiveAdjudicationArtifact;
  variantComparisonSummary: OcrVariantComparisonSummary;
  benchmarkSummaryMarkdown: string;
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

export function tokenize(text: string): string[] {
  return normalizeText(text).match(TOKEN_RE) ?? [];
}

export interface WerBreakdown {
  distance: number;
  substitutions: number;
  deletions: number;
  insertions: number;
}

function gitDiffBreakdown(reference: string[], candidate: string[]): WerBreakdown {
  if (reference.length === 0) {
    return { distance: candidate.length, substitutions: 0, deletions: 0, insertions: candidate.length };
  }
  if (candidate.length === 0) {
    return { distance: reference.length, substitutions: 0, deletions: reference.length, insertions: 0 };
  }

  const tmpDir = mkdtempSync(join(tmpdir(), "ocr-edit-distance-"));
  const referencePath = join(tmpDir, "reference.txt");
  const candidatePath = join(tmpDir, "candidate.txt");

  try {
    writeFileSync(referencePath, `${reference.join("\n")}\n`);
    writeFileSync(candidatePath, `${candidate.join("\n")}\n`);

    const diff = spawnSync(
      "git",
      ["diff", "--no-index", "--no-renames", "--unified=0", "--", referencePath, candidatePath],
      { encoding: "utf8", maxBuffer: 1024 * 1024 * 64 },
    );

    if (diff.status === 0) {
      return { distance: 0, substitutions: 0, deletions: 0, insertions: 0 };
    }
    if (diff.status !== 1) {
      throw new Error((diff.stderr || diff.stdout || "git diff failed").trim());
    }

    let substitutions = 0;
    let deletions = 0;
    let insertions = 0;
    let hunkDeletions = 0;
    let hunkInsertions = 0;

    function flushHunk() {
      substitutions += Math.min(hunkDeletions, hunkInsertions);
      deletions += Math.max(0, hunkDeletions - hunkInsertions);
      insertions += Math.max(0, hunkInsertions - hunkDeletions);
      hunkDeletions = 0;
      hunkInsertions = 0;
    }

    for (const line of diff.stdout.split(/\r?\n/)) {
      if (line.startsWith("@@")) {
        flushHunk();
        continue;
      }
      if (line.startsWith("---") || line.startsWith("+++") || line.startsWith("diff ") || line.startsWith("index ")) {
        continue;
      }
      if (line.startsWith("-")) {
        hunkDeletions += 1;
      } else if (line.startsWith("+")) {
        hunkInsertions += 1;
      }
    }
    flushHunk();

    return {
      distance: substitutions + deletions + insertions,
      substitutions,
      deletions,
      insertions,
    };
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

export function levenshteinDistance(left: string[], right: string[]): number {
  if (left.length === 0) {
    return right.length;
  }
  if (right.length === 0) {
    return left.length;
  }
  if (left.length > LARGE_EDIT_SEQUENCE_THRESHOLD || right.length > LARGE_EDIT_SEQUENCE_THRESHOLD) {
    return gitDiffBreakdown(left, right).distance;
  }
  if (left.length < right.length) {
    return levenshteinDistance(right, left);
  }
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const current = [leftIndex + 1];
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const insertion = current[rightIndex] + 1;
      const deletion = previous[rightIndex + 1] + 1;
      const substitution = previous[rightIndex] + Number(left[leftIndex] !== right[rightIndex]);
      current.push(Math.min(insertion, deletion, substitution));
    }
    previous = current;
  }
  return previous.at(-1) ?? 0;
}

export function levenshteinBreakdown(reference: string[], candidate: string[]): WerBreakdown {
  const n = reference.length;
  const m = candidate.length;

  if (n === 0) {
    return { distance: m, substitutions: 0, deletions: 0, insertions: m };
  }
  if (m === 0) {
    return { distance: n, substitutions: 0, deletions: n, insertions: 0 };
  }
  if (n > LARGE_EDIT_SEQUENCE_THRESHOLD || m > LARGE_EDIT_SEQUENCE_THRESHOLD) {
    return gitDiffBreakdown(reference, candidate);
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  const ops: Array<Array<"none" | "sub" | "del" | "ins" | "match">> = Array.from(
    { length: n + 1 },
    () => new Array<"none" | "sub" | "del" | "ins" | "match">(m + 1).fill("none"),
  );

  for (let i = 0; i <= n; i++) {
    dp[i][0] = i;
    if (i > 0) ops[i][0] = "del";
  }
  for (let j = 0; j <= m; j++) {
    dp[0][j] = j;
    if (j > 0) ops[0][j] = "ins";
  }

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (reference[i - 1] === candidate[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
        ops[i][j] = "match";
      } else {
        const sub = dp[i - 1][j - 1];
        const del = dp[i - 1][j];
        const ins = dp[i][j - 1];
        const min = Math.min(sub, del, ins);
        dp[i][j] = min + 1;
        if (min === sub) ops[i][j] = "sub";
        else if (min === del) ops[i][j] = "del";
        else ops[i][j] = "ins";
      }
    }
  }

  let substitutions = 0;
  let deletions = 0;
  let insertions = 0;
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const op = ops[i][j];
    if (op === "match") {
      i--;
      j--;
    } else if (op === "sub") {
      substitutions++;
      i--;
      j--;
    } else if (op === "del") {
      deletions++;
      i--;
    } else {
      insertions++;
      j--;
    }
  }

  return { distance: dp[n][m], substitutions, deletions, insertions };
}

export function charLevenshteinDistance(left: string, right: string): number {
  const leftChars = [...left];
  const rightChars = [...right];
  if (leftChars.length === 0) {
    return rightChars.length;
  }
  if (rightChars.length === 0) {
    return leftChars.length;
  }
  if (leftChars.length < rightChars.length) {
    return charLevenshteinDistance(right, left);
  }
  let previous = Array.from({ length: rightChars.length + 1 }, (_, index) => index);
  for (let leftIndex = 0; leftIndex < leftChars.length; leftIndex += 1) {
    const current = [leftIndex + 1];
    for (let rightIndex = 0; rightIndex < rightChars.length; rightIndex += 1) {
      const insertion = current[rightIndex] + 1;
      const deletion = previous[rightIndex + 1] + 1;
      const substitution = previous[rightIndex] + Number(leftChars[leftIndex] !== rightChars[rightIndex]);
      current.push(Math.min(insertion, deletion, substitution));
    }
    previous = current;
  }
  return previous.at(-1) ?? 0;
}

export function charLevenshteinBreakdown(left: string, right: string): WerBreakdown {
  const leftChars = [...left];
  const rightChars = [...right];
  return levenshteinBreakdown(leftChars, rightChars);
}

export function wordErrorRate(reference: string, candidate: string): number {
  const referenceTokens = tokenize(reference);
  const candidateTokens = tokenize(candidate);
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
  referenceCount: number;
}

export function wordErrorRateDetailed(reference: string, candidate: string): WerDetailedResult {
  const referenceTokens = tokenize(reference);
  const candidateTokens = tokenize(candidate);
  const referenceCount = referenceTokens.length;
  if (referenceCount === 0) {
    return { wer: 0, substitutions: 0, deletions: 0, insertions: 0, referenceCount: 0 };
  }
  const breakdown = levenshteinBreakdown(referenceTokens, candidateTokens);
  return {
    wer: breakdown.distance / referenceCount,
    substitutions: breakdown.substitutions,
    deletions: breakdown.deletions,
    insertions: breakdown.insertions,
    referenceCount,
  };
}

export function characterErrorRate(reference: string, candidate: string): number {
  const normalizedRef = normalizeText(reference);
  const normalizedCand = normalizeText(candidate);
  if (normalizedRef.length === 0) {
    return 0;
  }
  return charLevenshteinDistance(normalizedRef, normalizedCand) / normalizedRef.length;
}

export function characterErrorRateDetailed(reference: string, candidate: string): WerDetailedResult {
  const normalizedRef = normalizeText(reference);
  const normalizedCand = normalizeText(candidate);
  const referenceCount = normalizedRef.length;
  if (referenceCount === 0) {
    return { wer: 0, substitutions: 0, deletions: 0, insertions: 0, referenceCount: 0 };
  }
  const breakdown = charLevenshteinBreakdown(normalizedRef, normalizedCand);
  return {
    wer: breakdown.distance / referenceCount,
    substitutions: breakdown.substitutions,
    deletions: breakdown.deletions,
    insertions: breakdown.insertions,
    referenceCount,
  };
}

export function textSimilarity(textA: string, textB: string): number {
  return Math.max(0, Math.min(1, 1 - wordErrorRate(textA, textB)));
}

export function isLocalOcrService(service: string): boolean {
  return LOCAL_SERVICES.has(service);
}

export function makeProviderKey(provider: string, model: string): string {
  return `${provider}/${model}`;
}

function makeProviderLookupKey(provider: string, model: string): string {
  return `${provider}::${model}`;
}

export function buildCostLookup(manifestRecord: OcrManifestRecord): Map<string, number> {
  const lookup = new Map<string, number>();
  const actualSteps = manifestRecord.metadata.cost?.actual?.steps ?? [];
  for (const step of actualSteps) {
    if (step.provider && step.model && step.cost !== undefined) {
      lookup.set(makeProviderLookupKey(step.provider, step.model), Number(step.cost));
    }
  }
  if (lookup.size > 0) {
    return lookup;
  }
  const estimatedSteps = manifestRecord.metadata.cost?.estimated?.steps ?? [];
  for (const step of estimatedSteps) {
    if (step.provider && step.model && step.cost !== undefined) {
      lookup.set(makeProviderLookupKey(step.provider, step.model), Number(step.cost));
    }
  }
  return lookup;
}

export function buildTimingLookup(manifestRecord: OcrManifestRecord): Map<string, number> {
  const lookup = new Map<string, number>();
  const actualSteps = manifestRecord.metadata.timing?.actual?.steps ?? [];
  for (const step of actualSteps) {
    if (step.provider && step.model && step.processingTimeMs !== undefined) {
      lookup.set(makeProviderLookupKey(step.provider, step.model), Number(step.processingTimeMs));
    }
  }
  if (lookup.size > 0) {
    return lookup;
  }
  const estimatedSteps = manifestRecord.metadata.timing?.estimated?.steps ?? [];
  for (const step of estimatedSteps) {
    if (step.provider && step.model && step.processingTimeMs !== undefined) {
      lookup.set(makeProviderLookupKey(step.provider, step.model), Number(step.processingTimeMs));
    }
  }
  return lookup;
}

export function loadOcrManifestRecord(runDir: string): OcrManifestRecord {
  const record = loadCanonicalRunRecord(runDir, "extract", "document");
  const metadata = record.metadata;
  const step2 = metadata.step2;
  const hasInlineProviderResult = record.item.providers.some((provider) =>
    provider.status === "succeeded" && provider.result !== undefined,
  );
  if ((!Array.isArray(step2) || step2.length === 0) && !hasInlineProviderResult) {
    throw new Error("Canonical OCR manifest item metadata.step2 is missing or empty");
  }
  return {
    providers: record.item.providers,
    metadata: metadata as OcrManifestRecord["metadata"],
  };
}

function isFinitePageNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isContiguousPageNumberSequence(pageNumbers: number[], start: number): boolean {
  if (pageNumbers.length === 0) {
    return false;
  }
  const sorted = [...pageNumbers].sort((left, right) => left - right);
  return sorted.every((pageNumber, index) => pageNumber === start + index);
}

function normalizeProviderPages(pages: NonNullable<OcrProviderPayload["result"]["pages"]> = []): OcrPage[] {
  const pageNumbers = pages.map((page) => page.pageNumber).filter(isFinitePageNumber);
  const shiftZeroBasedPages =
    pageNumbers.length === pages.length &&
    isContiguousPageNumberSequence(pageNumbers, 0);

  return pages.map((page, index) => {
    const rawPageNumber = isFinitePageNumber(page.pageNumber) ? page.pageNumber : index + 1;
    return {
      pageNumber: shiftZeroBasedPages ? rawPageNumber + 1 : rawPageNumber,
      method: String(page.method ?? "ocr"),
      text: String(page.text ?? "").trim(),
    };
  });
}

export function loadOcrProviderRuns(runDir: string): { providers: OcrProviderRun[]; warnings: string[] } {
  const manifestRecord = loadOcrManifestRecord(runDir);
  const costLookup = buildCostLookup(manifestRecord);
  const timingLookup = buildTimingLookup(manifestRecord);
  const warnings: string[] = [];

  const providerStates = manifestRecord.providers;
  const expectedDirs = new Set(
    providerStates
      .map((state) => state.artifactDir)
      .filter((artifactDir): artifactDir is string => Boolean(artifactDir))
      .map((artifactDir) => basename(artifactDir)),
  );

  const providersDir = join(runDir, "providers");
  if (!existsSync(providersDir)) {
    const providers = providerStates.flatMap((state) => {
      if (state.status !== "succeeded" || !state.result || typeof state.model !== "string") {
        return [];
      }
      const metadata = state.metadata as OcrProviderMetadata;
      const result = state.result as OcrProviderResult;
      const pages = normalizeProviderPages(result.pages);
      const lookupKey = makeProviderLookupKey(state.service, state.model);
      const extractionPath = join(runDir, "extraction.txt");
      const pageText = pages.map((page) => page.text).join("\n\n").trim();
      return [{
        directoryName: basename(runDir),
        provider: state.service,
        model: state.model,
        providerKey: makeProviderKey(state.service, state.model),
        resultPath: join(runDir, "manifest.json"),
        extractionPath: existsSync(extractionPath) ? extractionPath : null,
        pages,
        text: pageText || String(result.text ?? "").trim(),
        tokenEstimate: metadata.tokenEstimate ?? null,
        processingTimeMs: timingLookup.get(lookupKey) ?? (metadata.processingTime !== undefined ? Number(metadata.processingTime) : null),
        actualCostCents: costLookup.get(lookupKey) ?? null,
      } satisfies OcrProviderRun];
    });
    return { providers, warnings };
  }

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
    if (!state || state.status !== "succeeded") {
      return [];
    }
    const provider = state.service;
    const model = state.model;
    if (typeof model !== "string") {
      throw new Error(`${resultPath} has no model identity in manifest.json`);
    }
    const metadata = state.metadata as OcrProviderMetadata;
    const result = JSON.parse(readFileSync(resultPath, "utf8")) as OcrProviderResult;

    const pages = normalizeProviderPages(result.pages);

    const extractionPath = join(dirname(resultPath), "extraction.txt");
    const lookupKey = makeProviderLookupKey(provider, model);

    const pageText = pages.map((page) => page.text).join("\n\n").trim();

    return [{
      directoryName,
      provider,
      model,
      providerKey: makeProviderKey(provider, model),
      resultPath,
      extractionPath: existsSync(extractionPath) ? extractionPath : null,
      pages,
      text: pageText || String(result.text ?? "").trim(),
      tokenEstimate: metadata.tokenEstimate ?? null,
      processingTimeMs:
        timingLookup.get(lookupKey) ??
        (metadata.processingTime !== undefined ? Number(metadata.processingTime) : null),
      actualCostCents: costLookup.get(lookupKey) ?? null,
    } satisfies OcrProviderRun];
  });

  return { providers, warnings };
}

export function meanPairwiseTextSimilarity(providers: OcrProviderRun[]): Record<string, number> {
  if (providers.length === 1) {
    return { [providers[0].directoryName]: 1 };
  }

  const scores = new Map<string, number[]>(
    providers.map((provider) => [provider.directoryName, []]),
  );

  for (let leftIndex = 0; leftIndex < providers.length; leftIndex += 1) {
    const left = providers[leftIndex];
    for (const right of providers.slice(leftIndex + 1)) {
      const similarity = textSimilarity(left.text, right.text);
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
  providers: OcrProviderRun[],
): { baseline: OcrProviderRun; agreement: Record<string, number> } {
  const agreement = meanPairwiseTextSimilarity(providers);
  const ranked = [...providers].sort((left, right) => {
    const leftScore = agreement[left.directoryName] ?? 0;
    const rightScore = agreement[right.directoryName] ?? 0;
    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }
    const leftPages = left.pages.length;
    const rightPages = right.pages.length;
    if (leftPages !== rightPages) {
      return rightPages - leftPages;
    }
    const leftTokens = tokenize(left.text).length;
    const rightTokens = tokenize(right.text).length;
    if (leftTokens !== rightTokens) {
      return rightTokens - leftTokens;
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

function roundMetric(value: number): number {
  return Number(value.toFixed(6));
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[midpoint] ?? 0;
  }
  return ((sorted[midpoint - 1] ?? 0) + (sorted[midpoint] ?? 0)) / 2;
}

function quantile(values: number[], q: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) {
    return sorted[lower] ?? 0;
  }
  const weight = position - lower;
  return (sorted[lower] ?? 0) * (1 - weight) + (sorted[upper] ?? 0) * weight;
}

function proportionalDrift(value: number, baseline: number): number {
  if (baseline === 0) {
    return value === 0 ? 0 : 1;
  }
  return Math.abs(value - baseline) / baseline;
}

function ocrMetricGroupForProvider(provider: OcrProviderRun): OcrMetricProviderGroup {
  return isLocalOcrService(provider.provider) ? "local" : "thirdPartyService";
}

function pageTextForProvider(provider: OcrProviderRun, pageNumber: number): string {
  return provider.pages.find((page) => page.pageNumber === pageNumber)?.text ?? "";
}

function hasRepeatedText(text: string): boolean {
  const lines = text
    .split(/\r?\n/)
    .map((line) => normalizeText(line))
    .filter((line) => line.length > 0);
  if (lines.length >= OCR_PAGE_ANALYSIS_THRESHOLDS.repeatedDominantLineMinimum) {
    const lineCounts = new Map<string, number>();
    for (const line of lines) {
      lineCounts.set(line, (lineCounts.get(line) ?? 0) + 1);
    }
    const dominantCount = Math.max(0, ...lineCounts.values());
    if (
      dominantCount >= OCR_PAGE_ANALYSIS_THRESHOLDS.repeatedDominantLineMinimum &&
      dominantCount / lines.length >= OCR_PAGE_ANALYSIS_THRESHOLDS.repeatedDominantLineShare
    ) {
      return true;
    }
  }

  const tokens = tokenize(text);
  const windowSize = OCR_PAGE_ANALYSIS_THRESHOLDS.repeatedTokenWindowSize;
  if (tokens.length < windowSize * OCR_PAGE_ANALYSIS_THRESHOLDS.repeatedTokenWindowMinimum) {
    return false;
  }

  const windowCounts = new Map<string, number>();
  for (let index = 0; index <= tokens.length - windowSize; index += 1) {
    const key = tokens.slice(index, index + windowSize).join(" ");
    windowCounts.set(key, (windowCounts.get(key) ?? 0) + 1);
  }
  const dominantWindowCount = Math.max(0, ...windowCounts.values());
  return (
    dominantWindowCount >= OCR_PAGE_ANALYSIS_THRESHOLDS.repeatedTokenWindowMinimum &&
    (dominantWindowCount * windowSize) / tokens.length >= OCR_PAGE_ANALYSIS_THRESHOLDS.repeatedTokenWindowShare
  );
}

function artifactPenalty(flags: OcrPageArtifactFlags): number {
  return (
    (flags.blankOutput ? 0.55 : 0) +
    (flags.repeatedText ? 0.25 : 0) +
    (flags.majorLengthDrift ? 0.2 : 0) +
    (flags.werCerDivergence ? 0.1 : 0)
  );
}

function pageProviderMetric(
  provider: OcrProviderRun,
  pageNumber: number,
  text: string,
  pageEntries: Array<{ provider: OcrProviderRun; text: string }>,
  medianTokenCount: number,
  medianCharCount: number,
): OcrPageProviderMetric {
  const tokenCount = tokenize(text).length;
  const charCount = text.length;
  const lengthDrift = proportionalDrift(tokenCount, medianTokenCount);
  const charLengthDrift = proportionalDrift(charCount, medianCharCount);
  const otherEntries = pageEntries.filter((entry) => entry.provider.providerKey !== provider.providerKey);

  let werTotal = 0;
  let cerTotal = 0;
  let substitutions = 0;
  let deletions = 0;
  let insertions = 0;
  let referenceWords = 0;

  for (const other of otherEntries) {
    const werBreakdown = wordErrorRateDetailed(other.text, text);
    const cerBreakdown = characterErrorRateDetailed(other.text, text);
    werTotal += werBreakdown.wer;
    cerTotal += cerBreakdown.wer;
    substitutions += werBreakdown.substitutions;
    deletions += werBreakdown.deletions;
    insertions += werBreakdown.insertions;
    referenceWords += werBreakdown.referenceCount;
  }

  const comparisonCount = Math.max(1, otherEntries.length);
  const meanPairwiseWer = werTotal / comparisonCount;
  const meanPairwiseCer = cerTotal / comparisonCount;
  const flags: OcrPageArtifactFlags = {
    blankOutput: normalizeText(text).length === 0,
    repeatedText: hasRepeatedText(text),
    majorLengthDrift: lengthDrift >= OCR_PAGE_ANALYSIS_THRESHOLDS.majorLengthDrift,
    werCerDivergence: Math.abs(meanPairwiseWer - meanPairwiseCer) >= OCR_PAGE_ANALYSIS_THRESHOLDS.werCerDivergence,
  };
  const disagreement = 0.65 * meanPairwiseWer + 0.35 * meanPairwiseCer;
  const confidence = clamp(1 - (disagreement * 1.35 + lengthDrift * 0.35 + artifactPenalty(flags)));

  return {
    providerKey: provider.providerKey,
    provider: provider.provider,
    model: provider.model,
    directoryName: provider.directoryName,
    group: ocrMetricGroupForProvider(provider),
    tokenCount,
    charCount,
    lengthDrift: roundMetric(lengthDrift),
    charLengthDrift: roundMetric(charLengthDrift),
    wer: roundMetric(meanPairwiseWer),
    cer: roundMetric(meanPairwiseCer),
    meanPairwiseWer: roundMetric(meanPairwiseWer),
    meanPairwiseCer: roundMetric(meanPairwiseCer),
    substitutions,
    deletions,
    insertions,
    referenceWords,
    artifactFlags: flags,
    disagreement: roundMetric(disagreement),
    confidence: roundMetric(confidence),
  };
}

function buildPageMetric(pageNumber: number, providers: OcrProviderRun[]): OcrPageMetric {
  const pageEntries = providers.map((provider) => ({
    provider,
    text: pageTextForProvider(provider, pageNumber),
  }));
  const tokenCounts = pageEntries.map((entry) => tokenize(entry.text).length);
  const charCounts = pageEntries.map((entry) => entry.text.length);
  const medianTokenCount = median(tokenCounts);
  const medianCharCount = median(charCounts);
  const providerMetrics = pageEntries.map((entry) =>
    pageProviderMetric(entry.provider, pageNumber, entry.text, pageEntries, medianTokenCount, medianCharCount)
  );
  const selectedProvider = [...providerMetrics].sort((left, right) => {
    if (left.confidence !== right.confidence) {
      return right.confidence - left.confidence;
    }
    if (left.meanPairwiseWer !== right.meanPairwiseWer) {
      return left.meanPairwiseWer - right.meanPairwiseWer;
    }
    if (left.meanPairwiseCer !== right.meanPairwiseCer) {
      return left.meanPairwiseCer - right.meanPairwiseCer;
    }
    if (left.lengthDrift !== right.lengthDrift) {
      return left.lengthDrift - right.lengthDrift;
    }
    if (left.charLengthDrift !== right.charLengthDrift) {
      return left.charLengthDrift - right.charLengthDrift;
    }
    return left.providerKey.localeCompare(right.providerKey);
  })[0] ?? null;
  const pageDisagreement = providerMetrics.length > 0
    ? providerMetrics.reduce((sum, provider) => sum + provider.disagreement, 0) / providerMetrics.length
    : 0;

  return {
    pageNumber,
    medianTokenCount: roundMetric(medianTokenCount),
    medianCharCount: roundMetric(medianCharCount),
    pageDisagreement: roundMetric(pageDisagreement),
    selectedProviderKey: selectedProvider?.providerKey ?? null,
    selectedDirectoryName: selectedProvider?.directoryName ?? null,
    selectedConfidence: selectedProvider?.confidence ?? null,
    selectedLowConfidence:
      selectedProvider !== null && selectedProvider.confidence < OCR_PAGE_ANALYSIS_THRESHOLDS.lowConfidence,
    providers: providerMetrics,
  };
}

function pageHasArtifactOutlier(page: OcrPageMetric): boolean {
  return page.providers.some((provider) =>
    provider.artifactFlags.blankOutput ||
    provider.artifactFlags.repeatedText ||
    provider.artifactFlags.majorLengthDrift ||
    provider.artifactFlags.werCerDivergence
  );
}

function selectedPageSourceCounts(pages: OcrPageMetric[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const page of pages) {
    if (page.selectedProviderKey) {
      counts.set(page.selectedProviderKey, (counts.get(page.selectedProviderKey) ?? 0) + 1);
    }
  }
  return Object.fromEntries([...counts.entries()].sort((left, right) => left[0].localeCompare(right[0])));
}

function buildThresholds(pages: OcrPageMetric[]): OcrPageAnalysisThresholds {
  const disagreementValues = pages.map((page) => page.pageDisagreement);
  const pageDisagreementQ1 = roundMetric(quantile(disagreementValues, 0.25));
  const pageDisagreementQ3 = roundMetric(quantile(disagreementValues, 0.75));
  const iqr = pageDisagreementQ3 - pageDisagreementQ1;
  const highDisagreement = Math.max(
    OCR_PAGE_ANALYSIS_THRESHOLDS.highDisagreementFloor,
    pageDisagreementQ3 + OCR_PAGE_ANALYSIS_THRESHOLDS.highDisagreementIqrMultiplier * iqr,
  );

  return {
    ...OCR_PAGE_ANALYSIS_THRESHOLDS,
    highDisagreement: roundMetric(highDisagreement),
    pageDisagreementQ1,
    pageDisagreementQ3,
  };
}

function buildOutliers(
  runDir: string,
  thresholds: OcrPageAnalysisThresholds,
  pages: OcrPageMetric[],
): OcrOutliersArtifact {
  const providersWithFlag = (page: OcrPageMetric, flag: keyof OcrPageArtifactFlags): string[] =>
    page.providers.filter((provider) => provider.artifactFlags[flag]).map((provider) => provider.providerKey);

  return {
    schemaVersion: 1,
    runDir,
    thresholds,
    blankOutputPages: pages
      .map((page) => ({ pageNumber: page.pageNumber, providers: providersWithFlag(page, "blankOutput") }))
      .filter((page) => page.providers.length > 0),
    repeatedTextPages: pages
      .map((page) => ({ pageNumber: page.pageNumber, providers: providersWithFlag(page, "repeatedText") }))
      .filter((page) => page.providers.length > 0),
    majorLengthDriftPages: pages
      .map((page) => ({
        pageNumber: page.pageNumber,
        providers: page.providers
          .filter((provider) => provider.artifactFlags.majorLengthDrift)
          .map((provider) => ({
            providerKey: provider.providerKey,
            lengthDrift: provider.lengthDrift,
            tokenCount: provider.tokenCount,
          })),
      }))
      .filter((page) => page.providers.length > 0),
    highDisagreementPages: pages
      .filter((page) => page.pageDisagreement >= thresholds.highDisagreement)
      .map((page) => ({
        pageNumber: page.pageNumber,
        pageDisagreement: page.pageDisagreement,
        selectedProviderKey: page.selectedProviderKey,
        selectedConfidence: page.selectedConfidence,
      })),
    werCerDivergencePages: pages
      .map((page) => ({
        pageNumber: page.pageNumber,
        providers: page.providers
          .filter((provider) => provider.artifactFlags.werCerDivergence)
          .map((provider) => ({ providerKey: provider.providerKey, wer: provider.wer, cer: provider.cer })),
      }))
      .filter((page) => page.providers.length > 0),
    lowConfidencePages: pages
      .filter((page) => page.selectedLowConfidence)
      .map((page) => ({
        pageNumber: page.pageNumber,
        selectedProviderKey: page.selectedProviderKey,
        selectedConfidence: page.selectedConfidence,
        pageDisagreement: page.pageDisagreement,
      })),
  };
}

function buildSelectiveAdjudicationPages(
  thresholds: OcrPageAnalysisThresholds,
  pages: OcrPageMetric[],
): OcrSelectiveAdjudicationArtifact {
  const adjudicationPages = pages
    .map((page) => {
      const reason: string[] = [];
      if (page.selectedLowConfidence) {
        reason.push("low-confidence-selected-provider");
      }
      if (pageHasArtifactOutlier(page)) {
        reason.push("page-outlier");
      }
      if (page.pageDisagreement >= thresholds.highDisagreement) {
        reason.push("high-disagreement");
      }
      return {
        pageNumber: page.pageNumber,
        reason,
        replacedProviderKey: page.selectedProviderKey,
        replacedConfidence: page.selectedConfidence,
      };
    })
    .filter((page) => page.reason.length > 0);

  return {
    schemaVersion: 1,
    pageCount: adjudicationPages.length,
    pages: adjudicationPages,
  };
}

function selectedHybridText(providers: OcrProviderRun[], pages: OcrPageMetric[]): string {
  return pages
    .map((page) => {
      const provider = providers.find((candidate) => candidate.providerKey === page.selectedProviderKey);
      return provider ? pageTextForProvider(provider, page.pageNumber) : "";
    })
    .join("\n\n")
    .trim();
}

function variantStats(
  variantId: string,
  source: string,
  text: string,
  pageCount: number,
  extra?: {
    selectedPageSourceCounts?: Record<string, number>;
    lowConfidencePageCount?: number;
    outlierPageCount?: number;
  },
): OcrVariantComparisonSummary["variants"][number] {
  return {
    variantId,
    source,
    charCount: text.length,
    wordCount: tokenize(text).length,
    pageCount,
    ...(extra ?? {}),
  };
}

function variantDistance(referenceVariantId: string, referenceText: string, candidateVariantId: string, candidateText: string): OcrVariantDistance {
  const wer = wordErrorRateDetailed(referenceText, candidateText);
  const cer = characterErrorRateDetailed(referenceText, candidateText);
  return {
    referenceVariantId,
    candidateVariantId,
    wer: roundMetric(wer.wer),
    cer: roundMetric(cer.wer),
    wordDistance: wer.substitutions + wer.deletions + wer.insertions,
    wordReferenceCount: wer.referenceCount,
    charDistance: cer.substitutions + cer.deletions + cer.insertions,
    charReferenceCount: cer.referenceCount,
  };
}

function buildVariantComparisonSummary(
  runDir: string,
  providers: OcrProviderRun[],
  pages: OcrPageMetric[],
  consensusPages: Array<{ pageNumber: number; text: string }> | null,
): OcrVariantComparisonSummary {
  const hybridText = selectedHybridText(providers, pages);
  const pageSourceCounts = selectedPageSourceCounts(pages);
  const variants: OcrVariantComparisonSummary["variants"] = [
    variantStats("page-level-hybrid", "deterministic selected provider pages", hybridText, pages.length, {
      selectedPageSourceCounts: pageSourceCounts,
      lowConfidencePageCount: pages.filter((page) => page.selectedLowConfidence).length,
      outlierPageCount: pages.filter(pageHasArtifactOutlier).length,
    }),
  ];
  const pairwiseDistances: OcrVariantDistance[] = [];

  if (consensusPages) {
    const consensusText = consensusPages.map((page) => page.text).join("\n\n").trim();
    variants.unshift(variantStats("status-quo-consensus", "current consensus extraction", consensusText, consensusPages.length));
    pairwiseDistances.push(variantDistance("status-quo-consensus", consensusText, "page-level-hybrid", hybridText));
  }

  return {
    schemaVersion: 1,
    runDir,
    generatedAt: new Date().toISOString(),
    pageAligned: consensusPages ? consensusPages.length === pages.length : true,
    variants,
    pairwiseDistances,
  };
}

function countRows(outliers: OcrOutliersArtifact): Record<string, number> {
  return {
    blankOutputPages: outliers.blankOutputPages.length,
    repeatedTextPages: outliers.repeatedTextPages.length,
    majorLengthDriftPages: outliers.majorLengthDriftPages.length,
    highDisagreementPages: outliers.highDisagreementPages.length,
    werCerDivergencePages: outliers.werCerDivergencePages.length,
    lowConfidencePages: outliers.lowConfidencePages.length,
  };
}

function buildBenchmarkSummaryMarkdown(
  pageMetrics: OcrPageMetricsArtifact,
  outliers: OcrOutliersArtifact,
  selectiveAdjudicationPages: OcrSelectiveAdjudicationArtifact,
  variantComparisonSummary: OcrVariantComparisonSummary,
): string {
  const sourceRows = Object.entries(selectedPageSourceCounts(pageMetrics.pages))
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([providerKey, count]) => `| \`${providerKey}\` | ${count} |`)
    .join("\n");
  const outlierRows = Object.entries(countRows(outliers))
    .map(([signal, count]) => `| ${signal} | ${count} |`)
    .join("\n");
  const distanceRows = variantComparisonSummary.pairwiseDistances.length > 0
    ? variantComparisonSummary.pairwiseDistances
      .map((distance) =>
        `| \`${distance.referenceVariantId}\` | \`${distance.candidateVariantId}\` | ${(distance.wer * 100).toFixed(2)}% | ${(distance.cer * 100).toFixed(2)}% | ${distance.wordDistance} |`
      )
      .join("\n")
    : "| n/a | n/a | n/a | n/a | No consensus extraction was provided. |";

  return [
    "# OCR Consensus Benchmark Summary",
    "",
    "## Summary",
    "",
    `- Run directory: \`${pageMetrics.runDir}\``,
    `- Providers with page result files: ${pageMetrics.providerCount}`,
    `- Pages: ${pageMetrics.pageCount}`,
    "- Paid provider reruns: not run by this skill artifact; existing provider outputs only.",
    "- Recommended target: selective adjudication using page-level hybrid selection plus flagged-page review.",
    "",
    "## Page-Level Hybrid Sources",
    "",
    "| Selected Provider | Pages |",
    "| --- | ---: |",
    sourceRows || "| n/a | 0 |",
    "",
    "## Outlier Signals",
    "",
    "| Signal | Page Count |",
    "| --- | ---: |",
    outlierRows,
    "",
    "## Selective Adjudication",
    "",
    `- Candidate pages: ${selectiveAdjudicationPages.pageCount}`,
    `- Low-confidence threshold: ${pageMetrics.thresholds.lowConfidence}`,
    `- High-disagreement threshold: ${pageMetrics.thresholds.highDisagreement}`,
    "",
    "## Variant Distances",
    "",
    "| Reference | Candidate | WER | CER | Word Edits |",
    "| --- | --- | ---: | ---: | ---: |",
    distanceRows,
    "",
  ].join("\n");
}

export function buildOcrPageAnalysisArtifacts(
  runDir: string,
  providers: OcrProviderRun[],
  consensusPages: Array<{ pageNumber: number; text: string }> | null = null,
): OcrPageAnalysisArtifacts {
  const allPageNumbers = new Set<number>();
  for (const provider of providers) {
    for (const page of provider.pages) {
      allPageNumbers.add(page.pageNumber);
    }
  }
  const pages = [...allPageNumbers].sort((left, right) => left - right).map((pageNumber) => buildPageMetric(pageNumber, providers));
  const thresholds = buildThresholds(pages);
  const generatedAt = new Date().toISOString();
  const pageMetrics: OcrPageMetricsArtifact = {
    schemaVersion: 1,
    runDir,
    generatedAt,
    providerCount: providers.length,
    pageCount: pages.length,
    methodology: {
      successfulProvidersOnly: true,
      providerSelection: "highest confidence, then lower mean pairwise WER, lower mean pairwise CER, lower length drift, provider key",
      confidenceFormula: "1 - clamp(disagreement * 1.35 + tokenLengthDrift * 0.35 + artifactPenalty)",
      disagreementFormula: "0.65 * meanPairwiseWER + 0.35 * meanPairwiseCER",
      wordBreakdownMethod: "pairwise page WER against other successful providers",
      cerMethod: "normalized character edit distance computed page-wise",
    },
    thresholds,
    providers: providers.map((provider) => ({
      providerKey: provider.providerKey,
      directoryName: provider.directoryName,
      group: ocrMetricGroupForProvider(provider),
      resultPath: provider.resultPath,
    })),
    pages,
  };
  const outliers = buildOutliers(runDir, thresholds, pages);
  const selectiveAdjudicationPages = buildSelectiveAdjudicationPages(thresholds, pages);
  const variantComparisonSummary = buildVariantComparisonSummary(runDir, providers, pages, consensusPages);

  return {
    pageMetrics,
    outliers,
    selectiveAdjudicationPages,
    variantComparisonSummary,
    benchmarkSummaryMarkdown: buildBenchmarkSummaryMarkdown(
      pageMetrics,
      outliers,
      selectiveAdjudicationPages,
      variantComparisonSummary,
    ),
  };
}

export function parseConsensusExtraction(path: string): { pages: Array<{ pageNumber: number; text: string }> } {
  const content = readFileSync(path, "utf8").trim();
  if (!content) {
    throw new Error(`${path} is empty`);
  }

  const lines = content.split(/\r?\n/);
  const pages: Array<{ pageNumber: number; text: string }> = [];
  let currentPageNumber = 0;
  let currentLines: string[] = [];
  let hasCurrentPage = false;

  for (const line of lines) {
    const delimiterMatch = line.match(PAGE_DELIMITER_RE);
    if (delimiterMatch) {
      if (hasCurrentPage || currentLines.length > 0) {
        pages.push({ pageNumber: currentPageNumber, text: currentLines.join("\n").trim() });
      }
      currentPageNumber = Number(delimiterMatch[1]);
      currentLines = [];
      hasCurrentPage = true;
      continue;
    }
    currentLines.push(line);
  }

  if (hasCurrentPage || currentLines.length > 0) {
    pages.push({ pageNumber: currentPageNumber, text: currentLines.join("\n").trim() });
  }

  if (pages.length === 0) {
    throw new Error(`${path} does not contain any text`);
  }

  return { pages };
}

export function formatCents(cents: number | null): string {
  if (cents === null) {
    return "n/a";
  }
  return `${cents.toFixed(4)}\u00a2 ($${(cents / 100).toFixed(4)})`;
}

export function formatProcessingSeconds(milliseconds: number | null): string {
  if (milliseconds === null) {
    return "n/a";
  }
  return `${(milliseconds / 1000).toFixed(2)}s`;
}
