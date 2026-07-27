import { expect, test } from 'bun:test'
import {
  fileExists,
  runCommand,
} from './test-helpers'
import { E2E_TEST_TIMEOUT_MS } from './budget'
import {
  defineBudgetedLiveServiceTest,
  defineInvalidModelTest,
  requireConfiguredEnvVar,
  runCommandAndExpectOutputDir,
  withOutputLifecycle
} from './service-test-kit'
import { readRunMetadata } from './manifest-helpers'
import type { MusicExpectedLyricsSource, MusicServiceModelCase } from '~/types'

const MUSIC_GEN_TITLE = 'music-gen'
export const defineMusicServiceTest = ({
  models,
  provider,
  musicService,
  envVarKey,
}: {
  models: MusicServiceModelCase[]
  provider: string
  musicService: string
  envVarKey: string
}): void => {
  defineInvalidModelTest(`rejects invalid ${musicService} music model`, [
    'src/cli/create-cli.ts',
    'music',
    'an ambient piano song',
    '--provider',
    `${provider}=invalid-model`
  ])

  withOutputLifecycle(MUSIC_GEN_TITLE)

  for (const { model, prompt, extraArgs, expectedLyricsSource, commandTimeoutMs, testTimeoutMs } of models) {
    const budgetKey = `music-${musicService}-${model}`
    defineBudgetedLiveServiceTest(budgetKey, `${musicService} ${model} generates music and metadata`, [envVarKey], async () => {
      await requireConfiguredEnvVar(envVarKey, `${envVarKey} not configured`)

      const outputDir = await runCommandAndExpectOutputDir(
        MUSIC_GEN_TITLE,
        [
          'src/cli/create-cli.ts',
          'music',
          prompt,
          '--provider',
          `${provider}=${model}`,
          ...(extraArgs ?? [])
        ],
        commandTimeoutMs === undefined ? undefined : { timeoutMs: commandTimeoutMs }
      )

      const musicExists = await fileExists(`${outputDir}/generated-music.mp3`)
      expect(musicExists).toBe(true)
      const musicFile = Bun.file(`${outputDir}/generated-music.mp3`)
      expect(musicFile.size).toBeGreaterThan(0)

      const metadata = await readRunMetadata(outputDir) as {
        music?: Array<{ musicService?: string; musicModel?: string; musicFileName?: string; lyricsSource?: MusicExpectedLyricsSource }>
      }
      expect(metadata.music?.[0]?.musicService).toBe(musicService)
      expect(metadata.music?.[0]?.musicModel).toBe(model)
      expect(metadata.music?.[0]?.musicFileName).toBe('generated-music.mp3')
      if (expectedLyricsSource) {
        expect(metadata.music?.[0]?.lyricsSource).toBe(expectedLyricsSource)
      }
    }, testTimeoutMs ?? E2E_TEST_TIMEOUT_MS)
  }
}

export const defineMusicServicePriceTests = ({
  models,
  provider,
  musicService,
}: {
  models: MusicServiceModelCase[]
  provider: string
  musicService: string
}): void => {
  for (const { model } of models) {
    test(`${musicService} ${model} --price prints estimate`, async () => {
      const result = await runCommand([
        'src/cli/create-cli.ts',
        'music',
        'an ambient piano song',
        '--provider',
        `${provider}=${model}`,
        '--price'
      ])

      expect(result.exitCode).toBe(0)
    }, E2E_TEST_TIMEOUT_MS)
  }
}
