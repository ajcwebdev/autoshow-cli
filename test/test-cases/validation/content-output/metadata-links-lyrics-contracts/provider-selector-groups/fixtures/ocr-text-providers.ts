import { CEREBRAS_MODELS_LINKS, KIMI_MODELS_LINKS } from './model-providers'

export const GLM_OCR_LINKS = [
  'https://docs.z.ai/api-reference/tools/layout-parsing.md'
]

export const CEREBRAS_GENERAL_LINKS = [
  'https://inference-docs.cerebras.ai/introduction.md',
  'https://inference-docs.cerebras.ai/support/rate-limits.md',
  'https://inference-docs.cerebras.ai/console/overview.md',
  'https://inference-docs.cerebras.ai/console/api-keys.md',
  'https://inference-docs.cerebras.ai/console/usage-monitoring.md',
  'https://inference-docs.cerebras.ai/console/account-billing.md'
]

export const CEREBRAS_TEXT_LINKS = [
  'https://inference-docs.cerebras.ai/capabilities/structured-outputs.md',
  'https://inference-docs.cerebras.ai/capabilities/payload-optimization.md',
  'https://inference-docs.cerebras.ai/api-reference/chat-completions.md',
  'https://inference-docs.cerebras.ai/api-reference/authentication.md',
  'https://inference-docs.cerebras.ai/api-reference/versions.md'
]

export const CEREBRAS_ALL_LINKS = [
  ...CEREBRAS_GENERAL_LINKS,
  ...CEREBRAS_MODELS_LINKS,
  ...CEREBRAS_TEXT_LINKS
]

export const KIMI_GENERAL_LINKS = [
  'https://platform.kimi.ai/docs/overview.md',
  'https://platform.kimi.ai/docs/api/overview.md',
  'https://platform.kimi.ai/docs/api/errors.md',
  'https://platform.kimi.ai/docs/guide/faq.md',
  'https://platform.kimi.ai/docs/api/estimate.md',
  'https://platform.kimi.ai/docs/introduction.md',
  'https://platform.kimi.ai/docs/guide/start-using-kimi-api.md'
]

export const KIMI_TEXT_LINKS = [
  'https://platform.kimi.ai/docs/pricing/chat-k26.md',
  'https://platform.kimi.ai/docs/api/chat.md',
  'https://platform.kimi.ai/docs/guide/use-json-mode-feature-of-kimi-api.md',
  'https://platform.kimi.ai/docs/guide/prompt-best-practice.md'
]

export const KIMI_OCR_LINKS = [
  'https://platform.kimi.ai/docs/api/files-upload.md'
]

export const KIMI_ALL_LINKS = [
  ...KIMI_GENERAL_LINKS,
  ...KIMI_MODELS_LINKS,
  ...KIMI_TEXT_LINKS,
  ...KIMI_OCR_LINKS
]
