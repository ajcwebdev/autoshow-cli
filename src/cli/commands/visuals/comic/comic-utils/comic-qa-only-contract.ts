import { UsageError } from '~/utils/error-handler'

const QA_ONLY_RULES = {
  target: '--qa-only requires --target images',
  qa: '--qa-only cannot be combined with --no-qa',
  repairs: '--qa-only requires --max-repairs 0',
  panels: '--qa-only requires --panels-per-image 1',
  grid: '--qa-only cannot be combined with --grid',
  variation: '--qa-only cannot be combined with --variation',
  force: '--qa-only cannot be combined with --force',
  image: '--qa-only does not accept image-generation options (--image-model, --size, --quality)',
  guide: '--qa-only cannot be combined with --blocking-layout-guide',
} as const

export const assertQaOnlyRule = (rule: keyof typeof QA_ONLY_RULES, valid: boolean): void => {
  if (!valid) throw UsageError(QA_ONLY_RULES[rule])
}

export const QA_ONLY_MODE_NOTES = [
  'Generation uses --target images|sketches|both. Audit mode uses --qa-only; revision mode uses --revision-plan and cannot be combined with --qa-only.',
  'QA-only defaults: --target images, --max-repairs 0, --panels-per-image 1; no image generation, repair, or promotion.',
  ...Object.values(QA_ONLY_RULES).map(rule => `${rule}.`),
] as const
