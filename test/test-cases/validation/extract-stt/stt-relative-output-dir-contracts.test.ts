import { describe, expect, test } from 'bun:test'
import { relative } from 'node:path'
import { readSingleManifestProviderState } from '~/cli/commands/process-steps/pipeline-manifest'
import { getSttProviderArtifactDir } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-batch/stt-run-state'
import { markSttProviderRunning } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-provider-progress'
import { writeSingleManifestFixture } from '../../../test-utils/manifest-helpers'
import { withLocalTestDir } from '../../../test-utils/temp-dirs'

describe('STT relative output directories', () => {
  test('marks providers running from a cwd-relative --output-dir', async () => {
    await withLocalTestDir('stt-relative-output-', async (absDir) => {
      const rootDir = relative(process.cwd(), absDir)
      const target = { service: 'deepgram', model: 'nova-3' } as const
      const artifactDir = getSttProviderArtifactDir(target)

      await writeSingleManifestFixture(rootDir, 'extract', {
        completionStatus: 'incomplete',
        requestedProviders: [{ service: target.service, model: target.model, local: false }],
        providerStates: [{
          service: target.service,
          model: target.model,
          local: false,
          artifactDir,
          status: 'missing',
          attempts: 0
        }],
        missingProviders: [{ service: target.service, model: target.model, local: false }]
      }, { extractRoute: 'media' })

      await markSttProviderRunning({ rootDir, artifactDir, target }, 1)

      const state = await readSingleManifestProviderState(rootDir, {
        service: target.service,
        model: target.model,
        artifactDir
      })
      expect(state?.status).toBe('running')
      expect(state?.attempts).toBe(1)
      expect(state?.artifactDir).toBe(artifactDir)
    })
  })
})
