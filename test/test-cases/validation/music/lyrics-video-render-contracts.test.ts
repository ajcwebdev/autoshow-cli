import { describe, expect, test } from 'bun:test'
import { buildImageBackgroundFilter } from '~/cli/commands/process-steps/step-7-music/lyrics-video/render'

describe('lyrics video render filters', () => {
  test('image background filter omits eq when ffmpeg lacks the filter', () => {
    const withEq = buildImageBackgroundFilter({
      width: 1920,
      height: 1080,
      includeEq: true
    })
    const withoutEq = buildImageBackgroundFilter({
      width: 1920,
      height: 1080,
      includeEq: false
    })

    expect(withEq).toContain(',eq=brightness=-0.15:contrast=0.85')
    expect(withoutEq).not.toContain('eq=brightness')
    expect(withoutEq).toContain('scale=1920:1080:force_original_aspect_ratio=increase:flags=lanczos')
    expect(withoutEq).toContain(',crop=1920:1080')
    expect(withoutEq).toContain(',vignette=PI/3.5')
  })
})
