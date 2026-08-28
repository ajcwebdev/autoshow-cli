import { describe, expect, test } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import {
  createManifest,
  createManifestItem,
  PIPELINE_MANIFEST_FILE,
  readManifest,
  updateSingleManifestProviderState,
  updateManifest,
  writeManifest
} from '~/cli/commands/process-steps/pipeline-manifest'
import { PROCESS_COMMANDS } from '~/types'
import type { CanonicalAudioProviderProjection, PipelineManifest, PipelineProviderState, TtsTarget } from '~/types'
import { policySkippedTtsProviderState } from '../../../test-utils/tts-provider-state-fixtures'
import { withTempDir } from '../../../test-utils/temp-dirs'
import { canonicalTargetKey } from '~/utils/canonical-target-key'
import { runTtsForTargets } from '~/cli/commands/process-steps/step-4-tts/run-tts'
import { createInlineTtsSourceIdentity, createSingleTurnTtsDialoguePlan } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/generic-dialogue-plan'
import { appendCurrentTtsProviderState } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-artifacts'
import { bindTtsDialoguePlanArtifact, materializeTtsDialoguePlanArtifact } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/item-dialogue-plan-artifact'
import { requireDefined } from '../../../test-utils/value-assertions'

const provider = (
  rootDir: string,
  status: PipelineProviderState['status']
): PipelineProviderState => ({
  service: 'fixture',
  model: 'fixture-v1',
  artifactDir: join(rootDir, 'providers', 'fixture'),
  status,
  attempts: status === 'missing' ? 0 : 1,
  options: { language: 'en' },
  metadata: status === 'succeeded' ? { processingTime: 1 } : {},
  ...(status === 'failed' ? { error: { message: 'fixture failure', retryable: true } } : {})
})

const materializeFailedTtsProviderState = async (
  rootDir: string,
  target: TtsTarget,
  sourceText = 'Fixture failure.'
): Promise<PipelineProviderState> => {
  let latest: PipelineProviderState | undefined
  const runnable = {
    ...target,
    voice: target.voice ?? 'alloy',
    run: async (): Promise<never> => { throw new Error('fixture failure before provider dispatch') }
  }
  const sourceIdentity = createInlineTtsSourceIdentity(sourceText)
  const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, sourceText, new Date(0).toISOString())
  await runTtsForTargets(sourceText, rootDir, {}, [runnable], {
    sourceIdentity,
    dialoguePlan,
    onProviderState: async (state) => { latest = state }
  }).catch(() => undefined)
  if (!latest || latest.status !== 'failed') throw new Error('Fixture lifecycle did not produce a failed canonical TTS state.')
  return bindTtsDialoguePlanArtifact(
    latest,
    await materializeTtsDialoguePlanArtifact(rootDir, dialoguePlan)
  )
}

