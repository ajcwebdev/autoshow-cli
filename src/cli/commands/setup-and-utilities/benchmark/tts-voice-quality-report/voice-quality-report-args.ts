import { resolve } from "node:path"
import type { VoiceQualityReportMode, VoiceQualityReportOptions } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'

function helpText(): string {
  return [
    "Usage: bun build_voice_quality_report.ts <run_dir> --input-text <path> [--mode local|full] [--allow-paid] [--metric-fixtures <path>] [--roundtrip-dir <path>] [--markdown-out <path>] [--json-out <path>] [--keep-temp]",
    "",
    "Generate a TTS human-speech naturalness and perceived-quality report.",
    "",
    "Options:",
    "  --input-text <path>        Path to the original input text file",
    "  --mode <local|full>        local avoids paid API calls; full enables paid STT and audio judging (default: local)",
    "  --allow-paid              Required with --mode full before any paid API call can run",
    "  --metric-fixtures <path>  JSON metrics/transcripts to use instead of unavailable model/API calls",
    "  --roundtrip-dir <path>    Existing roundtrip transcripts ({audioFileName}.txt or engine subdirs)",
    "  --markdown-out <path>     Write markdown report to <path> (default: <run_dir>/voice-quality-report.md)",
    "  --json-out <path>         Write JSON report to <path> (default: <run_dir>/voice-quality-report.json)",
    "  --audio-judge-model <id>  OpenAI audio-capable chat model for paid rubric judging (default: gpt-audio)",
    "  --keep-temp               Keep normalized 16 kHz mono WAV files for inspection",
    "  --help, -h                Show this help message",
  ].join("\n");
}

export function parseVoiceQualityReportArgs(argv: string[]): VoiceQualityReportOptions {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(helpText());
    process.exit(0);
  }

  const positional: string[] = [];
  let inputTextPath: string | null = null;
  let mode: VoiceQualityReportMode = "local";
  let allowPaid = false;
  let metricFixturesPath: string | null = null;
  let roundtripDir: string | null = null;
  let markdownOut: string | null = null;
  let jsonOut: string | null = null;
  let keepTemp = false;
  let audioJudgeModel = "gpt-audio";

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] as string;
    if (arg === "--input-text") {
      const value = argv[index + 1];
      if (!value) throw CLIUsageError("Missing value for --input-text");
      inputTextPath = value;
      index += 1;
      continue;
    }
    if (arg === "--mode") {
      const value = argv[index + 1];
      if (value !== "local" && value !== "full") {
        throw CLIUsageError("--mode must be local or full");
      }
      mode = value;
      index += 1;
      continue;
    }
    if (arg === "--allow-paid") {
      allowPaid = true;
      continue;
    }
    if (arg === "--metric-fixtures") {
      const value = argv[index + 1];
      if (!value) throw CLIUsageError("Missing value for --metric-fixtures");
      metricFixturesPath = resolve(value);
      index += 1;
      continue;
    }
    if (arg === "--roundtrip-dir") {
      const value = argv[index + 1];
      if (!value) throw CLIUsageError("Missing value for --roundtrip-dir");
      roundtripDir = resolve(value);
      index += 1;
      continue;
    }
    if (arg === "--markdown-out") {
      const value = argv[index + 1];
      if (!value) throw CLIUsageError("Missing value for --markdown-out");
      markdownOut = resolve(value);
      index += 1;
      continue;
    }
    if (arg === "--json-out") {
      const value = argv[index + 1];
      if (!value) throw CLIUsageError("Missing value for --json-out");
      jsonOut = resolve(value);
      index += 1;
      continue;
    }
    if (arg === "--audio-judge-model") {
      const value = argv[index + 1];
      if (!value) throw CLIUsageError("Missing value for --audio-judge-model");
      audioJudgeModel = value;
      index += 1;
      continue;
    }
    if (arg === "--keep-temp") {
      keepTemp = true;
      continue;
    }
    if (arg.startsWith("--")) {
      throw CLIUsageError(`Unknown flag: ${arg}`);
    }
    positional.push(arg);
  }

  const runDir = positional[0];
  if (!runDir) {
    throw CLIUsageError("Usage: bun build_voice_quality_report.ts <run_dir> --input-text <path> [--mode local|full]");
  }
  if (!inputTextPath) {
    throw CLIUsageError("--input-text is required");
  }
  if (mode === "full" && !allowPaid) {
    throw CLIUsageError("--mode full requires --allow-paid");
  }

  return {
    runDir: resolve(runDir),
    inputTextPath: resolve(inputTextPath),
    mode,
    allowPaid,
    metricFixturesPath,
    roundtripDir,
    markdownOut,
    jsonOut,
    keepTemp,
    audioJudgeModel,
  };
}
