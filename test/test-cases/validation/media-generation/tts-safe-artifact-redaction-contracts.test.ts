import { describe,expect,test } from 'bun:test'
import { mkdir,readFile,readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { runTtsForTargets } from '~/cli/commands/process-steps/step-4-tts/run-tts'
import { createInlineTtsSourceIdentity,createSingleTurnTtsDialoguePlan } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/generic-dialogue-plan'
import type { PipelineProviderState,TtsSerializedRequestObservation,TtsTarget } from '~/types'
import { canonicalTargetKey } from '~/utils/canonical-target-key'
import { withTempDir } from '../../../test-utils/temp-dirs'
import { requireDefined } from '../../../test-utils/value-assertions'

const FIXED_TIME = new Date(0).toISOString()
const MODEL = 'gpt-4o-mini-tts-2025-12-15'

const createOpenAiFixture = (onRun: () => void = () => {}): TtsTarget => ({
  service: 'openai',
  model: MODEL,
  voice: 'alloy',
  operation: 'tts-synthesis',
  transport: 'hosted-api',
  targetKey: canonicalTargetKey('tts-synthesis', 'openai', MODEL, 'hosted-api'),
  run: async () => {
    onRun()
    throw new Error('Safe-artifact lifecycle fixture must not invoke the target runner.')
  }
})

const sourceContextFor = (text: string) => {
  const sourceIdentity = createInlineTtsSourceIdentity(text)
  return {
    sourceIdentity,
    dialoguePlan: createSingleTurnTtsDialoguePlan(sourceIdentity, text, FIXED_TIME)
  }
}

const observationFor = (text: string): TtsSerializedRequestObservation => ({
  chunkIndex: 1,
  endpointKind: 'speech-synthesis',
  serializerVersion: 'openai.tts.phase-0-v1',
  serializedRequest: {
    body: {
      input: text,
      voice: 'alloy',
      response_format: 'wav'
    }
  },
  providerText: text,
  voiceField: 'voice',
  voices: [{ kind: 'provider-id', value: 'alloy' }],
  requestControls: { responseFormat: 'wav' },
  continuation: { kind: 'none' }
})

const withOpenAiCredential = async <T>(operation: () => Promise<T>): Promise<T> => {
  const previous = process.env['OPENAI_API_KEY']
  process.env['OPENAI_API_KEY'] = 'safe-artifact-local-fixture'
  try {
    return await operation()
  } finally {
    if (previous === undefined) delete process.env['OPENAI_API_KEY']
    else process.env['OPENAI_API_KEY'] = previous
  }
}

describe('safe artifact integration in the TTS lifecycle', () => {

  test('provider response text is excluded from retained evidence and the scheduler-facing failure', async () => {
    await withTempDir('autoshow-tts-provider-error-sanitization-', async (dir) => {
      const outputDir = join(dir, 'run')
      const text = 'Retain only a status-safe provider failure.'
      const canary = 'short-provider-body-canary@example.invalid'
      const sourceContext = sourceContextFor(text)
      const observedStates: PipelineProviderState[] = []
      const target: TtsTarget = {
        ...createOpenAiFixture(),
        run: async (sourceText, _workspaceDir, _options, _invocation, requestEvidence) => {
          if (!requestEvidence) throw new Error('Missing request evidence for provider-error sanitization fixture')
          return await requestEvidence.dispatch(
            observationFor(sourceText),
            { attempt: 1 },
            async () => {
              const providerError = new Error(`Provider response body: ${canary}`)
              Object.defineProperty(providerError, 'status', { value: 400, configurable: true })
              throw providerError
            }
          )
        }
      }
      await mkdir(outputDir)

      let schedulerError: unknown
      await withOpenAiCredential(async () => {
        try {
          await runTtsForTargets(text, outputDir, {}, [target], {
            ...sourceContext,
            onProviderState: async (state) => { observedStates.push(structuredClone(state)) }
          })
        } catch (error) {
          schedulerError = error
        }
      })

      expect(schedulerError).toBeInstanceOf(Error)
      const schedulerMessage = schedulerError instanceof Error ? schedulerError.message : String(schedulerError)
      expect(schedulerMessage).toContain('HTTP status 400')
      expect(schedulerMessage).not.toContain(canary)

      const failedState = requireDefined(observedStates.at(-1), 'retained provider-error state')
      expect(failedState.status).toBe('failed')
      expect(failedState.error?.['code']).toBe('http_400')
      expect(failedState.error?.['message']).toBe('TTS provider request failed with HTTP status 400.')
      expect(JSON.stringify(observedStates)).not.toContain(canary)

      const artifactNames = (await readdir(outputDir, { recursive: true }))
        .filter((name) => name.endsWith('.json'))
      expect(artifactNames.length).toBeGreaterThan(0)
      const retainedJson = await Promise.all(artifactNames.map(async (name) => ({
        name,
        text: await readFile(join(outputDir, name), 'utf8')
      })))
      expect(retainedJson.map((artifact) => artifact.text).join('\n')).not.toContain(canary)
      const rejectionArtifact = requireDefined(retainedJson.find((artifact) => artifact.name.endsWith('-rejection.json')), 'sanitized provider rejection evidence')
      const rejection = JSON.parse(rejectionArtifact.text) as { fields?: { code?: string, retryable?: boolean, status?: number, providerMessage?: string } }
      expect(rejection.fields).toEqual(expect.objectContaining({ code: 'http_400', retryable: false, status: 400 }))
      expect(rejection.fields?.providerMessage).toContain('[REDACTED_EMAIL]')
    })
  })
})
