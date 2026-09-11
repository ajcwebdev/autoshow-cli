import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { prepareLocalSttInput } from '~/cli/commands/stt/local/local-audio-normalize'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('local STT input preparation', () => {
  test('whisperfile passthrough keeps supported source audio instead of converting to wav', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'autoshow-local-stt-passthrough-'))
    tempDirs.push(dir)
    const source = join(dir, 'episode.mp3')
    await writeFile(source, 'not-real-mp3')

    const prepared = await prepareLocalSttInput(source, 'autoshow-whisperfile-', {
      passthroughExtensions: ['.wav', '.mp3', '.flac', '.ogg'],
      convertFormat: 'mp3'
    })

    expect(prepared.audioPath).toBe(source)
    await prepared.cleanup()
  })
})
