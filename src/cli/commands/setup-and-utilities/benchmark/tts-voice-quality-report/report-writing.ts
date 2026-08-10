import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, join, resolve } from "node:path"
import { rankVoiceQualityProviders } from '~/utils/voice-quality-scoring'
import * as l from '~/utils/app-logger/app-logger'
import { discoverAudioFiles, loadTtsManifestMetadata, makeProviderKey, tokenize } from '../tts-eval-lib'
import type { ContentType, MetricFixtures, ProviderVoiceQualityEntry, ScoreCoverage, VoiceQualityReportMode, VoiceQualityReportOptions } from '~/types'
import { HUMAN_SPEECH_WEIGHTS, NATURALNESS_WEIGHTS, SPEECH_QUALITY_WEIGHTS } from './voice-quality-report-constants'
import { evaluateProvider } from './provider-evaluation'
import { readJsonFile } from './shared'
import { CLIUsageError } from '~/utils/error-handler'

function formatScore(value: number | null): string {
  return value === null ? "n/a" : value.toFixed(2);
}

function formatCoverage(coverage: ScoreCoverage): string {
  return `${Math.round((coverage.availableWeight / coverage.totalWeight) * 100)}%`;
}

function humanSpeechConfidence(provider: ProviderVoiceQualityEntry): string {
  const natPct = provider.scoreCoverage.naturalness.availableWeight / provider.scoreCoverage.naturalness.totalWeight;
  const qualPct = provider.scoreCoverage.speechQuality.availableWeight / provider.scoreCoverage.speechQuality.totalWeight;
  const combined = (natPct + qualPct) / 2;
  if (combined > 0.8) return "High";
  if (combined >= 0.4) return "Medium";
  return "Low";
}

function buildProviderDetails(providers: ProviderVoiceQualityEntry[]): string {
  return providers.map((provider) => {
    const lines: string[] = [];
    lines.push(`### ${provider.rank}. \`${provider.providerKey}\` (${provider.group})`);
    lines.push("");
    lines.push(`| Metric | Score |`);
    lines.push(`| --- | ---: |`);
    lines.push(`| Human Speech | ${formatScore(provider.humanSpeechScore)} |`);
    lines.push(`| Naturalness | ${formatScore(provider.naturalnessScore)} |`);
    lines.push(`| Speech Quality | ${formatScore(provider.speechQualityScore)} |`);
    lines.push(`| Confidence | ${humanSpeechConfidence(provider)} |`);
    lines.push("");

    lines.push("**Naturalness Components**");
    lines.push("");
    lines.push("| Component | Score | Weight | Source |");
    lines.push("| --- | ---: | ---: | --- |");
    for (const [key, comp] of Object.entries(provider.componentScores.naturalness)) {
      lines.push(`| ${key} | ${formatScore(comp.score)} | ${(comp.weight * 100).toFixed(0)}% | ${comp.source} |`);
    }
    lines.push("");

    lines.push("**Speech Quality Components**");
    lines.push("");
    lines.push("| Component | Score | Weight | Source |");
    lines.push("| --- | ---: | ---: | --- |");
    for (const [key, comp] of Object.entries(provider.componentScores.speechQuality)) {
      lines.push(`| ${key} | ${formatScore(comp.score)} | ${(comp.weight * 100).toFixed(0)}% | ${comp.source} |`);
    }
    lines.push("");

    if (provider.metricDetails.signalMetrics) {
      const sm = provider.metricDetails.signalMetrics;
      lines.push("**Signal Metrics**");
      lines.push("");
      lines.push(`- Duration: ${sm.durationSeconds.toFixed(2)}s`);
      lines.push(`- Peak: ${sm.peakDbfs.toFixed(1)} dBFS, RMS: ${sm.rmsDbfs.toFixed(1)} dBFS`);
      lines.push(`- Clipping: ${(sm.clippingRatio * 100).toFixed(3)}%, Silence: ${(sm.silenceRatio * 100).toFixed(1)}%`);
      lines.push(`- Loudness range: ${sm.loudnessRangeDb.toFixed(1)} dB`);
      lines.push(`- Pauses: ${sm.pauseCount}${sm.medianPauseSeconds !== null ? ` (median ${sm.medianPauseSeconds.toFixed(2)}s)` : ""}`);
      lines.push("");
    }

    if (provider.metricDetails.prosodyMetrics) {
      const pm = provider.metricDetails.prosodyMetrics;
      lines.push("**Prosody Metrics**");
      lines.push("");
      if (pm["speechWordsPerMinute"] !== null) lines.push(`- Speaking rate: ${(pm["speechWordsPerMinute"] as number).toFixed(0)} WPM`);
      if (pm["speakingRateCharsPerSecond"] !== null) lines.push(`- Characters/sec: ${(pm["speakingRateCharsPerSecond"] as number).toFixed(1)}`);
      if (pm["detectedPauseCount"] !== null) lines.push(`- Detected pauses: ${pm["detectedPauseCount"]} (expected ~${pm["expectedPauseCount"]})`);
      lines.push("");
    }

    if (provider.metricDetails.roundtripStt.engines.length > 0) {
      lines.push("**Roundtrip STT**");
      lines.push("");
      lines.push("| Engine | WER |");
      lines.push("| --- | ---: |");
      for (const engine of provider.metricDetails.roundtripStt.engines) {
        lines.push(`| ${engine.engine} | ${(engine.wer * 100).toFixed(2)}% |`);
      }
      if (provider.metricDetails.roundtripStt.medianWer !== null) {
        lines.push(`| **Median** | **${(provider.metricDetails.roundtripStt.medianWer * 100).toFixed(2)}%** |`);
      }
      lines.push("");
    }

    if (provider.warnings.length > 0) {
      lines.push("**Warnings**");
      lines.push("");
      for (const warning of provider.warnings) {
        lines.push(`- ${warning}`);
      }
      lines.push("");
    }

    return lines.join("\n");
  }).join("\n---\n\n");
}

