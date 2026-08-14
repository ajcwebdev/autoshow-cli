import { describe, expect, test } from 'bun:test'
import {
  REPLICATE_AUDIOGEN_MODEL_ID,
  REPLICATE_AUDIOGEN_PINNED_VERSION,
  REPLICATE_AUDIOGEN_SFX_CAPABILITY_FIXTURE,
  createReplicateAudioGenAdapter,
  resolveReplicateAudioGenTarget,
  serializeReplicateAudioGenRequest,
  validateReplicateAudioGenTask
} from '~/cli/commands/process-steps/step-4-tts/soundscape/replicate-audiogen-adapter'
import { resolveSoundEffectTarget } from '~/cli/commands/process-steps/step-4-tts/soundscape/elevenlabs-sfx-adapter'
import type { SoundEffectRenderTask } from '~/types'

describe('ADR-018 Phase 4 Replicate AudioGen Contracts', () => {
  test('capability fixture declares pinned version, CC BY-NC 4.0 license, and noncommercial scope', () => {
    expect(REPLICATE_AUDIOGEN_SFX_CAPABILITY_FIXTURE.provider).toBe('replicate')
    expect(REPLICATE_AUDIOGEN_SFX_CAPABILITY_FIXTURE.model).toBe('sepal/audiogen')
    expect(REPLICATE_AUDIOGEN_SFX_CAPABILITY_FIXTURE.pinnedVersion).toBe(REPLICATE_AUDIOGEN_PINNED_VERSION)
    expect(REPLICATE_AUDIOGEN_SFX_CAPABILITY_FIXTURE.licenseProvenance).toBe('CC BY-NC 4.0')
    expect(REPLICATE_AUDIOGEN_SFX_CAPABILITY_FIXTURE.permittedUse).toBe('noncommercial')
    expect(REPLICATE_AUDIOGEN_SFX_CAPABILITY_FIXTURE.capabilityFixtureHash).toBeDefined()
  })

  test('sound-effect target resolution resolves replicate=sepal/audiogen', () => {
    const target = resolveSoundEffectTarget('replicate=sepal/audiogen')
    expect(target.provider).toBe('replicate')
    expect(target.model).toBe('sepal/audiogen')
    expect(target.outputFormat).toBe('wav')
  })

  test('sound-effect target resolution accepts pinned version explicitly', () => {
    const target = resolveReplicateAudioGenTarget(`sepal/audiogen@${REPLICATE_AUDIOGEN_PINNED_VERSION}`)
    expect(target.provider).toBe('replicate')
    expect(target.model).toBe(REPLICATE_AUDIOGEN_MODEL_ID)
  })

  test('sound-effect target resolution rejects unreviewed version string', () => {
    expect(() => resolveReplicateAudioGenTarget('sepal/audiogen@unreviewed_version_hash')).toThrow(
      /Unreviewed Replicate AudioGen version/
    )
  })

  test('serialization validates duration and prompt bounds', () => {
    const target = resolveReplicateAudioGenTarget('sepal/audiogen')
    const validTask: SoundEffectRenderTask = {
      taskId: 'task-1',
      cueId: 'cue-1',
      kind: 'action-sfx',
      required: true,
      generationIdentity: 'gen-1',
      requestIdentity: 'req-1',
      prompt: 'laser blast echoing down ship corridor',
      durationSeconds: 3,
      loop: false,
      outputFormat: 'wav',
      promptInfluence: 1,
    }
    const serialized = serializeReplicateAudioGenRequest(validTask, target)
    expect(serialized.path).toBe('/v1/predictions')
    expect(serialized.body.version).toBe(`${REPLICATE_AUDIOGEN_MODEL_ID}:${REPLICATE_AUDIOGEN_PINNED_VERSION}`)
    expect(serialized.body.input.prompt).toBe('laser blast echoing down ship corridor')
    expect(serialized.body.input.duration).toBe(3)

    const invalidTask: SoundEffectRenderTask = {
      ...validTask,
      durationSeconds: 15,
    }
    expect(() => validateReplicateAudioGenTask(invalidTask, target)).toThrow(/duration must be 1-10 seconds/)
  })

  test('createReplicateAudioGenAdapter requires API token', () => {
    expect(() => createReplicateAudioGenAdapter({ apiToken: '' })).toThrow(/requires REPLICATE_API_TOKEN/)
  })
})
