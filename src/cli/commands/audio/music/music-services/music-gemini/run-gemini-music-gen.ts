import { writeGeminiMusicInteraction } from './gemini-music-interactions'
import type { GeminiMusicModel, Step7MusicMetadata } from '~/types'
import { runMusicGeneration } from '~/cli/commands/command-shared/media-generation/music-generation-scaffold'
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
): Promise<{ musicPath: string, metadata: Step7MusicMetadata }> =>
  await runMusicGeneration({
    service: 'gemini',
    model: options.model,
    outputDir,
    prepare: async () => await buildGeminiMusicPrompt(prompt, options),
    execute: async (context, prepared) => {
      const audioResult = await writeGeminiMusicInteraction(
        await geminiCreateMusicInteraction(context.apiKey, prepared.prompt),
        context.outputDir
      )

      return {
        artifactPaths: [context.artifactPath()],
        metadata: {
          musicDurationMs: prepared.intendedDurationSeconds * 1000,
          lyricsSource: prepared.lyricsSource,
          ...audioResult
        }
      }
    }
  })
