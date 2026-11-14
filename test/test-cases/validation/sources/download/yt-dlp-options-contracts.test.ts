import { describe, expect, test } from 'bun:test'
import { dirname } from 'node:path'
import { buildYtDlpDownloadArgs, buildYtDlpListArgs, buildYtDlpMetadataArgs, buildYtDlpSubtitleDownloadArgs } from '~/cli/commands/command-shared/shared-yt-dlp-options'
import { getDenoBinary, getFfmpegBinary } from '~/utils/runtime-paths'
import { getRuntimeCachePath } from '~/utils/runtime-state'

const valueAfter = (args: string[], flag: string): string | undefined => {
  const index = args.indexOf(flag)
  if (index === -1) {
    return undefined
  }
  return args[index + 1]
}

const indexesOf = (args: string[], value: string): number[] =>
  args.flatMap((arg, index) => arg === value ? [index] : [])

describe('yt-dlp option contracts', () => {
  test('all generated downloader operations select managed helpers/cache and disable ambient configuration/plugins', async () => {
    const url = 'https://example.test/watch?v=managed-tools'
    const operations = await Promise.all([
      buildYtDlpDownloadArgs(url, '/tmp/autoshow'),
      buildYtDlpMetadataArgs(url),
      buildYtDlpSubtitleDownloadArgs(url, '/tmp/autoshow', 'manual'),
      buildYtDlpListArgs(url)
    ])
    for (const args of operations) {
      expect(valueAfter(args, '--js-runtimes')).toBe(`deno:${getDenoBinary()}`)
      expect(args.indexOf('--no-js-runtimes')).toBeLessThan(args.indexOf('--js-runtimes'))
      expect(valueAfter(args, '--ffmpeg-location')).toBe(dirname(getFfmpegBinary()))
      expect(valueAfter(args, '--cache-dir')).toBe(getRuntimeCachePath('yt-dlp'))
      expect(args).toContain('--ignore-config')
      expect(args).toContain('--no-plugin-dirs')
      expect(args).toContain('--no-remote-components')
      expect(args.at(-1)).toBe(url)
    }
  })

  test('default download args request best audio fallback', async () => {
    const args = await buildYtDlpDownloadArgs('https://example.com/watch?v=1', '/tmp/autoshow')

    expect(valueAfter(args, '--format')).toBe('bestaudio/best')
    expect(args).not.toContain('--merge-output-format')
  })

  test('best-quality download args request best video plus best audio', async () => {
    const args = await buildYtDlpDownloadArgs('https://example.com/watch?v=1', '/tmp/autoshow', {
      bestQuality: true
    })

    expect(valueAfter(args, '--format')).toBe('bestvideo+bestaudio/best')
    expect(valueAfter(args, '--merge-output-format')).toBe('mkv/mp4/webm')
  })

  test('passthrough args are exact argv tokens before the final URL', async () => {
    const args = await buildYtDlpDownloadArgs('https://example.com/watch?v=1', '/tmp/autoshow', {
      ytDlpPassthroughArgs: ['--write-thumbnail', '--postprocessor-args', 'ffmpeg:-vf scale=1280:720']
    })

    expect(args.at(-1)).toBe('https://example.com/watch?v=1')
    expect(args.indexOf('--write-thumbnail')).toBeGreaterThan(args.indexOf('--no-progress'))
    expect(args.indexOf('--write-thumbnail')).toBeLessThan(args.length - 1)
    expect(valueAfter(args, '--postprocessor-args')).toBe('ffmpeg:-vf scale=1280:720')
  })

  test('passthrough format args appear after AutoShow default format', async () => {
    const args = await buildYtDlpDownloadArgs('https://example.com/watch?v=1', '/tmp/autoshow', {
      ytDlpPassthroughArgs: ['--format', 'bestvideo+bestaudio']
    })
    const formatIndexes = indexesOf(args, '--format')
    const firstFormatIndex = formatIndexes[0] as number
    const secondFormatIndex = formatIndexes[1] as number

    expect(formatIndexes.length).toBe(2)
    expect(args[firstFormatIndex + 1]).toBe('bestaudio/best')
    expect(args[secondFormatIndex + 1]).toBe('bestvideo+bestaudio')
    expect(secondFormatIndex).toBeGreaterThan(firstFormatIndex)
  })

  test('empty passthrough produces the same args as undefined passthrough', async () => {
    const withoutPassthrough = await buildYtDlpDownloadArgs('https://example.com/watch?v=1', '/tmp/autoshow')
    const withEmptyPassthrough = await buildYtDlpDownloadArgs('https://example.com/watch?v=1', '/tmp/autoshow', {
      ytDlpPassthroughArgs: []
    })

    expect(withEmptyPassthrough).toEqual(withoutPassthrough)
  })

  test('downloaded path tracking args stay after passthrough and before URL', async () => {
    const args = await buildYtDlpDownloadArgs('https://example.com/watch?v=1', '/tmp/autoshow', {
      ytDlpPassthroughArgs: ['--format', 'bestaudio'],
      downloadedPathLogFile: '/tmp/autoshow/files.txt'
    })

    expect(args.at(-1)).toBe('https://example.com/watch?v=1')
    expect(valueAfter(args, '--print-to-file')).toBe('after_move:filepath')
    expect(args[args.indexOf('--print-to-file') + 2]).toBe('/tmp/autoshow/files.txt')
    expect(args.indexOf('--print-to-file')).toBeGreaterThan(args.lastIndexOf('--format'))
    expect(args.indexOf('--print-to-file')).toBeLessThan(args.length - 1)
  })
})
