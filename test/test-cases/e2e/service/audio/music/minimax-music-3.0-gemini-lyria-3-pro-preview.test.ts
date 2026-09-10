import { expect } from 'bun:test'
import { runCommand, findLatestDirectory } from '../../../../../test-utils/test-helpers'
import { readCanonicalRecord } from '../../../../../test-utils/manifest-helpers'
import { defineBudgetedLiveServiceTest } from '../../../../../test-utils/service-test-kit'
import { expectArtifact, requireDefined } from '../../../../../test-utils/value-assertions'

const MUSIC_GEN_TITLE = 'music-gen'

defineBudgetedLiveServiceTest('music-multi-minimax-music-3.0-gemini-lyria-3-pro-preview', 'multi-provider run produces per-provider filenames and array metadata', ['MINIMAX_API_KEY', 'GEMINI_API_KEY'], async () => {
  const result = await runCommand(
    [
      'src/cli/create-cli.ts',
      'music',
      'bright acoustic pop with handclaps and a catchy chorus',
      '--provider', 'minimax=music-3.0',
      '--provider', 'gemini=lyria-3-pro-preview',
      '--lyrics-file', 'input/examples/tts/1-tts.md',
    ],
  )

  expect(result.exitCode).toBe(0)

  const outputDir = requireDefined(await findLatestDirectory(MUSIC_GEN_TITLE, result.outputRoot), `output directory for ${MUSIC_GEN_TITLE}`)

  await expectArtifact(`${outputDir}/generated-music-minimax-music-3.0.mp3`)
  await expectArtifact(`${outputDir}/generated-music-gemini-lyria-3-pro-preview.mp3`)

  const metadata = await readCanonicalRecord(outputDir) as {
    music?: Array<{ musicService?: string; musicModel?: string; lyricsSource?: string }>
  }
  const musicArr = metadata.music ?? []
  expect(musicArr.some(m =>
    m.musicService === 'minimax'
    && m.musicModel === 'music-3.0'
    && m.lyricsSource === 'provided'
  )).toBe(true)
  expect(musicArr.some(m =>
    m.musicService === 'gemini'
    && m.musicModel === 'lyria-3-pro-preview'
    && m.lyricsSource === 'provided'
  )).toBe(true)
})
