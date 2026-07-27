import type {
  PdfChunkDisabledToolSummary,
  PdfChunkPreparationStrategy,
  PdfChunkPreparationSummary,
  PdfChunkSplitAttempt,
  PdfChunkSplitTool
} from '~/types'

export type PdfChunkPreparationState = {
  mode: PdfChunkPreparationStrategy
  directPageAttempts: number
  directSuccesses: number
  directFailures: number
  rasterizedPages: number
  directSplittingDisabledAtPage?: number | undefined
  toolAttempts: Record<PdfChunkSplitTool, number>
  toolExitCodes: Record<PdfChunkSplitTool, Record<string, number>>
  toolFallbackSuccessExitCodes: Record<PdfChunkSplitTool, Record<string, number>>
  toolPaths: Partial<Record<PdfChunkSplitTool, string>>
  toolSources: Partial<Record<PdfChunkSplitTool, PdfChunkSplitAttempt['source']>>
  toolFailureKinds: Partial<Record<PdfChunkSplitTool, PdfChunkSplitAttempt['failureKind']>>
  toolFailureMessages: Partial<Record<PdfChunkSplitTool, string>>
  disabledTools: Partial<Record<PdfChunkSplitTool, PdfChunkDisabledToolSummary>>
  lastDirectFailure?: PdfChunkPreparationSummary['lastDirectFailure']
  runExclusiveDirectProbe: <T>(task: () => Promise<T>) => Promise<T>
}
