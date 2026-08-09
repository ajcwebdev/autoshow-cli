import { isRecord } from '~/utils/rest-client'
import { readRunManifestEntry, writeRunManifest } from '../../manifest-utils'


const isUrlArticleManifestEntry = (
  metadata: Record<string, unknown>
): boolean => {
  const resolvedStep2 = isRecord(metadata['resolvedStep2']) ? metadata['resolvedStep2'] : undefined
  return resolvedStep2?.['route'] === 'article'
}

export const writeUrlRunManifest = async (
  outputDir: string,
  metadata: Record<string, unknown>
): Promise<void> => {
  await writeRunManifest(outputDir, 'extract', metadata)
}

export const readUrlRunManifestEntry = async (
  outputDir: string
): Promise<Record<string, unknown> | undefined> => {
  const metadata = await readRunManifestEntry(outputDir, 'extract')
  return metadata && isUrlArticleManifestEntry(metadata) ? metadata : undefined
}
