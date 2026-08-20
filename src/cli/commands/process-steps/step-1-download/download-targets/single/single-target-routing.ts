import { detectDocumentFormat } from '~/cli/commands/process-steps/step-0-metadata/formats/metadata-detect-format'
import {
  classifyExistingLocalInputFamily,
  classifyUrlInput,
  isDocumentByExtension,
  isHtmlDocumentPath,
  isLikelyUrl,
  isRawXSpaceId
} from '~/cli/commands/process-steps/step-0-metadata/metadata-targets/metadata-input-classifier'
import { isTextInputPath } from '~/cli/commands/process-steps/step-3-write/text-input-utils'
import type {
  DownloadCommandOptions,
  DownloadMatrixEntry,
  DownloadSingleTargetRoute,
  DownloadSingleTargetIntent,
  ExtractCommandOptions,
  ExtractMatrixEntry,
  ExtractSingleTargetRoute,
  ExtractSingleTargetIntent,
  MetadataCommandOptions,
  MetadataMatrixEntry,
  MetadataSingleTargetRoute,
  MetadataSingleTargetIntent,
  ProcessCommand,
  RoutingFailure,
  SingleTargetAction,
  SingleTargetClassifiedInput,
  SingleTargetCommandOptions,
  SingleTargetInputCategory,
  SingleTargetIntent,
  SingleTargetRoute,
  WriteMatrixEntry,
  WriteRuntimeOptions,
  WriteSingleTargetRoute,
  WriteSingleTargetIntent
} from '~/types'
import { fileExists } from '~/utils/cli-utils'
import { CLIUsageError, ValidationError } from '~/utils/error-handler'
import { createOptionsAssertion, type OptionsAssertion } from '~/cli/commands/process-steps/command-option-assertion'
import { throwUnrecognizedExtractInput } from './single-target-errors'

const METADATA_ROUTES = {
  url_streaming: 'media',
  url_direct_media: 'media',
  url_direct_document: 'temporary-document',
  url_html_article: 'article',
  url_x_space: 'x-space',
  local_html_article: 'article',
  local_document: 'document',
  local_media: 'media',
  local_unsupported: 'media',
  x_space_identifier: 'x-space',
  missing: 'missing'
} as const satisfies Record<SingleTargetInputCategory, MetadataMatrixEntry>

const DOWNLOAD_ROUTES = {
  url_streaming: 'media',
  url_direct_media: 'media',
  url_direct_document: 'temporary-document',
  url_html_article: 'article',
  url_x_space: 'x-space',
  local_html_article: 'article',
  local_document: 'document',
  local_media: 'media',
  local_unsupported: 'media',
  x_space_identifier: 'x-space',
  missing: 'missing'
} as const satisfies Record<SingleTargetInputCategory, DownloadMatrixEntry>

const EXTRACT_ROUTES = {
  url_streaming: 'media',
  url_direct_media: 'media',
  url_direct_document: 'temporary-document',
  url_html_article: 'article',
  url_x_space: 'x-space',
  local_html_article: 'article',
  local_document: 'document',
  local_media: 'media',
  local_unsupported: 'unrecognized-extract',
  x_space_identifier: 'x-space',
  missing: 'missing'
} as const satisfies Record<SingleTargetInputCategory, ExtractMatrixEntry>

const WRITE_ROUTES = {
  url_streaming: 'media',
  url_direct_media: 'media',
  url_direct_document: 'temporary-document',
  url_html_article: 'article',
  url_x_space: 'x-space',
  local_html_article: 'article',
  local_document: 'document',
  local_media: 'media',
  local_unsupported: 'media',
  x_space_identifier: 'x-space',
  missing: 'missing'
} as const satisfies Record<SingleTargetInputCategory, WriteMatrixEntry>

const isRoutingFailure = (
  entry: MetadataMatrixEntry | DownloadMatrixEntry | ExtractMatrixEntry | WriteMatrixEntry
): entry is RoutingFailure => {
  switch (entry) {
    case 'missing':
    case 'unrecognized-extract':
    case 'download-passthrough':
    case 'text-url':
    case 'text-path':
      return true
    default:
      return false
  }
}

