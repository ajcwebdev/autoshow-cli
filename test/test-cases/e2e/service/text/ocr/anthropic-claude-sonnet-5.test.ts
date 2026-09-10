import { defineOCRServiceTest } from '../../../../../test-utils/define-ocr-service-test'
import { anthropicOcr, hostedOcrImageInput } from './cases'

defineOCRServiceTest({
  ...anthropicOcr,
  models: ['claude-sonnet-5'],
  expectedService: 'anthropic',
  inputMode: 'image-only',
  imageInput: hostedOcrImageInput,
  assertProviderMetadata: true,
})