function buildRecommendations(
  providers: ProviderVoiceQualityEntry[],
  mode: VoiceQualityReportMode,
): string {
  const lines: string[] = [];
  const bestLocal = providers.find((p) => p.group === "local");
  const bestCloud = providers.find((p) => p.group === "cloud");
  const best = providers[0];

  if (best) {
    lines.push(`- **Best overall**: \`${best.providerKey}\` (${formatScore(best.humanSpeechScore)}/100)`);
  }
  if (bestLocal) {
    lines.push(`- **Best local**: \`${bestLocal.providerKey}\` (${formatScore(bestLocal.humanSpeechScore)}/100)`);
  }
  if (bestCloud) {
    lines.push(`- **Best cloud**: \`${bestCloud.providerKey}\` (${formatScore(bestCloud.humanSpeechScore)}/100)`);
  }

  if (best && providers.length > 1) {
    const second = providers[1];
    if (second && best.humanSpeechScore !== null && second.humanSpeechScore !== null) {
      const gap = best.humanSpeechScore - second.humanSpeechScore;
      if (gap > 5) {
        lines.push(`- \`${best.providerKey}\` leads by ${gap.toFixed(1)} points over \`${second.providerKey}\``);
      }
    }
  }

  const poorSignal = providers.filter((p) => {
    const sh = p.componentScores.speechQuality["signalHygiene"];
    return sh && sh.score !== null && sh.score < 50;
  });
  if (poorSignal.length > 0) {
    lines.push(`- **Signal hygiene concerns**: ${poorSignal.map((p) => `\`${p.providerKey}\``).join(", ")}`);
  }

  const lowCoverage = providers.filter((p) => humanSpeechConfidence(p) === "Low");
  if (lowCoverage.length > 0) {
    const prefix = `- ${lowCoverage.length} provider(s) have low score coverage.`;
    if (mode === "local") {
      lines.push(`${prefix} Run with \`--tts-mode full\` or supply \`--tts-metric-fixtures\` for higher confidence.`);
    } else {
      const externalMetrics = [
        "`utmosv2Mos`",
        "`nisqaTtsNaturalnessMos`",
        "`nisqaQualityMos`",
        "`dnsmosMos`",
      ].join(", ");
      lines.push(
        `${prefix} Full mode already ran; remaining low coverage usually means ` +
        `external MOS/DNS metrics are missing (${externalMetrics}). Supply ` +
        "`--tts-metric-fixtures` from external scorers for higher confidence.",
      );
    }
  }

  return lines.join("\n");
}

