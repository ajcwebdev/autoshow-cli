import type { GeminiMusicModel, GeminiMusicResponsePart, Step7MusicMetadata } from '~/types'
import { logGenCompleted, logGenStatus } from '~/cli/commands/process-steps/generation-command-utils'
import { requireApiKey } from '~/utils/validate/env-utils'
import * as l from '~/utils/app-logger/app-logger'
import { geminiGenerateContent } from '~/utils/gemini/gemini-rest'
import { InfraError, ValidationError } from '~/utils/error-handler'
export const GEMINI_CLIP_DURATION_SECONDS = 30
export const GEMINI_PRO_DEFAULT_DURATION_SECONDS = 120

const collectGeminiMusicTextParts = (
  parts: GeminiMusicResponsePart[]
): string | undefined => {
  const text = parts
    .filter((part) => part.thought !== true)
    .map((part) => part.text?.trim())
    .filter((part): part is string => part !== undefined && part.length > 0)

  return text.length > 0 ? text.join('\n\n') : undefined
}

const outputFormatFromAudioMimeType = (mimeType: string | undefined): string | undefined => {
  if (!mimeType) {
    return undefined
  }
  const normalized = mimeType.toLowerCase().split(';')[0]?.trim()
  switch (normalized) {
    case 'audio/mpeg':
    case 'audio/mp3':
      return 'mp3'
    case 'audio/wav':
    case 'audio/wave':
    case 'audio/x-wav':
      return 'wav'
    default:
      return normalized?.startsWith('audio/') ? normalized.slice('audio/'.length) : undefined
  }
}

export const writeGeminiMusicInlineAudio = async (
  parts: GeminiMusicResponsePart[],
  musicPath: string
): Promise<{
  audioMimeType?: string | undefined
  outputFormat?: string | undefined
  generatedText?: string | undefined
}> => {
  const generatedText = collectGeminiMusicTextParts(parts)
  for (const part of parts) {
    const audioData = part.inlineData?.data
    const mimeType = part.inlineData?.mimeType
    if (!audioData || part.thought === true) {
      continue
    }
    if (mimeType && !mimeType.startsWith('audio/')) {
      continue
    }

    const audioBytes = Buffer.from(audioData, 'base64')
    if (audioBytes.byteLength === 0) {
      continue
    }

    await Bun.write(musicPath, audioBytes)
    return {
      audioMimeType: mimeType,
      outputFormat: outputFormatFromAudioMimeType(mimeType),
      ...(generatedText ? { generatedText } : {})
    }
  }

  throw InfraError('Gemini music generation completed without audio inline data', { stage: 'music:gemini' })
}

const readProvidedLyrics = async (lyricsFile: string): Promise<string> => {
  const file = Bun.file(lyricsFile)
  if (!await file.exists()) {
    throw InfraError(`Music lyrics file not found: ${lyricsFile}`, { stage: 'music:gemini' })
  }

  const text = (await file.text()).trim()
  if (text.length === 0) {
    throw ValidationError(`Music lyrics file is empty: ${lyricsFile}`, { stage: 'music:gemini' })
  }

  return text
}

const resolveIntendedDurationSeconds = (
  model: GeminiMusicModel,
  durationSeconds: number | undefined
): number => {
  if (durationSeconds !== undefined && (!Number.isFinite(durationSeconds) || durationSeconds <= 0)) {
    throw ValidationError(`Invalid music duration: ${durationSeconds}`, { stage: 'music:gemini' })
  }

  if (model === 'lyria-3-clip-preview') {
    if (durationSeconds !== undefined && durationSeconds !== GEMINI_CLIP_DURATION_SECONDS) {
      l.warn(`Gemini Lyria 3 Clip always generates ${GEMINI_CLIP_DURATION_SECONDS}s clips; ignoring --duration ${durationSeconds}`)
    }
    return GEMINI_CLIP_DURATION_SECONDS
  }

  return durationSeconds ?? GEMINI_PRO_DEFAULT_DURATION_SECONDS
}

const buildGeminiMusicPrompt = async (
  prompt: string,
  options: {
    model: GeminiMusicModel
    durationSeconds?: number | undefined
    lyricsFile?: string | undefined
    forceInstrumental?: boolean | undefined
  }
): Promise<{ prompt: string, lyricsSource: Step7MusicMetadata['lyricsSource'], intendedDurationSeconds: number }> => {
  const parts = [prompt.trim()]
  const intendedDurationSeconds = resolveIntendedDurationSeconds(options.model, options.durationSeconds)

  if (options.model === 'lyria-3-pro-preview' && options.durationSeconds !== undefined) {
    parts.push(`Create a song that is about ${options.durationSeconds} seconds long.`)
  }

  if (options.forceInstrumental) {
    if (options.lyricsFile) {
      l.warn('Ignoring --lyrics-file because --instrumental was provided for Gemini music generation')
    }
    parts.push('Instrumental only, no vocals.')
    return {
      prompt: parts.join('\n\n'),
      lyricsSource: 'none',
      intendedDurationSeconds
    }
  }

  if (options.lyricsFile) {
    const lyrics = await readProvidedLyrics(options.lyricsFile)
    parts.push(`Lyrics:\n${lyrics}`)
    return {
      prompt: parts.join('\n\n'),
      lyricsSource: 'provided',
      intendedDurationSeconds
    }
  }

  return {
    prompt: parts.join('\n\n'),
    lyricsSource: 'generated',
    intendedDurationSeconds
  }
}

export const runGeminiMusicGen = async (
  prompt: string,
  outputDir: string,
  options: {
    model: GeminiMusicModel
    durationSeconds?: number | undefined
    lyricsFile?: string | undefined
    forceInstrumental?: boolean | undefined
  }
): Promise<{ musicPath: string, metadata: Step7MusicMetadata }> => {
  const apiKey = requireApiKey('GEMINI_API_KEY', 'music:gemini', 'Gemini music generation')

  const { prompt: geminiPrompt, lyricsSource, intendedDurationSeconds } = await buildGeminiMusicPrompt(prompt, options)
  const musicPath = `${outputDir}/generated-music.mp3`

  logGenStatus('music', 'gemini', options.model, 'started')

  const startTime = Date.now()
  const response = await geminiGenerateContent(apiKey, {
    model: options.model,
    contents: geminiPrompt
  })

  const parts = response.candidates?.flatMap((candidate) => candidate.content?.parts ?? []) ?? []
  const audioResult = await writeGeminiMusicInlineAudio(parts, musicPath)
  const processingTime = Date.now() - startTime
  const musicFile = Bun.file(musicPath)

  logGenCompleted('music', 'gemini', options.model, processingTime, [musicPath])

  const metadata: Step7MusicMetadata = {
    musicService: 'gemini',
    musicModel: options.model,
    processingTime,
    musicFileName: 'generated-music.mp3',
    musicFileSize: musicFile.size,
    musicDurationMs: intendedDurationSeconds * 1000,
    lyricsSource,
    ...audioResult
  }

  return { musicPath, metadata }
}
