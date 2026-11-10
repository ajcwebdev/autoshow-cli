import { GENERATION_ARTIFACT_BASENAMES, generationArtifactFileName } from '~/cli/commands/command-shared/media-generation/media-generation-scaffold'
import { join } from 'node:path'
import { InfraError } from '~/utils/error-handler'
import { isObjectLike } from '~/utils/value-helpers'

const fail = (message: string): never => { throw InfraError(`Lyria 3.5 ${message}`, { stage: 'music:gemini' }) }

const decodeGeminiMusicAudio = (part: Record<string, unknown>): Buffer => {
  const data = part['data']
  const mime = part['mime_type']
  if (mime !== undefined && mime !== 'audio/mpeg' && mime !== 'audio/mp3') return fail('returned unsupported audio format; expected MP3')
  if (typeof data !== 'string' || !data || data.length % 4 === 1 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
    return fail('returned invalid base64 audio')
  }
  const bytes = Buffer.from(data, 'base64')
  if (!bytes.length || bytes.toString('base64').replace(/=+$/, '') !== data.replace(/=+$/, '')) return fail('returned invalid base64 audio')
  return bytes
}

type GeminiMusicOutput = { text: string[], audio: Buffer[] }

const collectGeminiMusicContent = (content: unknown[], output: GeminiMusicOutput): void => {
  for (const part of content) {
    if (!isObjectLike(part)) return fail('returned an invalid content block')
    if (part['type'] === 'text' && typeof part['text'] === 'string') {
      output.text.push(part['text'])
    } else if (part['type'] === 'audio') {
      output.audio.push(decodeGeminiMusicAudio(part))
    }
  }
}

const collectGeminiMusicOutput = (response: Record<string, unknown>): GeminiMusicOutput => {
  if (response['error'] !== undefined || (response['status'] !== undefined && response['status'] !== 'completed')) {
    return fail('interaction failed or did not complete')
  }
  const output: GeminiMusicOutput = { text: [], audio: [] }
  const steps = response['steps']
  if (!Array.isArray(steps)) return fail('returned no model-output steps')
  for (const step of steps) {
    if (!isObjectLike(step) || step['type'] !== 'model_output') continue
    if (!Array.isArray(step['content'])) return fail('returned invalid model-output content')
    collectGeminiMusicContent(step['content'], output)
  }
  if (output.audio.length === 0) return fail('completed without audio')
  return output
}

export const writeGeminiMusicInteraction = async (response: unknown, outputDir: string) => {
  if (!isObjectLike(response)) return fail('returned an invalid interaction')
  const { text, audio } = collectGeminiMusicOutput(response)
  const fileNames = audio.map((_, index) => index === 0
    ? generationArtifactFileName('music')
    : `${GENERATION_ARTIFACT_BASENAMES.music}-part-${index + 1}.mp3`)
  for (const [index, bytes] of audio.entries()) await Bun.write(join(outputDir, fileNames[index]!), bytes)
  const generatedText = text.length ? text.join('\n\n') : undefined
  const generatedTextFileName = generatedText !== undefined ? 'generated-music.txt' : undefined
  if (generatedTextFileName) await Bun.write(join(outputDir, generatedTextFileName), generatedText!)
  return {
    audioMimeType: 'audio/mpeg',
    outputFormat: 'mp3',
    audioSampleRate: 44100,
    audioChannelCount: 2,
    ...(typeof response['id'] === 'string' ? { providerRequestId: response['id'] } : {}),
    ...(generatedText !== undefined ? { generatedText, generatedTextFileName } : {}),
    ...(audio.length > 1 ? { additionalAudioFileNames: fileNames.slice(1) } : {})
  }
}