function buildMarkdown(report: {
  inputTextPath: string;
  inputTextCharCount: number;
  inputTextWordCount: number;
  mode: VoiceQualityReportMode;
  contentType: ContentType;
  providerCount: number;
  localCount: number;
  cloudCount: number;
  providers: ProviderVoiceQualityEntry[];
  warnings: string[];
}): string {
  const rankingRows = report.providers.map((provider) => {
    const missing = provider.missingMetrics.length === 0 ? "none" : provider.missingMetrics.join(", ");
    const confidence = humanSpeechConfidence(provider);
    return `| ${provider.rank} | \`${provider.providerKey}\` | ${provider.group} | ${formatScore(provider.humanSpeechScore)} | ${formatScore(provider.naturalnessScore)} | ${formatScore(provider.speechQualityScore)} | ${confidence} | ${formatCoverage(provider.scoreCoverage.naturalness)} / ${formatCoverage(provider.scoreCoverage.speechQuality)} | ${missing} |`;
  }).join("\n");

  const bestLocal = report.providers.find((provider) => provider.group === "local");
  const bestCloud = report.providers.find((provider) => provider.group === "cloud");
  const warningLines = report.warnings.length > 0
    ? report.warnings.map((warning) => `- ${warning}`).join("\n")
    : "- None";

  const contentTypeNote = report.contentType !== "default"
    ? `\n- Content type: ${report.contentType} (speaking rate tuned for this content type)`
    : "";

  return `# TTS Voice Quality Report

## Summary

- Input text: \`${basename(report.inputTextPath)}\` (${report.inputTextCharCount} characters, ${report.inputTextWordCount} words)
- Total providers: ${report.providerCount} (${report.localCount} local, ${report.cloudCount} cloud)
- Mode: ${report.mode}${contentTypeNote}
- Human speech score: 55% naturalnessScore + 45% speechQualityScore
- Naturalness score target weights: 45% UTMOSv2 MOS, 25% NISQA-TTS naturalness MOS, 20% paid audio-judge rubric, 10% prosody heuristics
- Speech quality score target weights: 35% NISQA quality MOS, 25% DNSMOS, 25% roundtrip STT intelligibility, 15% signal hygiene

## Method

- Audio files are normalized to temporary 16 kHz mono WAV for scoring. Original files are not modified.
- Silence threshold is computed adaptively from the audio noise floor.
- MOS-style 1-5 metrics are converted with \`(mos - 1) / 4 * 100\`.
- Missing components are omitted from that score's denominator and listed per provider.
- Cost, provider processing speed, and provider latency are not included in human-speech scoring.
- Full mode treats attempted paid scoring failures as fatal when credentials are configured.
- Local mode never starts paid STT or audio-judge calls.
- Confidence: High (>80% coverage), Medium (40-80%), Low (<40%). Low-coverage scores are preliminary.

## Overall Ranking

| Rank | Provider | Group | Human / 100 | Naturalness | Speech Quality | Confidence | Nat/Qual Coverage | Missing Metrics |
| ---: | --- | --- | ---: | ---: | ---: | --- | --- | --- |
${rankingRows}

## Best By Group

- Best local model: ${bestLocal ? `\`${bestLocal.providerKey}\` (${formatScore(bestLocal.humanSpeechScore)}/100)` : "n/a"}
- Best cloud service: ${bestCloud ? `\`${bestCloud.providerKey}\` (${formatScore(bestCloud.humanSpeechScore)}/100)` : "n/a"}

## Recommendations

${buildRecommendations(report.providers, report.mode)}

## Provider Details

${buildProviderDetails(report.providers)}

## Warnings

