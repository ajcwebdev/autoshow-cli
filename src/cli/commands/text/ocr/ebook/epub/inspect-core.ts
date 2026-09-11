import { firstStartTag, readAttr } from '~/utils/xml-scan'
import type { EpubContentReader, EpubInspectEngine, EpubInspectionPayload, EpubInspectOutput, EpubTocItem } from '~/types'
import { ValidationError } from '~/utils/error-handler'
import { stripNsPrefixes } from './epub-inspection-markup'
import { readEncryptedEntryPaths, validateSpineEncryption } from './epub-spine-readability'
import { normalizeRelPath } from './epub-package-paths'
import { parseMetadata, parseManifest, parseSpine, classifyAssets, findContainerRootfile, findPackagePathFallback } from './epub-package-reader'
import { parseNcx, parseNavHtml } from './epub-inspection-navigation'
import { buildChapters, buildPageText } from './epub-inspection-chapters'
export { normalizeEntryPath } from './epub-package-paths'

export const inspectEpubWithReader = async (
  reader: EpubContentReader,
  engine: EpubInspectEngine
): Promise<EpubInspectOutput> => {
  const warnings: string[] = []
  if (!reader.hasEntry('META-INF/container.xml')) {
    throw ValidationError('Invalid EPUB: META-INF/container.xml not found', { stage: 'ocr:epub' })
  }

  const containerXml = await reader.readText('META-INF/container.xml')
  const container = findContainerRootfile(containerXml)
  const packagePath = container.rootfilePath ? normalizeRelPath(container.rootfilePath) : undefined
  const resolvedPackagePath = packagePath ?? findPackagePathFallback(reader)

  if (!resolvedPackagePath) {
    throw ValidationError('Invalid EPUB: package OPF path could not be resolved', { stage: 'ocr:epub' })
  }
  if (!reader.hasEntry(resolvedPackagePath)) {
    throw ValidationError(`Invalid EPUB: package OPF not found at ${resolvedPackagePath}`, { stage: 'ocr:epub' })
  }

  const opfXml = await reader.readText(resolvedPackagePath)
  const metadata = parseMetadata(opfXml)
  const manifest = parseManifest(opfXml, resolvedPackagePath)
  const spine = parseSpine(opfXml, manifest)
  validateSpineEncryption(spine, await readEncryptedEntryPaths(reader))

  const manifestById = new Map(manifest.map(item => [item.id, item]))
  const strippedOpf = stripNsPrefixes(opfXml)
  const spineTag = firstStartTag(strippedOpf, 'spine')
  const tocId = spineTag ? readAttr(spineTag, 'toc') : undefined
  const ncxItem = tocId ? manifestById.get(tocId) : manifest.find(item => item.mediaType === 'application/x-dtbncx+xml')
  const navItem = manifest.find(item => (item.properties ?? '').split(/\s+/).includes('nav'))

  let tocSource: 'ncx' | 'nav' | 'none' = 'none'
  let tocItems: EpubTocItem[] = []

  if (ncxItem?.path && reader.hasEntry(ncxItem.path)) {
    tocItems = parseNcx(await reader.readText(ncxItem.path), resolvedPackagePath)
    tocSource = 'ncx'
  } else if (navItem?.path && reader.hasEntry(navItem.path)) {
    tocItems = await parseNavHtml(await reader.readText(navItem.path), resolvedPackagePath)
    tocSource = 'nav'
  } else {
    warnings.push('No TOC source found (neither NCX nor EPUB3 nav)')
  }

  const chapters = await buildChapters(reader, spine, tocItems, warnings)
  const assets = classifyAssets(manifest)
  const totalWords = chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0)
  const totalCharacters = chapters.reduce((sum, chapter) => sum + chapter.characterCount, 0)

  const payload: EpubInspectionPayload = {
    schemaVersion: 1,
    engine,
    container: {
      rootfilePath: resolvedPackagePath,
      ...(container.mediaType ? { mediaType: container.mediaType } : {})
    },
    packagePath: resolvedPackagePath,
    metadata,
    manifest,
    spine,
    toc: {
      source: tocSource,
      items: tocItems
    },
    chapters,
    assets,
    inventory: {
      totalFiles: reader.entries.length,
      files: [...reader.entries].sort((a, b) => a.path.localeCompare(b.path))
    },
    stats: {
      chapterCount: chapters.length,
      totalWords,
      totalCharacters,
      totalFiles: reader.entries.length
    },
    diagnostics: {
      adapter: reader.adapterLabel,
      warnings
    }
  }

  return {
    payload,
    text: buildPageText(chapters)
  }
}
