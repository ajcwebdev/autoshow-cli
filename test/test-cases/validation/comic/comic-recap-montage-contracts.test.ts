import { describe,expect,test } from 'bun:test'
import { join } from 'node:path'
import {
isRecapMontageBeat,
resolvePreviousEpisodeScriptsDirectory,
} from '~/cli/commands/process-steps/step-8-comic/comic-utils/recap-montage-utils'

describe('comic source coverage contracts', () => {

  test('recap montage resolver maps Episode 4 scripts to Episode 3 scripts', () => {
    expect(resolvePreviousEpisodeScriptsDirectory('input/example/scripts/04-script/01-recap.md'))
      .toBe(join('input', 'example', 'scripts', '03-script'))
  })

  test('recap montage cue detection requires both episode and montage in the same beat', () => {
    expect(isRecapMontageBeat({
      text: 'Cue a rapid montage of Episode 3, every scene sped up.',
    })).toBe(true)

    expect(isRecapMontageBeat({
      text: 'Cue a rapid montage of prior chaos.',
    })).toBe(false)

    expect(isRecapMontageBeat({
      text: 'Episode 3 ended badly for everyone.',
    })).toBe(false)
  })
})
