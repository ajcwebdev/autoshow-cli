import { join } from 'node:path'
import { InfraError } from '~/utils/error-handler'
import { isObjectLike } from '~/utils/value-helpers'

// Walk the raw timeline: accessors can discard all but one audio/text block.
export const writeGeminiMusicInteraction = async (response: unknown, outputDir: string) => {
  const fail = (message: string): never => { throw InfraError(`Lyria 3.5 ${message}`, { stage: 'music:gemini' }) }
  if (!isObjectLike(response)) return fail('returned an invalid interaction')
  if (response['error'] !== undefined || (response['status'] !== undefined && response['status'] !== 'completed')) {
    return fail('interaction failed or did not complete')
  }
  const text: string[] = []
  const audio: Buffer[] = []
  const steps = response['steps']
  if (!Array.isArray(steps)) return fail('returned no model-output steps')
  for (const step of steps) {
    if (!isObjectLike(step) || step['type'] !== 'model_output') continue
    if (!Array.isArray(step['content'])) return fail('returned invalid model-output content')
    for (const part of step['content']) {
      if (!isObjectLike(part)) return fail('returned an invalid content block')
      if (part['type'] === 'text' && typeof part['text'] === 'string') {
        text.push(part['text']) // Preserve lyrics and JSON structure descriptions verbatim.
      } else if (part['type'] === 'audio') {
        const data = part['data']
        const mime = part['mime_type']
        if (mime !== undefined && mime !== 'audio/mpeg' && mime !== 'audio/mp3') return fail('returned unsupported audio format; expected MP3')
        if (typeof data !== 'string' || !data || data.length % 4 === 1 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
          return fail('returned invalid base64 audio')
        }
        const bytes = Buffer.from(data, 'base64')
        if (!bytes.length || bytes.toString('base64').replace(/=+$/, '') !== data.replace(/=+$/, '')) return fail('returned invalid base64 audio')
        audio.push(bytes)
      }
    }
  }
  if (audio.length === 0) return fail('completed without audio')
  // Each block is a complete artifact, not an assumed fragment of one container.
  const fileNames = audio.map((_, index) => index === 0 ? 'generated-music.mp3' : `generated-music-part-${index + 1}.mp3`)
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
