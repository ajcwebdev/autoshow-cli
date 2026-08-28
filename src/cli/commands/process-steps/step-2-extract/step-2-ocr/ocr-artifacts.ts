import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { ExtractionOptions, ExtractionResult, TextArtifactFile } from '~/types'
import { writeFile } from '~/utils/cli-utils'

export const writeExtractionArtifact = async (
  outputDir: string,
  extractionResult: ExtractionResult,
  outputFormat: ExtractionOptions['outputFormat'],
  jsonFileName = 'result.json'
): Promise<void> => {
  if (outputFormat === 'json') {
    if (jsonFileName) {
      await writeFile(`${outputDir}/${jsonFileName}`, JSON.stringify(extractionResult, null, 2))
    }
    return
  }

  await writeFile(`${outputDir}/extraction.txt`, extractionResult.text)
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
  extractionResult: ExtractionResult,
  outputFormat: ExtractionOptions['outputFormat'],
  artifactFiles?: TextArtifactFile[] | undefined
): Promise<void> => {
  await writeExtractionArtifact(
    providerDir,
    extractionResult,
    outputFormat,
    undefined
  )
  await writeFile(join(providerDir, 'result.json'), JSON.stringify(extractionResult, null, 2))
  if (Array.isArray(artifactFiles)) {
    await writeTextArtifactFiles(providerDir, artifactFiles)
  }
}
