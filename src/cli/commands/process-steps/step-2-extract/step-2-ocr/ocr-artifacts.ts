import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { ExtractionMetadata, ExtractionOptions, ExtractionResult, TextArtifactFile } from '~/types'
import { writeFile } from '~/utils/cli-utils'
import { writeProviderResult } from '../../manifest-utils'

export const isEpubInspectMode = (metadata: ExtractionMetadata): boolean =>
  metadata.extractionMethod === 'epub-bun'

export const writeExtractionArtifact = async (
  outputDir: string,
  extractionResult: ExtractionResult,
  outputFormat: ExtractionOptions['outputFormat'],
  epubInspectMode: boolean,
  jsonFileName = 'result.json'
): Promise<void> => {
  if (epubInspectMode) {
    return
  }

  if (outputFormat === 'text') {
    await writeFile(`${outputDir}/extraction.txt`, extractionResult.text)
    return
  }

  if (outputFormat === 'json') {
    if (jsonFileName) {
      await writeFile(`${outputDir}/${jsonFileName}`, JSON.stringify(extractionResult, null, 2))
    }
    return
  }

  if (outputFormat === 'tsv') {
    const tsv = extractionResult.pages.map(p => `${p.pageNumber}\t${p.text.replace(/\n/g, ' ')}`).join('\n')
    await writeFile(`${outputDir}/extraction.tsv`, tsv)
    return
  }

  const hocr = extractionResult.pages.map(p => `<div class="page" data-page="${p.pageNumber}">${p.text}</div>`).join('\n')
  await writeFile(`${outputDir}/extraction.hocr`, hocr)
}

export const writeTextArtifactFiles = async (
  outputDir: string,
  files: TextArtifactFile[]
): Promise<void> => {
  const topLevelDirs = [...new Set(
    files
      .map((file) => file.relativePath.split('/')[0])
      .filter((dir): dir is string => typeof dir === 'string' && dir.length > 0)
  )]

  for (const dir of topLevelDirs) {
    await rm(join(outputDir, dir), { recursive: true, force: true })
    await mkdir(join(outputDir, dir), { recursive: true })
  }

  for (const file of files) {
    const absolutePath = join(outputDir, file.relativePath)
    await mkdir(dirname(absolutePath), { recursive: true })
    await writeFile(absolutePath, file.text)
  }
}

export const writeProviderArtifacts = async (
  providerDir: string,
  target: { service: string, model: string },
  extractionResult: ExtractionResult,
  step2Metadata: ExtractionMetadata,
  outputFormat: ExtractionOptions['outputFormat'],
  artifactFiles?: TextArtifactFile[] | undefined
): Promise<void> => {
  await writeExtractionArtifact(
    providerDir,
    extractionResult,
    outputFormat,
    isEpubInspectMode(step2Metadata),
    undefined
  )
  await writeProviderResult(
    providerDir,
    target.service,
    target.model,
    step2Metadata as Record<string, unknown>,
    extractionResult as Record<string, unknown>
  )
  if (Array.isArray(artifactFiles)) {
    await writeTextArtifactFiles(providerDir, artifactFiles)
  }
}
