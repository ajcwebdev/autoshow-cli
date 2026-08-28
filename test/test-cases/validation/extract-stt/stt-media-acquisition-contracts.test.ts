import { afterEach, expect, test } from 'bun:test'
import { dirname, extname, join } from 'node:path'
import { prepareSttMedia } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/media'
import { commandExists, exec } from '~/utils/cli-utils'
import { pathExists } from '~/utils/filesystem'
import { createTempDirTracker } from '../../../test-utils/temp-dirs'

const tempDirs = createTempDirTracker('autoshow-stt-acquire-')
const makeTempDir = tempDirs.make

afterEach(tempDirs.cleanup)

test('STT media acquisition stages and materializes local source media without persistent reuse', async () => {
  if (!commandExists('ffmpeg') || !commandExists('ffprobe')) {
    throw new Error('ffmpeg and ffprobe are required for STT media acquisition coverage')
  }

  const source = { filePath: join(process.cwd(), 'input/examples/audio/0-audio-short.mp3') }
  const firstOutputDir = await makeTempDir('autoshow-stt-acquire-first-')
  const secondOutputDir = await makeTempDir('autoshow-stt-acquire-second-')

  const firstPrepared = await prepareSttMedia({
    source,
    targets: [{ service: 'whisper', model: 'tiny', local: true }],
    outputDir: firstOutputDir
  })
  const secondPrepared = await prepareSttMedia({
    source,
    targets: [{ service: 'whisper', model: 'tiny', local: true }],
    outputDir: secondOutputDir
  })

  try {
    expect(firstPrepared.executionArtifacts.sourceMediaPath).not.toBe(secondPrepared.executionArtifacts.sourceMediaPath)
    expect(dirname(firstPrepared.executionArtifacts.sourceMediaPath)).not.toBe(dirname(secondPrepared.executionArtifacts.sourceMediaPath))
    expect(await pathExists(firstPrepared.executionArtifacts.sourceMediaPath)).toBe(true)
    expect(await pathExists(secondPrepared.executionArtifacts.sourceMediaPath)).toBe(true)
    expect(await pathExists(firstPrepared.outputArtifacts.sourceMediaPath)).toBe(true)
    expect(await pathExists(secondPrepared.outputArtifacts.sourceMediaPath)).toBe(true)
    expect(firstPrepared.durationSeconds).toBeGreaterThan(0)
    expect(secondPrepared.durationSeconds).toBeGreaterThan(0)
  } finally {
    await firstPrepared.cleanup?.()
    await secondPrepared.cleanup?.()
  }

  expect(await pathExists(firstPrepared.executionArtifacts.sourceMediaPath)).toBe(false)
  expect(await pathExists(firstPrepared.outputArtifacts.sourceMediaPath)).toBe(true)
  expect(await pathExists(secondPrepared.executionArtifacts.sourceMediaPath)).toBe(false)
  expect(await pathExists(secondPrepared.outputArtifacts.sourceMediaPath)).toBe(true)
})

test('STT media acquisition keeps local and hosted staging profiles distinct', async () => {
  if (!commandExists('ffmpeg') || !commandExists('ffprobe')) {
    throw new Error('ffmpeg and ffprobe are required for STT media acquisition profile coverage')
  }

  const sourceDir = await makeTempDir('autoshow-stt-acquire-source-')
  const sourcePath = join(sourceDir, 'stereo-high-bitrate.mp3')
  const generated = await exec('ffmpeg', [
    '-hide_banner',
    '-loglevel', 'error',
    '-f', 'lavfi',
    '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-t', '1',
    '-b:a', '192k',
    sourcePath
  ])
  expect(generated.exitCode).toBe(0)

  const source = { filePath: sourcePath }
  const localPrepared = await prepareSttMedia({
    source,
    targets: [{ service: 'whisper', model: 'tiny', local: true }],
    outputDir: await makeTempDir('autoshow-stt-acquire-local-')
  })
  const hostedPrepared = await prepareSttMedia({
    source,
    targets: [{ service: 'gladia', model: 'solaria-3', local: false }],
    outputDir: await makeTempDir('autoshow-stt-acquire-hosted-')
  })

  try {
    expect(await pathExists(localPrepared.executionArtifacts.sourceMediaPath)).toBe(true)
    expect(await pathExists(hostedPrepared.executionArtifacts.sourceMediaPath)).toBe(true)
    expect(extname(localPrepared.executionArtifacts.sourceMediaPath)).toBe('.mp3')
    expect(extname(hostedPrepared.executionArtifacts.sourceMediaPath)).toBe('.m4a')
    expect(localPrepared.outputArtifacts.sourceMediaPath).not.toBe(hostedPrepared.outputArtifacts.sourceMediaPath)
  } finally {
    await localPrepared.cleanup?.()
    await hostedPrepared.cleanup?.()
  }
})