${warningLines}
`;
}

export async function buildVoiceQualityReport(args: VoiceQualityReportOptions) {
  const manifestMetadata = await loadTtsManifestMetadata(args.runDir);
  const inputTextPath = args.inputTextPath ? resolve(args.inputTextPath) : null;
  const inputText = (args.inputText !== undefined
    ? args.inputText
    : inputTextPath ? readFileSync(inputTextPath, "utf8") : "").trim();
  if (inputText.length === 0) {
    throw CLIUsageError("Input text is required for TTS voice-quality scoring.");
  }
  const inputTextSource = inputTextPath ?? args.inputTextLabel ?? "metadata.input";
  const inputTextCharCount = inputText.length;
  const inputTextWordCount = tokenize(inputText).length;
  const fixtures = args.metricFixturesPath ? readJsonFile<MetricFixtures>(args.metricFixturesPath) : null;
  const { found, missing } = discoverAudioFiles(args.runDir, manifestMetadata.tts);
  const warnings = missing.map((fileName) => `Missing audio file: ${fileName}`);
  const tempDir = mkdtempSync(join(tmpdir(), "autoshow-voice-quality-"));

  try {
    const providerEntries: Array<Omit<ProviderVoiceQualityEntry, "rank">> = [];
    for (const entry of manifestMetadata.tts) {
      const providerKey = makeProviderKey(entry.ttsService, entry.ttsModel);
      const evaluated = await evaluateProvider({
        runDir: args.runDir,
        inputText,
        inputCharCount: inputTextCharCount,
        inputWordCount: inputTextWordCount,
        entry,
        audioPath: found.get(providerKey),
        fixtures,
        roundtripDir: args.roundtripDir,
        mode: args.mode,
        allowPaid: args.allowPaid,
        audioJudgeModel: args.audioJudgeModel,
        tempDir,
        ...(args.contentType ? { contentType: args.contentType } : {}),
      });
      warnings.push(...evaluated.warnings.map((warning) => `${providerKey}: ${warning}`));
      providerEntries.push(evaluated);
    }

    const providers = rankVoiceQualityProviders(providerEntries).map((provider) => ({
      ...provider,
      rank: provider.rank,
    }));
    const localCount = providers.filter((provider) => provider.group === "local").length;
    const cloudCount = providers.length - localCount;

    const reportJson = {
      schemaVersion: 1,
      metric: "human-speech-quality",
      generatedAt: new Date().toISOString(),
      runDir: args.runDir,
      inputTextPath: inputTextSource,
      inputTextSource,
      inputTextCharCount,
      inputTextWordCount,
      mode: args.mode,
      contentType: args.contentType ?? "default",
      paidCallsAllowed: args.allowPaid,
      weights: {
        naturalnessScore: NATURALNESS_WEIGHTS,
        speechQualityScore: SPEECH_QUALITY_WEIGHTS,
        humanSpeechScore: HUMAN_SPEECH_WEIGHTS,
      },
      scoringNotes: [
        "MOS-style 1-5 metrics are converted to 0-100 with (mos - 1) / 4 * 100.",
        "Missing components are omitted from the denominator and recorded in missingMetrics.",
        "Cost, processing speed, and provider latency are excluded from human-speech scoring.",
        "Full mode fails when a configured paid scoring call is attempted and returns an error or unusable response.",
      ],
      providerCount: providers.length,
      local: {
        count: localCount,
        providers: providers.filter((provider) => provider.group === "local"),
      },
      cloud: {
        count: cloudCount,
        providers: providers.filter((provider) => provider.group === "cloud"),
      },
      overall: {
        count: providers.length,
        providers,
      },
      providers,
      warnings,
    };

    const markdown = buildMarkdown({
      inputTextPath: inputTextSource,
      inputTextCharCount,
      inputTextWordCount,
      mode: args.mode,
      contentType: args.contentType ?? "default",
      providerCount: providers.length,
      localCount,
      cloudCount,
      providers,
      warnings,
    });

    return { reportJson, markdown, warnings };
  } finally {
    if (!args.keepTemp) {
      rmSync(tempDir, { recursive: true, force: true });
    } else {
      warnings.push(`Kept normalized audio temp directory: ${tempDir}`);
    }
  }
}

export async function writeVoiceQualityReport(args: VoiceQualityReportOptions): Promise<{
  jsonOut: string;
  markdownOut: string;
  warnings: string[];
}> {
  const jsonOut = args.jsonOut ?? resolve(args.runDir, "voice-quality-report.json");
  const markdownOut = args.markdownOut ?? resolve(args.runDir, "voice-quality-report.md");
  const { reportJson, markdown, warnings } = await buildVoiceQualityReport(args);

  for (const warning of warnings) {
    l.warn(warning);
  }

  writeFileSync(jsonOut, `${JSON.stringify(reportJson, null, 2)}\n`);
  writeFileSync(markdownOut, markdown);
  return { jsonOut, markdownOut, warnings };
}
