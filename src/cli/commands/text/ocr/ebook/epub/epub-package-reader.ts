import { decodeXmlEntities, firstTagAttr, firstTagText, innerXml, scanTagBlocks } from '~/utils/xml-scan'
import type { EpubAssets, EpubContentReader, EpubInspectionPayload, EpubManifestItem, EpubMetadata } from '~/types'
import { stripNsPrefixes, collapseWhitespace } from './epub-inspection-markup'
import { resolvePackageHref } from './epub-package-paths'

const readTagTexts = (xml: string, tagName: string): string[] =>
  scanTagBlocks(xml, tagName)
    .map(block => collapseWhitespace(decodeXmlEntities(innerXml(block, tagName))))
    .filter(Boolean)

export const parseMetadata = (opfXml: string): EpubMetadata => {
  const xml = stripNsPrefixes(opfXml)
  const title = firstTagText(xml, 'title')
  const language = firstTagText(xml, 'language')
  const identifier = firstTagText(xml, 'identifier')
  const description = firstTagText(xml, 'description')
  const publisher = firstTagText(xml, 'publisher')
  const publishedAt = firstTagText(xml, 'date')
  return {
    ...(title ? { title } : {}),
    creators: readTagTexts(xml, 'creator'),
    ...(language ? { language } : {}),
    ...(identifier ? { identifier } : {}),
    ...(description ? { description } : {}),
    ...(publisher ? { publisher } : {}),
    ...(publishedAt ? { publishedAt } : {}),
    subjects: readTagTexts(xml, 'subject')
  }
}

export const parseManifest = (opfXml: string, packagePath: string): EpubManifestItem[] => {
  const xml = stripNsPrefixes(opfXml)
  return scanTagBlocks(xml, 'item')
    .map((block): EpubManifestItem | null => {
      const id = firstTagAttr(block, 'item', 'id')
      const href = firstTagAttr(block, 'item', 'href')
      const mediaType = firstTagAttr(block, 'item', 'media-type')
      const properties = firstTagAttr(block, 'item', 'properties')
      if (!id || !href || !mediaType) return null
      return {
        id,
        href,
        mediaType,
        ...(properties ? { properties } : {}),
        path: resolvePackageHref(packagePath, href)
      }
    })
    .filter((item): item is EpubManifestItem => item !== null)
}

export const parseSpine = (opfXml: string, manifest: EpubManifestItem[]): EpubInspectionPayload['spine'] => {
  const xml = stripNsPrefixes(opfXml)
  const manifestById = new Map(manifest.map(item => [item.id, item]))

  return scanTagBlocks(xml, 'itemref').map((block, index) => {
    const idref = firstTagAttr(block, 'itemref', 'idref') ?? ''
    const linear = firstTagAttr(block, 'itemref', 'linear') ?? 'yes'
    const manifestItem = manifestById.get(idref)
    return {
      index: index + 1,
      idref,
      linear,
      ...(manifestItem?.id ? { manifestId: manifestItem.id } : {}),
      ...(manifestItem?.href ? { href: manifestItem.href } : {}),
      ...(manifestItem?.mediaType ? { mediaType: manifestItem.mediaType } : {}),
      ...(manifestItem?.path ? { path: manifestItem.path } : {})
    }
  })
}

export const classifyAssets = (manifest: EpubManifestItem[]): EpubAssets => {
  const images: string[] = []
  const stylesheets: string[] = []
  const fonts: string[] = []
  const scripts: string[] = []
  const other: string[] = []

  for (const item of manifest) {
    const mediaType = item.mediaType.toLowerCase()
    if (mediaType.startsWith('image/')) {
      images.push(item.path)
      continue
    }
    if (mediaType.includes('css')) {
      stylesheets.push(item.path)
      continue
    }
    if (mediaType.includes('font') || /\.(?:woff2?|ttf|otf)$/i.test(item.path)) {
      fonts.push(item.path)
      continue
    }
    if (mediaType.includes('javascript') || mediaType.includes('ecmascript')) {
      scripts.push(item.path)
      continue
    }
    other.push(item.path)
  }

  return { images, stylesheets, fonts, scripts, other }
}

export const findContainerRootfile = (containerXml: string): { rootfilePath?: string, mediaType?: string } => {
  const xml = stripNsPrefixes(containerXml)
  const rootfile = scanTagBlocks(xml, 'rootfile')[0]
  if (!rootfile) return {}
  const rootfilePath = firstTagAttr(rootfile, 'rootfile', 'full-path')
  const mediaType = firstTagAttr(rootfile, 'rootfile', 'media-type')

  return {
    ...(rootfilePath ? { rootfilePath } : {}),
    ...(mediaType ? { mediaType } : {})
  }
}

export const findPackagePathFallback = (reader: EpubContentReader): string | undefined =>
  reader.entries
    .map(entry => entry.path)
    .find(path => path.toLowerCase().endsWith('.opf'))
