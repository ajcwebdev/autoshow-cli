import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { assertSpokenTextMatch, assertTtsSpokenText } from '../../../../test-utils/tts-transcript-oracle'
import { withTempDir } from '../../../../test-utils/temp-dirs'
import { withEnv } from '../../../../test-utils/rest-contract-helpers'

describe('TTS transcript oracle', () => {
  test('an untranscribable take is retained and described instead of vanishing with the run', async () => {
    await withTempDir('oracle-evidence-', async dir => {
      const artifactsDir = join(dir, 'artifacts')
      const audio = join(dir, 'speech.wav')
      // Stands in for any take the oracle cannot decode: the bytes must survive the failure.
      const bytes = new TextEncoder().encode('not audio at all')
      await Bun.write(audio, bytes)

      const failure = await withEnv({ AUTOSHOW_TEST_ARTIFACTS_DIR: artifactsDir }, async () =>
        await assertTtsSpokenText(audio, 'anything').then(() => null, (error: unknown) => String(error)))

      expect(failure).toContain('Whisperfile oracle could not transcribe')
      expect(failure).toContain(`${bytes.byteLength} bytes`)
      const retainedPath = /Audio retained at (\S+)/.exec(failure ?? '')?.[1]
      expect(retainedPath).toBeDefined()
      expect(new Uint8Array(await Bun.file(retainedPath!).arrayBuffer())).toEqual(bytes)
    })
  }, 120_000)

  test('a decoded transcript is still judged on its spoken words, not on transport success', () => {
    expect(() => assertSpokenTextMatch('welcome back to the show', 'welcome back to the show')).not.toThrow()
    expect(() => assertSpokenTextMatch('welcome back to the show', 'entirely different words here')).toThrow(/word error rate/)
  })
})
