import { writeGeminiMusicInteraction } from './gemini-music-interactions'
import type { GeminiMusicModel, Step7MusicMetadata } from '~/types'
import { logGenCompleted, logGenStatus } from '~/cli/commands/command-shared/generation-command-utils'
import { resolveCredential } from '~/utils/validate/env-utils'
import * as l from '~/utils/app-logger/app-logger'
import { geminiCreateMusicInteraction } from '~/utils/gemini/gemini-rest'
import { InfraError, ValidationError } from '~/utils/error-handler'
export const GEMINI_DEFAULT_DURATION_SECONDS = 120

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

const resolveIntendedDurationSeconds = (durationSeconds: number | undefined): number => {
  if (durationSeconds !== undefined && (!Number.isFinite(durationSeconds) || durationSeconds <= 0)) {
    throw ValidationError(`Invalid music duration: ${durationSeconds}`, { stage: 'music:gemini' })
  }

  return durationSeconds ?? GEMINI_DEFAULT_DURATION_SECONDS
}

const buildGeminiMusicPrompt = async (
  prompt: string,
  options: {
    durationSeconds?: number | undefined
    lyricsFile?: string | undefined
    forceInstrumental?: boolean | undefined
  }
): Promise<{ prompt: string, lyricsSource: Step7MusicMetadata['lyricsSource'], intendedDurationSeconds: number }> => {
  if (typeof prompt !== 'string' || !prompt.trim()) {
    throw ValidationError('Gemini music requires a nonempty text prompt', { stage: 'music:gemini' })
  }
  const parts = [prompt.trim()]
  const intendedDurationSeconds = resolveIntendedDurationSeconds(options.durationSeconds)

  if (options.durationSeconds !== undefined) {
    parts.push(`Create a song that is about ${options.durationSeconds} seconds long.`)
  }

  if (options.forceInstrumental) {
    if (options.lyricsFile) {
      l.warn('Ignoring --lyrics-file because --instrumental was provided for Gemini music generation', { category: 'pipeline' })
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
  const apiKey = resolveCredential('gemini', 'require', { stage: 'music:gemini', description: 'Gemini music generation' })

  const { prompt: geminiPrompt, lyricsSource, intendedDurationSeconds } = await buildGeminiMusicPrompt(prompt, options)
  const musicPath = `${outputDir}/generated-music.mp3`

  logGenStatus('music', 'gemini', options.model, 'started')

  const startTime = Date.now()
  const audioResult = await writeGeminiMusicInteraction(await geminiCreateMusicInteraction(apiKey, geminiPrompt), outputDir)
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
