import { describe, expect, test } from 'bun:test'
import {
  buildAss,
  buildImageBackgroundFilter,
  buildLyricsVideoFfmpegArgs,
  buildTranscriptAss
} from '~/cli/commands/process-steps/step-7-music/lyrics-video/render'
import type { CaptionCue } from '~/types'
import { sha256Bytes } from '~/utils/value-helpers'

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

  test('lyrics and transcript ASS output remains byte-identical over cue fixtures', () => {
    const options = { width: 640, height: 360, font: 'Test Font', title: 'A {Title}\nLine' }
    const cues: CaptionCue[] = [
      { index: 0, start: 0, end: 1.234, text: 'First \\ {line}' },
      { index: 1, start: 1.234, end: 3.5, text: 'Second\nline' }
    ]

    expect(sha256Bytes(buildAss(options, cues))).toBe('69537f242a6555449421cc5a7bbb682b430dd78849d6420d11c62d4a4b0b0820')

    const transcriptCues = [
      { ...cues[0]!, speaker: 'speaker-A' },
      { ...cues[1]!, speaker: '2' }
    ]
    expect(sha256Bytes(buildTranscriptAss(options, transcriptCues))).toBe('fb2b3a9201903d93d09155306300f2a7e1ab9194a884568fb095052f4d9696ce')
  })

  test('ffmpeg argv is exact across the background and overlay matrix', () => {
    const common = {
      audioPath: 'audio.mp3',
      outputRelativePath: 'output.mp4',
      width: 640,
      height: 360,
      fps: 30,
      encoderSettings: ['-c:v', 'test-encoder'],
      includeEq: true
    } as const
    const tail = [
      '-map', '[v]',
      '-r', '30',
      '-c:v', 'test-encoder',
      '-pix_fmt', 'yuv420p',
      '-metadata:s:v:0', 'rotate=0',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-shortest',
      'output.mp4'
    ]
    const spectrogram = '[0:a]showspectrum=s=640x360:mode=combined:color=intensity:scale=log,format=yuv420p,vignette=PI/7[bg]'
    const image = '[0:v]scale=640:360:force_original_aspect_ratio=increase:flags=lanczos,crop=640:360,setpts=PTS-STARTPTS,eq=brightness=-0.15:contrast=0.85,vignette=PI/3.5[bg]'

    expect(buildLyricsVideoFfmpegArgs({
      ...common,
      overlay: { kind: 'ass', path: 'captions.ass' }
    })).toEqual([
      '-y', '-i', 'audio.mp3',
      '-filter_complex', `${spectrogram};[bg]ass=filename=captions.ass[v]`,
      ...tail.slice(0, 2), '-map', '0:a', ...tail.slice(2)
    ])
    expect(buildLyricsVideoFfmpegArgs({
      ...common,
      imageRelativePath: 'cover.png',
      overlay: { kind: 'ass', path: 'captions.ass' }
    })).toEqual([
      '-y', '-noautorotate', '-loop', '1', '-i', 'cover.png', '-i', 'audio.mp3',
      '-filter_complex', `${image};[bg]ass=filename=captions.ass[v]`,
      ...tail.slice(0, 2), '-map', '1:a', ...tail.slice(2)
    ])
    expect(buildLyricsVideoFfmpegArgs({
      ...common,
      overlay: { kind: 'frames', path: 'frames.txt' }
    })).toEqual([
      '-y', '-i', 'audio.mp3', '-f', 'concat', '-safe', '0', '-i', 'frames.txt',
      '-filter_complex', `${spectrogram};[bg][1:v]overlay=format=auto[v]`,
      ...tail.slice(0, 2), '-map', '0:a', ...tail.slice(2)
    ])
    expect(buildLyricsVideoFfmpegArgs({
      ...common,
      imageRelativePath: 'cover.png',
      overlay: { kind: 'frames', path: 'frames.txt' }
    })).toEqual([
      '-y', '-noautorotate', '-loop', '1', '-i', 'cover.png', '-f', 'concat', '-safe', '0', '-i', 'frames.txt', '-i', 'audio.mp3',
      '-filter_complex', `${image};[bg][1:v]overlay=format=auto[v]`,
      ...tail.slice(0, 2), '-map', '2:a', ...tail.slice(2)
    ])
  })
})
