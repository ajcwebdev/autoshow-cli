import { firstStartTag, firstTagAttr, firstTagBlock, firstTagText, innerXml, readAttr, scanTagBlocks } from '~/utils/xml-scan'
import type { EpubTocItem } from '~/types'
import { decodeLegacyPuaText } from './cleanup'
import { stripNsPrefixes, collapseWhitespace, cleanEpubHtmlFragmentToText } from './epub-inspection-markup'
import { resolvePackageHref, splitTocHref } from './epub-package-paths'

const parseNcxNavPoint = (
  block: string,
  packagePath: string
): EpubTocItem => {
  const start = firstStartTag(block, 'navPoint') ?? ''
  const id = readAttr(start, 'id')
  const playOrderRaw = readAttr(start, 'playOrder')
  const playOrder = playOrderRaw ? Number.parseInt(playOrderRaw, 10) : undefined
  const navLabelBlock = firstTagBlock(block, 'navLabel')
  const labelRaw = navLabelBlock ? firstTagText(navLabelBlock, 'text') : undefined
  const label = labelRaw ? decodeLegacyPuaText(labelRaw) : undefined
  const src = firstTagAttr(block, 'content', 'src')
  const hrefParts = src ? splitTocHref(src) : undefined
  const href = hrefParts?.href
  const path = href ? resolvePackageHref(packagePath, href) : undefined
  const childrenXml = innerXml(block, 'navPoint')
  const children = scanTagBlocks(childrenXml, 'navPoint').map(child => parseNcxNavPoint(child, packagePath))

  return {
    ...(id ? { id } : {}),
    ...(playOrder !== undefined && Number.isFinite(playOrder) ? { playOrder } : {}),
    title: label ?? 'Untitled',
    ...(href ? { href } : {}),
    ...(hrefParts?.fragment ? { fragment: hrefParts.fragment } : {}),
    ...(path ? { path } : {}),
    children
  }
}

export const parseNcx = (ncxXml: string, packagePath: string): EpubTocItem[] => {
  const xml = stripNsPrefixes(ncxXml)
  const navMap = firstTagBlock(xml, 'navMap')
  if (!navMap) return []
  const navMapInner = innerXml(navMap, 'navMap')
  return scanTagBlocks(navMapInner, 'navPoint').map(block => parseNcxNavPoint(block, packagePath))
}

export const parseNavHtml = async (navXml: string, packagePath: string): Promise<EpubTocItem[]> => {
  const xml = stripNsPrefixes(navXml)
  const navBlocks = scanTagBlocks(xml, 'nav')
  if (navBlocks.length === 0) return []

  const tocBlock = navBlocks.find(block => {
    const start = firstStartTag(block, 'nav') ?? ''
    return /(?:^|\s)(?:type|epub:type)\s*=\s*["']toc["']/i.test(start) || /role\s*=\s*["']doc-toc["']/i.test(start)
  }) ?? navBlocks[0]
  if (!tocBlock) return []

  const items: EpubTocItem[] = []
  const anchorRegex = /<a\b[^>]*href\s*=\s*(?:"([^"]+)"|'([^']+)')[^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null
  while ((match = anchorRegex.exec(tocBlock)) !== null) {
    const hrefRaw = (match[1] || match[2] || '').trim()
    const hrefParts = splitTocHref(hrefRaw)
    const href = hrefParts.href
    const title = collapseWhitespace(await cleanEpubHtmlFragmentToText(match[3] || ''))
    if (!href || !title) continue
    items.push({
      title,
      href,
      ...(hrefParts.fragment ? { fragment: hrefParts.fragment } : {}),
      path: resolvePackageHref(packagePath, href),
      children: []
    })
  }
  return items
}

const flattenToc = (items: EpubTocItem[]): EpubTocItem[] => {
  const out: EpubTocItem[] = []
  for (const item of items) {
    out.push(item)
    out.push(...flattenToc(item.children))
  }
  return out
}

export const buildTocItemsByPath = (tocItems: EpubTocItem[]): Map<string, EpubTocItem[]> => {
  const tocByPath = new Map<string, EpubTocItem[]>()
  for (const item of flattenToc(tocItems)) {
    if (item.path) {
      const existing = tocByPath.get(item.path) ?? []
      existing.push(item)
      tocByPath.set(item.path, existing)
    }
  }
  return tocByPath
}
