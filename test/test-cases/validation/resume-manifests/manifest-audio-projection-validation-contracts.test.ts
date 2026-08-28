import { describe,expect,test } from 'bun:test'
import {
createManifest,
createManifestItem,
writeManifest
} from '~/cli/commands/process-steps/pipeline-manifest'
import type { PipelineProviderState } from '~/types'
import { canonicalTargetKey } from '~/utils/canonical-target-key'
import { withTempDir } from '../../../test-utils/temp-dirs'
import { policySkippedTtsProviderStateFrom } from '../../../test-utils/tts-provider-state-fixtures'

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
})
