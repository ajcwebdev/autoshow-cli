import type { HtmlArticleBackend, RuntimeOptions, Step2ProviderSelectionFilter, UrlArticleBackendPlan, UrlArticleTarget } from '~/types'
import { URL_ARTICLE_BACKENDS } from '../step-2-shared/provider-registry'
import { collectUrlProviderSpecs } from './url-cli'
import { isRemoteSource } from './url-utils'
export const isLocalUrlBackend = (backend: HtmlArticleBackend): boolean => backend === 'defuddle'

export const isHtmlArticleBackend = (value: unknown): value is HtmlArticleBackend =>
  typeof value === 'string' && (URL_ARTICLE_BACKENDS as readonly string[]).includes(value)

export const getUrlTargetKey = (target: Pick<UrlArticleTarget, 'service' | 'model'>): string =>
  `${target.service}:${target.model}`

export const formatUrlTargetLabel = (target: Pick<UrlArticleTarget, 'service' | 'model'>): string =>
  target.service === target.model ? target.service : `${target.service}/${target.model}`

export const getUrlProviderDirectoryName = (backend: HtmlArticleBackend): string => backend

export const getUrlTargetDirectoryName = (target: Pick<UrlArticleTarget, 'service'>): string =>
  getUrlProviderDirectoryName(target.service)

export const getUrlProviderArtifactDir = (backend: HtmlArticleBackend): string =>
  `providers/${getUrlProviderDirectoryName(backend)}`

export const toUrlArticleTarget = (
  backend: HtmlArticleBackend
): UrlArticleTarget => ({
  service: backend,
  model: backend
})

export const toRequestedUrlProvider = toUrlArticleTarget

export const getUrlTargetBackend = (
  target: UrlArticleTarget
): HtmlArticleBackend => target.service

export const getUrlTargetBackends = (
  targets: readonly UrlArticleTarget[]
): HtmlArticleBackend[] => targets.map(getUrlTargetBackend)

export const uniqueBackends = (backends: readonly HtmlArticleBackend[]): HtmlArticleBackend[] => {
  const seen = new Set<HtmlArticleBackend>()
  const unique: HtmlArticleBackend[] = []
  for (const backend of backends) {
    if (!seen.has(backend)) {
      unique.push(backend)
      seen.add(backend)
    }
  }
  return unique
}

export const uniqueUrlTargets = (
  targets: readonly UrlArticleTarget[]
): UrlArticleTarget[] => uniqueBackends(getUrlTargetBackends(targets)).map(toUrlArticleTarget)

export const collectUrlTargets = (
  options: Pick<RuntimeOptions, 'urlBackend' | 'urlBackendExplicit' | 'urlBackends' | 'step2SelectionOrigins'>,
  filter?: Step2ProviderSelectionFilter
): UrlArticleTarget[] =>
  collectUrlProviderSpecs(options, filter).flatMap((spec) => {
    if (!isHtmlArticleBackend(spec.provider) || spec.model !== spec.provider) {
      return []
    }
    return [toUrlArticleTarget(spec.provider)]
  })

export const resolveUrlArticleBackendPlan = (
  source: string,
  opts: RuntimeOptions
): UrlArticleBackendPlan => {
  const remote = isRemoteSource(source)
  const sourceRef = remote ? { url: source } : { filePath: source }
  const sourceUrl = remote ? source : undefined
  const allUrlMode = Array.isArray(opts.urlBackends) && opts.urlBackends.length > 0
  const selectedBackends = collectUrlTargets(opts).map((target) => target.service)
  const requestedBackends = allUrlMode
    ? (selectedBackends.length > 0 ? selectedBackends : opts.urlBackends ?? [...URL_ARTICLE_BACKENDS])
    : [remote ? selectedBackends[0] ?? opts.urlBackend : 'defuddle']
  const localHtmlRunnableBackends = requestedBackends.filter(isLocalUrlBackend)
  const localHtmlSkippedBackends = requestedBackends.filter((backend) => !isLocalUrlBackend(backend))

  return {
    remote,
    sourceRef,
    sourceUrl,
    allUrlMode,
    selectedBackends,
    requestedBackends,
    runnableBackends: remote ? requestedBackends : localHtmlRunnableBackends,
    skippedBackends: remote ? [] : localHtmlSkippedBackends,
    ignoresHostedBackendForLocalHtml: !remote && opts.urlBackend !== 'defuddle' && !allUrlMode
  }
}
