import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import {
  runCommand,
  fileExists,
  findLatestDirectory,
  cleanupTestOutput,
  STABLE_TTS_MD_PATH,
  STABLE_TTS_MD_TITLE,
} from '../../../../../test-utils/test-helpers'
import { budgetedTest, E2E_TEST_TIMEOUT_MS } from '../../../../../test-utils/budget'
import { readCanonicalManifest, readCanonicalRecord } from '../../../../../test-utils/manifest-helpers'
import { isKittenTtsSetupReady } from '~/cli/commands/process-steps/step-4-tts/tts-local/kitten/kitten-tts-targets'
import { hasCachedKittenTtsModel } from '~/cli/commands/process-steps/step-4-tts/tts-local/kitten/kitten-tts-model-cache'
import { SUPPORTED_KITTEN_TTS_MODELS } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import type { CanonicalAudioProviderProjection } from '~/types'

const kittenModelCases = [
  { model: 'kitten-tts-micro', speaker: 'Bella', budgetKey: 'tts-kitten-micro' },
  { model: 'kitten-tts-mini', speaker: 'Luna', budgetKey: 'tts-kitten-mini' },
  { model: 'kitten-tts-nano', speaker: 'Rosie', budgetKey: 'tts-kitten-nano' },
  { model: 'kitten-tts-nano-0.8-int8', speaker: 'Hugo', budgetKey: 'tts-kitten-nano-0.8-int8' },
] as const

const ensureKittenTtsTestSetup = async (): Promise<void> => {
  const runtimeReady = await isKittenTtsSetupReady()
  const modelReadiness = await Promise.all(SUPPORTED_KITTEN_TTS_MODELS.map(async (model) =>
    await hasCachedKittenTtsModel(model)
  ))
  if (runtimeReady && modelReadiness.every(Boolean)) return

  const setup = await runCommand(
    ['src/cli/create-cli.ts', 'setup', '--step', 'tts'],
    { testName: 'prepare Kitten TTS local E2E prerequisites' }
  )
  expect(setup.exitCode).toBe(0)
  expect(await isKittenTtsSetupReady()).toBe(true)
  expect(await Promise.all(SUPPORTED_KITTEN_TTS_MODELS.map(async (model) =>
    await hasCachedKittenTtsModel(model)
  ))).toEqual(SUPPORTED_KITTEN_TTS_MODELS.map(() => true))
}

