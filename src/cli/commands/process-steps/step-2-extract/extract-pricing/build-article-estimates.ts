import { estimateFirecrawlScrapeCost } from '~/cli/commands/process-steps/step-2-extract/extract-pricing/ocr-estimates'
import { hasConfiguredOcrProviderSelection, HTML_ARTICLE_OCR_FLAGS_IGNORED_WARNING } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/inactive-flag-warnings'
import { getExtractEstimation, getExtractPricing } from '~/cli/commands/setup-and-utilities/models/model-loader'
import type { ArticleEstimateResult, ExtractStepEstimate, HtmlArticleBackend, OcrSelectionState, ResolvedStep2Execution, UrlSelectionOptions } from '~/types'
import { applyCostMultiplier } from '~/cli/commands/pricing-orchestration/cost-helpers'

export const buildArticleEstimates = (
  resolvedStep2: Extract<ResolvedStep2Execution, { route: 'article' }>,
  opts: OcrSelectionState & Pick<UrlSelectionOptions, 'urlBackend'>,
  isRemoteTarget: boolean
): ArticleEstimateResult => {
  const estimates: ExtractStepEstimate[] = []
  const notes: string[] = []
  // `resolveArticleStep2` emits exactly one provider per requested backend, keyed by
  // backend name, so every `service` on the article route is an HtmlArticleBackend.
  const backends = resolvedStep2.providers.map(provider => provider.service as HtmlArticleBackend)

  for (const backend of backends) {
    if (backend === 'defuddle') {
      estimates.push({
        step: 'extract',
        provider: 'defuddle',
        model: 'defuddle',
        totalCost: 0,
        costMultiplier: 1,
        estimateType: 'exact',
        note: 'Local Defuddle article extraction runs on local CPU and is not billed by AutoShow.'
      })
      continue
    }

    if (!isRemoteTarget) {
      continue
    }

    if (backend === 'firecrawl') {
      const estimate = estimateFirecrawlScrapeCost()
      const estimation = getExtractEstimation(estimate.provider, estimate.model)
      const totalCost = applyCostMultiplier(estimate.totalCost, estimation.costMultiplier)
      estimates.push({
        step: 'extract',
        provider: estimate.provider,
        model: estimate.model,
        costPer1kPagesCents: estimate.costPer1kPagesCents,
        pageCount: estimate.pageCount,
        totalCost,
        costMultiplier: estimation.costMultiplier,
        estimateType: estimate.estimateType,
        note: estimate.note
      })
      continue
    }

    const model = backend
    const pricing = getExtractPricing(backend, model)
    const estimation = getExtractEstimation(backend, model)
    const totalCost = applyCostMultiplier((1 / 1000) * (pricing.costPer1kPagesCents ?? 0), estimation.costMultiplier)
    estimates.push({
      step: 'extract',
      provider: backend,
      model,
      ...(typeof pricing.costPer1kPagesCents === 'number' ? { costPer1kPagesCents: pricing.costPer1kPagesCents } : {}),
      pageCount: 1,
      totalCost,
      costMultiplier: estimation.costMultiplier,
      estimateType: 'exact'
    })
  }

  if (
    !isRemoteTarget &&
    backends.some((backend) => backend !== 'defuddle')
  ) {
    notes.push('Local HTML inputs always use the defuddle backend; hosted URL backends are skipped.')
  }

  if (!isRemoteTarget && opts.urlBackend !== 'defuddle') {
    notes.push(`Local HTML inputs always use the defuddle backend; --url-provider ${opts.urlBackend} is ignored.`)
  }

  if (hasConfiguredOcrProviderSelection(opts)) {
    notes.push(HTML_ARTICLE_OCR_FLAGS_IGNORED_WARNING)
  }

  return { estimates, notes }
}
