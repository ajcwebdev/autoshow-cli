import { readRunManifestEntry, writeRunManifest } from '../../manifest-utils'

export const writeUrlRunManifest = async (
  outputDir: string,
  metadata: Record<string, unknown>
): Promise<void> => {
  await writeRunManifest(outputDir, 'extract', {
    ...metadata,
    extractRoute: 'article'
  })
}

export const readUrlRunManifestEntry = async (
  outputDir: string
): Promise<Record<string, unknown> | undefined> => {
  const metadata = await readRunManifestEntry(outputDir, 'extract')
  return metadata?.['extractRoute'] === 'article' ? metadata : undefined
}
