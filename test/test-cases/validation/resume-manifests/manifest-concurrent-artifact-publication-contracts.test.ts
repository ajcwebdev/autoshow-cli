import { describe, expect, test } from 'bun:test'
import { rename } from 'node:fs/promises'
import { join } from 'node:path'
import {
  createManifest,
  createManifestItem,
  readManifest,
  updateManifest,
  writeManifest,
} from '~/cli/commands/process-steps/pipeline-manifest'
import { createCurrentTtsRenderAttempt } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-attempt'
import { bindTtsDialoguePlanArtifact, materializeTtsDialoguePlanArtifact } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/item-dialogue-plan-artifact'
import { createInlineTtsSourceIdentity, createSingleTurnTtsDialoguePlan } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/generic-dialogue-plan'
import type { CanonicalAudioProviderProjection, TtsTarget } from '~/types'
import { canonicalTargetKey } from '~/utils/canonical-target-key'
import { withTempDir } from '../../../test-utils/temp-dirs'

const createTarget = (service: 'openai' | 'grok'): TtsTarget => ({
  service,
  model: `fixture-concurrent-artifact-${service}`,
  voice: 'alloy',
  operation: 'tts-synthesis',
  transport: 'hosted-api',
  targetKey: canonicalTargetKey('tts-synthesis', service, `fixture-concurrent-artifact-${service}`, 'hosted-api'),
  run: async () => { throw new Error('Concurrent publication fixture must not dispatch a provider.') }
})

describe('manifest writes during concurrent artifact publication', () => {
  test('validates only the provider being committed while a peer publishes artifacts', async () => {
    await withTempDir('autoshow-manifest-concurrent-artifact-', async (dir) => {
      const text = 'Keep the last canonical manifest while another provider publishes.'
      const sourceIdentity = createInlineTtsSourceIdentity(text)
      const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, text, new Date(0).toISOString())
      const dialoguePlanArtifact = await materializeTtsDialoguePlanArtifact(dir, dialoguePlan)
      const providers = await Promise.all((['openai', 'grok'] as const).map(async (service) => {
        const attempt = await createCurrentTtsRenderAttempt({
          outputDir: dir,
          target: createTarget(service),
          sourceText: text,
          ttsOptions: {},
          sourceIdentity,
          dialoguePlan,
        })
        return bindTtsDialoguePlanArtifact(attempt.preparedState, dialoguePlanArtifact)
      }))
      await writeManifest(dir, createManifest('tts', 'single', [createManifestItem(dir, {
        input: 'fixture.txt',
        outputDir: dir,
        status: 'incomplete',
        metadata: {},
        providers,
      })]))

      const peer = providers[1] as typeof providers[number]
      const projection = peer.result?.['ttsAudio'] as CanonicalAudioProviderProjection
      const branchRef = projection.branchHistory[0]?.branchPlanRef
      if (!branchRef) throw new Error('Missing branch-plan fixture reference')
      const branchPath = join(dir, peer.artifactDir, branchRef)
      const heldPath = `${branchPath}.publishing`
      await rename(branchPath, heldPath)

      try {
        await expect(readManifest(dir)).rejects.toThrow('artifact-graph')
        const updated = await updateManifest(dir, (current) => ({
          ...current,
          items: current.items.map((item) => {
            const nextProviders = item.providers.slice()
            const primary = nextProviders[0]
            if (!primary) throw new Error('Missing primary provider fixture')
            nextProviders[0] = { ...primary, metadata: { ...primary.metadata, committedWhilePeerPublishing: true } }
            return { ...item, providers: nextProviders }
          })
        }))
        expect(updated.items[0]?.providers[0]?.metadata['committedWhilePeerPublishing']).toBe(true)
      } finally {
        await rename(heldPath, branchPath)
      }

      expect((await readManifest(dir))?.items[0]?.providers[0]?.metadata['committedWhilePeerPublishing']).toBe(true)
    })
  })
})
