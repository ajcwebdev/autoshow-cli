import { commandSupportsInputFamily, isExtractCommand } from '~/cli/commands/command-shared/process-command-kinds'
import { resolveOcrStep2ExecutionFromFormat, resolveSttStep2Execution } from '~/cli/commands/command-shared/extract-routing/resolved-step2'
import type { InputFamily, OcrSelectionOptions, ProcessCommand, ResolvedInputRouting, SttSelectionOptions, UrlRuntimeOptions } from '~/types'
import { classifyInputFamily, isLikelyUrl, resolveDocumentFormatHint } from './metadata-input-classifier'

export const describeUnsupportedInputForCommand = (
  command: ProcessCommand,
  family: InputFamily
): string => {
  if (isExtractCommand(command)) {
    if (family === 'unsupported') {
      return 'extract could not classify this input; verify the file type or route it explicitly as media or document content'
    }
    return 'extract only processes media, documents, images, HTML articles, and X Space links'
  }

  if (command === 'write') {
    return 'write only accepts local .md or .txt files or directories of those files. Run bun autoshow extract <input> first, then bun autoshow write on the extracted text'
  }

  return 'unsupported input'
}

type InputRoutingOptions = SttSelectionOptions
  & OcrSelectionOptions
  & Pick<UrlRuntimeOptions, 'urlBackendExplicit' | 'urlBackend' | 'urlBackends'>

const resolveStep2ForFamily = (
  family: InputFamily,
  documentFormatHint: Awaited<ReturnType<typeof resolveDocumentFormatHint>>,
  target: string,
  opts: InputRoutingOptions | undefined
): ResolvedInputRouting['resolvedStep2'] => {
  if (family === 'x_space') {
    return { route: 'unsupported' as const, sourceKind: 'unsupported' as const }
  }
  if (family === 'media') {
    return resolveSttStep2Execution(opts ?? {})
  }
  if (family === 'document' || family === 'html_article') {
    return resolveOcrStep2ExecutionFromFormat(
      documentFormatHint ?? (family === 'html_article' ? 'html' : 'pdf'),
      {
        ...(opts ?? {}),
        localHtmlDocument: family === 'html_article' && !isLikelyUrl(target)
      }
    )
  }
  return {
    route: 'unsupported',
    sourceKind: 'unsupported'
  }
}

const resolveExtractRoute = (
  family: InputFamily,
  supported: boolean,
  step2Route: ResolvedInputRouting['step2Route']
): ResolvedInputRouting['extractRoute'] => {
  if (family === 'x_space' && supported) return 'x-space'
  if (step2Route === 'stt') return 'media'
  if (step2Route === 'article') return 'article'
  if (step2Route === 'ocr' || step2Route === 'native-document') return 'document'
  return undefined
}

export const resolveInputRoutingForCommand = async (
  command: ProcessCommand,
  target: string,
  opts?: InputRoutingOptions
): Promise<ResolvedInputRouting> => {
  const family = await classifyInputFamily(target, opts)
  const documentFormatHint = await resolveDocumentFormatHint(target, family)
  const resolvedStep2 = resolveStep2ForFamily(family, documentFormatHint, target, opts)
  const supported = family !== 'unsupported' && commandSupportsInputFamily(command, family)
  const step2Route = resolvedStep2.route
  const extractRoute = resolveExtractRoute(family, supported, step2Route)

  return {
    family,
    step2Route,
    resolvedStep2,
    ...(extractRoute ? { extractRoute } : {}),
    supported,
    ...(!supported && isExtractCommand(command)
      ? { skipReason: describeUnsupportedInputForCommand(command, family) }
      : {})
  }
}
