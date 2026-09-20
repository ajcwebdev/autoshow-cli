import { afterEach, describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import type { ProviderVoiceDesignRequest, VoiceCandidate } from '~/types'
import { createAdvancedVoiceCandidates } from '~/cli/commands/audio/voice/advanced-voice-management'
import { computeVoiceCandidateId, validateVoiceCandidate } from '~/cli/commands/audio/voice/voice-management-contracts'
import { createProtectedVoiceAssetStore } from '~/cli/commands/audio/voice/voice-assets/protected-voice-asset-store'
import { createTempDirTracker } from '../../../../test-utils/temp-dirs'

const tempDirTracker = createTempDirTracker('autoshow-voice-candidate-settings-')
afterEach(tempDirTracker.cleanup)

const designCandidates = async (seed: number | undefined) => {
  const root = await tempDirTracker.make()
  const requests: ProviderVoiceDesignRequest[] = []
  const candidates = await createAdvancedVoiceCandidates({
    charactersRoot: join(root, 'characters'),
    protectedStore: createProtectedVoiceAssetStore({ storeId: 'voice_candidates', root: join(root, 'protected') }),
    provider: {
      provider: 'elevenlabs',
      design: {
        createCandidate: async (request) => {
          requests.push(request)
          return {
            schemaVersion: 1,
            provider: 'elevenlabs',
            operation: 'design',
            creationModel: request.creationModel,
            checkedAt: '2026-09-18T00:00:00.000Z',
            previews: [{ providerCandidateId: 'preview-1', audioBase64: Buffer.from('preview-bytes').toString('base64'), mediaType: 'audio/mpeg', sanitizedMetadata: {} as never }],
          }
        },
        materializeCandidate: async () => { throw new Error('Materialization is not part of this test.') },
      },
    },
    providerModel: 'eleven_v3',
    creationModel: 'eleven_ttv_v3',
    subjectKey: 'narrator',
    profileKey: 'default',
    description: 'Warm campfire storyteller',
    previewText: 'By the flicker of the fire, the camp director begins the legend.',
    candidateCount: 2,
    ...(seed !== undefined ? { seed } : {}),
    now: () => '2026-09-18T00:00:00.000Z',
  })
  return { candidates, requests }
}

describe('voice design candidate records', () => {
  test('record the preview text, candidate count, and seed that were sent to the provider', async () => {
    const { candidates, requests } = await designCandidates(4242)
    expect(requests[0]).toMatchObject({ candidateCount: 2, seed: 4242, creationModel: 'eleven_ttv_v3' })
    expect(candidates[0]).toMatchObject({
      creationModel: 'eleven_ttv_v3',
      generation: { previewText: 'By the flicker of the fire, the camp director begins the legend.', candidateCount: 2, seed: 4242 },
    })
  })

  test('omit the seed when none was requested', async () => {
    const { candidates } = await designCandidates(undefined)
    expect(candidates[0]?.generation).toEqual({ previewText: 'By the flicker of the fire, the camp director begins the legend.', candidateCount: 2 })
  })

  test('reject an invalid generation record', async () => {
    const { candidates } = await designCandidates(1)
    const { candidateId: _candidateId, ...rest } = candidates[0] as VoiceCandidate
    const invalid = { ...rest, generation: { previewText: 'x', candidateCount: 0 } }
    expect(() => validateVoiceCandidate({ ...invalid, candidateId: computeVoiceCandidateId(invalid) } as VoiceCandidate)).toThrow('positive candidate count')
  })
})
