import { getOcrPoolAttemptRelativeDir } from '~/cli/commands/text/ocr/ocr-pooled-batch'
import { defaultOcrPoolLaneKey, runOcrPagePool } from '~/cli/commands/text/ocr/ocr-provider-pool'
import type { OcrTarget } from '~/types'

export const pageResult = (pageNumber: number, target: OcrTarget) => ({
  result: {
    pageNumber,
    method: 'ocr' as const,
    text: `${target.service}/${target.model}: page ${pageNumber}`
  },
  effectiveReasoningEffort: 'default'
})

export const runPool = async (overrides: Partial<Parameters<typeof runOcrPagePool>[0]> = {}) => {
  const targets: OcrTarget[] = [
    { service: 'openai', model: 'gpt-5.6-sol' },
    { service: 'mistral', model: 'mistral-ocr-4-0' }
  ]
  let clock = 1_000
  return await runOcrPagePool({
    totalPages: 4,
    requestedTargets: targets,
    targetsToRun: targets,
    providerConcurrency: 2,
    localConcurrency: 1,
    getLaneKey: defaultOcrPoolLaneKey,
    getTargetConcurrency: () => 2,
    getAttemptArtifactDir: getOcrPoolAttemptRelativeDir,
    processPage: async ({ pageNumber, target }) => pageResult(pageNumber, target),
    classifyFailure: (error) => ({
      scope: 'page',
      ambiguous: false,
      failure: { message: error instanceof Error ? error.message : String(error) }
    }),
    now: () => clock++,
    createClaimId: (() => {
      let id = 0
      return () => `claim-${++id}`
    })(),
    ...overrides
  })
}
