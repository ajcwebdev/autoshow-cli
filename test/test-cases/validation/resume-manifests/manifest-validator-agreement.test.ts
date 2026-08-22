import { describe, expect, test } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import {
  createManifest,
  createManifestItem,
  createPipelineItemFromRecord,
  derivePipelineItemRecord,
  readManifest,
  updateManifest,
  writeManifest
} from '~/cli/commands/process-steps/pipeline-manifest'
import {
  collectNestedProjectionArtifactReferences,
  collectProjectionArtifactReferences
} from '~/cli/commands/process-steps/pipeline-manifest/projection-artifact-references'
import {
  PROJECTION_ARTIFACT_GRAPH_LINK_PASSES,
  validateProjectionArtifactGraphLinks
} from '~/cli/commands/process-steps/pipeline-manifest/projection-artifact-graph'
import {
  decodeProjectionArtifactBytes,
  visitProjectionArtifactReference
} from '~/cli/commands/process-steps/pipeline-manifest/projection-artifact-verifier'
import { canonicalTargetKey } from '~/utils/canonical-target-key'
import { PROCESS_COMMANDS } from '~/types'
import type { PipelineManifest, PipelineProviderState, ProjectionArtifactReference } from '~/types'
import { withTempDir } from '../../../test-utils/temp-dirs'
import { policySkippedTtsProviderStateFrom } from '../../../test-utils/tts-provider-state-fixtures'

const ARTIFACT_HASHES = {
  branch: '1'.repeat(64),
  readiness: '2'.repeat(64),
  renderPlan: '3'.repeat(64),
  journal: '4'.repeat(64),
  result: '5'.repeat(64),
  audioRun: '6'.repeat(64),
  output: '7'.repeat(64),
  take: '8'.repeat(64),
  checkpoint: '9'.repeat(64),
  cache: 'a'.repeat(64),
  reported: 'b'.repeat(64),
  rebuild: 'c'.repeat(64),
  invocation: 'd'.repeat(64),
  batchResult: 'e'.repeat(64),
  reusedBatchResult: 'f'.repeat(64)
} as const

const artifactCollectorProjection = (): Record<string, unknown> => ({
  branchHistory: [{
    branchPlanId: 'branch-1',
    branchPlanRef: 'branch-plan.json',
    branchPlanSha256: ARTIFACT_HASHES.branch
  }],
  readinessAttempts: [{
    branchPlanId: 'branch-1',
    readinessResultRef: 'readiness.json',
    readinessResultHash: ARTIFACT_HASHES.readiness
  }],
  renderHistory: [{
    renderPlanId: 'render-plan-1',
    renderIdentity: 'render-1',
    renderPlanRef: 'render-plan.json',
    renderPlanSha256: ARTIFACT_HASHES.renderPlan,
    renderDir: 'renders/render-1',
    events: [{
      sequence: 3,
      admissionJournalSnapshotId: 'snapshot-1',
      admissionJournalRef: 'attempts/1/journal.json',
      admissionJournalSha256: ARTIFACT_HASHES.journal,
      providerRenderResultIdentity: 'result-1',
      providerRenderResultRef: 'attempts/1/result.json',
      providerRenderResultSha256: ARTIFACT_HASHES.result,
      audioRunId: 'audio-run-1',
      audioRunRef: 'audio-run.json',
      audioRunSha256: ARTIFACT_HASHES.audioRun,
      readinessAuthorization: {
        branchPlanId: 'branch-1',
        branchCandidateId: 'candidate-1',
        readinessResultRef: 'readiness.json',
        readinessResultHash: ARTIFACT_HASHES.readiness,
        accountObservationHashes: [ARTIFACT_HASHES.branch]
      },
      outputRefs: [{ path: 'output.wav', sha256: ARTIFACT_HASHES.output }],
      takeSelections: [{ path: 'take-selection.json', sha256: ARTIFACT_HASHES.take }],
      continuationCheckpoints: [{ path: 'continuation-checkpoint.json', sha256: ARTIFACT_HASHES.checkpoint }],
      cacheEvidenceRefs: [{ path: 'cache.json', sha256: ARTIFACT_HASHES.cache }],
      reportedOutputRefs: [{ path: 'reported.wav', sha256: ARTIFACT_HASHES.reported }],
      consumedSelectionRebuild: {
        authorizationId: 'rebuild-1',
        path: 'rebuild.json',
        sha256: ARTIFACT_HASHES.rebuild
      },
      batchProgress: [{
        generationSlots: [{
          source: 'provider-dispatch',
          batchInvocationPlan: {
            batchInvocationPlanId: 'invocation-1',
            path: 'batch-plan.json',
            sha256: ARTIFACT_HASHES.invocation
          },
          batchResult: {
            batchResultId: 'batch-result-1',
            path: 'batch-result.json',
            sha256: ARTIFACT_HASHES.batchResult
          }
        }, {
          source: 'slot-reuse',
          slotHash: 'slot-1',
          batchResult: {
            batchResultId: 'batch-result-2',
            path: 'shared/batch-result.json',
            sha256: ARTIFACT_HASHES.reusedBatchResult
          }
        }],
        currentTakeSelection: { path: 'current-take.json', sha256: ARTIFACT_HASHES.take },
        continuationCheckpoint: { path: 'current-checkpoint.json', sha256: ARTIFACT_HASHES.checkpoint }
      }]
    }]
  }]
})

