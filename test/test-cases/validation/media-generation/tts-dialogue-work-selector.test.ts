import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runDialogueWorkSelector } from '~/cli/commands/process-steps/step-4-tts/dialogue-work-selector'
import { runMultiSpeakerTts } from '~/cli/commands/process-steps/step-4-tts/run-multi-speaker-tts'
import type { Deferred, TtsOptions, TtsTarget } from '~/types'
import { createMockWavBytes } from '../../../test-utils/media-fixtures'
import { waitFor } from '../../../test-utils/wait-for'

const createDeferred = (): Deferred => {
  let resolve = (): void => undefined
  let reject = (_reason?: unknown): void => undefined
  const promise = new Promise<void>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(async (root) => await rm(root, { recursive: true, force: true })))
})

describe('bounded dialogue work selector', () => {
  test('caps setup and returns source order under reverse completion', async () => {
    const root = await mkdtemp(join(tmpdir(), 'autoshow-dialogue-selector-order-'))
    roots.push(root)
    const releases = Array.from({ length: 6 }, createDeferred)
    const started: number[] = []
    const completed: number[] = []
    const signals = new Set<AbortSignal>()
    let active = 0
    let maxActive = 0

    const selected = runDialogueWorkSelector({
      concurrency: 3,
      workspaceRoot: root,
      work: releases.map((release, index) => ({
        workspaceName: `.work-${index}`,
        run: async (workspaceDir, signal) => {
          signals.add(signal)
          started.push(index)
          active += 1
          maxActive = Math.max(maxActive, active)
          await writeFile(join(workspaceDir, 'started.txt'), String(index))
          await release.promise
          completed.push(index)
          active -= 1
          return `result-${index}`
        }
      }))
    })

    await waitFor(() => started.length === 3)
    expect(started.slice().sort((left, right) => left - right)).toEqual([0, 1, 2])

    releases[2]?.resolve()
    await waitFor(() => completed.includes(2) && started.includes(3))
    releases[1]?.resolve()
    await waitFor(() => completed.includes(1) && started.includes(4))
    releases[0]?.resolve()
    await waitFor(() => completed.includes(0) && started.includes(5))
    releases[5]?.resolve()
    await waitFor(() => completed.includes(5))
    releases[4]?.resolve()
    await waitFor(() => completed.includes(4))
    releases[3]?.resolve()

    expect(await selected).toEqual([
      'result-0',
      'result-1',
      'result-2',
      'result-3',
      'result-4',
      'result-5'
    ])
    expect(completed).toEqual([2, 1, 0, 5, 4, 3])
    expect(maxActive).toBe(3)
    expect(signals.size).toBe(1)
    expect([...signals][0]?.aborted).toBe(false)
    expect(await readdir(root)).toEqual([])
  })

  test('aborts active work, stops queued admission, and removes every workspace after failure', async () => {
    const root = await mkdtemp(join(tmpdir(), 'autoshow-dialogue-selector-cancel-'))
    roots.push(root)
    const bothStarted = createDeferred()
    const started: number[] = []
    let cancellationObserved = false

    const selected = runDialogueWorkSelector({
      concurrency: 2,
      workspaceRoot: root,
      work: Array.from({ length: 5 }, (_, index) => ({
        workspaceName: `.work-${index}`,
        run: async (workspaceDir: string, signal: AbortSignal) => {
          started.push(index)
          await writeFile(join(workspaceDir, 'started.txt'), String(index))
          if (started.length === 2) bothStarted.resolve()
          await bothStarted.promise

          if (index === 0) {
            throw new Error('blocking dialogue failure')
          }
          if (index === 1) {
            if (!signal.aborted) {
              await new Promise<void>((resolveAbort) => {
                signal.addEventListener('abort', () => resolveAbort(), { once: true })
              })
            }
            cancellationObserved = signal.aborted
            return 'cancelled'
          }
          throw new Error(`queued work ${index} was admitted`)
        }
      }))
    })

    await expect(selected).rejects.toThrow('blocking dialogue failure')
    expect(started.slice().sort((left, right) => left - right)).toEqual([0, 1])
    expect(cancellationObserved).toBe(true)
    expect(await readdir(root)).toEqual([])
  })

  test('multi-speaker target invocations receive cancellation and leave no segment workspaces', async () => {
    const root = await mkdtemp(join(tmpdir(), 'autoshow-dialogue-selector-integration-'))
    roots.push(root)
    const bothStarted = createDeferred()
    const started: number[] = []
    const signals: AbortSignal[] = []
    const target: TtsTarget = {
      service: 'openai',
      model: 'mock-openai-tts',
      multiSpeakerStrategy: 'segment-and-concat',
      run: async (_text, workspaceDir, _options, invocation): Promise<never> => {
        if (!invocation?.signal) {
          throw new Error('missing dialogue invocation signal')
        }
        started.push(invocation.sourceIndex)
        signals.push(invocation.signal)
        await writeFile(join(workspaceDir, 'partial-audio.wav'), 'partial')
        if (started.length === 2) bothStarted.resolve()
        await bothStarted.promise

        if (invocation.sourceIndex === 0) {
          throw new Error('mock provider blocked the dialogue')
        }
        if (!invocation.signal.aborted) {
          await new Promise<void>((resolveAbort) => {
            invocation.signal?.addEventListener('abort', () => resolveAbort(), { once: true })
          })
        }
        throw new Error('active sibling cancelled')
      }
    }
    const options: TtsOptions = {
      ttsChunkConcurrency: 2,
      ttsDialogueFormat: 'labeled',
      ttsSpeakers: ['Alice=alloy', 'Bob=onyx']
    }

    await expect(runMultiSpeakerTts([
      'Alice: First.',
      'Bob: Second.',
      'Alice: Third.',
      'Bob: Fourth.'
    ].join('\n'), root, target, options)).rejects.toThrow('mock provider blocked the dialogue')

    expect(started.slice().sort((left, right) => left - right)).toEqual([0, 1])
    expect(signals).toHaveLength(2)
    expect(signals.every((signal) => signal.aborted)).toBe(true)
    expect(await readdir(join(root, 'segments'))).toEqual([])
  })

  test('multi-speaker target invocations receive immutable controls by canonical turn ID', async () => {
    const root = await mkdtemp(join(tmpdir(), 'autoshow-dialogue-selector-controls-'))
    roots.push(root)
    const audioBytes = createMockWavBytes()
    const observed: Array<{ sourceId: string, controls: unknown, frozen: boolean }> = []
    const target: TtsTarget = {
      service: 'openai',
      model: 'mock-openai-tts',
      multiSpeakerStrategy: 'segment-and-concat',
      run: async (_text, workspaceDir, _options, invocation) => {
        if (!invocation) throw new Error('missing explicit turn invocation')
        observed.push({
          sourceId: invocation.sourceId,
          controls: invocation.controls,
          frozen: Object.isFrozen(invocation.controls)
        })
        const audioPath = join(workspaceDir, 'speech.wav')
        await Bun.write(audioPath, audioBytes)
        return {
          audioPath,
          metadata: {
            ttsService: 'openai',
            ttsModel: 'mock-openai-tts',
            speaker: invocation.voice.value,
            processingTime: 0,
            audioFileName: 'speech.wav',
            audioFileSize: audioBytes.byteLength,
            chunkCount: 1
          }
        }
      }
    }
    const options: TtsOptions = {
      ttsChunkConcurrency: 1,
      ttsDialogueFormat: 'labeled',
      ttsSpeakers: ['Alice=alloy', 'Bob=onyx'],
      ttsTurnControls: {
        'dialogue-turn-001': { openai: { speed: 0.8 } },
        'dialogue-turn-002': { openai: { speed: 1.2 } },
        'dialogue-turn-003': { openai: { speed: 0.8 } }
      }
    }

    await runMultiSpeakerTts([
      'Alice: First.',
      'Bob: Second.',
      'Alice: Third.'
    ].join('\n'), root, target, options)

    expect(observed).toEqual([
      { sourceId: 'dialogue-turn-001', controls: { speed: 0.8 }, frozen: true },
      { sourceId: 'dialogue-turn-002', controls: { speed: 1.2 }, frozen: true },
      { sourceId: 'dialogue-turn-003', controls: { speed: 0.8 }, frozen: true }
    ])
  })
})
