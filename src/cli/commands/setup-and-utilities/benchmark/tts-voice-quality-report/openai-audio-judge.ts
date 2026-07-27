import { readFileSync } from "node:fs"
import type { ComponentScore } from '~/types'
import { OPENAI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { readEnv } from '~/utils/validate/env-utils'
import { NATURALNESS_WEIGHTS } from './voice-quality-report-constants'
import { scoredComponent } from './score-components'
import { finiteNumber, isRecord } from './shared'
import { InfraError, InternalError, ValidationError, hintsForMissingEnv } from '~/utils/error-handler'

export function buildOpenAiAudioJudgeRequestBody(input: {
  model: string;
  audioBase64: string;
  inputText: string;
  jsonMode?: boolean;
  audioOutput?: boolean;
  toolMode?: boolean;
}): Record<string, unknown> {
  const prompt = [
    "Evaluate this text-to-speech sample against the supplied reference text.",
    "Return exactly one compact JSON object and no markdown, code fences, prose, or commentary.",
    "Use this schema: {\"naturalnessScore\":number|null,\"pronunciationScore\":number|null,\"prosodyScore\":number|null,\"artifactScore\":number|null,\"confidence\":number,\"notes\":string}.",
    "Use 0-100 numbers for score fields when the audio can be judged. Use null only when the audio is unavailable or cannot be understood.",
    "Score naturalness as human-like speaking flow, intonation, expressiveness, and absence of synthetic cadence.",
    "Do not score cost, latency, provider reputation, or anything not audible in the sample.",
    "",
    "Reference text:",
    input.inputText,
  ].join("\n");
  return {
    model: input.model,
    store: false,
    modalities: input.audioOutput ? ["text", "audio"] : ["text"],
    ...(input.audioOutput ? { audio: { voice: "alloy", format: "wav" } } : {}),
    ...(input.jsonMode === false ? {} : { response_format: { type: "json_object" } }),
    ...(input.toolMode ? {
      tools: [
        {
          type: "function",
          function: {
            name: "record_tts_voice_quality",
            description: "Record the voice-quality rubric scores for this text-to-speech audio sample.",
            parameters: {
              type: "object",
              additionalProperties: false,
              properties: {
                naturalnessScore: { type: ["number", "null"] },
                pronunciationScore: { type: ["number", "null"] },
                prosodyScore: { type: ["number", "null"] },
                artifactScore: { type: ["number", "null"] },
                confidence: { type: "number" },
                notes: { type: "string" },
              },
              required: [
                "naturalnessScore",
                "pronunciationScore",
                "prosodyScore",
                "artifactScore",
                "confidence",
                "notes",
              ],
            },
          },
        },
      ],
      tool_choice: {
        type: "function",
        function: { name: "record_tts_voice_quality" },
      },
    } : {}),
    messages: [
      {
        role: "system",
        content: "You are a speech-quality evaluator. Return only valid JSON and no explanatory prose.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "input_audio",
            input_audio: {
              data: input.audioBase64,
              format: "wav",
            },
          },
        ],
      },
    ],
    temperature: 0,
  };
}

function tryParseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function stripJsonFence(text: string): string {
  const trimmed = text.trim();
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return (match?.[1] ?? trimmed).trim();
}

function firstParsableJsonObject(text: string): {
  parsed: Record<string, unknown> | null;
  malformedSnippet: string | null;
  truncatedSnippet: string | null;
} {
  let malformedSnippet: string | null = null;
  let truncatedSnippet: string | null = null;

  for (let start = 0; start < text.length; start += 1) {
    if (text.charAt(start) !== "{") continue;

    let depth = 0;
    let inString = false;
    let escaped = false;
    let closed = false;

    for (let index = start; index < text.length; index += 1) {
      const char = text.charAt(index);

      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (char === "\\") {
          escaped = true;
          continue;
        }
        if (char === "\"") {
          inString = false;
        }
        continue;
      }

      if (char === "\"") {
        inString = true;
        continue;
      }
      if (char === "{") {
        depth += 1;
        continue;
      }
      if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          closed = true;
          const candidate = text.slice(start, index + 1);
          const parsed = tryParseJsonObject(candidate);
          if (parsed) {
            return { parsed, malformedSnippet: null, truncatedSnippet: null };
          }
          malformedSnippet ??= candidate;
          break;
        }
      }
    }

    if (!closed && depth > 0) {
      truncatedSnippet ??= text.slice(start);
    }
  }

  return { parsed: null, malformedSnippet, truncatedSnippet };
}

