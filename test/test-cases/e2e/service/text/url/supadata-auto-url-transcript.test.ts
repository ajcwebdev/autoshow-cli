import { defineUrlTranscriptServiceTest } from './define-url-transcript-service-test'

const budgetKey = 'transcribe-supadata-auto'
void budgetKey

defineUrlTranscriptServiceTest({
  service: 'supadata',
  model: 'auto',
  provider: 'supadata',
  envVarKey: 'SUPADATA_API_KEY',
  envVarDescription: 'Supadata YouTube transcript retrieval',
})