const throwRoutingFailure = (
  failure: RoutingFailure,
  command: SingleTargetIntent['command'],
  item: string
): never => {
  switch (failure) {
    case 'missing':
      throw CLIUsageError(`Input does not exist: ${item}. Run: bun autoshow help ${command}`)
    case 'unrecognized-extract':
      return throwUnrecognizedExtractInput(item)
    case 'download-passthrough':
      throw CLIUsageError(`yt-dlp passthrough args (--) are only supported for media URL downloads. Got: ${item}`)
    case 'text-url':
      throw CLIUsageError('write --text-input only accepts local .md or .txt files or directories')
    case 'text-path':
      throw CLIUsageError(`write --text-input only accepts .md or .txt files. Got: ${item}`)
  }
}

const assertMetadataOptions: OptionsAssertion<SingleTargetCommandOptions, MetadataCommandOptions> =
  createOptionsAssertion('Metadata command options are incomplete', ['markdown', 'save'])

const assertDownloadOptions: OptionsAssertion<SingleTargetCommandOptions, DownloadCommandOptions> =
  createOptionsAssertion('Download command options are incomplete', ['keepOriginalMedia', 'ytDlpPassthroughArgs'])

const assertWriteOptions: OptionsAssertion<SingleTargetCommandOptions, WriteRuntimeOptions> =
  createOptionsAssertion('Write command options are incomplete', ['llmProviderConcurrency', 'skipLLM'])

const assertExtractOrWriteOptions: OptionsAssertion<SingleTargetCommandOptions, ExtractCommandOptions | WriteRuntimeOptions> =
  createOptionsAssertion('Extract/write command options are incomplete', ['whisperModel', 'sttProviderConcurrency'])

export const normalizeSingleTargetIntent = (
  command: ProcessCommand,
  opts: SingleTargetCommandOptions
): SingleTargetIntent => {
  switch (command) {
    case 'metadata':
      assertMetadataOptions(opts)
      return { command, opts }
    case 'download':
      assertDownloadOptions(opts)
      return { command, opts }
    case 'extract':
      assertExtractOrWriteOptions(opts)
      return { command, opts }
    case 'write':
      assertExtractOrWriteOptions(opts)
      assertWriteOptions(opts)
      return { command, opts }
    case 'tts':
    case 'image':
    case 'video':
    case 'music':
    case 'comic':
      throw ValidationError(`Single-target routing does not support the "${command}" command`)
  }
}

const classifyMetadataOrDownloadLocalInput = async (
  item: string
): Promise<SingleTargetClassifiedInput> => {
  if (isHtmlDocumentPath(item)) {
    return { kind: 'local', family: 'html_article' }
  }

  const isDocumentExtension = isDocumentByExtension(item)
  const detected = isDocumentExtension ? await detectDocumentFormat(item) : null
  return {
    kind: 'local',
    family: isDocumentExtension || detected !== null ? 'document' : 'media'
  }
}

export const classifySingleTargetInput = async (
  item: string,
  intent: SingleTargetIntent
): Promise<SingleTargetClassifiedInput> => {
  if (isLikelyUrl(item)) {
    const urlClassificationOptions = intent.command === 'write' && intent.opts.textInput
      ? { urlBackendExplicit: true }
      : intent.opts
    return { kind: 'url', subtype: await classifyUrlInput(item, urlClassificationOptions) }
  }

  if (!await fileExists(item)) {
    return isRawXSpaceId(item)
      ? { kind: 'x_space_identifier' }
      : { kind: 'missing' }
  }

  if (intent.command === 'metadata' || intent.command === 'download') {
    return await classifyMetadataOrDownloadLocalInput(item)
  }

  return {
    kind: 'local',
    family: await classifyExistingLocalInputFamily(item)
  }
}

