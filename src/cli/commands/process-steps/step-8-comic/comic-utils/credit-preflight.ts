import type { CreditPreflightDependencies, CreditPreflightResult } from '~/types'
import { getOpenAIClientConfig } from '~/cli/commands/process-steps/step-3-write/write-services/write-openai/openai-utils'
import { openAIGetRequest } from '~/utils/openai/openai-client'
import { OpenAIRestError } from '~/utils/openai/openai-client'
import { UsageError } from '~/utils/error-handler'
import { comicLog } from './comic-logger'

const BLOCKING_STATUSES: ReadonlySet<number> = new Set([401, 402, 403, 429])

const describeStatus = (status: number): string =>
  status === 401 ? 'the configured OpenAI credential was rejected'
    : status === 402 ? 'the OpenAI account has insufficient credit'
      : status === 403 ? 'the configured OpenAI credential is not permitted to use this account'
        : 'the OpenAI account is rate limited or out of quota'

/** Zero-cost credential and credit check: one GET of the provider's model list before any paid call. */
export const runComicCreditPreflight = async (
  options: { provider?: 'openai'; price?: boolean | undefined },
  dependencies: CreditPreflightDependencies = {},
): Promise<CreditPreflightResult> => {
  const provider = options.provider ?? 'openai'
  if (options.price === true) {
    comicLog.line(`  Credit preflight would run against provider=${provider} (no request is made in --price mode)`)
    return { provider, status: 'skipped-price-mode' }
  }
  const listModels = dependencies.listModels ?? (async () => {
    await openAIGetRequest(getOpenAIClientConfig(), '/models', { errorMessagePrefix: 'OpenAI credit preflight failed' })
    return { status: 200 }
  })
  try {
    const response = await listModels()
    if (BLOCKING_STATUSES.has(response.status)) {
      throw UsageError(`Credit preflight failed for provider ${provider}: ${describeStatus(response.status)} (HTTP ${response.status}). No image was generated.`, { stage: 'comic:credit-preflight' })
    }
    comicLog.line(`  credit preflight ok provider=${provider}`)
    return { provider, status: 'ok' }
  } catch (error) {
    const status = error instanceof OpenAIRestError ? error.status : undefined
    if (status !== undefined && BLOCKING_STATUSES.has(status)) {
      throw UsageError(`Credit preflight failed for provider ${provider}: ${describeStatus(status)} (HTTP ${status}). No image was generated.`, { stage: 'comic:credit-preflight' })
    }
    throw error
  }
}
