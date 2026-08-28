import { describe,expect,test } from 'bun:test'
import { mkdir,readdir,symlink } from 'node:fs/promises'
import { join } from 'node:path'
import { runTtsForTargets } from '~/cli/commands/process-steps/step-4-tts/run-tts'
import { createInlineTtsSourceIdentity,createSingleTurnTtsDialoguePlan } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/generic-dialogue-plan'
import type { TtsTarget } from '~/types'
import { canonicalTargetKey } from '~/utils/canonical-target-key'
import { withTempDir } from '../../../test-utils/temp-dirs'

const FIXED_TIME = new Date(0).toISOString()
const MODEL = 'gpt-4o-mini-tts-2025-12-15'

const createOpenAiFixture = (onRun: () => void = () => {}): TtsTarget => ({
  service: 'openai',
  model: MODEL,
  voice: 'alloy',
  operation: 'tts-synthesis',
  transport: 'hosted-api',
  targetKey: canonicalTargetKey('tts-synthesis', 'openai', MODEL, 'hosted-api'),
  run: async () => {
    onRun()
    throw new Error('Safe-artifact lifecycle fixture must not invoke the target runner.')
  }
})

const sourceContextFor = (text: string) => {
  const sourceIdentity = createInlineTtsSourceIdentity(text)
  return {
    sourceIdentity,
    dialoguePlan: createSingleTurnTtsDialoguePlan(sourceIdentity, text, FIXED_TIME)
  }
}

const withOpenAiCredential = async <T>(operation: () => Promise<T>): Promise<T> => {
  const previous = process.env['OPENAI_API_KEY']
  process.env['OPENAI_API_KEY'] = 'safe-artifact-local-fixture'
  try {
    return await operation()
  } finally {
    if (previous === undefined) delete process.env['OPENAI_API_KEY']
    else process.env['OPENAI_API_KEY'] = previous
  }
}

describe('safe artifact integration in the TTS lifecycle', () => {
  test('render preparation rejects a preexisting symbolic-link ancestor before outside writes or target calls', async () => {
    await withTempDir('autoshow-tts-render-link-lifecycle-', async (dir) => {
      const outputDir = join(dir, 'run')
      const outside = join(dir, 'outside-render')
      const text = 'Do not follow a render directory link.'
      let targetCalls = 0
      const target = createOpenAiFixture(() => { targetCalls += 1 })
      const targetDir = join(outputDir, 'providers', target.targetKey as string)
      await mkdir(targetDir, { recursive: true })
      await mkdir(outside)
      await symlink(outside, join(targetDir, 'renders'))

      await withOpenAiCredential(async () => {
        await expect(runTtsForTargets(
          text,
          outputDir,
          {},
          [target],
          sourceContextFor(text)
        )).rejects.toThrow(/symbolic link/i)
      })

      expect(targetCalls).toBe(0)
      expect(await readdir(outside)).toEqual([])
    })
  })

  test('branch-only readiness rejects a preexisting symbolic-link ancestor before outside writes or target calls', async () => {
    await withTempDir('autoshow-tts-branch-link-lifecycle-', async (dir) => {
      const outputDir = join(dir, 'run')
      const outside = join(dir, 'outside-branch')
      const text = 'Do not follow a branch directory link.'
      let targetCalls = 0
      const target = createOpenAiFixture(() => { targetCalls += 1 })
      const targetDir = join(outputDir, 'providers', target.targetKey as string)
      await mkdir(targetDir, { recursive: true })
      await mkdir(outside)
      await symlink(outside, join(targetDir, 'branches'))
      const sourceContext = sourceContextFor(text)

      await expect(runTtsForTargets(text, outputDir, {}, [target], {
        ...sourceContext,
        executionReadiness: [{
          targetKey: target.targetKey as string,
          accountState: 'not-configured',
          status: 'blocked',
          error: {
            phase: 'readiness',
            code: 'provider-credential-not-configured',
            message: 'Fixture readiness blocks synthesis.',
            retryable: false,
            blockedReason: 'provider-credential-not-configured'
          }
        }]
      })).rejects.toThrow(/symbolic link/i)

      expect(targetCalls).toBe(0)
      expect(await readdir(outside)).toEqual([])
    })
  })
})