function previewText(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 180);
}

export function parseOpenAiAudioJudgeResponseContent(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw ValidationError("OpenAI audio judge returned an empty text response", { stage: 'tts:audio-judge' });
  }

  const unfenced = stripJsonFence(trimmed);
  const direct = tryParseJsonObject(unfenced);
  if (direct) {
    return direct;
  }

  const embedded = firstParsableJsonObject(unfenced);
  if (embedded.parsed) {
    return embedded.parsed;
  }

  if (embedded.truncatedSnippet) {
    const preview = previewText(embedded.truncatedSnippet);
    throw ValidationError(`OpenAI audio judge returned truncated JSON object${preview ? `: ${preview}` : ""}`, { stage: 'tts:audio-judge' });
  }

  if (embedded.malformedSnippet) {
    const preview = previewText(embedded.malformedSnippet);
    throw ValidationError(`OpenAI audio judge returned malformed JSON object${preview ? `: ${preview}` : ""}`, { stage: 'tts:audio-judge' });
  }

  const preview = previewText(trimmed);
  throw ValidationError(`OpenAI audio judge returned text without a JSON object${preview ? `: ${preview}` : ""}`, { stage: 'tts:audio-judge' });
}

function extractOpenAiAudioJudgeResponseText(payload: unknown): string {
  if (
    !isRecord(payload) ||
    !Array.isArray(payload["choices"]) ||
    !isRecord(payload["choices"][0]) ||
    !isRecord(payload["choices"][0]["message"])
  ) {
    return "";
  }

  const message = payload["choices"][0]["message"];
  const toolCalls = message["tool_calls"];
  if (Array.isArray(toolCalls) && isRecord(toolCalls[0])) {
    const functionCall = toolCalls[0]["function"];
    if (isRecord(functionCall) && typeof functionCall["arguments"] === "string") {
      return functionCall["arguments"];
    }
  }

  const content = message["content"];
  if (typeof content === "string" && content.trim().length > 0) {
    return content;
  }

  const audio = message["audio"];
  if (isRecord(audio) && typeof audio["transcript"] === "string") {
    return audio["transcript"];
  }

  return typeof content === "string" ? content : "";
}

function isOpenAiAudioJudgeResponseFormatUnsupported(status: number, rawText: string): boolean {
  if (status !== 400 && status !== 422) return false;
  const lowered = rawText.toLowerCase();

  try {
    const payload = JSON.parse(rawText) as unknown;
    if (isRecord(payload)) {
      const error = payload["error"];
      if (isRecord(error) && error["param"] === "response_format") {
        return true;
      }
    }
  } catch {
  }

  return lowered.includes("response_format") && (
    lowered.includes("not supported") ||
    lowered.includes("unsupported") ||
    lowered.includes("invalid parameter")
  );
}

function isOpenAiAudioJudgeToolUnsupported(status: number, rawText: string): boolean {
  if (status !== 400 && status !== 422) return false;
  const lowered = rawText.toLowerCase();
  return (
    lowered.includes("tool_choice") ||
    lowered.includes("tool_calls") ||
    lowered.includes("tools") ||
    lowered.includes("function")
  ) && (
    lowered.includes("not supported") ||
    lowered.includes("unsupported") ||
    lowered.includes("invalid parameter")
  );
}

function isOpenAiAudioJudgeMissingAudioText(text: string): boolean {
  const lowered = text.toLowerCase();
  return lowered.includes("audio") && (
    lowered.includes("don't have") ||
    lowered.includes("do not have") ||
    lowered.includes("no audio") ||
    lowered.includes("provide the audio") ||
    lowered.includes("provide an audio") ||
    lowered.includes("without an audio")
  );
}

