import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { roundtripWer } from '../tts-eval-lib'
import type { MetricFixtureProvider, PaidFailurePolicy, RoundtripEngineResult } from '~/types'
import { ASSEMBLYAI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { readEnv } from '~/utils/validate/env-utils'
import { PAID_STT_ENGINES } from './voice-quality-report-constants'
import { errorMessage, isRecord, paidSttSubsystemLabel, recordPaidFailure } from './shared'
import { InfraError, InternalError, ValidationError, hintsForMissingEnv } from '~/utils/error-handler'

function transcriptText(value: string | { text?: string; transcript?: string }): string {
  if (typeof value === "string") return value;
  return value.text ?? value.transcript ?? "";
}

export function roundtripFromFixture(
  fixture: MetricFixtureProvider | null,
  inputText: string,
): RoundtripEngineResult[] {
  const source = fixture?.roundtripTranscripts ?? fixture?.stt;
  if (!source) return [];
  return Object.entries(source)
    .map(([engine, value]) => {
      const transcript = transcriptText(value).trim();
      return {
        engine,
        transcript,
        wer: roundtripWer(inputText, transcript),
      };
    })
    .filter((entry) => entry.transcript.length > 0);
}

export function readRoundtripDir(
  roundtripDir: string | null,
  audioFileName: string,
  inputText: string,
): RoundtripEngineResult[] {
  if (!roundtripDir) return [];
  const results: RoundtripEngineResult[] = [];
  const flatPath = join(roundtripDir, `${audioFileName}.txt`);
  if (existsSync(flatPath)) {
    const transcript = readFileSync(flatPath, "utf8").trim();
    results.push({
      engine: "roundtrip-dir",
      transcript,
      wer: roundtripWer(inputText, transcript),
    });
  }
  for (const engine of PAID_STT_ENGINES) {
    const dirName = engine.key.replace("/", "-");
    const enginePath = join(roundtripDir, dirName, `${audioFileName}.txt`);
    if (existsSync(enginePath)) {
      const transcript = readFileSync(enginePath, "utf8").trim();
      results.push({
        engine: engine.key,
        transcript,
        wer: roundtripWer(inputText, transcript),
      });
    }
  }
  return results;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function runAssemblyAiTranscription(audioPath: string, model: string): Promise<string> {
  const apiKey = readEnv("ASSEMBLYAI_API_KEY");
  if (!apiKey) throw InternalError("ASSEMBLYAI_API_KEY is required for AssemblyAI STT", { stage: 'tts:roundtrip-stt', hints: hintsForMissingEnv('ASSEMBLYAI_API_KEY') });
  const baseURL = ASSEMBLYAI_DEFAULT_BASE_URL.replace(/\/+$/, "");
  const uploadResponse = await fetch(`${baseURL}/v2/upload`, {
    method: "POST",
    headers: {
      authorization: apiKey,
      "content-type": "application/octet-stream",
    },
    body: Bun.file(audioPath),
  });
  const uploadRaw = await uploadResponse.text();
  if (!uploadResponse.ok) {
    throw InfraError(`AssemblyAI upload failed (${uploadResponse.status}): ${uploadRaw.slice(0, 500)}`, { stage: 'tts:roundtrip-stt' });
  }
  const upload = JSON.parse(uploadRaw) as unknown;
  if (!isRecord(upload) || typeof upload["upload_url"] !== "string") {
    throw ValidationError("AssemblyAI upload response missing upload_url", { stage: 'tts:roundtrip-stt' });
  }

  const createResponse = await fetch(`${baseURL}/v2/transcript`, {
    method: "POST",
    headers: {
      authorization: apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      audio_url: upload["upload_url"],
      speech_models: [model],
    }),
  });
  const createRaw = await createResponse.text();
  if (!createResponse.ok) {
    throw InfraError(`AssemblyAI transcript creation failed (${createResponse.status}): ${createRaw.slice(0, 500)}`, { stage: 'tts:roundtrip-stt' });
  }
  const created = JSON.parse(createRaw) as unknown;
  if (!isRecord(created) || typeof created["id"] !== "string") {
    throw ValidationError("AssemblyAI transcript creation response missing id", { stage: 'tts:roundtrip-stt' });
  }

  const transcriptId = created["id"];
  const deadline = Date.now() + 20 * 60 * 1000;
  let delayMs = 1000;
  while (Date.now() < deadline) {
    const pollResponse = await fetch(`${baseURL}/v2/transcript/${transcriptId}`, {
      method: "GET",
      headers: { authorization: apiKey },
    });
    const pollRaw = await pollResponse.text();
    if (!pollResponse.ok) {
      throw InfraError(`AssemblyAI polling failed (${pollResponse.status}): ${pollRaw.slice(0, 500)}`, { stage: 'tts:roundtrip-stt' });
    }
    const payload = JSON.parse(pollRaw) as unknown;
    if (!isRecord(payload) || typeof payload["status"] !== "string") {
      throw ValidationError("AssemblyAI poll response missing status", { stage: 'tts:roundtrip-stt' });
    }
    if (payload["status"] === "completed") {
      return typeof payload["text"] === "string" ? payload["text"].trim() : "";
    }
    if (payload["status"] === "error") {
      throw InfraError(`AssemblyAI transcription failed: ${String(payload["error"] ?? "unknown error")}`, { stage: 'tts:roundtrip-stt' });
    }
    await sleep(delayMs);
    delayMs = Math.min(10000, Math.round(delayMs * 1.5));
  }
  throw InfraError(`AssemblyAI timed out waiting for transcript ${transcriptId}`, { stage: 'tts:roundtrip-stt' });
}

export async function runPaidStt(
  normalizedAudioPath: string,
  audioFileName: string,
  runDir: string,
  inputText: string,
  failurePolicy: PaidFailurePolicy,
): Promise<{ results: RoundtripEngineResult[]; warnings: string[] }> {
  const results: RoundtripEngineResult[] = [];
  const warnings: string[] = [];
  const cacheRoot = join(runDir, "voice-quality-roundtrip");
  for (const engine of PAID_STT_ENGINES) {
    if (engine.service === "assemblyai" && !readEnv("ASSEMBLYAI_API_KEY")) {
      continue;
    }
    const dirName = engine.key.replace("/", "-");
    const engineDir = join(cacheRoot, dirName);
    mkdirSync(engineDir, { recursive: true });
    const transcriptPath = join(engineDir, `${audioFileName}.txt`);
    let transcript: string;
    let paidCallInFlight = false;
    try {
      if (existsSync(transcriptPath)) {
        transcript = readFileSync(transcriptPath, "utf8").trim();
      } else {
        paidCallInFlight = true;
        transcript = await runAssemblyAiTranscription(normalizedAudioPath, engine.model);
        paidCallInFlight = false;
        writeFileSync(transcriptPath, `${transcript}\n`);
      }
      results.push({
        engine: engine.key,
        transcript,
        wer: roundtripWer(inputText, transcript),
      });
    } catch (error) {
      if (paidCallInFlight) {
        recordPaidFailure(
          { ...failurePolicy, warnings },
          paidSttSubsystemLabel(engine.service),
          error,
        );
      } else {
        warnings.push(`${engine.key} cached roundtrip transcript failed: ${errorMessage(error)}`);
      }
    }
  }
  return { results, warnings };
}
