import { expect, test } from 'bun:test'
import { checkFfmpegEncoder, selectLyricsEncoder } from '~/cli/commands/process-steps/step-7-music/lyrics-video/lyrics-ffmpeg-plan'
import type { ExecResult } from '~/types'

const result = (exitCode: number): ExecResult => ({ exitCode, stdout: 'h264_nvenc', stderr: exitCode ? 'Cannot load libcuda.so.1' : '', stdoutBytes: 10, stderrBytes: 0, stdoutTruncated: false, stderrTruncated: false })

test('a listed hardware encoder is rejected when it cannot encode a frame', async () => {
  let args: string[] = []
  const usable = await checkFfmpegEncoder('h264_nvenc', async (_command, input, options) => {
    args = input ?? []
    expect(options?.signal).toBeDefined()
    return result(1)
  })
  expect(usable).toBe(false)
  expect(args).toContain('lavfi')
  expect(args).toContain('h264_nvenc')
  expect(args).not.toContain('-encoders')
})

test('working encoders are accepted and failed or timed out probes allow CPU fallback', async () => {
  expect(await checkFfmpegEncoder('h264_nvenc', async () => result(0))).toBe(true)
  expect(await checkFfmpegEncoder('h264_nvenc', async () => { throw new Error('deadline') })).toBe(false)
  const probes: string[] = []
  expect(await selectLyricsEncoder(async encoder => { probes.push(encoder); return false }, 'linux')).toBe('libx264')
  expect(probes).toEqual(['h264_nvenc', 'h264_amf'])
  expect(await selectLyricsEncoder(async encoder => encoder === 'h264_amf', 'linux')).toBe('h264_amf')
})