describe('kitten-tts', () => {
  describe('tts command', () => {
    beforeAll(async () => {
      await ensureKittenTtsTestSetup()
      await cleanupTestOutput(STABLE_TTS_MD_TITLE)
    }, E2E_TEST_TIMEOUT_MS)

    afterAll(async () => {
      await cleanupTestOutput(STABLE_TTS_MD_TITLE)
    })

    for (const kittenModelCase of kittenModelCases) {
      budgetedTest(kittenModelCase.budgetKey, `${kittenModelCase.model} with --kitten-voice ${kittenModelCase.speaker} generates speech.wav`, async () => {
        await cleanupTestOutput(STABLE_TTS_MD_TITLE)
        const testName = `${kittenModelCase.model} with --kitten-voice ${kittenModelCase.speaker} generates speech.wav`

        const result = await runCommand(
          [
            'src/cli/create-cli.ts',
            'tts',
            STABLE_TTS_MD_PATH,
            '--provider',
            `kitten=${kittenModelCase.model}`,
            '--tts-voice',
            kittenModelCase.speaker
          ],
          { testName }
        )

        expect(result.exitCode).toBe(0)

        const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_TTS_MD_TITLE, result.outputRoot)
        expect(outputDir).not.toBeNull()

        if (outputDir) {
          const audioExists = await fileExists(`${outputDir}/speech.wav`)
          expect(audioExists).toBe(true)

          const audioFile = Bun.file(`${outputDir}/speech.wav`)
          expect(audioFile.size).toBeGreaterThan(0)

          const metadata = await readCanonicalRecord(outputDir) as {
            tts?: Array<{ ttsService?: string; ttsModel?: string; chunkCount?: number; audioFileName?: string; speaker?: string }>
          }
          expect(metadata.tts?.[0]?.ttsService).toBe('kitten')
          expect(metadata.tts?.[0]?.ttsModel).toBe(kittenModelCase.model)
          expect(metadata.tts?.[0]?.chunkCount).toBeGreaterThan(0)
          expect(metadata.tts?.[0]?.audioFileName).toBe('speech.wav')
          expect(metadata.tts?.[0]?.speaker).toBe(kittenModelCase.speaker)
        }
      }, E2E_TEST_TIMEOUT_MS)
    }

    budgetedTest('tts-kitten-mini', 'missing hosted credentials block the ready Kitten peer before dispatch', async () => {
      await cleanupTestOutput(STABLE_TTS_MD_TITLE)

      const result = await runCommand(
        [
          'src/cli/create-cli.ts',
          'tts',
          STABLE_TTS_MD_PATH,
          '--provider',
          'kitten=kitten-tts-mini',
          '--provider',
          'openai=gpt-4o-mini-tts-2025-12-15'
        ],
        {
          env: {
            OPENAI_API_KEY: ''
          }
        }
      )

      expect(result.exitCode).not.toBe(0)
      expect(result.stderr + result.stdout).toContain('TTS execution readiness failed before synthesis')
      expect(result.stderr + result.stdout).toContain('OPENAI_API_KEY environment variable is required')

      const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_TTS_MD_TITLE, result.outputRoot)
      expect(outputDir).not.toBeNull()

      if (outputDir) {
        expect(await fileExists(`${outputDir}/speech.wav`)).toBe(false)
        expect(await fileExists(`${outputDir}/speech-kitten-kitten-tts-mini.wav`)).toBe(false)
        expect(await fileExists(`${outputDir}/speech-openai-gpt-4o-mini-tts-2025-12-15.wav`)).toBe(false)

        const manifest = await readCanonicalManifest(outputDir)
        const kitten = manifest.items[0]?.providers.find((provider) => provider.service === 'kitten')
        const openai = manifest.items[0]?.providers.find((provider) => provider.service === 'openai')
        const kittenProjection = kitten?.result?.['ttsAudio'] as CanonicalAudioProviderProjection | undefined
        const openaiProjection = openai?.result?.['ttsAudio'] as CanonicalAudioProviderProjection | undefined
        expect(kitten).toMatchObject({ status: 'failed', attempts: 0 })
        expect(openai).toMatchObject({ status: 'failed', attempts: 0 })
        expect(kittenProjection?.readinessAttempts[0]).toMatchObject({
          status: 'ready',
          admissionDisposition: 'peer-blocked',
          error: {
            code: 'peer-readiness-failed',
            blockedReason: 'dependency-readiness-failed'
          }
        })
        expect(openaiProjection?.readinessAttempts[0]).toMatchObject({
          status: 'blocked',
          admissionDisposition: 'self-blocked',
          error: {
            code: 'provider-credential-not-configured',
            blockedReason: 'provider-credential-not-configured'
          }
        })
      }
    }, E2E_TEST_TIMEOUT_MS)

    test('missing credentials block every hosted target before dispatch', async () => {
      await cleanupTestOutput(STABLE_TTS_MD_TITLE)

      const result = await runCommand(
        [
          'src/cli/create-cli.ts',
          'tts',
          STABLE_TTS_MD_PATH,
          '--provider',
          'openai=gpt-4o-mini-tts-2025-12-15',
          '--provider',
          'gemini=gemini-3.1-flash-tts-preview'
        ],
        {
          env: {
            OPENAI_API_KEY: '',
            GEMINI_API_KEY: ''
          }
        }
      )

      expect(result.exitCode).not.toBe(0)
      expect(result.stderr + result.stdout).toContain('TTS execution readiness failed before synthesis')
      expect(result.stderr + result.stdout).toContain('OPENAI_API_KEY environment variable is required')
      expect(result.stderr + result.stdout).toContain('GEMINI_API_KEY environment variable is required')

      const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_TTS_MD_TITLE, result.outputRoot)
      expect(outputDir).not.toBeNull()
      if (outputDir) {
        expect(await fileExists(`${outputDir}/speech.wav`)).toBe(false)
        expect(await fileExists(`${outputDir}/speech-openai-gpt-4o-mini-tts-2025-12-15.wav`)).toBe(false)
        expect(await fileExists(`${outputDir}/speech-gemini-gemini-3.1-flash-tts-preview.wav`)).toBe(false)

        const manifest = await readCanonicalManifest(outputDir)
        expect(manifest.items[0]?.providers).toHaveLength(2)
        for (const provider of manifest.items[0]?.providers ?? []) {
          const projection = provider.result?.['ttsAudio'] as CanonicalAudioProviderProjection | undefined
          expect(provider).toMatchObject({ status: 'failed', attempts: 0 })
          expect(projection?.readinessAttempts[0]).toMatchObject({
            status: 'blocked',
            admissionDisposition: 'self-blocked',
            error: {
              code: 'provider-credential-not-configured',
              blockedReason: 'provider-credential-not-configured'
            }
          })
        }
      }
    })
  })

  describe('validation', () => {
    test('rejects invalid kitten model', async () => {
      const result = await runCommand(
        ['src/cli/create-cli.ts', 'tts', STABLE_TTS_MD_PATH, '--provider', 'kitten=invalid-model'],
      )

      expect(result.exitCode).not.toBe(0)
    })

    test('rejects invalid kitten speaker', async () => {
      const result = await runCommand(
        ['src/cli/create-cli.ts', 'tts', STABLE_TTS_MD_PATH, '--provider', 'kitten=kitten-tts-mini', '--tts-voice', 'InvalidVoice'],
      )

      expect(result.exitCode).not.toBe(0)
    })
  })
})
