import { isConvertibleEbookFormat } from '~/cli/commands/process-steps/step-0-metadata/formats/metadata-convertible-ebooks'
import { classifyOcrSourceKind } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/normalize'
import type { DetectResult, HtmlArticleBackend, OcrStep2ResolutionOptions, ResolvedStep2Execution, ResolvedStep2Provider, SttStep2ResolutionOptions } from '~/types'
import { collectStep2ProviderSelections } from './provider-registry'


const DEFAULT_TESSERACT_PROVIDER: ResolvedStep2Provider = {
  service: 'tesseract',
  model: 'tesseract',
  origin: 'default'
}

const toResolvedProvider = (
  selection: ReturnType<typeof collectStep2ProviderSelections>[number]
): ResolvedStep2Provider => ({
  service: selection.targetService,
  model: selection.model,
  origin: selection.origin
})

const hasPreparedMarkdown = (
  value: string | undefined
): boolean => typeof value === 'string' && value.trim().length > 0

const resolveArticleBackend = (
  options: Pick<OcrStep2ResolutionOptions, 'localHtmlDocument' | 'urlBackend'>
): HtmlArticleBackend =>
  options.localHtmlDocument === true ? 'defuddle' : (options.urlBackend ?? 'defuddle')

const resolveArticleBackends = (
  options: Pick<OcrStep2ResolutionOptions, 'localHtmlDocument' | 'urlBackends' | 'urlBackend'>
): HtmlArticleBackend[] | undefined => {
  if (!Array.isArray(options.urlBackends) || options.urlBackends.length === 0) {
    return undefined
  }
  return [...options.urlBackends]
}

const resolveArticleProviders = (
  options: OcrStep2ResolutionOptions,
  backend: HtmlArticleBackend,
  backends: HtmlArticleBackend[] | undefined
): ResolvedStep2Provider[] => {
  const selectedProviders = collectStep2ProviderSelections('url', options as Record<string, unknown>).map(toResolvedProvider)
  const selectedByService = new Map(selectedProviders.map((provider) => [provider.service, provider]))
  const providerForBackend = (targetBackend: HtmlArticleBackend): ResolvedStep2Provider =>
    selectedByService.get(targetBackend) ?? {
      service: targetBackend,
      model: targetBackend,
      origin: 'default'
    }

  return (backends ?? [backend]).map(providerForBackend)
}

const resolveArticleStep2 = (
  options: OcrStep2ResolutionOptions
): Extract<ResolvedStep2Execution, { route: 'article' }> => {
  const backends = resolveArticleBackends(options)
  const backend = backends?.[0] ?? resolveArticleBackend(options)
  return {
    route: 'article',
    sourceKind: 'article',
    backend,
    ...(backends ? { backends } : {}),
    providers: resolveArticleProviders(options, backend, backends)
  }
}

const resolveOcrProviders = (
  options: OcrStep2ResolutionOptions
): ResolvedStep2Provider[] =>
  collectStep2ProviderSelections('ocr', options as Record<string, unknown>).map(toResolvedProvider)

export const resolveSttStep2Execution = (
  options: SttStep2ResolutionOptions
): ResolvedStep2Execution => {
  const providers = collectStep2ProviderSelections('stt', options as Record<string, unknown>).map(toResolvedProvider)
  if (providers.length > 0) {
    return {
      route: 'stt',
      sourceKind: 'media',
      providers
    }
  }

  return {
    route: 'stt',
    sourceKind: 'media',
    providers: [{
      service: 'whisper',
      model: typeof options.whisperModel === 'string' && options.whisperModel.length > 0 ? options.whisperModel : 'tiny',
      origin: 'default'
    }]
  }
}

export const resolveOcrStep2ExecutionFromFormat = (
  format: DetectResult | undefined,
  options: OcrStep2ResolutionOptions
): ResolvedStep2Execution => {
  if (hasPreparedMarkdown(options.preparedMarkdown) || format === 'html') {
    return resolveArticleStep2(options)
  }

  if (!format) {
    return {
      route: 'unsupported',
      sourceKind: 'unsupported'
    }
  }

  if (format === 'csv') {
    return {
      route: 'native-document',
      sourceKind: 'csv'
    }
  }

  if (format === 'acsm') {
    return {
      route: 'native-document',
      sourceKind: 'acsm'
    }
  }

  const providers = resolveOcrProviders(options)
  const ocrSourceKind = classifyOcrSourceKind(
    { format },
    {
      preparedMarkdown: options.preparedMarkdown,
      epubInspect: format === 'epub' && options.useEpubBun === true,
      forceOcr: providers.length > 0
    }
  )

  switch (ocrSourceKind) {
    case 'article':
      return resolveArticleStep2(options)
    case 'epub-inspect':
      return {
        route: 'native-document',
        sourceKind: 'epub-inspect'
      }
    case 'office-native':
      return {
        route: 'native-document',
        sourceKind: format === 'epub' || isConvertibleEbookFormat(format) ? 'epub' : 'office'
      }
    case 'rtf-native':
      return {
        route: 'native-document',
        sourceKind: 'rtf'
      }
    case 'pdf':
      return {
        route: 'ocr',
        sourceKind: 'pdf',
        providers: providers.length > 0 ? providers : [DEFAULT_TESSERACT_PROVIDER]
      }
    case 'image':
      return {
        route: 'ocr',
        sourceKind: 'image',
        providers: providers.length > 0 ? providers : [DEFAULT_TESSERACT_PROVIDER]
      }
    case 'epub-pdf':
      return {
        route: 'ocr',
        sourceKind: 'epub-pdf',
        providers: providers.length > 0 ? providers : [DEFAULT_TESSERACT_PROVIDER]
      }
    case 'cbz-images':
      return {
        route: 'ocr',
        sourceKind: 'cbz-images',
        providers: providers.length > 0 ? providers : [DEFAULT_TESSERACT_PROVIDER]
      }
  }
}
