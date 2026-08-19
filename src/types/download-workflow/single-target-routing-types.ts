import type {
  DownloadCommandOptions,
  ExtractCommandOptions,
  InputFamily,
  MetadataCommandOptions,
  UrlInputKind,
  WriteRuntimeOptions
} from '~/types'

export type MetadataSingleTargetIntent = {
  command: 'metadata'
  opts: MetadataCommandOptions
}

export type DownloadSingleTargetIntent = {
  command: 'download'
  opts: DownloadCommandOptions
}

export type ExtractSingleTargetIntent = {
  command: 'extract'
  opts: ExtractCommandOptions
}

export type WriteSingleTargetIntent = {
  command: 'write'
  opts: WriteRuntimeOptions
}

export type SingleTargetIntent =
  | MetadataSingleTargetIntent
  | DownloadSingleTargetIntent
  | ExtractSingleTargetIntent
  | WriteSingleTargetIntent

export type SingleTargetClassifiedInput =
  | { kind: 'url', subtype: UrlInputKind }
  | { kind: 'local', family: Exclude<InputFamily, 'x_space'> }
  | { kind: 'x_space_identifier' }
  | { kind: 'missing' }

export type SingleTargetInputCategory =
  | UrlInputKind
  | 'local_html_article'
  | 'local_document'
  | 'local_media'
  | 'local_unsupported'
  | 'x_space_identifier'
  | 'missing'

export type MetadataSingleTargetAction =
  | 'x-space'
  | 'temporary-document'
  | 'article'
  | 'document'
  | 'media'

export type DownloadSingleTargetAction =
  | 'x-space'
  | 'temporary-document'
  | 'article'
  | 'document'
  | 'media'

export type ExtractSingleTargetAction =
  | 'x-space'
  | 'temporary-document'
  | 'article'
  | 'document'
  | 'media'

export type WriteSingleTargetAction =
  | 'text'
  | 'x-space'
  | 'temporary-document'
  | 'article'
  | 'document'
  | 'media'

export type SingleTargetAction =
  | MetadataSingleTargetAction
  | DownloadSingleTargetAction
  | ExtractSingleTargetAction
  | WriteSingleTargetAction

export type MetadataSingleTargetRoute = {
  command: 'metadata'
  action: MetadataSingleTargetAction
}

export type DownloadSingleTargetRoute = {
  command: 'download'
  action: DownloadSingleTargetAction
}

export type ExtractSingleTargetRoute = {
  command: 'extract'
  action: ExtractSingleTargetAction
}

export type WriteSingleTargetRoute = {
  command: 'write'
  action: WriteSingleTargetAction
}

export type SingleTargetRoute =
  | MetadataSingleTargetRoute
  | DownloadSingleTargetRoute
  | ExtractSingleTargetRoute
  | WriteSingleTargetRoute

export type RoutingFailure =
  | 'missing'
  | 'unrecognized-extract'
  | 'download-passthrough'
  | 'text-url'
  | 'text-path'

export type MetadataMatrixEntry = MetadataSingleTargetAction | RoutingFailure
export type DownloadMatrixEntry = DownloadSingleTargetAction | RoutingFailure
export type ExtractMatrixEntry = ExtractSingleTargetAction | RoutingFailure
export type WriteMatrixEntry = WriteSingleTargetAction | RoutingFailure