describe('canonical pipeline manifest', () => {
  const ttsTarget = (model: string): TtsTarget => ({
    service: 'openai',
    model,
    operation: 'tts-synthesis',
    transport: 'hosted-api',
    targetKey: canonicalTargetKey('tts-synthesis', 'openai', model, 'hosted-api'),
    run: async () => { throw new Error('not called') }
  })

  test('every generic command and scope uses one unversioned top-level shape', async () => {
    await withTempDir('autoshow-canonical-manifest-', async (dir) => {
      for (const command of PROCESS_COMMANDS.filter(candidate => candidate !== 'comic')) {
        for (const scope of ['single', 'batch'] as const) {
          const caseDir = join(dir, `${command}-${scope}`)
          await mkdir(caseDir)
          const itemCount = scope === 'single' ? 1 : 2
          const manifest = createManifest(command, scope, Array.from({ length: itemCount }, (_, index) => {
            const target = ttsTarget(`fixture-${index}`)
            return createManifestItem(caseDir, {
              input: `input-${index}`,
              outputDir: join(caseDir, `item-${index}`),
              status: command === 'tts' ? 'skipped' : 'full',
              metadata: { index },
              providers: command === 'tts'
                ? [policySkippedTtsProviderState(target, `item-${index}/providers`)]
                : []
            })
          }))
          await writeManifest(caseDir, manifest)
          const stored = await readManifest(caseDir)
          expect(stored?.command).toBe(command)
          expect(stored?.scope).toBe(scope)
          expect(stored?.items).toHaveLength(itemCount)
          expect(Object.keys(stored ?? {}).sort()).toEqual(['command', 'createdAt', 'items', 'scope', 'updatedAt'])
          expect((stored as unknown as Record<string, unknown>)['schemaVersion']).toBeUndefined()
          expect((stored as unknown as Record<string, unknown>)['kind']).toBeUndefined()
        }
      }
      expect(PROCESS_COMMANDS).toContain('comic')
    })
  })

  test('one provider-state vocabulary carries progress, success, failure, missing, and skipped state', async () => {
    await withTempDir('autoshow-provider-state-', async (dir) => {
      const statuses: PipelineProviderState['status'][] = ['running', 'succeeded', 'missing', 'failed', 'skipped']
      await writeManifest(dir, createManifest('extract', 'batch', statuses.map((status, index) =>
        createManifestItem(dir, {
          input: `input-${index}`,
          extractRoute: 'media',
          outputDir: join(dir, `item-${index}`),
          status: status === 'succeeded' || status === 'skipped' ? 'full' : status === 'failed' ? 'failed' : 'incomplete',
          metadata: {},
          providers: [provider(dir, status)]
        })
      )))

      expect((await readManifest(dir))?.items.map((item) => item.providers[0]?.status)).toEqual(statuses)
    })
  })

  test('single-item batches and mixed-route child links are explicit data', async () => {
    await withTempDir('autoshow-child-links-', async (dir) => {
      const item = createManifestItem(dir, {
        input: 'document.pdf',
        inputFamily: 'document',
        extractRoute: 'document',
        child: { route: 'document', index: 0, manifestDir: join(dir, 'document') },
        status: 'incomplete',
        metadata: {},
        providers: []
      })
      await writeManifest(dir, createManifest('extract', 'batch', [item]))

      const stored = await readManifest(dir)
      expect(stored?.scope).toBe('batch')
      expect(stored?.items[0]?.child).toEqual({ route: 'document', index: 0, manifestDir: 'document' })
    })
  })

  test('provider progress updates atomically without parallel completion lists', async () => {
    await withTempDir('autoshow-provider-update-', async (dir) => {
      await writeManifest(dir, createManifest('extract', 'single', [
        createManifestItem(dir, {
          input: 'audio.wav',
          extractRoute: 'media',
          outputDir: dir,
          status: 'incomplete',
          metadata: {},
          providers: [provider(dir, 'missing')]
        })
      ]))
      await updateManifest(dir, (manifest) => ({
        ...manifest,
        items: manifest.items.map((item) => ({
          ...item,
          status: 'full',
          providers: item.providers.map((state) => ({
            ...state,
            status: 'succeeded',
            attempts: 1,
            metadata: { processingTime: 1 }
          }))
        }))
      }))

      const raw = await Bun.file(join(dir, PIPELINE_MANIFEST_FILE)).json() as Record<string, unknown>
      const serialized = JSON.stringify(raw)
      expect(serialized).not.toContain('requestedProviders')
      expect(serialized).not.toContain('missingProviders')
      expect(serialized).not.toContain('completionStatus')
      expect((await readManifest(dir))?.items[0]?.providers[0]?.status).toBe('succeeded')
    })
  })

  test('missing and malformed files have distinct local outcomes', async () => {
    await withTempDir('autoshow-malformed-manifest-', async (dir) => {
      expect(await readManifest(dir)).toBeUndefined()
      await Bun.write(join(dir, PIPELINE_MANIFEST_FILE), '{not json')
      await expect(readManifest(dir)).rejects.toThrow('Malformed canonical manifest')
    })
  })

  test('invalid shape and corrupt rewrites fail before they can replace canonical bytes', async () => {
    await withTempDir('autoshow-invalid-manifest-', async (dir) => {
      const valid = createManifest('download', 'single', [
        createManifestItem(dir, { input: 'source', outputDir: dir, status: 'full', metadata: {}, providers: [] })
      ])
      await writeManifest(dir, valid)
      const before = await Bun.file(join(dir, PIPELINE_MANIFEST_FILE)).text()
      const corrupt = {
        ...valid,
        items: [{ ...valid.items[0], legacyCompletionStatus: 'full' }]
      } as unknown as PipelineManifest
      await expect(writeManifest(dir, corrupt)).rejects.toThrow('Invalid canonical manifest')
      await expect(writeManifest(dir, {
        ...valid,
        items: [valid.items[0]!, valid.items[0]!]
      })).rejects.toThrow('Invalid canonical manifest')
      await expect(writeManifest(dir, createManifest('extract', 'batch', [{
        ...valid.items[0]!,
        extractRoute: 'document',
        child: { route: 'media', index: 0, manifestDir: 'media' }
      }]))).rejects.toThrow('Invalid canonical manifest')
      expect(await Bun.file(join(dir, PIPELINE_MANIFEST_FILE)).text()).toBe(before)
    })
  })

  test('output, child, and provider paths cannot escape their run root', async () => {
    await withTempDir('autoshow-contained-manifest-', async (dir) => {
      expect(() => createManifestItem(dir, {
        outputDir: '../escape',
        status: 'incomplete',
        metadata: {},
        providers: []
      })).toThrow('escapes its run root')
      expect(() => createManifestItem(dir, {
        child: { route: 'media', index: 0, manifestDir: '/tmp/escape' },
        status: 'incomplete',
        metadata: {},
        providers: []
      })).toThrow('escapes its run root')
      expect(() => createManifestItem(dir, {
        status: 'incomplete',
        metadata: {},
        providers: [{ ...provider(dir, 'missing'), artifactDir: '../../escape' }]
      })).toThrow('escapes its run root')
    })
  })

  test('TTS item status is an exact reduction and empty or duplicate target states are rejected', async () => {
    await withTempDir('autoshow-tts-manifest-reduction-', async (dir) => {
      const target = ttsTarget('fixture-a')
      const failedDir = join(dir, 'failed')
      await mkdir(failedDir)
      const failed = await materializeFailedTtsProviderState(failedDir, target)
      const skipped = policySkippedTtsProviderState(target)

      for (const [status, state] of [['failed', failed], ['skipped', skipped]] as const) {
        const stateDir = status === 'failed' ? failedDir : join(dir, status)
        if (status !== 'failed') await mkdir(stateDir)
        await writeManifest(stateDir, createManifest('tts', 'single', [createManifestItem(stateDir, {
          input: 'fixture.txt',
          status,
          metadata: {},
          providers: [state]
        })]))
        expect((await readManifest(stateDir))?.items[0]?.status).toBe(status)
      }

      await expect(writeManifest(dir, createManifest('tts', 'single', [{
        input: 'fixture.txt',
        status: 'full',
        metadata: {},
        providers: []
      }]))).rejects.toThrow('Invalid canonical manifest')
      expect(() => createManifestItem(dir, {
        input: 'fixture.txt',
        status: 'skipped',
        metadata: {},
        providers: [skipped, skipped]
      })).toThrow('invalid canonical manifest item')
    })
  })

  test('TTS pointer histories are append-only during provider-state updates', async () => {
    await withTempDir('autoshow-tts-manifest-history-', async (dir) => {
      const target = ttsTarget('fixture-history')
      const pending = policySkippedTtsProviderState(target)
      await writeManifest(dir, createManifest('tts', 'single', [createManifestItem(dir, {
        input: 'fixture.txt',
        status: 'skipped',
        metadata: {},
        providers: [pending]
      })]))
      const projection = pending.result?.['ttsAudio'] as {
        activeWork: { kind: 'policy-skip', evidence: { skipId: string, actor: { namespace: 'local-user', actorId: string }, at: string } }
        branchHistory: []
        readinessAttempts: []
        renderHistory: []
        pointerEvents: Array<Record<string, unknown>>
      }
      const appendedProjection = {
        ...projection,
        pointerEvents: [...projection.pointerEvents, {
          sequence: 2,
          action: 'activate-policy-skip',
          skipId: projection.activeWork.evidence.skipId,
          actor: projection.activeWork.evidence.actor,
          at: projection.activeWork.evidence.at
        }]
      }
      const appended = { ...pending, metadata: { ttsAudio: appendedProjection }, result: { ttsAudio: appendedProjection } }
      await updateSingleManifestProviderState(dir, { service: target.service, targetKey: target.targetKey }, () => appended)
      await expect(updateSingleManifestProviderState(dir, { service: target.service, targetKey: target.targetKey }, () => pending)).rejects.toThrow('append-only')
      const replacement = createManifest('tts', 'single', [createManifestItem(dir, {
        input: 'fixture.txt',
        status: 'skipped',
        metadata: {},
        providers: [pending]
      })])
      replacement.createdAt = (await readManifest(dir))?.createdAt as string
      await expect(writeManifest(dir, replacement)).rejects.toThrow('append-only')
    })
  })

  test('same-render zero-request failed attempts append result and readiness evidence without replacing history', async () => {
    await withTempDir('autoshow-tts-blocked-history-', async (dir) => {
      const target = ttsTarget('fixture-blocked-history')
      const first = await materializeFailedTtsProviderState(dir, target, 'Blocked append fixture.')
      const firstProjection = first.result?.['ttsAudio'] as CanonicalAudioProviderProjection
      const zeroAttemptFailure = firstProjection.renderHistory[0]?.events.at(-1)
      expect(zeroAttemptFailure).toMatchObject({ status: 'failed', attempt: 0 })
      expect(Object.keys(zeroAttemptFailure ?? {}).sort()).toEqual(['at', 'attempt', 'error', 'sequence', 'status'])
      for (const tamper of [
        (event: Record<string, unknown>) => { event['admissionJournalSnapshotId'] = 'forbidden-zero-attempt-journal' },
        (event: Record<string, unknown>) => { delete event['error'] }
      ]) {
        const invalid = structuredClone(first)
        const invalidProjection = invalid.result?.['ttsAudio'] as CanonicalAudioProviderProjection
        tamper(invalidProjection.renderHistory[0]?.events.at(-1) as unknown as Record<string, unknown>)
        invalid.metadata['ttsAudio'] = invalidProjection
        expect(() => createManifestItem(dir, {
          input: 'fixture.txt',
          status: 'failed',
          metadata: {},
          providers: [invalid]
        })).toThrow('invalid canonical manifest item')
      }
      await writeManifest(dir, createManifest('tts', 'single', [createManifestItem(dir, {
        input: 'fixture.txt',
        status: 'failed',
        metadata: {},
        providers: [first]
      })]))

      const second = await materializeFailedTtsProviderState(dir, target, 'Blocked append fixture.')
      const appended = appendCurrentTtsProviderState(first, second)
      const appendedProjection = appended.result?.['ttsAudio'] as CanonicalAudioProviderProjection
      expect(appendedProjection.renderHistory[0]?.events.slice(0, firstProjection.renderHistory[0]?.events.length)).toEqual(firstProjection.renderHistory[0]?.events)
      expect(appendedProjection.renderHistory[0]?.events.at(-1)?.status).toBe('failed')
      expect(appendedProjection.readinessAttempts.slice(0, firstProjection.readinessAttempts.length)).toEqual(firstProjection.readinessAttempts)
      expect(appendedProjection.readinessAttempts).toHaveLength(firstProjection.readinessAttempts.length + 1)
      expect(appendedProjection.pointerEvents.slice(0, firstProjection.pointerEvents.length)).toEqual(firstProjection.pointerEvents)
      await updateSingleManifestProviderState(dir, { service: target.service, targetKey: target.targetKey }, () => appended)
      const stored = (await readManifest(dir))?.items[0]?.providers[0]
      expect(stored?.status).toBe('failed')
      expect(stored?.attempts).toBe(0)
      await expect(updateSingleManifestProviderState(dir, { service: target.service, targetKey: target.targetKey }, () => first)).rejects.toThrow('append-only')
    })
  })

  test('cumulative same-render provider updates append each pointer occurrence only once', async () => {
    await withTempDir('autoshow-tts-cumulative-pointer-history-', async (dir) => {
      const target = ttsTarget('fixture-cumulative-pointer-history')
      const initial = await materializeFailedTtsProviderState(dir, target, 'Cumulative pointer fixture.')
      const withAnotherFailure = (state: PipelineProviderState, offsetMs: number): PipelineProviderState => {
        const next = structuredClone(state)
        const projection = next.result?.['ttsAudio'] as CanonicalAudioProviderProjection
        const render = projection.renderHistory[0]
        const previous = render?.events.at(-1)
        if (!render || !previous || previous.status !== 'failed') throw new Error('Expected one failed fixture render')
        const eventSequence = previous.sequence + 1
        const at = new Date(Date.parse(previous.at) + offsetMs).toISOString()
        render.events.push({ ...previous, sequence: eventSequence, at })
        projection.activeWork = { kind: 'render', renderIdentity: render.renderIdentity, eventSequence }
        projection.pointerEvents.push({
          sequence: projection.pointerEvents.length + 1,
          action: 'activate-render',
          renderIdentity: render.renderIdentity,
          eventSequence,
          actor: { namespace: 'local-user', actorId: 'fixture' },
          at
        })
        next.metadata['ttsAudio'] = projection
        next.result = { ttsAudio: projection }
        return next
      }

      const firstIncoming = withAnotherFailure(initial, 1)
      const afterFirst = appendCurrentTtsProviderState(initial, firstIncoming)
      const initialPointers = (initial.result?.['ttsAudio'] as CanonicalAudioProviderProjection).pointerEvents.length
      expect((afterFirst.result?.['ttsAudio'] as CanonicalAudioProviderProjection).pointerEvents).toHaveLength(initialPointers + 1)

      const secondIncoming = withAnotherFailure(firstIncoming, 1)
      const afterSecond = appendCurrentTtsProviderState(afterFirst, secondIncoming)
      const pointers = (afterSecond.result?.['ttsAudio'] as CanonicalAudioProviderProjection).pointerEvents
      expect(pointers).toHaveLength(initialPointers + 2)
      expect(pointers.map((pointer) => pointer.sequence)).toEqual(pointers.map((_, index) => index + 1))
    })
  })

  test('different-render zero-request failures retain both plans and remap readiness authorizations', async () => {
    await withTempDir('autoshow-tts-different-render-history-', async (dir) => {
      const target = ttsTarget('fixture-different-render-history')
      const sourceText = 'Different render voice-binding fixture.'
      const first = await materializeFailedTtsProviderState(dir, { ...target, voice: 'alloy' }, sourceText)
      await writeManifest(dir, createManifest('tts', 'single', [createManifestItem(dir, {
        input: 'fixture.txt',
        status: 'failed',
        metadata: {},
        providers: [first]
      })]))
      const second = await materializeFailedTtsProviderState(dir, { ...target, voice: 'nova' }, sourceText)
      const appended = appendCurrentTtsProviderState(first, second)
      const projection = appended.result?.['ttsAudio'] as CanonicalAudioProviderProjection
      expect(projection.renderHistory).toHaveLength(2)
      expect(new Set(projection.renderHistory.map((render) => render.renderIdentity)).size).toBe(2)
      const activeRender = requireDefined(projection.renderHistory[1], 'the appended render to retain its render plan')
      expect(projection.activeWork).toEqual({ kind: 'render', renderIdentity: activeRender.renderIdentity, eventSequence: activeRender.events.at(-1)?.sequence as number })
      expect(projection.pointerEvents.at(-1)).toMatchObject({
        action: 'activate-render',
        renderIdentity: activeRender.renderIdentity
      })
      await updateSingleManifestProviderState(dir, { service: target.service, targetKey: target.targetKey }, () => appended)
      expect((await readManifest(dir))?.items[0]?.providers[0]?.status).toBe('failed')
    })
  })

  test('batch TTS items cannot share one provider artifact directory', async () => {
    await withTempDir('autoshow-tts-batch-artifact-identity-', async (dir) => {
      const target = ttsTarget('fixture-batch')
      const shared = policySkippedTtsProviderState(target)
      const items = ['first', 'second'].map((input) => createManifestItem(dir, {
        input: `${input}.txt`,
        status: 'skipped',
        metadata: {},
        providers: [shared]
      }))

      await expect(writeManifest(dir, createManifest('tts', 'batch', items))).rejects.toThrow('Invalid canonical manifest')
    })
  })

  test('a TTS item cannot satisfy cardinality with a non-synthesis operation', async () => {
    await withTempDir('autoshow-tts-wrong-operation-', async (dir) => {
      const operation = 'write'
      const transport = 'hosted-api'
      const targetKey = canonicalTargetKey(operation, 'openai', 'fixture-model', transport)
      const wrongOperation: PipelineProviderState = {
        service: 'openai',
        model: 'fixture-model',
        operation,
        targetKey,
        transport,
        artifactDir: `providers/${targetKey}`,
        status: 'succeeded',
        attempts: 1,
        options: {},
        metadata: {}
      }

      await expect(writeManifest(dir, createManifest('tts', 'single', [createManifestItem(dir, {
        input: 'fixture.txt',
        status: 'full',
        metadata: {},
        providers: [wrongOperation]
      })]))).rejects.toThrow('Invalid canonical manifest')
    })
  })

  test('a pre-canonical TTS provider state is unreadable and unwritable', async () => {
    await withTempDir('autoshow-tts-precanonical-', async (dir) => {
      const preCanonical: PipelineProviderState = {
        service: 'openai',
        model: 'tts-1',
        artifactDir: '.',
        status: 'succeeded',
        attempts: 1,
        options: { language: 'en' },
        metadata: { audioFileName: 'speech.wav', audioFileSize: 10, processingTime: 1 }
      }
      const preCanonicalManifest = createManifest('tts', 'single', [createManifestItem(dir, {
        input: 'inline input',
        status: 'full',
        metadata: {},
        providers: [preCanonical]
      })])
      await expect(writeManifest(dir, preCanonicalManifest)).rejects.toThrow('Invalid canonical manifest')
      await Bun.write(join(dir, PIPELINE_MANIFEST_FILE), `${JSON.stringify(preCanonicalManifest, null, 2)}\n`)
      await expect(readManifest(dir)).rejects.toThrow('Invalid canonical manifest')
    })
  })
})
