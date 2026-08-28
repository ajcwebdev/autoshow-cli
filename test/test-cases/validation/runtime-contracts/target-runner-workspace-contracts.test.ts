import { afterEach, describe, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { runTargets } from '~/cli/commands/process-steps/target-runner'
import { runHostedTtsChunkPipeline } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-pipeline'
import { makeTempDir } from '../../../test-utils/temp-dirs'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(async root => await rm(root, { recursive: true, force: true })))
})

describe('target runner workspace preservation', () => {
  test('retains completed hosted chunks when a later chunk fails', async () => {
    const root = await makeTempDir('autoshow-hosted-chunks-')
    roots.push(root)

    await expect(runHostedTtsChunkPipeline({
      provider: 'inworld',
      providerLabel: 'Inworld AI',
      model: 'realtime-tts-2',
      speaker: 'Carter',
      chunks: ['first', 'second'],
      outputDir: root,
      chunkExtension: 'mp3',
      chunkConcurrency: 1,
      startTime: Date.now(),
      fetchChunkAudio: async ({ chunkIndex }) => {
        if (chunkIndex === 2) throw new TypeError('fetch failed')
        return new Uint8Array([1, 2, 3])
      }
    })).rejects.toThrow('fetch failed')

    expect(await Bun.file(join(root, 'speech-inworld-chunk-001.mp3')).exists()).toBe(true)
  })

  test('retains a failed TTS workspace but removes it after successful finalization', async () => {
    const root = await makeTempDir('autoshow-target-workspace-')
    roots.push(root)
    const target = { service: 'inworld', model: 'realtime-tts-2' }
    const failedWorkspace = join(root, '.tts-tmp-failed')

    await expect(runTargets({
      targets: [target],
      outputDir: root,
      stepLabel: 'TTS',
      noProviderMessage: 'No provider produced audio',
      useWorkspaceForSingleTarget: true,
      preserveWorkspaceOnFailure: true,
      getWorkspaceDir: () => failedWorkspace,
      runTarget: async (_target, workspace) => {
        await Bun.write(join(workspace, 'paid-segment.wav'), new Uint8Array([1, 2, 3]))
        throw new Error('simulated provider failure')
      },
      finalizeTarget: async (_target, result: string) => result
    })).rejects.toThrow('simulated provider failure')

    expect(await Bun.file(join(failedWorkspace, 'paid-segment.wav')).exists()).toBe(true)

    const successfulWorkspace = join(root, '.tts-tmp-success')
    await runTargets({
      targets: [target],
      outputDir: root,
      stepLabel: 'TTS',
      noProviderMessage: 'No provider produced audio',
      useWorkspaceForSingleTarget: true,
      preserveWorkspaceOnFailure: true,
      getWorkspaceDir: () => successfulWorkspace,
      runTarget: async (_target, workspace) => {
        await Bun.write(join(workspace, 'segment.wav'), new Uint8Array([1]))
        return 'ok'
      },
      finalizeTarget: async (_target, result) => result
    })

    expect(await Bun.file(successfulWorkspace).exists()).toBe(false)
  })
})
