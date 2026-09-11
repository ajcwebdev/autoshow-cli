import type { TtsTarget } from '~/types'
import { canonicalTargetKey } from '~/utils/canonical-target-key'

export const ttsTarget = (model: string): TtsTarget => ({
  service: 'openai',
  model,
  operation: 'tts-synthesis',
  transport: 'hosted-api',
  targetKey: canonicalTargetKey('tts-synthesis', 'openai', model, 'hosted-api'),
  run: async () => { throw new Error('not called') }
})