const policySkippedState = (targetKey: string, artifactDir = `providers/${targetKey}`): PipelineProviderState =>
  policySkippedTtsProviderStateFrom({
    target: { service: 'openai', model: 'fixture-tts', transport: 'hosted-api', targetKey },
    artifactDir,
    skipId: `skip-${targetKey}`,
    actorId: 'agreement-harness',
    reason: 'agreement fixture skip',
    local: false
  })

describe('manifest validator agreement harness', () => {
  test('manifest write, read, and mutation parity across commands and scopes', async () => {
    await withTempDir('validator-agreement-', async (dir) => {
      const commands = PROCESS_COMMANDS.filter((candidate) => candidate !== 'comic')
      for (const command of commands) {
        for (const scope of ['single', 'batch'] as const) {
          const caseDir = join(dir, `${command}-${scope}`)
          await mkdir(caseDir, { recursive: true })
          const targetKey = canonicalTargetKey('tts-synthesis', 'openai', 'fixture-tts', 'hosted-api')
          const itemCount = scope === 'single' ? 1 : 3

          const manifest = createManifest(command, scope, Array.from({ length: itemCount }, (_, index) => {
            const isTts = command === 'tts'
            const isProviderStep = command === 'extract' || command === 'write' || command === 'music'
            return createManifestItem(caseDir, {
              input: `source-${index}.txt`,
              outputDir: join(caseDir, `item-${index}`),
              status: isTts ? 'skipped' : 'full',
              metadata: { index, title: `Item ${index}` },
              providers: isTts
                ? [policySkippedState(targetKey, `item-${index}/providers/${targetKey}`)]
                : isProviderStep
                  ? [{
                      service: 'gemini',
                      model: 'flash',
                      artifactDir: `item-${index}/providers/gemini`,
                      status: 'succeeded',
                      attempts: 1,
                      options: {},
                      metadata: { cost: 0.1 },
                      result: { text: 'ok' }
                    }]
                  : []
            })
          }))

          const written = await writeManifest(caseDir, manifest)
          const read = await readManifest(caseDir)
          expect(read).toBeDefined()
          expect(read?.command).toBe(command)
          expect(read?.scope).toBe(scope)
          expect(read?.items).toHaveLength(itemCount)
          expect(read?.updatedAt).toBe(written.updatedAt)

          for (const item of read?.items ?? []) {
            const derived = derivePipelineItemRecord(caseDir, item)
            expect(derived).toBeDefined()
            expect(derived['completionStatus']).toBe(item.status)
            const recreated = createPipelineItemFromRecord(caseDir, derived, {
              status: item.status,
              outputDir: item.outputDir
            })
            expect(recreated.status).toBe(item.status)
            expect(recreated.providers.length).toBe(item.providers.length)
          }

          if (command !== 'tts') {
            const updated = await updateManifest(caseDir, (curr) => ({
              ...curr,
              items: curr.items.map((it) => ({
                ...it,
                metadata: { ...it.metadata, audited: true }
              }))
            }))
            expect(updated.items[0]?.metadata['audited']).toBe(true)
          }
        }
      }
    })
  })

  test('validator reject parity on corrupt and invalid manifests', async () => {
    await withTempDir('validator-reject-corpus-', async (dir) => {
      const valid = createManifest('download', 'single', [
        createManifestItem(dir, { input: 'source', outputDir: dir, status: 'full', metadata: {}, providers: [] })
      ])

      const invalidCorpus: Array<{ label: string, mutate: (m: PipelineManifest) => unknown }> = [
        {
          label: 'unknown top-level key',
          mutate: (m) => ({ ...m, extraUnknownKey: 123 })
        },
        {
          label: 'invalid command name',
          mutate: (m) => ({ ...m, command: 'non-existent-cmd' })
        },
        {
          label: 'invalid scope',
          mutate: (m) => ({ ...m, scope: 'invalid-scope' })
        },
        {
          label: 'empty items array',
          mutate: (m) => ({ ...m, items: [] })
        },
        {
          label: 'single scope with multiple items',
          mutate: (m) => ({ ...m, scope: 'single', items: [m.items[0]!, m.items[0]!] })
        },
        {
          label: 'invalid date in createdAt',
          mutate: (m) => ({ ...m, createdAt: 'not-a-date' })
        },
        {
          label: 'invalid item status',
          mutate: (m) => ({ ...m, items: [{ ...m.items[0]!, status: 'not-a-status' }] })
        },
        {
          label: 'escaping output directory',
          mutate: (m) => ({ ...m, items: [{ ...m.items[0]!, outputDir: '../../outside' }] })
        },
        {
          label: 'duplicate provider targetKeys',
          mutate: (m) => ({
            ...m,
            items: [{
              ...m.items[0]!,
              providers: [
                policySkippedState('duplicate-key'),
                policySkippedState('duplicate-key')
              ]
            }]
          })
        },
        {
          label: 'mismatched tts item status with provider statuses',
          mutate: (m) => ({
            ...m,
            command: 'tts',
            items: [{
              ...m.items[0]!,
              status: 'incomplete',
              providers: [policySkippedState('skipped-key')]
            }]
          })
        }
      ]

      for (const entry of invalidCorpus) {
        const corrupted = entry.mutate(structuredClone(valid)) as PipelineManifest
        await expect(writeManifest(dir, corrupted)).rejects.toThrow()
      }
    })
  })

  test('audio projection validator reject parity on corrupt events and pointers', async () => {
    await withTempDir('validator-projection-reject-', async (dir) => {
      const targetKey = canonicalTargetKey('tts-synthesis', 'openai', 'fixture-tts', 'hosted-api')
      const validTts = createManifest('tts', 'single', [
        createManifestItem(dir, {
          input: 'source.txt',
          outputDir: dir,
          status: 'skipped',
          metadata: {},
          providers: [policySkippedState(targetKey)]
        })
      ])
      await writeManifest(dir, validTts)

      const projectionTamperingCases: Array<{ label: string, tamper: (proj: Record<string, unknown>) => void }> = [
        {
          label: 'non-contiguous branch sequence',
          tamper: (proj) => {
            proj['branchHistory'] = [{ sequence: 2, branchPlanId: 'b1', branchPlanRef: 'plan.json', branchPlanSha256: 'a'.repeat(64), createdAt: new Date().toISOString() }]
          }
        },
        {
          label: 'unknown key in branch',
          tamper: (proj) => {
            proj['branchHistory'] = [{ sequence: 1, branchPlanId: 'b1', branchPlanRef: 'plan.json', branchPlanSha256: 'a'.repeat(64), createdAt: new Date().toISOString(), unknownKey: true }]
          }
        },
        {
          label: 'readiness pointing to nonexistent branch',
          tamper: (proj) => {
            proj['readinessAttempts'] = [{
              sequence: 1,
              branchPlanId: 'nonexistent',
              readinessResultRef: 'readiness.json',
              readinessResultHash: 'a'.repeat(64),
              accountObservationHashes: [],
              at: new Date().toISOString(),
              status: 'ready',
              admissionDisposition: 'eligible'
            }]
          }
        },
        {
          label: 'render history with invalid renderDir',
          tamper: (proj) => {
            proj['renderHistory'] = [{
              renderIdentity: 'r1',
              renderPlanId: 'rp1',
              renderPlanRef: 'render-plan.json',
              renderPlanSha256: 'a'.repeat(64),
              voiceContextKey: 'a'.repeat(64),
              synthesisSettingsHash: 'b'.repeat(64),
              outputProfileHash: 'c'.repeat(64),
              renderDir: '../escaped',
              events: []
            }]
          }
        },
        {
          label: 'pointer event with invalid action',
          tamper: (proj) => {
            proj['pointerEvents'] = [{
              sequence: 1,
              action: 'invalid-action',
              actor: { namespace: 'local-user', actorId: 'harness' },
              at: new Date().toISOString()
            }]
          }
        }
      ]

      for (const entry of projectionTamperingCases) {
        const corrupted = structuredClone(validTts)
        const state = corrupted.items[0]!.providers[0]!
        const proj = state.metadata['ttsAudio'] as Record<string, unknown>
        entry.tamper(proj)
        state.result = { ttsAudio: proj }
        await expect(writeManifest(dir, corrupted)).rejects.toThrow()
      }
    })
  })

  test('projection artifact collector preserves ordered references, scopes, context, hashes, and archive selection', () => {
    const targetKey = 'tts-synthesis:openai:fixture:hosted-api'
    expect(collectProjectionArtifactReferences(artifactCollectorProjection(), targetKey)).toEqual({
      files: [
        {
          path: 'branch-plan.json',
          sha256: ARTIFACT_HASHES.branch,
          scope: 'provider-artifact',
          kind: 'branch-plan',
          expectedJsonFields: { branchPlanId: 'branch-1', targetKey }
        },
        {
          path: 'readiness.json',
          sha256: ARTIFACT_HASHES.readiness,
          scope: 'provider-artifact',
          kind: 'readiness-result',
          expectedJsonFields: { branchPlanId: 'branch-1', targetKey }
        },
        {
          path: 'render-plan.json',
          sha256: ARTIFACT_HASHES.renderPlan,
          scope: 'provider-artifact',
          kind: 'render-plan',
          expectedJsonFields: { renderPlanId: 'render-plan-1', renderIdentity: 'render-1', targetKey },
          context: { renderDir: 'renders/render-1' }
        },
        {
          path: 'attempts/1/journal.json',
          sha256: ARTIFACT_HASHES.journal,
          scope: 'provider-artifact',
          kind: 'admission-journal',
          expectedJsonFields: { snapshotId: 'snapshot-1', renderPlanId: 'render-plan-1', renderIdentity: 'render-1' },
          context: { renderDir: 'renders/render-1', eventSequence: 3, eventResultIdentity: 'result-1' }
        },
        {
          path: 'attempts/1/result.json',
          sha256: ARTIFACT_HASHES.result,
          scope: 'provider-artifact',
          kind: 'provider-render-result',
          expectedJsonFields: { resultIdentity: 'result-1', renderPlanId: 'render-plan-1', renderIdentity: 'render-1' },
          context: { renderDir: 'renders/render-1', eventSequence: 3, eventJournalSnapshotId: 'snapshot-1' }
        },
        {
          path: 'audio-run.json',
          sha256: ARTIFACT_HASHES.audioRun,
          scope: 'provider-artifact',
          kind: 'audio-run',
          expectedJsonFields: {
            audioRunId: 'audio-run-1',
            targetKey,
            renderPlanId: 'render-plan-1',
            renderIdentity: 'render-1'
          },
          context: {
            renderDir: 'renders/render-1',
            eventSequence: 3,
            eventJournalSnapshotId: 'snapshot-1',
            eventResultIdentity: 'result-1'
          }
        },
        {
          path: 'readiness.json',
          sha256: ARTIFACT_HASHES.readiness,
          scope: 'provider-artifact',
          kind: 'readiness-result',
          expectedJsonFields: { branchPlanId: 'branch-1', targetKey },
          context: {
            renderDir: 'renders/render-1',
            branchCandidateId: 'candidate-1',
            accountObservationHashes: [ARTIFACT_HASHES.branch]
          }
        },
        {
          path: 'render-plan.json',
          sha256: ARTIFACT_HASHES.renderPlan,
          scope: 'provider-artifact',
          kind: 'render-plan',
          expectedJsonFields: {
            renderPlanId: 'render-plan-1',
            renderIdentity: 'render-1',
            targetKey,
            branchPlanId: 'branch-1',
            branchCandidateId: 'candidate-1'
          },
          context: { renderDir: 'renders/render-1' }
        },
        {
          path: 'output.wav',
          sha256: ARTIFACT_HASHES.output,
          scope: 'provider-artifact',
          kind: 'audio',
          context: { renderDir: 'renders/render-1' }
        },
        {
          path: 'renders/render-1/take-selection.json',
          sha256: ARTIFACT_HASHES.take,
          scope: 'provider-artifact',
          kind: 'take-selection',
          context: { renderDir: 'renders/render-1' }
        },
        {
          path: 'renders/render-1/continuation-checkpoint.json',
          sha256: ARTIFACT_HASHES.checkpoint,
          scope: 'provider-artifact',
          kind: 'continuation-checkpoint',
          context: { renderDir: 'renders/render-1' }
        },
        {
          path: 'renders/render-1/cache.json',
          sha256: ARTIFACT_HASHES.cache,
          scope: 'provider-artifact',
          kind: 'generic-json',
          context: { renderDir: 'renders/render-1' }
        },
        {
          path: 'reported.wav',
          sha256: ARTIFACT_HASHES.reported,
          scope: 'run-root',
          kind: 'audio'
        },
        {
          path: 'renders/render-1/rebuild.json',
          sha256: ARTIFACT_HASHES.rebuild,
          scope: 'provider-artifact',
          kind: 'consumed-selection-rebuild',
          expectedJsonFields: { authorizationId: 'rebuild-1' },
          context: { renderDir: 'renders/render-1' }
        },
        {
          path: 'renders/render-1/batch-plan.json',
          sha256: ARTIFACT_HASHES.invocation,
          scope: 'provider-artifact',
          kind: 'batch-invocation-plan',
          expectedJsonFields: { batchInvocationPlanId: 'invocation-1' },
          context: { renderDir: 'renders/render-1' }
        },
        {
          path: 'renders/render-1/batch-result.json',
          sha256: ARTIFACT_HASHES.batchResult,
          scope: 'provider-artifact',
          kind: 'provider-batch-result',
          expectedJsonFields: { batchResultId: 'batch-result-1' },
          context: { renderDir: 'renders/render-1' }
        },
        {
          path: 'shared/batch-result.json',
          sha256: ARTIFACT_HASHES.reusedBatchResult,
          scope: 'run-root',
          kind: 'provider-batch-result',
          context: { renderDir: 'renders/render-1' }
        },
        {
          path: 'renders/render-1/current-take.json',
          sha256: ARTIFACT_HASHES.take,
          scope: 'provider-artifact',
          kind: 'take-selection',
          context: { renderDir: 'renders/render-1' }
        },
        {
          path: 'renders/render-1/current-checkpoint.json',
          sha256: ARTIFACT_HASHES.checkpoint,
          scope: 'provider-artifact',
          kind: 'continuation-checkpoint',
          context: { renderDir: 'renders/render-1' }
        }
      ],
      directories: ['renders/render-1']
    })

    const archive = {
      selectedSuccess: { renderIdentity: 'render-1' },
      archive: {
        renderRef: { path: 'archive/render.json', sha256: ARTIFACT_HASHES.renderPlan },
        timelineRef: { path: 'archive/timeline.json', sha256: ARTIFACT_HASHES.checkpoint },
        finalRef: { path: 'archive/final.wav', sha256: ARTIFACT_HASHES.output }
      }
    }
    expect(collectProjectionArtifactReferences(archive, targetKey)).toEqual({
      files: [
        {
          path: 'archive/render.json',
          sha256: ARTIFACT_HASHES.renderPlan,
          scope: 'run-root',
          kind: 'compact-render',
          expectedJsonFields: { targetKey }
        },
        {
          path: 'archive/timeline.json',
          sha256: ARTIFACT_HASHES.checkpoint,
          scope: 'run-root',
          kind: 'final-timeline'
        },
        {
          path: 'archive/final.wav',
          sha256: ARTIFACT_HASHES.output,
          scope: 'run-root',
          kind: 'audio'
        }
      ],
      directories: []
    })
  })

  test('projection artifact collector fails closed at every collector boundary', () => {
    const render = (projection: Record<string, unknown>): Record<string, unknown> =>
      (projection['renderHistory'] as Record<string, unknown>[])[0]!
    const event = (projection: Record<string, unknown>): Record<string, unknown> =>
      (render(projection)['events'] as Record<string, unknown>[])[0]!
    const batch = (projection: Record<string, unknown>): Record<string, unknown> =>
      (event(projection)['batchProgress'] as Record<string, unknown>[])[0]!
    const slots = (projection: Record<string, unknown>): Record<string, unknown>[] =>
      batch(projection)['generationSlots'] as Record<string, unknown>[]

    const mutations: Array<{ label: string, mutate: (projection: Record<string, unknown>) => void }> = [
      { label: 'branch history', mutate: (projection) => { projection['branchHistory'] = [null] } },
      { label: 'readiness history', mutate: (projection) => { projection['readinessAttempts'] = [{ readinessResultRef: 'readiness.json', readinessResultHash: 'bad' }] } },
      { label: 'render record', mutate: (projection) => { render(projection)['renderDir'] = '../escaped' } },
      { label: 'render event', mutate: (projection) => { render(projection)['events'] = [null] } },
      { label: 'generic event list', mutate: (projection) => { event(projection)['takeSelections'] = {} } },
      { label: 'batch progress', mutate: (projection) => { event(projection)['batchProgress'] = [{}] } },
      { label: 'batch selection', mutate: (projection) => { batch(projection)['currentTakeSelection'] = { path: '../take.json', sha256: ARTIFACT_HASHES.take } } },
      { label: 'provider dispatch', mutate: (projection) => { slots(projection)[0]!['batchInvocationPlan'] = null } },
      { label: 'slot reuse', mutate: (projection) => { slots(projection)[1]!['slotHash'] = '' } }
    ]

    for (const entry of mutations) {
      const projection = artifactCollectorProjection()
      entry.mutate(projection)
      expect(collectProjectionArtifactReferences(projection, 'target-key'), entry.label).toBeUndefined()
    }

    const archive = {
      selectedSuccess: { renderIdentity: 'render-1' },
      archive: {
        renderRef: { path: '../render.json', sha256: ARTIFACT_HASHES.renderPlan },
        timelineRef: { path: 'timeline.json', sha256: ARTIFACT_HASHES.checkpoint },
        finalRef: { path: 'final.wav', sha256: ARTIFACT_HASHES.output }
      }
    }
    expect(collectProjectionArtifactReferences(archive, 'target-key'), 'archive projection').toBeUndefined()
  })

  test('projection artifact verification preserves traversal, expansion, JSONL, and graph-pass contracts', () => {
    expect(PROJECTION_ARTIFACT_GRAPH_LINK_PASSES.map((pass) => pass.name)).toEqual([
      'validateCapabilityFixtureLinks',
      'validateBranchPlanLinks',
      'validateRenderPlanLinks',
      'validateReadinessResultLinks',
      'validateProviderBatchResultLinks',
      'validateProviderRenderResultLinks',
      'validateAdmissionJournalLinks',
      'validateRenderResultClosedByLinks',
      'validateBatchResultProvenanceLinks',
      'validateJournalRecordedBatchLinks',
      'validateAudioRunLinks'
    ])

    const terminalReference: ProjectionArtifactReference = {
      path: 'attempts/attempt-1/admission-journal.jsonl',
      sha256: ARTIFACT_HASHES.journal,
      kind: 'admission-journal'
    }
    const terminalSnapshot = { snapshotId: 'snapshot-terminal', journalId: 'journal-1' }
    const terminalBytes = new TextEncoder().encode([
      '{"snapshot":{"snapshotId":"snapshot-earlier"}}',
      JSON.stringify({ snapshot: terminalSnapshot }),
      ''
    ].join('\n'))
    expect(decodeProjectionArtifactBytes(terminalReference, terminalBytes)).toEqual(terminalSnapshot)
    expect(() => decodeProjectionArtifactBytes(
      terminalReference,
      new TextEncoder().encode('{"snapshot":{"snapshotId":"valid"}}\n{malformed\n')
    )).toThrow()

    const visited = new Set<string>()
    const repeatedReference: ProjectionArtifactReference = {
      path: 'artifact.json',
      sha256: ARTIFACT_HASHES.branch,
      kind: 'generic-json'
    }
    expect(visitProjectionArtifactReference(repeatedReference, visited)).toBe('new')
    expect(visitProjectionArtifactReference(repeatedReference, visited)).toBe('duplicate')
    for (let index = 1; index < 10_000; index += 1) {
      expect(visitProjectionArtifactReference({
        ...repeatedReference,
        path: `artifact-${index}.json`
      }, visited)).toBe('new')
    }
    expect(visitProjectionArtifactReference({
      ...repeatedReference,
      path: 'artifact-over-limit.json'
    }, visited)).toBe('limit-exceeded')

    const nested = collectNestedProjectionArtifactReferences({
      path: 'audio/final-timeline.json',
      sha256: ARTIFACT_HASHES.checkpoint,
      kind: 'final-timeline',
      context: { audioRunDir: 'audio' }
    }, {
      renderIdentity: 'render-1',
      transformLedgerRef: {
        path: 'transform-ledger.json',
        sha256: ARTIFACT_HASHES.cache
      }
    })
    expect(nested).toEqual([{
      path: 'audio/transform-ledger.json',
      sha256: ARTIFACT_HASHES.cache,
      kind: 'audio-transform-ledger',
      expectedJsonFields: { renderIdentity: 'render-1' },
      context: { audioRunDir: 'audio' }
    }])

    const cycleReferences: ProjectionArtifactReference[] = [{
      path: 'attempts/attempt-1/snapshot-a.json',
      sha256: ARTIFACT_HASHES.journal,
      kind: 'admission-journal'
    }, {
      path: 'attempts/attempt-1/snapshot-b.json',
      sha256: ARTIFACT_HASHES.readiness,
      kind: 'admission-journal'
    }]
    const cycleChecked = new Map([
      ['provider-artifact\0attempts/attempt-1/snapshot-a.json', {
        sha256: ARTIFACT_HASHES.journal,
        json: {
          snapshotId: 'snapshot-a',
          previousSnapshotId: 'snapshot-b',
          journalId: 'journal-1',
          invocationId: 'invocation-1',
          attempt: 1,
          renderIdentity: 'render-1'
        }
      }],
      ['provider-artifact\0attempts/attempt-1/snapshot-b.json', {
        sha256: ARTIFACT_HASHES.readiness,
        json: {
          snapshotId: 'snapshot-b',
          previousSnapshotId: 'snapshot-a',
          journalId: 'journal-1',
          invocationId: 'invocation-1',
          attempt: 1,
          renderIdentity: 'render-1'
        }
      }]
    ])
    expect(() => validateProjectionArtifactGraphLinks(cycleReferences, cycleChecked)).toThrow()

    const duplicateSnapshotReferences: ProjectionArtifactReference[] = [{
      path: 'attempts/attempt-1/snapshot-a.json',
      sha256: ARTIFACT_HASHES.journal,
      kind: 'admission-journal'
    }, {
      path: 'attempts/attempt-1/snapshot-a-copy.json',
      sha256: ARTIFACT_HASHES.readiness,
      kind: 'admission-journal'
    }]
    const duplicateSnapshot = {
      snapshotId: 'snapshot-a',
      journalId: 'journal-1',
      invocationId: 'invocation-1',
      attempt: 1,
      renderIdentity: 'render-1'
    }
    const duplicateChecked = new Map([
      ['provider-artifact\0attempts/attempt-1/snapshot-a.json', {
        sha256: ARTIFACT_HASHES.journal,
        json: duplicateSnapshot
      }],
      ['provider-artifact\0attempts/attempt-1/snapshot-a-copy.json', {
        sha256: ARTIFACT_HASHES.readiness,
        json: duplicateSnapshot
      }]
    ])
    expect(validateProjectionArtifactGraphLinks(duplicateSnapshotReferences, duplicateChecked)).toBe(false)
  })
})