export async function runPaidAudioJudge(
  normalizedAudioPath: string,
  inputText: string,
  model: string,
): Promise<ComponentScore> {
  const apiKey = readEnv("OPENAI_API_KEY");
  if (!apiKey) throw InternalError("OPENAI_API_KEY is required for paid audio judging", { stage: 'tts:audio-judge', hints: hintsForMissingEnv('OPENAI_API_KEY') });
  const baseURL = OPENAI_DEFAULT_BASE_URL.replace(/\/+$/, "");
  const audioBase64 = readFileSync(normalizedAudioPath).toString("base64");
  const executeJudgeRequest = async (request: { jsonMode: boolean; audioOutput: boolean; toolMode?: boolean }): Promise<{
    ok: boolean;
    status: number;
    rawText: string;
    audioOutput: boolean;
    toolMode: boolean;
  }> => {
    const response = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(buildOpenAiAudioJudgeRequestBody({
        model,
        audioBase64,
        inputText,
        jsonMode: request.jsonMode,
        audioOutput: request.audioOutput,
        ...(request.toolMode === undefined ? {} : { toolMode: request.toolMode }),
      })),
    });
    return {
      ok: response.ok,
      status: response.status,
      rawText: await response.text(),
      audioOutput: request.audioOutput,
      toolMode: request.toolMode === true,
    };
  };

  let result = await executeJudgeRequest({ jsonMode: true, audioOutput: false });
  if (!result.ok && isOpenAiAudioJudgeResponseFormatUnsupported(result.status, result.rawText)) {
    result = await executeJudgeRequest({ jsonMode: false, audioOutput: true, toolMode: true });
    if (!result.ok && isOpenAiAudioJudgeToolUnsupported(result.status, result.rawText)) {
      result = await executeJudgeRequest({ jsonMode: false, audioOutput: true });
    }
  }

  const parseResult = (rawText: string): {
    parsed: Record<string, unknown>;
    content: string;
  } => {
    const payload = JSON.parse(rawText) as unknown;
    const content = extractOpenAiAudioJudgeResponseText(payload);
    return {
      parsed: parseOpenAiAudioJudgeResponseContent(content),
      content,
    };
  };

  if (!result.ok) {
    throw InfraError(`OpenAI audio judge failed (${result.status}): ${result.rawText.slice(0, 500)}`, { stage: 'tts:audio-judge' });
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = parseResult(result.rawText).parsed;
  } catch (error) {
    let content = "";
    try {
      const payload = JSON.parse(result.rawText) as unknown;
      content = extractOpenAiAudioJudgeResponseText(payload);
    } catch {
    }
    if (result.audioOutput || !isOpenAiAudioJudgeMissingAudioText(content)) {
      throw error;
    }
    result = await executeJudgeRequest({ jsonMode: false, audioOutput: true, toolMode: true });
    if (!result.ok && isOpenAiAudioJudgeToolUnsupported(result.status, result.rawText)) {
      result = await executeJudgeRequest({ jsonMode: false, audioOutput: true });
    }
    if (!result.ok) {
      throw InfraError(`OpenAI audio judge failed (${result.status}): ${result.rawText.slice(0, 500)}`, { stage: 'tts:audio-judge' });
    }
    parsed = parseResult(result.rawText).parsed;
  }

  const score = finiteNumber(parsed["naturalnessScore"]);
  if (score === null) {
    throw ValidationError("OpenAI audio judge response missing naturalnessScore", { stage: 'tts:audio-judge' });
  }
  return scoredComponent(
    score,
    NATURALNESS_WEIGHTS.paidAudioJudgeRubric,
    `openai/${model}`,
    "Paid audio-judge rubric naturalness score.",
    {
      pronunciationScore: finiteNumber(parsed["pronunciationScore"]),
      prosodyScore: finiteNumber(parsed["prosodyScore"]),
      artifactScore: finiteNumber(parsed["artifactScore"]),
      confidence: finiteNumber(parsed["confidence"]),
    },
  );
}
