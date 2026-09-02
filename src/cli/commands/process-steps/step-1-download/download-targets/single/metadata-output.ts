import { formatMetadataAsFrontmatter } from '~/cli/commands/process-steps/step-0-metadata/format-metadata-frontmatter'
import { createManifest, createManifestItem, PIPELINE_MANIFEST_FILE, writeManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import * as l from '~/utils/app-logger/app-logger'
import { stageResult } from '~/utils/app-logger/result-emitter'
import type { DocumentMetadata, WebArticleMetadata } from '~/types'

export const buildDocumentMetadataView = (
  step1: DocumentMetadata,
  web?: WebArticleMetadata
): Record<string, unknown> => ({
  ...(step1.title ? { title: step1.title } : {}),
  slug: step1.slug,
  ...(step1.author ? { author: step1.author } : {}),
  pageCount: step1.pageCount,
  format: step1.format,
  fileSize: step1.fileSize,
  ...(step1.sourceFormat ? { sourceFormat: step1.sourceFormat } : {}),
  ...(step1.normalizedFormat ? { normalizedFormat: step1.normalizedFormat } : {}),
  ...(step1.conversionChain ? { conversionChain: step1.conversionChain } : {}),
  ...(step1.metadataSchemaVersion ? { metadataSchemaVersion: step1.metadataSchemaVersion } : {}),
  ...(web ? { web } : {})
})

export const writeMetadataTerminalOutput = (metadata: Record<string, unknown>, markdown: boolean): void => {
  const highlights = ['title', 'slug', 'duration', 'pageCount']
    .flatMap((key) => metadata[key] === undefined ? [] : [`${key}=${String(metadata[key])}`])
    .slice(0, 3)
  const message = highlights.length > 0 ? `Metadata: ${highlights.join(', ')}` : 'Metadata complete'
  if (markdown) {
    stageResult(metadata, message)
    process.stdout.write(formatMetadataAsFrontmatter(metadata) + '\n')
    return
  }

  l.write('success', message, { category: 'artifact', metadata })
  stageResult(metadata, message)
}

export const writeSavedMetadataArtifacts = async (
  outputDir: string,
  metadata: Record<string, unknown>,
  markdown: boolean,
  save: boolean
): Promise<void> => {
  await writeManifest(outputDir, createManifest('metadata', 'single', [
    createManifestItem(outputDir, { status: 'full', metadata: { step1: metadata } })
  ]))

  const artifactFiles: Record<string, string> = { manifest: PIPELINE_MANIFEST_FILE }
  if (save && markdown) {
    await Bun.write(`${outputDir}/metadata.md`, formatMetadataAsFrontmatter(metadata))
    artifactFiles['metadataMarkdown'] = 'metadata.md'
  }

  if (save) {
    l.write('info', `Saved ${Object.keys(artifactFiles).length} metadata artifacts to ${outputDir}`, {
      category: 'artifact',
      metadata: { outputDir, files: artifactFiles }
    })
  }
}
