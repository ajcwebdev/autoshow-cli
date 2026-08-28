import { describe,expect,test } from 'bun:test'
import {
collectProjectionArtifactReferences
} from '~/cli/commands/process-steps/pipeline-manifest/projection-artifact-references'

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

describe('manifest validator agreement harness', () => {

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
})
