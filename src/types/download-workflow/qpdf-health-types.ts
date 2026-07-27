import type { PdfChunkSplitAttempt, ResolvedRuntimeTool } from '~/types'

export type QpdfHealthFailureKind = Extract<
  NonNullable<PdfChunkSplitAttempt['failureKind']>,
  'qpdf_launch_failure' | 'qpdf_unavailable' | 'split_failed'
>

export type QpdfHealthResult =
  | {
      healthy: true
      info: ResolvedRuntimeTool
      repaired?: boolean | undefined
    }
  | {
      healthy: false
      info?: ResolvedRuntimeTool | undefined
      exitCode: number
      failureKind: QpdfHealthFailureKind
      message: string
    }
