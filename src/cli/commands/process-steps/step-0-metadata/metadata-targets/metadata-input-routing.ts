import { commandSupportsInputFamily, isExtractCommand } from '~/cli/commands/process-steps/process-command-kinds'
import { resolveOcrStep2ExecutionFromFormat, resolveSttStep2Execution } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/resolved-step2'
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

export const resolveInputRoutingForCommand = async (
  command: ProcessCommand,
  target: string,
  opts?: SttSelectionOptions
    & OcrSelectionOptions
    & Pick<UrlRuntimeOptions, 'urlBackendExplicit' | 'urlBackend' | 'urlBackends'>
): Promise<ResolvedInputRouting> => {
  const family = await classifyInputFamily(target, opts)
  const documentFormatHint = await resolveDocumentFormatHint(target, family)
  const resolvedStep2: ResolvedInputRouting['resolvedStep2'] = family === 'x_space'
    ? { route: 'unsupported' as const, sourceKind: 'unsupported' as const }
    : family === 'media'
    ? resolveSttStep2Execution(opts ?? {})
    : family === 'document' || family === 'html_article'
      ? resolveOcrStep2ExecutionFromFormat(
          documentFormatHint ?? (family === 'html_article' ? 'html' : 'pdf'),
          {
            ...(opts ?? {}),
            localHtmlDocument: family === 'html_article' && !isLikelyUrl(target)
          }
        )
      : {
          route: 'unsupported',
          sourceKind: 'unsupported'
        }
  const supported = family !== 'unsupported' && commandSupportsInputFamily(command, family)
  const step2Route = resolvedStep2.route
  const extractRoute = family === 'x_space' && supported
    ? 'x-space'
    : step2Route === 'stt'
    ? 'media'
    : step2Route === 'article'
    ? 'article'
    : step2Route === 'ocr' || step2Route === 'native-document'
      ? 'document'
      : undefined

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
