import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { expect } from 'bun:test'
import { budgetedTest, E2E_TEST_TIMEOUT_MS } from '../../../../../test-utils/budget'
import { findLatestDirectory, runCommand, STABLE_TTS_MD_PATH, STABLE_TTS_MD_TITLE } from '../../../../../test-utils/test-helpers'
import { readCanonicalRecord } from '../../../../../test-utils/manifest-helpers'
import { requireConfiguredEnvVar } from '../../../../../test-utils/service-test-kit'
import { mistralRefAudioPath, mistralTtsModel } from './cases'
import { expectArtifact } from '../../../../../test-utils/value-assertions'

budgetedTest('tts-mistral-voxtral-mini-tts-2603-ref-audio', 'mistral reference audio generates speech.wav', async () => {
  await requireConfiguredEnvVar('MISTRAL_API_KEY', 'MISTRAL_API_KEY is required for Mistral TTS test')

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--provider',
    `mistral=${mistralTtsModel}`,
    '--tts-ref-audio',
    mistralRefAudioPath
  ])

  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_TTS_MD_TITLE, result.outputRoot)
  expect(outputDir).not.toBeNull()

  if (outputDir) {
    await expectArtifact(`${outputDir}/speech.wav`)

    const metadata = await readCanonicalRecord(outputDir) as {
      tts?: Array<{ ttsService?: string, ttsModel?: string, speaker?: string }>
    }
    expect(metadata.tts?.[0]?.ttsService).toBe('mistral')
    expect(metadata.tts?.[0]?.ttsModel).toBe(mistralTtsModel)
    const refAudioSha256 = createHash('sha256').update(await readFile(mistralRefAudioPath)).digest('hex')
    expect(metadata.tts?.[0]?.speaker).toBe(`ref_audio:sha256_${refAudioSha256}`)
  }
}, E2E_TEST_TIMEOUT_MS)
