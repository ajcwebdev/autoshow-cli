import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { runGeminiMusicGen } from '~/cli/commands/process-steps/step-7-music/music-services/music-gemini/run-gemini-music-gen'
import { writeGeminiMusicInteraction } from '~/cli/commands/process-steps/step-7-music/music-services/music-gemini/gemini-music-interactions'
import { collectMusicTargets, buildMusicArtifactMap } from '~/cli/commands/process-steps/step-7-music/music-targets'
import { runMusicTargets } from '~/cli/commands/process-steps/step-7-music/run-music-gen'
import { finalizeMusicResumeArtifacts } from '~/cli/commands/setup-and-utilities/resume/generation/music-resume'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { estimateMusicCosts } from '~/cli/commands/process-steps/step-7-music/music-utils/music-pricing'
import { geminiCreateMusicInteraction } from '~/utils/gemini/gemini-rest'
import { withTempDir } from '../../../test-utils/temp-dirs'
import { restoreEnv, snapshotEnv } from '../../../test-utils/rest-contract-helpers'

const bytes = Buffer.from([1, 2, 3, 4])
const audio = { type: 'audio', mime_type: 'audio/mpeg', data: bytes.toString('base64') }
const text = '[Verse]\nA synthetic tune'
const structure = '{"sections":[{"name":"verse","start":0}]}'
const response = { status: 'completed', steps: [
  { type: 'thought', content: [{ type: 'text', text: 'private' }] },
  { type: 'model_output', content: [{ type: 'text', text }, audio] },
  { type: 'model_output', content: [{ type: 'text', text: structure }, audio] }
] }

const withMock = async (body: unknown, fn: (calls: Array<{ url: string, init?: RequestInit | undefined }>) => Promise<void>, status = 200) => {
  const env = snapshotEnv(['GEMINI_API_KEY'])
  const original = globalThis.fetch
  const calls: Array<{ url: string, init?: RequestInit | undefined }> = []
  try {
    restoreEnv({ GEMINI_API_KEY: 'synthetic-key' })
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      calls.push({ url: String(input), init })
      return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
    }) as typeof fetch
    await fn(calls)
  } finally {
    globalThis.fetch = original
    restoreEnv(env)
  }
}

