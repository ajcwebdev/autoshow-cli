// Independent response fixtures for the REST contracts documented 2026-09-24:
// https://ai.google.dev/api/interactions-api
// https://ai.google.dev/api/batch-api
// https://ai.google.dev/gemini-api/docs/generate-content/speech-generation
// Synthetic tones establish decoded integrity only, never spoken correctness or quality.
import { createSyntheticWavBytes } from '../../../../../test-utils/media-fixtures'
export const FLASH = 'gemini-3.8-flash-tts'
export const LITE = 'gemini-3.8-flash-lite-tts'
export const wav = createSyntheticWavBytes({ sampleRate: 24000, durationSeconds: 0.3, frequencyHz: 440, amplitude: 0.2 })
export const usage = { input_tokens_by_modality: [{ modality: 'text', tokens: 30 }], output_tokens_by_modality: [{ modality: 'audio', tokens: 8 }] }
export const unary = (data = wav.toString('base64'), mime_type = 'audio/wav') => ({ id: 'interaction_test', status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'audio', data, mime_type }] }], usage })
export const batchAudio = (data = wav.toString('base64')) => ({ candidates: [{ finishReason: 'STOP', content: { role: 'model', parts: [{ inlineData: { data, mimeType: 'audio/wav' } }] } }], usageMetadata: { promptTokensDetails: [{ modality: 'TEXT', tokenCount: 30 }], candidatesTokensDetails: [{ modality: 'AUDIO', tokenCount: 8 }] } })
export const sse = (complete = true, crlf = false) => [
  { event_type: 'step.delta', delta: { type: 'audio', mime_type: 'audio/l16', data: wav.subarray(44).toString('base64') } },
  ...(complete ? [{ event_type: 'interaction.completed', interaction: { status: 'completed', usage } }] : [])
].map(row => 'data: ' + JSON.stringify(row) + '\n\n').join('').replaceAll('\n', crlf ? '\r\n' : '\n')