export const singleTargetInputCategory = (
  input: SingleTargetClassifiedInput
): SingleTargetInputCategory => {
  switch (input.kind) {
    case 'url':
      return input.subtype
    case 'x_space_identifier':
      return 'x_space_identifier'
    case 'missing':
      return 'missing'
    case 'local':
      switch (input.family) {
        case 'html_article':
          return 'local_html_article'
        case 'document':
          return 'local_document'
        case 'media':
          return 'local_media'
        case 'unsupported':
          return 'local_unsupported'
      }
  }
}

const isUrlCategory = (category: SingleTargetInputCategory): boolean => {
  switch (category) {
    case 'url_streaming':
    case 'url_direct_media':
    case 'url_direct_document':
    case 'url_html_article':
    case 'url_x_space':
      return true
    default:
      return false
  }
}

const allowsDownloadPassthrough = (
  category: SingleTargetInputCategory
): boolean =>
  category === 'url_streaming'
  || category === 'url_direct_media'
  || category === 'url_x_space'
  || category === 'x_space_identifier'

const resolveEntry = <TCommand extends SingleTargetIntent['command'], TAction extends SingleTargetAction>(
  command: TCommand,
  entry: TAction | RoutingFailure,
  item: string
): { command: TCommand, action: TAction } => {
  if (isRoutingFailure(entry)) {
    return throwRoutingFailure(entry, command, item)
  }
  return { command, action: entry }
}

export const resolveSingleTargetRouteDecision = (
  command: SingleTargetIntent['command'],
  category: SingleTargetInputCategory,
  item: string,
  modifiers: {
    textInput?: boolean | undefined
    downloadPassthrough?: boolean | undefined
  } = {}
): SingleTargetRoute => {
  if (command === 'write' && modifiers.textInput) {
    if (isUrlCategory(category)) {
      return throwRoutingFailure('text-url', command, item)
    }
    if (!isTextInputPath(item)) {
      return throwRoutingFailure('text-path', command, item)
    }
    return { command, action: 'text' }
  }

  if (category === 'missing') {
    return throwRoutingFailure('missing', command, item)
  }

  if (command === 'download' && modifiers.downloadPassthrough && !allowsDownloadPassthrough(category)) {
    return throwRoutingFailure('download-passthrough', command, item)
  }

  switch (command) {
    case 'metadata':
      return resolveEntry(command, METADATA_ROUTES[category], item)
    case 'download':
      return resolveEntry(command, DOWNLOAD_ROUTES[category], item)
    case 'extract':
      return resolveEntry(command, EXTRACT_ROUTES[category], item)
    case 'write':
      return resolveEntry(command, WRITE_ROUTES[category], item)
  }
}

export function resolveSingleTargetRoute (
  intent: MetadataSingleTargetIntent,
  input: SingleTargetClassifiedInput,
  item: string
): MetadataSingleTargetRoute
export function resolveSingleTargetRoute (
  intent: DownloadSingleTargetIntent,
  input: SingleTargetClassifiedInput,
  item: string
): DownloadSingleTargetRoute
export function resolveSingleTargetRoute (
  intent: ExtractSingleTargetIntent,
  input: SingleTargetClassifiedInput,
  item: string
): ExtractSingleTargetRoute
export function resolveSingleTargetRoute (
  intent: WriteSingleTargetIntent,
  input: SingleTargetClassifiedInput,
  item: string
): WriteSingleTargetRoute
export function resolveSingleTargetRoute (
  intent: SingleTargetIntent,
  input: SingleTargetClassifiedInput,
  item: string
): SingleTargetRoute
export function resolveSingleTargetRoute (
  intent: SingleTargetIntent,
  input: SingleTargetClassifiedInput,
  item: string
): SingleTargetRoute {
  return resolveSingleTargetRouteDecision(
    intent.command,
    singleTargetInputCategory(input),
    item,
    {
      ...(intent.command === 'write' ? { textInput: intent.opts.textInput } : {}),
      ...(intent.command === 'download'
        ? { downloadPassthrough: (intent.opts.ytDlpPassthroughArgs?.length ?? 0) > 0 }
        : {})
    }
  )
}
