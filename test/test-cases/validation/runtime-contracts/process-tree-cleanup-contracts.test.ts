import { describe, expect, test } from 'bun:test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildSetupNoOrphansArgs, SETUP_NO_ORPHANS_MARKER, shouldRelaunchSetupWithNoOrphans } from '~/cli/create-cli'
import { createFileTtsSourceIdentity, createSingleTurnTtsDialoguePlan } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/generic-dialogue-plan'
import { ttsResumeConfig } from '~/cli/commands/setup-and-utilities/resume/generation/tts-resume'
import type { TtsOptions } from '~/types'
import { withTempDir } from '../../../test-utils/temp-dirs'
import { withEnv } from '../../../test-utils/rest-contract-helpers'
import { materializeFailedProviderState, successfulTarget, ttsTarget } from '../resume-manifests/tts-resume-fixtures'

const isProcessAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const waitFor = async (predicate: () => boolean | Promise<boolean>, label: string): Promise<void> => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await predicate()) return
    await Bun.sleep(25)
  }
  throw new Error(`Timed out waiting for ${label}`)
}

describe('staged process-tree cleanup', () => {
  test('test and setup entrypoints opt into no-orphans without a global bunfig setting', async () => {
    expect(shouldRelaunchSetupWithNoOrphans(['setup'], {})).toBe(true)
    expect(shouldRelaunchSetupWithNoOrphans(['setup'], {}, true)).toBe(false)
    expect(shouldRelaunchSetupWithNoOrphans(['setup'], { [SETUP_NO_ORPHANS_MARKER]: '1' })).toBe(false)
    expect(shouldRelaunchSetupWithNoOrphans(['extract'], {})).toBe(false)
    expect(buildSetupNoOrphansArgs('/app/create-cli.ts', ['setup', '--doctor'])).toEqual([
      '--no-env-file',
      '--no-orphans',
      '/app/create-cli.ts',
      'setup',
      '--doctor'
    ])

    const packageJson = await readFile('package.json', 'utf8')
    const bunfig = await readFile('bunfig.toml', 'utf8')
    expect(JSON.parse(packageJson).scripts.t).toContain('--no-orphans')
    expect(bunfig).not.toMatch(/^noOrphans\s*=|^\[run\][\s\S]*?noOrphans\s*=/m)
  })

  test('interrupting a no-orphans parent exits it, kills its descendant, and preserves recoverable artifacts', async () => {
    await withTempDir('autoshow-no-orphans-contract-', async (dir) => {
      const pidPath = join(dir, 'descendant.pid')
      const proc = Bun.spawn([
        process.execPath,
        '--no-env-file',
        '--no-orphans',
        'test/test-utils/fixtures/no-orphans-parent.fixture.ts',
        pidPath,
        dir
      ], {
        stdin: 'ignore',
        stdout: 'pipe',
        stderr: 'pipe'
      })
      let descendantPid = 0
      try {
        await waitFor(async () => await Bun.file(pidPath).exists(), 'descendant PID publication')
        descendantPid = Number.parseInt((await readFile(pidPath, 'utf8')).trim(), 10)
        expect(descendantPid).toBeGreaterThan(0)
        expect(isProcessAlive(descendantPid)).toBe(true)

        proc.kill('SIGTERM')
        const exitCode = await proc.exited
        expect(Number.isInteger(exitCode)).toBe(true)
        await waitFor(() => !isProcessAlive(descendantPid), 'descendant termination')

        expect(await readFile(join(dir, 'recoverable-output', 'completed-segment.wav'), 'utf8')).toBe('completed local fixture audio')
        expect(JSON.parse(await readFile(join(dir, 'recoverable-tts-work', 'reconciliation.json'), 'utf8'))).toEqual({ state: 'ambiguous' })
      } finally {
        proc.kill('SIGKILL')
        if (descendantPid > 0 && isProcessAlive(descendantPid)) process.kill(descendantPid, 'SIGKILL')
      }
    })
  }, 10_000)

  test('ambiguous TTS recovery stays blocked without deleting completed slot evidence', async () => {
    await withTempDir('autoshow-interrupted-tts-recovery-', async (dir) => {
      const outputDir = join(dir, 'output-fixture')
      const retainedSlotDir = join(dir, 'retained-slot-fixture')
      await mkdir(outputDir)
      await mkdir(retainedSlotDir)
      const completedSlotPath = join(retainedSlotDir, 'completed-slot.wav')
      await writeFile(completedSlotPath, 'already synthesized fixture audio')

      const text = 'Preserve completed slot evidence after interruption.'
      const inputPath = join(dir, 'source.txt')
      await writeFile(inputPath, text)
      const sourceIdentity = await createFileTtsSourceIdentity(inputPath, text)
      const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, text)
      const target = { ...ttsTarget(), voice: 'alloy' }
      await withEnv({ OPENAI_API_KEY: 'interrupted-tts-local-fixture' }, async () => {
        const failed = await materializeFailedProviderState({
          rootDir: outputDir,
          target,
          text,
          sourceIdentity,
          dialoguePlan,
          admitted: true
        })
        const stateBeforeReconciliation = structuredClone(failed)
        let providerCalls = 0
        const candidate = successfulTarget(target, () => { providerCalls += 1 })

        await expect(ttsResumeConfig.runMissingTargets(
          [candidate],
          text,
          outputDir,
          {} as TtsOptions,
          {
            outputDir,
            runtimeOptions: {},
            targets: [candidate],
            existingEntries: [],
            currentManifestMetadata: {},
            currentProviderStates: [failed]
          }
        )).rejects.toThrow('automatic redispatch is blocked')

        expect(providerCalls).toBe(0)
        expect(failed).toEqual(stateBeforeReconciliation)
        expect(await readFile(completedSlotPath, 'utf8')).toBe('already synthesized fixture audio')
      })
    })
  })

  test('production filesystem cleanup uses node fs APIs instead of shell subprocesses', async () => {
    const files = [
      'src/cli/commands/process-steps/step-0-metadata/metadata-targets/metadata-input-collection.ts',
      'src/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils.ts',
      'src/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-pipeline.ts',
      'src/cli/commands/process-steps/step-4-tts/tts-services/tts-elevenlabs/elevenlabs-native-dialogue.ts',
      'src/cli/commands/process-steps/step-4-tts/tts-services/fish/fish-native-dialogue.ts',
      'src/cli/commands/process-steps/step-4-tts/tts-services/tts-mistral/run-mistral-tts.ts',
      'src/cli/commands/process-steps/step-4-tts/tts-services/tts-minimax/run-minimax-tts.ts',
      'src/cli/commands/process-steps/step-4-tts/tts-services/hume/hume-native-utterances.ts'
    ]
    const source = (await Promise.all(files.map(async (path) => await readFile(path, 'utf8')))).join('\n')
    expect(source).not.toContain('Bun.$')
    expect(source).not.toContain('rm -f')
    expect(source).not.toContain('test -d')
    expect(source).toContain("from 'node:fs/promises'")
    expect(source).toContain('await rm(')
    expect(source).toContain('await stat(')
  })
})
