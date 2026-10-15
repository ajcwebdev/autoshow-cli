import { defineSTTServiceTest } from '../../../../../test-utils/define-stt-service-test'
import { cloudflareWhisper } from '../cases'

defineSTTServiceTest({
  ...cloudflareWhisper,
  models: ['@cf/openai/whisper-large-v3-turbo', '@cf/openai/whisper', '@cf/openai/whisper-tiny-en'],
  extraEnvVarKeys: [...cloudflareWhisper.extraEnvVarKeys],
  sttService: 'cloudflare',
})
