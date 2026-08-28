import { describe,expect,test } from 'bun:test'
import {
PROJECTION_ARTIFACT_GRAPH_LINK_PASSES,
validateProjectionArtifactGraphLinks
} from '~/cli/commands/process-steps/pipeline-manifest/projection-artifact-graph'
import {
collectNestedProjectionArtifactReferences
} from '~/cli/commands/process-steps/pipeline-manifest/projection-artifact-references'
import {
decodeProjectionArtifactBytes,
visitProjectionArtifactReference
} from '~/cli/commands/process-steps/pipeline-manifest/projection-artifact-verifier'
import { createGraphLinkContext } from '~/cli/commands/process-steps/pipeline-manifest/projection-artifact-link-context'
import { validateBatchResultProvenanceLinks } from '~/cli/commands/process-steps/pipeline-manifest/projection-artifact-admission-audio-links'
import type { ProjectionArtifactReference } from '~/types'

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

describe('manifest validator agreement harness', () => {

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

  test('a succeeded provider batch accepts a checksum-bound rejected request followed by its recorded retry', () => {
    const attemptDir = 'renders/render-1/attempts/attempt-1'
    const invocationPath = `${attemptDir}/invocations/slot-1.json`
    const invocationSha = ARTIFACT_HASHES.invocation
    const invocationId = 'invocation-1'
    const invocationPlanId = 'invocation-plan-1'
    const requestFingerprint = 'request-fingerprint-1'
    const batchId = 'batch-1'
    const generationSlotId = 'slot-1'
    const journalId = 'journal-1'
    const snapshotId = 'snapshot-1'
    const request = (requestOrdinal: number, state: string, retryOfRequestOrdinal?: number) => ({
      requestOrdinal,
      ...(retryOfRequestOrdinal === undefined ? {} : { retryOfRequestOrdinal }),
      batchId,
      generationSlotId,
      batchInvocationPlanId: invocationPlanId,
      batchInvocationPlanRef: 'invocations/slot-1.json',
      batchInvocationPlanSha256: invocationSha,
      requestFingerprint,
      transitions: [
        { sequence: 1, state: 'prepared', requestBodyHash: 'request-body-1' },
        { sequence: 2, state }
      ]
    })
    const rejected = request(1, 'provider-rejected')
    const completed = request(2, 'completed', 1)
    const observed = (requestOrdinal: number) => ({
      requestOrdinal,
      invocationId,
      batchId,
      generationSlotId,
      batchInvocationPlanId: invocationPlanId,
      requestBodyHash: 'request-body-1'
    })
    const value = {
      batchResultId: 'batch-result-1',
      provenance: 'provider-dispatch',
      status: 'succeeded',
      invocationId,
      batchId,
      generationSlotId,
      batchInvocationPlan: {
        artifactRef: 'invocations/slot-1.json',
        batchInvocationPlanId: invocationPlanId,
        sha256: invocationSha
      },
      admissionBasis: { snapshotId, journalId },
      observedRequests: [observed(1), observed(2)],
      retryAttempts: [{ requestOrdinal: 2, retryOfRequestOrdinal: 1, invocationId }]
    }
    const checked = new Map([[`provider-artifact\0${invocationPath}`, {
      sha256: invocationSha,
      json: { batchInvocationPlanId: invocationPlanId, requestFingerprint }
    }]])
    const context = createGraphLinkContext([], checked)
    context.admissionSnapshots.set(snapshotId, {
      reference: { path: `${attemptDir}/admission-journal-1.json`, sha256: ARTIFACT_HASHES.journal, kind: 'admission-journal' },
      value: { snapshotId, journalId, invocationId, requests: [rejected, completed] }
    })
    context.batchResults.set(value.batchResultId, {
      reference: {
        path: `${attemptDir}/batch-results/batch-1/slot-1/provider-batch-result.json`,
        sha256: ARTIFACT_HASHES.batchResult,
        kind: 'provider-batch-result',
        context: { attemptDir }
      },
      value
    })

    expect(validateBatchResultProvenanceLinks(context)).toBe(true)

    value.retryAttempts = []
    expect(validateBatchResultProvenanceLinks(context)).toBe(false)
  })
})