describe('Lyria 3.5 Interactions contracts', () => {
  test('selectors, all expansion and defaults preserve Pro; pricing is per request', () => {
    expect(buildOptsFromFlags({ 'gemini-music': true }).geminiMusicModels).toEqual(['lyria-3-pro-preview'])
    expect(buildOptsFromFlags({ 'all-music': true }).geminiMusicModels).toEqual(['lyria-3-pro-preview', 'lyria-3.5'])
    expect(collectMusicTargets(buildOptsFromFlags({ 'gemini-music': 'lyria-3.5' }))[0]?.model).toBe('lyria-3.5')
    for (const duration of [30, 120, 180]) {
      expect(estimateMusicCosts({ geminiMusicModels: ['lyria-3.5'], musicDuration: duration })[0]).toMatchObject({ totalCost: 8, durationSeconds: duration })
    }
    expect(() => estimateMusicCosts({ geminiMusicModels: ['lyria-3.5'], musicDuration: 0 })).toThrow('Invalid music duration')
  })

  test('multipart audio, lyrics and structure survive promotion, artifact mapping and additive resume', async () => {
    await withTempDir('autoshow-lyria-', async (dir) => withMock(response, async (calls) => {
      const targets = collectMusicTargets({ geminiMusicModels: ['lyria-3.5'], musicDuration: 60 })
      const result = await runMusicTargets(targets, 'Synthetic instrumental', dir)
      expect(calls).toHaveLength(1)
      expect(calls[0]?.url).toBe('https://generativelanguage.googleapis.com/v1beta/interactions')
      expect(new Headers(calls[0]?.init?.headers).get('x-goog-api-key')).toBe('synthetic-key')
      expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ model: 'lyria-3.5', input: 'Synthetic instrumental\n\nCreate a song that is about 60 seconds long.' })
      const metadata = await finalizeMusicResumeArtifacts(result.metadata, dir)
      expect(metadata[0]?.generatedText).toBe(`${text}\n\n${structure}`)
      const artifacts = Object.values(buildMusicArtifactMap(metadata))
      expect(artifacts).toHaveLength(3)
      for (const fileName of artifacts) {
        const file = Bun.file(join(dir, fileName))
        expect(await file.exists()).toBe(true)
        if (fileName.endsWith('.mp3')) expect(Buffer.from(await file.arrayBuffer())).toEqual(bytes)
        else expect(await file.text()).toBe(`${text}\n\n${structure}`)
      }
      expect(calls).toHaveLength(1)
    }))
  })

  test('two models retain independent primary files and new-model sidecars', async () => {
    const mixed = { ...response, candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/mpeg', data: audio.data } }] } }] }
    await withTempDir('autoshow-lyria-', async (dir) => withMock(mixed, async (calls) => {
      const result = await runMusicTargets(collectMusicTargets({ geminiMusicModels: ['lyria-3-pro-preview', 'lyria-3.5'] }), 'Synthetic prompt', dir)
      expect(calls).toHaveLength(2)
      expect(calls.map(call => call.url).some(url => url.endsWith('/interactions'))).toBe(true)
      expect(calls.map(call => call.url).some(url => url.endsWith(':generateContent'))).toBe(true)
      const artifacts = Object.values(buildMusicArtifactMap(result.metadata))
      expect(new Set(artifacts).size).toBe(4)
      for (const name of artifacts) expect(await Bun.file(join(dir, name)).exists()).toBe(true)
    }))
  })

  test('provided lyrics and instrumental instructions use text input without exact-duration fields', async () => {
    await withTempDir('autoshow-lyria-', async (dir) => withMock(response, async (calls) => {
      const lyricsFile = join(dir, 'lyrics.txt')
      await Bun.write(lyricsFile, text)
      const provided = await runGeminiMusicGen('A synthetic song', dir, { model: 'lyria-3.5', lyricsFile })
      expect(provided.metadata.lyricsSource).toBe('provided')
      expect(JSON.parse(String(calls[0]?.init?.body)).input).toContain(`Lyrics:\n${text}`)
      const instrumental = await runGeminiMusicGen('A synthetic song', dir, { model: 'lyria-3.5', forceInstrumental: true })
      expect(instrumental.metadata.lyricsSource).toBe('none')
      expect(JSON.parse(String(calls[1]?.init?.body)).input).toContain('Instrumental only, no vocals.')
    }))
  })

  test('legacy Pro keeps GenerateContent payload and inline audio decoding', async () => {
    await withTempDir('autoshow-lyria-', async (dir) => withMock({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/mpeg', data: audio.data } }] } }] }, async (calls) => {
      const result = await runGeminiMusicGen('Synthetic prompt', dir, { model: 'lyria-3-pro-preview' })
      expect(calls[0]?.url).toEndWith('/models/lyria-3-pro-preview:generateContent')
      expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ contents: [{ role: 'user', parts: [{ text: 'Synthetic prompt' }] }] })
      expect(Buffer.from(await Bun.file(result.musicPath).arrayBuffer())).toEqual(bytes)
    }))
  })

  test('missing audio, malformed blocks, non-MP3 and incomplete/provider-error results fail', async () => {
    await withTempDir('autoshow-lyria-', async (dir) => {
      for (const bad of [null, {}, { steps: [] }, { ...response, status: 'failed' }, { ...response, status: 'in_progress' }, { ...response, error: { message: 'blocked' } },
        ...[{ type: 'text', text }, { ...audio, data: '%%%' }, { ...audio, data: '' }, { ...audio, mime_type: 'audio/wav' }].map(part => ({ steps: [{ type: 'model_output', content: [part] }] }))]) {
        await expect(writeGeminiMusicInteraction(bad, dir)).rejects.toThrow('Lyria 3.5')
      }
      expect(await Bun.file(join(dir, 'generated-music.mp3')).exists()).toBe(false)
    })
  })

  test('invalid durations and unexposed modalities fail before HTTP', async () => {
    await withTempDir('autoshow-lyria-', async (dir) => withMock(response, async (calls) => {
      for (const durationSeconds of [0, -1, NaN, Infinity]) await expect(runGeminiMusicGen('Synthetic prompt', dir, { model: 'lyria-3.5', durationSeconds })).rejects.toThrow('Invalid music duration')
      await expect(runGeminiMusicGen(' ', dir, { model: 'lyria-3.5' })).rejects.toThrow('nonempty text prompt')
      await expect(geminiCreateMusicInteraction('synthetic-key', [{ type: 'audio' }] as unknown as string)).rejects.toThrow('text prompt')
      expect(calls).toHaveLength(0)
    }))
  })

  test('HTTP provider errors propagate without a second generation request', async () => {
    await withTempDir('autoshow-lyria-', async (dir) => withMock({ error: { message: 'Synthetic permission failure', code: 403 } }, async (calls) => {
      await expect(runGeminiMusicGen('Synthetic prompt', dir, { model: 'lyria-3.5' })).rejects.toThrow('Synthetic permission failure')
      expect(calls).toHaveLength(1)
    }, 403))
  })
})
