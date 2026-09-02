import type { RenderedTextArtifactResult, ShowNoteArtifactResult, Step3Metadata, StructuredRunResult } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { writeShowNoteArtifacts } from './show-note-artifacts'
import { writeRenderedTextArtifacts } from './text-input-utils'

export const writeWriteFlowArtifacts = async (input: {
  outputDir: string
  results: StructuredRunResult[]
  showNoteResults: StructuredRunResult[]
  sourceText: string
  sourcePath?: string | undefined
  externalBaseName?: string | undefined
  opts: {
    renderedText: boolean
    trackList?: string | undefined
    renderedOutDir?: string | undefined
  }
}): Promise<{
  renderedArtifacts: RenderedTextArtifactResult
  showNoteArtifacts: ShowNoteArtifactResult
}> => {
  const renderedArtifacts = await writeRenderedTextArtifacts({
    outputDir: input.outputDir,
    results: input.results,
    writeInternal: input.opts.renderedText,
    sourcePath: input.sourcePath,
    trackListPath: input.opts.trackList,
    externalDir: input.opts.renderedOutDir,
    externalBaseName: input.externalBaseName
  })

  if (renderedArtifacts.externalFiles.length > 0) {
    l.write('info', `Wrote ${renderedArtifacts.externalFiles.length} rendered files to ${input.opts.renderedOutDir}`, {
      category: 'artifact',
      metadata: { artifact: 'renderedOutDir', path: input.opts.renderedOutDir, files: renderedArtifacts.externalFiles }
    })
  }

  const showNoteArtifacts = await writeShowNoteArtifacts({
    outputDir: input.outputDir,
    results: input.showNoteResults,
    sourceText: input.sourceText
  })

  return { renderedArtifacts, showNoteArtifacts }
}

export const serializeStep3Results = (
  step3Results: readonly Step3Metadata[]
): Step3Metadata | Step3Metadata[] =>
  step3Results.length === 1 ? step3Results[0] as Step3Metadata : [...step3Results]

export const applySummaryArtifactNames = (
  artifactFiles: Record<string, string>,
  step3Results: readonly Step3Metadata[]
): void => {
  if (step3Results.length === 1) {
    artifactFiles['summary'] = step3Results[0]?.outputFileName ?? 'text.json'
    return
  }

  for (const step3 of step3Results) {
    const summaryKey = step3.outputFileName.replace(/\.json$/u, '').replace(/^text-/u, 'summary-')
    artifactFiles[summaryKey] = step3.outputFileName
  }
}
